//
//  VoteButtonsView.swift
//  LobbyMarket
//
//  Twin FOR / AGAINST buttons with press animation + haptics.
//

import SwiftUI

struct VoteButtonsView: View {
    var currentVote: VoteSide?
    var onVote: (VoteSide) -> Void

    var body: some View {
        HStack(spacing: Spacing.sm) {
            voteButton(.forSide)
            voteButton(.againstSide)
        }
    }

    @ViewBuilder
    private func voteButton(_ side: VoteSide) -> some View {
        let isSelected = currentVote == side
        let disabled = currentVote != nil && !isSelected

        Button {
            Haptics.impact(.medium)
            onVote(side)
        } label: {
            HStack(spacing: Spacing.xs) {
                Image(systemName: side.systemImage)
                    .font(.system(size: 18, weight: .heavy))
                Text(side.label)
                    .font(.lmBodyBold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(.white)
            .background(
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(background(for: side, selected: isSelected))
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md)
                    .stroke(
                        isSelected ? Color.white : Color.white.opacity(0.12),
                        lineWidth: isSelected ? 2 : 1
                    )
            )
            .shadow(
                color: shadowColor(for: side).opacity(isSelected ? 0.6 : 0.3),
                radius: isSelected ? 12 : 6,
                x: 0,
                y: 4
            )
            .scaleEffect(isSelected ? 1.03 : 1.0)
            .opacity(disabled ? 0.45 : 1.0)
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(disabled)
        .animation(.spring(response: 0.35, dampingFraction: 0.6), value: currentVote)
    }

    private func background(for side: VoteSide, selected: Bool) -> LinearGradient {
        switch side {
        case .forSide:
            return LinearGradient(
                colors: selected ? [.forBlue, .forBlueDark] : [.forBlueDark.opacity(0.9), .forBlue.opacity(0.8)],
                startPoint: .top,
                endPoint: .bottom
            )
        case .againstSide:
            return LinearGradient(
                colors: selected ? [.againstRed, .againstRedDark] : [.againstRedDark.opacity(0.9), .againstRed.opacity(0.8)],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }

    private func shadowColor(for side: VoteSide) -> Color {
        side == .forSide ? .forBlue : .againstRed
    }
}

struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: configuration.isPressed)
    }
}

#Preview {
    VStack(spacing: 24) {
        VoteButtonsView(currentVote: nil) { _ in }
        VoteButtonsView(currentVote: .forSide) { _ in }
        VoteButtonsView(currentVote: .againstSide) { _ in }
    }
    .padding()
    .background(Color.surface0)
}
