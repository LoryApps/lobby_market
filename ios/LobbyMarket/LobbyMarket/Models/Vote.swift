//
//  Vote.swift
//  LobbyMarket
//

import Foundation

enum VoteSide: String, Codable, CaseIterable, Identifiable {
    case forSide = "for"
    case againstSide = "against"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .forSide: return "FOR"
        case .againstSide: return "AGAINST"
        }
    }

    var systemImage: String {
        switch self {
        case .forSide: return "hand.thumbsup.fill"
        case .againstSide: return "hand.thumbsdown.fill"
        }
    }
}

struct Vote: Identifiable, Codable, Equatable {
    let id: String
    let topicId: String
    let userId: String
    let side: VoteSide
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case topicId = "topic_id"
        case userId = "user_id"
        case side
        case createdAt = "created_at"
    }

    init(
        id: String = UUID().uuidString,
        topicId: String,
        userId: String,
        side: VoteSide,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.topicId = topicId
        self.userId = userId
        self.side = side
        self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        topicId = try c.decode(String.self, forKey: .topicId)
        userId = try c.decode(String.self, forKey: .userId)
        side = try c.decode(VoteSide.self, forKey: .side)
        createdAt = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
    }
}

/// Live aggregate delivered over Realtime.
struct VoteTally: Codable, Equatable {
    let topicId: String
    let forVotes: Int
    let againstVotes: Int

    var total: Int { forVotes + againstVotes }
    var bluePercentage: Double {
        guard total > 0 else { return 50.0 }
        return Double(forVotes) / Double(total) * 100.0
    }
}
