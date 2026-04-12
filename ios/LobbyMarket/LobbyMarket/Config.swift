//
//  Config.swift
//  LobbyMarket
//
//  Central configuration. Do not hardcode these anywhere else.
//

import Foundation

enum Config {
    /// Supabase project base URL.
    static let supabaseURL = URL(string: "https://jysabvbfruvyhbqdhnmh.supabase.co")!

    /// Supabase anonymous key — safe to ship in the client.
    static let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5c2FidmJmcnV2eWhicWRobm1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDcxMTgsImV4cCI6MjA4ODM4MzExOH0.ESNJclwgxm34NYLaINDfGTjZHXyYNhGRQdP0IHs8zAE"

    /// Supabase REST endpoint.
    static var restURL: URL { supabaseURL.appendingPathComponent("rest/v1") }

    /// Supabase Auth endpoint.
    static var authURL: URL { supabaseURL.appendingPathComponent("auth/v1") }

    /// Supabase Realtime websocket endpoint.
    static var realtimeURL: URL {
        var components = URLComponents(url: supabaseURL, resolvingAgainstBaseURL: false)!
        components.scheme = "wss"
        components.path = "/realtime/v1/websocket"
        components.queryItems = [
            URLQueryItem(name: "apikey", value: supabaseAnonKey),
            URLQueryItem(name: "vsn", value: "1.0.0")
        ]
        return components.url!
    }

    /// App display name.
    static let appName = "Lobby Market"

    /// Feed page size.
    static let feedPageSize = 20
}
