//
//  VoteBarView.swift
//  LobbyMarket
//
//  Animated FOR/AGAINST proportional bar.
//

import SwiftUI

struct VoteBarView: View {
    let bluePct: Double    // 0-100
    let totalVotes: Int
    var showLabels: Bool = true

    private var redPct: Double { max(0, 100 - bluePct) }

    var body: some View {
        VStack(spacing: Spacing.xs) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    // Red background fills the full bar
                    LinearGradient(
                        colors: [.againstRedDark, .againstRed],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(height: 14)
                    .clipShape(Capsule())

                    // Blue overlay grows from the left
                    LinearGradient(
                        colors: [.forBlue, .forBlueDark],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(
                        width: max(0, geo.size.width * CGFloat(bluePct / 100)),
                        height: 14
                    )
                    .clipShape(Capsule())

                    // Divider glow at the split point
                    Rectangle()
                        .fill(Color.white.opacity(0.85))
                        .frame(
                            width: 2,
                            height: 14
                        )
                        .offset(
                            x: max(0, min(geo.size.width - 2, geo.size.width * CGFloat(bluePct / 100) - 1))
                        )
                        .shadow(color: .white.opacity(0.7), radius: 4)
                }
            }
            .frame(height: 14)
            .animation(.spring(response: 0.6, dampingFraction: 0.72), value: bluePct)

            if showLabels {
                HStack {
                    Label("\(Int(bluePct.rounded()))% FOR", systemImage: "hand.thumbsup.fill")
                        .font(.lmCaption)
                        .foregroundStyle(.forBlue)
                    Spacer()
                    Text("\(formatCount(totalVotes)) votes")
                        .font(.lmCaption)
                        .foregroundStyle(.textSecondary)
                    Spacer()
                    Label("\(Int(redPct.rounded()))% AGAINST", systemImage: "hand.thumbsdown.fill")
                        .font(.lmCaption)
                        .foregroundStyle(.againstRed)
                }
            }
        }
    }

    private func formatCount(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1_000 { return String(format: "%.1fK", Double(n) / 1_000) }
        return "\(n)"
    }
}

#Preview {
    VStack(spacing: 24) {
        VoteBarView(bluePct: 72, totalVotes: 15200)
        VoteBarView(bluePct: 33, totalVotes: 480)
        VoteBarView(bluePct: 51, totalVotes: 9283)
    }
    .padding()
    .background(Color.surface0)
}
