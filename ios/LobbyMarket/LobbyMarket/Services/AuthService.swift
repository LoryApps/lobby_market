//
//  AuthService.swift
//  LobbyMarket
//
//  Supabase GoTrue client (subset). Tokens stored in Keychain.
//

import Foundation
import Security

@MainActor
final class AuthService: ObservableObject {
    @Published private(set) var isAuthenticated: Bool = false
    @Published private(set) var currentUserId: String?
    @Published private(set) var currentUsername: String?
    @Published private(set) var lastError: String?

    private let session: URLSession
    private let decoder: JSONDecoder

    private let tokenKey = "com.lobbymarket.accessToken"
    private let userIdKey = "com.lobbymarket.userId"

    init(session: URLSession = .shared) {
        self.session = session
        let dec = JSONDecoder()
        dec.dateDecodingStrategy = .iso8601
        self.decoder = dec
        restoreSession()
    }

    // MARK: - Session

    private func restoreSession() {
        if let token = Keychain.read(tokenKey) {
            SupabaseClient.shared.accessToken = token
            currentUserId = Keychain.read(userIdKey)
            isAuthenticated = true
        }
    }

    func signOut() {
        Keychain.delete(tokenKey)
        Keychain.delete(userIdKey)
        SupabaseClient.shared.accessToken = nil
        isAuthenticated = false
        currentUserId = nil
        currentUsername = nil
    }

    // MARK: - Sign In / Sign Up

    struct AuthResponse: Decodable {
        let access_token: String?
        let refresh_token: String?
        let user: User?

        struct User: Decodable {
            let id: String
            let email: String?
            let user_metadata: Metadata?

            struct Metadata: Decodable {
                let username: String?
            }
        }
    }

    func signIn(email: String, password: String) async {
        await callAuth(path: "token?grant_type=password", body: [
            "email": email,
            "password": password
        ])
    }

    func signUp(email: String, password: String, username: String) async {
        await callAuth(path: "signup", body: [
            "email": email,
            "password": password,
            "data": ["username": username]
        ])
    }

    private func callAuth(path: String, body: [String: Any]) async {
        lastError = nil
        guard let url = URL(string: path, relativeTo: Config.authURL) else {
            lastError = "Bad URL"
            return
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(Config.supabaseAnonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        do {
            req.httpBody = try JSONSerialization.data(withJSONObject: body, options: [])
        } catch {
            lastError = "Encoding failed: \(error.localizedDescription)"
            return
        }

        do {
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse else {
                lastError = "Invalid response"
                return
            }
            if !(200..<300).contains(http.statusCode) {
                let text = String(data: data, encoding: .utf8) ?? "error"
                lastError = "HTTP \(http.statusCode): \(text)"
                return
            }
            let decoded = try decoder.decode(AuthResponse.self, from: data)
            if let token = decoded.access_token {
                Keychain.save(tokenKey, value: token)
                SupabaseClient.shared.accessToken = token
            }
            if let user = decoded.user {
                Keychain.save(userIdKey, value: user.id)
                currentUserId = user.id
                currentUsername = user.user_metadata?.username ?? user.email
                isAuthenticated = true
            }
        } catch {
            lastError = error.localizedDescription
        }
    }
}

// MARK: - Keychain helpers

enum Keychain {
    @discardableResult
    static func save(_ key: String, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        delete(key)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    static func read(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let str = String(data: data, encoding: .utf8) else {
            return nil
        }
        return str
    }

    @discardableResult
    static func delete(_ key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key
        ]
        return SecItemDelete(query as CFDictionary) == errSecSuccess
    }
}
