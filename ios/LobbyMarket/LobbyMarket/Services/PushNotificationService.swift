//
//  PushNotificationService.swift
//  LobbyMarket
//
//  Manages iOS push notification permission + APNs token registration.
//
//  Flow:
//    1. App launches → AppDelegate sets delegate on UNUserNotificationCenter.
//    2. User signs in → LobbyMarketApp calls onSignIn(userId:).
//    3. onSignIn calls requestAuthorization() if not yet determined.
//    4. If granted, UIApplication.registerForRemoteNotifications() is called.
//    5. AppDelegate receives token → sets cachedTokenData → calls registerToken.
//    6. registerToken upserts the token into apns_tokens via SupabaseClient.
//    7. On sign-out, deregisterCurrentToken() removes the row.
//

import Foundation
import UserNotifications
import UIKit

@MainActor
final class PushNotificationService: ObservableObject {
    static let shared = PushNotificationService()

    @Published private(set) var authStatus: UNAuthorizationStatus = .notDetermined
    @Published private(set) var isRegistering: Bool = false

    /// Set by AppDelegate when APNs issues a token (may arrive before userId is known).
    var cachedTokenData: Data?
    /// Set when the user signs in so AppDelegate can trigger registration immediately.
    var pendingUserId: String?

    private let tokenKey = "com.lobbymarket.apnsToken"

    // MARK: - Sign-in hook

    /// Call this when the user signs in. Requests permission if needed and
    /// registers any pending APNs token.
    func onSignIn(userId: String) async {
        pendingUserId = userId
        await refreshStatus()
        if authStatus == .notDetermined {
            await requestAuthorization(userId: userId)
        } else if authStatus == .authorized || authStatus == .provisional {
            if let data = cachedTokenData {
                await registerToken(data, userId: userId)
            } else {
                await UIApplication.shared.registerForRemoteNotifications()
            }
        }
    }

    /// Call this when the user signs out to remove the device token.
    func onSignOut(userId: String) async {
        pendingUserId = nil
        await deregisterCurrentToken(userId: userId)
    }

    // MARK: - Permission

    func refreshStatus() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        authStatus = settings.authorizationStatus
    }

    func requestAuthorization(userId: String? = nil) async {
        guard authStatus == .notDetermined else {
            if authStatus == .authorized || authStatus == .provisional {
                await UIApplication.shared.registerForRemoteNotifications()
            }
            return
        }
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            await refreshStatus()
            if granted {
                await UIApplication.shared.registerForRemoteNotifications()
            }
        } catch {
            // Not fatal
        }
    }

    // MARK: - Token registration

    /// Called by AppDelegate (or internally) when APNs issues a device token.
    func registerToken(_ tokenData: Data, userId: String) async {
        let hex = tokenData.map { String(format: "%02x", $0) }.joined()
        UserDefaults.standard.set(hex, forKey: tokenKey)
        let deviceName = UIDevice.current.name  // safe on @MainActor
        isRegistering = true
        defer { isRegistering = false }
        do {
            try await SupabaseClient.shared.registerAPNsToken(hex, userId: userId, deviceName: deviceName)
        } catch {
            // Best-effort — retried on next launch
        }
    }

    func deregisterCurrentToken(userId: String) async {
        guard let token = UserDefaults.standard.string(forKey: tokenKey) else { return }
        UserDefaults.standard.removeObject(forKey: tokenKey)
        do {
            try await SupabaseClient.shared.deregisterAPNsToken(token, userId: userId)
        } catch {
            // Best-effort
        }
    }

    // MARK: - Settings

    func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    // MARK: - Local notifications

    func scheduleLocal(title: String, body: String, identifier: String = UUID().uuidString) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
