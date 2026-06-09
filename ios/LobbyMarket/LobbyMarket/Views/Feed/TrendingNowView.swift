//
//  TrendingNowView.swift
//  LobbyMarket
//
//  A real-time pulse of the platform — the most-voted active topics,
//  recently established laws, and upcoming live debates.
//  Opened as a sheet from FeedView via the trending flame button.
//

import SwiftUI

// MARK: - Status helpers

private func statusColor(_ status: String?) -> Color {
    switch status {
    case "active":   return .forBlue
    case "voting":   return .purple
    case "law":      return .gold
    case "failed":   return .againstRed
    default:         return .surface400
    }
}

private func statusLabel(_ status: String?) -> String {
    switch status {
    case "active":   return "ACTIVE"
    case "voting":   return "VOTING"
    case "law":      return "LAW"
    case "failed":   return "FAILED"
    case "proposed": return "PROPOSED"
    default:         return (status ?? "").uppercased()
    }
}

private func statusIcon(_ status: String?) -> String {
    switch status {
    case "active":   return "bolt.fill"
    case "voting":   return "scale.3d"
    case "law":      return "building.columns.fill"
    case "failed":   return "xmark.circle.fill"
    default:         return "flame.fill"
    }
}

private func categoryColor(_ category: String?) -> Color {
    switch category {
    case "Politics":     return .forBlue
    case "Economics":    return .gold
    case "Technology":   return .purple
    case "Science":      return .emerald
    case "Ethics":       return .againstRed
    case "Philosophy":   return .purple
    case "Culture":      return .gold
    case "Health":       return .emerald
    case "Environment":  return .emerald
    case "Education":    return .forBlue
    default:             return .surface400
    }
}

private func formatVotes(_ n: Int) -> String {
    if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
    if n >= 1_000 { return String(format: "%.1fK", Double(n) / 1_000) }
    return "\(n)"
}

// MARK: - StatusPill (local, avoids name conflict)

private struct TrendingStatusPill: View {
    let status: String?

    var body: some View {
        let color = statusColor(status)
        let label = statusLabel(status)
        Text(label)
            .font(.system(size: 9, weight: .heavy, design: .monospaced))
            .foregroundStyle(color)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .background(
                Capsule()
                    .fill(color.opacity(0.14))
                    .overlay(Capsule().stroke(color.opacity(0.35), lineWidth: 1))
            )
    }
}

// MARK: - Hot Topic Row

private struct HotTopicRow: View {
    let rank: Int
    let topic: Topic
    let onTap: () -> Void

    private var pct: Double { topic.bluePercentage }
    private var isFor: Bool  { pct >= 50 }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.sm) {
                // Rank badge
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(rankBg)
                        .frame(width: 32, height: 32)
                    Text("\(rank)")
                        .font(.system(size: 13, weight: .heavy, design: .monospaced))
                        .foregroundStyle(rankColor)
                }

                VStack(alignment: .leading, spacing: 4) {
                    // Statement
                    Text(topic.statement)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    HStack(spacing: 6) {
                        if let cat = topic.category {
                            Text(cat.uppercased())
                                .font(.system(size: 9, weight: .heavy, design: .monospaced))
                                .foregroundStyle(categoryColor(cat).opacity(0.8))
                        }

                        TrendingStatusPill(status: topic.status)

                        Spacer()

                        Text(formatVotes(topic.totalVotes) + " votes")
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundStyle(.textTertiary)
                    }

                    // Mini vote bar
                    GeometryReader { geo in
                        HStack(spacing: 1) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.forBlue)
                                .frame(width: geo.size.width * CGFloat(pct / 100), height: 4)
                            RoundedRectangle(cornerRadius: 2)
                                .fill(Color.againstRed)
                                .frame(width: geo.size.width * CGFloat((100 - pct) / 100), height: 4)
                        }
                    }
                    .frame(height: 4)
                    .clipShape(Capsule())
                }
            }
            .padding(Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(Color.surface200)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private var rankBg: Color {
        switch rank {
        case 1: return Color.gold.opacity(0.18)
        case 2: return Color.surface300
        case 3: return Color.surface300
        default: return Color.surface300.opacity(0.6)
        }
    }

    private var rankColor: Color {
        switch rank {
        case 1: return .gold
        case 2: return Color.white.opacity(0.7)
        case 3: return Color.white.opacity(0.6)
        default: return .textTertiary
        }
    }
}

// MARK: - Recent Law Row

private struct RecentLawRow: View {
    let law: Law
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.sm) {
                Image(systemName: "gavel")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.gold)
                    .frame(width: 28, height: 28)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.gold.opacity(0.12))
                    )

                VStack(alignment: .leading, spacing: 3) {
                    Text(law.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    if let cat = law.category {
                        Text(cat.uppercased())
                            .font(.system(size: 9, weight: .heavy, design: .monospaced))
                            .foregroundStyle(categoryColor(cat).opacity(0.7))
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.textTertiary)
            }
            .padding(Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(Color.surface200)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .stroke(Color.gold.opacity(0.15), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Debate Row

private struct TrendingDebateRow: View {
    let debate: Debate

    private var isLive: Bool { debate.status == .live }

    private var timeLabel: String {
        if isLive { return "LIVE NOW" }
        let diff = debate.scheduledAt.timeIntervalSinceNow
        if diff <= 0 { return "Started" }
        let h = Int(diff) / 3600
        let m = Int(diff) / 60 % 60
        if h >= 24 { return "in \(h / 24)d" }
        if h >= 1  { return "in \(h)h \(m)m" }
        return "in \(m)m"
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(isLive ? Color.againstRed.opacity(0.18) : Color.surface300)
                    .frame(width: 32, height: 32)
                Image(systemName: isLive ? "mic.fill" : "calendar")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(isLive ? .againstRed : .textSecondary)
            }

            VStack(alignment: .leading, spacing: 3) {
                if let title = debate.title, !title.isEmpty {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.textPrimary)
                        .lineLimit(1)
                } else {
                    Text("Debate")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.textPrimary)
                }

                HStack(spacing: 4) {
                    if isLive {
                        Circle()
                            .fill(Color.againstRed)
                            .frame(width: 6, height: 6)
                    }
                    Text(timeLabel)
                        .font(.system(size: 10, weight: .heavy, design: .monospaced))
                        .foregroundStyle(isLive ? .againstRed : .textTertiary)

                    if debate.viewerCount > 0 {
                        Text("·")
                            .foregroundStyle(.textTertiary)
                        Text("\(formatVotes(debate.viewerCount)) watching")
                            .font(.system(size: 10, weight: .medium, design: .monospaced))
                            .foregroundStyle(.textTertiary)
                    }
                }
            }

            Spacer()
        }
        .padding(Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(isLive ? Color.againstRed.opacity(0.25) : Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }
}

// MARK: - Section Header

private struct TrendingSectionHeader: View {
    let icon: String
    let title: String
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(color)
            Text(title.uppercased())
                .font(.system(size: 11, weight: .heavy, design: .monospaced))
                .foregroundStyle(.textTertiary)
                .tracking(1.0)
            Spacer()
        }
    }
}

// MARK: - Skeleton row

private struct SkeletonRow: View {
    var body: some View {
        HStack(spacing: Spacing.sm) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.surface300)
                .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 6) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.surface300)
                    .frame(height: 12)
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.surface300)
                    .frame(width: 140, height: 10)
            }
        }
        .padding(Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200)
        )
        .shimmering()
    }
}

// MARK: - Shimmer modifier

private struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    colors: [
                        Color.white.opacity(0),
                        Color.white.opacity(0.05),
                        Color.white.opacity(0),
                    ],
                    startPoint: .init(x: phase - 0.3, y: 0),
                    endPoint: .init(x: phase + 0.3, y: 0)
                )
                .allowsHitTesting(false)
            )
            .onAppear {
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                    phase = 1.6
                }
            }
    }
}

private extension View {
    func shimmering() -> some View {
        modifier(ShimmerModifier())
    }
}

// MARK: - Main View

struct TrendingNowView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var auth: AuthService

    @State private var hotTopics: [Topic] = []
    @State private var recentLaws: [Law] = []
    @State private var debates: [Debate] = []
    @State private var isLoading = true
    @State private var error: String?
    @State private var lastRefreshed = Date()

    // Navigation
    @State private var selectedTopicId: String?
    @State private var selectedLaw: Law?
    @State private var navigateToTopic = false
    @State private var navigateToLaw = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg) {

                        if isLoading {
                            skeletonSection
                        } else if let err = error {
                            errorView(err)
                        } else {
                            if !hotTopics.isEmpty {
                                hotTopicsSection
                            }
                            if !recentLaws.isEmpty {
                                recentLawsSection
                            }
                            if !debates.filter({ $0.status == .live || $0.status == .scheduled }).isEmpty {
                                debatesSection
                            }
                        }
                    }
                    .padding(Spacing.md)
                    .padding(.bottom, Spacing.xl)
                }
            }
            .navigationTitle("Trending Now")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.forBlue)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await loadAll() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.textSecondary)
                    }
                    .disabled(isLoading)
                }
            }
            .navigationDestination(isPresented: $navigateToTopic) {
                if let id = selectedTopicId {
                    TopicDetailByIdView(topicId: id)
                }
            }
            .navigationDestination(isPresented: $navigateToLaw) {
                if let law = selectedLaw {
                    LawDetailView(law: law, allLaws: recentLaws)
                }
            }
            .task { await loadAll() }
            .refreshable { await loadAll() }
        }
    }

    // MARK: - Sections

    private var hotTopicsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            TrendingSectionHeader(icon: "flame.fill", title: "Hot Right Now", color: .againstRed)

            VStack(spacing: Spacing.xs) {
                ForEach(Array(hotTopics.prefix(10).enumerated()), id: \.element.id) { idx, topic in
                    HotTopicRow(rank: idx + 1, topic: topic) {
                        Haptics.selection()
                        selectedTopicId = topic.id
                        navigateToTopic = true
                    }
                }
            }
        }
    }

    private var recentLawsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            TrendingSectionHeader(icon: "gavel", title: "Recently Established", color: .gold)

            VStack(spacing: Spacing.xs) {
                ForEach(recentLaws.prefix(5)) { law in
                    RecentLawRow(law: law) {
                        Haptics.selection()
                        selectedLaw = law
                        navigateToLaw = true
                    }
                }
            }
        }
    }

    private var debatesSection: some View {
        let relevant = debates.filter { $0.status == .live || $0.status == .scheduled }.prefix(5)
        return VStack(alignment: .leading, spacing: Spacing.sm) {
            TrendingSectionHeader(icon: "mic.fill", title: "Debates", color: .purple)

            VStack(spacing: Spacing.xs) {
                ForEach(Array(relevant)) { debate in
                    TrendingDebateRow(debate: debate)
                }
            }
        }
    }

    private var skeletonSection: some View {
        VStack(spacing: Spacing.lg) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                TrendingSectionHeader(icon: "flame.fill", title: "Hot Right Now", color: .againstRed)
                VStack(spacing: Spacing.xs) {
                    ForEach(0..<6, id: \.self) { _ in SkeletonRow() }
                }
            }
            VStack(alignment: .leading, spacing: Spacing.sm) {
                TrendingSectionHeader(icon: "gavel", title: "Recently Established", color: .gold)
                VStack(spacing: Spacing.xs) {
                    ForEach(0..<3, id: \.self) { _ in SkeletonRow() }
                }
            }
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 40))
                .foregroundStyle(.textTertiary)
            Text("Couldn't load trending data")
                .font(.lmHeadline)
                .foregroundStyle(.textSecondary)
            Text(message)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task { await loadAll() }
            }
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(.forBlue)
        }
        .padding(Spacing.xl)
    }

    // MARK: - Data loading

    private func loadAll() async {
        isLoading = true
        error = nil
        async let topicsTask = SupabaseClient.shared.fetchHotTopics(limit: 15)
        async let lawsTask = SupabaseClient.shared.fetchRecentLaws(limit: 6)
        async let debatesTask = SupabaseClient.shared.fetchDebates(limit: 20)

        do {
            let (topics, laws, dbs) = try await (topicsTask, lawsTask, debatesTask)
            hotTopics = topics
            recentLaws = laws
            debates = dbs
            lastRefreshed = Date()
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

#Preview {
    TrendingNowView()
        .environmentObject(AuthService())
}
