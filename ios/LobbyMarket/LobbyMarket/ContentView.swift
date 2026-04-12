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
        case feed, floor, create, codex, profile
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            FeedView()
                .tabItem {
                    Label("Feed", systemImage: "house.fill")
                }
                .tag(Tab.feed)

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
