//
//  SupabaseClient.swift
//  LobbyMarket
//
//  URLSession-based Supabase REST client.
//

import Foundation

/// Errors thrown by the Supabase client.
enum SupabaseError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpStatus(Int, String?)
    case decoding(Error)
    case encoding(Error)
    case network(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL."
        case .invalidResponse: return "Invalid server response."
        case .httpStatus(let code, let msg): return "HTTP \(code): \(msg ?? "no body")"
        case .decoding(let e): return "Decoding failed: \(e.localizedDescription)"
        case .encoding(let e): return "Encoding failed: \(e.localizedDescription)"
        case .network(let e): return "Network: \(e.localizedDescription)"
        }
    }
}

/// PostgREST query params — a lightweight builder.
struct QueryParams {
    private var items: [URLQueryItem] = []

    mutating func select(_ columns: String) { items.append(.init(name: "select", value: columns)) }
    mutating func eq(_ column: String, _ value: String) {
        items.append(.init(name: column, value: "eq.\(value)"))
    }
    mutating func order(_ column: String, ascending: Bool = false) {
        items.append(.init(name: "order", value: "\(column).\(ascending ? "asc" : "desc")"))
    }
    mutating func limit(_ n: Int) { items.append(.init(name: "limit", value: "\(n)")) }
    mutating func offset(_ n: Int) { items.append(.init(name: "offset", value: "\(n)")) }
    mutating func ilike(_ column: String, _ pattern: String) {
        items.append(.init(name: column, value: "ilike.\(pattern)"))
    }

    var queryItems: [URLQueryItem] { items }
}

/// Shared URLSession-based client for Supabase REST + Auth endpoints.
final class SupabaseClient {
    static let shared = SupabaseClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    /// Optional bearer token from AuthService.
    var accessToken: String?

    init(session: URLSession = .shared) {
        self.session = session

        let dec = JSONDecoder()
        let df = ISO8601DateFormatter()
        df.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let dfNoFrac = ISO8601DateFormatter()
        dfNoFrac.formatOptions = [.withInternetDateTime]
        dec.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let str = try container.decode(String.self)
            if let d = df.date(from: str) { return d }
            if let d = dfNoFrac.date(from: str) { return d }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid ISO8601 date: \(str)"
            )
        }
        self.decoder = dec

        let enc = JSONEncoder()
        enc.dateEncodingStrategy = .iso8601
        self.encoder = enc
    }

    // MARK: - Request building

    private func buildRequest(
        method: String,
        path: String,
        base: URL = Config.restURL,
        query: QueryParams? = nil,
        body: Data? = nil,
        preferReturn: Bool = false
    ) throws -> URLRequest {
        guard var components = URLComponents(
            url: base.appendingPathComponent(path),
            resolvingAgainstBaseURL: false
        ) else {
            throw SupabaseError.invalidURL
        }
        if let query, !query.queryItems.isEmpty {
            components.queryItems = query.queryItems
        }
        guard let url = components.url else { throw SupabaseError.invalidURL }

        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(Config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        let bearer = accessToken ?? Config.supabaseAnonKey
        req.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if preferReturn {
            req.setValue("return=representation", forHTTPHeaderField: "Prefer")
        }
        req.httpBody = body
        return req
    }

    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw SupabaseError.invalidResponse
            }
            guard (200..<300).contains(http.statusCode) else {
                let body = String(data: data, encoding: .utf8)
                throw SupabaseError.httpStatus(http.statusCode, body)
            }
            if T.self == EmptyResponse.self {
                return EmptyResponse() as! T
            }
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw SupabaseError.decoding(error)
            }
        } catch let e as SupabaseError {
            throw e
        } catch {
            throw SupabaseError.network(error)
        }
    }

    // MARK: - Topics

    func fetchTopics(limit: Int = Config.feedPageSize, offset: Int = 0) async throws -> [Topic] {
        var q = QueryParams()
        q.select("*")
        q.order("created_at", ascending: false)
        q.limit(limit)
        q.offset(offset)
        let req = try buildRequest(method: "GET", path: "topics", query: q)
        do {
            return try await execute(req)
        } catch {
            // Graceful fallback: if the table isn't accessible, return local samples.
            return Topic.sampleData
        }
    }

    func fetchTopic(id: String) async throws -> Topic? {
        var q = QueryParams()
        q.select("*")
        q.eq("id", id)
        q.limit(1)
        let req = try buildRequest(method: "GET", path: "topics", query: q)
        let list: [Topic] = try await execute(req)
        return list.first
    }

    func createTopic(_ payload: NewTopicPayload) async throws -> Topic {
        let data: Data
        do { data = try encoder.encode(payload) }
        catch { throw SupabaseError.encoding(error) }

        let req = try buildRequest(
            method: "POST",
            path: "topics",
            body: data,
            preferReturn: true
        )
        let created: [Topic] = try await execute(req)
        guard let topic = created.first else {
            throw SupabaseError.invalidResponse
        }
        return topic
    }

    // MARK: - Votes

    func castVote(topicId: String, side: VoteSide, userId: String) async throws {
        struct Payload: Encodable {
            let topic_id: String
            let user_id: String
            let side: String
        }
        let payload = Payload(topic_id: topicId, user_id: userId, side: side.rawValue)
        let data: Data
        do { data = try encoder.encode(payload) }
        catch { throw SupabaseError.encoding(error) }

        let req = try buildRequest(method: "POST", path: "votes", body: data)
        let _: EmptyResponse = try await execute(req)
    }

    func fetchVote(topicId: String, userId: String) async throws -> Vote? {
        var q = QueryParams()
        q.select("*")
        q.eq("topic_id", topicId)
        q.eq("user_id", userId)
        q.limit(1)
        let req = try buildRequest(method: "GET", path: "votes", query: q)
        let list: [Vote] = try await execute(req)
        return list.first
    }

    // MARK: - Laws

    func fetchLaws(search: String? = nil) async throws -> [Law] {
        var q = QueryParams()
        q.select("*")
        q.order("updated_at", ascending: false)
        q.limit(100)
        if let search, !search.isEmpty {
            q.ilike("title", "*\(search)*")
        }
        let req = try buildRequest(method: "GET", path: "laws", query: q)
        do {
            return try await execute(req)
        } catch {
            return Law.sampleData
        }
    }

    func fetchLaw(slug: String) async throws -> Law? {
        var q = QueryParams()
        q.select("*")
        q.eq("slug", slug)
        q.limit(1)
        let req = try buildRequest(method: "GET", path: "laws", query: q)
        let list: [Law] = try await execute(req)
        return list.first
    }

    // MARK: - Search

    func searchTopics(query: String, limit: Int = 20) async throws -> [Topic] {
        var q = QueryParams()
        q.select("*")
        q.ilike("statement", "*\(query)*")
        q.order("total_votes", ascending: false)
        q.limit(limit)
        let req = try buildRequest(method: "GET", path: "topics", query: q)
        return try await execute(req)
    }

    func searchProfiles(query: String, limit: Int = 20) async throws -> [SearchProfile] {
        var q = QueryParams()
        q.select("id,username,display_name,clout,votes_cast")
        q.ilike("username", "*\(query)*")
        q.order("clout", ascending: false)
        q.limit(limit)
        let req = try buildRequest(method: "GET", path: "profiles", query: q)

        // Decode raw JSON into SearchProfile
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SupabaseError.invalidResponse
        }
        struct RawProfile: Codable {
            let id: String
            let username: String
            let display_name: String?
            let clout: Int?
            let votes_cast: Int?
        }
        let raw = try JSONDecoder().decode([RawProfile].self, from: data)
        return raw.map {
            SearchProfile(
                id: $0.id,
                username: $0.username,
                displayName: $0.display_name,
                clout: $0.clout ?? 0,
                votesCast: $0.votes_cast ?? 0
            )
        }
    }

    // MARK: - Arguments

    func fetchArguments(topicId: String, limit: Int = 20) async throws -> [Argument] {
        var q = QueryParams()
        q.select("id,topic_id,author_id,content,side,upvotes,created_at")
        q.eq("topic_id", topicId)
        q.order("upvotes", ascending: false)
        q.limit(limit)
        let req = try buildRequest(method: "GET", path: "arguments", query: q)
        do {
            return try await execute(req)
        } catch {
            return Argument.sampleData.filter { $0.topicId == topicId }
        }
    }

    // MARK: - Profiles

    func fetchProfile(id: String) async throws -> Profile? {
        var q = QueryParams()
        q.select("*")
        q.eq("id", id)
        q.limit(1)
        let req = try buildRequest(method: "GET", path: "profiles", query: q)
        let list: [Profile] = try await execute(req)
        return list.first
    }

    // MARK: - Notifications

    func fetchNotifications(userId: String, limit: Int = 60) async throws -> [LMNotification] {
        var q = QueryParams()
        q.select("id,user_id,type,title,body,topic_id,is_read,created_at")
        q.eq("user_id", userId)
        q.order("created_at", ascending: false)
        q.limit(limit)
        let req = try buildRequest(method: "GET", path: "notifications", query: q)
        do {
            return try await execute(req)
        } catch {
            return LMNotification.sampleData
        }
    }

    func markAllNotificationsRead(userId: String) async throws {
        // PATCH /notifications?user_id=eq.<userId> with is_read = true
        guard var components = URLComponents(
            url: Config.restURL.appendingPathComponent("notifications"),
            resolvingAgainstBaseURL: false
        ) else { throw SupabaseError.invalidURL }
        components.queryItems = [URLQueryItem(name: "user_id", value: "eq.\(userId)")]
        guard let url = components.url else { throw SupabaseError.invalidURL }

        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        req.setValue(Config.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(accessToken ?? Config.anonKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(["is_read": true])

        let (_, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SupabaseError.invalidResponse
        }
    }

    // MARK: - Debates

    func fetchDebates(limit: Int = 50) async throws -> [Debate] {
        var q = QueryParams()
        q.select("id,topic_id,creator_id,type,status,title,description,scheduled_at,started_at,ended_at,viewer_count,blue_sway,red_sway,created_at")
        q.order("scheduled_at", ascending: true)
        q.limit(limit)
        let req = try buildRequest(method: "GET", path: "debates", query: q)
        do {
            let all: [Debate] = try await execute(req)
            // Sort: live first, then scheduled by time, then ended most-recent-first
            return all.sorted { a, b in
                let order: (Debate.DebateStatusKind) -> Int = {
                    switch $0 {
                    case .live:      return 0
                    case .scheduled: return 1
                    case .ended:     return 2
                    case .cancelled: return 3
                    }
                }
                let oa = order(a.status), ob = order(b.status)
                if oa != ob { return oa < ob }
                if a.status == .ended {
                    return (a.endedAt ?? a.scheduledAt) > (b.endedAt ?? b.scheduledAt)
                }
                return a.scheduledAt < b.scheduledAt
            }
        } catch {
            return Debate.sampleData
        }
    }

    // MARK: - Leaderboard

    func fetchLeaderboard(metric: LeaderboardMetric, limit: Int = 50) async throws -> [LeaderboardEntry] {
        var q = QueryParams()
        q.select("id,username,display_name,clout,votes_cast,topics_created")
        q.order(metric.column, ascending: false)
        q.limit(limit)
        let req = try buildRequest(method: "GET", path: "profiles", query: q)
        do {
            return try await execute(req)
        } catch {
            return LeaderboardEntry.sampleData
        }
    }

    // MARK: - Post Argument

    func postArgument(
        topicId: String,
        side: Argument.ArgumentSide,
        content: String,
        userId: String
    ) async throws -> Argument {
        let payload = NewArgumentPayload(
            topic_id: topicId,
            author_id: userId,
            side: side.rawValue,
            content: content
        )
        let body = try encoder.encode(payload)
        let req = try buildRequest(
            method: "POST",
            path: "topic_arguments",
            body: body,
            preferReturn: true
        )
        let list: [Argument] = try await execute(req)
        guard let first = list.first else { throw SupabaseError.invalidResponse }
        return first
    }
}

/// Dummy type for endpoints that don't return a body.
struct EmptyResponse: Decodable {}

/// Payload for creating a topic.
struct NewTopicPayload: Encodable {
    let statement: String
    let description: String?
    let category: String?
    let author_id: String?
}

/// Payload for posting an argument.
struct NewArgumentPayload: Encodable {
    let topic_id: String
    let author_id: String
    let side: String
    let content: String
}
