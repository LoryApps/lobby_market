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
    var items: [URLQueryItem] = []

    mutating func select(_ columns: String) { items.append(.init(name: "select", value: columns)) }
    mutating func eq(_ column: String, _ value: String) {
        items.append(.init(name: column, value: "eq.\(value)"))
    }
    mutating func inFilter(_ column: String, values: [String]) {
        items.append(.init(name: column, value: "in.(\(values.joined(separator: ",")))"))
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

    // MARK: - Generic REST helper

    /// Generic GET against any table. Used by feature views that don't
    /// warrant a dedicated typed method on this class.
    func get<T: Decodable>(table: String, params: QueryParams) async throws -> [T] {
        let req = try buildRequest(method: "GET", path: table, query: params)
        return try await execute(req)
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

    // MARK: - Vote history (used by StatsView)

    func fetchVoteHistory(userId: String, limit: Int = 300) async throws -> [VoteHistory] {
        var q = QueryParams()
        q.select("id,topic_id,side,created_at,topics(category)")
        q.eq("user_id", userId)
        q.order("created_at", ascending: false)
        q.limit(limit)
        let req = try buildRequest(method: "GET", path: "votes", query: q)
        do {
            return try await execute(req)
        } catch {
            return []
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

    // MARK: - Recent votes with topic titles (ProfileView activity feed)

    func fetchRecentVotesWithTopics(userId: String, limit: Int = 10) async throws -> [RecentActivityVote] {
        var q = QueryParams()
        q.select("id,topic_id,side,created_at,topics(statement,category)")
        q.eq("user_id", userId)
        q.order("created_at", ascending: false)
        q.limit(limit)
        let req = try buildRequest(method: "GET", path: "votes", query: q)
        do {
            return try await execute(req)
        } catch {
            return []
        }
    }

    // MARK: - Topics authored by user (ProfileView)

    func fetchTopicsByAuthor(authorId: String, limit: Int = 8) async throws -> [Topic] {
        var q = QueryParams()
        q.select("id,statement,category,created_at,total_votes")
        q.eq("author_id", authorId)
        q.order("created_at", ascending: false)
        q.limit(limit)
        let req = try buildRequest(method: "GET", path: "topics", query: q)
        do {
            return try await execute(req)
        } catch {
            return []
        }
    }

    // MARK: - Update profile (bio / display name)

    func updateProfile(id: String, displayName: String?, bio: String?) async throws {
        struct Payload: Encodable {
            let display_name: String?
            let bio: String?
        }
        let payload = Payload(
            display_name: displayName?.isEmpty == true ? nil : displayName,
            bio: bio?.isEmpty == true ? nil : bio
        )
        let body: Data
        do { body = try encoder.encode(payload) }
        catch { throw SupabaseError.encoding(error) }

        guard var components = URLComponents(
            url: Config.restURL.appendingPathComponent("profiles"),
            resolvingAgainstBaseURL: false
        ) else { throw SupabaseError.invalidURL }
        components.queryItems = [URLQueryItem(name: "id", value: "eq.\(id)")]
        guard let url = components.url else { throw SupabaseError.invalidURL }

        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        req.setValue(Config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(accessToken ?? Config.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = body

        let (_, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SupabaseError.invalidResponse
        }
    }

    // MARK: - Onboarding

    func completeOnboarding(userId: String, categoryPreferences: [String]) async throws {
        struct Payload: Encodable {
            let onboarding_complete: Bool
            let category_preferences: [String]
        }
        let body = try encoder.encode(Payload(onboarding_complete: true, category_preferences: categoryPreferences))

        guard var components = URLComponents(
            url: Config.restURL.appendingPathComponent("profiles"),
            resolvingAgainstBaseURL: false
        ) else { throw SupabaseError.invalidURL }
        components.queryItems = [URLQueryItem(name: "id", value: "eq.\(userId)")]
        guard let url = components.url else { throw SupabaseError.invalidURL }

        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        req.setValue(Config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(accessToken ?? Config.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = body

        let (_, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SupabaseError.invalidResponse
        }
    }

    // MARK: - Coalitions

    func fetchCoalitions(limit: Int = 50) async throws -> [Coalition] {
        var params = QueryParams()
        params.select("id,name,creator_id,description,member_count,coalition_influence,wins,losses,is_public,max_members,created_at")
        params.eq("is_public", "true")
        params.order("coalition_influence", ascending: false)
        params.limit(limit)
        let req = try buildRequest(method: "GET", path: "coalitions", query: params)
        return try await execute(req)
    }

    func fetchMyCoalitionIds(userId: String) async throws -> [String] {
        var params = QueryParams()
        params.select("coalition_id")
        params.eq("user_id", userId)
        let req = try buildRequest(method: "GET", path: "coalition_members", query: params)
        let rows: [[String: String]] = try await execute(req)
        return rows.compactMap { $0["coalition_id"] }
    }

    func joinCoalition(coalitionId: String, userId: String) async throws {
        struct Payload: Encodable {
            let coalition_id: String
            let user_id: String
            let role: String
        }
        let body = try encoder.encode(Payload(coalition_id: coalitionId, user_id: userId, role: "member"))
        let req = try buildRequest(method: "POST", path: "coalition_members", body: body)
        let (_, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SupabaseError.invalidResponse
        }
        // Increment member_count via RPC-like PATCH — best-effort
        let updateReq = try buildRequest(
            method: "POST",
            path: "rpc/increment_coalition_member_count",
            body: try encoder.encode(["coalition_id": coalitionId])
        )
        _ = try? await session.data(for: updateReq)
    }

    func leaveCoalition(coalitionId: String, userId: String) async throws {
        var params = QueryParams()
        params.eq("coalition_id", coalitionId)
        params.eq("user_id", userId)
        let req = try buildRequest(method: "DELETE", path: "coalition_members", query: params)
        let (_, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SupabaseError.invalidResponse
        }
    }

    // MARK: - Debate RSVPs

    /// Fetch the number of RSVPs for a debate.
    func fetchDebateRSVPCount(debateId: String) async throws -> Int {
        var q = QueryParams()
        q.select("id")
        q.eq("debate_id", debateId)
        q.limit(500)
        let req = try buildRequest(method: "GET", path: "debate_rsvps", query: q)
        struct IDOnly: Decodable { let id: String }
        let rows: [IDOnly] = (try? await execute(req)) ?? []
        return rows.count
    }

    /// Returns true if the given user has RSVP'd to the debate.
    func isUserRSVPed(debateId: String, userId: String) async throws -> Bool {
        var q = QueryParams()
        q.select("id")
        q.eq("debate_id", debateId)
        q.eq("user_id", userId)
        q.limit(1)
        let req = try buildRequest(method: "GET", path: "debate_rsvps", query: q)
        struct IDOnly: Decodable { let id: String }
        let rows: [IDOnly] = (try? await execute(req)) ?? []
        return !rows.isEmpty
    }

    /// RSVP the current user to a debate (upsert — safe to call if already RSVP'd).
    func rsvpToDebate(debateId: String, userId: String) async throws {
        struct Payload: Encodable {
            let debate_id: String
            let user_id: String
        }
        let body = try encoder.encode(Payload(debate_id: debateId, user_id: userId))
        var req = try buildRequest(method: "POST", path: "debate_rsvps", body: body)
        req.setValue("resolution=ignore-duplicates", forHTTPHeaderField: "Prefer")
        let _: EmptyResponse = try await execute(req)
    }

    /// Remove the current user's RSVP from a debate.
    func unrsvpFromDebate(debateId: String, userId: String) async throws {
        var q = QueryParams()
        q.eq("debate_id", debateId)
        q.eq("user_id", userId)
        let req = try buildRequest(method: "DELETE", path: "debate_rsvps", query: q)
        let (_, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw SupabaseError.invalidResponse
        }
    }

    // MARK: - Notification Preferences

    func fetchNotifPrefs(userId: String) async throws -> NotifPrefs {
        var q = QueryParams()
        q.select("achievement_earned,debate_starting,law_established,topic_activated,vote_threshold,reply_received,role_promoted,lobby_update,new_topic_in_tag,streak_reminder,weekly_digest")
        q.eq("user_id", userId)
        q.limit(1)
        let req = try buildRequest(method: "GET", path: "user_notification_prefs", query: q)
        let list: [NotifPrefs] = try await execute(req)
        return list.first ?? NotifPrefs()
    }

    func upsertNotifPrefs(userId: String, prefs: NotifPrefs) async throws {
        struct UpsertPayload: Encodable {
            let user_id: String
            let achievement_earned: Bool
            let debate_starting: Bool
            let law_established: Bool
            let topic_activated: Bool
            let vote_threshold: Bool
            let reply_received: Bool
            let role_promoted: Bool
            let lobby_update: Bool
            let new_topic_in_tag: Bool
            let streak_reminder: Bool
            let weekly_digest: Bool
        }
        let payload = UpsertPayload(
            user_id: userId,
            achievement_earned: prefs.achievementEarned,
            debate_starting: prefs.debateStarting,
            law_established: prefs.lawEstablished,
            topic_activated: prefs.topicActivated,
            vote_threshold: prefs.voteThreshold,
            reply_received: prefs.replyReceived,
            role_promoted: prefs.rolePromoted,
            lobby_update: prefs.lobbyUpdate,
            new_topic_in_tag: prefs.newTopicInTag,
            streak_reminder: prefs.streakReminder,
            weekly_digest: prefs.weeklyDigest
        )
        let data = try encoder.encode(payload)
        var req = try buildRequest(method: "POST", path: "user_notification_prefs", body: data)
        req.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        let _: EmptyResponse = try await execute(req)
    }

    // MARK: - Argument Arena (Faceoffs)

    func fetchArenaMatchup(topicId: String, userId: String?) async throws -> ArenaMatchup? {
        // 1. Fetch arguments for the topic
        var q = QueryParams()
        q.select("id,content,side,upvotes,author_id")
        q.eq("topic_id", topicId)
        q.order("upvotes", ascending: false)
        q.limit(50)
        let argsReq = try buildRequest(method: "GET", path: "topic_arguments", query: q)
        let rawArgs: [RawArenaArg] = (try? await execute(argsReq)) ?? []
        guard rawArgs.count >= 2 else { return nil }

        // 2. Fetch seen pairs for current user
        var seenPairs: Set<String> = []
        if let uid = userId {
            var sq = QueryParams()
            sq.select("argument_a_id,argument_b_id")
            sq.eq("user_id", uid)
            let seenReq = try buildRequest(method: "GET", path: "argument_faceoff_votes", query: sq)
            let seen: [RawSeenPair] = (try? await execute(seenReq)) ?? []
            for p in seen {
                let key = [p.argument_a_id, p.argument_b_id].sorted().joined(separator: "|")
                seenPairs.insert(key)
            }
        }

        // 3. Fetch author usernames in one batch
        let authorIds = Array(Set(rawArgs.compactMap { $0.author_id }))
        var usernameMap: [String: String] = [:]
        if !authorIds.isEmpty {
            var pq = QueryParams()
            pq.select("id,username")
            pq.inFilter("id", values: authorIds)
            let pReq = try buildRequest(method: "GET", path: "profiles", query: pq)
            let profiles: [RawProfile] = (try? await execute(pReq)) ?? []
            for p in profiles { usernameMap[p.id] = p.username }
        }

        func makeArena(_ raw: RawArenaArg) -> ArenaArgument {
            ArenaArgument(
                id: raw.id,
                content: raw.content,
                side: raw.side,
                upvotes: raw.upvotes ?? 0,
                authorUsername: raw.author_id.flatMap { usernameMap[$0] }
            )
        }

        let blues  = rawArgs.filter { $0.side == "blue" }
        let reds   = rawArgs.filter { $0.side == "red" }

        // 4. Cross-side unseen pair first (most interesting matchups)
        for b in blues {
            for r in reds {
                let key = [b.id, r.id].sorted().joined(separator: "|")
                if !seenPairs.contains(key) {
                    return ArenaMatchup(argA: makeArena(b), argB: makeArena(r))
                }
            }
        }

        // 5. Same-side fallback
        for i in 0..<rawArgs.count {
            for j in (i + 1)..<rawArgs.count {
                let key = [rawArgs[i].id, rawArgs[j].id].sorted().joined(separator: "|")
                if !seenPairs.contains(key) {
                    return ArenaMatchup(argA: makeArena(rawArgs[i]), argB: makeArena(rawArgs[j]))
                }
            }
        }

        return nil
    }

    func submitFaceoffVote(
        argumentAId: String,
        argumentBId: String,
        winnerId: String,
        userId: String
    ) async throws {
        let (canonA, canonB) = argumentAId < argumentBId
            ? (argumentAId, argumentBId)
            : (argumentBId, argumentAId)
        struct Payload: Encodable {
            let user_id: String
            let argument_a_id: String
            let argument_b_id: String
            let winner_id: String
        }
        let body = try encoder.encode(Payload(
            user_id: userId,
            argument_a_id: canonA,
            argument_b_id: canonB,
            winner_id: winnerId
        ))
        let req = try buildRequest(method: "POST", path: "argument_faceoff_votes", body: body)
        let _: EmptyResponse = try await execute(req)
    }

    // MARK: - Predictions

    /// Fetch crowd-aggregate prediction stats for a single topic.
    func fetchTopicPredictionStats(topicId: String) async throws -> TopicPredictionStats? {
        var q = QueryParams()
        q.select("topic_id,total_predictions,law_confidence")
        q.eq("topic_id", topicId)
        q.limit(1)
        let req = try buildRequest(method: "GET", path: "topic_prediction_stats", query: q)
        let list: [TopicPredictionStats] = (try? await execute(req)) ?? []
        return list.first
    }

    /// Fetch the current user's prediction on a specific topic (nil = no prediction yet).
    func fetchMyPrediction(topicId: String, userId: String) async throws -> Prediction? {
        var q = QueryParams()
        q.select("id,topic_id,user_id,predicted_law,confidence,resolved_at,correct,brier_score,clout_earned,created_at,updated_at")
        q.eq("topic_id", topicId)
        q.eq("user_id", userId)
        q.limit(1)
        let req = try buildRequest(method: "GET", path: "topic_predictions", query: q)
        let list: [Prediction] = (try? await execute(req)) ?? []
        return list.first
    }

    /// Upsert a prediction (insert or update on conflict).
    func upsertPrediction(
        topicId: String,
        userId: String,
        predictedLaw: Bool,
        confidence: Int
    ) async throws -> Prediction {
        let payload = UpsertPredictionPayload(
            topic_id: topicId,
            user_id: userId,
            predicted_law: predictedLaw,
            confidence: confidence
        )
        let data = try encoder.encode(payload)
        var req = try buildRequest(method: "POST", path: "topic_predictions", body: data, preferReturn: true)
        req.setValue("resolution=merge-duplicates,return=representation", forHTTPHeaderField: "Prefer")
        let list: [Prediction] = try await execute(req)
        guard let first = list.first else { throw SupabaseError.invalidResponse }
        return first
    }

    /// Fetch aggregated prediction stats for a user (accuracy, total, brier score).
    func fetchPredictionUserStats(userId: String) async throws -> PredictionUserStats {
        var q = QueryParams()
        q.select("predicted_law,confidence,resolved_at,correct,brier_score,clout_earned")
        q.eq("user_id", userId)
        q.limit(500)
        let req = try buildRequest(method: "GET", path: "topic_predictions", query: q)
        let list: [Prediction] = (try? await execute(req)) ?? []

        let total     = list.count
        let resolved  = list.filter { $0.resolvedAt != nil }
        let correct   = resolved.filter { $0.correct == true }.count
        let clout     = list.reduce(0) { $0 + $1.cloutEarned }

        let accuracy: Double? = resolved.isEmpty ? nil
            : Double(correct) / Double(resolved.count)

        let briersArray = resolved.compactMap { $0.brierScore }
        let avgBrier: Double? = briersArray.isEmpty ? nil
            : briersArray.reduce(0, +) / Double(briersArray.count)

        return PredictionUserStats(
            total: total,
            resolved: resolved.count,
            correct: correct,
            accuracy: accuracy,
            avgBrier: avgBrier,
            cloutEarned: clout
        )
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

    // MARK: - Direct Messages

    /// Fetch all conversations for the current user, grouped by partner.
    func fetchConversations(userId: String) async throws -> [DmConversation] {
        guard var components = URLComponents(
            url: Config.restURL.appendingPathComponent("direct_messages"),
            resolvingAgainstBaseURL: false
        ) else { throw SupabaseError.invalidURL }

        let cols = "id,sender_id,receiver_id,content,is_read,created_at," +
            "sender:profiles!direct_messages_sender_id_fkey(id,username,display_name,avatar_url,role)," +
            "receiver:profiles!direct_messages_receiver_id_fkey(id,username,display_name,avatar_url,role)"

        components.queryItems = [
            URLQueryItem(name: "select", value: cols),
            URLQueryItem(name: "or",     value: "(sender_id.eq.\(userId),receiver_id.eq.\(userId))"),
            URLQueryItem(name: "order",  value: "created_at.desc"),
            URLQueryItem(name: "limit",  value: "300"),
        ]
        guard let url = components.url else { throw SupabaseError.invalidURL }
        let req = buildAuthRequest(url: url, method: "GET")
        let rows: [DirectMessage] = try await execute(req)

        var threadMap: [String: DmConversation] = [:]
        for row in rows {
            let isIncoming = row.receiverId == userId
            guard let partner = isIncoming ? row.sender : row.receiver else { continue }
            if let existing = threadMap[partner.id] {
                if isIncoming && !row.isRead {
                    threadMap[partner.id] = DmConversation(
                        partner: existing.partner,
                        lastMessage: existing.lastMessage,
                        lastMessageAt: existing.lastMessageAt,
                        unreadCount: existing.unreadCount + 1,
                        lastSenderId: existing.lastSenderId
                    )
                }
            } else {
                threadMap[partner.id] = DmConversation(
                    partner: partner,
                    lastMessage: row.content,
                    lastMessageAt: row.createdAt,
                    unreadCount: isIncoming && !row.isRead ? 1 : 0,
                    lastSenderId: row.senderId
                )
            }
        }
        return Array(threadMap.values).sorted { $0.lastMessageAt > $1.lastMessageAt }
    }

    /// Fetch messages between the current user and a specific partner.
    func fetchDirectMessages(myId: String, partnerId: String, limit: Int = 100) async throws -> [DirectMessage] {
        guard var components = URLComponents(
            url: Config.restURL.appendingPathComponent("direct_messages"),
            resolvingAgainstBaseURL: false
        ) else { throw SupabaseError.invalidURL }

        let cols = "id,sender_id,receiver_id,content,is_read,created_at," +
            "sender:profiles!direct_messages_sender_id_fkey(id,username,display_name,avatar_url,role)"
        let orFilter = "(and(sender_id.eq.\(myId),receiver_id.eq.\(partnerId))," +
            "and(sender_id.eq.\(partnerId),receiver_id.eq.\(myId)))"

        components.queryItems = [
            URLQueryItem(name: "select", value: cols),
            URLQueryItem(name: "or",     value: orFilter),
            URLQueryItem(name: "order",  value: "created_at.asc"),
            URLQueryItem(name: "limit",  value: "\(limit)"),
        ]
        guard let url = components.url else { throw SupabaseError.invalidURL }
        let req = buildAuthRequest(url: url, method: "GET")
        return try await execute(req)
    }

    /// Send a direct message from senderId to receiverId.
    func sendDirectMessage(senderId: String, receiverId: String, content: String) async throws -> DirectMessage {
        struct Payload: Encodable {
            let sender_id: String
            let receiver_id: String
            let content: String
        }
        let body = try encoder.encode(Payload(sender_id: senderId, receiver_id: receiverId, content: content))
        let req  = try buildRequest(method: "POST", path: "direct_messages", body: body, preferReturn: true)
        let list: [DirectMessage] = try await execute(req)
        guard let first = list.first else { throw SupabaseError.invalidResponse }
        return first
    }

    /// Mark all incoming messages in a conversation as read.
    func markConversationRead(myId: String, partnerId: String) async throws {
        guard var components = URLComponents(
            url: Config.restURL.appendingPathComponent("direct_messages"),
            resolvingAgainstBaseURL: false
        ) else { throw SupabaseError.invalidURL }
        components.queryItems = [
            URLQueryItem(name: "receiver_id", value: "eq.\(myId)"),
            URLQueryItem(name: "sender_id",   value: "eq.\(partnerId)"),
            URLQueryItem(name: "is_read",     value: "eq.false"),
        ]
        guard let url = components.url else { throw SupabaseError.invalidURL }
        var req = buildAuthRequest(url: url, method: "PATCH")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try encoder.encode(["is_read": true])
        _ = try? await session.data(for: req)
    }

    /// Build an authenticated URLRequest without a body (for manual queries).
    private func buildAuthRequest(url: URL, method: String) -> URLRequest {
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(Config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(accessToken ?? Config.supabaseAnonKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        return req
    }
}

/// Dummy type for endpoints that don't return a body.
struct EmptyResponse: Decodable {}

/// User notification preferences — mirrors the `user_notification_prefs` table.
struct NotifPrefs: Codable {
    var achievementEarned: Bool = true
    var debateStarting: Bool    = true
    var lawEstablished: Bool    = true
    var topicActivated: Bool    = true
    var voteThreshold: Bool     = true
    var replyReceived: Bool     = true
    var rolePromoted: Bool      = true
    var lobbyUpdate: Bool       = false
    var newTopicInTag: Bool     = true
    var streakReminder: Bool    = true
    var weeklyDigest: Bool      = true

    enum CodingKeys: String, CodingKey {
        case achievementEarned = "achievement_earned"
        case debateStarting    = "debate_starting"
        case lawEstablished    = "law_established"
        case topicActivated    = "topic_activated"
        case voteThreshold     = "vote_threshold"
        case replyReceived     = "reply_received"
        case rolePromoted      = "role_promoted"
        case lobbyUpdate       = "lobby_update"
        case newTopicInTag     = "new_topic_in_tag"
        case streakReminder    = "streak_reminder"
        case weeklyDigest      = "weekly_digest"
    }
}

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

/// A vote record with embedded topic statement + category — used by ProfileView.
struct RecentActivityVote: Decodable, Identifiable {
    let id: String
    let topicId: String
    let side: String
    let createdAt: Date
    let topicStatement: String?
    let topicCategory: String?

    private struct TopicJoin: Decodable {
        let statement: String?
        let category: String?
    }

    private enum CodingKeys: String, CodingKey {
        case id, side
        case topicId   = "topic_id"
        case createdAt = "created_at"
        case topicJoin = "topics"
    }

    init(from decoder: Decoder) throws {
        let c   = try decoder.container(keyedBy: CodingKeys.self)
        id      = try c.decodeIfPresent(String.self, forKey: .id) ?? UUID().uuidString
        topicId = try c.decodeIfPresent(String.self, forKey: .topicId) ?? ""
        side    = try c.decodeIfPresent(String.self, forKey: .side) ?? "blue"
        createdAt = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
        let join      = try? c.decode(TopicJoin.self, forKey: .topicJoin)
        topicStatement = join?.statement
        topicCategory  = join?.category
    }
}

// MARK: - Arena raw decodable types (used by fetchArenaMatchup)

struct RawArenaArg: Decodable {
    let id: String
    let content: String
    let side: String
    let upvotes: Int?
    let author_id: String?
}

struct RawSeenPair: Decodable {
    let argument_a_id: String
    let argument_b_id: String
}

struct RawProfile: Decodable {
    let id: String
    let username: String?
}

/// A vote record returned with its topic's category — used by StatsView.
struct VoteHistory: Decodable {
    let id: String
    let topicId: String
    let side: String
    let createdAt: Date
    let topics: TopicRef?

    struct TopicRef: Decodable {
        let category: String?
    }

    enum CodingKeys: String, CodingKey {
        case id
        case topicId  = "topic_id"
        case side
        case createdAt = "created_at"
        case topics
    }
}
