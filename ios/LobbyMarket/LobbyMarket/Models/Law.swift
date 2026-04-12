//
//  Law.swift
//  LobbyMarket
//

import Foundation

struct Law: Identifiable, Codable, Equatable, Hashable {
    let id: String
    let title: String
    let slug: String
    let summary: String?
    let body: String
    let category: String?
    let tags: [String]
    let linkedLawIds: [String]
    let createdAt: Date
    let updatedAt: Date
    let citations: Int

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case slug
        case summary
        case body
        case category
        case tags
        case linkedLawIds = "linked_law_ids"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case citations
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? "Untitled"
        slug = try c.decodeIfPresent(String.self, forKey: .slug) ?? ""
        summary = try c.decodeIfPresent(String.self, forKey: .summary)
        body = try c.decodeIfPresent(String.self, forKey: .body) ?? ""
        category = try c.decodeIfPresent(String.self, forKey: .category)
        tags = try c.decodeIfPresent([String].self, forKey: .tags) ?? []
        linkedLawIds = try c.decodeIfPresent([String].self, forKey: .linkedLawIds) ?? []
        createdAt = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
        updatedAt = (try? c.decode(Date.self, forKey: .updatedAt)) ?? Date()
        citations = try c.decodeIfPresent(Int.self, forKey: .citations) ?? 0
    }

    init(
        id: String = UUID().uuidString,
        title: String,
        slug: String,
        summary: String? = nil,
        body: String,
        category: String? = nil,
        tags: [String] = [],
        linkedLawIds: [String] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        citations: Int = 0
    ) {
        self.id = id
        self.title = title
        self.slug = slug
        self.summary = summary
        self.body = body
        self.category = category
        self.tags = tags
        self.linkedLawIds = linkedLawIds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.citations = citations
    }
}

extension Law {
    static let sampleData: [Law] = [
        Law(
            title: "Universal Basic Income Act",
            slug: "ubi-act",
            summary: "A framework for nationwide UBI funded by progressive taxation.",
            body: "## Section 1\nEvery citizen over 18 shall receive a monthly stipend...\n\n## Section 2\nFunding comes from a consolidated welfare budget...",
            category: "Economics",
            tags: ["welfare", "income", "economy"],
            citations: 14
        ),
        Law(
            title: "Algorithm Transparency Directive",
            slug: "algo-transparency",
            summary: "Requires platforms >50M DAU to publish recommendation logic.",
            body: "## Purpose\nTo promote public understanding of algorithmic systems...",
            category: "Tech Policy",
            tags: ["algorithms", "transparency", "platforms"],
            citations: 28
        ),
        Law(
            title: "Free Transit Charter",
            slug: "free-transit",
            summary: "Abolishes fares on public transit in qualifying metros.",
            body: "## Article I\nFares are abolished in any metro with >500k residents...",
            category: "Transport",
            tags: ["transit", "urban", "climate"],
            citations: 9
        )
    ]
}
