//
//  SettingsView.swift
//  LobbyMarket
//
//  Full settings sheet: notification preferences, app preferences,
//  account info, links, and sign out.
//

import SwiftUI

// MARK: - SettingsView

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject var auth: AuthService

    // Notification prefs
    @State private var prefs = NotifPrefs()
    @State private var prefsLoading = true
    @State private var prefsSaving  = false
    @State private var prefsSaved   = false

    // App preferences
    @AppStorage("lm.hapticsEnabled") private var hapticsEnabled = true
    @AppStorage("lm.compactFeed")    private var compactFeed    = false

    // Info
    @State private var errorMsg: String?

    private var appVersion: String {
        let v = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let b = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(v) (\(b))"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                Form {
                    // ── Account ─────────────────────────────────────────────
                    Section {
                        accountRow(
                            icon: "person.circle.fill",
                            color: .forBlue,
                            label: "Username",
                            value: auth.currentUsername ?? "—"
                        )
                        accountRow(
                            icon: "person.badge.shield.checkmark",
                            color: .emerald,
                            label: "User ID",
                            value: auth.currentUserId.map { String($0.prefix(8)) + "…" } ?? "—"
                        )
                    } header: {
                        sectionHeader("Account")
                    }
                    .listRowBackground(Color.surface200)

                    // ── Notifications ────────────────────────────────────────
                    Section {
                        if prefsLoading {
                            HStack {
                                Spacer()
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .tint(.forBlue)
                                Spacer()
                            }
                            .listRowBackground(Color.surface200)
                        } else {
                            notifToggle("Achievement earned",  icon: "rosette",              color: .gold,        binding: $prefs.achievementEarned)
                            notifToggle("Debate starting",     icon: "mic.fill",             color: .forBlue,     binding: $prefs.debateStarting)
                            notifToggle("Law established",     icon: "gavel",                color: .emerald,     binding: $prefs.lawEstablished)
                            notifToggle("Topic activated",     icon: "bolt.fill",            color: .gold,        binding: $prefs.topicActivated)
                            notifToggle("Vote threshold",      icon: "chart.bar.fill",       color: .forBlue,     binding: $prefs.voteThreshold)
                            notifToggle("Reply received",      icon: "bubble.right.fill",    color: .purple,      binding: $prefs.replyReceived)
                            notifToggle("Role promoted",       icon: "crown.fill",           color: .gold,        binding: $prefs.rolePromoted)
                            notifToggle("Lobby updates",       icon: "person.3.fill",        color: .purple,      binding: $prefs.lobbyUpdate)
                            notifToggle("Tag activity",        icon: "tag.fill",             color: .emerald,     binding: $prefs.newTopicInTag)
                            notifToggle("Streak reminder",     icon: "flame.fill",           color: .againstRed,  binding: $prefs.streakReminder)
                            notifToggle("Weekly digest",       icon: "newspaper.fill",       color: .forBlue,     binding: $prefs.weeklyDigest)
                        }
                    } header: {
                        sectionHeader("Notifications")
                    } footer: {
                        if prefsSaved {
                            Text("Preferences saved.")
                                .font(.lmCaption)
                                .foregroundStyle(.emerald)
                        }
                    }
                    .listRowBackground(Color.surface200)

                    // ── App Preferences ──────────────────────────────────────
                    Section {
                        Toggle(isOn: $hapticsEnabled) {
                            prefLabel(icon: "hand.tap.fill", color: .purple, text: "Haptic feedback")
                        }
                        .tint(.forBlue)
                        Toggle(isOn: $compactFeed) {
                            prefLabel(icon: "square.grid.3x3.fill", color: .surface400, text: "Compact feed")
                        }
                        .tint(.forBlue)
                    } header: {
                        sectionHeader("App Preferences")
                    }
                    .listRowBackground(Color.surface200)

                    // ── Links ────────────────────────────────────────────────
                    Section {
                        linkRow(icon: "questionmark.circle.fill", color: .forBlue,    label: "Help Center",           url: "\(Config.webURL)/about")
                        linkRow(icon: "doc.text.fill",            color: .surface400, label: "Community Guidelines",   url: "\(Config.webURL)/guidelines")
                        linkRow(icon: "hand.raised.fill",         color: .emerald,    label: "Privacy Policy",         url: "\(Config.webURL)/privacy")
                        linkRow(icon: "doc.badge.gearshape",      color: .surface400, label: "Terms of Service",       url: "\(Config.webURL)/terms")
                        linkRow(icon: "envelope.fill",            color: .gold,       label: "Send Feedback",          url: "mailto:hello@lobby.market")
                    } header: {
                        sectionHeader("About")
                    }
                    .listRowBackground(Color.surface200)

                    // ── About ────────────────────────────────────────────────
                    Section {
                        HStack {
                            prefLabel(icon: "info.circle.fill", color: .surface400, text: "Version")
                            Spacer()
                            Text(appVersion)
                                .font(.lmCaption)
                                .foregroundStyle(.textTertiary)
                        }
                        HStack {
                            prefLabel(icon: "building.columns.fill", color: .gold, text: "Lobby Market")
                            Spacer()
                            Text("The Civic Consensus")
                                .font(.lmCaption)
                                .foregroundStyle(.textTertiary)
                        }
                    }
                    .listRowBackground(Color.surface200)

                    // ── Sign Out ─────────────────────────────────────────────
                    Section {
                        Button(role: .destructive) {
                            Haptics.notify(.warning)
                            auth.signOut()
                            dismiss()
                        } label: {
                            HStack {
                                Image(systemName: "rectangle.portrait.and.arrow.right")
                                    .foregroundStyle(.againstRed)
                                    .frame(width: 28)
                                Text("Sign Out")
                                    .font(.lmBodyBold)
                                    .foregroundStyle(.againstRed)
                            }
                        }
                    }
                    .listRowBackground(Color.surface200)
                }
                .scrollContentBackground(.hidden)
                .background(Color.surface0)

                if let errorMsg {
                    VStack {
                        Spacer()
                        Text(errorMsg)
                            .font(.lmCaption)
                            .foregroundStyle(.againstRed)
                            .padding(.horizontal, Spacing.md)
                            .padding(.bottom, Spacing.lg)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") { dismiss() }
                        .font(.lmBodyBold)
                        .foregroundStyle(.forBlue)
                }
                if prefsSaving {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .tint(.forBlue)
                            .scaleEffect(0.8)
                    }
                }
            }
            .task { await loadPrefs() }
            .onChange(of: prefs.achievementEarned) { _, _ in savePrefsDebounced() }
            .onChange(of: prefs.debateStarting)    { _, _ in savePrefsDebounced() }
            .onChange(of: prefs.lawEstablished)    { _, _ in savePrefsDebounced() }
            .onChange(of: prefs.topicActivated)    { _, _ in savePrefsDebounced() }
            .onChange(of: prefs.voteThreshold)     { _, _ in savePrefsDebounced() }
            .onChange(of: prefs.replyReceived)     { _, _ in savePrefsDebounced() }
            .onChange(of: prefs.rolePromoted)      { _, _ in savePrefsDebounced() }
            .onChange(of: prefs.lobbyUpdate)       { _, _ in savePrefsDebounced() }
            .onChange(of: prefs.newTopicInTag)     { _, _ in savePrefsDebounced() }
            .onChange(of: prefs.streakReminder)    { _, _ in savePrefsDebounced() }
            .onChange(of: prefs.weeklyDigest)      { _, _ in savePrefsDebounced() }
        }
    }

    // MARK: - Sub-views

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(.lmMono)
            .foregroundStyle(.textTertiary)
            .kerning(1.0)
    }

    private func accountRow(icon: String, color: Color, label: String, value: String) -> some View {
        HStack(spacing: Spacing.sm) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .frame(width: 28)
            Text(label)
                .font(.lmBody)
                .foregroundStyle(.textPrimary)
            Spacer()
            Text(value)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
                .lineLimit(1)
        }
    }

    private func notifToggle(
        _ label: String,
        icon: String,
        color: Color,
        binding: Binding<Bool>
    ) -> some View {
        Toggle(isOn: binding) {
            prefLabel(icon: icon, color: color, text: label)
        }
        .tint(.forBlue)
    }

    private func prefLabel(icon: String, color: Color, text: String) -> some View {
        HStack(spacing: Spacing.sm) {
            ZStack {
                RoundedRectangle(cornerRadius: 6)
                    .fill(color.opacity(0.18))
                    .frame(width: 28, height: 28)
                Image(systemName: icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(color)
            }
            Text(text)
                .font(.lmBody)
                .foregroundStyle(.textPrimary)
        }
    }

    private func linkRow(icon: String, color: Color, label: String, url: String) -> some View {
        Button {
            Haptics.impact(.light)
            if let u = URL(string: url) {
                UIApplication.shared.open(u)
            }
        } label: {
            HStack(spacing: Spacing.sm) {
                prefLabel(icon: icon, color: color, text: label)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.textTertiary)
            }
        }
    }

    // MARK: - Data

    private func loadPrefs() async {
        guard let uid = auth.currentUserId else {
            prefsLoading = false
            return
        }
        do {
            prefs = try await SupabaseClient.shared.fetchNotifPrefs(userId: uid)
        } catch {
            // Use defaults silently
        }
        prefsLoading = false
    }

    // Simple debounce: cancel any pending save task and schedule a new one
    @State private var saveTask: Task<Void, Never>?

    private func savePrefsDebounced() {
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(nanoseconds: 600_000_000) // 0.6s
            guard !Task.isCancelled else { return }
            await savePrefs()
        }
    }

    private func savePrefs() async {
        guard let uid = auth.currentUserId else { return }
        prefsSaving = true
        prefsSaved  = false
        do {
            try await SupabaseClient.shared.upsertNotifPrefs(userId: uid, prefs: prefs)
            prefsSaved = true
            Haptics.notify(.success)
            // Hide "Preferences saved" after 2 seconds
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            prefsSaved = false
        } catch {
            errorMsg = "Failed to save: \(error.localizedDescription)"
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            errorMsg = nil
        }
        prefsSaving = false
    }
}

#Preview {
    SettingsView()
        .environmentObject(AuthService())
}
