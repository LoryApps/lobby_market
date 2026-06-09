//
//  TagBrowserView.swift
//  LobbyMarket
//
//  Browse topics by keyword tag. Shown as a sheet from the Search tab or
//  via deep-link navigation.
//

import SwiftUI

// MARK: - Tag detail view

struct TagDetailView: View {
    let tag: TrendingTag
    @State private var topics: [Topic] = []
    @State private var loading = true
    @State private var error: String?

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            if loading {
                VStack(spacing: Spacing.md) {
                    ForEach(0..<5, id: \.self) { _ in
                        tagTopicSkeleton
                    }
                }
                .padding(Spacing.md)
            } else if topics.isEmpty {
                VStack(spacing: Spacing.md) {
                    Image(systemName: "tag.slash")
                        .font(.system(size: 40))
                        .foregroundStyle(.textTertiary)
                    Text("No topics tagged #\(tag.name)")
                        .font(.lmBody)
                        .foregroundStyle(.textSecondary)
                }
            } else {
                ScrollView {
                    LazyVStack(spacing: Spacing.sm) {
                        ForEach(topics) { topic in
                            NavigationLink(value: topic) {
                                TagTopicRow(topic: topic)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(Spacing.md)
                    .padding(.bottom, Spacing.xl)
                }
            }
        }
        .navigationTitle("#\(tag.name)")
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: Topic.self) { topic in
            TopicDetailByIdView(topicId: topic.id)
        }
        .task { await load() }
    }

    private func load() async {
        loading = true
        error = nil
        do {
            topics = try await SupabaseClient.shared.fetchTopicsByTag(tag.name)
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private var tagTopicSkeleton: some View {
        VStack(alignment: .leading, spacing: 8) {
            RoundedRectangle(cornerRadius: 4).fill(Color.surface300).frame(height: 14).frame(maxWidth: .infinity)
            RoundedRectangle(cornerRadius: 4).fill(Color.surface300).frame(height: 14).frame(width: 200)
            HStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 8).fill(Color.surface300).frame(width: 48, height: 6)
                RoundedRectangle(cornerRadius: 8).fill(Color.surface300).frame(width: 80, height: 6)
            }
        }
        .lmCard()
        .redacted(reason: .placeholder)
    }
}

// MARK: - Tag topic row

private struct TagTopicRow: View {
    let topic: Topic

    private var forPct: Double { topic.bluePercentage }
    private var againstPct: Double { topic.redPercentage }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(topic.statement)
                .font(.lmBody)
                .foregroundStyle(.white)
                .multilineTextAlignment(.leading)
                .lineLimit(3)

            HStack(spacing: Spacing.xs) {
                if let cat = topic.category {
                    Text(cat)
                        .font(.system(size: 10, weight: .heavy))
                        .foregroundStyle(.gold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Color.gold.opacity(0.12)))
                }
                Spacer()
                Label("\(topic.totalVotes.formatted(.number))", systemImage: "person.2.fill")
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
            }

            // Vote bar
            GeometryReader { geo in
                HStack(spacing: 2) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.forBlue)
                        .frame(width: max(2, geo.size.width * forPct / 100))
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.againstRed)
                        .frame(maxWidth: .infinity)
                }
                .frame(height: 4)
            }
            .frame(height: 4)

            HStack {
                Text(String(format: "%.0f%% For", forPct))
                    .font(.lmCaption)
                    .foregroundStyle(.forBlue)
                Spacer()
                Text(String(format: "%.0f%% Against", againstPct))
                    .font(.lmCaption)
                    .foregroundStyle(.againstRed)
            }
        }
        .lmCard()
    }
}

// MARK: - Main tag browser

struct TagBrowserView: View {
    @State private var tags: [TrendingTag] = []
    @State private var loading = true
    @State private var searchText = ""
    @State private var selectedTag: TrendingTag?
    @FocusState private var searchFocused: Bool

    private var filtered: [TrendingTag] {
        guard !searchText.isEmpty else { return tags }
        return tags.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                VStack(spacing: 0) {
                    searchBar
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.sm)

                    if loading {
                        tagSkeletonGrid
                    } else if filtered.isEmpty {
                        emptyState
                    } else {
                        tagList
                    }
                }
            }
            .navigationTitle("Topics by Tag")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: TrendingTag.self) { tag in
                TagDetailView(tag: tag)
            }
            .task { await load() }
        }
    }

    // MARK: - Subviews

    private var searchBar: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.textSecondary)
                .font(.system(size: 14))
            TextField("Search tags...", text: $searchText)
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .tint(.forBlue)
                .focused($searchFocused)
            if !searchText.isEmpty {
                Button { searchText = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.textTertiary)
                }
            }
        }
        .padding(Spacing.sm)
        .background(RoundedRectangle(cornerRadius: Radii.md).fill(Color.surface200))
        .overlay(RoundedRectangle(cornerRadius: Radii.md).stroke(Color.white.opacity(0.08), lineWidth: 1))
    }

    private var tagList: some View {
        ScrollView {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 140), spacing: Spacing.sm)],
                spacing: Spacing.sm
            ) {
                ForEach(filtered) { tag in
                    NavigationLink(value: tag) {
                        TagChip(tag: tag)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(Spacing.md)
            .padding(.bottom, 100)
        }
        .refreshable { await load() }
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.md) {
            Spacer()
            Image(systemName: "tag.slash")
                .font(.system(size: 48))
                .foregroundStyle(.textTertiary)
            Text(searchText.isEmpty ? "No tags found" : "No tags matching \"\(searchText)\"")
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
            Spacer()
        }
    }

    private var tagSkeletonGrid: some View {
        ScrollView {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 140), spacing: Spacing.sm)],
                spacing: Spacing.sm
            ) {
                ForEach(0..<24, id: \.self) { i in
                    RoundedRectangle(cornerRadius: Radii.md)
                        .fill(Color.surface200)
                        .frame(height: 64)
                        .redacted(reason: .placeholder)
                }
            }
            .padding(Spacing.md)
        }
    }

    // MARK: - Data

    private func load() async {
        loading = true
        do {
            tags = try await SupabaseClient.shared.fetchTrendingTags()
        } catch {
            tags = []
        }
        loading = false
    }
}

// MARK: - Tag chip card

private struct TagChip: View {
    let tag: TrendingTag

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Text("#")
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(.forBlue.opacity(0.7))
                Text(tag.name)
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            Text("\(tag.topicCount) topic\(tag.topicCount == 1 ? "" : "s")")
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(Color.forBlue.opacity(0.15), lineWidth: 1)
                )
        )
    }
}

#Preview {
    TagBrowserView()
}
