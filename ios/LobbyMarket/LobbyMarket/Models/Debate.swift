//
//  Debate.swift
//  LobbyMarket
//
//  Debate model — maps to the `debates` table.
//

import Foundation

struct Debate: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let topicId: String
    let creatorId: String
    let type: DebateKind
    let status: DebateStatusKind
    let title: String
    let description: String?
    let scheduledAt: Date
    let startedAt: Date?
    let endedAt: Date?
    let viewerCount: Int
    let blueSway: Int
    let redSway: Int
    let createdAt: Date

    enum DebateKind: String, Codable {
        case quick     = "quick"
        case grand     = "grand"
        case tribunal  = "tribunal"

        var displayName: String {
            switch self {
            case .quick:    return "Quick"
            case .grand:    return "Grand"
            case .tribunal: return "Tribunal"
            }
        }

        var systemImage: String {
            switch self {
            case .quick:    return "bolt.fill"
            case .grand:    return "mic.fill"
            case .tribunal: return "building.columns.fill"
            }
        }

        var accentColor: String {
            switch self {
            case .quick:    return "forBlue"
            case .grand:    return "gold"
            case .tribunal: return "purple"
            }
        }
    }

    enum DebateStatusKind: String, Codable {
        case scheduled  = "scheduled"
        case live       = "live"
        case ended      = "ended"
        case cancelled  = "cancelled"

        var displayName: String {
            switch self {
            case .scheduled: return "Scheduled"
            case .live:      return "Live"
            case .ended:     return "Ended"
            case .cancelled: return "Cancelled"
            }
        }

        var isActive: Bool { self == .live }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case topicId       = "topic_id"
        case creatorId     = "creator_id"
        case type
        case status
        case title
        case description
        case scheduledAt   = "scheduled_at"
        case startedAt     = "started_at"
        case endedAt       = "ended_at"
        case viewerCount   = "viewer_count"
        case blueSway      = "blue_sway"
        case redSway       = "red_sway"
        case createdAt     = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id          = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        topicId     = try c.decodeIfPresent(String.self, forKey: .topicId) ?? ""
        creatorId   = try c.decodeIfPresent(String.self, forKey: .creatorId) ?? ""
        type        = (try? c.decode(DebateKind.self, forKey: .type)) ?? .quick
        status      = (try? c.decode(DebateStatusKind.self, forKey: .status)) ?? .scheduled
        title       = try c.decodeIfPresent(String.self, forKey: .title) ?? "Untitled Debate"
        description = try c.decodeIfPresent(String.self, forKey: .description)
        scheduledAt = (try? c.decode(Date.self, forKey: .scheduledAt)) ?? Date()
        startedAt   = try? c.decode(Date.self, forKey: .startedAt)
        endedAt     = try? c.decode(Date.self, forKey: .endedAt)
        viewerCount = try c.decodeIfPresent(Int.self, forKey: .viewerCount) ?? 0
        blueSway    = try c.decodeIfPresent(Int.self, forKey: .blueSway) ?? 50
        redSway     = try c.decodeIfPresent(Int.self, forKey: .redSway) ?? 50
        createdAt   = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
    }

    init(
        id: String = UUID().uuidString,
        topicId: String = "",
        creatorId: String = "",
        type: DebateKind = .quick,
        status: DebateStatusKind = .scheduled,
        title: String,
        description: String? = nil,
        scheduledAt: Date = Date(),
        startedAt: Date? = nil,
        endedAt: Date? = nil,
        viewerCount: Int = 0,
        blueSway: Int = 50,
        redSway: Int = 50,
        createdAt: Date = Date()
    ) {
        self.id          = id
        self.topicId     = topicId
        self.creatorId   = creatorId
        self.type        = type
        self.status      = status
        self.title       = title
        self.description = description
        self.scheduledAt = scheduledAt
        self.startedAt   = startedAt
        self.endedAt     = endedAt
        self.viewerCount = viewerCount
        self.blueSway    = blueSway
        self.redSway     = redSway
        self.createdAt   = createdAt
    }

    var timeLabel: String {
        switch status {
        case .live:
            return "Live now"
        case .scheduled:
            return "Starts \(relativeScheduledTime)"
        case .ended:
            guard let end = endedAt else { return "Ended" }
            return "Ended \(relativeTime(end))"
        case .cancelled:
            return "Cancelled"
        }
    }

    private var relativeScheduledTime: String {
        let diff = scheduledAt.timeIntervalSinceNow
        if diff < 0 { return "soon" }
        let m = Int(diff / 60)
        let h = m / 60
        let d = h / 24
        if d >= 1 { return "in \(d)d" }
        if h >= 1 { return "in \(h)h" }
        return "in \(m)m"
    }

    private func relativeTime(_ date: Date) -> String {
        let diff = Date().timeIntervalSince(date)
        let h = Int(diff / 3600)
        let d = h / 24
        if d >= 1 { return "\(d)d ago" }
        if h >= 1 { return "\(h)h ago" }
        return "\(Int(diff / 60))m ago"
    }
}

extension Debate {
    static let sampleData: [Debate] = [
        Debate(
            topicId: "1",
            creatorId: "u1",
            type: .grand,
            status: .live,
            title: "UBI: Empower or Enable?",
            description: "A grand debate on Universal Basic Income — does it empower citizens or enable dependency?",
            scheduledAt: Date().addingTimeInterval(-1800),
            startedAt: Date().addingTimeInterval(-1800),
            viewerCount: 312,
            blueSway: 62,
            redSway: 38
        ),
        Debate(
            topicId: "2",
            creatorId: "u2",
            type: .quick,
            status: .scheduled,
            title: "AI Regulation: How Far?",
            description: "Should governments restrict AI development to protect jobs and safety?",
            scheduledAt: Date().addingTimeInterval(3600),
            viewerCount: 0,
            blueSway: 50,
            redSway: 50
        ),
        Debate(
            topicId: "3",
            creatorId: "u3",
            type: .tribunal,
            status: .scheduled,
            title: "Open Borders Tribunal",
            description: "Tribunal debate on whether open borders are compatible with national security.",
            scheduledAt: Date().addingTimeInterval(7200),
            viewerCount: 0,
            blueSway: 50,
            redSway: 50
        ),
        Debate(
            topicId: "4",
            creatorId: "u4",
            type: .quick,
            status: .ended,
            title: "Free Transit Vote",
            description: "Should public transit be free in cities over 500,000 residents?",
            scheduledAt: Date().addingTimeInterval(-86400),
            startedAt: Date().addingTimeInterval(-86400),
            endedAt: Date().addingTimeInterval(-82800),
            viewerCount: 189,
            blueSway: 71,
            redSway: 29
        ),
    ]
}
