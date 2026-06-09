//
//  Coalition.swift
//  LobbyMarket
//

import Foundation

struct Coalition: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let name: String
    let creatorId: String
    let description: String?
    let memberCount: Int
    let coalitionInfluence: Double
    let wins: Int
    let losses: Int
    let isPublic: Bool
    let maxMembers: Int
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case creatorId = "creator_id"
        case description
        case memberCount = "member_count"
        case coalitionInfluence = "coalition_influence"
        case wins
        case losses
        case isPublic = "is_public"
        case maxMembers = "max_members"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? "Unnamed Coalition"
        creatorId = try c.decodeIfPresent(String.self, forKey: .creatorId) ?? ""
        description = try c.decodeIfPresent(String.self, forKey: .description)
        memberCount = try c.decodeIfPresent(Int.self, forKey: .memberCount) ?? 1
        coalitionInfluence = try c.decodeIfPresent(Double.self, forKey: .coalitionInfluence) ?? 0
        wins = try c.decodeIfPresent(Int.self, forKey: .wins) ?? 0
        losses = try c.decodeIfPresent(Int.self, forKey: .losses) ?? 0
        isPublic = try c.decodeIfPresent(Bool.self, forKey: .isPublic) ?? true
        maxMembers = try c.decodeIfPresent(Int.self, forKey: .maxMembers) ?? 100
        createdAt = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
    }

    init(
        id: String = UUID().uuidString,
        name: String,
        creatorId: String = "",
        description: String? = nil,
        memberCount: Int = 1,
        coalitionInfluence: Double = 0,
        wins: Int = 0,
        losses: Int = 0,
        isPublic: Bool = true,
        maxMembers: Int = 100,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.name = name
        self.creatorId = creatorId
        self.description = description
        self.memberCount = memberCount
        self.coalitionInfluence = coalitionInfluence
        self.wins = wins
        self.losses = losses
        self.isPublic = isPublic
        self.maxMembers = maxMembers
        self.createdAt = createdAt
    }

    var totalMatches: Int { wins + losses }

    var winRate: Double {
        guard totalMatches > 0 else { return 0 }
        return Double(wins) / Double(totalMatches)
    }

    var isFull: Bool { memberCount >= maxMembers }

    var memberSlotLabel: String { "\(memberCount)/\(maxMembers)" }

    var influenceLabel: String {
        if coalitionInfluence >= 1000 {
            return String(format: "%.1fK", coalitionInfluence / 1000)
        }
        return String(format: "%.0f", coalitionInfluence)
    }
}

struct CoalitionMembership: Codable {
    let id: String
    let coalitionId: String
    let userId: String
    let role: String
    let joinedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case coalitionId = "coalition_id"
        case userId = "user_id"
        case role
        case joinedAt = "joined_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        coalitionId = try c.decodeIfPresent(String.self, forKey: .coalitionId) ?? ""
        userId = try c.decodeIfPresent(String.self, forKey: .userId) ?? ""
        role = try c.decodeIfPresent(String.self, forKey: .role) ?? "member"
        joinedAt = (try? c.decode(Date.self, forKey: .joinedAt)) ?? Date()
    }
}

// MARK: - Coalition Post

struct CoalitionPost: Identifiable, Codable {
    let id: String
    let coalitionId: String
    let authorId: String
    let content: String
    let isPinned: Bool
    let createdAt: Date

    // Enriched after profile fetch — not in JSON response
    var authorUsername: String?
    var authorDisplayName: String?
    var authorAvatarUrl: String?

    enum CodingKeys: String, CodingKey {
        case id
        case coalitionId = "coalition_id"
        case authorId    = "author_id"
        case content
        case isPinned    = "is_pinned"
        case createdAt   = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id          = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        coalitionId = try c.decodeIfPresent(String.self, forKey: .coalitionId) ?? ""
        authorId    = try c.decodeIfPresent(String.self, forKey: .authorId) ?? ""
        content     = try c.decodeIfPresent(String.self, forKey: .content) ?? ""
        isPinned    = try c.decodeIfPresent(Bool.self, forKey: .isPinned) ?? false
        createdAt   = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
        authorUsername = nil; authorDisplayName = nil; authorAvatarUrl = nil
    }

    init(
        id: String = UUID().uuidString,
        coalitionId: String,
        authorId: String,
        content: String,
        isPinned: Bool = false,
        createdAt: Date = Date(),
        authorUsername: String? = nil,
        authorDisplayName: String? = nil,
        authorAvatarUrl: String? = nil
    ) {
        self.id = id; self.coalitionId = coalitionId; self.authorId = authorId
        self.content = content; self.isPinned = isPinned; self.createdAt = createdAt
        self.authorUsername = authorUsername; self.authorDisplayName = authorDisplayName
        self.authorAvatarUrl = authorAvatarUrl
    }

    var authorName: String { authorDisplayName ?? authorUsername ?? "Member" }
    var authorInitials: String {
        let n = authorName
        let parts = n.split(separator: " ")
        if parts.count >= 2 { return "\(parts[0].prefix(1))\(parts[1].prefix(1))".uppercased() }
        return String(n.prefix(2)).uppercased()
    }
}

// MARK: - Coalition Member Row

struct CoalitionMemberRow: Identifiable, Codable {
    let id: String
    let coalitionId: String
    let userId: String
    let role: String
    let joinedAt: Date

    // Enriched after profile fetch
    var username: String?
    var displayName: String?
    var avatarUrl: String?
    var clout: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case coalitionId = "coalition_id"
        case userId      = "user_id"
        case role
        case joinedAt    = "joined_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id          = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        coalitionId = try c.decodeIfPresent(String.self, forKey: .coalitionId) ?? ""
        userId      = try c.decodeIfPresent(String.self, forKey: .userId) ?? ""
        role        = try c.decodeIfPresent(String.self, forKey: .role) ?? "member"
        joinedAt    = (try? c.decode(Date.self, forKey: .joinedAt)) ?? Date()
        username = nil; displayName = nil; avatarUrl = nil; clout = nil
    }

    init(
        id: String = UUID().uuidString,
        coalitionId: String,
        userId: String,
        role: String = "member",
        joinedAt: Date = Date(),
        username: String? = nil,
        displayName: String? = nil,
        avatarUrl: String? = nil,
        clout: Int? = nil
    ) {
        self.id = id; self.coalitionId = coalitionId; self.userId = userId
        self.role = role; self.joinedAt = joinedAt
        self.username = username; self.displayName = displayName
        self.avatarUrl = avatarUrl; self.clout = clout
    }

    var memberName: String { displayName ?? username ?? "Member" }
    var memberInitials: String {
        let n = memberName
        let parts = n.split(separator: " ")
        if parts.count >= 2 { return "\(parts[0].prefix(1))\(parts[1].prefix(1))".uppercased() }
        return String(n.prefix(2)).uppercased()
    }
    var roleLabel: String {
        switch role {
        case "leader": return "Leader"
        case "officer": return "Officer"
        default: return "Member"
        }
    }
    var roleSortOrder: Int {
        switch role { case "leader": return 0; case "officer": return 1; default: return 2 }
    }
}

extension Coalition {
    static let sampleData: [Coalition] = [
        Coalition(
            name: "Free Market Alliance",
            description: "Advocating for deregulation, free trade, and economic liberty across all policy domains.",
            memberCount: 847,
            coalitionInfluence: 12400,
            wins: 23,
            losses: 8,
            maxMembers: 1000
        ),
        Coalition(
            name: "Climate Action Front",
            description: "Pushing for urgent environmental legislation and carbon-neutral policy at every level of government.",
            memberCount: 1203,
            coalitionInfluence: 18700,
            wins: 31,
            losses: 12,
            maxMembers: 2000
        ),
        Coalition(
            name: "Digital Rights Watch",
            description: "Defending digital privacy, net neutrality, and open-source governance in the technology sector.",
            memberCount: 562,
            coalitionInfluence: 8100,
            wins: 17,
            losses: 6,
            maxMembers: 800
        ),
    ]
}
