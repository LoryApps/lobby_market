//
//  LobbyMarketApp.swift
//  LobbyMarket
//
//  App entry point.
//

import SwiftUI

@main
struct LobbyMarketApp: App {
    @StateObject private var auth = AuthService()
    @StateObject private var realtime = RealtimeService()

    /// Persisted across app launches. Set to true once onboarding is completed.
    @AppStorage("lm_onboarding_done") private var onboardingDone: Bool = false

    init() {
        // Force dark-tinted navigation appearance.
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor(red: 10/255, green: 10/255, blue: 15/255, alpha: 1)
        appearance.titleTextAttributes = [.foregroundColor: UIColor.white]
        appearance.largeTitleTextAttributes = [.foregroundColor: UIColor.white]
        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance

        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        tabAppearance.backgroundColor = UIColor(red: 17/255, green: 17/255, blue: 23/255, alpha: 1)
        UITabBar.appearance().standardAppearance = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                ContentView()
                    .environmentObject(auth)
                    .environmentObject(realtime)
                    .preferredColorScheme(.dark)
                    .tint(.forBlue)

                if !onboardingDone {
                    OnboardingView(isComplete: $onboardingDone)
                        .environmentObject(auth)
                        .zIndex(100)
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.5), value: onboardingDone)
        }
    }
}
