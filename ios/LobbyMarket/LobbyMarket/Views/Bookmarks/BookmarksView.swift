//
//  BookmarksView.swift
//  LobbyMarket
//
//  Saved topics and arguments — the user's personal reading list.
//  Two tabs: Topics (bookmarked via topic_bookmarks) and Arguments (argument_bookmarks).
//

import SwiftUI

// MARK: - Main View

struct BookmarksView: View {
    @EnvironmentObject var auth: AuthService

    @State private var selectedTab: BookmarkTab = .topics
    @State private var topics: [BookmarkedTopicRow] = []
    @State private var arguments: [BookmarkedArgumentRow] = []
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var errorMessage: String?

    enum BookmarkTab: String, CaseIterable {
        case topics    = "Topics"
        case arguments = "Arguments"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                VStack(spacing: 0) {
                    // ── Header ──────────────────────────────────────────────
                    headerBar

                    // ── Tab Picker ──────────────────────────────────────────
                    tabPicker
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.sm)

                    Divider()
                        .background(Color.surface200)

                    // ── Content ─────────────────────────────────────────────
                    if isLoading && !hasLoaded {
                        loadingView
                    } else if let errorMessage {
                        errorView(errorMessage)
                    } else {
                        switch selectedTab {
                        case .topics:    topicsContent
                        case .arguments: argumentsContent
                        }
                    }
                }
            }
            .navigationBarHidden(true)
            .task { await loadIfNeeded() }
            .refreshable { await loadAll() }
        }
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Saved")
                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                Text("Your reading list")
                    .font(.lmCaption)
                    .foregroundStyle(.textSecondary)
            }
            Spacer()
            Button {
                Task { await loadAll() }
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.textSecondary)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.surface200))
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.top, Spacing.sm)
        .padding(.bottom, Spacing.xs)
    }

    // MARK: - Tab Picker

    private var tabPicker: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(BookmarkTab.allCases, id: \.self) { tab in
                let isActive = selectedTab == tab
                let count = tab == .topics ? topics.count : arguments.count
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) { selectedTab = tab }
                } label: {
                    HStack(spacing: 6) {
                        Text(tab.rawValue)
                            .font(.system(size: 13, weight: isActive ? .semibold : .regular))
                        if count > 0 {
                            Text("\(count)")
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .foregroundStyle(isActive ? .forBlue : .textSecondary)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(
                                    Capsule().fill(isActive ? Color.forBlueDark.opacity(0.3) : Color.surface200)
                                )
                        }
                    }
                    .foregroundStyle(isActive ? .white : .textSecondary)
                    .padding(.vertical, 8)
                    .padding(.horizontal, Spacing.sm)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(isActive ? Color.surface200 : Color.clear)
                    )
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }

    // MARK: - Topics Content

    private var topicsContent: some View {
        Group {
            if topics.isEmpty {
                emptyState(
                    icon: "bookmark",
                    title: "No saved topics",
                    subtitle: "Tap the bookmark icon on any topic card to save it here."
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: Spacing.sm) {
                        ForEach(topics) { row in
                            if let topic = row.topics {
                                BookmarkedTopicCard(
                                    row: row,
                                    topic: topic,
                                    onRemove: { await removeTopicBookmark(row.topicId) }
                                )
                            }
                        }
                    }
                    .padding(Spacing.md)
                }
            }
        }
    }

    // MARK: - Arguments Content

    private var argumentsContent: some View {
        Group {
            if arguments.isEmpty {
                emptyState(
                    icon: "text.bubble",
                    title: "No saved arguments",
                    subtitle: "Long-press any argument to save it to your reading list."
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: Spacing.sm) {
                        ForEach(arguments) { row in
                            if let arg = row.topic_arguments {
                                BookmarkedArgumentCard(
                                    row: row,
                                    argument: arg,
                                    onRemove: { await removeArgumentBookmark(row.argumentId) }
                                )
                            }
                        }
                    }
                    .padding(Spacing.md)
                }
            }
        }
    }

    // MARK: - Loading / Error / Empty

    private var loadingView: some View {
        VStack(spacing: Spacing.md) {
            ForEach(0..<4, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color.surface100)
                    .frame(height: 100)
                    .shimmer()
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36))
                .foregroundStyle(.againstRed)
            Text(message)
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .multilineTextAlignment(.center)
            Button("Try again") { Task { await loadAll() } }
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 20)
                .padding(.vertical, 10)
                .background(Capsule().fill(Color.forBlueDark))
                .buttonStyle(.plain)
        }
        .padding(Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(.textTertiary)
            Text(title)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(.textSecondary)
            Text(subtitle)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Data

    private func loadIfNeeded() async {
        guard !hasLoaded else { return }
        await loadAll()
    }

    private func loadAll() async {
        guard let userId = auth.currentUserId else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false; hasLoaded = true }

        async let topicRows = SupabaseClient.shared.fetchBookmarkedTopics(userId: userId)
        async let argRows   = SupabaseClient.shared.fetchBookmarkedArguments(userId: userId)

        do {
            topics    = try await topicRows
            arguments = try await argRows
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func removeTopicBookmark(_ topicId: String) async {
        guard let userId = auth.currentUserId else { return }
        withAnimation { topics.removeAll { $0.topicId == topicId } }
        try? await SupabaseClient.shared.toggleTopicBookmark(topicId: topicId, userId: userId, add: false)
    }

    private func removeArgumentBookmark(_ argumentId: String) async {
        guard let userId = auth.currentUserId else { return }
        withAnimation { arguments.removeAll { $0.argumentId == argumentId } }
        try? await SupabaseClient.shared.toggleArgumentBookmark(argumentId: argumentId, userId: userId, add: false)
    }
}

// MARK: - BookmarkedTopicCard

private struct BookmarkedTopicCard: View {
    let row: BookmarkedTopicRow
    let topic: BookmarkedTopicRow.EmbeddedTopic
    let onRemove: () async -> Void

    private var forPct: Double { topic.bluePct }
    private var againstPct: Double { 100 - topic.bluePct }

    var body: some View {
        NavigationLink(destination: TopicDetailByIdView(topicId: topic.id)) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                // Top row: category badge + status + unsave button
                HStack(spacing: Spacing.xs) {
                    if let cat = topic.category {
                        Text(cat.uppercased())
                            .font(.system(size: 10, weight: .heavy, design: .monospaced))
                            .foregroundStyle(.textTertiary)
                    }
                    Spacer()
                    StatusPill(status: topic.status)
                    Button {
                        Task { await onRemove() }
                    } label: {
                        Image(systemName: "bookmark.slash")
                            .font(.system(size: 14))
                            .foregroundStyle(.textTertiary)
                    }
                    .buttonStyle(.plain)
                }

                Text(topic.statement)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                // Vote bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.againstRedDark.opacity(0.5))
                            .frame(height: 4)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.forBlue)
                            .frame(width: geo.size.width * forPct / 100, height: 4)
                    }
                }
                .frame(height: 4)

                HStack {
                    Text(String(format: "%.0f%% FOR", forPct))
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.forBlue)
                    Spacer()
                    Text("\(compact(topic.totalVotes)) votes")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.textTertiary)
                    Spacer()
                    Text(String(format: "%.0f%% AGN", againstPct))
                        .font(.system(size: 11, weight: .semibold, design: .monospaced))
                        .foregroundStyle(.againstRed)
                }
            }
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: 14)
                    .fill(Color.surface100)
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .stroke(Color.surface200, lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - BookmarkedArgumentCard

private struct BookmarkedArgumentCard: View {
    let row: BookmarkedArgumentRow
    let argument: BookmarkedArgumentRow.EmbeddedArgument
    let onRemove: () async -> Void

    private var isFor: Bool { argument.side == "blue" }
    private var sideColor: Color { isFor ? .forBlue : .againstRed }
    private var sideLabel: String { isFor ? "FOR" : "AGAINST" }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Topic context
            if let t = argument.topics {
                NavigationLink(destination: TopicDetailView(topicId: argument.topicId)) {
                    HStack(spacing: Spacing.xs) {
                        if let cat = t.category {
                            Text(cat.uppercased())
                                .font(.system(size: 10, weight: .heavy, design: .monospaced))
                                .foregroundStyle(.textTertiary)
                        }
                        Text(t.statement)
                            .font(.system(size: 11))
                            .foregroundStyle(.textSecondary)
                            .lineLimit(1)
                        Spacer()
                        Button {
                            Task { await onRemove() }
                        } label: {
                            Image(systemName: "bookmark.slash")
                                .font(.system(size: 14))
                                .foregroundStyle(.textTertiary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .buttonStyle(.plain)

                Divider().background(Color.surface200)
            }

            // Side label
            HStack(spacing: Spacing.xs) {
                Capsule()
                    .fill(sideColor.opacity(0.2))
                    .overlay(Capsule().stroke(sideColor.opacity(0.5), lineWidth: 1))
                    .frame(width: 6, height: 6)
                Text(sideLabel)
                    .font(.system(size: 10, weight: .heavy, design: .monospaced))
                    .foregroundStyle(sideColor)
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 10))
                    Text(compact(argument.upvotes))
                        .font(.system(size: 11, design: .monospaced))
                }
                .foregroundStyle(.textTertiary)
            }

            // Argument content
            Text(argument.content)
                .font(.system(size: 14))
                .foregroundStyle(.textPrimary)
                .lineLimit(4)
                .multilineTextAlignment(.leading)
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(Color.surface100)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(sideColor.opacity(0.2), lineWidth: 1)
                )
        )
    }
}

// MARK: - StatusPill

private struct StatusPill: View {
    let status: String

    private var label: String {
        switch status {
        case "proposed": return "PROPOSED"
        case "active":   return "ACTIVE"
        case "voting":   return "VOTING"
        case "law":      return "LAW"
        case "failed":   return "FAILED"
        default:         return status.uppercased()
        }
    }

    private var color: Color {
        switch status {
        case "active":  return .forBlue
        case "voting":  return .purple
        case "law":     return .gold
        case "failed":  return .againstRed
        default:        return .init(white: 0.5)
        }
    }

    var body: some View {
        Text(label)
            .font(.system(size: 9, weight: .heavy, design: .monospaced))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(
                Capsule()
                    .fill(color.opacity(0.15))
                    .overlay(Capsule().stroke(color.opacity(0.4), lineWidth: 1))
            )
    }
}

// MARK: - Shimmer modifier (lightweight pulse for loading)

private struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    colors: [.clear, Color.white.opacity(0.06), .clear],
                    startPoint: .init(x: phase - 0.3, y: 0.5),
                    endPoint: .init(x: phase + 0.3, y: 0.5)
                )
            )
            .onAppear {
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                    phase = 1.4
                }
            }
    }
}

private extension View {
    func shimmer() -> some View { modifier(ShimmerModifier()) }
}

// MARK: - Helpers

private func compact(_ n: Int) -> String {
    switch n {
    case ..<1_000:  return "\(n)"
    case ..<10_000: return String(format: "%.1fk", Double(n) / 1_000)
    default:        return String(format: "%.0fk", Double(n) / 1_000)
    }
}

#Preview {
    BookmarksView()
        .environmentObject(AuthService())
}
