//
//  LeaderboardView.swift
//  LobbyMarket
//
//  Native leaderboard — top citizens ranked by Influence (clout),
//  Civic Duty (votes cast), or Topics Created.
//

import SwiftUI

// MARK: - Metric

enum LeaderboardMetric: String, CaseIterable, Identifiable {
    case influence  = "Influence"
    case civic      = "Civic Duty"
    case topics     = "Topics"

    var id: String { rawValue }

    var systemImage: String {
        switch self {
        case .influence: return "bolt.fill"
        case .civic:     return "checkmark.seal.fill"
        case .topics:    return "flame.fill"
        }
    }

    var color: Color {
        switch self {
        case .influence: return .gold
        case .civic:     return .forBlue
        case .topics:    return .againstRed
        }
    }

    var column: String {
        switch self {
        case .influence: return "clout"
        case .civic:     return "votes_cast"
        case .topics:    return "topics_created"
        }
    }

    func value(for entry: LeaderboardEntry) -> Int {
        switch self {
        case .influence: return entry.clout
        case .civic:     return entry.votesCast
        case .topics:    return entry.topicsCreated
        }
    }

    func label(for entry: LeaderboardEntry) -> String {
        let v = value(for: entry)
        switch self {
        case .influence: return "\(v) clout"
        case .civic:     return "\(v) votes"
        case .topics:    return "\(v) topics"
        }
    }
}

// MARK: - LeaderboardEntry

struct LeaderboardEntry: Identifiable, Codable, Equatable {
    let id: String
    let username: String
    let displayName: String?
    let clout: Int
    let votesCast: Int
    let topicsCreated: Int

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case displayName   = "display_name"
        case clout
        case votesCast     = "votes_cast"
        case topicsCreated = "topics_created"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id             = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        username       = try c.decodeIfPresent(String.self, forKey: .username) ?? "citizen"
        displayName    = try c.decodeIfPresent(String.self, forKey: .displayName)
        clout          = try c.decodeIfPresent(Int.self, forKey: .clout) ?? 0
        votesCast      = try c.decodeIfPresent(Int.self, forKey: .votesCast) ?? 0
        topicsCreated  = try c.decodeIfPresent(Int.self, forKey: .topicsCreated) ?? 0
    }

    // Convenience init for previews / sample data
    init(id: String, username: String, displayName: String? = nil,
         clout: Int = 0, votesCast: Int = 0, topicsCreated: Int = 0) {
        self.id = id; self.username = username; self.displayName = displayName
        self.clout = clout; self.votesCast = votesCast; self.topicsCreated = topicsCreated
    }

    var displayLabel: String { displayName ?? username }

    var initials: String {
        let name = displayName ?? username
        let words = name.split(separator: " ")
        if words.count >= 2 {
            return "\(words[0].first ?? "?")\(words[1].first ?? "?")".uppercased()
        }
        return String((name.first ?? "?")).uppercased()
    }
}

extension LeaderboardEntry {
    static let sampleData: [LeaderboardEntry] = [
        LeaderboardEntry(id: "1", username: "axiom",      displayName: "Axiom Prime",   clout: 4820, votesCast: 312, topicsCreated: 42),
        LeaderboardEntry(id: "2", username: "nullvote",   displayName: "NullVote",       clout: 3950, votesCast: 287, topicsCreated: 31),
        LeaderboardEntry(id: "3", username: "civicmax",   displayName: "Civic Max",      clout: 3110, votesCast: 251, topicsCreated: 28),
        LeaderboardEntry(id: "4", username: "polis99",    displayName: "Polis",          clout: 2780, votesCast: 210, topicsCreated: 19),
        LeaderboardEntry(id: "5", username: "quorum",     displayName: "Quorum",         clout: 2400, votesCast: 198, topicsCreated: 15),
        LeaderboardEntry(id: "6", username: "voxpop",     displayName: "Vox Populi",     clout: 1990, votesCast: 175, topicsCreated: 12),
        LeaderboardEntry(id: "7", username: "bloc_delta", displayName: "Bloc Delta",     clout: 1720, votesCast: 161, topicsCreated: 11),
        LeaderboardEntry(id: "8", username: "tenet_x",   displayName: "Tenet X",        clout: 1540, votesCast: 142, topicsCreated:  9),
    ]
}

// MARK: - Main view

struct LeaderboardView: View {
    @State private var metric: LeaderboardMetric = .influence
    @State private var entries: [LeaderboardEntry] = []
    @State private var loading = false
    @State private var error: String? = nil

    private var top3: [LeaderboardEntry] { Array(entries.prefix(3)) }
    private var rest: [LeaderboardEntry] {
        guard entries.count > 3 else { return [] }
        return Array(entries.dropFirst(3))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                if loading && entries.isEmpty {
                    skeletonView
                } else if let err = error, entries.isEmpty {
                    errorView(err)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 0, pinnedViews: .sectionHeaders) {
                            Section(header: segmentHeader) {
                                if top3.count == 3 {
                                    podiumSection
                                        .padding(.horizontal, Spacing.md)
                                        .padding(.top, Spacing.md)
                                }
                                if !rest.isEmpty {
                                    rankedListSection
                                        .padding(.horizontal, Spacing.md)
                                        .padding(.top, Spacing.md)
                                }
                                Spacer(minLength: 80)
                            }
                        }
                    }
                    .refreshable { await loadLeaderboard() }
                }
            }
            .navigationTitle("Leaderboard")
            .navigationBarTitleDisplayMode(.large)
        }
        .task { await loadLeaderboard() }
    }

    // MARK: - Segment header

    private var segmentHeader: some View {
        HStack(spacing: Spacing.xs) {
            ForEach(LeaderboardMetric.allCases) { m in
                Button {
                    Haptics.selection()
                    withAnimation(.spring(duration: 0.25)) { metric = m }
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: m.systemImage)
                            .font(.system(size: 11, weight: .semibold))
                        Text(m.rawValue)
                            .font(.lmCaption)
                    }
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
                    .background(
                        Capsule()
                            .fill(metric == m ? m.color.opacity(0.2) : Color.surface200)
                            .overlay(
                                Capsule()
                                    .stroke(metric == m ? m.color.opacity(0.5) : Color.white.opacity(0.06), lineWidth: 1)
                            )
                    )
                    .foregroundStyle(metric == m ? m.color : .textSecondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(Color.surface0)
    }

    // MARK: - Podium

    private var podiumSection: some View {
        VStack(spacing: Spacing.md) {
            HStack(alignment: .bottom, spacing: Spacing.sm) {
                // #2 — left
                if top3.count > 1 {
                    podiumColumn(entry: top3[1], rank: 2, height: 90)
                }
                // #1 — center (tallest)
                if !top3.isEmpty {
                    podiumColumn(entry: top3[0], rank: 1, height: 120)
                }
                // #3 — right
                if top3.count > 2 {
                    podiumColumn(entry: top3[2], rank: 3, height: 70)
                }
            }
        }
        .padding(.vertical, Spacing.sm)
    }

    private func podiumColumn(entry: LeaderboardEntry, rank: Int, height: CGFloat) -> some View {
        VStack(spacing: Spacing.xs) {
            // Avatar
            ZStack {
                Circle()
                    .fill(podiumGradient(rank: rank))
                    .frame(width: rank == 1 ? 64 : 52, height: rank == 1 ? 64 : 52)
                    .shadow(color: podiumColor(rank: rank).opacity(0.5), radius: 12, x: 0, y: 4)

                Text(entry.initials)
                    .font(.system(size: rank == 1 ? 22 : 18, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
            }

            // Crown for #1
            if rank == 1 {
                Image(systemName: "crown.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(.gold)
                    .padding(.bottom, -4)
            }

            Text(entry.displayLabel)
                .font(rank == 1 ? .lmHeadline : .lmCaption)
                .foregroundStyle(.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            Text(metric.label(for: entry))
                .font(.lmMono)
                .foregroundStyle(metric.color)

            // Podium base
            RoundedRectangle(cornerRadius: 6)
                .fill(
                    LinearGradient(
                        colors: [podiumColor(rank: rank).opacity(0.25), podiumColor(rank: rank).opacity(0.08)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(podiumColor(rank: rank).opacity(0.3), lineWidth: 1)
                )
                .frame(height: height)
                .overlay(
                    Text("#\(rank)")
                        .font(.system(size: 28, weight: .heavy, design: .rounded))
                        .foregroundStyle(podiumColor(rank: rank).opacity(0.4))
                        .frame(maxHeight: .infinity, alignment: .bottom)
                        .padding(.bottom, Spacing.xs)
                )
        }
        .frame(maxWidth: .infinity)
        .onTapGesture {
            Haptics.impact(.light)
            openProfile(username: entry.username)
        }
    }

    private func podiumColor(rank: Int) -> Color {
        switch rank {
        case 1: return .gold
        case 2: return .surface500
        default: return Color(red: 176/255, green: 100/255, blue: 50/255)  // bronze
        }
    }

    private func podiumGradient(rank: Int) -> LinearGradient {
        switch rank {
        case 1:
            return LinearGradient(colors: [.gold, Color(red: 217/255, green: 119/255, blue: 6/255)],
                                  startPoint: .topLeading, endPoint: .bottomTrailing)
        case 2:
            return LinearGradient(colors: [.surface400, .surface300],
                                  startPoint: .topLeading, endPoint: .bottomTrailing)
        default:
            return LinearGradient(
                colors: [Color(red: 180/255, green: 110/255, blue: 60/255),
                         Color(red: 140/255, green: 80/255, blue: 30/255)],
                startPoint: .topLeading, endPoint: .bottomTrailing)
        }
    }

    // MARK: - Ranked list

    private var rankedListSection: some View {
        VStack(spacing: Spacing.xs) {
            ForEach(Array(rest.enumerated()), id: \.element.id) { idx, entry in
                rankedRow(entry: entry, rank: idx + 4)
            }
        }
    }

    private func rankedRow(entry: LeaderboardEntry, rank: Int) -> some View {
        Button {
            Haptics.impact(.light)
            openProfile(username: entry.username)
        } label: {
            HStack(spacing: Spacing.sm) {
                // Rank number
                Text("\(rank)")
                    .font(.lmMono)
                    .foregroundStyle(.textTertiary)
                    .frame(width: 28, alignment: .trailing)

                // Avatar
                ZStack {
                    Circle()
                        .fill(Color.surface300)
                        .frame(width: 40, height: 40)
                    Text(entry.initials)
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(.textSecondary)
                }

                // Name + stat
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.displayLabel)
                        .font(.lmBodyBold)
                        .foregroundStyle(.textPrimary)
                    Text("@\(entry.username)")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }

                Spacer()

                // Metric value
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(metric.value(for: entry))")
                        .font(.system(size: 18, weight: .heavy, design: .rounded))
                        .foregroundStyle(metric.color)
                    Text(metricUnit)
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.textTertiary)
            }
            .padding(.vertical, Spacing.sm)
            .padding(.horizontal, Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(Color.surface200)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .stroke(Color.white.opacity(0.05), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
    }

    private var metricUnit: String {
        switch metric {
        case .influence: return "clout"
        case .civic:     return "votes"
        case .topics:    return "topics"
        }
    }

    // MARK: - Skeleton

    private var skeletonView: some View {
        VStack(spacing: Spacing.md) {
            // Segment skeleton
            HStack(spacing: Spacing.xs) {
                ForEach(0..<3, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 20)
                        .fill(Color.surface200)
                        .frame(height: 36)
                }
            }
            .padding(.horizontal, Spacing.md)

            // Podium skeleton
            HStack(alignment: .bottom, spacing: Spacing.sm) {
                skeletonPodiumCol(height: 90)
                skeletonPodiumCol(height: 120)
                skeletonPodiumCol(height: 70)
            }
            .padding(.horizontal, Spacing.md)

            // Row skeletons
            VStack(spacing: Spacing.xs) {
                ForEach(0..<5, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: Radii.md)
                        .fill(Color.surface200)
                        .frame(height: 64)
                }
            }
            .padding(.horizontal, Spacing.md)
        }
        .redacted(reason: .placeholder)
        .shimmering()
    }

    private func skeletonPodiumCol(height: CGFloat) -> some View {
        VStack(spacing: Spacing.xs) {
            Circle()
                .fill(Color.surface300)
                .frame(width: 52, height: 52)
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.surface300)
                .frame(height: 10)
            RoundedRectangle(cornerRadius: 4)
                .fill(Color.surface300)
                .frame(height: 8)
            RoundedRectangle(cornerRadius: 6)
                .fill(Color.surface200)
                .frame(height: height)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Error

    private func errorView(_ msg: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 40, weight: .thin))
                .foregroundStyle(.textTertiary)
            Text("Couldn't load leaderboard")
                .font(.lmTitle)
                .foregroundStyle(.textSecondary)
            Text(msg)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
                .multilineTextAlignment(.center)
            Button("Retry") {
                Haptics.impact(.light)
                Task { await loadLeaderboard() }
            }
            .font(.lmBodyBold)
            .foregroundStyle(.forBlue)
        }
        .padding(Spacing.xl)
    }

    // MARK: - Data

    @MainActor
    private func loadLeaderboard() async {
        loading = true
        error = nil
        do {
            let results = try await SupabaseClient.shared.fetchLeaderboard(metric: metric)
            entries = results
        } catch {
            self.error = error.localizedDescription
            if entries.isEmpty { entries = LeaderboardEntry.sampleData }
        }
        loading = false
    }

    private func openProfile(username: String) {
        let urlStr = "\(Config.webURL)/profile/\(username)"
        guard let url = URL(string: urlStr) else { return }
        UIApplication.shared.open(url)
    }
}

// MARK: - Shimmer modifier

private struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    gradient: Gradient(colors: [
                        .clear,
                        .white.opacity(0.04),
                        .clear,
                    ]),
                    startPoint: .init(x: phase - 0.3, y: 0.5),
                    endPoint: .init(x: phase + 0.3, y: 0.5)
                )
                .ignoresSafeArea()
            )
            .onAppear {
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                    phase = 1.3
                }
            }
    }
}

private extension View {
    func shimmering() -> some View {
        modifier(ShimmerModifier())
    }
}

// MARK: - Preview

#Preview {
    LeaderboardView()
}
