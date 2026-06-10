//
//  Profile.swift
//  LobbyMarket
//

import Foundation

struct Profile: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let username: String
    let displayName: String?
    let avatarURL: String?
    let bio: String?
    let joinedAt: Date
    let topicsCreated: Int
    let votesCast: Int
    let reputation: Int
    let clout: Int
    let role: String
    let followersCount: Int
    let followingCount: Int

    enum CodingKeys: String, CodingKey {
        case id
        case username
        case displayName = "display_name"
        case avatarURL = "avatar_url"
        case bio
        case joinedAt = "joined_at"
        case topicsCreated = "topics_created"
        case votesCast = "votes_cast"
        case reputation
        case clout
        case role
        case followersCount = "followers_count"
        case followingCount = "following_count"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        username = try c.decodeIfPresent(String.self, forKey: .username) ?? "anonymous"
        displayName = try c.decodeIfPresent(String.self, forKey: .displayName)
        avatarURL = try c.decodeIfPresent(String.self, forKey: .avatarURL)
        bio = try c.decodeIfPresent(String.self, forKey: .bio)
        joinedAt = (try? c.decode(Date.self, forKey: .joinedAt)) ?? Date()
        topicsCreated = try c.decodeIfPresent(Int.self, forKey: .topicsCreated) ?? 0
        votesCast = try c.decodeIfPresent(Int.self, forKey: .votesCast) ?? 0
        reputation = try c.decodeIfPresent(Int.self, forKey: .reputation) ?? 0
        clout = try c.decodeIfPresent(Int.self, forKey: .clout) ?? 0
        role = try c.decodeIfPresent(String.self, forKey: .role) ?? "person"
        followersCount = try c.decodeIfPresent(Int.self, forKey: .followersCount) ?? 0
        followingCount = try c.decodeIfPresent(Int.self, forKey: .followingCount) ?? 0
    }

    init(
        id: String = UUID().uuidString,
        username: String,
        displayName: String? = nil,
        avatarURL: String? = nil,
        bio: String? = nil,
        joinedAt: Date = Date(),
        topicsCreated: Int = 0,
        votesCast: Int = 0,
        reputation: Int = 0,
        clout: Int = 0,
        role: String = "person",
        followersCount: Int = 0,
        followingCount: Int = 0
    ) {
        self.id = id
        self.username = username
        self.displayName = displayName
        self.avatarURL = avatarURL
        self.bio = bio
        self.joinedAt = joinedAt
        self.topicsCreated = topicsCreated
        self.votesCast = votesCast
        self.reputation = reputation
        self.clout = clout
        self.role = role
        self.followersCount = followersCount
        self.followingCount = followingCount
    }
}

extension Profile {
    static let placeholder = Profile(
        username: "citizen",
        displayName: "Guest",
        bio: "Sign in to cast your vote.",
        topicsCreated: 0,
        votesCast: 0,
        reputation: 0
    )
}
