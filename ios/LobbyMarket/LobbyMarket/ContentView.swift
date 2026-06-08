//
//  ContentView.swift
//  LobbyMarket
//
//  Root tab container.
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var auth: AuthService
    @State private var selectedTab: Tab = .feed

    enum Tab: Hashable {
        case feed, search, debates, floor, create, codex, coalitions, leaderboard, stats, notifications, achievements, saved, messages, profile
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            FeedView()
                .tabItem {
                    Label("Feed", systemImage: "house.fill")
                }
                .tag(Tab.feed)

            SearchView()
                .tabItem {
                    Label("Search", systemImage: "magnifyingglass")
                }
                .tag(Tab.search)

            DebatesView()
                .tabItem {
                    Label("Debates", systemImage: "mic.fill")
                }
                .tag(Tab.debates)

            TheFloorView()
                .tabItem {
                    Label("Floor", systemImage: "building.columns.fill")
                }
                .tag(Tab.floor)

            CreateTopicView()
                .tabItem {
                    Label("Create", systemImage: "plus.circle.fill")
                }
                .tag(Tab.create)

            LawCodexView()
                .tabItem {
                    Label("Codex", systemImage: "books.vertical.fill")
                }
                .tag(Tab.codex)

            CoalitionsView()
                .tabItem {
                    Label("Lobbies", systemImage: "person.3.fill")
                }
                .tag(Tab.coalitions)

            LeaderboardView()
                .tabItem {
                    Label("Ranks", systemImage: "trophy.fill")
                }
                .tag(Tab.leaderboard)

            StatsView()
                .tabItem {
                    Label("Stats", systemImage: "chart.bar.fill")
                }
                .tag(Tab.stats)

            NotificationsView()
                .tabItem {
                    Label("Alerts", systemImage: "bell.fill")
                }
                .tag(Tab.notifications)

            NavigationStack {
                AchievementsView()
            }
            .tabItem {
                Label("Badges", systemImage: "rosette")
            }
            .tag(Tab.achievements)

            BookmarksView()
                .tabItem {
                    Label("Saved", systemImage: "bookmark.fill")
                }
                .tag(Tab.saved)

            MessagesView()
                .tabItem {
                    Label("Messages", systemImage: "bubble.left.and.bubble.right.fill")
                }
                .tag(Tab.messages)

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
                .tag(Tab.profile)
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
