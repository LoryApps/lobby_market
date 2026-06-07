//
//  CoalitionDetailView.swift
//  LobbyMarket
//
//  Full detail sheet for a coalition — description, stats, W/L record,
//  capacity bar, and join/leave controls.
//

import SwiftUI

struct CoalitionDetailView: View {
    let coalition: Coalition
    let isMember: Bool
    let onJoin: () async -> Void
    let onLeave: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isActing = false

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // ── Header ────────────────────────────────────────────
                    VStack(alignment: .leading, spacing: Spacing.sm) {
                        HStack(alignment: .top) {
                            // Avatar placeholder — first two chars of name
                            ZStack {
                                RoundedRectangle(cornerRadius: Radii.md)
                                    .fill(Color.purple.opacity(0.15))
                                    .frame(width: 56, height: 56)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: Radii.md)
                                            .stroke(Color.purple.opacity(0.35), lineWidth: 1)
                                    )
                                Text(String(coalition.name.prefix(2)).uppercased())
                                    .font(.lmTitle)
                                    .foregroundStyle(.purple)
                            }

                            VStack(alignment: .leading, spacing: Spacing.xxs) {
                                Text(coalition.name)
                                    .font(.lmDisplayMedium)
                                    .foregroundStyle(.textPrimary)
                                if isMember {
                                    Label("You're a member", systemImage: "checkmark.circle.fill")
                                        .font(.lmCaption)
                                        .foregroundStyle(.emerald)
                                }
                            }
                            Spacer()
                        }

                        if let desc = coalition.description {
                            Text(desc)
                                .font(.lmBody)
                                .foregroundStyle(.textSecondary)
                        }
                    }
                    .padding(Spacing.md)

                    Divider().background(Color.white.opacity(0.08))

                    // ── Stats grid ────────────────────────────────────────
                    LazyVGrid(
                        columns: [GridItem(.flexible()), GridItem(.flexible())],
                        spacing: Spacing.sm
                    ) {
                        StatCell(
                            icon: "person.2.fill",
                            value: "\(coalition.memberCount)",
                            label: "Members",
                            color: .forBlue
                        )
                        StatCell(
                            icon: "bolt.fill",
                            value: coalition.influenceLabel,
                            label: "Influence",
                            color: .gold
                        )
                        StatCell(
                            icon: "checkmark.seal.fill",
                            value: "\(coalition.wins)",
                            label: "Wins",
                            color: .emerald
                        )
                        StatCell(
                            icon: "xmark.seal.fill",
                            value: "\(coalition.losses)",
                            label: "Losses",
                            color: .againstRed
                        )
                    }
                    .padding(Spacing.md)

                    // ── Win rate bar ──────────────────────────────────────
                    if coalition.totalMatches > 0 {
                        VStack(alignment: .leading, spacing: Spacing.xs) {
                            HStack {
                                Text("Win Rate")
                                    .font(.lmCaption)
                                    .foregroundStyle(.textTertiary)
                                Spacer()
                                Text("\(Int(coalition.winRate * 100))%")
                                    .font(.lmMono)
                                    .foregroundStyle(coalition.winRate >= 0.5 ? .emerald : .againstRed)
                            }
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(Color.surface300)
                                        .frame(height: 6)
                                    RoundedRectangle(cornerRadius: 4)
                                        .fill(coalition.winRate >= 0.5 ? Color.emerald : Color.againstRed)
                                        .frame(width: geo.size.width * coalition.winRate, height: 6)
                                }
                            }
                            .frame(height: 6)
                        }
                        .padding(.horizontal, Spacing.md)
                        .padding(.bottom, Spacing.md)
                    }

                    // ── Capacity bar ──────────────────────────────────────
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        HStack {
                            Text("Capacity")
                                .font(.lmCaption)
                                .foregroundStyle(.textTertiary)
                            Spacer()
                            Text(coalition.memberSlotLabel)
                                .font(.lmMono)
                                .foregroundStyle(.textSecondary)
                        }
                        GeometryReader { geo in
                            let fill = min(
                                CGFloat(coalition.memberCount) / CGFloat(max(coalition.maxMembers, 1)),
                                1.0
                            )
                            ZStack(alignment: .leading) {
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(Color.surface300)
                                    .frame(height: 6)
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(coalition.isFull ? Color.againstRed : Color.purple)
                                    .frame(width: geo.size.width * fill, height: 6)
                            }
                        }
                        .frame(height: 6)
                    }
                    .padding(.horizontal, Spacing.md)
                    .padding(.bottom, Spacing.lg)

                    Divider().background(Color.white.opacity(0.08))

                    // ── Actions ───────────────────────────────────────────
                    VStack(spacing: Spacing.sm) {
                        if isMember {
                            Button {
                                Task {
                                    isActing = true
                                    await onLeave()
                                    isActing = false
                                }
                            } label: {
                                HStack {
                                    if isActing {
                                        ProgressView()
                                            .progressViewStyle(.circular)
                                            .tint(.againstRed)
                                    }
                                    Text(isActing ? "Leaving…" : "Leave Coalition")
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, Spacing.sm)
                                .background(Color.againstRed.opacity(0.12))
                                .foregroundStyle(.againstRed)
                                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radii.md)
                                        .stroke(Color.againstRed.opacity(0.3), lineWidth: 1)
                                )
                            }
                            .disabled(isActing)
                        } else {
                            Button {
                                Task {
                                    isActing = true
                                    await onJoin()
                                    isActing = false
                                }
                            } label: {
                                HStack {
                                    if isActing {
                                        ProgressView()
                                            .progressViewStyle(.circular)
                                            .tint(.white)
                                    }
                                    Text(isActing ? "Joining…" : "Join Coalition")
                                        .font(.lmBodyBold)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, Spacing.sm)
                                .background(coalition.isFull ? Color.surface300 : Color.purple)
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                            }
                            .disabled(coalition.isFull || isActing)

                            if coalition.isFull {
                                Text("This coalition is at full capacity.")
                                    .font(.lmCaption)
                                    .foregroundStyle(.textTertiary)
                                    .frame(maxWidth: .infinity, alignment: .center)
                            }
                        }

                        // Web deep-link
                        Link(destination: URL(string: "https://lobby.market/lobby")!) {
                            HStack {
                                Image(systemName: "safari")
                                Text("View on Lobby Market")
                                    .font(.lmCaption)
                            }
                            .foregroundStyle(.textTertiary)
                        }
                        .padding(.top, Spacing.xxs)
                    }
                    .padding(Spacing.md)
                    .padding(.bottom, Spacing.xl)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .overlay(alignment: .topTrailing) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(Color.surface400)
                    .padding(Spacing.md)
            }
        }
    }
}

// MARK: - StatCell

private struct StatCell: View {
    let icon: String
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 22))
                .foregroundStyle(color)
            Text(value)
                .font(.lmTitle)
                .foregroundStyle(.textPrimary)
            Text(label)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.sm)
        .background(Color.surface200)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(color.opacity(0.15), lineWidth: 1)
        )
    }
}

#Preview {
    CoalitionDetailView(
        coalition: Coalition.sampleData[0],
        isMember: false,
        onJoin: {},
        onLeave: {}
    )
}
