//
//  PublicProfileView.swift
//  LobbyMarket
//
//  View any citizen's public profile — stats, follow/unfollow, authored topics,
//  and recent arguments. Navigated to from Leaderboard, ArgumentDetailSheet,
//  and anywhere else a username appears.
//

import SwiftUI

// MARK: - Role label helper

private func roleLabel(_ role: String) -> String {
    switch role {
    case "debator":       return "Debator"
    case "troll_catcher": return "Troll Catcher"
    case "elder":         return "Elder"
    default:              return "Citizen"
    }
}

private func roleColor(_ role: String) -> Color {
    switch role {
    case "debator":       return .forBlue
    case "troll_catcher": return .againstRed
    case "elder":         return .gold
    default:              return .textTertiary
    }
}

// MARK: - Stat chip

private struct StatChip: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.lmHeadline)
                .foregroundStyle(color)
            Text(label)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Argument row

private struct ArgumentRow: View {
    let argument: Argument

    var body: some View {
        let isFor = argument.side == .blue
        let accent: Color = isFor ? .forBlue : .againstRed

        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack(spacing: Spacing.xs) {
                Text(isFor ? "FOR" : "AGAINST")
                    .font(.system(size: 9, weight: .heavy))
                    .foregroundStyle(accent)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(accent.opacity(0.14)))
                    .overlay(Capsule().stroke(accent.opacity(0.3), lineWidth: 1))

                Spacer()

                Text(argument.createdAt, style: .relative)
                    .font(.system(size: 11))
                    .foregroundStyle(.textTertiary)
            }

            Text(argument.content)
                .font(.lmBody)
                .foregroundStyle(.textPrimary)
                .lineLimit(3)
                .lineSpacing(3)

            HStack(spacing: 4) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.textTertiary)
                Text("\(argument.upvotes)")
                    .font(.lmMono)
                    .foregroundStyle(.textTertiary)
            }
        }
        .padding(Spacing.sm)
        .background(Color.surface100)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(accent.opacity(0.15), lineWidth: 1))
    }
}

// MARK: - Avatar circle

private struct AvatarCircle: View {
    let initials: String
    let size: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .fill(LinearGradient(
                    colors: [.forBlue.opacity(0.7), .purple.opacity(0.5)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
                .frame(width: size, height: size)
            Text(initials)
                .font(.system(size: size * 0.38, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
        }
    }
}

// MARK: - Main view

struct PublicProfileView: View {
    let username: String

    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    @State private var profile: Profile?
    @State private var arguments: [Argument] = []
    @State private var topics: [Topic] = []
    @State private var publicVoteHistory: [VoteHistory] = []
    @State private var isFollowing = false
    @State private var isLoading = true
    @State private var followLoading = false
    @State private var errorMessage: String?

    private var publicVoteDates: [Date] { publicVoteHistory.map(\.createdAt) }
    private var publicStreak: Int { VoteCalendarView.streak(from: publicVoteDates) }

    private var isOwnProfile: Bool {
        guard let me = auth.currentUserId, let p = profile else { return false }
        return me == p.id
    }

    private var initials: String {
        guard let p = profile else { return "?" }
        let name = p.displayName ?? p.username
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            if isLoading {
                loadingSkeleton
            } else if let error = errorMessage {
                errorView(error)
            } else if let p = profile {
                profileContent(p)
            }
        }
        .navigationTitle("@\(username)")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadProfile() }
    }

    // MARK: - Profile content

    private func profileContent(_ p: Profile) -> some View {
        ScrollView {
            VStack(spacing: 0) {
                // ── Hero ────────────────────────────────────────────────────
                heroSection(p)
                    .padding(.horizontal, Spacing.md)
                    .padding(.top, Spacing.md)
                    .padding(.bottom, Spacing.lg)

                Divider().background(Color.surface300)

                // ── Stats row ───────────────────────────────────────────────
                statsRow(p)
                    .padding(.vertical, Spacing.md)
                    .padding(.horizontal, Spacing.md)

                Divider().background(Color.surface300)

                // ── Bio ─────────────────────────────────────────────────────
                if let bio = p.bio, !bio.isEmpty {
                    bioSection(bio)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.md)
                    Divider().background(Color.surface300)
                }

                // ── Vote activity heatmap ────────────────────────────────────
                if !publicVoteDates.isEmpty {
                    VoteCalendarView(voteDates: publicVoteDates, streak: publicStreak)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.md)
                    Divider().background(Color.surface300)
                }

                // ── Authored topics ──────────────────────────────────────────
                if !topics.isEmpty {
                    topicsSection
                        .padding(.horizontal, Spacing.md)
                        .padding(.top, Spacing.md)
                    Divider().background(Color.surface300).padding(.top, Spacing.md)
                }

                // ── Recent arguments ─────────────────────────────────────────
                if !arguments.isEmpty {
                    argumentsSection
                        .padding(.horizontal, Spacing.md)
                        .padding(.top, Spacing.md)
                }

                Spacer(minLength: 32)
            }
        }
    }

    // MARK: - Hero section

    private func heroSection(_ p: Profile) -> some View {
        VStack(spacing: Spacing.md) {
            HStack(spacing: Spacing.md) {
                AvatarCircle(initials: initials, size: 72)

                VStack(alignment: .leading, spacing: 4) {
                    Text(p.displayName ?? p.username)
                        .font(.lmTitle)
                        .foregroundStyle(.textPrimary)

                    Text("@\(p.username)")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)

                    Text(roleLabel(p.role))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(roleColor(p.role))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(roleColor(p.role).opacity(0.12)))
                        .overlay(Capsule().stroke(roleColor(p.role).opacity(0.3), lineWidth: 1))
                }

                Spacer()
            }

            // Follow / DM buttons
            if !isOwnProfile {
                HStack(spacing: Spacing.sm) {
                    followButton(p)
                    dmButton(p)
                }
            }

            // Follow counts
            HStack(spacing: Spacing.xl) {
                VStack(spacing: 2) {
                    Text("\(p.followersCount)")
                        .font(.lmHeadline)
                        .foregroundStyle(.textPrimary)
                    Text("Followers")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }
                VStack(spacing: 2) {
                    Text("\(p.followingCount)")
                        .font(.lmHeadline)
                        .foregroundStyle(.textPrimary)
                    Text("Following")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Member since")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                    Text(p.joinedAt, style: .date)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.textSecondary)
                }
            }
        }
    }

    private func followButton(_ p: Profile) -> some View {
        Button {
            Haptics.impact(.medium)
            Task { await toggleFollow(p) }
        } label: {
            HStack(spacing: 6) {
                if followLoading {
                    ProgressView()
                        .tint(isFollowing ? .textSecondary : .white)
                        .scaleEffect(0.8)
                } else {
                    Image(systemName: isFollowing ? "person.badge.minus" : "person.badge.plus")
                        .font(.system(size: 14, weight: .semibold))
                    Text(isFollowing ? "Unfollow" : "Follow")
                        .font(.lmBodyBold)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(isFollowing ? Color.surface200 : Color.forBlue)
            .foregroundStyle(isFollowing ? .textSecondary : .white)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isFollowing ? Color.surface400 : Color.clear, lineWidth: 1)
            )
        }
        .disabled(followLoading)
        .animation(.spring(duration: 0.2), value: isFollowing)
    }

    private func dmButton(_ p: Profile) -> some View {
        let dmPartner = DmProfile(id: p.id, username: p.username,
                                  displayName: p.displayName, avatarURL: p.avatarURL,
                                  role: p.role)
        return NavigationLink(destination: ConversationView(partner: dmPartner)) {
            HStack(spacing: 6) {
                Image(systemName: "bubble.left")
                    .font(.system(size: 14, weight: .semibold))
                Text("Message")
                    .font(.lmBodyBold)
            }
            .padding(.vertical, 10)
            .padding(.horizontal, Spacing.md)
            .background(Color.surface200)
            .foregroundStyle(.textSecondary)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.surface400, lineWidth: 1))
        }
    }

    // MARK: - Stats row

    private func statsRow(_ p: Profile) -> some View {
        HStack(spacing: 0) {
            StatChip(value: "\(p.clout)", label: "Clout", color: .gold)
            Divider().frame(height: 36).background(Color.surface300)
            StatChip(value: "\(p.votesCast)", label: "Votes", color: .forBlue)
            Divider().frame(height: 36).background(Color.surface300)
            StatChip(value: "\(p.topicsCreated)", label: "Topics", color: .purple)
            Divider().frame(height: 36).background(Color.surface300)
            StatChip(value: "\(p.reputation)", label: "Rep", color: .emerald)
        }
    }

    // MARK: - Bio

    private func bioSection(_ bio: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("BIO")
                .font(.lmMono)
                .foregroundStyle(.textTertiary)
                .kerning(1.2)
            Text(bio)
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Topics section

    private var topicsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("TOPICS CREATED")
                .font(.lmMono)
                .foregroundStyle(.textTertiary)
                .kerning(1.2)

            ForEach(topics.prefix(5)) { topic in
                NavigationLink(destination: TopicDetailByIdView(topicId: topic.id)) {
                    HStack(spacing: Spacing.sm) {
                        VStack(alignment: .leading, spacing: 3) {
                            if let cat = topic.category {
                                Text(cat.uppercased())
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundStyle(.gold)
                                    .kerning(0.8)
                            }
                            Text(topic.statement)
                                .font(.lmBody)
                                .foregroundStyle(.textPrimary)
                                .lineLimit(2)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("\(Int(topic.bluePercentage))%")
                                .font(.lmMono)
                                .foregroundStyle(.forBlue)
                            Text("FOR")
                                .font(.system(size: 9, weight: .heavy))
                                .foregroundStyle(.textTertiary)
                        }
                    }
                    .padding(Spacing.sm)
                    .background(Color.surface100)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.surface300, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Arguments section

    private var argumentsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("RECENT ARGUMENTS")
                .font(.lmMono)
                .foregroundStyle(.textTertiary)
                .kerning(1.2)

            ForEach(arguments.prefix(6)) { arg in
                ArgumentRow(argument: arg)
            }
        }
    }

    // MARK: - Loading skeleton

    private var loadingSkeleton: some View {
        ScrollView {
            VStack(spacing: Spacing.md) {
                HStack(spacing: Spacing.md) {
                    Circle().fill(Color.surface200).frame(width: 72, height: 72)
                    VStack(alignment: .leading, spacing: 8) {
                        RoundedRectangle(cornerRadius: 4).fill(Color.surface200).frame(width: 120, height: 14)
                        RoundedRectangle(cornerRadius: 4).fill(Color.surface200).frame(width: 80, height: 11)
                    }
                    Spacer()
                }
                .padding(.horizontal, Spacing.md)
                .padding(.top, Spacing.md)

                HStack(spacing: 0) {
                    ForEach(0..<4, id: \.self) { _ in
                        VStack(spacing: 4) {
                            RoundedRectangle(cornerRadius: 4).fill(Color.surface200).frame(width: 40, height: 18)
                            RoundedRectangle(cornerRadius: 4).fill(Color.surface200).frame(width: 30, height: 10)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(.horizontal, Spacing.md)

                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.surface100)
                        .frame(height: 72)
                        .padding(.horizontal, Spacing.md)
                }
            }
        }
    }

    // MARK: - Error view

    private func errorView(_ msg: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "person.slash")
                .font(.system(size: 48, weight: .thin))
                .foregroundStyle(.textTertiary)
            Text("Profile not found")
                .font(.lmTitle)
                .foregroundStyle(.textSecondary)
            Text(msg)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
                .multilineTextAlignment(.center)
            Button("Retry") {
                Haptics.impact(.light)
                Task { await loadProfile() }
            }
            .font(.lmBodyBold)
            .foregroundStyle(.forBlue)
        }
        .padding(Spacing.xl)
    }

    // MARK: - Data loading

    @MainActor
    private func loadProfile() async {
        isLoading = true
        errorMessage = nil

        do {
            guard let p = try await SupabaseClient.shared.fetchProfileByUsername(username) else {
                errorMessage = "No citizen found with username @\(username)."
                isLoading = false
                return
            }
            profile = p

            async let argsTask    = SupabaseClient.shared.fetchUserArguments(userId: p.id)
            async let topicsTask  = SupabaseClient.shared.fetchTopicsByAuthor(authorId: p.id, limit: 5)
            async let historyTask = SupabaseClient.shared.fetchVoteHistory(userId: p.id, limit: 300)

            arguments         = (try? await argsTask) ?? []
            topics            = (try? await topicsTask) ?? []
            publicVoteHistory = (try? await historyTask) ?? []

            if let myId = auth.currentUserId, myId != p.id {
                isFollowing = await SupabaseClient.shared.isFollowing(myId: myId, targetId: p.id)
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    @MainActor
    private func toggleFollow(_ p: Profile) async {
        guard let myId = auth.currentUserId else { return }
        followLoading = true
        do {
            if isFollowing {
                try await SupabaseClient.shared.unfollowUser(myId: myId, targetId: p.id)
                isFollowing = false
            } else {
                try await SupabaseClient.shared.followUser(myId: myId, targetId: p.id)
                isFollowing = true
            }
        } catch {
            // silently ignore — UI stays as-is
        }
        followLoading = false
    }
}

#Preview {
    NavigationStack {
        PublicProfileView(username: "axiom")
            .environmentObject(AuthService())
    }
}
