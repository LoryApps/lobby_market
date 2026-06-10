//
//  CategoryDetailView.swift
//  LobbyMarket
//
//  Full-screen category browser — replaces the bare CategoryTopicsSheet.
//  Shows category stats, status + sort filter chips, and paginated topic cards
//  with vote bars.  Navigates to TopicDetailByIdView on tap.
//

import SwiftUI

// MARK: - Category metadata

private struct CategoryMeta: Equatable {
    let name: String
    let icon: String
    let color: Color
    let accentBg: Color
}

private let CATEGORY_META: [String: CategoryMeta] = [
    "Politics":    CategoryMeta(name: "Politics",    icon: "building.columns.fill",      color: .forBlue,    accentBg: Color.forBlue.opacity(0.12)),
    "Economics":   CategoryMeta(name: "Economics",   icon: "chart.line.uptrend.xyaxis",  color: .gold,       accentBg: Color.gold.opacity(0.12)),
    "Technology":  CategoryMeta(name: "Technology",  icon: "cpu.fill",                   color: .purple,     accentBg: Color.purple.opacity(0.12)),
    "Science":     CategoryMeta(name: "Science",     icon: "flask.fill",                 color: .emerald,    accentBg: Color.emerald.opacity(0.12)),
    "Ethics":      CategoryMeta(name: "Ethics",      icon: "scale.3d",                   color: .againstRed, accentBg: Color.againstRed.opacity(0.12)),
    "Philosophy":  CategoryMeta(name: "Philosophy",  icon: "book.fill",                  color: .purple,     accentBg: Color.purple.opacity(0.12)),
    "Culture":     CategoryMeta(name: "Culture",     icon: "music.note",                 color: .againstRed, accentBg: Color.againstRed.opacity(0.12)),
    "Health":      CategoryMeta(name: "Health",      icon: "heart.fill",                 color: .emerald,    accentBg: Color.emerald.opacity(0.12)),
    "Environment": CategoryMeta(name: "Environment", icon: "leaf.fill",                  color: .emerald,    accentBg: Color.emerald.opacity(0.12)),
    "Education":   CategoryMeta(name: "Education",   icon: "graduationcap.fill",         color: .gold,       accentBg: Color.gold.opacity(0.12)),
]

private func meta(for category: String) -> CategoryMeta {
    CATEGORY_META[category] ?? CategoryMeta(
        name: category, icon: "questionmark.circle.fill",
        color: .white.opacity(0.5), accentBg: .clear
    )
}

// MARK: - Status filter chip config

private struct StatusOption: Identifiable {
    let id: String
    let label: String
    let icon: String
    let activeColor: Color
}

private let STATUS_OPTIONS: [StatusOption] = [
    StatusOption(id: "",         label: "All",      icon: "square.grid.2x2",     activeColor: .white),
    StatusOption(id: "proposed", label: "Proposed", icon: "doc.text",            activeColor: .white.opacity(0.7)),
    StatusOption(id: "active",   label: "Active",   icon: "bolt.fill",           activeColor: .emerald),
    StatusOption(id: "voting",   label: "Voting",   icon: "scale.3d",            activeColor: .purple),
    StatusOption(id: "law",      label: "LAW",      icon: "gavel",               activeColor: .gold),
]

private let SORT_OPTIONS: [(id: String, label: String, icon: String)] = [
    ("top", "Top",  "flame.fill"),
    ("new", "New",  "clock.fill"),
    ("hot", "Hot",  "eye.fill"),
]

// MARK: - Category stats model

private struct CategoryStats {
    var total: Int = 0
    var active: Int = 0
    var laws: Int = 0
    var voting: Int = 0
}

// MARK: - Topic row card

private struct CategoryTopicRow: View {
    let topic: Topic

    private var forPct: Double { topic.bluePct ?? 50.0 }
    private var againstPct: Double { 100.0 - forPct }

    private var statusBadge: (label: String, color: Color) {
        switch topic.status {
        case "law":      return ("LAW",      .gold)
        case "voting":   return ("VOTING",   .purple)
        case "active":   return ("ACTIVE",   .emerald)
        case "proposed": return ("PROPOSED", .white.opacity(0.5))
        case "failed":   return ("FAILED",   .againstRed)
        default:         return (topic.status?.uppercased() ?? "—", .white.opacity(0.4))
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {

            // Statement
            Text(topic.statement)
                .font(.lmHeadline)
                .foregroundStyle(.textPrimary)
                .lineLimit(3)
                .fixedSize(horizontal: false, vertical: true)

            // Status + scope + vote count
            HStack(spacing: Spacing.xs) {
                // Status pill
                let badge = statusBadge
                Text(badge.label)
                    .font(.system(size: 10, weight: .heavy))
                    .kerning(0.5)
                    .foregroundStyle(badge.color)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(badge.color.opacity(0.12))
                    .clipShape(Capsule())
                    .overlay(Capsule().stroke(badge.color.opacity(0.3), lineWidth: 1))

                if let scope = topic.scope, !scope.isEmpty {
                    Text(scope)
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }

                Spacer()

                Text("\(topic.totalVotes.formatted()) votes")
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
            }

            // Compact vote bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.againstRed.opacity(0.5))
                        .frame(height: 6)

                    Capsule()
                        .fill(Color.forBlue)
                        .frame(width: max(0, geo.size.width * CGFloat(forPct / 100)), height: 6)
                }
            }
            .frame(height: 6)
            .animation(.spring(response: 0.5), value: forPct)

            // FOR / AGAINST labels
            HStack {
                Text("\(Int(forPct.rounded()))% FOR")
                    .font(.lmMono)
                    .foregroundStyle(.forBlue)
                Spacer()
                Text("\(Int(againstPct.rounded()))% AGAINST")
                    .font(.lmMono)
                    .foregroundStyle(.againstRed)
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
}

// MARK: - Main view

struct CategoryDetailView: View {
    let category: String

    @State private var topics: [Topic] = []
    @State private var stats = CategoryStats()
    @State private var selectedStatus: String = ""
    @State private var selectedSort: String = "top"
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var hasMore = true
    @State private var loadError: String? = nil

    private let pageSize = 20
    private var m: CategoryMeta { meta(for: category) }

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            if isLoading && !hasLoaded {
                shimmerView
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        statsHeader
                        filterBar
                        topicsSection

                        if hasMore && !topics.isEmpty {
                            loadMoreButton
                        }

                        Spacer(minLength: Spacing.xxl)
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.top, Spacing.sm)
                }
                .refreshable {
                    await reload()
                }
            }
        }
        .navigationTitle(category)
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: Topic.self) { topic in
            TopicDetailByIdView(topicId: topic.id)
        }
        .task {
            if !hasLoaded { await loadStats(); await reload() }
        }
        .onChange(of: selectedStatus) { _ in
            Task { await reload() }
        }
        .onChange(of: selectedSort) { _ in
            Task { await reload() }
        }
    }

    // MARK: - Stats header

    private var statsHeader: some View {
        HStack(spacing: Spacing.lg) {
            statPill(value: stats.total, label: "Topics",  color: m.color)
            statPill(value: stats.active, label: "Active", color: .emerald)
            statPill(value: stats.voting, label: "Voting", color: .purple)
            statPill(value: stats.laws, label: "Laws",     color: .gold)
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg)
                .fill(m.accentBg)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg)
                        .stroke(m.color.opacity(0.2), lineWidth: 1)
                )
        )
    }

    private func statPill(value: Int, label: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.system(size: 20, weight: .heavy, design: .rounded))
                .foregroundStyle(color)
            Text(label)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Filter bar

    private var filterBar: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Status filters
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.xs) {
                    ForEach(STATUS_OPTIONS) { opt in
                        filterChip(
                            label: opt.label,
                            icon: opt.icon,
                            isSelected: selectedStatus == opt.id,
                            activeColor: opt.activeColor
                        ) {
                            Haptics.selection()
                            selectedStatus = opt.id
                        }
                    }
                }
            }

            // Sort options
            HStack(spacing: Spacing.xs) {
                ForEach(SORT_OPTIONS, id: \.id) { opt in
                    filterChip(
                        label: opt.label,
                        icon: opt.icon,
                        isSelected: selectedSort == opt.id,
                        activeColor: m.color
                    ) {
                        Haptics.selection()
                        selectedSort = opt.id
                    }
                }
                Spacer()
            }
        }
    }

    private func filterChip(
        label: String,
        icon: String,
        isSelected: Bool,
        activeColor: Color,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
                Text(label)
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(isSelected ? activeColor : .textSecondary)
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, 7)
            .background(
                Capsule()
                    .fill(isSelected ? activeColor.opacity(0.15) : Color.surface200)
                    .overlay(
                        Capsule().stroke(
                            isSelected ? activeColor.opacity(0.4) : Color.white.opacity(0.08),
                            lineWidth: 1
                        )
                    )
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Topics list

    private var topicsSection: some View {
        Group {
            if let err = loadError {
                errorView(err)
            } else if topics.isEmpty && hasLoaded {
                emptyStateView
            } else {
                LazyVStack(spacing: Spacing.sm) {
                    ForEach(topics) { topic in
                        NavigationLink(value: topic) {
                            CategoryTopicRow(topic: topic)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private var emptyStateView: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: m.icon)
                .font(.system(size: 44))
                .foregroundStyle(m.color.opacity(0.4))
            Text("No \(category) topics yet")
                .font(.lmTitle)
                .foregroundStyle(.textPrimary)
            Text(selectedStatus.isEmpty
                 ? "Be the first to propose a topic in this category."
                 : "Try a different filter.")
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xxl)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: Spacing.sm) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 32))
                .foregroundStyle(.againstRed)
            Text(message)
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .multilineTextAlignment(.center)
            Button("Retry") {
                Task { await reload() }
            }
            .font(.lmHeadline)
            .foregroundStyle(.forBlue)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.xl)
    }

    // MARK: - Load more

    private var loadMoreButton: some View {
        Button {
            Task { await loadMore() }
        } label: {
            HStack(spacing: Spacing.xs) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.textTertiary)
                        .scaleEffect(0.8)
                } else {
                    Image(systemName: "arrow.down.circle")
                        .font(.system(size: 14))
                }
                Text("Load more")
                    .font(.lmHeadline)
            }
            .foregroundStyle(.textSecondary)
            .frame(maxWidth: .infinity)
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .fill(Color.surface200)
                    .overlay(RoundedRectangle(cornerRadius: Radii.lg).stroke(Color.white.opacity(0.06), lineWidth: 1))
            )
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
    }

    // MARK: - Shimmer skeleton

    private var shimmerView: some View {
        VStack(spacing: Spacing.md) {
            // Stats skeleton
            HStack(spacing: Spacing.lg) {
                ForEach(0..<4, id: \.self) { _ in
                    VStack(spacing: 4) {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color.surface300)
                            .frame(height: 24)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.surface300)
                            .frame(height: 12)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(Spacing.md)
            .background(RoundedRectangle(cornerRadius: Radii.lg).fill(Color.surface200))

            // Topic card skeletons
            ForEach(0..<5, id: \.self) { _ in
                VStack(alignment: .leading, spacing: Spacing.sm) {
                    RoundedRectangle(cornerRadius: 6).fill(Color.surface300).frame(height: 16)
                    RoundedRectangle(cornerRadius: 6).fill(Color.surface300).frame(height: 14).frame(maxWidth: .infinity * 0.7)
                    HStack {
                        RoundedRectangle(cornerRadius: 20).fill(Color.surface300).frame(width: 64, height: 22)
                        Spacer()
                        RoundedRectangle(cornerRadius: 4).fill(Color.surface300).frame(width: 80, height: 14)
                    }
                    RoundedRectangle(cornerRadius: 4).fill(Color.surface300).frame(height: 6)
                }
                .padding(Spacing.md)
                .background(RoundedRectangle(cornerRadius: Radii.lg).fill(Color.surface200))
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.top, Spacing.sm)
        .redacted(reason: .placeholder)
    }

    // MARK: - Data loading

    @MainActor
    private func loadStats() async {
        // Fetch counts for each status via dedicated calls — simple and reliable
        async let totalResult  = SupabaseClient.shared.fetchTopicsByCategory(category: category, limit: 1, offset: 0)
        async let activeResult = SupabaseClient.shared.fetchTopicsByCategory(category: category, status: "active",  limit: 1, offset: 0)
        async let votingResult = SupabaseClient.shared.fetchTopicsByCategory(category: category, status: "voting",  limit: 1, offset: 0)
        async let lawResult    = SupabaseClient.shared.fetchTopicsByCategory(category: category, status: "law",     limit: 1, offset: 0)

        // We can't get exact counts from REST without `prefer: count=exact`,
        // so we fetch a larger batch and cap for display.
        async let totalBatch = SupabaseClient.shared.fetchTopicsByCategory(category: category, limit: 500, offset: 0)

        if let batch = try? await totalBatch {
            stats.total  = batch.count
            stats.active = batch.filter { $0.status == "active"  }.count
            stats.voting = batch.filter { $0.status == "voting"  }.count
            stats.laws   = batch.filter { $0.status == "law"     }.count
        } else {
            _ = try? await totalResult
            _ = try? await activeResult
            _ = try? await votingResult
            _ = try? await lawResult
        }
    }

    @MainActor
    private func reload() async {
        isLoading = true
        loadError = nil
        do {
            let status: String? = selectedStatus.isEmpty ? nil : selectedStatus
            let result = try await SupabaseClient.shared.fetchTopicsByCategory(
                category: category,
                status: status,
                sort: selectedSort,
                limit: pageSize,
                offset: 0
            )
            topics = result
            hasMore = result.count == pageSize
            hasLoaded = true
        } catch {
            loadError = "Couldn't load topics. Tap to retry."
        }
        isLoading = false
    }

    @MainActor
    private func loadMore() async {
        guard !isLoading, hasMore else { return }
        isLoading = true
        do {
            let status: String? = selectedStatus.isEmpty ? nil : selectedStatus
            let result = try await SupabaseClient.shared.fetchTopicsByCategory(
                category: category,
                status: status,
                sort: selectedSort,
                limit: pageSize,
                offset: topics.count
            )
            topics.append(contentsOf: result)
            hasMore = result.count == pageSize
        } catch {
            // Silent failure on load-more — user can retry with pull-to-refresh
        }
        isLoading = false
    }
}

#Preview {
    NavigationStack {
        CategoryDetailView(category: "Technology")
    }
}
