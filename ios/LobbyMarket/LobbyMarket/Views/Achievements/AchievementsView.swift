//
//  AchievementsView.swift
//  LobbyMarket
//
//  Full achievement gallery: earned badges by tier, locked previews,
//  and an in-progress section for near-miss achievements.
//

import SwiftUI

// MARK: - Main View

struct AchievementsView: View {
    @EnvironmentObject var auth: AuthService

    @State private var allAchievements: [Achievement] = Achievement.sampleData
    @State private var earnedIds: Set<String>          = []
    @State private var earnedDates: [String: Date]     = [:]
    @State private var isLoading                        = false
    @State private var errorMsg: String?

    // Sorted: earned first (by date desc), then locked
    private var groupedByTier: [(AchievementTier, [Achievement])] {
        let tiers = AchievementTier.allCases.reversed() // legendary → common
        return tiers.compactMap { tier -> (AchievementTier, [Achievement])? in
            let items = allAchievements.filter { $0.tier == tier }
            return items.isEmpty ? nil : (tier, items)
        }
    }

    private var earnedCount: Int { earnedIds.count }
    private var totalCount:  Int { allAchievements.count }

    // Achievements nearest to completion (have progress type, not yet earned)
    private var inProgress: [Achievement] {
        allAchievements
            .filter { !earnedIds.contains($0.id) && !$0.criteriaType.isEmpty }
            .prefix(3)
            .map { $0 }
    }

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            if isLoading && allAchievements.isEmpty {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(.gold)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        // ── Header ─────────────────────────────────────────────
                        headerSection

                        // ── In-progress (if any) ───────────────────────────────
                        if !inProgress.isEmpty && auth.currentUserId != nil {
                            inProgressSection
                        }

                        // ── Achievement tiers ──────────────────────────────────
                        ForEach(groupedByTier, id: \.0) { tier, achievements in
                            tierSection(tier: tier, achievements: achievements)
                        }

                        Spacer().frame(height: Spacing.xxl + 60)
                    }
                }
                .refreshable { await load() }
            }
        }
        .navigationTitle("Achievements")
        .navigationBarTitleDisplayMode(.large)
        .task { await load() }
        .overlay(alignment: .top) {
            if let err = errorMsg {
                Text(err)
                    .font(.lmCaption)
                    .foregroundStyle(.againstRed)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.xs)
                    .background(Color.surface200)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                    .padding(.top, Spacing.sm)
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: Spacing.md) {
            // Trophy banner
            HStack(spacing: Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(Color.gold.opacity(0.12))
                        .frame(width: 52, height: 52)
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(.gold)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Your Achievements")
                        .font(.lmTitle)
                        .foregroundStyle(.textPrimary)
                    Text("\(earnedCount) of \(totalCount) unlocked")
                        .font(.lmMono)
                        .foregroundStyle(.textSecondary)
                }

                Spacer()
            }
            .padding(.horizontal, Spacing.md)
            .padding(.top, Spacing.md)

            // Overall progress bar
            VStack(alignment: .leading, spacing: Spacing.xs) {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.surface300)
                            .frame(height: 8)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(
                                LinearGradient(
                                    colors: [.gold, .gold.opacity(0.6)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(
                                width: totalCount > 0
                                    ? geo.size.width * CGFloat(earnedCount) / CGFloat(totalCount)
                                    : 0,
                                height: 8
                            )
                            .animation(.spring(duration: 0.6), value: earnedCount)
                    }
                }
                .frame(height: 8)

                // Tier summary pills
                tierSummaryPills
            }
            .padding(.horizontal, Spacing.md)
            .padding(.bottom, Spacing.md)

            Divider().background(Color.white.opacity(0.06))
        }
    }

    private var tierSummaryPills: some View {
        HStack(spacing: Spacing.xs) {
            ForEach(AchievementTier.allCases.reversed(), id: \.self) { tier in
                let count = earnedIds.filter { id in
                    allAchievements.first(where: { $0.id == id })?.tier == tier
                }.count
                if count > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: tier.systemImage)
                            .font(.system(size: 10, weight: .semibold))
                        Text("\(count)")
                            .font(.lmMono)
                    }
                    .foregroundStyle(tier.color)
                    .padding(.horizontal, Spacing.xs)
                    .padding(.vertical, 4)
                    .background(
                        Capsule().fill(tier.glowColor)
                            .overlay(Capsule().stroke(tier.borderColor, lineWidth: 1))
                    )
                }
            }
        }
    }

    // MARK: - In-Progress Section

    private var inProgressSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            sectionHeader("In Progress", icon: "chart.line.uptrend.xyaxis")

            VStack(spacing: Spacing.xs) {
                ForEach(inProgress) { achievement in
                    InProgressRow(achievement: achievement)
                }
            }
            .padding(.horizontal, Spacing.md)

            Divider()
                .background(Color.white.opacity(0.06))
                .padding(.top, Spacing.sm)
        }
    }

    // MARK: - Tier Section

    private func tierSection(tier: AchievementTier, achievements: [Achievement]) -> some View {
        let earnedInTier  = achievements.filter { earnedIds.contains($0.id) }
        let lockedInTier  = achievements.filter { !earnedIds.contains($0.id) }

        return VStack(alignment: .leading, spacing: Spacing.sm) {
            sectionHeader(
                "\(tier.label) · \(earnedInTier.count)/\(achievements.count)",
                icon: tier.systemImage,
                color: tier.color
            )

            // 2-column grid
            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible())],
                spacing: Spacing.sm
            ) {
                // Earned first
                ForEach(earnedInTier.sorted(by: { a, b in
                    (earnedDates[a.id] ?? .distantPast) > (earnedDates[b.id] ?? .distantPast)
                })) { achievement in
                    AchievementBadge(
                        achievement: achievement,
                        earnedAt: earnedDates[achievement.id],
                        isEarned: true
                    )
                }
                // Locked
                ForEach(lockedInTier) { achievement in
                    AchievementBadge(
                        achievement: achievement,
                        earnedAt: nil,
                        isEarned: false
                    )
                }
            }
            .padding(.horizontal, Spacing.md)

            Divider()
                .background(Color.white.opacity(0.06))
                .padding(.top, Spacing.sm)
        }
    }

    // MARK: - Helpers

    private func sectionHeader(
        _ title: String,
        icon: String,
        color: Color = Color.white.opacity(0.5)
    ) -> some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(color)
            Text(title.uppercased())
                .font(.lmMono)
                .foregroundStyle(color)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
    }

    // MARK: - Data Loading

    private func load() async {
        isLoading = true
        errorMsg  = nil

        do {
            // Fetch all achievements
            var params = QueryParams()
            params.select("id,slug,name,description,icon,tier,criteria_type,threshold")
            params.order("tier", ascending: true)
            params.limit(200)
            let all: [Achievement] = try await SupabaseClient.shared.get(
                table: "achievements",
                params: params
            )
            allAchievements = all

            // Fetch user's earned achievements
            if let uid = auth.currentUserId {
                var ep = QueryParams()
                ep.select("achievement_id,earned_at")
                ep.eq("user_id", uid)
                let earned: [UserAchievement] = try await SupabaseClient.shared.get(
                    table: "user_achievements",
                    params: ep
                )
                earnedIds   = Set(earned.map(\.achievementId))
                earnedDates = Dictionary(uniqueKeysWithValues: earned.map { ($0.achievementId, $0.earnedAt) })
            }
        } catch {
            errorMsg = error.localizedDescription
            // Keep sample data visible
        }

        isLoading = false
    }
}

// MARK: - AchievementBadge

private struct AchievementBadge: View {
    let achievement: Achievement
    let earnedAt:    Date?
    let isEarned:    Bool

    @State private var showDetail = false

    var body: some View {
        Button { showDetail = true } label: {
            VStack(spacing: Spacing.xs) {
                // Icon circle
                ZStack {
                    Circle()
                        .fill(isEarned ? achievement.tier.glowColor : Color.surface200)
                        .overlay(
                            Circle()
                                .stroke(
                                    isEarned ? achievement.tier.borderColor : Color.white.opacity(0.05),
                                    lineWidth: 1.5
                                )
                        )
                        .frame(width: 56, height: 56)

                    Image(systemName: iconSystemName(achievement.icon))
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(isEarned ? achievement.tier.color : Color.white.opacity(0.2))

                    // Lock overlay for unearned
                    if !isEarned {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(Color.white.opacity(0.25))
                            .offset(x: 18, y: 18)
                    }
                }

                Text(achievement.name)
                    .font(.lmCaption)
                    .foregroundStyle(isEarned ? .textPrimary : .textTertiary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)

                if let date = earnedAt {
                    Text(date, style: .date)
                        .font(.system(size: 10, weight: .medium, design: .monospaced))
                        .foregroundStyle(achievement.tier.color.opacity(0.8))
                }
            }
            .padding(Spacing.sm)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(isEarned ? achievement.tier.glowColor.opacity(0.5) : Color.surface200.opacity(0.5))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .stroke(
                                isEarned ? achievement.tier.borderColor : Color.white.opacity(0.04),
                                lineWidth: 1
                            )
                    )
            )
        }
        .buttonStyle(.plain)
        .opacity(isEarned ? 1 : 0.55)
        .sheet(isPresented: $showDetail) {
            AchievementDetailSheet(achievement: achievement, earnedAt: earnedAt, isEarned: isEarned)
        }
    }

    private func iconSystemName(_ icon: String) -> String {
        // Map Lucide icon names → SF Symbols
        let mapping: [String: String] = [
            "hand.raised":       "hand.raised.fill",
            "checkmark.seal":    "checkmark.seal.fill",
            "chart.bar":         "chart.bar.fill",
            "star":              "star.fill",
            "text.bubble":       "text.bubble.fill",
            "flame":             "flame.fill",
            "bolt":              "bolt.fill",
            "gavel":             "gavel",
            "building.columns":  "building.columns.fill",
            "crown":             "crown.fill",
            "trophy":            "trophy.fill",
            "users":             "person.3.fill",
            "zap":               "bolt.circle.fill",
            "award":             "rosette",
            "shield":            "shield.fill",
            "scale":             "scalemass.fill",
        ]
        // If icon contains a slash it's already an SF symbol, otherwise map it
        return mapping[icon] ?? (mapping.values.contains(icon) ? icon : "trophy.fill")
    }
}

// MARK: - InProgressRow

private struct InProgressRow: View {
    let achievement: Achievement

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm)
                    .fill(achievement.tier.glowColor)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.sm)
                            .stroke(achievement.tier.borderColor, lineWidth: 1)
                    )
                    .frame(width: 40, height: 40)
                Image(systemName: "trophy.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(achievement.tier.color)
            }

            VStack(alignment: .leading, spacing: 3) {
                HStack {
                    Text(achievement.name)
                        .font(.lmHeadline)
                        .foregroundStyle(.textPrimary)
                    Spacer()
                    Text(achievement.tier.label.uppercased())
                        .font(.system(size: 9, weight: .bold, design: .monospaced))
                        .foregroundStyle(achievement.tier.color)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            Capsule().fill(achievement.tier.glowColor)
                                .overlay(Capsule().stroke(achievement.tier.borderColor, lineWidth: 1))
                        )
                }
                Text(achievement.description)
                    .font(.lmCaption)
                    .foregroundStyle(.textSecondary)
                    .lineLimit(1)
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
}

// MARK: - Detail Sheet

private struct AchievementDetailSheet: View {
    @Environment(\.dismiss) private var dismiss

    let achievement: Achievement
    let earnedAt:    Date?
    let isEarned:    Bool

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            VStack(spacing: Spacing.lg) {
                // Drag handle
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.white.opacity(0.2))
                    .frame(width: 36, height: 4)
                    .padding(.top, Spacing.sm)

                // Big icon
                ZStack {
                    Circle()
                        .fill(achievement.tier.glowColor)
                        .overlay(Circle().stroke(achievement.tier.borderColor, lineWidth: 2))
                        .frame(width: 100, height: 100)
                    Image(systemName: "trophy.fill")
                        .font(.system(size: 40, weight: .semibold))
                        .foregroundStyle(isEarned ? achievement.tier.color : Color.white.opacity(0.2))
                }

                VStack(spacing: Spacing.xs) {
                    // Tier pill
                    HStack(spacing: 4) {
                        Image(systemName: achievement.tier.systemImage)
                            .font(.system(size: 11, weight: .semibold))
                        Text(achievement.tier.label.uppercased())
                            .font(.system(size: 11, weight: .bold, design: .monospaced))
                    }
                    .foregroundStyle(achievement.tier.color)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, 5)
                    .background(
                        Capsule().fill(achievement.tier.glowColor)
                            .overlay(Capsule().stroke(achievement.tier.borderColor, lineWidth: 1))
                    )

                    Text(achievement.name)
                        .font(.lmDisplayMedium)
                        .foregroundStyle(.textPrimary)
                        .multilineTextAlignment(.center)

                    Text(achievement.description)
                        .font(.lmBody)
                        .foregroundStyle(.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Spacing.xl)
                }

                if isEarned, let date = earnedAt {
                    VStack(spacing: 4) {
                        Text("Earned on")
                            .font(.lmCaption)
                            .foregroundStyle(.textTertiary)
                        Text(date, format: .dateTime.month(.wide).day().year())
                            .font(.lmMono)
                            .foregroundStyle(achievement.tier.color)
                    }
                    .padding(.vertical, Spacing.sm)
                    .padding(.horizontal, Spacing.xl)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .fill(achievement.tier.glowColor)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.md)
                                    .stroke(achievement.tier.borderColor, lineWidth: 1)
                            )
                    )
                } else {
                    Text("Not yet earned")
                        .font(.lmMono)
                        .foregroundStyle(.textTertiary)
                        .padding(.vertical, Spacing.sm)
                }

                Spacer()

                Button("Done") { dismiss() }
                    .font(.lmBodyBold)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .fill(Color.surface200)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.md)
                                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
                            )
                    )
                    .foregroundStyle(.textPrimary)
                    .padding(.horizontal, Spacing.md)
                    .padding(.bottom, Spacing.md)
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.hidden)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        AchievementsView()
            .environmentObject(AuthService())
    }
}
