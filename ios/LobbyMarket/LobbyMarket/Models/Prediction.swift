//
//  Prediction.swift
//  LobbyMarket
//
//  Data models for the prediction market feature.
//

import Foundation

// MARK: - User prediction record

struct Prediction: Identifiable, Codable, Equatable {
    let id: String
    let topicId: String
    let userId: String
    let predictedLaw: Bool
    let confidence: Int        // 1–100
    let resolvedAt: Date?
    let correct: Bool?
    let brierScore: Double?
    let cloutEarned: Int
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case topicId      = "topic_id"
        case userId       = "user_id"
        case predictedLaw = "predicted_law"
        case confidence
        case resolvedAt   = "resolved_at"
        case correct
        case brierScore   = "brier_score"
        case cloutEarned  = "clout_earned"
        case createdAt    = "created_at"
        case updatedAt    = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let c         = try decoder.container(keyedBy: CodingKeys.self)
        id            = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        topicId       = try c.decodeIfPresent(String.self, forKey: .topicId) ?? ""
        userId        = try c.decodeIfPresent(String.self, forKey: .userId) ?? ""
        predictedLaw  = try c.decodeIfPresent(Bool.self, forKey: .predictedLaw) ?? true
        confidence    = try c.decodeIfPresent(Int.self, forKey: .confidence) ?? 50
        resolvedAt    = try? c.decode(Date.self, forKey: .resolvedAt)
        correct       = try c.decodeIfPresent(Bool.self, forKey: .correct)
        brierScore    = try c.decodeIfPresent(Double.self, forKey: .brierScore)
        cloutEarned   = try c.decodeIfPresent(Int.self, forKey: .cloutEarned) ?? 0
        createdAt     = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
        updatedAt     = (try? c.decode(Date.self, forKey: .updatedAt)) ?? Date()
    }
}

// MARK: - Crowd aggregate per topic

struct TopicPredictionStats: Codable {
    let topicId: String
    let totalPredictions: Int
    let lawConfidence: Double    // 0–100, crowd % predicting law

    enum CodingKeys: String, CodingKey {
        case topicId          = "topic_id"
        case totalPredictions = "total_predictions"
        case lawConfidence    = "law_confidence"
    }
}

// MARK: - User prediction stats (for StatsView)

struct PredictionUserStats {
    let total: Int
    let resolved: Int
    let correct: Int
    let accuracy: Double?        // nil if no resolved predictions
    let avgBrier: Double?
    let cloutEarned: Int

    var accuracyPct: String {
        guard let a = accuracy else { return "—" }
        return "\(Int(a * 100))%"
    }
}

// MARK: - Upsert payload

struct UpsertPredictionPayload: Encodable {
    let topic_id: String
    let user_id: String
    let predicted_law: Bool
    let confidence: Int
}
