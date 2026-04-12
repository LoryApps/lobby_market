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
