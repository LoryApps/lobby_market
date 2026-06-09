//
//  DiscoverView.swift
//  LobbyMarket
//
//  Curated exploration hub — category grid, hot topics, recent laws,
//  live debates, and rising citizens. The iOS counterpart of /discover.
//

import SwiftUI

// MARK: - Category config

private struct CategoryConfig: Identifiable {
    let id: String
    let icon: String
    let color: Color
    let accentBg: Color
}

private let CATEGORIES: [CategoryConfig] = [
    CategoryConfig(id: "Politics",     icon: "building.columns.fill",      color: .forBlue,    accentBg: Color.forBlue.opacity(0.12)),
    CategoryConfig(id: "Economics",    icon: "chart.line.uptrend.xyaxis",  color: .gold,       accentBg: Color.gold.opacity(0.12)),
    CategoryConfig(id: "Technology",   icon: "cpu.fill",                   color: .purple,     accentBg: Color.purple.opacity(0.12)),
    CategoryConfig(id: "Science",      icon: "flask.fill",                 color: .emerald,    accentBg: Color.emerald.opacity(0.12)),
    CategoryConfig(id: "Ethics",       icon: "scale.3d",                   color: .againstRed, accentBg: Color.againstRed.opacity(0.12)),
    CategoryConfig(id: "Philosophy",   icon: "book.fill",                  color: .purple,     accentBg: Color.purple.opacity(0.12)),
    CategoryConfig(id: "Culture",      icon: "music.note",                 color: .againstRed, accentBg: Color.againstRed.opacity(0.12)),
    CategoryConfig(id: "Health",       icon: "heart.fill",                 color: .emerald,    accentBg: Color.emerald.opacity(0.12)),
    CategoryConfig(id: "Environment",  icon: "leaf.fill",                  color: .emerald,    accentBg: Color.emerald.opacity(0.12)),
    CategoryConfig(id: "Education",    icon: "graduationcap.fill",         color: .gold,       accentBg: Color.gold.opacity(0.12)),
]

private func categoryConfig(_ id: String) -> CategoryConfig {
    CATEGORIES.first(where: { $0.id == id }) ?? CategoryConfig(id: id, icon: "questionmark", color: .white.opacity(0.5), accentBg: .clear)
}

// MARK: - Hot topic card (horizontal scroll)

private struct HotTopicCard: View {
    let topic: Topic

    var body: some View {
        let cfg = categoryConfig(topic.category ?? "")
        let forPct = topic.bluePct ?? 50.0
        let againstPct = 100.0 - forPct
        let status = topic.status ?? "active"

        NavigationLink(value: topic) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                // Status + category
                HStack(spacing: 6) {
                    Image(systemName: cfg.icon)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(cfg.color)
                    Text((topic.category ?? "").uppercased())
                        .font(.system(size: 10, weight: .heavy))
                        .kerning(0.6)
                        .foregroundStyle(cfg.color)
                    Spacer()
                    statusPill(status)
                }

                // Statement
                Text(topic.statement)
                    .font(.system(size: 14, weight: .semibold, design: .default))
                    .foregroundStyle(.white)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)

                Spacer(minLength: 0)

                // Vote bar
                VStack(spacing: 4) {
                    GeometryReader { geo in
                        HStack(spacing: 2) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color.forBlue)
                                .frame(width: max(4, geo.size.width * CGFloat(forPct / 100.0)))
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color.againstRed)
                        }
                        .frame(height: 6)
                    }
                    .frame(height: 6)
                    HStack {
                        Text("\(Int(forPct))% FOR")
                            .font(.lmMono)
                            .foregroundStyle(.forBlue)
                        Spacer()
                        Text("\(Int(againstPct))% AGAINST")
                            .font(.lmMono)
                            .foregroundStyle(.againstRed)
                    }
                }

                // Vote count
                HStack(spacing: 4) {
                    Image(systemName: "person.2.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(.textTertiary)
                    Text("\(topic.totalVotes.formatted()) votes")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }
            }
            .padding(Spacing.md)
            .frame(width: 220, height: 190)
            .background(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .fill(Color.surface200)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg)
                            .stroke(cfg.color.opacity(0.2), lineWidth: 1)
                    )
            )
            .shadow(color: .black.opacity(0.35), radius: 14, x: 0, y: 6)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func statusPill(_ status: String) -> some View {
        let (label, color): (String, Color) = {
            switch status {
            case "active":   return ("ACTIVE", .forBlue)
            case "voting":   return ("VOTING", .purple)
            case "law":      return ("LAW", .gold)
            case "proposed": return ("PROPOSED", .white.opacity(0.5))
            default:         return (status.uppercased(), .white.opacity(0.4))
            }
        }()
        Text(label)
            .font(.system(size: 9, weight: .heavy))
            .kerning(0.6)
            .foregroundStyle(color)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(Capsule().fill(color.opacity(0.15)))
    }
}

// MARK: - Law row

private struct LawRow: View {
    let law: Law

    var body: some View {
        let cfg = categoryConfig(law.category ?? "")
        NavigationLink(value: law) {
            HStack(spacing: Spacing.sm) {
                // Icon circle
                Circle()
                    .fill(cfg.accentBg)
                    .frame(width: 38, height: 38)
                    .overlay(
                        Image(systemName: "building.columns.fill")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(cfg.color)
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(law.title)
                        .font(.lmHeadline)
                        .foregroundStyle(.textPrimary)
                        .lineLimit(2)
                    if let cat = law.category {
                        Text(cat.uppercased())
                            .font(.system(size: 10, weight: .heavy))
                            .kerning(0.6)
                            .foregroundStyle(cfg.color.opacity(0.8))
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.textTertiary)
            }
            .padding(.vertical, Spacing.xs)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Rising citizen row

private struct RisingCitizenRow: View {
    let entry: LeaderboardEntry
    let rank: Int

    var rankColor: Color {
        switch rank {
        case 1: return .gold
        case 2: return Color.white.opacity(0.7)
        case 3: return Color(red: 0.80, green: 0.50, blue: 0.20)
        default: return .textTertiary
        }
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            // Rank badge
            Text("#\(rank)")
                .font(.system(size: 12, weight: .heavy, design: .monospaced))
                .foregroundStyle(rankColor)
                .frame(width: 28)

            // Avatar circle
            Circle()
                .fill(LinearGradient.forGradient)
                .frame(width: 36, height: 36)
                .overlay(
                    Text(entry.initials)
                        .font(.system(size: 13, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                )

            VStack(alignment: .leading, spacing: 1) {
                Text(entry.displayLabel)
                    .font(.lmHeadline)
                    .foregroundStyle(.textPrimary)
                    .lineLimit(1)
                Text("@\(entry.username)")
                    .font(.lmCaption)
                    .foregroundStyle(.textSecondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 1) {
                HStack(spacing: 3) {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(.gold)
                    Text("\(entry.clout)")
                        .font(.lmMono)
                        .foregroundStyle(.textPrimary)
                }
                Text("\(entry.votesCast) votes")
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
            }
        }
        .padding(.vertical, Spacing.xs)
    }
}

// MARK: - Debate row

private struct UpcomingDebateRow: View {
    let debate: Debate

    var statusColor: Color {
        switch debate.status {
        case .scheduled: return .forBlue
        case .live: return .againstRed
        default: return .textTertiary
        }
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            // Status dot
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
                .overlay(
                    debate.status == .live
                        ? Circle().stroke(statusColor.opacity(0.4), lineWidth: 3)
                        : nil
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(debate.title)
                    .font(.lmHeadline)
                    .foregroundStyle(.textPrimary)
                    .lineLimit(2)
                Text(formattedTime)
                    .font(.lmCaption)
                    .foregroundStyle(.textSecondary)
            }

            Spacer()

            if debate.status == .live {
                Text("LIVE")
                    .font(.system(size: 9, weight: .heavy))
                    .kerning(0.8)
                    .foregroundStyle(.againstRed)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Color.againstRed.opacity(0.15)))
            }
        }
        .padding(.vertical, Spacing.xs)
    }

    private var formattedTime: String {
        let now = Date()
        let diff = debate.scheduledAt.timeIntervalSince(now)
        if debate.status == .live { return "In progress" }
        if diff < 0 { return "Recently scheduled" }
        if diff < 3600 { return "In \(Int(diff / 60))m" }
        if diff < 86400 {
            let h = Int(diff / 3600)
            return "In \(h)h"
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE d MMM"
        return formatter.string(from: debate.scheduledAt)
    }
}

// MARK: - Category sheet

private struct CategoryTopicsSheet: View {
    let category: String
    @Environment(\.dismiss) private var dismiss
    @State private var topics: [Topic] = []
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()
                if isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.white)
                } else if topics.isEmpty {
                    VStack(spacing: Spacing.md) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 40))
                            .foregroundStyle(.textTertiary)
                        Text("No topics yet in \(category)")
                            .font(.lmBody)
                            .foregroundStyle(.textSecondary)
                    }
                } else {
                    List(topics) { topic in
                        NavigationLink(value: topic) {
                            topicRow(topic)
                        }
                        .listRowBackground(Color.surface200)
                        .listRowSeparatorTint(Color.white.opacity(0.07))
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle(category)
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(.forBlue)
                }
            }
        }
        .task { await loadTopics() }
    }

    @ViewBuilder
    private func topicRow(_ topic: Topic) -> some View {
        let forPct = topic.bluePct ?? 50.0
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(topic.statement)
                .font(.lmHeadline)
                .foregroundStyle(.textPrimary)
                .lineLimit(3)
            HStack(spacing: 6) {
                Text("\(Int(forPct))% FOR")
                    .font(.lmMono)
                    .foregroundStyle(.forBlue)
                Text("·")
                    .foregroundStyle(.textTertiary)
                Text("\(topic.totalVotes.formatted()) votes")
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
            }
        }
        .padding(.vertical, Spacing.xs)
    }

    @MainActor
    private func loadTopics() async {
        isLoading = true
        defer { isLoading = false }
        do {
            topics = try await SupabaseClient.shared.fetchTopics(
                limit: 30, offset: 0, category: category
            )
        } catch {
            topics = []
        }
    }
}

// MARK: - Section header helper

private struct SectionHeader: View {
    let icon: String
    let title: String
    let color: Color
    var actionLabel: String? = nil
    var action: (() -> Void)? = nil

    var body: some View {
        HStack(alignment: .center) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(color)
            Text(title)
                .font(.system(size: 13, weight: .heavy))
                .kerning(0.6)
                .foregroundStyle(.textSecondary)
            Spacer()
            if let label = actionLabel, let act = action {
                Button(action: act) {
                    Text(label)
                        .font(.lmCaption)
                        .foregroundStyle(.forBlue)
                }
            }
        }
    }
}

// MARK: - Main view

struct DiscoverView: View {
    @EnvironmentObject var auth: AuthService

    @State private var hotTopics: [Topic] = []
    @State private var recentLaws: [Law] = []
    @State private var debates: [Debate] = []
    @State private var topCitizens: [LeaderboardEntry] = []
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var selectedCategory: CategoryConfig? = nil
    @State private var showingCategorySheet = false

    // MARK: Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                if isLoading && !hasLoaded {
                    shimmerView
                } else {
                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: Spacing.lg) {
                            categorySection
                            hotTopicsSection
                            if !recentLaws.isEmpty { lawsSection }
                            if !debates.isEmpty { debatesSection }
                            if !topCitizens.isEmpty { citizensSection }
                            Spacer(minLength: 48)
                        }
                        .padding(.horizontal, Spacing.md)
                        .padding(.top, Spacing.sm)
                    }
                    .refreshable { await load() }
                }
            }
            .navigationTitle("Discover")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: Topic.self) { topic in
                TopicDetailByIdView(topicId: topic.id)
            }
            .navigationDestination(for: Law.self) { law in
                LawDetailView(law: law, allLaws: recentLaws)
            }
        }
        .task {
            if !hasLoaded { await load() }
        }
        .sheet(isPresented: $showingCategorySheet) {
            if let cat = selectedCategory {
                CategoryTopicsSheet(category: cat.id)
            }
        }
    }

    // MARK: - Category grid section

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            SectionHeader(
                icon: "square.grid.2x2.fill",
                title: "BROWSE BY CATEGORY",
                color: .forBlue
            )

            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: Spacing.sm),
                    GridItem(.flexible(), spacing: Spacing.sm),
                ],
                spacing: Spacing.sm
            ) {
                ForEach(CATEGORIES) { cat in
                    Button {
                        Haptics.impact(.light)
                        selectedCategory = cat
                        showingCategorySheet = true
                    } label: {
                        HStack(spacing: Spacing.xs) {
                            Image(systemName: cat.icon)
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(cat.color)
                                .frame(width: 22)
                            Text(cat.id)
                                .font(.lmHeadline)
                                .foregroundStyle(.textPrimary)
                                .lineLimit(1)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 10))
                                .foregroundStyle(.textTertiary)
                        }
                        .padding(.horizontal, Spacing.sm)
                        .padding(.vertical, Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: Radii.md)
                                .fill(cat.accentBg)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radii.md)
                                        .stroke(cat.color.opacity(0.2), lineWidth: 1)
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Hot topics carousel

    private var hotTopicsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            SectionHeader(
                icon: "flame.fill",
                title: "HOT TOPICS",
                color: .againstRed
            )

            if hotTopics.isEmpty {
                emptyHint(icon: "flame", message: "No active topics right now")
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: Spacing.sm) {
                        ForEach(hotTopics) { topic in
                            HotTopicCard(topic: topic)
                        }
                    }
                    .padding(.bottom, 4)
                }
            }
        }
    }

    // MARK: - Recent laws

    private var lawsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            SectionHeader(
                icon: "building.columns.fill",
                title: "RECENTLY ESTABLISHED LAWS",
                color: .gold
            )

            VStack(spacing: 0) {
                ForEach(recentLaws.prefix(5)) { law in
                    LawRow(law: law)
                    if law.id != recentLaws.prefix(5).last?.id {
                        Divider()
                            .background(Color.white.opacity(0.07))
                    }
                }
            }
            .lmCard()
        }
    }

    // MARK: - Upcoming debates

    private var debatesSection: some View {
        let upcoming = debates
            .filter { $0.status == .scheduled || $0.status == .live }
            .prefix(4)

        return VStack(alignment: .leading, spacing: Spacing.sm) {
            SectionHeader(
                icon: "mic.fill",
                title: "UPCOMING DEBATES",
                color: .purple
            )

            if upcoming.isEmpty {
                emptyHint(icon: "mic", message: "No upcoming debates scheduled")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(upcoming)) { debate in
                        UpcomingDebateRow(debate: debate)
                        if debate.id != upcoming.last?.id {
                            Divider().background(Color.white.opacity(0.07))
                        }
                    }
                }
                .lmCard()
            }
        }
    }

    // MARK: - Rising citizens

    private var citizensSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            SectionHeader(
                icon: "trophy.fill",
                title: "RISING CITIZENS",
                color: .gold
            )

            VStack(spacing: 0) {
                ForEach(Array(topCitizens.prefix(5).enumerated()), id: \.offset) { idx, entry in
                    RisingCitizenRow(entry: entry, rank: idx + 1)
                    if idx < min(4, topCitizens.count - 1) {
                        Divider().background(Color.white.opacity(0.07))
                    }
                }
            }
            .lmCard()
        }
    }

    // MARK: - Empty state helper

    private func emptyHint(icon: String, message: String) -> some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(.textTertiary)
            Text(message)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200.opacity(0.5))
        )
    }

    // MARK: - Shimmer skeleton

    private var shimmerView: some View {
        VStack(spacing: Spacing.md) {
            ForEach(0..<5, id: \.self) { _ in
                RoundedRectangle(cornerRadius: Radii.lg)
                    .fill(Color.surface200)
                    .frame(maxWidth: .infinity)
                    .frame(height: 72)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.top, Spacing.sm)
    }

    // MARK: - Data loading

    @MainActor
    private func load() async {
        isLoading = true
        defer { isLoading = false; hasLoaded = true }

        async let hotTask      = SupabaseClient.shared.fetchHotTopics(limit: 15)
        async let lawsTask     = SupabaseClient.shared.fetchRecentLaws(limit: 8)
        async let debatesTask  = SupabaseClient.shared.fetchDebates(limit: 20)
        async let citizensTask = SupabaseClient.shared.fetchLeaderboard(
            metric: .influence, limit: 5
        )

        do {
            let (hot, laws) = try await (hotTask, lawsTask)
            hotTopics  = hot
            recentLaws = laws
        } catch {}

        debates      = (try? await debatesTask) ?? []
        topCitizens  = (try? await citizensTask) ?? []
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        DiscoverView()
            .environmentObject(AuthService())
    }
}
