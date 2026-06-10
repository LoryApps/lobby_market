//
//  ProfileView.swift
//  LobbyMarket
//
//  Rich citizen profile: avatar, identity, stats, vote DNA, recent
//  activity, authored topics, and an inline profile-edit sheet.
//

import SwiftUI

// MARK: - Category color map (same as StatsView)

private let PROFILE_CAT_COLORS: [String: Color] = [
    "Economics":   .gold,
    "Politics":    .forBlue,
    "Technology":  .purple,
    "Science":     .emerald,
    "Ethics":      .againstRed,
    "Philosophy":  .purple,
    "Culture":     .gold,
    "Health":      .emerald,
    "Environment": .emerald,
    "Education":   .forBlue,
]

private func catColor(_ cat: String) -> Color {
    PROFILE_CAT_COLORS[cat] ?? Color.white.opacity(0.5)
}

// MARK: - Role labels

private let ROLE_LABELS: [String: String] = [
    "person":        "Citizen",
    "debator":       "Debator",
    "troll_catcher": "Troll Catcher",
    "elder":         "Elder",
]

// MARK: - Small helpers

private struct SectionHeader: View {
    let title: String
    var body: some View {
        Text(title)
            .font(.lmMono)
            .foregroundStyle(.textTertiary)
            .kerning(1.2)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Edit Profile Sheet

private struct EditProfileSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var auth: AuthService

    var currentProfile: Profile?
    var onSave: (String?, String?) -> Void

    @State private var displayName: String = ""
    @State private var bio: String = ""
    @State private var isSaving = false
    @State private var errorMsg: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: Spacing.lg) {
                        VStack(alignment: .leading, spacing: Spacing.xs) {
                            Text("Display Name")
                                .font(.lmCaption)
                                .foregroundStyle(.textSecondary)
                            TextField("Your name", text: $displayName)
                                .font(.lmBody)
                                .foregroundStyle(.white)
                                .padding(Spacing.sm)
                                .background(
                                    RoundedRectangle(cornerRadius: Radii.sm)
                                        .fill(Color.surface200)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: Radii.sm)
                                                .stroke(Color.white.opacity(0.08), lineWidth: 1)
                                        )
                                )
                        }

                        VStack(alignment: .leading, spacing: Spacing.xs) {
                            Text("Bio")
                                .font(.lmCaption)
                                .foregroundStyle(.textSecondary)
                            ZStack(alignment: .topLeading) {
                                if bio.isEmpty {
                                    Text("Tell the Lobby who you are…")
                                        .font(.lmBody)
                                        .foregroundStyle(.textTertiary)
                                        .padding(.horizontal, Spacing.sm)
                                        .padding(.vertical, Spacing.sm + 2)
                                }
                                TextEditor(text: $bio)
                                    .font(.lmBody)
                                    .foregroundStyle(.white)
                                    .scrollContentBackground(.hidden)
                                    .frame(minHeight: 100)
                                    .padding(Spacing.xs)
                            }
                            .background(
                                RoundedRectangle(cornerRadius: Radii.sm)
                                    .fill(Color.surface200)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: Radii.sm)
                                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                                    )
                            )
                        }

                        if let err = errorMsg {
                            Text(err)
                                .font(.lmCaption)
                                .foregroundStyle(.againstRed)
                        }

                        Button {
                            Task { await save() }
                        } label: {
                            HStack {
                                if isSaving {
                                    ProgressView()
                                        .tint(.white)
                                        .scaleEffect(0.8)
                                }
                                Text(isSaving ? "Saving…" : "Save Changes")
                                    .font(.lmBodyBold)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(
                                RoundedRectangle(cornerRadius: Radii.md)
                                    .fill(Color.forBlue)
                            )
                            .foregroundStyle(.white)
                        }
                        .disabled(isSaving)
                    }
                    .padding(Spacing.md)
                }
            }
            .navigationTitle("Edit Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(.textSecondary)
                }
            }
            .onAppear {
                displayName = currentProfile?.displayName ?? ""
                bio = currentProfile?.bio ?? ""
            }
        }
    }

    private func save() async {
        guard let uid = auth.currentUserId else { return }
        isSaving = true
        errorMsg = nil
        do {
            try await SupabaseClient.shared.updateProfile(
                id: uid,
                displayName: displayName,
                bio: bio
            )
            onSave(displayName.isEmpty ? nil : displayName,
                   bio.isEmpty ? nil : bio)
            dismiss()
        } catch {
            errorMsg = error.localizedDescription
        }
        isSaving = false
    }
}

// MARK: - Main ProfileView

struct ProfileView: View {
    @EnvironmentObject var auth: AuthService

    @State private var profile: Profile?
    @State private var recentVotes: [RecentActivityVote] = []
    @State private var authoredTopics: [Topic] = []
    @State private var isLoading = false
    @State private var showEdit = false
    @State private var showSettings = false
    @State private var showWallet = false

    // MARK: Computed

    private var displayName: String {
        profile?.displayName ?? profile?.username ?? auth.currentUsername ?? "Citizen"
    }

    private var username: String {
        profile?.username ?? auth.currentUsername ?? ""
    }

    private var joinYear: String {
        guard let d = profile?.joinedAt else { return "" }
        let fmt = DateFormatter()
        fmt.dateFormat = "MMM yyyy"
        return fmt.string(from: d)
    }

    private var categoryStats: [(cat: String, count: Int, fraction: Double)] {
        var map: [String: Int] = [:]
        for v in recentVotes {
            let key = v.topicCategory ?? "Other"
            map[key, default: 0] += 1
        }
        let total = map.values.reduce(0, +)
        guard total > 0 else { return [] }
        return map
            .sorted { $0.value > $1.value }
            .prefix(5)
            .map { (cat: $0.key, count: $0.value, fraction: Double($0.value) / Double(total)) }
    }

    // MARK: Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                if !auth.isAuthenticated {
                    LoginView()
                } else {
                    ScrollView {
                        VStack(spacing: Spacing.lg) {
                            heroSection
                            statsGrid
                            if !categoryStats.isEmpty {
                                voteDNASection
                            }
                            if !recentVotes.isEmpty {
                                recentVotesSection
                            }
                            if !authoredTopics.isEmpty {
                                authoredTopicsSection
                            }
                            actionsBlock
                            Spacer(minLength: 40)
                        }
                        .padding(Spacing.md)
                    }
                    .refreshable {
                        await loadAll()
                    }
                    if isLoading && profile == nil {
                        loadingOverlay
                    }
                }
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                if auth.isAuthenticated {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        HStack(spacing: Spacing.xs) {
                            Button {
                                showEdit = true
                            } label: {
                                Image(systemName: "pencil")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(.forBlue)
                            }
                            Button {
                                Haptics.impact(.light)
                                showSettings = true
                            } label: {
                                Image(systemName: "gearshape.fill")
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(.textTertiary)
                            }
                        }
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView()
                    .environmentObject(auth)
            }
            .sheet(isPresented: $showEdit) {
                EditProfileSheet(currentProfile: profile) { newName, newBio in
                    if let p = profile {
                        profile = Profile(
                            id: p.id,
                            username: p.username,
                            displayName: newName ?? p.displayName,
                            avatarURL: p.avatarURL,
                            bio: newBio ?? p.bio,
                            joinedAt: p.joinedAt,
                            topicsCreated: p.topicsCreated,
                            votesCast: p.votesCast,
                            reputation: p.reputation,
                            clout: p.clout,
                            role: p.role,
                            followersCount: p.followersCount,
                            followingCount: p.followingCount
                        )
                    }
                }
                .environmentObject(auth)
            }
            .task {
                await loadAll()
            }
        }
    }

    // MARK: - Sections

    private var heroSection: some View {
        VStack(spacing: Spacing.sm) {
            avatarView
                .shadow(color: Color.forBlue.opacity(0.35), radius: 24, x: 0, y: 10)

            VStack(spacing: 4) {
                Text(displayName)
                    .font(.lmTitle)
                    .foregroundStyle(.white)

                if !username.isEmpty {
                    Text("@\(username)")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }
            }

            if let bio = profile?.bio, !bio.isEmpty {
                Text(bio)
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
                    .padding(.horizontal, Spacing.xl)
            }

            // Role badge
            if let role = profile?.role, role != "person" {
                Text(roleLabel(role))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(roleColorFor(role))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(roleColorFor(role).opacity(0.12)))
                    .overlay(Capsule().stroke(roleColorFor(role).opacity(0.3), lineWidth: 1))
            }

            // Followers / Following
            HStack(spacing: Spacing.xl) {
                VStack(spacing: 2) {
                    Text("\(profile?.followersCount ?? 0)")
                        .font(.lmHeadline)
                        .foregroundStyle(.textPrimary)
                    Text("Followers")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }
                VStack(spacing: 2) {
                    Text("\(profile?.followingCount ?? 0)")
                        .font(.lmHeadline)
                        .foregroundStyle(.textPrimary)
                    Text("Following")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }
            }

            HStack(spacing: Spacing.sm) {
                if !joinYear.isEmpty {
                    Label(joinYear, systemImage: "calendar")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }
            }
        }
    }

    private func roleLabel(_ role: String) -> String {
        switch role {
        case "debator":       return "Debator"
        case "troll_catcher": return "Troll Catcher"
        case "elder":         return "Elder"
        default:              return "Citizen"
        }
    }

    private func roleColorFor(_ role: String) -> Color {
        switch role {
        case "debator":       return .forBlue
        case "troll_catcher": return .againstRed
        case "elder":         return .gold
        default:              return .textTertiary
        }
    }

    @ViewBuilder
    private var avatarView: some View {
        if let urlStr = profile?.avatarURL, let url = URL(string: urlStr) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let img):
                    img
                        .resizable()
                        .scaledToFill()
                        .frame(width: 96, height: 96)
                        .clipShape(Circle())
                        .overlay(Circle().stroke(Color.forBlue.opacity(0.4), lineWidth: 2))
                case .failure, .empty:
                    defaultAvatar
                @unknown default:
                    defaultAvatar
                }
            }
        } else {
            defaultAvatar
        }
    }

    private var defaultAvatar: some View {
        Circle()
            .fill(LinearGradient.forGradient)
            .frame(width: 96, height: 96)
            .overlay(
                Text(initial)
                    .font(.system(size: 40, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            )
    }

    private var initial: String {
        let name = profile?.displayName ?? profile?.username ?? auth.currentUsername ?? "?"
        return String(name.first ?? "?").uppercased()
    }

    private var statsGrid: some View {
        VStack(spacing: Spacing.xs) {
            HStack(spacing: Spacing.xs) {
                // Tappable clout card → CloutWalletView
                Button {
                    showWallet = true
                    Haptics.selection()
                } label: {
                    statCard("CLOUT", value: formatNum(profile?.clout ?? 0), color: .gold)
                        .overlay(alignment: .topTrailing) {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(.gold.opacity(0.5))
                                .padding(Spacing.xs)
                        }
                }
                .buttonStyle(.plain)
                .navigationDestination(isPresented: $showWallet) {
                    CloutWalletView()
                }

                statCard("VOTES", value: formatNum(profile?.votesCast ?? 0), color: .forBlue)
            }
            HStack(spacing: Spacing.xs) {
                statCard("TOPICS", value: formatNum(profile?.topicsCreated ?? 0), color: .purple)
                statCard("REPUTATION", value: formatNum(profile?.reputation ?? 0), color: .emerald)
            }
        }
    }

    private func statCard(_ title: String, value: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: 24, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
            Text(title)
                .font(.system(size: 10, weight: .heavy))
                .kerning(1.0)
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(color.opacity(0.25), lineWidth: 1)
                )
        )
    }

    private var voteDNASection: some View {
        VStack(spacing: Spacing.sm) {
            SectionHeader(title: "VOTE DNA")
            VStack(spacing: Spacing.xs) {
                ForEach(categoryStats, id: \.cat) { stat in
                    HStack(spacing: Spacing.xs) {
                        Text(stat.cat)
                            .font(.lmCaption)
                            .foregroundStyle(.textSecondary)
                            .frame(width: 90, alignment: .leading)
                            .lineLimit(1)
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(Color.surface300)
                                    .frame(height: 6)
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(catColor(stat.cat))
                                    .frame(width: geo.size.width * stat.fraction, height: 6)
                            }
                        }
                        .frame(height: 6)
                        Text("\(stat.count)")
                            .font(.lmMono)
                            .foregroundStyle(catColor(stat.cat))
                            .frame(width: 28, alignment: .trailing)
                    }
                }
            }
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }

    private var recentVotesSection: some View {
        VStack(spacing: Spacing.sm) {
            SectionHeader(title: "RECENT VOTES")
            VStack(spacing: 2) {
                ForEach(recentVotes.prefix(6)) { vote in
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: vote.side == "blue" ? "hand.thumbsup.fill" : "hand.thumbsdown.fill")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(vote.side == "blue" ? Color.forBlue : Color.againstRed)
                            .frame(width: 18)

                        Text(vote.topicStatement ?? "—")
                            .font(.lmCaption)
                            .foregroundStyle(.textSecondary)
                            .lineLimit(1)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        if let cat = vote.topicCategory {
                            Text(cat)
                                .font(.system(size: 9, weight: .semibold))
                                .kerning(0.5)
                                .foregroundStyle(catColor(cat))
                                .padding(.horizontal, 5)
                                .padding(.vertical, 2)
                                .background(
                                    Capsule()
                                        .fill(catColor(cat).opacity(0.12))
                                )
                        }
                    }
                    .padding(.vertical, 7)
                    .padding(.horizontal, Spacing.sm)
                    .background(Color.surface100)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                }
            }
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }

    private var authoredTopicsSection: some View {
        VStack(spacing: Spacing.sm) {
            SectionHeader(title: "PROPOSED TOPICS")
            VStack(spacing: 2) {
                ForEach(authoredTopics.prefix(5)) { topic in
                    HStack(spacing: Spacing.sm) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(topic.statement)
                                .font(.lmCaption)
                                .foregroundStyle(.white)
                                .lineLimit(2)
                            HStack(spacing: 4) {
                                if let cat = topic.category {
                                    Text(cat)
                                        .font(.system(size: 9, weight: .semibold))
                                        .foregroundStyle(catColor(cat))
                                }
                                Text("·")
                                    .foregroundStyle(.textTertiary)
                                Text("\(topic.totalVotes) votes")
                                    .font(.system(size: 9, weight: .medium))
                                    .foregroundStyle(.textTertiary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.textTertiary)
                    }
                    .padding(.vertical, Spacing.xs)
                    .padding(.horizontal, Spacing.sm)
                    .background(Color.surface100)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                    .contentShape(Rectangle())
                    .onTapGesture {
                        Haptics.impact(.light)
                        if let url = URL(string: "\(Config.webURL)/topic/\(topic.id)") {
                            UIApplication.shared.open(url)
                        }
                    }
                }
            }
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }

    private var actionsBlock: some View {
        VStack(spacing: Spacing.xs) {
            if let username = profile?.username ?? auth.currentUsername {
                Button {
                    Haptics.impact(.light)
                    let urlStr = "\(Config.webURL)/profile/\(username)"
                    if let url = URL(string: urlStr) {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    HStack {
                        Image(systemName: "safari")
                        Text("View Full Profile")
                            .font(.lmBodyBold)
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 13))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .padding(.horizontal, Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .fill(Color.surface200)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.md)
                                    .stroke(Color.forBlue.opacity(0.3), lineWidth: 1)
                            )
                    )
                    .foregroundStyle(.forBlue)
                }
            }

            Button(role: .destructive) {
                auth.signOut()
            } label: {
                HStack {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                    Text("Sign Out")
                        .font(.lmBodyBold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .fill(Color.surface200)
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md)
                                .stroke(Color.againstRed.opacity(0.4), lineWidth: 1)
                        )
                )
                .foregroundStyle(.againstRed)
            }
        }
    }

    private var loadingOverlay: some View {
        VStack(spacing: Spacing.md) {
            ProgressView()
                .tint(.forBlue)
                .scaleEffect(1.3)
            Text("Loading profile…")
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.surface0.opacity(0.7))
    }

    // MARK: - Data loading

    private func loadAll() async {
        guard let uid = auth.currentUserId else { return }
        isLoading = true
        async let p = SupabaseClient.shared.fetchProfile(id: uid)
        async let v = SupabaseClient.shared.fetchRecentVotesWithTopics(userId: uid, limit: 10)
        async let t = SupabaseClient.shared.fetchTopicsByAuthor(authorId: uid, limit: 8)
        profile = try? await p
        recentVotes = (try? await v) ?? []
        authoredTopics = (try? await t) ?? []
        isLoading = false
    }

    // MARK: - Helpers

    private func formatNum(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1_000 { return String(format: "%.1fk", Double(n) / 1_000) }
        return "\(n)"
    }
}

#Preview {
    ProfileView()
        .environmentObject(AuthService())
}
