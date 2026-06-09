//
//  Argument.swift
//  LobbyMarket
//

import Foundation

// MARK: - ArgumentReply

struct ArgumentReply: Identifiable {
    let id: String
    let argumentId: String
    let topicId: String
    let userId: String
    let content: String
    let createdAt: Date
    let authorUsername: String?
    let authorDisplayName: String?

    var displayName: String {
        authorDisplayName ?? (authorUsername.map { "@\($0)" } ?? "Anonymous")
    }
}

struct Argument: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let topicId: String
    let authorId: String?
    let authorUsername: String?
    let content: String
    let side: ArgumentSide
    let upvotes: Int
    let createdAt: Date

    enum ArgumentSide: String, Codable {
        case blue
        case red
    }

    enum CodingKeys: String, CodingKey {
        case id
        case topicId = "topic_id"
        case authorId = "author_id"
        case authorUsername
        case content
        case side
        case upvotes
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        topicId = try c.decodeIfPresent(String.self, forKey: .topicId) ?? ""
        authorId = try c.decodeIfPresent(String.self, forKey: .authorId)
        authorUsername = try c.decodeIfPresent(String.self, forKey: .authorUsername)
        content = try c.decodeIfPresent(String.self, forKey: .content) ?? ""
        side = (try? c.decode(ArgumentSide.self, forKey: .side)) ?? .blue
        upvotes = try c.decodeIfPresent(Int.self, forKey: .upvotes) ?? 0
        createdAt = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
    }

    init(
        id: String = UUID().uuidString,
        topicId: String,
        authorId: String? = nil,
        authorUsername: String? = nil,
        content: String,
        side: ArgumentSide,
        upvotes: Int = 0,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.topicId = topicId
        self.authorId = authorId
        self.authorUsername = authorUsername
        self.content = content
        self.side = side
        self.upvotes = upvotes
        self.createdAt = createdAt
    }
}

extension Argument {
    static let sampleData: [Argument] = [
        Argument(
            topicId: "sample",
            authorUsername: "senator_rho",
            content: "The evidence clearly shows that this policy would benefit the majority of citizens, particularly in underserved communities that have been historically excluded from economic growth.",
            side: .blue,
            upvotes: 142
        ),
        Argument(
            topicId: "sample",
            authorUsername: "rep_vega",
            content: "The unintended consequences of this proposal have been consistently underestimated. Historical precedent from similar policies demonstrates a pattern of market distortion and long-term economic harm.",
            side: .red,
            upvotes: 89
        ),
        Argument(
            topicId: "sample",
            authorUsername: "councillor_ito",
            content: "This is fundamentally a question of values, not just economics. We must choose what kind of society we want to build for future generations.",
            side: .blue,
            upvotes: 67
        ),
    ]
}
