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
    @State private var arguments: [Argument] = []
    @State private var loadingArguments = false
    @State private var argumentSideFilter: ArgumentSideFilter = .all
    @State private var showPostSheet = false
    @State private var postSheetSide: Argument.ArgumentSide = .blue

    enum ArgumentSideFilter: String, CaseIterable {
        case all = "All"
        case forSide = "For"
        case against = "Against"
    }

    private var bluePct: Double {
        liveTally?.bluePercentage ?? topic.bluePercentage
    }

    private var filteredArguments: [Argument] {
        switch argumentSideFilter {
        case .all:     return arguments
        case .forSide: return arguments.filter { $0.side == .blue }
        case .against: return arguments.filter { $0.side == .red }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {

                // ── Header ──────────────────────────────────────────────────
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

                // ── Voting ──────────────────────────────────────────────────
                Divider().background(Color.white.opacity(0.1))

                VoteBarView(bluePct: bluePct, totalVotes: liveTally?.total ?? topic.totalVotes)

                VoteButtonsView(currentVote: currentVote) { side in
                    withAnimation { currentVote = side }
                    Haptics.impact(.medium)
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

                // ── Stats row ───────────────────────────────────────────────
                HStack(spacing: Spacing.md) {
                    statChip(icon: "bubble.right", value: "\(topic.commentCount)", label: "comments")
                    statChip(icon: "heart", value: "\(topic.likeCount)", label: "likes")
                    statChip(icon: "clock", value: topic.timeRemaining, label: "")
                }
                .padding(.top, Spacing.xs)

                // ── Arguments ───────────────────────────────────────────────
                Divider().background(Color.white.opacity(0.1))
                    .padding(.top, Spacing.xs)

                VStack(alignment: .leading, spacing: Spacing.sm) {
                    HStack {
                        Text("Arguments")
                            .font(.lmTitle)
                            .foregroundStyle(.textPrimary)
                        Spacer()
                        if loadingArguments {
                            ProgressView()
                                .progressViewStyle(.circular)
                                .tint(.forBlue)
                                .scaleEffect(0.7)
                        } else {
                            Text("\(arguments.count)")
                                .font(.lmMono)
                                .foregroundStyle(.textTertiary)
                        }
                        // Compose button — only if signed in
                        if auth.isAuthenticated {
                            Button {
                                Haptics.impact(.light)
                                postSheetSide = currentVote == .red ? .red : .blue
                                showPostSheet = true
                            } label: {
                                Image(systemName: "square.and.pencil")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(.forBlue)
                            }
                            .padding(.leading, Spacing.xs)
                        }
                    }
                    .sheet(isPresented: $showPostSheet, onDismiss: {
                        Task { await loadArguments() }
                    }) {
                        PostArgumentSheet(topic: topic, initialSide: postSheetSide)
                    }

                    // Side filter
                    if !arguments.isEmpty {
                        argumentSidePicker
                    }

                    // Argument list
                    if loadingArguments && arguments.isEmpty {
                        ForEach(0..<3, id: \.self) { _ in
                            ArgumentSkeletonRow()
                        }
                    } else if filteredArguments.isEmpty {
                        emptyArgumentsView
                    } else {
                        ForEach(filteredArguments) { arg in
                            ArgumentRow(argument: arg)
                        }
                    }
                }
            }
            .padding(Spacing.md)
        }
        .background(Color.surface0.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadAll() }
        .onReceive(realtime.$tallies) { tallies in
            liveTally = tallies[topic.id]
        }
    }

    // MARK: - Subviews

    private var argumentSidePicker: some View {
        HStack(spacing: Spacing.xs) {
            ForEach(ArgumentSideFilter.allCases, id: \.self) { filter in
                Button {
                    Haptics.selection()
                    withAnimation(.spring(duration: 0.2)) {
                        argumentSideFilter = filter
                    }
                } label: {
                    Text(filter.rawValue)
                        .font(.lmCaption)
                        .padding(.horizontal, Spacing.sm)
                        .padding(.vertical, 6)
                        .background(
                            Capsule()
                                .fill(pillColor(filter).opacity(argumentSideFilter == filter ? 0.18 : 0.05))
                                .overlay(
                                    Capsule()
                                        .stroke(pillColor(filter).opacity(argumentSideFilter == filter ? 0.5 : 0.12), lineWidth: 1)
                                )
                        )
                        .foregroundStyle(argumentSideFilter == filter ? pillColor(filter) : .textSecondary)
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }

    private var emptyArgumentsView: some View {
        VStack(spacing: Spacing.xs) {
            Image(systemName: "text.bubble")
                .font(.system(size: 32, weight: .thin))
                .foregroundStyle(.textTertiary)
            Text(argumentSideFilter == .all
                 ? "No arguments yet — be the first to make a case."
                 : "No \(argumentSideFilter.rawValue.lowercased()) arguments yet.")
                .font(.lmBody)
                .foregroundStyle(.textTertiary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xl)
    }

    private func statChip(icon: String, value: String, label: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundStyle(.textTertiary)
            Text(label.isEmpty ? value : "\(value) \(label)")
                .font(.lmCaption)
                .foregroundStyle(.textSecondary)
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, 5)
        .background(
            Capsule().fill(Color.surface200)
                .overlay(Capsule().stroke(Color.white.opacity(0.06), lineWidth: 1))
        )
    }

    private func pillColor(_ filter: ArgumentSideFilter) -> Color {
        switch filter {
        case .all:     return .white
        case .forSide: return .forBlue
        case .against: return .againstRed
        }
    }

    // MARK: - Data loading

    private func loadAll() async {
        realtime.subscribe(topicId: topic.id)
        await loadArguments()
    }

    private func loadArguments() async {
        loadingArguments = true
        do {
            let result = try await SupabaseClient.shared.fetchArguments(topicId: topic.id)
            await MainActor.run {
                arguments = result
                loadingArguments = false
            }
        } catch {
            await MainActor.run { loadingArguments = false }
        }
    }
}

// MARK: - Argument row

struct ArgumentRow: View {
    let argument: Argument

    private var sideColor: Color {
        argument.side == .blue ? .forBlue : .againstRed
    }

    private var sideLabel: String {
        argument.side == .blue ? "FOR" : "AGAINST"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack(spacing: Spacing.xs) {
                // Side indicator pill
                Text(sideLabel)
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundStyle(sideColor)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(sideColor.opacity(0.14)))
                    .overlay(Capsule().stroke(sideColor.opacity(0.35), lineWidth: 1))

                if let username = argument.authorUsername {
                    Text("@\(username)")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }

                Spacer()

                HStack(spacing: 3) {
                    Image(systemName: "chevron.up")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.textTertiary)
                    Text("\(argument.upvotes)")
                        .font(.lmMono)
                        .foregroundStyle(.textTertiary)
                }
            }

            Text(argument.content)
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .lineLimit(6)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg)
                        .stroke(sideColor.opacity(0.12), lineWidth: 1)
                )
        )
    }
}

// MARK: - Skeleton row

private struct ArgumentSkeletonRow: View {
    @State private var animate = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.surface300)
                    .frame(width: 48, height: 16)
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.surface300)
                    .frame(width: 80, height: 12)
                Spacer()
            }
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.surface300)
                .frame(height: 12)
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.surface300)
                .frame(height: 12)
                .padding(.trailing, 40)
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.surface300)
                .frame(height: 12)
                .padding(.trailing, 80)
        }
        .padding(Spacing.md)
        .background(RoundedRectangle(cornerRadius: Radii.lg).fill(Color.surface200))
        .opacity(animate ? 0.5 : 1.0)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                animate = true
            }
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        TopicDetailView(topic: Topic.sampleData[0])
            .environmentObject(AuthService())
            .environmentObject(RealtimeService())
    }
}
