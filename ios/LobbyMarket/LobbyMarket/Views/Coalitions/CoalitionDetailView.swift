//
//  CoalitionDetailView.swift
//  LobbyMarket
//
//  Full detail sheet for a coalition — Overview, Posts (bulletin board),
//  and Members. Leaders and officers can post; anyone can read.
//

import SwiftUI

// MARK: - Tab enum

private enum DetailTab: String, CaseIterable {
    case overview = "Overview"
    case posts    = "Posts"
    case members  = "Members"

    var icon: String {
        switch self {
        case .overview: return "chart.bar.fill"
        case .posts:    return "megaphone.fill"
        case .members:  return "person.2.fill"
        }
    }
}

// MARK: - Relative time helper

private func relativeTime(_ date: Date) -> String {
    let diff = Date().timeIntervalSince(date)
    let m = Int(diff / 60)
    let h = Int(diff / 3600)
    let d = Int(diff / 86400)
    if diff < 60   { return "just now" }
    if m  < 60     { return "\(m)m ago" }
    if h  < 24     { return "\(h)h ago" }
    if d  < 7      { return "\(d)d ago" }
    let fmt = DateFormatter(); fmt.dateStyle = .medium; fmt.timeStyle = .none
    return fmt.string(from: date)
}

// MARK: - Main View

struct CoalitionDetailView: View {
    let coalition: Coalition
    let isMember: Bool
    let onJoin: () async -> Void
    let onLeave: () async -> Void

    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    @State private var selectedTab: DetailTab = .overview
    @State private var isActing = false

    // Posts tab state
    @State private var posts: [CoalitionPost] = []
    @State private var postsLoaded = false
    @State private var postsLoading = false
    @State private var postsError: String?
    @State private var showNewPostSheet = false
    @State private var myRole: String?

    // Members tab state
    @State private var members: [CoalitionMemberRow] = []
    @State private var membersLoaded = false
    @State private var membersLoading = false

    var canPost: Bool {
        isMember && (myRole == "leader" || myRole == "officer")
    }

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            VStack(spacing: 0) {
                // ── Header ────────────────────────────────────────────────
                headerSection
                    .padding(Spacing.md)

                Divider().background(Color.white.opacity(0.08))

                // ── Tab bar ───────────────────────────────────────────────
                tabBar
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)

                Divider().background(Color.white.opacity(0.08))

                // ── Tab content ───────────────────────────────────────────
                ScrollView {
                    switch selectedTab {
                    case .overview: overviewContent
                    case .posts:    postsContent
                    case .members:  membersContent
                    }
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .overlay(alignment: .topTrailing) {
            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(Color.surface400)
                    .padding(Spacing.md)
            }
        }
        .sheet(isPresented: $showNewPostSheet) {
            NewPostSheet(coalitionId: coalition.id) { newPost in
                posts.insert(newPost, at: 0)
            }
        }
        .task(id: selectedTab) {
            switch selectedTab {
            case .overview:
                if isMember, myRole == nil, let uid = auth.currentUserId {
                    myRole = try? await SupabaseClient.shared.fetchMyCoalitionRole(
                        coalitionId: coalition.id, userId: uid
                    )
                }
            case .posts:
                if isMember, myRole == nil, let uid = auth.currentUserId {
                    myRole = try? await SupabaseClient.shared.fetchMyCoalitionRole(
                        coalitionId: coalition.id, userId: uid
                    )
                }
                if !postsLoaded { await loadPosts() }
            case .members:
                if !membersLoaded { await loadMembers() }
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(Color.purple.opacity(0.15))
                    .frame(width: 52, height: 52)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .stroke(Color.purple.opacity(0.35), lineWidth: 1)
                    )
                Text(String(coalition.name.prefix(2)).uppercased())
                    .font(.lmTitle)
                    .foregroundStyle(.purple)
            }

            VStack(alignment: .leading, spacing: Spacing.xxs) {
                Text(coalition.name)
                    .font(.lmTitle)
                    .foregroundStyle(.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: Spacing.xs) {
                    if isMember {
                        Label("Member", systemImage: "checkmark.circle.fill")
                            .font(.lmCaption)
                            .foregroundStyle(.emerald)
                    }
                    Text("·")
                        .foregroundStyle(.textTertiary)
                        .font(.lmCaption)
                    Text("\(coalition.memberCount) members")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }
            }
            Spacer()
        }
    }

    // MARK: - Tab bar

    private var tabBar: some View {
        HStack(spacing: Spacing.xs) {
            ForEach(DetailTab.allCases, id: \.self) { tab in
                Button {
                    Haptics.selection()
                    selectedTab = tab
                } label: {
                    HStack(spacing: Spacing.xxs) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 11, weight: .semibold))
                        Text(tab.rawValue)
                            .font(.lmCaption)
                    }
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xs)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.sm)
                            .fill(selectedTab == tab ? Color.purple.opacity(0.18) : Color.clear)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.sm)
                                    .stroke(selectedTab == tab ? Color.purple.opacity(0.45) : Color.clear,
                                            lineWidth: 1)
                            )
                    )
                    .foregroundStyle(selectedTab == tab ? Color.purple : Color.textTertiary)
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }

    // MARK: - Overview tab

    private var overviewContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Description
            if let desc = coalition.description {
                Text(desc)
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(Spacing.md)

                Divider().background(Color.white.opacity(0.08))
            }

            // Stats
            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible())],
                spacing: Spacing.sm
            ) {
                StatCell(icon: "bolt.fill",            value: coalition.influenceLabel, label: "Influence",  color: .gold)
                StatCell(icon: "person.2.fill",        value: "\(coalition.memberCount)", label: "Members", color: .forBlue)
                StatCell(icon: "checkmark.seal.fill",  value: "\(coalition.wins)",      label: "Wins",      color: .emerald)
                StatCell(icon: "xmark.seal.fill",      value: "\(coalition.losses)",    label: "Losses",    color: .againstRed)
            }
            .padding(Spacing.md)

            // Win rate
            if coalition.totalMatches > 0 {
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    HStack {
                        Text("Win Rate")
                            .font(.lmCaption).foregroundStyle(.textTertiary)
                        Spacer()
                        Text("\(Int(coalition.winRate * 100))%")
                            .font(.lmMono)
                            .foregroundStyle(coalition.winRate >= 0.5 ? .emerald : .againstRed)
                    }
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4).fill(Color.surface300).frame(height: 6)
                            RoundedRectangle(cornerRadius: 4)
                                .fill(coalition.winRate >= 0.5 ? Color.emerald : Color.againstRed)
                                .frame(width: geo.size.width * coalition.winRate, height: 6)
                        }
                    }
                    .frame(height: 6)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.bottom, Spacing.sm)
            }

            // Capacity
            VStack(alignment: .leading, spacing: Spacing.xs) {
                HStack {
                    Text("Capacity")
                        .font(.lmCaption).foregroundStyle(.textTertiary)
                    Spacer()
                    Text(coalition.memberSlotLabel)
                        .font(.lmMono).foregroundStyle(.textSecondary)
                }
                GeometryReader { geo in
                    let fill = min(CGFloat(coalition.memberCount) / CGFloat(max(coalition.maxMembers, 1)), 1.0)
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4).fill(Color.surface300).frame(height: 6)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(coalition.isFull ? Color.againstRed : Color.purple)
                            .frame(width: geo.size.width * fill, height: 6)
                    }
                }
                .frame(height: 6)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.lg)

            Divider().background(Color.white.opacity(0.08))

            // Actions
            VStack(spacing: Spacing.sm) {
                if isMember {
                    Button {
                        Task { isActing = true; await onLeave(); isActing = false }
                    } label: {
                        actionLabel(text: isActing ? "Leaving…" : "Leave Coalition",
                                    isLoading: isActing,
                                    bg: Color.againstRed.opacity(0.12),
                                    fg: .againstRed,
                                    border: Color.againstRed.opacity(0.3))
                    }
                    .disabled(isActing)
                } else {
                    Button {
                        Task { isActing = true; await onJoin(); isActing = false }
                    } label: {
                        actionLabel(text: isActing ? "Joining…" : "Join Coalition",
                                    isLoading: isActing,
                                    bg: coalition.isFull ? Color.surface300 : Color.purple,
                                    fg: .white,
                                    border: Color.clear)
                    }
                    .disabled(coalition.isFull || isActing)

                    if coalition.isFull {
                        Text("This coalition is at full capacity.")
                            .font(.lmCaption).foregroundStyle(.textTertiary)
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }

                Link(destination: URL(string: "\(Config.webURL)/lobby")!) {
                    HStack {
                        Image(systemName: "safari")
                        Text("View on Lobby Market").font(.lmCaption)
                    }
                    .foregroundStyle(.textTertiary)
                }
                .padding(.top, Spacing.xxs)
            }
            .padding(Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
    }

    private func actionLabel(text: String, isLoading: Bool, bg: Color, fg: Color, border: Color) -> some View {
        HStack {
            if isLoading { ProgressView().progressViewStyle(.circular).tint(fg) }
            Text(text).font(.lmBodyBold)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.sm)
        .background(bg)
        .foregroundStyle(fg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .overlay(RoundedRectangle(cornerRadius: Radii.md).stroke(border, lineWidth: 1))
    }

    // MARK: - Posts tab

    private var postsContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Post button for leaders/officers
            if canPost {
                Button { showNewPostSheet = true } label: {
                    HStack {
                        Image(systemName: "square.and.pencil")
                        Text("New Post")
                            .font(.lmBodyBold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.sm)
                    .background(Color.purple.opacity(0.15))
                    .foregroundStyle(.purple)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                    .overlay(RoundedRectangle(cornerRadius: Radii.md).stroke(Color.purple.opacity(0.35), lineWidth: 1))
                }
                .padding(Spacing.md)
            }

            if postsLoading && posts.isEmpty {
                VStack(spacing: Spacing.sm) {
                    ForEach(0..<4, id: \.self) { _ in PostSkeleton() }
                }
                .padding(Spacing.md)
            } else if let err = postsError {
                errorPlaceholder(message: err, action: { await loadPosts() })
            } else if posts.isEmpty {
                emptyPlaceholder(
                    icon: "megaphone",
                    title: "No posts yet",
                    subtitle: isMember && canPost
                        ? "Post an update for your coalition members."
                        : "Coalition leaders haven't posted any updates yet."
                )
            } else {
                LazyVStack(spacing: Spacing.xs) {
                    ForEach(posts) { post in
                        PostRow(post: post)
                    }
                }
                .padding(.horizontal, Spacing.md)
                .padding(.bottom, Spacing.xl)
            }
        }
    }

    private func loadPosts() async {
        postsLoading = true
        postsError = nil
        do {
            posts = try await SupabaseClient.shared.fetchCoalitionPosts(coalitionId: coalition.id)
            postsLoaded = true
        } catch {
            postsError = "Couldn't load posts."
        }
        postsLoading = false
    }

    // MARK: - Members tab

    private var membersContent: some View {
        VStack(alignment: .leading, spacing: 0) {
            if membersLoading && members.isEmpty {
                VStack(spacing: Spacing.sm) {
                    ForEach(0..<6, id: \.self) { _ in MemberSkeleton() }
                }
                .padding(Spacing.md)
            } else if members.isEmpty {
                emptyPlaceholder(icon: "person.2", title: "No members found", subtitle: nil)
            } else {
                LazyVStack(spacing: Spacing.xs) {
                    ForEach(members) { member in
                        MemberRow(member: member)
                    }
                }
                .padding(.horizontal, Spacing.md)
                .padding(.bottom, Spacing.xl)
            }
        }
    }

    private func loadMembers() async {
        membersLoading = true
        do {
            members = try await SupabaseClient.shared.fetchCoalitionMembers(coalitionId: coalition.id)
            membersLoaded = true
        } catch {
            members = []
        }
        membersLoading = false
    }

    // MARK: - Shared placeholder helpers

    private func emptyPlaceholder(icon: String, title: String, subtitle: String?) -> some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundStyle(Color.surface400)
            Text(title)
                .font(.lmTitle)
                .foregroundStyle(.textSecondary)
            if let sub = subtitle {
                Text(sub)
                    .font(.lmBody)
                    .foregroundStyle(.textTertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xxl)
        .padding(.horizontal, Spacing.md)
    }

    private func errorPlaceholder(message: String, action: @escaping () async -> Void) -> some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36))
                .foregroundStyle(Color.againstRed)
            Text(message).font(.lmBody).foregroundStyle(.textSecondary)
            Button("Try again") { Task { await action() } }
                .font(.lmCaption)
                .foregroundStyle(.purple)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xxl)
    }
}

// MARK: - Post Row

private struct PostRow: View {
    let post: CoalitionPost

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack(spacing: Spacing.xs) {
                // Avatar circle
                ZStack {
                    Circle()
                        .fill(Color.purple.opacity(0.18))
                        .frame(width: 34, height: 34)
                    Text(post.authorInitials)
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundStyle(.purple)
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text(post.authorName)
                        .font(.lmHeadline)
                        .foregroundStyle(.textPrimary)
                    Text(relativeTime(post.createdAt))
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }

                Spacer()

                if post.isPinned {
                    Label("Pinned", systemImage: "pin.fill")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(.gold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Color.gold.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
            }

            Text(post.content)
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.sm)
        .background(Color.surface200)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(post.isPinned ? Color.gold.opacity(0.2) : Color.white.opacity(0.06), lineWidth: 1)
        )
    }
}

// MARK: - Member Row

private struct MemberRow: View {
    let member: CoalitionMemberRow

    private var roleColor: Color {
        switch member.role {
        case "leader":  return .gold
        case "officer": return .purple
        default:        return .surface400
        }
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ZStack {
                Circle()
                    .fill(roleColor.opacity(0.18))
                    .frame(width: 40, height: 40)
                Text(member.memberInitials)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(roleColor)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Spacing.xs) {
                    Text(member.memberName)
                        .font(.lmHeadline)
                        .foregroundStyle(.textPrimary)
                    Text(member.roleLabel)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(roleColor)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(roleColor.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
                if let username = member.username {
                    Text("@\(username)")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }
            }

            Spacer()

            if let clout = member.clout {
                VStack(alignment: .trailing, spacing: 1) {
                    Text("\(clout)")
                        .font(.lmMono)
                        .foregroundStyle(.gold)
                    Text("clout")
                        .font(.system(size: 9))
                        .foregroundStyle(.textTertiary)
                }
            }
        }
        .padding(Spacing.sm)
        .background(Color.surface200)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(Color.white.opacity(0.06), lineWidth: 1)
        )
    }
}

// MARK: - Skeletons

private struct PostSkeleton: View {
    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            Circle().fill(Color.surface300).frame(width: 34, height: 34)
            VStack(alignment: .leading, spacing: Spacing.xs) {
                RoundedRectangle(cornerRadius: 4).fill(Color.surface300).frame(width: 100, height: 12)
                RoundedRectangle(cornerRadius: 4).fill(Color.surface300).frame(maxWidth: .infinity).frame(height: 12)
                RoundedRectangle(cornerRadius: 4).fill(Color.surface300).frame(width: 200, height: 12)
            }
        }
        .padding(Spacing.sm)
        .background(Color.surface200)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .redacted(reason: .placeholder)
    }
}

private struct MemberSkeleton: View {
    var body: some View {
        HStack(spacing: Spacing.sm) {
            Circle().fill(Color.surface300).frame(width: 40, height: 40)
            VStack(alignment: .leading, spacing: Spacing.xs) {
                RoundedRectangle(cornerRadius: 4).fill(Color.surface300).frame(width: 120, height: 12)
                RoundedRectangle(cornerRadius: 4).fill(Color.surface300).frame(width: 80, height: 10)
            }
            Spacer()
        }
        .padding(Spacing.sm)
        .background(Color.surface200)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .redacted(reason: .placeholder)
    }
}

// MARK: - StatCell (private to this file)

private struct StatCell: View {
    let icon: String
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: Spacing.xs) {
            Image(systemName: icon).font(.system(size: 20)).foregroundStyle(color)
            Text(value).font(.lmTitle).foregroundStyle(.textPrimary)
            Text(label).font(.lmCaption).foregroundStyle(.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.sm)
        .background(Color.surface200)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .overlay(RoundedRectangle(cornerRadius: Radii.md).stroke(color.opacity(0.15), lineWidth: 1))
    }
}

// MARK: - New Post Sheet

private struct NewPostSheet: View {
    let coalitionId: String
    let onCreated: (CoalitionPost) -> Void

    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    @State private var content = ""
    @State private var isSubmitting = false
    @State private var errorMsg: String?

    private let maxChars = 1000

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.md) {
                        Text("Write a post for your coalition. Members will see it in the bulletin board.")
                            .font(.lmBody)
                            .foregroundStyle(.textSecondary)

                        ZStack(alignment: .topLeading) {
                            if content.isEmpty {
                                Text("Share an update, strategy, or announcement…")
                                    .font(.lmBody)
                                    .foregroundStyle(.textTertiary)
                                    .padding(.horizontal, Spacing.xs)
                                    .padding(.vertical, Spacing.xs + 2)
                                    .allowsHitTesting(false)
                            }
                            TextEditor(text: $content)
                                .font(.lmBody)
                                .foregroundStyle(.white)
                                .scrollContentBackground(.hidden)
                                .background(Color.clear)
                                .frame(minHeight: 160)
                        }
                        .padding(Spacing.xs)
                        .background(Color.surface200)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.md)
                                .stroke(Color.white.opacity(0.08), lineWidth: 1)
                        )

                        HStack {
                            Spacer()
                            Text("\(content.count)/\(maxChars)")
                                .font(.lmMono)
                                .foregroundStyle(content.count > maxChars ? Color.againstRed : Color.textTertiary)
                        }

                        if let err = errorMsg {
                            Text(err)
                                .font(.lmCaption)
                                .foregroundStyle(.againstRed)
                        }

                        Button {
                            Task { await submit() }
                        } label: {
                            HStack {
                                if isSubmitting { ProgressView().progressViewStyle(.circular).tint(.white) }
                                Text(isSubmitting ? "Posting…" : "Post Update")
                                    .font(.lmBodyBold)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Spacing.sm)
                            .background(canSubmit ? Color.purple : Color.surface300)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                        }
                        .disabled(!canSubmit || isSubmitting)
                    }
                    .padding(Spacing.md)
                }
            }
            .navigationTitle("New Post")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.surface0, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(.textSecondary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var canSubmit: Bool {
        !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && content.count <= maxChars
    }

    private func submit() async {
        guard let uid = auth.currentUserId else { return }
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed.count <= maxChars else { return }

        isSubmitting = true
        errorMsg = nil
        do {
            let post = try await SupabaseClient.shared.createCoalitionPost(
                coalitionId: coalitionId, authorId: uid, content: trimmed
            )
            Haptics.notify(.success)
            onCreated(post)
            dismiss()
        } catch {
            errorMsg = "Failed to post. Please try again."
            Haptics.notify(.error)
        }
        isSubmitting = false
    }
}

// MARK: - Preview

#Preview {
    CoalitionDetailView(
        coalition: Coalition.sampleData[0],
        isMember: true,
        onJoin: {},
        onLeave: {}
    )
    .environmentObject(AuthService())
}
