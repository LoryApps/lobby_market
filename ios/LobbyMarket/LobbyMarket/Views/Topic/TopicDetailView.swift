//
//  TopicDetailView.swift
//  LobbyMarket
//

import SwiftUI

struct TopicDetailView: View {
    let topic: Topic

    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var realtime: RealtimeService
    @State private var currentVote: VoteSide?
    @State private var liveTally: VoteTally?

    private var bluePct: Double {
        liveTally?.bluePercentage ?? topic.bluePercentage
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                if let category = topic.category {
                    Text(category.uppercased())
                        .font(.lmCaption)
                        .kerning(1.2)
                        .foregroundStyle(.gold)
                }

                Text(topic.statement)
                    .font(.lmDisplayMedium)
                    .foregroundStyle(.textPrimary)

                if let description = topic.description {
                    Text(description)
                        .font(.lmBody)
                        .foregroundStyle(.textSecondary)
                }

                Divider().background(Color.white.opacity(0.1))

                VoteBarView(bluePct: bluePct, totalVotes: liveTally?.total ?? topic.totalVotes)

                VoteButtonsView(currentVote: currentVote) { side in
                    withAnimation { currentVote = side }
                    guard let uid = auth.currentUserId else { return }
                    Task {
                        try? await SupabaseClient.shared.castVote(
                            topicId: topic.id,
                            side: side,
                            userId: uid
                        )
                    }
                }
                .padding(.top, Spacing.xs)

                VStack(alignment: .leading, spacing: Spacing.sm) {
                    Label("\(topic.commentCount) comments", systemImage: "bubble.right")
                    Label("\(topic.likeCount) likes", systemImage: "heart")
                    Label(topic.timeRemaining, systemImage: "clock")
                    if let author = topic.authorName {
                        Label(author, systemImage: "person.circle")
                    }
                }
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .padding(.top, Spacing.md)
            }
            .padding(Spacing.md)
        }
        .background(Color.surface0.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            realtime.subscribe(topicId: topic.id)
        }
        .onReceive(realtime.$tallies) { tallies in
            liveTally = tallies[topic.id]
        }
    }
}

#Preview {
    NavigationStack {
        TopicDetailView(topic: Topic.sampleData[0])
            .environmentObject(AuthService())
            .environmentObject(RealtimeService())
    }
}
