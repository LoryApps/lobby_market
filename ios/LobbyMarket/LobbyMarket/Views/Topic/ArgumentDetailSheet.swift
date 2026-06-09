//
//  ArgumentDetailSheet.swift
//  LobbyMarket
//
//  Full-screen sheet for an argument: shows the argument text, live upvote
//  toggle, reply count, and a threaded list of replies with a composer bar.
//

import SwiftUI

struct ArgumentDetailSheet: View {
    let argument: Argument
    let topicId: String

    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    @State private var replies: [ArgumentReply] = []
    @State private var loadingReplies = true
    @State private var hasUpvoted = false
    @State private var upvoteCount: Int
    @State private var upvoting = false
    @State private var replyText = ""
    @State private var submittingReply = false
    @FocusState private var replyFocused: Bool

    init(argument: Argument, topicId: String) {
        self.argument = argument
        self.topicId = topicId
        self._upvoteCount = State(initialValue: argument.upvotes)
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                scrollContent
                replyBar
            }
            .background(Color.surface0.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Argument")
                        .font(.lmHeadline)
                        .foregroundStyle(.textPrimary)
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        Haptics.impact(.light)
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.textSecondary)
                    }
                }
            }
        }
        .task { await loadData() }
    }

    // MARK: - Scroll content

    private var scrollContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                argumentCard
                    .padding(Spacing.md)

                Rectangle()
                    .fill(Color.white.opacity(0.06))
                    .frame(height: 1)
                    .padding(.horizontal, Spacing.md)

                repliesSection
                    .padding(Spacing.md)
            }
            .padding(.bottom, 96)
        }
    }

    // MARK: - Argument card

    private var argumentCard: some View {
        let isFor = argument.side == .blue
        let accentColor: Color = isFor ? .forBlue : .againstRed

        return VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: Spacing.xs) {
                Text(isFor ? "FOR" : "AGAINST")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(accentColor)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(accentColor.opacity(0.14)))
                    .overlay(Capsule().stroke(accentColor.opacity(0.35), lineWidth: 1))

                if let username = argument.authorUsername {
                    Text("@\(username)")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }

                Spacer()

                Text(argument.createdAt, style: .relative)
                    .font(.system(size: 11))
                    .foregroundStyle(.textTertiary)
            }

            Text(argument.content)
                .font(.lmBody)
                .foregroundStyle(.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .lineSpacing(4)

            HStack(spacing: Spacing.md) {
                upvoteButton

                HStack(spacing: 5) {
                    Image(systemName: "bubble.left")
                        .font(.system(size: 14))
                        .foregroundStyle(.textTertiary)
                    Text("\(replies.count)")
                        .font(.lmMono)
                        .foregroundStyle(.textTertiary)
                }

                Spacer()
            }
            .padding(.top, Spacing.xxs)
        }
    }

    private var upvoteButton: some View {
        Button {
            Task { await toggleUpvote() }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: hasUpvoted ? "chevron.up.circle.fill" : "chevron.up.circle")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(hasUpvoted ? .forBlue : .textTertiary)
                    .animation(.spring(duration: 0.22), value: hasUpvoted)
                Text("\(upvoteCount)")
                    .font(.lmMono)
                    .foregroundStyle(hasUpvoted ? .forBlue : .textTertiary)
                    .contentTransition(.numericText())
                    .animation(.spring(duration: 0.3), value: upvoteCount)
            }
        }
        .buttonStyle(.plain)
        .disabled(upvoting || auth.currentUserId == nil)
        .scaleEffect(upvoting ? 0.92 : 1.0)
        .animation(.spring(duration: 0.2), value: upvoting)
    }

    // MARK: - Replies section

    private var repliesSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            if loadingReplies || !replies.isEmpty {
                HStack {
                    Text("REPLIES")
                        .font(.system(size: 11, weight: .heavy))
                        .kerning(1.0)
                        .foregroundStyle(.textTertiary)
                    if !replies.isEmpty {
                        Text("·  \(replies.count)")
                            .font(.lmMono)
                            .foregroundStyle(.textTertiary)
                    }
                    Spacer()
                }
                .padding(.bottom, 4)
            }

            if loadingReplies {
                ForEach(0..<4, id: \.self) { _ in replySkeletonRow }
            } else if replies.isEmpty {
                emptyReplies
            } else {
                ForEach(replies) { reply in
                    ReplyRow(reply: reply)
                    if reply.id != replies.last?.id {
                        Rectangle()
                            .fill(Color.white.opacity(0.04))
                            .frame(height: 1)
                    }
                }
            }
        }
    }

    private var emptyReplies: some View {
        HStack {
            Spacer()
            VStack(spacing: 10) {
                Image(systemName: "bubble.left.and.bubble.right")
                    .font(.system(size: 32))
                    .foregroundStyle(.textTertiary.opacity(0.45))
                Text("No replies yet")
                    .font(.lmBody)
                    .foregroundStyle(.textTertiary)
                Text("Be the first to respond")
                    .font(.system(size: 12))
                    .foregroundStyle(.textTertiary.opacity(0.6))
            }
            .padding(.vertical, Spacing.xl)
            Spacer()
        }
    }

    // MARK: - Reply composer bar

    private var replyBar: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Color.white.opacity(0.06))
                .frame(height: 1)

            HStack(alignment: .bottom, spacing: Spacing.sm) {
                TextField("Reply to this argument…", text: $replyText, axis: .vertical)
                    .lineLimit(1...5)
                    .textFieldStyle(.plain)
                    .foregroundStyle(.white)
                    .tint(.forBlue)
                    .font(.lmBody)
                    .focused($replyFocused)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .fill(Color.surface200)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.md)
                                    .stroke(replyFocused ? Color.forBlue.opacity(0.4) : Color.white.opacity(0.08), lineWidth: 1)
                            )
                    )
                    .animation(.easeInOut(duration: 0.18), value: replyFocused)

                Button {
                    Task { await submitReply() }
                } label: {
                    ZStack {
                        if submittingReply {
                            ProgressView()
                                .progressViewStyle(.circular)
                                .tint(.white)
                                .scaleEffect(0.75)
                                .frame(width: 36, height: 36)
                        } else {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.system(size: 30))
                                .foregroundStyle(canSubmitReply ? .forBlue : .textTertiary)
                                .animation(.easeInOut(duration: 0.15), value: canSubmitReply)
                        }
                    }
                }
                .buttonStyle(.plain)
                .disabled(!canSubmitReply || submittingReply)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.top, Spacing.sm)
            .padding(.bottom, Spacing.sm)
            .background(Color.surface100.ignoresSafeArea(edges: .bottom))
        }
    }

    private var canSubmitReply: Bool {
        !replyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && auth.currentUserId != nil
    }

    // MARK: - Skeleton

    private var replySkeletonRow: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            Circle()
                .fill(Color.surface300)
                .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 7) {
                RoundedRectangle(cornerRadius: 3).fill(Color.surface300).frame(width: 90, height: 10)
                RoundedRectangle(cornerRadius: 3).fill(Color.surface300).frame(maxWidth: .infinity).frame(height: 10)
                RoundedRectangle(cornerRadius: 3).fill(Color.surface300).frame(width: 180, height: 10)
            }
        }
        .redacted(reason: .placeholder)
        .padding(.vertical, 6)
    }

    // MARK: - Data actions

    private func loadData() async {
        let fetchedReplies = (try? await SupabaseClient.shared.fetchArgumentReplies(argumentId: argument.id)) ?? []
        let upvoted: Bool
        if let uid = auth.currentUserId {
            upvoted = (try? await SupabaseClient.shared.hasUpvotedArgument(argumentId: argument.id, userId: uid)) ?? false
        } else {
            upvoted = false
        }
        await MainActor.run {
            replies = fetchedReplies
            hasUpvoted = upvoted
            loadingReplies = false
        }
    }

    private func toggleUpvote() async {
        guard let uid = auth.currentUserId, !upvoting else { return }
        upvoting = true
        Haptics.impact(.light)
        let adding = !hasUpvoted
        await MainActor.run {
            hasUpvoted = adding
            upvoteCount += adding ? 1 : -1
        }
        do {
            try await SupabaseClient.shared.toggleArgumentUpvote(argumentId: argument.id, userId: uid, add: adding)
        } catch {
            await MainActor.run {
                hasUpvoted = !adding
                upvoteCount += adding ? -1 : 1
            }
        }
        upvoting = false
    }

    private func submitReply() async {
        let text = replyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let uid = auth.currentUserId, !submittingReply else { return }
        submittingReply = true
        Haptics.impact(.medium)
        replyFocused = false
        do {
            let reply = try await SupabaseClient.shared.postArgumentReply(
                argumentId: argument.id,
                topicId: topicId,
                userId: uid,
                content: text
            )
            await MainActor.run {
                replyText = ""
                replies.append(reply)
                submittingReply = false
            }
        } catch {
            submittingReply = false
        }
    }
}

// MARK: - Reply row

struct ReplyRow: View {
    let reply: ArgumentReply

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            ZStack {
                Circle()
                    .fill(Color.surface300)
                    .frame(width: 28, height: 28)
                Text(String(reply.displayName.prefix(1)).uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.textSecondary)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: Spacing.xxs) {
                    Text(reply.displayName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.textSecondary)
                        .lineLimit(1)
                    Spacer()
                    Text(reply.createdAt, style: .relative)
                        .font(.system(size: 10))
                        .foregroundStyle(.textTertiary)
                }
                Text(reply.content)
                    .font(.system(size: 14))
                    .foregroundStyle(.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                    .lineSpacing(3)
            }
        }
        .padding(.vertical, 6)
    }
}

#Preview {
    ArgumentDetailSheet(
        argument: Argument.sampleData[0],
        topicId: "sample"
    )
    .environmentObject(AuthService())
}
