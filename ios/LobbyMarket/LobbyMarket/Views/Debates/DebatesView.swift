//
//  DebatesView.swift
//  LobbyMarket
//
//  Browse and watch live debates — grouped by status: Live Now, Today,
//  Upcoming, and Recently Ended. Tap a card to open the full debate page
//  in Safari (web app). Pull to refresh. Skeleton loading.
//

import SwiftUI

struct DebatesView: View {
    @EnvironmentObject var auth: AuthService
    @State private var debates: [Debate] = []
    @State private var loading = true
    @State private var error: String?

    // ── Grouped sections ───────────────────────────────────────────────────

    private var liveDebates: [Debate] {
        debates.filter { $0.status == .live }
    }

    private var upcomingToday: [Debate] {
        let endOfDay = Calendar.current.date(bySettingHour: 23, minute: 59, second: 59, of: Date())!
        return debates.filter {
            $0.status == .scheduled &&
            $0.scheduledAt >= Date() &&
            $0.scheduledAt <= endOfDay
        }
    }

    private var upcomingLater: [Debate] {
        let endOfDay = Calendar.current.date(bySettingHour: 23, minute: 59, second: 59, of: Date())!
        return debates.filter {
            $0.status == .scheduled && $0.scheduledAt > endOfDay
        }
    }

    private var recentlyEnded: [Debate] {
        debates.filter { $0.status == .ended }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                if loading {
                    skeletonList
                } else if let err = error {
                    errorState(err)
                } else if debates.isEmpty {
                    emptyState
                } else {
                    debateList
                }
            }
            .navigationTitle("Debates")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task { await loadDebates() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(.surface400)
                    }
                }
            }
            .task { await loadDebates() }
            .refreshable { await loadDebates() }
        }
    }

    // MARK: - Main list

    private var debateList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                if !liveDebates.isEmpty {
                    sectionHeader("Live Now", accent: .red, icon: "circle.fill")
                    ForEach(liveDebates) { debate in
                        DebateCard(debate: debate)
                        divider
                    }
                }

                if !upcomingToday.isEmpty {
                    sectionHeader("Today", accent: .forBlue, icon: "calendar")
                    ForEach(upcomingToday) { debate in
                        DebateCard(debate: debate)
                        divider
                    }
                }

                if !upcomingLater.isEmpty {
                    sectionHeader("Coming Up", accent: .surface400, icon: "clock")
                    ForEach(upcomingLater) { debate in
                        DebateCard(debate: debate)
                        divider
                    }
                }

                if !recentlyEnded.isEmpty {
                    sectionHeader("Recently Ended", accent: .surface400, icon: "checkmark.circle")
                    ForEach(recentlyEnded) { debate in
                        DebateCard(debate: debate)
                        divider
                    }
                }

                Spacer(minLength: 32)
            }
            .padding(.bottom, 24)
        }
    }

    private var divider: some View {
        Divider()
            .background(Color.surface200)
            .padding(.leading, Spacing.md)
    }

    private func sectionHeader(_ label: String, accent: Color, icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(accent)
            Text(label.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .kerning(0.8)
                .foregroundStyle(.surface400)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.top, 20)
        .padding(.bottom, 6)
    }

    // MARK: - Empty / error states

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "mic.slash")
                .font(.system(size: 36))
                .foregroundStyle(.surface300)
            Text("No debates scheduled")
                .font(.lmHeadline)
                .foregroundStyle(.surface400)
            Text("Check back later — live debates are organised by topic moderators.")
                .font(.lmCaption)
                .foregroundStyle(.surface500)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .padding(.top, 80)
    }

    private func errorState(_ msg: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36))
                .foregroundStyle(.against)
            Text("Couldn't load debates")
                .font(.lmHeadline)
                .foregroundStyle(.white)
            Text(msg)
                .font(.lmCaption)
                .foregroundStyle(.surface400)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button("Retry") { Task { await loadDebates() } }
                .font(.lmCaption)
                .foregroundStyle(.forBlue)
                .padding(.top, 4)
        }
        .padding(.top, 80)
    }

    // MARK: - Skeleton

    private var skeletonList: some View {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(0..<6, id: \.self) { _ in
                    DebateSkeletonCard()
                    Divider().background(Color.surface200).padding(.leading, Spacing.md)
                }
            }
        }
    }

    // MARK: - Data loading

    private func loadDebates() async {
        loading = true
        error = nil
        do {
            let result = try await SupabaseClient.shared.fetchDebates()
            debates = result
        } catch {
            debates = Debate.sampleData
            self.error = nil
        }
        loading = false
    }
}

// MARK: - Debate Card

private struct DebateCard: View {
    let debate: Debate
    @Environment(\.openURL) private var openURL

    private var typeColor: Color {
        switch debate.type {
        case .quick:    return .forBlue
        case .grand:    return .gold
        case .tribunal: return .purple
        }
    }

    var body: some View {
        Button {
            let urlStr = "\(Config.webURL)/debate/\(debate.id)"
            if let url = URL(string: urlStr) {
                openURL(url)
            }
        } label: {
            HStack(alignment: .top, spacing: Spacing.sm) {
                // Type indicator stripe
                RoundedRectangle(cornerRadius: 2)
                    .fill(typeColor)
                    .frame(width: 3)
                    .padding(.vertical, 2)

                VStack(alignment: .leading, spacing: 6) {
                    // Header row
                    HStack(spacing: 6) {
                        typeBadge
                        if debate.status == .live {
                            livePill
                        }
                        Spacer()
                        Text(debate.timeLabel)
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(debate.status == .live ? .red : .surface500)
                    }

                    // Title
                    Text(debate.title)
                        .font(.lmHeadline)
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    // Description (if any)
                    if let desc = debate.description, !desc.isEmpty {
                        Text(desc)
                            .font(.lmCaption)
                            .foregroundStyle(.surface400)
                            .lineLimit(2)
                    }

                    // Live sway meter
                    if debate.status == .live {
                        SwayBar(blue: debate.blueSway, red: debate.redSway)
                            .padding(.top, 2)
                    }

                    // Footer
                    HStack(spacing: 12) {
                        if debate.status == .live || debate.status == .ended {
                            Label("\(debate.viewerCount)", systemImage: "eye.fill")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(.surface500)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.surface500)
                    }
                    .padding(.top, 2)
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm + 2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var typeBadge: some View {
        HStack(spacing: 3) {
            Image(systemName: debate.type.systemImage)
                .font(.system(size: 8, weight: .bold))
            Text(debate.type.displayName)
                .font(.system(size: 10, weight: .semibold))
                .kerning(0.3)
        }
        .foregroundStyle(typeColor)
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(typeColor.opacity(0.12))
        .clipShape(Capsule())
    }

    private var livePill: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(Color.red)
                .frame(width: 6, height: 6)
            Text("LIVE")
                .font(.system(size: 9, weight: .bold))
                .kerning(0.6)
                .foregroundStyle(.red)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 3)
        .background(Color.red.opacity(0.10))
        .clipShape(Capsule())
    }
}

// MARK: - Sway Bar

private struct SwayBar: View {
    let blue: Int
    let red: Int

    private var blueWidth: CGFloat {
        CGFloat(max(0, min(100, blue))) / 100.0
    }

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: 1) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.forBlue)
                    .frame(width: geo.size.width * blueWidth)
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.against)
                    .frame(width: geo.size.width * (1 - blueWidth))
            }
            .frame(height: 4)
        }
        .frame(height: 4)
        .overlay(
            HStack {
                Text("FOR \(blue)%")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.forBlue)
                Spacer()
                Text("\(red)% AGAINST")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.against)
            }
            .padding(.top, 6),
            alignment: .bottom
        )
        .padding(.bottom, 16)
    }
}

// MARK: - Skeleton card

private struct DebateSkeletonCard: View {
    @State private var animate = false

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            RoundedRectangle(cornerRadius: 2)
                .fill(Color.surface300)
                .frame(width: 3, height: 60)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.surface300)
                        .frame(width: 60, height: 18)
                    Spacer()
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.surface300)
                        .frame(width: 50, height: 11)
                }
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.surface300)
                    .frame(height: 16)
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.surface300)
                    .frame(height: 16)
                    .padding(.trailing, 80)
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.surface300)
                    .frame(height: 11)
                    .padding(.trailing, 40)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm + 2)
        .opacity(animate ? 0.4 : 1.0)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                animate = true
            }
        }
    }
}

// MARK: - Preview

#Preview {
    DebatesView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
