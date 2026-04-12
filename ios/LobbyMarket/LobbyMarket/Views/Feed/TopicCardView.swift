//
//  TopicCardView.swift
//  LobbyMarket
//
//  Full-screen topic card used in the TikTok-style vertical feed.
//

import SwiftUI

struct TopicCardView: View {
    let topic: Topic
    @State private var currentVote: VoteSide?
    @State private var liked = false
    @State private var showShare = false
    @EnvironmentObject var auth: AuthService

    private var bluePct: Double { topic.bluePercentage }

    var body: some View {
        ZStack(alignment: .bottom) {
            // Background: moody gradient tinted by current vote lean
            backgroundGradient
                .ignoresSafeArea()

            // Soft animated orbs for atmosphere
            atmosphereOrbs
                .ignoresSafeArea()

            // Right-side action rail
            actionRail
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.trailing, Spacing.md)
                .padding(.bottom, 160)

            // Main content stack
            VStack(alignment: .leading, spacing: Spacing.md) {
                topBadges
                Spacer()
                statementBlock
                authorLine
                VoteBarView(bluePct: bluePct, totalVotes: topic.totalVotes)
                    .padding(.top, Spacing.xs)
                VoteButtonsView(currentVote: currentVote, onVote: cast)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, 110)
            .padding(.top, Spacing.xxl)
        }
    }

    // MARK: - Subviews

    private var backgroundGradient: some View {
        let lean = (bluePct - 50) / 50  // -1..1
        let blueBias = max(0, lean)
        let redBias = max(0, -lean)
        return LinearGradient(
            colors: [
                Color.surface0,
                Color.forBlueDark.opacity(0.28 * blueBias + 0.04),
                Color.surface100,
                Color.againstRedDark.opacity(0.28 * redBias + 0.04),
                Color.surface0
            ],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    private var atmosphereOrbs: some View {
        GeometryReader { geo in
            ZStack {
                Circle()
                    .fill(Color.forBlue.opacity(0.20))
                    .frame(width: 420, height: 420)
                    .blur(radius: 120)
                    .offset(x: -140, y: -geo.size.height * 0.20)
                Circle()
                    .fill(Color.againstRed.opacity(0.18))
                    .frame(width: 420, height: 420)
                    .blur(radius: 120)
                    .offset(x: geo.size.width * 0.35, y: geo.size.height * 0.12)
            }
        }
        .allowsHitTesting(false)
    }

    private var topBadges: some View {
        HStack(spacing: Spacing.xs) {
            if let category = topic.category {
                Text(category.uppercased())
                    .font(.lmCaption)
                    .foregroundStyle(.white)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, 6)
                    .background(
                        Capsule().fill(Color.surface300.opacity(0.7))
                            .overlay(Capsule().stroke(Color.white.opacity(0.12), lineWidth: 1))
                    )
            }
            Spacer()
            Label(topic.timeRemaining, systemImage: "clock")
                .font(.lmCaption)
                .foregroundStyle(.textSecondary)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, 6)
                .background(
                    Capsule().fill(Color.surface300.opacity(0.6))
                )
        }
    }

    private var statementBlock: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(topic.statement)
                .font(.lmDisplayMedium)
                .foregroundStyle(.textPrimary)
                .lineLimit(5)
                .minimumScaleFactor(0.7)
                .shadow(color: .black.opacity(0.6), radius: 8, x: 0, y: 2)

            if let description = topic.description, !description.isEmpty {
                Text(description)
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .lineLimit(3)
            }
        }
    }

    private var authorLine: some View {
        HStack(spacing: Spacing.xs) {
            Circle()
                .fill(LinearGradient.forGradient)
                .frame(width: 34, height: 34)
                .overlay(
                    Text(initial(for: topic.authorName))
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(.white)
                )
            VStack(alignment: .leading, spacing: 2) {
                Text(topic.authorName ?? "anonymous")
                    .font(.lmBodyBold)
                    .foregroundStyle(.textPrimary)
                Text(relativeDate(topic.createdAt))
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
            }
            Spacer()
        }
    }

    private var actionRail: some View {
        VStack(spacing: Spacing.lg) {
            actionButton(
                icon: liked ? "heart.fill" : "heart",
                count: topic.likeCount + (liked ? 1 : 0),
                tint: liked ? .againstRed : .white
            ) {
                Haptics.impact(.light)
                liked.toggle()
            }
            actionButton(icon: "bubble.right", count: topic.commentCount, tint: .white) {
                Haptics.selection()
            }
            actionButton(icon: "arrowshape.turn.up.right", count: nil, tint: .white) {
                Haptics.selection()
                showShare = true
            }
        }
        .sheet(isPresented: $showShare) {
            ShareSheet(items: ["Lobby Market: \(topic.statement)"])
        }
    }

    @ViewBuilder
    private func actionButton(icon: String, count: Int?, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundStyle(tint)
                    .frame(width: 48, height: 48)
                    .background(
                        Circle().fill(Color.surface300.opacity(0.55))
                            .overlay(Circle().stroke(Color.white.opacity(0.12), lineWidth: 1))
                    )
                if let count {
                    Text(compact(count))
                        .font(.lmCaption)
                        .foregroundStyle(.textSecondary)
                }
            }
        }
        .buttonStyle(PressableButtonStyle())
    }

    // MARK: - Actions

    private func cast(_ side: VoteSide) {
        withAnimation(.spring()) { currentVote = side }
        guard let userId = auth.currentUserId else {
            // Unauthenticated: local only.
            return
        }
        Task {
            try? await SupabaseClient.shared.castVote(
                topicId: topic.id,
                side: side,
                userId: userId
            )
        }
    }

    private func initial(for name: String?) -> String {
        guard let name, let first = name.first else { return "?" }
        return String(first).uppercased()
    }

    private func relativeDate(_ date: Date) -> String {
        let fmt = RelativeDateTimeFormatter()
        fmt.unitsStyle = .short
        return fmt.localizedString(for: date, relativeTo: Date())
    }

    private func compact(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1_000 { return String(format: "%.1fK", Double(n) / 1_000) }
        return "\(n)"
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    TopicCardView(topic: Topic.sampleData[0])
        .environmentObject(AuthService())
}
