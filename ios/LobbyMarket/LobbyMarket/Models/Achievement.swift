//
//  Achievement.swift
//  LobbyMarket
//
//  Civic achievement (badge) model.
//

import Foundation
import SwiftUI

// MARK: - AchievementTier

enum AchievementTier: String, Codable, CaseIterable, Comparable {
    case common    = "common"
    case rare      = "rare"
    case epic      = "epic"
    case legendary = "legendary"

    static func < (lhs: AchievementTier, rhs: AchievementTier) -> Bool {
        lhs.rank < rhs.rank
    }

    private var rank: Int {
        switch self {
        case .common:    return 0
        case .rare:      return 1
        case .epic:      return 2
        case .legendary: return 3
        }
    }

    var label: String {
        switch self {
        case .common:    return "Common"
        case .rare:      return "Rare"
        case .epic:      return "Epic"
        case .legendary: return "Legendary"
        }
    }

    var color: Color {
        switch self {
        case .common:    return Color.white.opacity(0.55)
        case .rare:      return Color.forBlue
        case .epic:      return Color.purple
        case .legendary: return Color.gold
        }
    }

    var glowColor: Color {
        switch self {
        case .common:    return Color.white.opacity(0.06)
        case .rare:      return Color.forBlue.opacity(0.15)
        case .epic:      return Color.purple.opacity(0.18)
        case .legendary: return Color.gold.opacity(0.22)
        }
    }

    var borderColor: Color {
        switch self {
        case .common:    return Color.white.opacity(0.08)
        case .rare:      return Color.forBlue.opacity(0.35)
        case .epic:      return Color.purple.opacity(0.40)
        case .legendary: return Color.gold.opacity(0.45)
        }
    }

    var systemImage: String {
        switch self {
        case .common:    return "circle.fill"
        case .rare:      return "star.fill"
        case .epic:      return "hexagon.fill"
        case .legendary: return "crown.fill"
        }
    }
}

// MARK: - Achievement

struct Achievement: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let slug: String
    let name: String
    let description: String
    let icon: String
    let tier: AchievementTier
    let criteriaType: String
    let threshold: Int

    enum CodingKeys: String, CodingKey {
        case id, slug, name, description, icon, tier
        case criteriaType = "criteria_type"
        case threshold
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id            = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        slug          = try c.decodeIfPresent(String.self, forKey: .slug) ?? ""
        name          = try c.decodeIfPresent(String.self, forKey: .name) ?? "Achievement"
        description   = try c.decodeIfPresent(String.self, forKey: .description) ?? ""
        icon          = try c.decodeIfPresent(String.self, forKey: .icon) ?? "trophy"
        tier          = (try? c.decode(AchievementTier.self, forKey: .tier)) ?? .common
        criteriaType  = try c.decodeIfPresent(String.self, forKey: .criteriaType) ?? ""
        threshold     = try c.decodeIfPresent(Int.self, forKey: .threshold) ?? 0
    }

    init(
        id: String = UUID().uuidString,
        slug: String,
        name: String,
        description: String,
        icon: String = "trophy",
        tier: AchievementTier = .common,
        criteriaType: String = "",
        threshold: Int = 0
    ) {
        self.id           = id
        self.slug         = slug
        self.name         = name
        self.description  = description
        self.icon         = icon
        self.tier         = tier
        self.criteriaType = criteriaType
        self.threshold    = threshold
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(slug, forKey: .slug)
        try c.encode(name, forKey: .name)
        try c.encode(description, forKey: .description)
        try c.encode(icon, forKey: .icon)
        try c.encode(tier, forKey: .tier)
        try c.encode(criteriaType, forKey: .criteriaType)
        try c.encode(threshold, forKey: .threshold)
    }

    static func == (lhs: Achievement, rhs: Achievement) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

// MARK: - UserAchievement

struct UserAchievement: Codable {
    let achievementId: String
    let earnedAt: Date

    enum CodingKeys: String, CodingKey {
        case achievementId = "achievement_id"
        case earnedAt      = "earned_at"
    }

    init(from decoder: Decoder) throws {
        let c         = try decoder.container(keyedBy: CodingKeys.self)
        achievementId = try c.decodeIfPresent(String.self, forKey: .achievementId) ?? ""
        earnedAt      = (try? c.decode(Date.self, forKey: .earnedAt)) ?? Date()
    }
}

// MARK: - Sample data

extension Achievement {
    static let sampleData: [Achievement] = [
        Achievement(slug: "first_vote",       name: "Founding Vote",    description: "Cast your first vote",                     icon: "hand.raised",   tier: .common,    criteriaType: "total_votes",    threshold: 1),
        Achievement(slug: "voter_10",         name: "Active Citizen",   description: "Cast 10 votes",                            icon: "checkmark.seal", tier: .common,    criteriaType: "total_votes",    threshold: 10),
        Achievement(slug: "voter_100",        name: "Seasoned Voter",   description: "Cast 100 votes",                           icon: "chart.bar",      tier: .rare,      criteriaType: "total_votes",    threshold: 100),
        Achievement(slug: "voter_500",        name: "Civic Veteran",    description: "Cast 500 votes",                           icon: "star",           tier: .epic,      criteriaType: "total_votes",    threshold: 500),
        Achievement(slug: "first_argument",   name: "First Words",      description: "Post your first argument",                 icon: "text.bubble",    tier: .common,    criteriaType: "total_arguments",threshold: 1),
        Achievement(slug: "streak_7",         name: "Week Warrior",     description: "Vote 7 days in a row",                     icon: "flame",          tier: .rare,      criteriaType: "vote_streak",    threshold: 7),
        Achievement(slug: "streak_30",        name: "Iron Citizen",     description: "Vote 30 days in a row",                    icon: "bolt",           tier: .epic,      criteriaType: "vote_streak",    threshold: 30),
        Achievement(slug: "lawmaker",         name: "Lawmaker",         description: "Help pass your first law",                 icon: "gavel",          tier: .rare,      criteriaType: "laws_authored",  threshold: 1),
        Achievement(slug: "legislator",       name: "Legislator",       description: "Help pass 5 laws",                         icon: "building.columns",tier: .epic,     criteriaType: "laws_authored",  threshold: 5),
        Achievement(slug: "grand_legislator", name: "Grand Legislator", description: "Help pass 10 laws",                        icon: "crown",          tier: .legendary, criteriaType: "laws_authored",  threshold: 10),
    ]
}
