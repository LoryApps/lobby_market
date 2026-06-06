//
//  NotificationsView.swift
//  LobbyMarket
//
//  Full notifications screen — grouped by today/earlier, skeleton loading,
//  mark-all-as-read, empty state, and topic navigation on tap.
//

import SwiftUI

struct NotificationsView: View {
    @EnvironmentObject var auth: AuthService
    @State private var notifications: [LMNotification] = []
    @State private var loading = true
    @State private var markingRead = false
    @State private var error: String?

    private var unreadCount: Int {
        notifications.filter { !$0.isRead }.count
    }

    private var todayNotifs: [LMNotification] {
        let cutoff = Calendar.current.startOfDay(for: Date())
        return notifications.filter { $0.createdAt >= cutoff }
    }

    private var earlierNotifs: [LMNotification] {
        let cutoff = Calendar.current.startOfDay(for: Date())
        return notifications.filter { $0.createdAt < cutoff }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                if loading {
                    skeletonList
                } else if notifications.isEmpty {
                    emptyState
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0, pinnedViews: []) {
                            if !todayNotifs.isEmpty {
                                sectionHeader("Today")
                                ForEach(todayNotifs) { notif in
                                    NotificationRow(notification: notif)
                                    Divider()
                                        .background(Color.surface200)
                                        .padding(.leading, 56)
                                }
                            }

                            if !earlierNotifs.isEmpty {
                                sectionHeader("Earlier")
                                ForEach(earlierNotifs) { notif in
                                    NotificationRow(notification: notif)
                                    Divider()
                                        .background(Color.surface200)
                                        .padding(.leading, 56)
                                }
                            }
                        }
                        .padding(.bottom, 24)
                    }
                }
            }
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                if unreadCount > 0 {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button {
                            markAllRead()
                        } label: {
                            if markingRead {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .tint(.forBlue)
                                    .scaleEffect(0.7)
                            } else {
                                Text("Mark all read")
                                    .font(.lmCaption)
                                    .foregroundStyle(.forBlue)
                            }
                        }
                        .disabled(markingRead)
                    }
                }
            }
            .task { await loadNotifications() }
        }
    }

    // MARK: - Subviews

    private func sectionHeader(_ label: String) -> some View {
        Text(label.uppercased())
            .font(.system(size: 10, weight: .semibold))
            .kerning(1.0)
            .foregroundStyle(.textTertiary)
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.xs)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.surface0)
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.md) {
            ZStack {
                Circle()
                    .fill(Color.surface200)
                    .frame(width: 72, height: 72)
                Image(systemName: "bell.slash")
                    .font(.system(size: 28))
                    .foregroundStyle(.textTertiary)
            }
            VStack(spacing: 6) {
                Text("All caught up")
                    .font(.lmTitle)
                    .foregroundStyle(.textPrimary)
                Text("Vote on topics and join debates\nto see activity here.")
                    .font(.lmBody)
                    .foregroundStyle(.textTertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Spacing.xl)
    }

    private var skeletonList: some View {
        VStack(spacing: 0) {
            ForEach(0..<8, id: \.self) { _ in
                NotificationSkeletonRow()
                Divider()
                    .background(Color.surface200)
                    .padding(.leading, 56)
            }
        }
    }

    // MARK: - Actions

    private func loadNotifications() async {
        guard let uid = auth.currentUserId else {
            loading = false
            return
        }
        loading = true
        do {
            notifications = try await SupabaseClient.shared.fetchNotifications(userId: uid)
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func markAllRead() {
        guard let uid = auth.currentUserId else { return }
        markingRead = true
        Task {
            try? await SupabaseClient.shared.markAllNotificationsRead(userId: uid)
            notifications = notifications.map { n in
                LMNotification(
                    id: n.id, userId: n.userId, type: n.type,
                    title: n.title, body: n.body, topicId: n.topicId,
                    isRead: true, createdAt: n.createdAt
                )
            }
            await MainActor.run { markingRead = false }
        }
    }
}

// MARK: - Notification row

struct NotificationRow: View {
    let notification: LMNotification

    private var accentColor: Color {
        switch notification.type.accentColor {
        case "gold":     return .gold
        case "emerald":  return .emerald
        case "purple":   return .purple
        default:         return .forBlue
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            // Icon
            ZStack {
                Circle()
                    .fill(accentColor.opacity(0.14))
                    .frame(width: 36, height: 36)
                Image(systemName: notification.type.systemImage)
                    .font(.system(size: 15))
                    .foregroundStyle(accentColor)
            }

            // Content
            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline, spacing: Spacing.xs) {
                    Text(notification.title ?? notification.type.displayTitle)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.textPrimary)
                    Spacer()
                    Text(relativeTime(notification.createdAt))
                        .font(.lmMono)
                        .foregroundStyle(.textTertiary)
                }

                if let body = notification.body {
                    Text(body)
                        .font(.lmBody)
                        .foregroundStyle(.textSecondary)
                        .lineLimit(3)
                }
            }

            // Unread dot
            if !notification.isRead {
                Circle()
                    .fill(Color.forBlue)
                    .frame(width: 7, height: 7)
                    .padding(.top, 5)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(notification.isRead ? Color.clear : Color.forBlue.opacity(0.04))
        .contentShape(Rectangle())
    }

    private func relativeTime(_ date: Date) -> String {
        let diff = Date().timeIntervalSince(date)
        if diff < 60        { return "now" }
        if diff < 3600      { return "\(Int(diff / 60))m" }
        if diff < 86400     { return "\(Int(diff / 3600))h" }
        if diff < 604800    { return "\(Int(diff / 86400))d" }
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return f.string(from: date)
    }
}

// MARK: - Skeleton row

private struct NotificationSkeletonRow: View {
    @State private var animate = false

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            Circle()
                .fill(Color.surface200)
                .frame(width: 36, height: 36)

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.surface300)
                        .frame(width: 120, height: 13)
                    Spacer()
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.surface300)
                        .frame(width: 28, height: 11)
                }
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.surface300)
                    .frame(height: 11)
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.surface300)
                    .frame(height: 11)
                    .padding(.trailing, 60)
            }
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .opacity(animate ? 0.45 : 1.0)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                animate = true
            }
        }
    }
}

// MARK: - Preview

#Preview {
    NotificationsView()
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
