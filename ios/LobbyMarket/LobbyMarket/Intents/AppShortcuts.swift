//
//  AppShortcuts.swift
//  LobbyMarket
//
//  Siri App Shortcuts — surfaces Lobby Market actions in Spotlight,
//  Shortcuts.app, and Siri. Users can say:
//    "Show trending topics in Lobby Market"
//    "Open Lobby Market"
//    "Show my stats in Lobby Market"
//    "What's happening in Lobby Market"
//

import AppIntents
import SwiftUI

// MARK: - App Shortcuts Provider

struct LobbyMarketShortcuts: AppShortcutsProvider {

    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ShowTrendingIntent(),
            phrases: [
                "Show trending topics in \(.applicationName)",
                "What's trending in \(.applicationName)",
                "Show me what people are voting on in \(.applicationName)",
            ],
            shortTitle: "Trending Topics",
            systemImageName: "chart.line.uptrend.xyaxis"
        )

        AppShortcut(
            intent: OpenFeedIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Open \(.applicationName) feed",
                "Show my \(.applicationName) feed",
            ],
            shortTitle: "Open Feed",
            systemImageName: "house.fill"
        )

        AppShortcut(
            intent: ShowMyStatsIntent(),
            phrases: [
                "Show my \(.applicationName) stats",
                "What's my \(.applicationName) score",
                "My civic stats in \(.applicationName)",
            ],
            shortTitle: "My Stats",
            systemImageName: "chart.bar.fill"
        )

        AppShortcut(
            intent: OpenDebatesIntent(),
            phrases: [
                "Show upcoming debates in \(.applicationName)",
                "What debates are happening in \(.applicationName)",
                "Open \(.applicationName) debates",
            ],
            shortTitle: "Upcoming Debates",
            systemImageName: "mic.fill"
        )

        AppShortcut(
            intent: OpenLeaderboardIntent(),
            phrases: [
                "Show \(.applicationName) leaderboard",
                "Who's winning in \(.applicationName)",
                "Top citizens in \(.applicationName)",
            ],
            shortTitle: "Leaderboard",
            systemImageName: "trophy.fill"
        )
    }
}

// MARK: - Show Trending Intent

struct ShowTrendingIntent: AppIntent {
    static var title: LocalizedStringResource = "Show Trending Topics"
    static var description = IntentDescription("Opens the trending topics feed in Lobby Market.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        NavigationStateManager.shared.navigate(to: .discover)
        return .result()
    }
}

// MARK: - Open Feed Intent

struct OpenFeedIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Feed"
    static var description = IntentDescription("Opens the main civic feed in Lobby Market.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        NavigationStateManager.shared.navigate(to: .feed)
        return .result()
    }
}

// MARK: - Show My Stats Intent

struct ShowMyStatsIntent: AppIntent {
    static var title: LocalizedStringResource = "Show My Stats"
    static var description = IntentDescription("Opens your personal civic analytics in Lobby Market.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        NavigationStateManager.shared.navigate(to: .stats)
        return .result()
    }
}

// MARK: - Open Debates Intent

struct OpenDebatesIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Debates"
    static var description = IntentDescription("Shows upcoming and live debates in Lobby Market.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        NavigationStateManager.shared.navigate(to: .debates)
        return .result()
    }
}

// MARK: - Open Leaderboard Intent

struct OpenLeaderboardIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Leaderboard"
    static var description = IntentDescription("Shows the civic influence leaderboard in Lobby Market.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        NavigationStateManager.shared.navigate(to: .leaderboard)
        return .result()
    }
}
