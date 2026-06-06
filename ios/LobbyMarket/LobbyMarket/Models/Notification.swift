//
//  Notification.swift
//  LobbyMarket
//

import Foundation

struct LMNotification: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let userId: String
    let type: NotificationKind
    let title: String?
    let body: String?
    let topicId: String?
    let isRead: Bool
    let createdAt: Date

    enum NotificationKind: String, Codable {
        case achievementEarned  = "achievement_earned"
        case debateStarting     = "debate_starting"
        case lawEstablished     = "law_established"
        case topicActivated     = "topic_activated"
        case voteThreshold      = "vote_threshold"
        case replyReceived      = "reply_received"
        case rolePromoted       = "role_promoted"
        case lobbyUpdate        = "lobby_update"
        case newTopicInTag      = "new_topic_in_tag"
        case streakReminder     = "streak_reminder"
        case weeklyDigest       = "weekly_digest"
        case argumentUpvoted    = "argument_upvoted"
        case votePhaseChanged   = "vote_phase_changed"
        case topicBookmarked    = "topic_bookmarked"
        case followReceived     = "follow_received"

        var displayTitle: String {
            switch self {
            case .achievementEarned:  return "Achievement Unlocked"
            case .debateStarting:     return "Debate Starting"
            case .lawEstablished:     return "New Law Established"
            case .topicActivated:     return "Topic Activated"
            case .voteThreshold:      return "Vote Milestone"
            case .replyReceived:      return "New Reply"
            case .rolePromoted:       return "Role Upgrade"
            case .lobbyUpdate:        return "Lobby Update"
            case .newTopicInTag:      return "New Topic"
            case .streakReminder:     return "Streak Reminder"
            case .weeklyDigest:       return "Weekly Digest"
            case .argumentUpvoted:    return "Argument Upvoted"
            case .votePhaseChanged:   return "Status Changed"
            case .topicBookmarked:    return "Topic Bookmarked"
            case .followReceived:     return "New Follower"
            }
        }

        var systemImage: String {
            switch self {
            case .achievementEarned:  return "trophy.fill"
            case .debateStarting:     return "mic.fill"
            case .lawEstablished:     return "building.columns.fill"
            case .topicActivated:     return "bolt.fill"
            case .voteThreshold:      return "chart.bar.fill"
            case .replyReceived:      return "bubble.right.fill"
            case .rolePromoted:       return "star.fill"
            case .lobbyUpdate:        return "building.2.fill"
            case .newTopicInTag:      return "tag.fill"
            case .streakReminder:     return "flame.fill"
            case .weeklyDigest:       return "calendar"
            case .argumentUpvoted:    return "hand.thumbsup.fill"
            case .votePhaseChanged:   return "arrow.triangle.2.circlepath"
            case .topicBookmarked:    return "bookmark.fill"
            case .followReceived:     return "person.badge.plus"
            }
        }

        var accentColor: String {
            switch self {
            case .achievementEarned:  return "gold"
            case .debateStarting:     return "purple"
            case .lawEstablished:     return "emerald"
            case .topicActivated:     return "forBlue"
            case .voteThreshold:      return "forBlue"
            case .replyReceived:      return "purple"
            case .rolePromoted:       return "gold"
            case .lobbyUpdate:        return "forBlue"
            case .newTopicInTag:      return "emerald"
            case .streakReminder:     return "gold"
            case .weeklyDigest:       return "purple"
            case .argumentUpvoted:    return "emerald"
            case .votePhaseChanged:   return "forBlue"
            case .topicBookmarked:    return "gold"
            case .followReceived:     return "forBlue"
            }
        }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userId      = "user_id"
        case type
        case title
        case body
        case topicId     = "topic_id"
        case isRead      = "is_read"
        case createdAt   = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id        = try c.decodeIfPresent(String.self, forKey: .id)       ?? UUID().uuidString
        userId    = try c.decodeIfPresent(String.self, forKey: .userId)   ?? ""
        type      = (try? c.decode(NotificationKind.self, forKey: .type)) ?? .lobbyUpdate
        title     = try c.decodeIfPresent(String.self, forKey: .title)
        body      = try c.decodeIfPresent(String.self, forKey: .body)
        topicId   = try c.decodeIfPresent(String.self, forKey: .topicId)
        isRead    = try c.decodeIfPresent(Bool.self,   forKey: .isRead)   ?? false
        createdAt = (try? c.decode(Date.self,           forKey: .createdAt)) ?? Date()
    }
}

extension LMNotification {
    static let sampleData: [LMNotification] = [
        LMNotification(
            id: "n1", userId: "u1", type: .achievementEarned,
            title: "First Law Supporter",
            body: "You voted on a topic that became law. Civic history made.",
            topicId: nil, isRead: false, createdAt: Date().addingTimeInterval(-300)
        ),
        LMNotification(
            id: "n2", userId: "u1", type: .replyReceived,
            title: "New Reply",
            body: "rep_vega replied to your argument on Universal Basic Income.",
            topicId: "t1", isRead: false, createdAt: Date().addingTimeInterval(-3600)
        ),
        LMNotification(
            id: "n3", userId: "u1", type: .lawEstablished,
            title: "Law Established",
            body: "Climate Emergency Declaration has reached consensus and become law.",
            topicId: "t2", isRead: true, createdAt: Date().addingTimeInterval(-86400)
        ),
        LMNotification(
            id: "n4", userId: "u1", type: .streakReminder,
            title: "Streak at Risk",
            body: "You haven't voted today. Cast your vote to keep your 7-day streak alive.",
            topicId: nil, isRead: true, createdAt: Date().addingTimeInterval(-172800)
        ),
    ]

    init(
        id: String = UUID().uuidString,
        userId: String,
        type: NotificationKind,
        title: String?,
        body: String?,
        topicId: String?,
        isRead: Bool,
        createdAt: Date
    ) {
        self.id        = id
        self.userId    = userId
        self.type      = type
        self.title     = title
        self.body      = body
        self.topicId   = topicId
        self.isRead    = isRead
        self.createdAt = createdAt
    }
}
