//
//  Theme.swift
//  LobbyMarket
//
//  Typography, spacing, and shared modifiers.
//

import SwiftUI
import UIKit

enum Spacing {
    static let xxs: CGFloat = 4
    static let xs:  CGFloat = 8
    static let sm:  CGFloat = 12
    static let md:  CGFloat = 16
    static let lg:  CGFloat = 24
    static let xl:  CGFloat = 32
    static let xxl: CGFloat = 48
}

enum Radii {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 20
    static let xl: CGFloat = 28
}

extension Font {
    static let lmDisplayLarge = Font.system(size: 34, weight: .heavy, design: .rounded)
    static let lmDisplayMedium = Font.system(size: 28, weight: .bold, design: .rounded)
    static let lmTitle = Font.system(size: 22, weight: .semibold, design: .rounded)
    static let lmBody = Font.system(size: 16, weight: .regular, design: .default)
    static let lmBodyBold = Font.system(size: 16, weight: .semibold, design: .default)
    static let lmCaption = Font.system(size: 12, weight: .medium, design: .default)
    static let lmMono = Font.system(size: 13, weight: .medium, design: .monospaced)
}

struct CardStyle: ViewModifier {
    var padding: CGFloat = Spacing.md
    var cornerRadius: CGFloat = Radii.lg

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(Color.surface200)
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
            )
            .shadow(color: .black.opacity(0.4), radius: 18, x: 0, y: 8)
    }
}

extension View {
    func lmCard(padding: CGFloat = Spacing.md, cornerRadius: CGFloat = Radii.lg) -> some View {
        modifier(CardStyle(padding: padding, cornerRadius: cornerRadius))
    }
}

/// Haptic utility — centralized so we don't sprinkle generators everywhere.
enum Haptics {
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        let gen = UIImpactFeedbackGenerator(style: style)
        gen.impactOccurred()
    }

    static func notify(_ type: UINotificationFeedbackGenerator.FeedbackType = .success) {
        let gen = UINotificationFeedbackGenerator()
        gen.notificationOccurred(type)
    }

    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }
}
