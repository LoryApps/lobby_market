//
//  ArenaView.swift
//  LobbyMarket
//
//  Argument Arena — head-to-head faceoff voting.
//  Users tap the more compelling argument; win records feed the Arena leaderboard.
//

import SwiftUI

// MARK: - Models

struct ArenaArgument: Identifiable {
    let id: String
    let content: String
    let side: String   // "blue" | "red"
    let upvotes: Int
    let authorUsername: String?
}

struct ArenaMatchup {
    let argA: ArenaArgument   // always the "for" argument
    let argB: ArenaArgument   // always the "against" argument
}

// MARK: - ArenaView

struct ArenaView: View {
    let topic: Topic

    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    @State private var matchup: ArenaMatchup?
    @State private var loading = true
    @State private var submitting = false
    @State private var chosen: ArenaArgument?
    @State private var totalDone = 0
    @State private var allDone = false
    @State private var error: String?
    @State private var profileUsername: String?

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            VStack(spacing: 0) {
                header

                if loading {
                    loadingView
                } else if allDone {
                    allDoneView
                } else if let m = matchup {
                    ScrollView {
                        VStack(spacing: Spacing.lg) {
                            topicContext
                            promptLabel
                            argumentCard(m.argA)
                            vsLabel
                            argumentCard(m.argB)
                            Spacer(minLength: Spacing.xxl)
                        }
                        .padding(.horizontal, Spacing.md)
                        .padding(.top, Spacing.sm)
                        .padding(.bottom, Spacing.xxl)
                    }
                } else if let err = error {
                    errorView(err)
                }
            }
        }
        .task { await loadMatchup() }
        .sheet(isPresented: Binding(get: { profileUsername != nil },
                                   set: { if !$0 { profileUsername = nil } })) {
            if let name = profileUsername {
                NavigationStack {
                    PublicProfileView(username: name)
                        .environmentObject(auth)
                }
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            Button {
                Haptics.impact(.light)
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.textSecondary)
                    .padding(Spacing.xs)
                    .background(Circle().fill(Color.surface300))
            }
            .buttonStyle(.plain)

            Spacer()

            VStack(spacing: 2) {
                Text("Argument Arena")
                    .font(.lmHeadline)
                    .foregroundStyle(.textPrimary)
                if totalDone > 0 {
                    Text("\(totalDone) judged")
                        .font(.lmCaption)
                        .foregroundStyle(.gold)
                }
            }

            Spacer()

            // Balance the close button
            Color.clear
                .frame(width: 32, height: 32)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(Color.surface100)
        .overlay(alignment: .bottom) {
            Divider().opacity(0.3)
        }
    }

    // MARK: - Topic context

    private var topicContext: some View {
        VStack(alignment: .leading, spacing: Spacing.xxs) {
            if let cat = topic.category {
                Text(cat.uppercased())
                    .font(.lmCaption)
                    .kerning(1.2)
                    .foregroundStyle(.gold)
            }
            Text(topic.statement)
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200)
                .overlay(RoundedRectangle(cornerRadius: Radii.md).stroke(Color.white.opacity(0.06), lineWidth: 1))
        )
    }

    // MARK: - Prompt

    private var promptLabel: some View {
        Text("Which makes the stronger case?")
            .font(.lmTitle)
            .foregroundStyle(.textPrimary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.xs)
    }

    // MARK: - Argument card

    private func argumentCard(_ arg: ArenaArgument) -> some View {
        let isFor     = arg.side == "blue"
        let accentColor: Color = isFor ? .forBlue : .againstRed
        let sideLabel  = isFor ? "FOR" : "AGAINST"
        let isChosen   = chosen?.id == arg.id
        let otherChosen = chosen != nil && !isChosen

        return Button {
            guard chosen == nil, !submitting else { return }
            pickWinner(arg)
        } label: {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: Spacing.xs) {
                    Text(sideLabel)
                        .font(.lmCaption)
                        .kerning(1.2)
                        .foregroundStyle(accentColor)
                        .padding(.horizontal, Spacing.xs)
                        .padding(.vertical, 3)
                        .background(
                            Capsule().fill(accentColor.opacity(0.12))
                                .overlay(Capsule().stroke(accentColor.opacity(0.3), lineWidth: 1))
                        )

                    Spacer()

                    if isChosen {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(accentColor)
                            .font(.system(size: 18))
                            .transition(.scale.combined(with: .opacity))
                    }
                }

                Text(arg.content)
                    .font(.lmBody)
                    .foregroundStyle(otherChosen ? .textTertiary : .textPrimary)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: Spacing.xs) {
                    if let author = arg.authorUsername {
                        Button {
                            Haptics.impact(.light)
                            profileUsername = author
                        } label: {
                            Text("@\(author)")
                                .font(.lmCaption)
                                .foregroundStyle(.forBlue.opacity(0.7))
                        }
                        .buttonStyle(.plain)
                    }
                    Spacer()
                    Image(systemName: "arrow.up")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.textTertiary)
                    Text("\(arg.upvotes)")
                        .font(.lmMono)
                        .foregroundStyle(.textTertiary)
                }
            }
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .fill(isChosen ? accentColor.opacity(0.08) : Color.surface200)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg)
                            .stroke(
                                isChosen ? accentColor.opacity(0.6) : Color.white.opacity(otherChosen ? 0.04 : 0.06),
                                lineWidth: isChosen ? 1.5 : 1
                            )
                    )
            )
            .shadow(
                color: isChosen ? accentColor.opacity(0.15) : .black.opacity(0.3),
                radius: isChosen ? 20 : 12, x: 0, y: 6
            )
            .opacity(otherChosen ? 0.45 : 1.0)
            .scaleEffect(isChosen ? 1.01 : 1.0)
            .animation(.spring(duration: 0.28), value: isChosen)
            .animation(.easeOut(duration: 0.2), value: otherChosen)
        }
        .buttonStyle(.plain)
        .disabled(chosen != nil || submitting)
    }

    // MARK: - VS divider

    private var vsLabel: some View {
        HStack(spacing: Spacing.sm) {
            Rectangle().fill(Color.white.opacity(0.08)).frame(height: 1)
            Text("VS")
                .font(.lmMono)
                .foregroundStyle(.textTertiary)
                .padding(.horizontal, Spacing.xs)
            Rectangle().fill(Color.white.opacity(0.08)).frame(height: 1)
        }
    }

    // MARK: - States

    private var loadingView: some View {
        VStack(spacing: Spacing.md) {
            Spacer()
            ProgressView()
                .progressViewStyle(.circular)
                .tint(.forBlue)
                .scaleEffect(1.3)
            Text("Loading matchup…")
                .font(.lmBody)
                .foregroundStyle(.textTertiary)
            Spacer()
        }
    }

    private var allDoneView: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()
            Image(systemName: "trophy.fill")
                .font(.system(size: 56))
                .foregroundStyle(.gold)

            VStack(spacing: Spacing.xs) {
                Text("Arena Complete")
                    .font(.lmDisplayMedium)
                    .foregroundStyle(.textPrimary)
                Text("You judged \(totalDone) argument\(totalDone == 1 ? "" : "s").")
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                Text("Come back when new arguments are posted.")
                    .font(.lmBody)
                    .foregroundStyle(.textTertiary)
                    .multilineTextAlignment(.center)
            }

            Button {
                Haptics.impact(.light)
                dismiss()
            } label: {
                Text("Done")
                    .font(.lmBodyBold)
                    .foregroundStyle(.surface0)
                    .padding(.horizontal, Spacing.xl)
                    .padding(.vertical, Spacing.sm)
                    .background(Capsule().fill(Color.gold))
            }
            .buttonStyle(.plain)

            Spacer()
        }
        .padding(Spacing.md)
    }

    private func errorView(_ msg: String) -> some View {
        VStack(spacing: Spacing.md) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40, weight: .thin))
                .foregroundStyle(.gold)
            Text(msg)
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .multilineTextAlignment(.center)
            Button {
                Haptics.impact(.light)
                dismiss()
            } label: {
                Text("Close")
                    .font(.lmBodyBold)
                    .foregroundStyle(.forBlue)
            }
            .buttonStyle(.plain)
            Spacer()
        }
        .padding(Spacing.md)
    }

    // MARK: - Logic

    private func pickWinner(_ winner: ArenaArgument) {
        guard let m = matchup else { return }
        Haptics.impact(.medium)
        withAnimation { chosen = winner }

        Task {
            submitting = true
            defer { submitting = false }

            if let uid = auth.currentUserId {
                try? await SupabaseClient.shared.submitFaceoffVote(
                    argumentAId: m.argA.id,
                    argumentBId: m.argB.id,
                    winnerId: winner.id,
                    userId: uid
                )
            }

            // Brief pause so user sees the selection
            try? await Task.sleep(nanoseconds: 900_000_000)

            withAnimation {
                totalDone += 1
                chosen = nil
            }

            await loadMatchup()
        }
    }

    private func loadMatchup() async {
        loading = true
        defer { loading = false }
        error = nil

        do {
            let userId = auth.currentUserId
            if let pair = try await SupabaseClient.shared.fetchArenaMatchup(
                topicId: topic.id,
                userId: userId
            ) {
                withAnimation(.easeInOut(duration: 0.25)) {
                    matchup = pair
                    allDone = false
                }
            } else {
                withAnimation { allDone = true }
            }
        } catch {
            self.error = "Couldn't load matchup. Check your connection."
        }
    }
}
