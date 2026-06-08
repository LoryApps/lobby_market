//
//  MessagesView.swift
//  LobbyMarket
//
//  Inbox: list of direct-message conversations sorted by most recent.
//  Tapping a row opens ConversationView. The compose button (pencil) opens
//  a search sheet to start a new conversation.
//

import SwiftUI

struct MessagesView: View {
    @EnvironmentObject var auth: AuthService

    @State private var conversations: [DmConversation] = []
    @State private var loading = true
    @State private var error: String?
    @State private var showCompose = false
    @State private var composeUsername = ""
    @State private var searchResults: [DmProfile] = []
    @State private var searching = false
    @State private var openConversation: DmConversation?

    private var totalUnread: Int { conversations.reduce(0) { $0 + $1.unreadCount } }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                if loading {
                    skeletonList
                } else if let err = error {
                    errorState(err)
                } else if conversations.isEmpty {
                    emptyState
                } else {
                    conversationList
                }
            }
            .navigationTitle("Messages")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showCompose = true
                    } label: {
                        Image(systemName: "square.and.pencil")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(.forBlue)
                    }
                }
            }
            .sheet(isPresented: $showCompose) {
                ComposeView(onSelect: { profile in
                    showCompose = false
                    let conv = DmConversation(
                        partner: profile,
                        lastMessage: "",
                        lastMessageAt: Date(),
                        unreadCount: 0,
                        lastSenderId: auth.currentUserId ?? ""
                    )
                    openConversation = conv
                })
                .environmentObject(auth)
            }
            .navigationDestination(item: $openConversation) { conv in
                ConversationView(partner: conv.partner)
                    .environmentObject(auth)
            }
            .task { await loadConversations() }
            .refreshable { await loadConversations() }
        }
    }

    // MARK: - Conversation list

    private var conversationList: some View {
        List {
            ForEach(conversations) { conv in
                Button {
                    openConversation = conv
                } label: {
                    ConversationRow(
                        conversation: conv,
                        currentUserId: auth.currentUserId ?? ""
                    )
                }
                .listRowBackground(Color.surface100)
                .listRowInsets(EdgeInsets(top: 0, leading: 0, bottom: 0, trailing: 0))
                .listRowSeparatorTint(Color.surface200)
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(Color.surface0)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: Spacing.md) {
            ZStack {
                Circle()
                    .fill(Color.forBlue.opacity(0.12))
                    .frame(width: 72, height: 72)
                Image(systemName: "bubble.left.and.bubble.right.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(.forBlue)
            }
            VStack(spacing: 6) {
                Text("No messages yet")
                    .font(.lmTitle)
                    .foregroundStyle(.textPrimary)
                Text("Send a direct message to a\nfellow citizen to start a conversation.")
                    .font(.lmBody)
                    .foregroundStyle(.textTertiary)
                    .multilineTextAlignment(.center)
            }
            Button {
                showCompose = true
            } label: {
                Label("Start a conversation", systemImage: "square.and.pencil")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, 10)
                    .background(Color.forBlue)
                    .clipShape(Capsule())
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Spacing.xl)
    }

    // MARK: - Error state

    private func errorState(_ msg: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 32))
                .foregroundStyle(.againstRed)
            Text(msg)
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .multilineTextAlignment(.center)
            Button("Retry") { Task { await loadConversations() } }
                .font(.lmBody)
                .foregroundStyle(.forBlue)
        }
        .padding(Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Skeleton

    private var skeletonList: some View {
        VStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { _ in
                ConversationSkeletonRow()
                Divider()
                    .background(Color.surface200)
                    .padding(.leading, 68)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    // MARK: - Load

    private func loadConversations() async {
        guard let uid = auth.currentUserId else { loading = false; return }
        loading = true
        error = nil
        do {
            conversations = try await SupabaseClient.shared.fetchConversations(userId: uid)
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }
}

// MARK: - Conversation row

private struct ConversationRow: View {
    let conversation: DmConversation
    let currentUserId: String

    private var isMine: Bool { conversation.lastSenderId == currentUserId }

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            // Avatar
            AvatarCircle(
                username: conversation.partner.username,
                avatarURL: conversation.partner.avatarURL,
                size: 48
            )

            // Text stack
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(conversation.partner.displayLabel)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.textPrimary)
                        .lineLimit(1)
                    Spacer()
                    Text(relativeTime(conversation.lastMessageAt))
                        .font(.lmMono)
                        .foregroundStyle(.textTertiary)
                }

                HStack(spacing: 4) {
                    if isMine {
                        Text("You:")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.textTertiary)
                    }
                    Text(conversation.lastMessage)
                        .font(.lmBody)
                        .foregroundStyle(conversation.unreadCount > 0 ? .textPrimary : .textSecondary)
                        .fontWeight(conversation.unreadCount > 0 ? .medium : .regular)
                        .lineLimit(1)
                }
            }

            // Unread badge
            if conversation.unreadCount > 0 {
                Text("\(conversation.unreadCount)")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(Color.forBlue)
                    .clipShape(Capsule())
                    .padding(.top, 2)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 12)
        .background(conversation.unreadCount > 0 ? Color.forBlue.opacity(0.04) : Color.clear)
        .contentShape(Rectangle())
    }

    private func relativeTime(_ date: Date) -> String {
        let diff = Date().timeIntervalSince(date)
        if diff < 60        { return "now" }
        if diff < 3_600     { return "\(Int(diff / 60))m" }
        if diff < 86_400    { return "\(Int(diff / 3_600))h" }
        if diff < 604_800   { return "\(Int(diff / 86_400))d" }
        let f = DateFormatter(); f.dateFormat = "MMM d"; return f.string(from: date)
    }
}

// MARK: - Skeleton row

private struct ConversationSkeletonRow: View {
    @State private var animate = false

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            Circle()
                .fill(Color.surface200)
                .frame(width: 48, height: 48)

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.surface300)
                        .frame(width: 110, height: 13)
                    Spacer()
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.surface300)
                        .frame(width: 24, height: 11)
                }
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.surface200)
                    .frame(height: 11)
                    .padding(.trailing, 40)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, 12)
        .opacity(animate ? 0.45 : 1.0)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                animate = true
            }
        }
    }
}

// MARK: - Compose (user search) sheet

struct ComposeView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    let onSelect: (DmProfile) -> Void

    @State private var query = ""
    @State private var results: [DmProfile] = []
    @State private var loading = false
    @FocusState private var focused: Bool

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Search bar
                    HStack(spacing: Spacing.sm) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 15))
                            .foregroundStyle(.textTertiary)
                        TextField("Search by username", text: $query)
                            .font(.lmBody)
                            .foregroundStyle(.textPrimary)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .focused($focused)
                        if !query.isEmpty {
                            Button { query = "" } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.textTertiary)
                            }
                        }
                    }
                    .padding(Spacing.sm)
                    .background(Color.surface200)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .padding(.horizontal, Spacing.md)
                    .padding(.top, Spacing.sm)

                    Divider()
                        .background(Color.surface200)
                        .padding(.top, Spacing.sm)

                    if loading {
                        ProgressView()
                            .tint(.forBlue)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else if results.isEmpty && !query.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "person.slash.fill")
                                .font(.system(size: 28))
                                .foregroundStyle(.textTertiary)
                            Text("No citizens found")
                                .font(.lmBody)
                                .foregroundStyle(.textTertiary)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        List(results) { profile in
                            Button {
                                onSelect(profile)
                            } label: {
                                HStack(spacing: Spacing.sm) {
                                    AvatarCircle(
                                        username: profile.username,
                                        avatarURL: profile.avatarURL,
                                        size: 38
                                    )
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(profile.displayLabel)
                                            .font(.system(size: 14, weight: .semibold))
                                            .foregroundStyle(.textPrimary)
                                        Text("@\(profile.username)")
                                            .font(.lmMono)
                                            .foregroundStyle(.textTertiary)
                                    }
                                    Spacer()
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 13))
                                        .foregroundStyle(.textTertiary)
                                }
                                .padding(.vertical, 4)
                            }
                            .listRowBackground(Color.surface100)
                            .listRowSeparatorTint(Color.surface200)
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                        .background(Color.surface0)
                    }
                }
            }
            .navigationTitle("New Message")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(.forBlue)
                }
            }
            .onAppear { focused = true }
            .onChange(of: query) { _, newVal in
                Task { await search(newVal) }
            }
        }
    }

    private func search(_ q: String) async {
        let trimmed = q.trimmingCharacters(in: .whitespaces)
        guard trimmed.count >= 2 else {
            results = []
            return
        }
        loading = true
        do {
            var params = QueryParams()
            params.select("id,username,display_name,avatar_url,role")
            params.ilike("username", "*\(trimmed)*")
            params.order("reputation_score", ascending: false)
            params.limit(20)
            let fetched: [DmProfile] = try await SupabaseClient.shared.get(table: "profiles", params: params)
            let myId = auth.currentUserId ?? ""
            results = fetched.filter { $0.id != myId }
        } catch {
            results = []
        }
        loading = false
    }
}

// MARK: - Reusable avatar circle (initials fallback)

struct AvatarCircle: View {
    let username: String
    let avatarURL: String?
    let size: CGFloat

    private var initial: String {
        String(username.prefix(1)).uppercased()
    }

    var body: some View {
        if let url = avatarURL, let parsed = URL(string: url) {
            AsyncImage(url: parsed) { phase in
                switch phase {
                case .success(let img):
                    img.resizable()
                        .scaledToFill()
                        .frame(width: size, height: size)
                        .clipShape(Circle())
                default:
                    initialsCircle
                }
            }
        } else {
            initialsCircle
        }
    }

    private var initialsCircle: some View {
        ZStack {
            Circle()
                .fill(Color.forBlue.opacity(0.2))
                .frame(width: size, height: size)
            Text(initial)
                .font(.system(size: size * 0.4, weight: .bold))
                .foregroundStyle(.forBlue)
        }
    }
}

// MARK: - Preview

#Preview {
    MessagesView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
