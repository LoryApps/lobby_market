//
//  TopicDetailByIdView.swift
//  LobbyMarket
//
//  Loads a Topic by ID, then hands off to TopicDetailView.
//  Used by Bookmarks and any other place that only has a topic ID.
//

import SwiftUI

struct TopicDetailByIdView: View {
    let topicId: String

    @State private var topic: Topic?
    @State private var isLoading = true
    @State private var failed = false

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()
            if isLoading {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(.white)
            } else if let topic {
                TopicDetailView(topic: topic)
            } else {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 32))
                        .foregroundStyle(.againstRed)
                    Text("Topic not found")
                        .font(.lmBody)
                        .foregroundStyle(.textSecondary)
                }
            }
        }
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        topic = try? await SupabaseClient.shared.fetchTopic(id: topicId)
        if topic == nil { failed = true }
    }
}
