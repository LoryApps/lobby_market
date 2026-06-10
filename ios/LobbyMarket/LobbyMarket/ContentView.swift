//
//  ContentView.swift
//  LobbyMarket
//
//  Root tab container. Observes NavigationStateManager so App Intents
//  (Siri shortcuts) can drive tab switches from outside the view hierarchy.
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var auth: AuthService
    @StateObject private var navState = NavigationStateManager.shared

    var body: some View {
        TabView(selection: $navState.selectedTab) {
            FeedView()
                .tabItem { Label("Feed", systemImage: "house.fill") }
                .tag(AppTab.feed)

            DiscoverView()
                .tabItem { Label("Discover", systemImage: "safari.fill") }
                .tag(AppTab.discover)

            SearchView()
                .tabItem { Label("Search", systemImage: "magnifyingglass") }
                .tag(AppTab.search)

            DebatesView()
                .tabItem { Label("Debates", systemImage: "mic.fill") }
                .tag(AppTab.debates)

            TheFloorView()
                .tabItem { Label("Floor", systemImage: "building.columns.fill") }
                .tag(AppTab.floor)

            CreateTopicView()
                .tabItem { Label("Create", systemImage: "plus.circle.fill") }
                .tag(AppTab.create)

            LawCodexView()
                .tabItem { Label("Codex", systemImage: "books.vertical.fill") }
                .tag(AppTab.codex)

            CoalitionsView()
                .tabItem { Label("Lobbies", systemImage: "person.3.fill") }
                .tag(AppTab.coalitions)

            LeaderboardView()
                .tabItem { Label("Ranks", systemImage: "trophy.fill") }
                .tag(AppTab.leaderboard)

            StatsView()
                .tabItem { Label("Stats", systemImage: "chart.bar.fill") }
                .tag(AppTab.stats)

            NotificationsView()
                .tabItem { Label("Alerts", systemImage: "bell.fill") }
                .tag(AppTab.notifications)

            NavigationStack {
                AchievementsView()
            }
            .tabItem { Label("Badges", systemImage: "rosette") }
            .tag(AppTab.achievements)

            BookmarksView()
                .tabItem { Label("Saved", systemImage: "bookmark.fill") }
                .tag(AppTab.saved)

            MessagesView()
                .tabItem { Label("Messages", systemImage: "bubble.left.and.bubble.right.fill") }
                .tag(AppTab.messages)

            ProfileView()
                .tabItem { Label("Profile", systemImage: "person.fill") }
                .tag(AppTab.profile)
        }
        .tint(.forBlue)
        .background(Color.surface0.ignoresSafeArea())
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthService())
        .environmentObject(RealtimeService())
}
