//
//  CloutWalletView.swift
//  LobbyMarket
//
//  Native Clout Wallet: balance display, lifetime summary, earning
//  opportunities, and a full transaction ledger with type icons.
//  Navigated to from the CLOUT stat card on ProfileView.
//

import SwiftUI

// MARK: - Earning opportunity model

private struct EarnOpportunity: Identifiable {
    let id = UUID()
    let icon:        String
    let title:       String
    let description: String
    let amount:      String
    let color:       Color
}

private let EARN_OPPORTUNITIES: [EarnOpportunity] = [
    EarnOpportunity(icon: "bolt.fill",         title: "Cast a vote",          description: "Vote on any active topic",          amount: "+1–3",  color: .forBlue),
    EarnOpportunity(icon: "bubble.left.fill",  title: "Post an argument",     description: "Argue FOR or AGAINST a topic",      amount: "+5",    color: .purple),
    EarnOpportunity(icon: "hand.thumbsup.fill",title: "Get upvotes",          description: "Per upvote on your argument",       amount: "+1",    color: .emerald),
    EarnOpportunity(icon: "mic.fill",          title: "Win a debate",         description: "Community votes you the winner",    amount: "+50",   color: .gold),
    EarnOpportunity(icon: "flame.fill",        title: "Voting streak",        description: "Bonus for daily streak (7+ days)",  amount: "+10",   color: .gold),
    EarnOpportunity(icon: "person.badge.plus", title: "Refer a friend",       description: "They sign up and cast first vote",  amount: "+50",   color: .emerald),
    EarnOpportunity(icon: "gavel",             title: "Topic becomes Law",    description: "Authored a topic that passed",      amount: "+100",  color: .gold),
    EarnOpportunity(icon: "rosette",           title: "Earn an achievement",  description: "Unlock any achievement badge",      amount: "+varies", color: .purple),
]

// MARK: - Transaction row

private struct TxRow: View {
    let tx: CloutTransaction

    private var iconColor: Color {
        switch tx.type {
        case .earned:   return .emerald
        case .spent:    return .againstRed
        case .gifted:   return .purple
        case .refunded: return .gold
        }
    }

    var body: some View {
        HStack(spacing: Spacing.sm) {
            ZStack {
                Circle()
                    .fill(iconColor.opacity(0.14))
                    .frame(width: 38, height: 38)
                Image(systemName: tx.type.iconName)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(iconColor)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(tx.reason)
                    .font(.lmHeadline)
                    .foregroundStyle(.textPrimary)
                    .lineLimit(2)
                Text(tx.createdAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
            }
            Spacer()
            Text("\(tx.type.sign)\(tx.amount)")
                .font(.system(size: 16, weight: .heavy, design: .rounded))
                .foregroundStyle(iconColor)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
    }
}

// MARK: - Grouped transactions by day

private struct TransactionDaySection: View {
    let date: Date
    let transactions: [CloutTransaction]

    private var dayLabel: String {
        let cal = Calendar.current
        if cal.isDateInToday(date)     { return "Today" }
        if cal.isDateInYesterday(date) { return "Yesterday" }
        return date.formatted(date: .long, time: .omitted)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(dayLabel)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
                .kerning(0.8)
                .padding(.horizontal, Spacing.md)
                .padding(.top, Spacing.md)
                .padding(.bottom, Spacing.xxs)

            VStack(spacing: 0) {
                ForEach(Array(transactions.enumerated()), id: \.element.id) { idx, tx in
                    TxRow(tx: tx)
                    if idx < transactions.count - 1 {
                        Divider()
                            .background(Color.surface300)
                            .padding(.leading, Spacing.md + 38 + Spacing.sm)
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
            .padding(.horizontal, Spacing.md)
        }
    }
}

// MARK: - Main View

struct CloutWalletView: View {
    @EnvironmentObject var auth: AuthService

    @State private var balance: Int = 0
    @State private var transactions: [CloutTransaction] = []
    @State private var isLoading = false
    @State private var hasLoaded = false
    @State private var errorMsg: String?

    // MARK: Computed stats

    private var totalEarned: Int {
        transactions
            .filter { $0.type == .earned || $0.type == .refunded }
            .reduce(0) { $0 + $1.amount }
    }

    private var totalSpent: Int {
        transactions
            .filter { $0.type == .spent || $0.type == .gifted }
            .reduce(0) { $0 + $1.amount }
    }

    private var grouped: [(Date, [CloutTransaction])] {
        let cal = Calendar.current
        let dict = Dictionary(grouping: transactions) {
            cal.startOfDay(for: $0.createdAt)
        }
        return dict.sorted { $0.key > $1.key }
    }

    // MARK: Body

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            if isLoading && !hasLoaded {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(.gold)
            } else {
                ScrollView(showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: 0) {

                        balanceCard
                            .padding(.horizontal, Spacing.md)
                            .padding(.top, Spacing.md)
                            .padding(.bottom, Spacing.sm)

                        summaryRow
                            .padding(.horizontal, Spacing.md)
                            .padding(.bottom, Spacing.lg)

                        earnSection
                            .padding(.bottom, Spacing.lg)

                        ledgerSection

                        Spacer().frame(height: Spacing.xxl + 60)
                    }
                }
                .refreshable { await load() }
            }
        }
        .navigationTitle("Clout Wallet")
        .navigationBarTitleDisplayMode(.large)
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
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
    }

    // MARK: - Balance card

    private var balanceCard: some View {
        VStack(spacing: Spacing.xs) {
            HStack(spacing: Spacing.sm) {
                ZStack {
                    Circle()
                        .fill(Color.gold.opacity(0.18))
                        .frame(width: 52, height: 52)
                    Image(systemName: "bitcoinsign.circle.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(.gold)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text("CLOUT BALANCE")
                        .font(.system(size: 11, weight: .heavy, design: .monospaced))
                        .foregroundStyle(.textTertiary)
                        .kerning(1.2)
                    Text("\(balance)")
                        .font(.system(size: 42, weight: .heavy, design: .rounded))
                        .foregroundStyle(.white)
                        .contentTransition(.numericText())
                }
                Spacer()
                Image(systemName: "c.circle.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(.gold.opacity(0.5))
            }
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .fill(
                        LinearGradient(
                            colors: [Color.gold.opacity(0.12), Color.surface200],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg)
                            .stroke(Color.gold.opacity(0.25), lineWidth: 1)
                    )
            )
            .shadow(color: Color.gold.opacity(0.15), radius: 16, x: 0, y: 6)
        }
    }

    // MARK: - Summary row

    private var summaryRow: some View {
        HStack(spacing: Spacing.sm) {
            summaryCell(
                label: "EARNED",
                value: totalEarned,
                color: .emerald,
                icon: "arrow.up.circle.fill"
            )
            summaryCell(
                label: "SPENT",
                value: totalSpent,
                color: .againstRed,
                icon: "arrow.down.circle.fill"
            )
            summaryCell(
                label: "TRANSACTIONS",
                value: transactions.count,
                color: .purple,
                icon: "list.bullet.circle.fill"
            )
        }
    }

    private func summaryCell(
        label: String,
        value: Int,
        color: Color,
        icon: String
    ) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(color)
            Text("\(value)")
                .font(.system(size: 18, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
            Text(label)
                .font(.system(size: 9, weight: .heavy, design: .monospaced))
                .kerning(0.8)
                .foregroundStyle(.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(color.opacity(0.18), lineWidth: 1)
                )
        )
    }

    // MARK: - Earning opportunities

    private var earnSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("HOW TO EARN")
                .font(.system(size: 11, weight: .heavy, design: .monospaced))
                .foregroundStyle(.textTertiary)
                .kerning(1.2)
                .padding(.horizontal, Spacing.md)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.sm) {
                    ForEach(EARN_OPPORTUNITIES) { opp in
                        earnCard(opp)
                    }
                }
                .padding(.horizontal, Spacing.md)
            }
        }
    }

    private func earnCard(_ opp: EarnOpportunity) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.sm)
                    .fill(opp.color.opacity(0.14))
                    .frame(width: 36, height: 36)
                Image(systemName: opp.icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(opp.color)
            }
            Text(opp.title)
                .font(.lmHeadline)
                .foregroundStyle(.white)
                .lineLimit(1)
            Text(opp.description)
                .font(.lmCaption)
                .foregroundStyle(.textSecondary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)
            Spacer()
            Text(opp.amount)
                .font(.system(size: 15, weight: .heavy, design: .rounded))
                .foregroundStyle(opp.color)
        }
        .padding(Spacing.sm)
        .frame(width: 140, height: 140)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(opp.color.opacity(0.2), lineWidth: 1)
                )
        )
    }

    // MARK: - Ledger section

    @ViewBuilder
    private var ledgerSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("TRANSACTION HISTORY")
                .font(.system(size: 11, weight: .heavy, design: .monospaced))
                .foregroundStyle(.textTertiary)
                .kerning(1.2)
                .padding(.horizontal, Spacing.md)
                .padding(.bottom, Spacing.xs)

            if transactions.isEmpty && hasLoaded {
                VStack(spacing: Spacing.sm) {
                    Image(systemName: "tray.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(.surface400)
                    Text("No transactions yet")
                        .font(.lmBody)
                        .foregroundStyle(.textTertiary)
                    Text("Start voting and debating to earn Clout.")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.xl)
            } else {
                ForEach(grouped, id: \.0) { date, txs in
                    TransactionDaySection(date: date, transactions: txs)
                }
            }
        }
    }

    // MARK: - Data loading

    private func load() async {
        guard let uid = auth.currentUserId else { return }
        isLoading = true
        errorMsg  = nil

        do {
            async let txFetch: [CloutTransaction] = {
                var p = QueryParams()
                p.select("id,user_id,type,amount,reason,reference_id,reference_type,created_at")
                p.eq("user_id", uid)
                p.order("created_at", ascending: false)
                p.limit(100)
                return try await SupabaseClient.shared.get(table: "clout_transactions", params: p)
            }()

            async let profileFetch: [ProfileBalance] = {
                var p = QueryParams()
                p.select("clout")
                p.eq("id", uid)
                p.limit(1)
                return try await SupabaseClient.shared.get(table: "profiles", params: p)
            }()

            let (txs, profiles) = try await (txFetch, profileFetch)

            withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                transactions = txs
                balance = profiles.first?.clout ?? 0
            }
            hasLoaded = true
        } catch {
            errorMsg = "Couldn't load wallet: \(error.localizedDescription)"
        }

        isLoading = false
    }
}

// MARK: - Minimal profile balance model

private struct ProfileBalance: Decodable {
    let clout: Int?
}

// MARK: - Preview

#Preview {
    NavigationStack {
        CloutWalletView()
            .environmentObject(AuthService())
    }
}
