//
//  Colors.swift
//  LobbyMarket
//
//  Lobby Market color system.
//

import SwiftUI

extension Color {
    // MARK: - Vote sides
    static let forBlue        = Color(red: 59/255,  green: 130/255, blue: 246/255) // #3b82f6
    static let forBlueDark    = Color(red: 37/255,  green: 99/255,  blue: 235/255) // #2563eb
    static let againstRed     = Color(red: 239/255, green: 68/255,  blue: 68/255)  // #ef4444
    static let againstRedDark = Color(red: 220/255, green: 38/255,  blue: 38/255)  // #dc2626

    // MARK: - Surfaces
    static let surface0   = Color(red: 10/255, green: 10/255, blue: 15/255)  // #0a0a0f
    static let surface100 = Color(red: 17/255, green: 17/255, blue: 23/255)  // #111117
    static let surface200 = Color(red: 26/255, green: 26/255, blue: 34/255)  // #1a1a22
    static let surface300 = Color(red: 36/255, green: 36/255, blue: 46/255)  // #24242e

    // MARK: - Accents
    static let gold    = Color(red: 245/255, green: 158/255, blue: 11/255) // #f59e0b
    static let emerald = Color(red: 16/255,  green: 185/255, blue: 129/255) // #10b981

    // MARK: - Text
    static let textPrimary   = Color.white
    static let textSecondary = Color.white.opacity(0.66)
    static let textTertiary  = Color.white.opacity(0.42)
}

extension LinearGradient {
    static let forGradient = LinearGradient(
        colors: [.forBlue, .forBlueDark],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let againstGradient = LinearGradient(
        colors: [.againstRed, .againstRedDark],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let surfaceGradient = LinearGradient(
        colors: [.surface100, .surface0],
        startPoint: .top,
        endPoint: .bottom
    )
}
