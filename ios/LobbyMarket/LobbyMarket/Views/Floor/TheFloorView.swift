//
//  TheFloorView.swift
//  LobbyMarket
//
//  The signature "isometric chamber" visualization of live vote distribution.
//

import SwiftUI

struct TheFloorView: View {
    @EnvironmentObject var realtime: RealtimeService

    @State private var seats: [Seat] = ChamberLayout.generateSeats()
    @State private var topics: [Topic] = []
    @State private var selectedIndex: Int = 0
    @State private var isLoading: Bool = false
    @State private var errorMessage: String?

    private var currentTopic: Topic? {
        guard topics.indices.contains(selectedIndex) else { return nil }
        return topics[selectedIndex]
    }

    private var bluePct: Double {
        if let topic = currentTopic {
            if let tally = realtime.tallies[topic.id] {
                return tally.bluePercentage
            }
            return topic.bluePercentage
        }
        return 50
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                VStack(spacing: Spacing.md) {
                    header
                    topicCarousel
                    chamber
                    stats
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, Spacing.md)
                .padding(.top, Spacing.xs)
            }
            .navigationBarHidden(true)
        }
        .task {
            if topics.isEmpty { await load() }
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("THE FLOOR")
                    .font(.system(size: 14, weight: .heavy, design: .rounded))
                    .kerning(1.8)
                    .foregroundStyle(.gold)
                Text("Live parliamentary chamber")
                    .font(.lmCaption)
                    .foregroundStyle(.textSecondary)
            }
            Spacer()
            Button {
                Task { await load() }
            } label: {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Color.surface200))
            }
        }
        .padding(.top, Spacing.sm)
    }

    // MARK: - Topic carousel

    private var topicCarousel: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.xs) {
                ForEach(Array(topics.enumerated()), id: \.element.id) { index, topic in
                    Button {
                        withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                            selectedIndex = index
                        }
                        Haptics.selection()
                        realtime.subscribe(topicId: topic.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(topic.category?.uppercased() ?? "GENERAL")
                                .font(.system(size: 9, weight: .heavy))
                                .kerning(0.8)
                                .foregroundStyle(.textSecondary)
                            Text(topic.statement)
                                .font(.system(size: 13, weight: .semibold))
                                .lineLimit(2)
                                .foregroundStyle(.white)
                                .multilineTextAlignment(.leading)
                        }
                        .frame(width: 180, alignment: .leading)
                        .padding(Spacing.sm)
                        .background(
                            RoundedRectangle(cornerRadius: Radii.md)
                                .fill(selectedIndex == index ? Color.surface300 : Color.surface200)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radii.md)
                                        .stroke(
                                            selectedIndex == index ? Color.gold.opacity(0.7) : Color.white.opacity(0.08),
                                            lineWidth: selectedIndex == index ? 1.5 : 1
                                        )
                                )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
    }

    // MARK: - Chamber

    private var chamber: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Radii.lg)
                .fill(Color.surface100)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )

            ChamberCanvas(seats: seats, bluePct: bluePct)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))

            // Corner labels
            VStack {
                HStack {
                    cornerBadge("FOR", color: .forBlue)
                    Spacer()
                    cornerBadge("AGAINST", color: .againstRed)
                }
                Spacer()
            }
            .padding(Spacing.sm)

            if let topic = currentTopic {
                VStack {
                    Spacer()
                    Text(topic.statement)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.textSecondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, Spacing.md)
                        .padding(.bottom, Spacing.sm)
                }
            }
        }
        .frame(height: 400)
        .animation(.spring(response: 0.7, dampingFraction: 0.85), value: bluePct)
    }

    private func cornerBadge(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .heavy))
            .kerning(1.0)
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Capsule().fill(color.opacity(0.85)))
    }

    // MARK: - Stats

    private var stats: some View {
        HStack(spacing: Spacing.sm) {
            statPill(
                title: "FOR",
                value: "\(Int(bluePct.rounded()))%",
                subtitle: "\(formatCount(currentTopic?.forVotes ?? 0))",
                color: .forBlue
            )
            statPill(
                title: "TOTAL",
                value: "\(seats.count)",
                subtitle: "seats",
                color: .gold
            )
            statPill(
                title: "AGAINST",
                value: "\(Int((100 - bluePct).rounded()))%",
                subtitle: "\(formatCount(currentTopic?.againstVotes ?? 0))",
                color: .againstRed
            )
        }
    }

    private func statPill(title: String, value: String, subtitle: String, color: Color) -> some View {
        VStack(spacing: 2) {
            Text(title)
                .font(.system(size: 10, weight: .heavy))
                .kerning(1.0)
                .foregroundStyle(color)
            Text(value)
                .font(.system(size: 22, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
            Text(subtitle)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(color.opacity(0.3), lineWidth: 1)
                )
        )
    }

    // MARK: - Data

    private func load() async {
        isLoading = true
        errorMessage = nil
        do {
            let list = try await SupabaseClient.shared.fetchTopics(limit: 20, offset: 0)
            topics = list.isEmpty ? Topic.sampleData : list
            if let first = topics.first { realtime.subscribe(topicId: first.id) }
        } catch {
            errorMessage = error.localizedDescription
            topics = Topic.sampleData
        }
        isLoading = false
    }

    private func formatCount(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1_000 { return String(format: "%.1fK", Double(n) / 1_000) }
        return "\(n)"
    }
}

#Preview {
    TheFloorView()
        .environmentObject(RealtimeService())
}
