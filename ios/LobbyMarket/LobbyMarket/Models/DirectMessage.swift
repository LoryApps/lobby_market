//
//  DirectMessage.swift
//  LobbyMarket
//
//  Models for direct messaging: a single message and a conversation thread.
//

import Foundation

// MARK: - Minimal profile used inside DM responses

struct DmProfile: Codable, Identifiable, Equatable, Hashable {
    let id: String
    let username: String
    let displayName: String?
    let avatarURL: String?
    let role: String

    enum CodingKeys: String, CodingKey {
        case id, username, role
        case displayName = "display_name"
        case avatarURL   = "avatar_url"
    }

    init(from decoder: Decoder) throws {
        let c     = try decoder.container(keyedBy: CodingKeys.self)
        id          = try c.decodeIfPresent(String.self, forKey: .id)          ?? UUID().uuidString
        username    = try c.decodeIfPresent(String.self, forKey: .username)    ?? "unknown"
        displayName = try c.decodeIfPresent(String.self, forKey: .displayName)
        avatarURL   = try c.decodeIfPresent(String.self, forKey: .avatarURL)
        role        = try c.decodeIfPresent(String.self, forKey: .role)        ?? "person"
    }

    init(id: String, username: String, displayName: String? = nil,
         avatarURL: String? = nil, role: String = "person") {
        self.id          = id
        self.username    = username
        self.displayName = displayName
        self.avatarURL   = avatarURL
        self.role        = role
    }

    var displayLabel: String { displayName ?? username }
}

// MARK: - Single direct message row

struct DirectMessage: Identifiable, Codable {
    let id: String
    let senderId: String
    let receiverId: String
    let content: String
    let isRead: Bool
    let createdAt: Date
    let sender: DmProfile?
    let receiver: DmProfile?

    enum CodingKeys: String, CodingKey {
        case id, content, sender, receiver
        case senderId   = "sender_id"
        case receiverId = "receiver_id"
        case isRead     = "is_read"
        case createdAt  = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c       = try decoder.container(keyedBy: CodingKeys.self)
        id          = try c.decodeIfPresent(String.self, forKey: .id)         ?? UUID().uuidString
        senderId    = try c.decodeIfPresent(String.self, forKey: .senderId)   ?? ""
        receiverId  = try c.decodeIfPresent(String.self, forKey: .receiverId) ?? ""
        content     = try c.decodeIfPresent(String.self, forKey: .content)    ?? ""
        isRead      = try c.decodeIfPresent(Bool.self,   forKey: .isRead)     ?? false
        createdAt   = (try? c.decode(Date.self, forKey: .createdAt))          ?? Date()
        sender      = try c.decodeIfPresent(DmProfile.self, forKey: .sender)
        receiver    = try c.decodeIfPresent(DmProfile.self, forKey: .receiver)
    }

    init(id: String = UUID().uuidString, senderId: String, receiverId: String,
         content: String, isRead: Bool = false, createdAt: Date = Date(),
         sender: DmProfile? = nil, receiver: DmProfile? = nil) {
        self.id         = id
        self.senderId   = senderId
        self.receiverId = receiverId
        self.content    = content
        self.isRead     = isRead
        self.createdAt  = createdAt
        self.sender     = sender
        self.receiver   = receiver
    }
}

// MARK: - Conversation thread (inbox row)

struct DmConversation: Identifiable, Hashable {
    let partner: DmProfile
    let lastMessage: String
    let lastMessageAt: Date
    let unreadCount: Int
    let lastSenderId: String

    var id: String { partner.id }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: DmConversation, rhs: DmConversation) -> Bool { lhs.id == rhs.id }
}

// MARK: - Sample data for previews

extension DmConversation {
    static let samples: [DmConversation] = [
        DmConversation(
            partner: DmProfile(id: "u1", username: "rep_vega", displayName: "Rep. Vega", role: "elder"),
            lastMessage: "Your argument on UBI was really compelling.",
            lastMessageAt: Date().addingTimeInterval(-600),
            unreadCount: 2,
            lastSenderId: "u1"
        ),
        DmConversation(
            partner: DmProfile(id: "u2", username: "senator_cole", displayName: "Senator Cole", role: "debator"),
            lastMessage: "Want to co-sponsor the climate bill?",
            lastMessageAt: Date().addingTimeInterval(-3600 * 3),
            unreadCount: 0,
            lastSenderId: "me"
        ),
        DmConversation(
            partner: DmProfile(id: "u3", username: "citywatch_72", displayName: nil, role: "person"),
            lastMessage: "Agreed — the floor vote was rigged.",
            lastMessageAt: Date().addingTimeInterval(-86400),
            unreadCount: 0,
            lastSenderId: "u3"
        ),
    ]
}
