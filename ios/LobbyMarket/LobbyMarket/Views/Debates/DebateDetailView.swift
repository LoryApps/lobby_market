//
//  DebateDetailView.swift
//  LobbyMarket
//
//  Native debate detail screen with RSVP, live sway, and countdown.
//  Replaces the previous "open in Safari" tap action on DebateCard.
//

import SwiftUI

struct DebateDetailView: View {
    let debate: Debate

    @EnvironmentObject var auth: AuthService
    @Environment(\.openURL) private var openURL

    @State private var rsvpCount: Int = 0
    @State private var isRSVPed: Bool = false
    @State private var rsvpBusy: Bool = false
    @State private var loadingRSVP: Bool = true
    @State private var timeRemaining: TimeInterval = 0

    let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    // MARK: - Body

    var body: some View {
        ZStack(alignment: .top) {
            Color.surface0.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    headerSection
                    Divider().background(Color.white.opacity(0.06)).padding(.horizontal, Spacing.md)
                    statusSection
                    if let desc = debate.description, !desc.isEmpty {
                        descriptionSection(desc)
                    }
                    metaSection
                    openWebButton
                    Spacer(minLength: 60)
                }
            }
        }
        .navigationTitle("Debate")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.surface100, for: .navigationBar)
        .task { await loadRSVPState() }
        .onReceive(timer) { _ in
            updateCountdown()
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            // Badge row
            HStack(spacing: 8) {
                typeBadge
                if debate.status == .live {
                    livePill
                } else if debate.status == .scheduled {
                    scheduledPill
                } else if debate.status == .ended {
                    endedPill
                }
                Spacer()
            }

            // Title
            Text(debate.title)
                .font(.lmDisplayMedium)
                .foregroundStyle(.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.md)
        .padding(.top, 4)
    }

    // MARK: - Status-specific section

    @ViewBuilder
    private var statusSection: some View {
        switch debate.status {
        case .live:
            liveSection
        case .scheduled:
            scheduledSection
        case .ended:
            endedSection
        case .cancelled:
            cancelledSection
        }
    }

    // ── Live ──────────────────────────────────────────────────────────────

    private var liveSection: some View {
        VStack(spacing: Spacing.md) {
            // Sway
            swaySection

            // Stats row
            HStack(spacing: Spacing.md) {
                statPill(icon: "eye.fill", value: "\(debate.viewerCount)", label: "watching", color: .forBlue)
                Spacer()
            }

            // Watch button
            Button {
                openDebateInWeb()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 18, weight: .bold))
                    Text("Watch Live")
                        .font(.lmBodyBold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .fill(Color.red.opacity(0.85))
                )
                .foregroundStyle(.white)
            }
            .buttonStyle(PressableButtonStyle())
        }
        .padding(Spacing.md)
    }

    // ── Scheduled ─────────────────────────────────────────────────────────

    private var scheduledSection: some View {
        VStack(spacing: Spacing.md) {
            // Countdown card
            if timeRemaining > 0 {
                countdownCard
            } else {
                HStack {
                    Image(systemName: "clock.fill")
                        .foregroundStyle(.gold)
                    Text("Starting soon")
                        .font(.lmHeadline)
                        .foregroundStyle(.gold)
                    Spacer()
                }
                .padding(Spacing.sm)
                .background(Color.gold.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm))
            }

            // RSVP
            rsvpSection
        }
        .padding(Spacing.md)
    }

    private var countdownCard: some View {
        HStack(spacing: 0) {
            timeUnit(value: Int(timeRemaining) / 86400, label: "days")
            timeDivider
            timeUnit(value: (Int(timeRemaining) % 86400) / 3600, label: "hrs")
            timeDivider
            timeUnit(value: (Int(timeRemaining) % 3600) / 60, label: "min")
            timeDivider
            timeUnit(value: Int(timeRemaining) % 60, label: "sec")
        }
        .frame(maxWidth: .infinity)
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }

    private func timeUnit(value: Int, label: String) -> some View {
        VStack(spacing: 2) {
            Text(String(format: "%02d", max(0, value)))
                .font(.system(size: 28, weight: .heavy, design: .monospaced))
                .foregroundStyle(.white)
            Text(label)
                .font(.system(size: 9, weight: .medium))
                .kerning(0.5)
                .foregroundStyle(.surface400)
        }
        .frame(maxWidth: .infinity)
    }

    private var timeDivider: some View {
        Text(":")
            .font(.system(size: 24, weight: .heavy, design: .monospaced))
            .foregroundStyle(.surface300)
            .padding(.bottom, 14)
    }

    private var rsvpSection: some View {
        VStack(spacing: Spacing.sm) {
            // RSVP count
            if rsvpCount > 0 || !loadingRSVP {
                HStack(spacing: 6) {
                    Image(systemName: "person.2.fill")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.surface400)
                    Text(rsvpCount == 1 ? "1 person RSVP'd" : "\(rsvpCount) people RSVP'd")
                        .font(.lmCaption)
                        .foregroundStyle(.surface400)
                    Spacer()
                }
            }

            if auth.currentUserId != nil {
                Button {
                    Task { await toggleRSVP() }
                } label: {
                    HStack(spacing: 8) {
                        if rsvpBusy {
                            ProgressView()
                                .tint(.white)
                                .scaleEffect(0.8)
                        } else {
                            Image(systemName: isRSVPed ? "checkmark.circle.fill" : "bell.badge.fill")
                                .font(.system(size: 16, weight: .semibold))
                        }
                        Text(isRSVPed ? "RSVP'd — Cancel" : "RSVP to This Debate")
                            .font(.lmBodyBold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .fill(isRSVPed ? Color.emerald.opacity(0.18) : LinearGradient.forGradient)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .stroke(isRSVPed ? Color.emerald.opacity(0.5) : Color.clear, lineWidth: 1)
                    )
                    .foregroundStyle(isRSVPed ? .emerald : .white)
                }
                .disabled(rsvpBusy || loadingRSVP)
                .buttonStyle(PressableButtonStyle())
            } else {
                Text("Sign in to RSVP and get reminders")
                    .font(.lmCaption)
                    .foregroundStyle(.surface400)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
    }

    // ── Ended ─────────────────────────────────────────────────────────────

    private var endedSection: some View {
        VStack(spacing: Spacing.md) {
            swaySection

            HStack(spacing: Spacing.md) {
                statPill(icon: "eye.fill", value: "\(debate.viewerCount)", label: "viewers", color: .surface400)
                Spacer()
            }
        }
        .padding(Spacing.md)
    }

    // ── Cancelled ─────────────────────────────────────────────────────────

    private var cancelledSection: some View {
        HStack(spacing: 8) {
            Image(systemName: "xmark.circle.fill")
                .foregroundStyle(.against)
            Text("This debate was cancelled")
                .font(.lmHeadline)
                .foregroundStyle(.surface400)
            Spacer()
        }
        .padding(Spacing.md)
    }

    // MARK: - Sway section (shared by live + ended)

    private var swaySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("AUDIENCE SWAY")
                .font(.system(size: 10, weight: .semibold))
                .kerning(1.0)
                .foregroundStyle(.surface400)

            GeometryReader { geo in
                let blueW = geo.size.width * CGFloat(max(0, min(100, debate.blueSway))) / 100
                HStack(spacing: 2) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(LinearGradient.forGradient)
                        .frame(width: blueW, height: 28)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(LinearGradient.againstGradient)
                        .frame(width: geo.size.width - blueW - 2, height: 28)
                }
            }
            .frame(height: 28)

            HStack {
                Label("FOR \(debate.blueSway)%", systemImage: "arrow.up")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.forBlue)
                Spacer()
                Label("\(debate.redSway)% AGAINST", systemImage: "arrow.down")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.against)
            }
        }
    }

    // MARK: - Description

    private func descriptionSection(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text("OVERVIEW")
                .font(.system(size: 10, weight: .semibold))
                .kerning(1.0)
                .foregroundStyle(.surface400)

            Text(text)
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.md)
    }

    // MARK: - Meta

    private var metaSection: some View {
        VStack(spacing: 0) {
            Divider().background(Color.white.opacity(0.06)).padding(.horizontal, Spacing.md)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                Text("DETAILS")
                    .font(.system(size: 10, weight: .semibold))
                    .kerning(1.0)
                    .foregroundStyle(.surface400)

                metaRow(icon: "mic.fill", label: "Type", value: debate.type.displayName, iconColor: typeColor)
                metaRow(icon: "calendar", label: "Scheduled", value: formattedDate(debate.scheduledAt), iconColor: .surface400)
                if let started = debate.startedAt {
                    metaRow(icon: "play.fill", label: "Started", value: formattedDate(started), iconColor: .emerald)
                }
                if let ended = debate.endedAt {
                    metaRow(icon: "stop.fill", label: "Ended", value: formattedDate(ended), iconColor: .against)
                }
            }
            .padding(Spacing.md)
        }
    }

    private func metaRow(icon: String, label: String, value: String, iconColor: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(iconColor)
                .frame(width: 20, alignment: .center)
            Text(label)
                .font(.lmCaption)
                .foregroundStyle(.surface400)
            Spacer()
            Text(value)
                .font(.lmCaption)
                .foregroundStyle(.textSecondary)
        }
    }

    // MARK: - Open web button

    private var openWebButton: some View {
        Button {
            openDebateInWeb()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "safari")
                    .font(.system(size: 14, weight: .medium))
                Text("Open full debate page")
                    .font(.lmCaption)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 10, weight: .medium))
            }
            .foregroundStyle(.surface400)
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.sm)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.md)
        .padding(.bottom, Spacing.sm)
    }

    // MARK: - Badge helpers

    private var typeBadge: some View {
        HStack(spacing: 4) {
            Image(systemName: debate.type.systemImage)
                .font(.system(size: 9, weight: .bold))
            Text(debate.type.displayName.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .kerning(0.5)
        }
        .foregroundStyle(typeColor)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(typeColor.opacity(0.12))
        .clipShape(Capsule())
    }

    private var livePill: some View {
        HStack(spacing: 4) {
            Circle().fill(Color.red).frame(width: 6, height: 6)
            Text("LIVE")
                .font(.system(size: 9, weight: .bold))
                .kerning(0.6)
                .foregroundStyle(.red)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.red.opacity(0.10))
        .clipShape(Capsule())
    }

    private var scheduledPill: some View {
        HStack(spacing: 4) {
            Image(systemName: "clock.fill")
                .font(.system(size: 9, weight: .bold))
            Text("UPCOMING")
                .font(.system(size: 9, weight: .bold))
                .kerning(0.6)
        }
        .foregroundStyle(.gold)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.gold.opacity(0.10))
        .clipShape(Capsule())
    }

    private var endedPill: some View {
        Text("ENDED")
            .font(.system(size: 9, weight: .bold))
            .kerning(0.6)
            .foregroundStyle(.surface400)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.surface300)
            .clipShape(Capsule())
    }

    private func statPill(icon: String, value: String, label: String, color: Color) -> some View {
        HStack(spacing: 5) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(color)
            Text("\(value) \(label)")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.textSecondary)
        }
    }

    private var typeColor: Color {
        switch debate.type {
        case .quick:    return .forBlue
        case .grand:    return .gold
        case .tribunal: return .purple
        }
    }

    // MARK: - Helpers

    private func openDebateInWeb() {
        if let url = URL(string: "\(Config.webURL)/debate/\(debate.id)") {
            openURL(url)
        }
    }

    private func formattedDate(_ date: Date) -> String {
        let fmt = DateFormatter()
        fmt.dateStyle = .medium
        fmt.timeStyle = .short
        return fmt.string(from: date)
    }

    private func updateCountdown() {
        let remaining = debate.scheduledAt.timeIntervalSinceNow
        timeRemaining = max(0, remaining)
    }

    // MARK: - Data

    private func loadRSVPState() async {
        updateCountdown()
        loadingRSVP = true
        async let count = (try? await SupabaseClient.shared.fetchDebateRSVPCount(debateId: debate.id)) ?? 0
        async let rsvped: Bool = {
            guard let uid = auth.currentUserId else { return false }
            return (try? await SupabaseClient.shared.isUserRSVPed(debateId: debate.id, userId: uid)) ?? false
        }()
        let (c, r) = await (count, rsvped)
        rsvpCount = c
        isRSVPed = r
        loadingRSVP = false
    }

    private func toggleRSVP() async {
        guard let uid = auth.currentUserId, !rsvpBusy else { return }
        rsvpBusy = true
        do {
            if isRSVPed {
                try await SupabaseClient.shared.unrsvpFromDebate(debateId: debate.id, userId: uid)
                isRSVPed = false
                rsvpCount = max(0, rsvpCount - 1)
            } else {
                try await SupabaseClient.shared.rsvpToDebate(debateId: debate.id, userId: uid)
                isRSVPed = true
                rsvpCount += 1
            }
        } catch {
            // best-effort
        }
        rsvpBusy = false
    }
}

// MARK: - Pressable button style (reuse pattern from other views)

private struct PressableButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.88 : 1)
            .animation(.spring(response: 0.2, dampingFraction: 0.8), value: configuration.isPressed)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        DebateDetailView(debate: Debate.sampleData[0])
            .environmentObject(AuthService())
    }
    .preferredColorScheme(.dark)
}
