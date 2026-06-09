//
//  BriefingView.swift
//  LobbyMarket
//
//  Daily Civic Briefing — personalized start screen.
//  Shows today's vote progress, streak status, upcoming debates,
//  featured argument, and platform highlights.
//
//  Mirrors the web /briefing page. Navigated to from FeedView header.
//

import SwiftUI

// MARK: - Local models

private struct BriefingProfile {
    let username: String
    let displayName: String?
    let avatarURL: String?
    let role: String
    let voteStreak: Int
    let clout: Int
    let dailyVotesUsed: Int
    let dailyLimit: Int
}

private struct UpcomingDebate: Identifiable, Decodable {
    let id: String
    let title: String
    let topicStatement: String?
    let scheduledAt: Date
    let debateType: String
    let status: String
    let participantCount: Int

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case topicStatement   = "topic_statement"
        case scheduledAt      = "scheduled_at"
        case debateType       = "debate_type"
        case status
        case participantCount = "participant_count"
    }

    init(
        id: String,
        title: String,
        topicStatement: String?,
        scheduledAt: Date,
        debateType: String,
        status: String,
        participantCount: Int
    ) {
        self.id               = id
        self.title            = title
        self.topicStatement   = topicStatement
        self.scheduledAt      = scheduledAt
        self.debateType       = debateType
        self.status           = status
        self.participantCount = participantCount
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id               = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        title            = try c.decodeIfPresent(String.self, forKey: .title) ?? "Untitled"
        topicStatement   = try c.decodeIfPresent(String.self, forKey: .topicStatement)
        scheduledAt      = (try? c.decode(Date.self, forKey: .scheduledAt)) ?? Date()
        debateType       = try c.decodeIfPresent(String.self, forKey: .debateType) ?? "oxford"
        status           = try c.decodeIfPresent(String.self, forKey: .status) ?? "scheduled"
        participantCount = try c.decodeIfPresent(Int.self, forKey: .participantCount) ?? 0
    }
}

private struct FeaturedArgument: Decodable {
    let id: String
    let topicId: String
    let topicStatement: String
    let category: String?
    let side: String
    let content: String
    let upvotes: Int
    let authorUsername: String
    let authorDisplayName: String?

    init(
        id: String, topicId: String, topicStatement: String,
        category: String?, side: String, content: String,
        upvotes: Int, authorUsername: String, authorDisplayName: String?
    ) {
        self.id = id; self.topicId = topicId; self.topicStatement = topicStatement
        self.category = category; self.side = side; self.content = content
        self.upvotes = upvotes; self.authorUsername = authorUsername
        self.authorDisplayName = authorDisplayName
    }

    enum CodingKeys: String, CodingKey {
        case id
        case topicId          = "topic_id"
        case topicStatement   = "topic_statement"
        case category
        case side
        case content
        case upvotes
        case authorUsername   = "author_username"
        case authorDisplayName = "author_display_name"
    }
}

private struct Highlight: Identifiable, Decodable {
    let id = UUID()
    let type: String
    let topicId: String?
    let statement: String
    let category: String?
    let bluePct: Double?
    let totalVotes: Int?

    init(type: String, topicId: String?, statement: String, category: String?, bluePct: Double?, totalVotes: Int?) {
        self.type = type; self.topicId = topicId; self.statement = statement
        self.category = category; self.bluePct = bluePct; self.totalVotes = totalVotes
    }

    enum CodingKeys: String, CodingKey {
        case type
        case topicId    = "topic_id"
        case statement
        case category
        case bluePct    = "blue_pct"
        case totalVotes = "total_votes"
    }
}

private struct BriefingData {
    let profile: BriefingProfile
    let upcomingDebates: [UpcomingDebate]
    let featuredArgument: FeaturedArgument?
    let highlights: [Highlight]
    let unreadNotificationCount: Int
    let topCategory: String?
}

// MARK: - Helpers

private let CAT_COLORS: [String: Color] = [
    "Economics":   .gold,
    "Politics":    .forBlue,
    "Technology":  .purple,
    "Science":     .emerald,
    "Ethics":      .againstRed,
    "Philosophy":  .purple,
    "Culture":     .againstRed,
    "Health":      .emerald,
    "Environment": .emerald,
    "Education":   .gold,
]

private func catColor(_ cat: String?) -> Color {
    CAT_COLORS[cat ?? ""] ?? .white.opacity(0.5)
}

private func greeting() -> String {
    let h = Calendar.current.component(.hour, from: Date())
    if h < 12 { return "Good morning" }
    if h < 17 { return "Good afternoon" }
    return "Good evening"
}

private func timeUntil(_ date: Date) -> String {
    let diff = date.timeIntervalSinceNow
    if diff < 0 { return "Live now" }
    let m = Int(diff / 60)
    if m < 60 { return "in \(m)m" }
    let h = m / 60
    if h < 24 { return "in \(h)h" }
    return date.formatted(date: .abbreviated, time: .shortened)
}

// MARK: - Section header

private struct SectionLabel: View {
    let title: String
    var body: some View {
        Text(title)
            .font(.system(size: 11, weight: .heavy, design: .monospaced))
            .foregroundStyle(.textTertiary)
            .kerning(1.2)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Today's progress card

private struct TodayProgressCard: View {
    let profile: BriefingProfile

    private var pct: Double {
        guard profile.dailyLimit > 0 else { return 0 }
        return min(Double(profile.dailyVotesUsed) / Double(profile.dailyLimit), 1.0)
    }

    private var goalMet: Bool { profile.dailyVotesUsed >= profile.dailyLimit }

    private var streakColor: Color {
        if profile.voteStreak >= 30 { return .againstRed }
        if profile.voteStreak >= 7  { return .gold }
        if profile.voteStreak >= 1  { return .gold }
        return .textTertiary
    }

    var body: some View {
        HStack(spacing: Spacing.md) {
            // Streak
            VStack(spacing: 2) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(streakColor)
                Text("\(profile.voteStreak)")
                    .font(.system(size: 26, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                Text("DAY STREAK")
                    .font(.system(size: 9, weight: .heavy, design: .monospaced))
                    .foregroundStyle(.textTertiary)
                    .kerning(0.8)
            }
            .frame(width: 80)

            Divider()
                .background(Color.surface300)
                .frame(height: 56)

            // Daily vote progress
            VStack(alignment: .leading, spacing: Spacing.xs) {
                HStack {
                    Text("Daily votes")
                        .font(.lmHeadline)
                        .foregroundStyle(.white)
                    Spacer()
                    Text("\(profile.dailyVotesUsed)/\(profile.dailyLimit)")
                        .font(.system(size: 14, weight: .heavy, design: .rounded))
                        .foregroundStyle(goalMet ? .emerald : .forBlue)
                }

                // Progress bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.surface300)
                            .frame(height: 8)
                        RoundedRectangle(cornerRadius: 4)
                            .fill(
                                goalMet
                                    ? LinearGradient(colors: [.emerald, .emerald.opacity(0.7)],
                                                     startPoint: .leading, endPoint: .trailing)
                                    : LinearGradient(colors: [.forBlue, .forBlueDark],
                                                     startPoint: .leading, endPoint: .trailing)
                            )
                            .frame(width: geo.size.width * pct, height: 8)
                            .animation(.spring(response: 0.6, dampingFraction: 0.8), value: pct)
                    }
                }
                .frame(height: 8)

                if goalMet {
                    Label("Daily goal complete!", systemImage: "checkmark.circle.fill")
                        .font(.lmCaption)
                        .foregroundStyle(.emerald)
                } else if profile.voteStreak > 0 {
                    Text("\(profile.dailyLimit - profile.dailyVotesUsed) more vote\(profile.dailyLimit - profile.dailyVotesUsed == 1 ? "" : "s") to extend streak")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }
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

// MARK: - Debate card

private struct DebateCard: View {
    let debate: UpcomingDebate

    private var typeIcon: String {
        switch debate.debateType {
        case "oxford":    return "person.2.fill"
        case "town_hall": return "person.3.fill"
        case "rapid_fire": return "bolt.fill"
        default:          return "mic.fill"
        }
    }

    private var typeColor: Color {
        switch debate.debateType {
        case "oxford":    return .forBlue
        case "town_hall": return .purple
        case "rapid_fire": return .gold
        default:          return .emerald
        }
    }

    private var statusBadge: some View {
        let isLive = debate.status == "live"
        return Text(isLive ? "LIVE" : timeUntil(debate.scheduledAt))
            .font(.system(size: 10, weight: .heavy, design: .monospaced))
            .foregroundStyle(isLive ? .white : .textSecondary)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(
                Capsule()
                    .fill(isLive ? Color.againstRed : Color.surface300)
                    .overlay(
                        Capsule()
                            .stroke(isLive ? Color.againstRed.opacity(0.5) : Color.white.opacity(0.08), lineWidth: 1)
                    )
            )
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm)
                    .fill(typeColor.opacity(0.14))
                    .frame(width: 38, height: 38)
                Image(systemName: typeIcon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(typeColor)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(debate.title)
                    .font(.lmHeadline)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                if let stmt = debate.topicStatement {
                    Text(stmt)
                        .font(.lmCaption)
                        .foregroundStyle(.textSecondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            statusBadge
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

// MARK: - Featured argument card

private struct FeaturedArgumentCard: View {
    let argument: FeaturedArgument

    private var sideColor: Color  { argument.side == "blue" ? .forBlue : .againstRed }
    private var sideLabel: String { argument.side == "blue" ? "FOR" : "AGAINST" }
    private var sideIcon: String  { argument.side == "blue" ? "hand.thumbsup.fill" : "hand.thumbsdown.fill" }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Header row
            HStack {
                HStack(spacing: 4) {
                    Image(systemName: sideIcon)
                        .font(.system(size: 11))
                        .foregroundStyle(sideColor)
                    Text(sideLabel)
                        .font(.system(size: 11, weight: .heavy, design: .monospaced))
                        .foregroundStyle(sideColor)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(
                    Capsule()
                        .fill(sideColor.opacity(0.12))
                        .overlay(Capsule().stroke(sideColor.opacity(0.3), lineWidth: 1))
                )

                Spacer()

                if let cat = argument.category {
                    Text(cat)
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(catColor(argument.category))
                }
            }

            // Topic context
            Text(argument.topicStatement)
                .font(.lmCaption)
                .foregroundStyle(.textSecondary)
                .lineLimit(2)

            // Argument content
            Text(""\(argument.content)"")
                .font(.lmBody)
                .foregroundStyle(.white)
                .lineLimit(4)
                .fixedSize(horizontal: false, vertical: true)

            // Author + upvotes
            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(.textTertiary)
                    Text("@\(argument.authorDisplayName ?? argument.authorUsername)")
                        .font(.lmCaption)
                        .foregroundStyle(.textSecondary)
                }
                Spacer()
                HStack(spacing: 4) {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(.emerald)
                    Text("\(argument.upvotes)")
                        .font(.lmCaption)
                        .foregroundStyle(.emerald)
                }
            }
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg)
                        .stroke(sideColor.opacity(0.18), lineWidth: 1)
                )
        )
    }
}

// MARK: - Highlight row

private struct HighlightRow: View {
    let highlight: Highlight

    private var icon: String {
        switch highlight.type {
        case "new_law":       return "gavel"
        case "heated_debate": return "flame.fill"
        default:              return "chart.line.uptrend.xyaxis"
        }
    }

    private var iconColor: Color {
        switch highlight.type {
        case "new_law":       return .gold
        case "heated_debate": return .againstRed
        default:              return .forBlue
        }
    }

    private var typeLabel: String {
        switch highlight.type {
        case "new_law":       return "New Law"
        case "heated_debate": return "Heated"
        default:              return "Trending"
        }
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ZStack {
                Circle()
                    .fill(iconColor.opacity(0.12))
                    .frame(width: 34, height: 34)
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(iconColor)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(highlight.statement)
                    .font(.lmHeadline)
                    .foregroundStyle(.white)
                    .lineLimit(2)
                HStack(spacing: 4) {
                    Text(typeLabel)
                        .font(.lmCaption)
                        .foregroundStyle(iconColor)
                    if let cat = highlight.category {
                        Text("·")
                            .font(.lmCaption)
                            .foregroundStyle(.textTertiary)
                        Text(cat)
                            .font(.lmCaption)
                            .foregroundStyle(catColor(highlight.category))
                    }
                    if let pct = highlight.bluePct {
                        Text("·")
                            .font(.lmCaption)
                            .foregroundStyle(.textTertiary)
                        Text("\(Int(pct))% For")
                            .font(.lmCaption)
                            .foregroundStyle(.forBlue)
                    }
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.system(size: 11))
                .foregroundStyle(.textTertiary)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
    }
}

// MARK: - Main view

struct BriefingView: View {
    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    @State private var data: BriefingData?
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var errorMsg: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                if isLoading && !hasLoaded {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(.forBlue)
                } else if let d = data {
                    content(d)
                } else if hasLoaded {
                    notAuthView
                }
            }
            .navigationTitle("Today's Brief")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(.textSecondary)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task { await load() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 14))
                            .foregroundStyle(.textSecondary)
                    }
                }
            }
            .task { if !hasLoaded { await load() } }
            .overlay(alignment: .top) {
                if let err = errorMsg {
                    Text(err)
                        .font(.lmCaption)
                        .foregroundStyle(.againstRed)
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.xs)
                        .background(Color.surface200.opacity(0.95))
                        .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
                        .padding(.top, Spacing.sm)
                }
            }
        }
    }

    // MARK: - Content

    private func content(_ d: BriefingData) -> some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: Spacing.lg) {

                // Greeting header
                greetingHeader(d.profile)

                // Today's progress
                SectionLabel(title: "TODAY'S PROGRESS")
                TodayProgressCard(profile: d.profile)

                // Upcoming debates
                if !d.upcomingDebates.isEmpty {
                    SectionLabel(title: "UPCOMING DEBATES")
                    VStack(spacing: Spacing.xs) {
                        ForEach(d.upcomingDebates.prefix(3)) { debate in
                            DebateCard(debate: debate)
                        }
                    }
                }

                // Featured argument
                if let arg = d.featuredArgument {
                    SectionLabel(title: "ARGUMENT OF THE DAY")
                    FeaturedArgumentCard(argument: arg)
                }

                // Platform highlights
                if !d.highlights.isEmpty {
                    SectionLabel(title: "PLATFORM HIGHLIGHTS")
                    VStack(spacing: 0) {
                        ForEach(Array(d.highlights.prefix(4).enumerated()), id: \.element.id) { idx, hl in
                            HighlightRow(highlight: hl)
                            if idx < min(d.highlights.count, 4) - 1 {
                                Divider()
                                    .background(Color.surface300)
                                    .padding(.leading, Spacing.md + 34 + Spacing.sm)
                            }
                        }
                    }
                    .background(
                        RoundedRectangle(cornerRadius: Radii.lg)
                            .fill(Color.surface200)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.lg)
                                    .stroke(Color.white.opacity(0.06), lineWidth: 1)
                            )
                    )
                }

                // Top category tip
                if let cat = d.topCategory {
                    topCategoryTip(cat)
                }

                Spacer().frame(height: Spacing.xxl)
            }
            .padding(.horizontal, Spacing.md)
            .padding(.top, Spacing.sm)
        }
        .refreshable { await load() }
    }

    private func greetingHeader(_ profile: BriefingProfile) -> some View {
        HStack(spacing: Spacing.sm) {
            VStack(alignment: .leading, spacing: 2) {
                Text(greeting())
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
                Text(profile.displayName ?? profile.username)
                    .font(.lmTitle)
                    .foregroundStyle(.white)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                HStack(spacing: 4) {
                    Image(systemName: "bitcoinsign.circle.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(.gold)
                    Text("\(profile.clout)")
                        .font(.system(size: 14, weight: .heavy, design: .rounded))
                        .foregroundStyle(.gold)
                }
                Text("Clout")
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
            }
        }
        .padding(.top, Spacing.xs)
    }

    private func topCategoryTip(_ cat: String) -> some View {
        HStack(spacing: Spacing.sm) {
            ZStack {
                Circle()
                    .fill(catColor(cat).opacity(0.14))
                    .frame(width: 36, height: 36)
                Image(systemName: "star.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(catColor(cat))
            }
            VStack(alignment: .leading, spacing: 2) {
                Text("Your top category: \(cat)")
                    .font(.lmHeadline)
                    .foregroundStyle(.white)
                Text("Browse more \(cat) topics to boost your expertise score.")
                    .font(.lmCaption)
                    .foregroundStyle(.textSecondary)
            }
        }
        .padding(Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(catColor(cat).opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(catColor(cat).opacity(0.2), lineWidth: 1)
                )
        )
    }

    private var notAuthView: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "person.crop.circle.badge.exclamationmark")
                .font(.system(size: 42))
                .foregroundStyle(.textTertiary)
            Text("Sign in to see your brief")
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Data loading (direct Supabase queries)

    private func load() async {
        guard let uid = auth.currentUserId else {
            hasLoaded = true
            return
        }
        isLoading = true
        errorMsg  = nil

        do {
            // 1. Profile
            var pp = QueryParams()
            pp.select("username,display_name,avatar_url,role,vote_streak,clout,total_votes")
            pp.eq("id", uid)
            pp.limit(1)
            let profiles: [RawProfile] = try await SupabaseClient.shared.get(table: "profiles", params: pp)
            guard let p = profiles.first else {
                hasLoaded = true; isLoading = false; return
            }

            // 2. Today's votes
            let cal = Calendar.current
            let startOfDay = cal.startOfDay(for: Date())
            let isoDay = ISO8601DateFormatter().string(from: startOfDay)
            var vp = QueryParams()
            vp.select("id")
            vp.eq("user_id", uid)
            vp.items.append(URLQueryItem(name: "created_at", value: "gte.\(isoDay)"))
            vp.limit(50)
            let todayVotes: [MinimalRow] = (try? await SupabaseClient.shared.get(table: "votes", params: vp)) ?? []

            // 3. Upcoming debates (next 48 hours, scheduled or live)
            let in48h = Date().addingTimeInterval(48 * 3600)
            let iso48 = ISO8601DateFormatter().string(from: in48h)
            var dp = QueryParams()
            dp.select("id,title,description,type,status,scheduled_at,viewer_count")
            dp.items.append(URLQueryItem(name: "status", value: "in.(scheduled,live)"))
            dp.items.append(URLQueryItem(name: "scheduled_at", value: "lte.\(iso48)"))
            dp.order("scheduled_at", ascending: true)
            dp.limit(5)
            let rawDebates: [RawDebate] = (try? await SupabaseClient.shared.get(table: "debates", params: dp)) ?? []

            // 4. Featured argument — highest upvotes from today
            var ap = QueryParams()
            ap.select("id,topic_id,side,content,upvotes,user_id,created_at")
            ap.items.append(URLQueryItem(name: "created_at", value: "gte.\(isoDay)"))
            ap.order("upvotes", ascending: false)
            ap.limit(1)
            let rawArgs: [RawArgument] = (try? await SupabaseClient.shared.get(table: "arguments", params: ap)) ?? []

            // 5. Trending topics (active, most votes)
            var tp = QueryParams()
            tp.select("id,statement,category,status,blue_pct,total_votes")
            tp.eq("status", "active")
            tp.order("total_votes", ascending: false)
            tp.limit(4)
            let rawTopics: [RawTopic] = (try? await SupabaseClient.shared.get(table: "topics", params: tp)) ?? []

            // ── Assemble BriefingData ──────────────────────────────────────

            let profile = BriefingProfile(
                username: p.username,
                displayName: p.displayName,
                avatarURL: p.avatarURL,
                role: p.role ?? "person",
                voteStreak: p.voteStreak ?? 0,
                clout: p.clout ?? 0,
                dailyVotesUsed: todayVotes.count,
                dailyLimit: 10
            )

            let debates = rawDebates.map { d in
                UpcomingDebate(
                    id: d.id,
                    title: d.title ?? "Untitled",
                    topicStatement: nil,
                    scheduledAt: d.scheduledAt ?? Date(),
                    debateType: d.type ?? "oxford",
                    status: d.status ?? "scheduled",
                    participantCount: 0
                )
            }

            var featured: FeaturedArgument?
            if let a = rawArgs.first {
                featured = FeaturedArgument(
                    id: a.id,
                    topicId: a.topicId ?? "",
                    topicStatement: rawTopics.first(where: { $0.id == a.topicId })?.statement ?? "Topic",
                    category: rawTopics.first(where: { $0.id == a.topicId })?.category,
                    side: a.side ?? "blue",
                    content: a.content ?? "",
                    upvotes: a.upvotes ?? 0,
                    authorUsername: auth.currentUsername ?? "citizen",
                    authorDisplayName: nil
                )
            }

            let highlights = rawTopics.map { t in
                Highlight(
                    type: "trending_topic",
                    topicId: t.id,
                    statement: t.statement ?? "",
                    category: t.category,
                    bluePct: t.bluePct,
                    totalVotes: t.totalVotes
                )
            }

            let topCategory: String? = nil // Could derive from vote history if needed

            data = BriefingData(
                profile: profile,
                upcomingDebates: debates,
                featuredArgument: featured,
                highlights: highlights,
                unreadNotificationCount: 0,
                topCategory: topCategory
            )
            hasLoaded = true
        } catch {
            errorMsg = "Couldn't load briefing"
            hasLoaded = true
        }

        isLoading = false
    }
}

// MARK: - Minimal Supabase row types (decode only what we need)

private struct RawProfile: Decodable {
    let username: String
    let displayName: String?
    let avatarURL: String?
    let role: String?
    let voteStreak: Int?
    let clout: Int?
    let totalVotes: Int?

    enum CodingKeys: String, CodingKey {
        case username
        case displayName = "display_name"
        case avatarURL   = "avatar_url"
        case role
        case voteStreak  = "vote_streak"
        case clout
        case totalVotes  = "total_votes"
    }
}

private struct RawDebate: Decodable {
    let id: String
    let title: String?
    let type: String?
    let status: String?
    let scheduledAt: Date?
    let viewerCount: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case type
        case status
        case scheduledAt = "scheduled_at"
        case viewerCount = "viewer_count"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id          = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        title       = try c.decodeIfPresent(String.self, forKey: .title)
        type        = try c.decodeIfPresent(String.self, forKey: .type)
        status      = try c.decodeIfPresent(String.self, forKey: .status)
        scheduledAt = try? c.decode(Date.self, forKey: .scheduledAt)
        viewerCount = try c.decodeIfPresent(Int.self, forKey: .viewerCount)
    }
}

private struct RawArgument: Decodable {
    let id: String
    let topicId: String?
    let side: String?
    let content: String?
    let upvotes: Int?
    let userId: String?

    enum CodingKeys: String, CodingKey {
        case id
        case topicId = "topic_id"
        case side
        case content
        case upvotes
        case userId  = "user_id"
    }
}

private struct RawTopic: Decodable {
    let id: String
    let statement: String?
    let category: String?
    let status: String?
    let bluePct: Double?
    let totalVotes: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case statement
        case category
        case status
        case bluePct    = "blue_pct"
        case totalVotes = "total_votes"
    }
}

private struct MinimalRow: Decodable {
    let id: String
}

// MARK: - Preview

#Preview {
    BriefingView()
        .environmentObject(AuthService())
}
