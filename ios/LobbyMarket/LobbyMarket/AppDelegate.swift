//
//  AppDelegate.swift
//  LobbyMarket
//
//  UIApplicationDelegate for APNs token callbacks and push notification handling.
//

import UIKit
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    // MARK: - APNs Token Registration

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        // Cache raw token data. Registration with Supabase happens once
        // the user's ID is available (wired up in LobbyMarketApp via .onChange).
        PushNotificationService.shared.cachedTokenData = deviceToken
        // If we already have a userId stored (e.g. app re-launched while signed in),
        // register immediately.
        if let userId = PushNotificationService.shared.pendingUserId {
            Task { @MainActor in
                await PushNotificationService.shared.registerToken(deviceToken, userId: userId)
            }
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("[Push] Failed to register for remote notifications: \(error.localizedDescription)")
    }

    // MARK: - Foreground Notification Presentation

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

    // MARK: - Notification Tap Handling

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo
        handleNotificationPayload(userInfo)
        completionHandler()
    }

    // MARK: - Deep-link routing

    private func handleNotificationPayload(_ userInfo: [AnyHashable: Any]) {
        guard let type = userInfo["type"] as? String else { return }
        NotificationCenter.default.post(
            name: .lobbyMarketPushReceived,
            object: nil,
            userInfo: ["type": type, "payload": userInfo]
        )
    }
}

// MARK: - Notification name

extension Notification.Name {
    static let lobbyMarketPushReceived = Notification.Name("com.lobbymarket.pushReceived")
}
