//
//  StatsView.swift
//  LobbyMarket
//
//  Personal civic analytics dashboard: voting streak, category breakdown,
//  7-day activity bar chart, clout, and a link to the full web analytics.
//

import SwiftUI

// MARK: - Local analytics models

private struct CategoryStat: Identifiable {
    let id = UUID()
    let category: String
    let count: Int
    let fraction: Double
    let color: Color
}

// MARK: - Category color map

private let CATEGORY_COLORS: [String: Color] = [
    "Economics":    .gold,
    "Politics":     .forBlue,
    "Technology":   .purple,
    "Science":      .emerald,
    "Ethics":       .againstRed,
    "Philosophy":   .purple,
    "Culture":      .gold,
    "Health":       .emerald,
    "Environment":  .emerald,
    "Education":    .forBlue,
]

private func categoryColor(_ cat: String) -> Color {
    CATEGORY_COLORS[cat] ?? .white.opacity(0.6)
}

// MARK: - Main view

struct StatsView: View {
    @EnvironmentObject var auth: AuthService

    @State private var profile: Profile?
    @State private var votes: [VoteHistory] = []
    @State private var predictionStats: PredictionUserStats?
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var errorMessage: String?

    // MARK: Computed stats

    private var totalVotes: Int { votes.count }

    private var streak: Int {
        guard !votes.isEmpty else { return 0 }
        let cal = Calendar.current
        var day = cal.startOfDay(for: Date())
        var count = 0
        while true {
            let nextDay = cal.date(byAdding: .day, value: 1, to: day)!
            let voted = votes.contains { cal.startOfDay(for: $0.createdAt) == day }
            if voted {
                count += 1
                day = cal.date(byAdding: .day, value: -1, to: day)!
            } else {
                // allow today to be zero — check yesterday instead before breaking
                if count == 0 {
                    let yesterday = cal.date(byAdding: .day, value: -1, to: day)!
                    let votedYest = votes.contains { cal.startOfDay(for: $0.createdAt) == yesterday }
                    if votedYest {
                        day = yesterday
                        continue
                    }
                }
                break
            }
        }
        return count
    }

    private var categoryStats: [CategoryStat] {
        guard !votes.isEmpty else { return [] }
        var counts: [String: Int] = [:]
        for v in votes {
            let cat = v.topics?.category ?? "Other"
            counts[cat, default: 0] += 1
        }
        let total = votes.count
        return counts
            .sorted { $0.value > $1.value }
            .prefix(6)
            .map { key, value in
                CategoryStat(
                    category: key,
                    count: value,
                    fraction: Double(value) / Double(total),
                    color: categoryColor(key)
                )
            }
    }

    private var weekActivity: [(label: String, count: Int)] {
        let cal = Calendar.current
        let dayFmt = DateFormatter()
        dayFmt.dateFormat = "E"
        return (0..<7).reversed().map { offset -> (String, Int) in
            let day = cal.date(byAdding: .day, value: -offset, to: cal.startOfDay(for: Date()))!
            let next = cal.date(byAdding: .day, value: 1, to: day)!
            let count = votes.filter { $0.createdAt >= day && $0.createdAt < next }.count
            return (dayFmt.string(from: day), count)
        }
    }

    private var weekMax: Int { weekActivity.map(\.count).max() ?? 1 }

    // MARK: Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                if !auth.isAuthenticated {
                    notAuthView
                } else if isLoading && !hasLoaded {
                    shimmer
                } else {
                    ScrollView {
                        VStack(spacing: Spacing.md) {
                            headerCard
                            statsGrid
                            activityChart
                            if !categoryStats.isEmpty {
                                categoryBreakdown
                            }
                            if let ps = predictionStats, ps.total > 0 {
                                predictionCard(ps)
                            }
                            webLink
                            Spacer(minLength: 40)
                        }
                        .padding(.horizontal, Spacing.md)
                        .padding(.top, Spacing.sm)
                    }
                    .refreshable {
                        await load()
                    }
                }

                if let err = errorMessage {
                    VStack {
                        Spacer()
                        Text(err)
                            .font(.lmCaption)
                            .foregroundStyle(.textSecondary)
                            .padding()
                            .background(Capsule().fill(Color.surface200))
                            .padding(.bottom, 120)
                    }
                }
            }
            .navigationTitle("My Stats")
            .navigationBarTitleDisplayMode(.large)
        }
        .task {
            if !hasLoaded && auth.isAuthenticated {
                await load()
            }
        }
    }

    // MARK: - Subviews

    private var notAuthView: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "chart.bar.xaxis")
                .font(.system(size: 48))
                .foregroundStyle(.forBlue.opacity(0.6))
            Text("Sign in to see your stats")
                .font(.lmTitle)
                .foregroundStyle(.white)
            Text("Your voting record, streak, and influence await.")
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.xl)
    }

    private var headerCard: some View {
        HStack(alignment: .center, spacing: Spacing.md) {
            // Avatar circle
            Circle()
                .fill(LinearGradient.forGradient)
                .frame(width: 56, height: 56)
                .overlay(
                    Text(initial)
                        .font(.system(size: 22, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                )
                .shadow(color: .forBlue.opacity(0.4), radius: 12, x: 0, y: 4)

            VStack(alignment: .leading, spacing: 2) {
                Text(displayName)
                    .font(.lmTitle)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                Text("Civic Analytics")
                    .font(.lmCaption)
                    .foregroundStyle(.textSecondary)
            }
            Spacer()
            // Streak badge
            if streak > 0 {
                VStack(spacing: 2) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(.orange)
                    Text("\(streak)")
                        .font(.system(size: 13, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                    Text("streak")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(.textSecondary)
                }
            }
        }
        .lmCard()
    }

    private var statsGrid: some View {
        VStack(spacing: Spacing.sm) {
            HStack(spacing: Spacing.sm) {
                statTile(
                    icon: "checkmark.circle.fill",
                    label: "VOTES",
                    value: "\(totalVotes)",
                    color: .forBlue
                )
                statTile(
                    icon: "bolt.fill",
                    label: "CLOUT",
                    value: "\(profile?.clout ?? 0)",
                    color: .gold
                )
            }
            HStack(spacing: Spacing.sm) {
                statTile(
                    icon: "doc.text.fill",
                    label: "TOPICS",
                    value: "\(profile?.topicsCreated ?? 0)",
                    color: .purple
                )
                statTile(
                    icon: "star.fill",
                    label: "REPUTATION",
                    value: "\(profile?.reputation ?? 0)",
                    color: .emerald
                )
            }
        }
    }

    private func statTile(icon: String, label: String, value: String, color: Color) -> some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(color)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 1) {
                Text(value)
                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                Text(label)
                    .font(.system(size: 10, weight: .heavy))
                    .kerning(0.8)
                    .foregroundStyle(color.opacity(0.85))
            }
            Spacer()
        }
        .lmCard(padding: Spacing.sm)
        .frame(maxWidth: .infinity)
    }

    private var activityChart: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("VOTE ACTIVITY — PAST 7 DAYS")
                .font(.system(size: 11, weight: .heavy))
                .kerning(0.8)
                .foregroundStyle(.textSecondary)

            HStack(alignment: .bottom, spacing: 6) {
                ForEach(weekActivity, id: \.label) { day in
                    VStack(spacing: 4) {
                        // bar
                        let fraction = weekMax > 0 ? CGFloat(day.count) / CGFloat(weekMax) : 0
                        RoundedRectangle(cornerRadius: 4)
                            .fill(
                                day.count > 0
                                    ? LinearGradient(
                                        colors: [.forBlue, .forBlue.opacity(0.6)],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                                    : LinearGradient(
                                        colors: [Color.surface300, Color.surface300],
                                        startPoint: .top,
                                        endPoint: .bottom
                                    )
                            )
                            .frame(height: max(4, 60 * fraction))
                        // label
                        Text(day.label)
                            .font(.system(size: 10, weight: .medium))
                            .foregroundStyle(.textSecondary)
                        // count
                        Text(day.count > 0 ? "\(day.count)" : "–")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                            .foregroundStyle(day.count > 0 ? .forBlue : .textSecondary.opacity(0.5))
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .frame(height: 90)
        }
        .lmCard()
    }

    private var categoryBreakdown: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("CATEGORY BREAKDOWN")
                .font(.system(size: 11, weight: .heavy))
                .kerning(0.8)
                .foregroundStyle(.textSecondary)

            VStack(spacing: Spacing.xs) {
                ForEach(categoryStats) { stat in
                    HStack(spacing: Spacing.sm) {
                        Text(stat.category)
                            .font(.lmCaption)
                            .foregroundStyle(.white)
                            .frame(width: 86, alignment: .leading)
                            .lineLimit(1)

                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(Color.surface300)
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(stat.color.opacity(0.8))
                                    .frame(width: geo.size.width * stat.fraction)
                            }
                        }
                        .frame(height: 8)

                        Text("\(stat.count)")
                            .font(.lmMono)
                            .foregroundStyle(.textSecondary)
                            .frame(width: 24, alignment: .trailing)
                    }
                }
            }
        }
        .lmCard()
    }

    private var webLink: some View {
        Button {
            Haptics.impact(.light)
            if let username = profile?.username ?? auth.currentUsername,
               let url = URL(string: "\(Config.webURL)/analytics?u=\(username)") {
                UIApplication.shared.open(url)
            }
        } label: {
            HStack {
                Image(systemName: "chart.xyaxis.line")
                    .foregroundStyle(.forBlue)
                Text("Full Analytics on Web")
                    .font(.lmBodyBold)
                    .foregroundStyle(.forBlue)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 13))
                    .foregroundStyle(.textSecondary)
            }
        }
        .lmCard()
    }

    // MARK: - Prediction card

    private func predictionCard(_ ps: PredictionUserStats) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack(spacing: Spacing.xs) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.gold)
                Text("Prediction Record")
                    .font(.lmTitle)
                    .foregroundStyle(.textPrimary)
                Spacer()
                if let acc = ps.accuracy {
                    Text("\(Int(acc * 100))% accurate")
                        .font(.lmCaption)
                        .foregroundStyle(.emerald)
                        .padding(.horizontal, Spacing.xs)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(Color.emerald.opacity(0.12)))
                }
            }

            HStack(spacing: 0) {
                predictionStatCell(value: "\(ps.total)", label: "Total")
                Divider().frame(width: 1, height: 36).background(Color.white.opacity(0.08))
                predictionStatCell(value: "\(ps.resolved)", label: "Resolved")
                Divider().frame(width: 1, height: 36).background(Color.white.opacity(0.08))
                predictionStatCell(value: "\(ps.correct)", label: "Correct")
                if let brier = ps.avgBrier {
                    Divider().frame(width: 1, height: 36).background(Color.white.opacity(0.08))
                    predictionStatCell(
                        value: String(format: "%.2f", brier),
                        label: "Brier"
                    )
                }
            }

            if ps.cloutEarned > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "bolt.fill")
                        .font(.system(size: 11))
                        .foregroundStyle(.gold)
                    Text("+\(ps.cloutEarned) clout earned from correct forecasts")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }
            }
        }
        .lmCard()
    }

    private func predictionStatCell(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.lmMono)
                .foregroundStyle(.textPrimary)
            Text(label)
                .font(.system(size: 10))
                .foregroundStyle(.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Shimmer skeleton

    private var shimmer: some View {
        VStack(spacing: Spacing.md) {
            ForEach(0..<4, id: \.self) { _ in
                RoundedRectangle(cornerRadius: Radii.lg)
                    .fill(Color.surface200)
                    .frame(maxWidth: .infinity)
                    .frame(height: 80)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.top, Spacing.sm)
    }

    // MARK: - Helpers

    private var displayName: String {
        profile?.displayName ?? profile?.username ?? auth.currentUsername ?? "Citizen"
    }

    private var initial: String {
        String(displayName.first ?? "C").uppercased()
    }

    // MARK: - Data loading

    @MainActor
    private func load() async {
        isLoading = true
        errorMessage = nil
        defer {
            isLoading = false
            hasLoaded = true
        }
        guard let uid = auth.currentUserId else { return }
        async let profileTask    = SupabaseClient.shared.fetchProfile(id: uid)
        async let votesTask      = SupabaseClient.shared.fetchVoteHistory(userId: uid)
        async let predStatsTask  = SupabaseClient.shared.fetchPredictionUserStats(userId: uid)
        do {
            let (p, v) = try await (profileTask, votesTask)
            profile = p
            votes   = v
        } catch {
            errorMessage = "Could not load stats — \(error.localizedDescription)"
        }
        predictionStats = try? await predStatsTask
    }
}

// MARK: - Preview

#Preview {
    StatsView()
        .environmentObject(AuthService())
}
