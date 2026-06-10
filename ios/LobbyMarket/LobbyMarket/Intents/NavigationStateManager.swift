//
//  NavigationStateManager.swift
//  LobbyMarket
//
//  Singleton that drives tab navigation from App Intents and deep links.
//  Intents call navigate(to:) which publishes a tab change observed by ContentView.
//

import SwiftUI
import Combine

// MARK: - Tab destination

enum AppTab: Hashable {
    case feed
    case discover
    case search
    case debates
    case floor
    case create
    case codex
    case coalitions
    case leaderboard
    case stats
    case notifications
    case achievements
    case saved
    case messages
    case profile
}

// MARK: - Manager

@MainActor
final class NavigationStateManager: ObservableObject {
    static let shared = NavigationStateManager()

    @Published var selectedTab: AppTab = .feed

    private init() {}

    func navigate(to tab: AppTab) {
        selectedTab = tab
    }
}
