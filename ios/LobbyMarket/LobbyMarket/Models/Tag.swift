//
//  Tag.swift
//  LobbyMarket
//

import Foundation

struct TrendingTag: Identifiable, Hashable {
    let id: String
    let name: String
    let topicCount: Int

    init(name: String, topicCount: Int) {
        self.id = name
        self.name = name
        self.topicCount = topicCount
    }
}
