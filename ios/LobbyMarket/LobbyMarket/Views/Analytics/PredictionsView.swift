//
//  PredictionsView.swift
//  LobbyMarket
//
//  Full Prediction Market browser + personal portfolio tracker.
//  Surfaces open markets grouped by crowd confidence (Leading / Contested /
//  Longshots) and the user's own bet history with resolution outcomes.
//
//  Linked from StatsView via "View Prediction Market →" button.
//

import SwiftUI

// MARK: - Local models

private struct MarketRow: Identifiable {
    let id: String
    let statement: String
    let category: String?
    let status: String
    let lawConfidence: Double
    let totalPredictions: Int
    let userBet: UserBetSummary?
}

private struct UserBetSummary {
    let predictedLaw: Bool
    let confidence: Int
    let resolved: Bool
    let correct: Bool?
    let cloutEarned: Int
}

private struct BetRow: Identifiable {
    let id: String
    let topicId: String
    let statement: String
    let category: String?
    let predictedLaw: Bool
    let confidence: Int
    let resolved: Bool
    let correct: Bool?
    let cloutEarned: Int
    let createdAt: Date
}

// MARK: - Decodable helpers

private struct RawPredStats: Decodable {
    let topicId: String
    let totalPredictions: Int
    let lawConfidence: Double
    enum CodingKeys: String, CodingKey {
        case topicId          = "topic_id"
        case totalPredictions = "total_predictions"
        case lawConfidence    = "law_confidence"
    }
}

private struct RawMinTopic: Decodable {
    let id: String
    let statement: String
    let category: String?
    let status: String?
    enum CodingKeys: String, CodingKey { case id, statement, category, status }
}

private struct RawPred: Decodable {
    let id: String
    let topicId: String
    let predictedLaw: Bool
    let confidence: Int
    let resolvedAt: Date?
    let correct: Bool?
    let cloutEarned: Int
    let createdAt: Date
    enum CodingKeys: String, CodingKey {
        case id
        case topicId      = "topic_id"
        case predictedLaw = "predicted_law"
        case confidence
        case resolvedAt   = "resolved_at"
        case correct
        case cloutEarned  = "clout_earned"
        case createdAt    = "created_at"
    }
    init(from decoder: Decoder) throws {
        let c         = try decoder.container(keyedBy: CodingKeys.self)
        id            = try c.decodeIfPresent(String.self, forKey: .id)            ?? UUID().uuidString
        topicId       = try c.decodeIfPresent(String.self, forKey: .topicId)       ?? ""
        predictedLaw  = try c.decodeIfPresent(Bool.self,   forKey: .predictedLaw)  ?? true
        confidence    = try c.decodeIfPresent(Int.self,    forKey: .confidence)    ?? 50
        resolvedAt    = try? c.decode(Date.self, forKey: .resolvedAt)
        correct       = try c.decodeIfPresent(Bool.self,   forKey: .correct)
        cloutEarned   = try c.decodeIfPresent(Int.self,    forKey: .cloutEarned)   ?? 0
        createdAt     = (try? c.decode(Date.self, forKey: .createdAt))             ?? Date()
    }
}

// MARK: - Category config

private struct CatCfg { let icon: String; let color: Color }
private let CAT_CFG: [String: CatCfg] = [
    "Politics":    CatCfg(icon: "building.columns.fill",      color: .forBlue),
    "Economics":   CatCfg(icon: "chart.line.uptrend.xyaxis",  color: .gold),
    "Technology":  CatCfg(icon: "cpu.fill",                   color: .purple),
    "Science":     CatCfg(icon: "flask.fill",                 color: .emerald),
    "Ethics":      CatCfg(icon: "scale.3d",                   color: .againstRed),
    "Philosophy":  CatCfg(icon: "book.fill",                  color: .purple),
    "Culture":     CatCfg(icon: "music.note",                 color: .againstRed),
    "Health":      CatCfg(icon: "heart.fill",                 color: .emerald),
    "Environment": CatCfg(icon: "leaf.fill",                  color: .emerald),
    "Education":   CatCfg(icon: "graduationcap.fill",         color: .gold),
]
private func catCfg(_ id: String?) -> CatCfg {
    CAT_CFG[id ?? ""] ?? CatCfg(icon: "questionmark.circle", color: .white.opacity(0.45))
}

// MARK: - Shimmer

private struct ShimmerMod: ViewModifier {
    @State private var phase: CGFloat = 0
    func body(content: Content) -> some View {
        content.overlay(
            LinearGradient(
                colors: [.clear, Color.white.opacity(0.06), .clear],
                startPoint: .init(x: phase - 0.3, y: 0.5),
                endPoint: .init(x: phase + 0.3, y: 0.5)
            )
        )
        .onAppear {
            withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                phase = 1.3
            }
        }
    }
}
private extension View { func shimmer() -> some View { modifier(ShimmerMod()) } }

// MARK: - Confidence bar

private struct ConfidenceBar: View {
    let value: Double   // 0–100 % law confidence

    private var barColor: Color {
        value >= 65 ? .emerald : value >= 40 ? .gold : .againstRed
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 3).fill(Color.white.opacity(0.07)).frame(height: 6)
                    RoundedRectangle(cornerRadius: 3).fill(barColor.opacity(0.85))
                        .frame(width: max(4, geo.size.width * CGFloat(value / 100)), height: 6)
                }
            }
            .frame(height: 6)
            HStack {
                Text("\(Int(value))% crowd says LAW")
                    .font(.system(size: 10, weight: .heavy, design: .monospaced))
                    .foregroundStyle(barColor)
                Spacer()
            }
        }
    }
}

// MARK: - Section header

private struct SectionHeader: View {
    let icon: String; let label: String; let color: Color; let count: Int
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 12, weight: .semibold)).foregroundStyle(color)
            Text(label).font(.system(size: 12, weight: .heavy)).foregroundStyle(color)
            Spacer()
            Text("\(count)")
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(color.opacity(0.7))
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(Capsule().fill(color.opacity(0.12)))
        }
    }
}

// MARK: - Market row card

private struct MarketCard: View {
    let row: MarketRow
    @EnvironmentObject private var auth: AuthService
    @State private var showSheet = false

    var body: some View {
        let cfg = catCfg(row.category)

        Button { showSheet = true; Haptics.selection() } label: {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack(spacing: 5) {
                    Image(systemName: cfg.icon)
                        .font(.system(size: 10, weight: .semibold)).foregroundStyle(cfg.color)
                    Text((row.category ?? "General").uppercased())
                        .font(.system(size: 10, weight: .heavy)).kerning(0.5).foregroundStyle(cfg.color)
                    Spacer()
                    Text("\(row.totalPredictions) forecasts")
                        .font(.system(size: 10)).foregroundStyle(.textTertiary)
                }
                Text(row.statement)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.textPrimary).lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                ConfidenceBar(value: row.lawConfidence)
                if let bet = row.userBet {
                    HStack(spacing: 4) {
                        Image(systemName: "person.fill")
                            .font(.system(size: 10)).foregroundStyle(.textTertiary)
                        Text("My bet: ")
                            .font(.system(size: 11)).foregroundStyle(.textTertiary)
                        Text(bet.predictedLaw ? "Becomes law" : "Will fail")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(bet.predictedLaw ? .emerald : .againstRed)
                        Text("· \(bet.confidence)% conf.")
                            .font(.system(size: 11)).foregroundStyle(.textTertiary)
                    }
                } else {
                    Text("Tap to place your forecast")
                        .font(.system(size: 11)).italic().foregroundStyle(.textTertiary.opacity(0.65))
                }
            }
            .padding(Spacing.md)
            .background(RoundedRectangle(cornerRadius: 14).fill(Color.surface100))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.white.opacity(0.07), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showSheet) {
            PredictionSheet(topic: Topic(
                id: row.id, statement: row.statement,
                category: row.category, status: row.status
            ))
            .environmentObject(auth)
        }
    }
}

// MARK: - Bet row card

private struct BetCard: View {
    let bet: BetRow
    @EnvironmentObject private var auth: AuthService
    @State private var showSheet = false

    var body: some View {
        let cfg = catCfg(bet.category)

        Button { showSheet = true; Haptics.selection() } label: {
            HStack(alignment: .top, spacing: Spacing.sm) {
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 5) {
                        Image(systemName: cfg.icon)
                            .font(.system(size: 10, weight: .semibold)).foregroundStyle(cfg.color)
                        Text((bet.category ?? "General").uppercased())
                            .font(.system(size: 10, weight: .heavy)).kerning(0.5).foregroundStyle(cfg.color)
                    }
                    Text(bet.statement)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.textPrimary).lineLimit(2)
                    HStack(spacing: 5) {
                        Image(systemName: bet.predictedLaw ? "checkmark.seal.fill" : "xmark.seal.fill")
                            .font(.system(size: 11))
                            .foregroundStyle(bet.predictedLaw ? .emerald : .againstRed)
                        Text(bet.predictedLaw ? "Predict: LAW" : "Predict: FAIL")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(bet.predictedLaw ? .emerald : .againstRed)
                        Text("· \(bet.confidence)% conf.")
                            .font(.system(size: 11)).foregroundStyle(.textTertiary)
                    }
                }
                Spacer()
                outcomeChip
            }
            .padding(Spacing.md)
            .background(RoundedRectangle(cornerRadius: 14).fill(Color.surface100))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.white.opacity(0.07), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showSheet) {
            PredictionSheet(topic: Topic(
                id: bet.topicId, statement: bet.statement,
                category: bet.category
            ))
            .environmentObject(auth)
        }
    }

    @ViewBuilder private var outcomeChip: some View {
        if !bet.resolved {
            Text("PENDING")
                .font(.system(size: 10, weight: .heavy, design: .monospaced))
                .foregroundStyle(.gold).padding(.horizontal, 8).padding(.vertical, 4)
                .background(Capsule().fill(Color.gold.opacity(0.12)))
        } else if bet.correct == true {
            VStack(spacing: 2) {
                Image(systemName: "checkmark.circle.fill").font(.system(size: 18)).foregroundStyle(.emerald)
                if bet.cloutEarned > 0 {
                    Text("+\(bet.cloutEarned)").font(.system(size: 10, weight: .bold)).foregroundStyle(.gold)
                }
            }
        } else {
            Image(systemName: "xmark.circle.fill").font(.system(size: 18)).foregroundStyle(.againstRed.opacity(0.8))
        }
    }
}

// MARK: - Stats banner

private struct StatsBanner: View {
    let stats: PredictionUserStats

    private var accColor: Color {
        guard let a = stats.accuracy else { return .textTertiary }
        return a >= 0.6 ? .emerald : a >= 0.4 ? .gold : .againstRed
    }

    var body: some View {
        VStack(spacing: Spacing.sm) {
            HStack(spacing: 6) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 13, weight: .semibold)).foregroundStyle(.gold)
                Text("Your Forecast Record")
                    .font(.system(size: 13, weight: .heavy)).foregroundStyle(.textPrimary)
                Spacer()
                if let acc = stats.accuracy {
                    Text("\(Int(acc * 100))% accurate")
                        .font(.system(size: 11, weight: .semibold)).foregroundStyle(.emerald)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Capsule().fill(Color.emerald.opacity(0.12)))
                }
            }
            HStack(spacing: 0) {
                cell(value: stats.accuracy.map { "\(Int($0 * 100))%" } ?? "—", label: "Accuracy", color: accColor)
                div
                cell(value: "\(stats.total)",    label: "Total",    color: .textPrimary)
                div
                cell(value: "\(stats.resolved)", label: "Resolved", color: .textPrimary)
                div
                cell(value: "\(stats.correct)",  label: "Correct",  color: .emerald)
            }
            if stats.cloutEarned > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "bolt.fill").font(.system(size: 11)).foregroundStyle(.gold)
                    Text("+\(stats.cloutEarned) clout earned from correct forecasts")
                        .font(.lmCaption).foregroundStyle(.textTertiary)
                }
            }
        }
        .padding(Spacing.md)
        .background(RoundedRectangle(cornerRadius: 14).fill(Color.surface100))
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.gold.opacity(0.18), lineWidth: 1))
    }

    private var div: some View {
        Rectangle().fill(Color.white.opacity(0.07)).frame(width: 1, height: 34)
    }

    private func cell(value: String, label: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.system(size: 18, weight: .heavy, design: .monospaced)).foregroundStyle(color)
            Text(label).font(.system(size: 10)).foregroundStyle(.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Tabs

private enum PTab: String, CaseIterable { case markets = "Markets"; case myBets = "My Bets" }
private enum BFilter: String, CaseIterable { case all = "All"; case pending = "Pending"; case resolved = "Resolved" }

// MARK: - Main view

struct PredictionsView: View {
    @EnvironmentObject var auth: AuthService

    @State private var tab: PTab = .markets
    @State private var bFilter: BFilter = .all
    @State private var isLoading = false
    @State private var hasLoaded = false

    @State private var leading:   [MarketRow] = []
    @State private var contested: [MarketRow] = []
    @State private var longshots: [MarketRow] = []
    @State private var myBets:    [BetRow]    = []
    @State private var userStats: PredictionUserStats?

    private var filteredBets: [BetRow] {
        switch bFilter {
        case .all:      return myBets
        case .pending:  return myBets.filter { !$0.resolved }
        case .resolved: return myBets.filter { $0.resolved }
        }
    }

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            if isLoading && !hasLoaded {
                VStack(spacing: Spacing.md) {
                    ForEach(0..<5, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 14)
                            .fill(Color.surface100).frame(height: 110).shimmer()
                    }
                }
                .padding(.horizontal, Spacing.md).padding(.top, Spacing.sm)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.lg) {
                        if let stats = userStats, stats.total > 0 {
                            StatsBanner(stats: stats)
                                .padding(.horizontal, Spacing.md)
                        }
                        segmentPicker.padding(.horizontal, Spacing.md)
                        if tab == .markets {
                            marketsSection.padding(.horizontal, Spacing.md)
                        } else {
                            betsSection.padding(.horizontal, Spacing.md)
                        }
                        Spacer(minLength: 40)
                    }
                    .padding(.top, Spacing.sm)
                }
                .refreshable { await loadAll() }
            }
        }
        .navigationTitle("Prediction Market")
        .navigationBarTitleDisplayMode(.large)
        .task { if !hasLoaded { await loadAll() } }
    }

    // MARK: Segment picker

    private var segmentPicker: some View {
        HStack(spacing: 0) {
            ForEach(PTab.allCases, id: \.self) { t in
                Button {
                    tab = t; Haptics.selection()
                } label: {
                    Text(t.rawValue)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(tab == t ? .white : .textTertiary)
                        .frame(maxWidth: .infinity).padding(.vertical, 9)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(tab == t ? Color.forBlue.opacity(0.25) : .clear)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(3)
        .background(RoundedRectangle(cornerRadius: 13).fill(Color.surface200))
    }

    // MARK: Markets

    private var marketsSection: some View {
        Group {
            if leading.isEmpty && contested.isEmpty && longshots.isEmpty {
                emptyMarkets
            } else {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    if !leading.isEmpty {
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            SectionHeader(icon: "checkmark.seal.fill", label: "Leading — Likely Law",
                                          color: .emerald, count: leading.count)
                            ForEach(leading) { MarketCard(row: $0) }
                        }
                    }
                    if !contested.isEmpty {
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            SectionHeader(icon: "scale.3d", label: "Contested",
                                          color: .gold, count: contested.count)
                            ForEach(contested) { MarketCard(row: $0) }
                        }
                    }
                    if !longshots.isEmpty {
                        VStack(alignment: .leading, spacing: Spacing.sm) {
                            SectionHeader(icon: "arrow.down.to.line", label: "Longshots",
                                          color: .againstRed, count: longshots.count)
                            ForEach(longshots) { MarketCard(row: $0) }
                        }
                    }
                }
            }
        }
    }

    // MARK: My Bets

    private var betsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            filterChips
            if filteredBets.isEmpty {
                emptyBets
            } else {
                ForEach(filteredBets) { BetCard(bet: $0) }
            }
        }
    }

    private var filterChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.xs) {
                ForEach(BFilter.allCases, id: \.self) { f in
                    Button { bFilter = f; Haptics.selection() } label: {
                        Text(f.rawValue)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(bFilter == f ? .white : .textTertiary)
                            .padding(.horizontal, 14).padding(.vertical, 7)
                            .background(Capsule().fill(bFilter == f ? Color.forBlue.opacity(0.28) : Color.surface200))
                            .overlay(Capsule().strokeBorder(
                                bFilter == f ? Color.forBlue.opacity(0.55) : Color.white.opacity(0.07), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: Empty states

    private var emptyMarkets: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 44)).foregroundStyle(.gold.opacity(0.35))
            Text("No open markets yet").font(.lmTitle).foregroundStyle(.textSecondary)
            Text("Markets appear as topics accumulate forecasts. Open any topic and tap ⚡ to place your first prediction.")
                .font(.lmCaption).foregroundStyle(.textTertiary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 60)
    }

    private var emptyBets: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "tray")
                .font(.system(size: 44)).foregroundStyle(.textTertiary.opacity(0.35))
            Text(bFilter == .all ? "No predictions yet"
                 : "No \(bFilter.rawValue.lowercased()) predictions")
                .font(.lmTitle).foregroundStyle(.textSecondary)
            Text("Open any topic and tap the prediction icon to forecast whether it will become law.")
                .font(.lmCaption).foregroundStyle(.textTertiary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 60)
    }

    // MARK: Data

    private func loadAll() async {
        isLoading = true
        async let m: () = loadMarkets()
        async let b: () = loadBets()
        _ = await (m, b)
        isLoading = false
        hasLoaded = true
    }

    private func loadMarkets() async {
        var q = QueryParams()
        q.select("topic_id,total_predictions,law_confidence")
        q.order("total_predictions")
        q.limit(100)
        let statsList: [RawPredStats] = (try? await SupabaseClient.shared.get(table: "topic_prediction_stats", params: q)) ?? []
        guard !statsList.isEmpty else { return }

        let ids = statsList.map { $0.topicId }
        var tq = QueryParams()
        tq.select("id,statement,category,status")
        tq.inFilter("id", values: ids)
        tq.neq("status", "law")
        tq.neq("status", "failed")
        let topics: [RawMinTopic] = (try? await SupabaseClient.shared.get(table: "topics", params: tq)) ?? []
        let topicMap = Dictionary(uniqueKeysWithValues: topics.map { ($0.id, $0) })

        var predMap: [String: Prediction] = [:]
        if let uid = auth.currentUserId {
            var pq = QueryParams()
            pq.select("id,topic_id,user_id,predicted_law,confidence,resolved_at,correct,brier_score,clout_earned,created_at,updated_at")
            pq.eq("user_id", uid)
            pq.inFilter("topic_id", values: ids)
            let preds: [Prediction] = (try? await SupabaseClient.shared.get(table: "topic_predictions", params: pq)) ?? []
            predMap = Dictionary(uniqueKeysWithValues: preds.map { ($0.topicId, $0) })
        }

        var lead: [MarketRow] = [], cont: [MarketRow] = [], long: [MarketRow] = []
        for s in statsList {
            guard let t = topicMap[s.topicId] else { continue }
            let bet = predMap[s.topicId].map {
                UserBetSummary(predictedLaw: $0.predictedLaw, confidence: $0.confidence,
                               resolved: $0.resolvedAt != nil, correct: $0.correct,
                               cloutEarned: $0.cloutEarned)
            }
            let row = MarketRow(id: s.topicId, statement: t.statement, category: t.category,
                                status: t.status ?? "active", lawConfidence: s.lawConfidence,
                                totalPredictions: s.totalPredictions, userBet: bet)
            if s.lawConfidence >= 65      { lead.append(row) }
            else if s.lawConfidence >= 40 { cont.append(row) }
            else                          { long.append(row) }
        }

        await MainActor.run {
            leading   = lead.sorted { $0.lawConfidence > $1.lawConfidence }
            contested = cont.sorted { abs($0.lawConfidence - 50) < abs($1.lawConfidence - 50) }
            longshots = long.sorted { $0.lawConfidence > $1.lawConfidence }
        }
    }

    private func loadBets() async {
        guard let uid = auth.currentUserId else { return }

        if let stats = try? await SupabaseClient.shared.fetchPredictionUserStats(userId: uid) {
            await MainActor.run { userStats = stats }
        }

        var q = QueryParams()
        q.select("id,topic_id,predicted_law,confidence,resolved_at,correct,brier_score,clout_earned,created_at")
        q.eq("user_id", uid)
        q.order("created_at")
        q.limit(200)
        let preds: [RawPred] = (try? await SupabaseClient.shared.get(table: "topic_predictions", params: q)) ?? []
        guard !preds.isEmpty else { return }

        let ids = Array(Set(preds.map { $0.topicId }))
        var tq = QueryParams()
        tq.select("id,statement,category")
        tq.inFilter("id", values: ids)
        let topics: [RawMinTopic] = (try? await SupabaseClient.shared.get(table: "topics", params: tq)) ?? []
        let topicMap = Dictionary(uniqueKeysWithValues: topics.map { ($0.id, $0) })

        let bets: [BetRow] = preds.compactMap { p in
            guard let t = topicMap[p.topicId] else { return nil }
            return BetRow(id: p.id, topicId: p.topicId, statement: t.statement, category: t.category,
                          predictedLaw: p.predictedLaw, confidence: p.confidence,
                          resolved: p.resolvedAt != nil, correct: p.correct,
                          cloutEarned: p.cloutEarned, createdAt: p.createdAt)
        }
        .sorted { $0.createdAt > $1.createdAt }

        await MainActor.run { myBets = bets }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        PredictionsView()
            .environmentObject(AuthService())
    }
}
