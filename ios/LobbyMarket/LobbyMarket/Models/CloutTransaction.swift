//
//  CloutTransaction.swift
//  LobbyMarket
//

import Foundation

struct CloutTransaction: Identifiable, Decodable {
    let id: String
    let userId: String
    let type: TransactionType
    let amount: Int
    let reason: String
    let referenceId: String?
    let referenceType: String?
    let createdAt: Date

    enum TransactionType: String, Decodable {
        case earned   = "earned"
        case spent    = "spent"
        case gifted   = "gifted"
        case refunded = "refunded"
    }

    enum CodingKeys: String, CodingKey {
        case id
        case userId       = "user_id"
        case type
        case amount
        case reason
        case referenceId  = "reference_id"
        case referenceType = "reference_type"
        case createdAt    = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id            = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        userId        = try c.decodeIfPresent(String.self, forKey: .userId) ?? ""
        type          = (try? c.decode(TransactionType.self, forKey: .type)) ?? .earned
        amount        = try c.decodeIfPresent(Int.self, forKey: .amount) ?? 0
        reason        = try c.decodeIfPresent(String.self, forKey: .reason) ?? ""
        referenceId   = try c.decodeIfPresent(String.self, forKey: .referenceId)
        referenceType = try c.decodeIfPresent(String.self, forKey: .referenceType)
        createdAt     = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
    }
}

extension CloutTransaction.TransactionType {
    var iconName: String {
        switch self {
        case .earned:   return "plus.circle.fill"
        case .spent:    return "minus.circle.fill"
        case .gifted:   return "gift.fill"
        case .refunded: return "arrow.counterclockwise.circle.fill"
        }
    }

    var color: String { // used as a key into Color extension
        switch self {
        case .earned:   return "emerald"
        case .spent:    return "againstRed"
        case .gifted:   return "purple"
        case .refunded: return "gold"
        }
    }

    var sign: String {
        switch self {
        case .earned, .refunded: return "+"
        case .spent, .gifted:    return "−"
        }
    }
}
