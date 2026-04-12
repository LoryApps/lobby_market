//
//  Topic.swift
//  LobbyMarket
//

import Foundation

struct Topic: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let statement: String
    let description: String?
    let category: String?
    let authorId: String?
    let authorName: String?
    let authorAvatar: String?
    let createdAt: Date
    let expiresAt: Date?
    let forVotes: Int
    let againstVotes: Int
    let totalVotes: Int
    let commentCount: Int
    let likeCount: Int
    let isLocked: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case statement
        case description
        case category
        case authorId = "author_id"
        case authorName = "author_name"
        case authorAvatar = "author_avatar"
        case createdAt = "created_at"
        case expiresAt = "expires_at"
        case forVotes = "for_votes"
        case againstVotes = "against_votes"
        case totalVotes = "total_votes"
        case commentCount = "comment_count"
        case likeCount = "like_count"
        case isLocked = "is_locked"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        statement = try c.decodeIfPresent(String.self, forKey: .statement) ?? ""
        description = try c.decodeIfPresent(String.self, forKey: .description)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        authorId = try c.decodeIfPresent(String.self, forKey: .authorId)
        authorName = try c.decodeIfPresent(String.self, forKey: .authorName)
        authorAvatar = try c.decodeIfPresent(String.self, forKey: .authorAvatar)
        createdAt = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
        expiresAt = try? c.decode(Date.self, forKey: .expiresAt)
        forVotes = try c.decodeIfPresent(Int.self, forKey: .forVotes) ?? 0
        againstVotes = try c.decodeIfPresent(Int.self, forKey: .againstVotes) ?? 0
        totalVotes = try c.decodeIfPresent(Int.self, forKey: .totalVotes) ?? 0
        commentCount = try c.decodeIfPresent(Int.self, forKey: .commentCount) ?? 0
        likeCount = try c.decodeIfPresent(Int.self, forKey: .likeCount) ?? 0
        isLocked = try c.decodeIfPresent(Bool.self, forKey: .isLocked) ?? false
    }

    init(
        id: String = UUID().uuidString,
        statement: String,
        description: String? = nil,
        category: String? = nil,
        authorId: String? = nil,
        authorName: String? = nil,
        authorAvatar: String? = nil,
        createdAt: Date = Date(),
        expiresAt: Date? = nil,
        forVotes: Int = 0,
        againstVotes: Int = 0,
        totalVotes: Int = 0,
        commentCount: Int = 0,
        likeCount: Int = 0,
        isLocked: Bool = false
    ) {
        self.id = id
        self.statement = statement
        self.description = description
        self.category = category
        self.authorId = authorId
        self.authorName = authorName
        self.authorAvatar = authorAvatar
        self.createdAt = createdAt
        self.expiresAt = expiresAt
        self.forVotes = forVotes
        self.againstVotes = againstVotes
        self.totalVotes = totalVotes
        self.commentCount = commentCount
        self.likeCount = likeCount
        self.isLocked = isLocked
    }

    /// Percentage (0-100) of votes that are FOR.
    var bluePercentage: Double {
        guard totalVotes > 0 else { return 50.0 }
        return Double(forVotes) / Double(totalVotes) * 100.0
    }

    /// Percentage (0-100) of votes that are AGAINST.
    var redPercentage: Double {
        100.0 - bluePercentage
    }

    var timeRemaining: String {
        guard let expiresAt else { return "Open" }
        let interval = expiresAt.timeIntervalSinceNow
        if interval <= 0 { return "Closed" }
        let hours = Int(interval) / 3600
        if hours >= 24 { return "\(hours / 24)d left" }
        if hours >= 1 { return "\(hours)h left" }
        return "\(Int(interval) / 60)m left"
    }
}

extension Topic {
    static let sampleData: [Topic] = [
        Topic(
            statement: "Every citizen should have a guaranteed universal basic income.",
            description: "A monthly stipend funded by reallocating existing welfare budgets.",
            category: "Economics",
            authorName: "Senator Rho",
            forVotes: 2840,
            againstVotes: 2310,
            totalVotes: 5150,
            commentCount: 482,
            likeCount: 1203
        ),
        Topic(
            statement: "Social media companies must open-source their recommendation algorithms.",
            description: "Full transparency for any platform with >50M daily users.",
            category: "Tech Policy",
            authorName: "Rep. Vega",
            forVotes: 4120,
            againstVotes: 1080,
            totalVotes: 5200,
            commentCount: 612,
            likeCount: 2841
        ),
        Topic(
            statement: "Public transit should be free in every major city.",
            description: "Abolish fares to reduce car dependency and pollution.",
            category: "Transport",
            authorName: "Councillor Ito",
            forVotes: 3210,
            againstVotes: 1980,
            totalVotes: 5190,
            commentCount: 389,
            likeCount: 1720
        )
    ]
}
