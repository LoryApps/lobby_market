//
//  RealtimeService.swift
//  LobbyMarket
//
//  Minimal Supabase Realtime client (Phoenix protocol) over URLSessionWebSocketTask.
//

import Foundation
import Combine

@MainActor
final class RealtimeService: ObservableObject {
    @Published private(set) var isConnected: Bool = false
    @Published private(set) var tallies: [String: VoteTally] = [:]

    private var task: URLSessionWebSocketTask?
    private var session: URLSession
    private var heartbeatTimer: Timer?
    private var ref: Int = 0
    private var subscribedTopics: Set<String> = []

    init(session: URLSession = .shared) {
        self.session = session
    }

    // MARK: - Connection

    func connect() {
        guard task == nil else { return }
        let task = session.webSocketTask(with: Config.realtimeURL)
        self.task = task
        task.resume()
        isConnected = true
        listen()
        startHeartbeat()
    }

    func disconnect() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = nil
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
        isConnected = false
        subscribedTopics.removeAll()
    }

    // MARK: - Subscriptions

    func subscribe(topicId: String) {
        guard !subscribedTopics.contains(topicId) else { return }
        subscribedTopics.insert(topicId)
        if task == nil { connect() }

        let phxTopic = "realtime:public:votes:topic_id=eq.\(topicId)"
        let payload: [String: Any] = [
            "topic": phxTopic,
            "event": "phx_join",
            "payload": [:],
            "ref": "\(nextRef())"
        ]
        send(payload)
    }

    func unsubscribe(topicId: String) {
        subscribedTopics.remove(topicId)
        let phxTopic = "realtime:public:votes:topic_id=eq.\(topicId)"
        let payload: [String: Any] = [
            "topic": phxTopic,
            "event": "phx_leave",
            "payload": [:],
            "ref": "\(nextRef())"
        ]
        send(payload)
    }

    // MARK: - Internals

    private func nextRef() -> Int {
        ref += 1
        return ref
    }

    private func send(_ payload: [String: Any]) {
        guard let task else { return }
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: []),
              let str = String(data: data, encoding: .utf8) else { return }
        task.send(.string(str)) { error in
            if let error {
                print("Realtime send error: \(error)")
            }
        }
    }

    private func listen() {
        guard let task else { return }
        task.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let error):
                print("Realtime receive error: \(error)")
                Task { @MainActor in self.isConnected = false }
            case .success(let message):
                switch message {
                case .string(let str):
                    Task { @MainActor in self.handleMessage(str) }
                case .data(let data):
                    if let str = String(data: data, encoding: .utf8) {
                        Task { @MainActor in self.handleMessage(str) }
                    }
                @unknown default: break
                }
                self.listen()
            }
        }
    }

    private func handleMessage(_ str: String) {
        guard let data = str.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }
        guard let event = obj["event"] as? String else { return }

        if event == "postgres_changes" || event == "INSERT" || event == "UPDATE" {
            if let payload = obj["payload"] as? [String: Any],
               let record = payload["record"] as? [String: Any],
               let topicId = record["topic_id"] as? String {
                updateTally(for: topicId, record: record)
            }
        }
    }

    private func updateTally(for topicId: String, record: [String: Any]) {
        var current = tallies[topicId] ?? VoteTally(topicId: topicId, forVotes: 0, againstVotes: 0)
        if let side = record["side"] as? String {
            switch side {
            case "for":
                current = VoteTally(
                    topicId: topicId,
                    forVotes: current.forVotes + 1,
                    againstVotes: current.againstVotes
                )
            case "against":
                current = VoteTally(
                    topicId: topicId,
                    forVotes: current.forVotes,
                    againstVotes: current.againstVotes + 1
                )
            default: break
            }
        }
        tallies[topicId] = current
    }

    private func startHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.send([
                    "topic": "phoenix",
                    "event": "heartbeat",
                    "payload": [:],
                    "ref": "\(self.nextRef())"
                ])
            }
        }
    }
}
