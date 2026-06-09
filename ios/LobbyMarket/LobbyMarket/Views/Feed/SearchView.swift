//
//  SearchView.swift
//  LobbyMarket
//
//  Global search across topics, laws, and citizens.
//

import SwiftUI

// MARK: - Search result models

struct SearchProfile: Identifiable, Hashable {
    let id: String
    let username: String
    let displayName: String?
    let clout: Int
    let votesCast: Int
}

// MARK: - Search scope

enum SearchScope: String, CaseIterable {
    case topics   = "Topics"
    case laws     = "Laws"
    case citizens = "Citizens"

    var icon: String {
        switch self {
        case .topics:   return "bubble.left.and.bubble.right.fill"
        case .laws:     return "books.vertical.fill"
        case .citizens: return "person.2.fill"
        }
    }
}

// MARK: - Main view

struct SearchView: View {
    @State private var query: String = ""
    @State private var scope: SearchScope = .topics
    @State private var topicResults: [Topic] = []
    @State private var lawResults: [Law] = []
    @State private var profileResults: [SearchProfile] = []
    @State private var isSearching: Bool = false
    @State private var hasSearched: Bool = false
    @State private var errorMessage: String?
    @State private var showTagBrowser: Bool = false

    @FocusState private var searchFocused: Bool

    private var hasResults: Bool {
        switch scope {
        case .topics:   return !topicResults.isEmpty
        case .laws:     return !lawResults.isEmpty
        case .citizens: return !profileResults.isEmpty
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Search bar
                    searchBar
                        .padding(.horizontal, Spacing.md)
                        .padding(.top, Spacing.sm)
                        .padding(.bottom, Spacing.xs)

                    // Scope picker
                    scopePicker
                        .padding(.horizontal, Spacing.md)
                        .padding(.bottom, Spacing.sm)

                    Divider()
                        .background(Color.white.opacity(0.07))

                    // Content
                    if isSearching {
                        loadingView
                    } else if let error = errorMessage {
                        errorView(error)
                    } else if query.count >= 2 && hasSearched && !hasResults {
                        emptyView
                    } else if !hasSearched {
                        promptView
                    } else {
                        resultsView
                    }
                }
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.large)
            .onAppear { searchFocused = true }
        }
    }

    // MARK: - Subviews

    private var searchBar: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(isSearching ? .forBlue : .textSecondary)
                .animation(.easeInOut(duration: 0.2), value: isSearching)

            TextField("Search the Lobby…", text: $query)
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .tint(.forBlue)
                .focused($searchFocused)
                .submitLabel(.search)
                .onSubmit { runSearch() }
                .onChange(of: query) { _, new in
                    if new.count >= 2 {
                        debounceSearch()
                    } else if new.isEmpty {
                        clearResults()
                    }
                }

            if !query.isEmpty {
                Button {
                    query = ""
                    clearResults()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.textTertiary)
                }
                .transition(.opacity)
            }
        }
        .padding(Spacing.sm)
        .background(RoundedRectangle(cornerRadius: Radii.md).fill(Color.surface200))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(searchFocused ? Color.forBlue.opacity(0.35) : Color.white.opacity(0.08), lineWidth: 1)
                .animation(.easeInOut(duration: 0.2), value: searchFocused)
        )
    }

    private var scopePicker: some View {
        HStack(spacing: Spacing.xs) {
            ForEach(SearchScope.allCases, id: \.self) { s in
                Button {
                    Haptics.selection()
                    withAnimation(.spring(duration: 0.25)) { scope = s }
                    if query.count >= 2 { runSearch() }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: s.icon)
                            .font(.system(size: 11, weight: .semibold))
                        Text(s.rawValue)
                            .font(.lmCaption)
                    }
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, 7)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.sm)
                            .fill(scope == s ? Color.forBlue.opacity(0.18) : Color.clear)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.sm)
                                    .stroke(scope == s ? Color.forBlue.opacity(0.45) : Color.white.opacity(0.06), lineWidth: 1)
                            )
                    )
                    .foregroundStyle(scope == s ? .forBlue : .textSecondary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var resultsView: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.sm) {
                switch scope {
                case .topics:
                    ForEach(topicResults) { topic in
                        NavigationLink(value: topic) {
                            TopicSearchRow(topic: topic)
                        }
                        .buttonStyle(.plain)
                    }
                case .laws:
                    ForEach(lawResults) { law in
                        NavigationLink(value: law) {
                            LawRow(law: law)
                        }
                        .buttonStyle(.plain)
                    }
                case .citizens:
                    ForEach(profileResults) { profile in
                        CitizenRow(profile: profile)
                    }
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm)
        }
        .navigationDestination(for: Topic.self) { topic in
            TopicDetailView(topic: topic)
        }
        .navigationDestination(for: Law.self) { law in
            LawDetailView(law: law, allLaws: lawResults)
        }
    }

    private var loadingView: some View {
        VStack(spacing: Spacing.sm) {
            Spacer()
            ProgressView()
                .progressViewStyle(.circular)
                .tint(.forBlue)
                .scaleEffect(1.2)
            Text("Searching the Lobby…")
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
            Spacer()
        }
    }

    private var promptView: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()
            Image(systemName: "text.magnifyingglass")
                .font(.system(size: 48, weight: .thin))
                .foregroundStyle(.textTertiary)
            VStack(spacing: Spacing.xs) {
                Text("Search the Lobby")
                    .font(.lmTitle)
                    .foregroundStyle(.textPrimary)
                Text("Find topics to vote on, laws the community has passed, and citizens making an impact.")
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.xl)
            }
            NavigationLink {
                TagBrowserView()
            } label: {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: "tag.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.forBlue)
                    Text("Browse by Tag")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.textTertiary)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.sm)
                .background(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .fill(Color.forBlue.opacity(0.12))
                        .overlay(RoundedRectangle(cornerRadius: Radii.md).stroke(Color.forBlue.opacity(0.3), lineWidth: 1))
                )
            }
            .buttonStyle(.plain)
            Spacer()
        }
    }

    private var emptyView: some View {
        VStack(spacing: Spacing.lg) {
            Spacer()
            Image(systemName: "magnifyingglass")
                .font(.system(size: 48, weight: .thin))
                .foregroundStyle(.textTertiary)
            VStack(spacing: Spacing.xs) {
                Text("No results for "\(query)"")
                    .font(.lmTitle)
                    .foregroundStyle(.textPrimary)
                Text("Try a different search term or switch to another category.")
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.xl)
            }
            Spacer()
        }
    }

    private func errorView(_ msg: String) -> some View {
        VStack(spacing: Spacing.sm) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40, weight: .thin))
                .foregroundStyle(.againstRed.opacity(0.7))
            Text(msg)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Spacing.xl)
            Spacer()
        }
    }

    // MARK: - Search logic

    private var searchTask: Task<Void, Never>?

    private func debounceSearch() {
        // Cancel any in-flight debounce
        Task {
            try? await Task.sleep(for: .milliseconds(350))
            await MainActor.run { runSearch() }
        }
    }

    private func runSearch() {
        guard query.count >= 2 else { return }
        isSearching = true
        errorMessage = nil
        Task {
            do {
                switch scope {
                case .topics:
                    let results = try await SupabaseClient.shared.searchTopics(query: query)
                    await MainActor.run {
                        topicResults = results
                        isSearching = false
                        hasSearched = true
                    }
                case .laws:
                    let results = try await SupabaseClient.shared.fetchLaws(search: query)
                    await MainActor.run {
                        lawResults = results
                        isSearching = false
                        hasSearched = true
                    }
                case .citizens:
                    let results = try await SupabaseClient.shared.searchProfiles(query: query)
                    await MainActor.run {
                        profileResults = results
                        isSearching = false
                        hasSearched = true
                    }
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Search failed. Check your connection."
                    isSearching = false
                    hasSearched = true
                }
            }
        }
    }

    private func clearResults() {
        topicResults = []
        lawResults = []
        profileResults = []
        hasSearched = false
        errorMessage = nil
    }
}

// MARK: - Topic search row

private struct TopicSearchRow: View {
    let topic: Topic

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack(alignment: .top) {
                Text(topic.statement)
                    .font(.lmBodyBold)
                    .foregroundStyle(.white)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)
                Spacer(minLength: Spacing.xs)
                Image(systemName: "chevron.right")
                    .font(.caption2)
                    .foregroundStyle(.textTertiary)
            }

            HStack(spacing: Spacing.xs) {
                if let category = topic.category {
                    Text(category.uppercased())
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(.textTertiary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Color.surface300))
                }
                Spacer()
                // Vote bar mini
                VoteBarMini(pct: topic.bluePercentage)
                    .frame(width: 60)
                Text("\(compact(topic.totalVotes))")
                    .font(.lmMono)
                    .foregroundStyle(.textTertiary)
            }
        }
        .lmCard()
    }

    private func compact(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1_000     { return String(format: "%.1fK", Double(n) / 1_000) }
        return "\(n)"
    }
}

// MARK: - Vote bar mini (compact version for search results)

private struct VoteBarMini: View {
    let pct: Double

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.againstRed.opacity(0.25))
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.forBlue.opacity(0.8))
                    .frame(width: geo.size.width * CGFloat(pct / 100))
            }
        }
        .frame(height: 5)
    }
}

// MARK: - Citizen row

private struct CitizenRow: View {
    let profile: SearchProfile

    var body: some View {
        HStack(spacing: Spacing.sm) {
            // Avatar placeholder
            ZStack {
                Circle()
                    .fill(LinearGradient.forGradient)
                    .frame(width: 44, height: 44)
                Text(String((profile.displayName ?? profile.username).prefix(1)).uppercased())
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(.white)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(profile.displayName ?? profile.username)
                    .font(.lmBodyBold)
                    .foregroundStyle(.white)
                Text("@\(profile.username)")
                    .font(.lmCaption)
                    .foregroundStyle(.textSecondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                HStack(spacing: 4) {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(.gold)
                    Text("\(profile.clout)")
                        .font(.lmMono)
                        .foregroundStyle(.gold)
                }
                Text("\(profile.votesCast) votes")
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
            }
        }
        .lmCard()
    }
}

// MARK: - Preview

#Preview {
    SearchView()
}
