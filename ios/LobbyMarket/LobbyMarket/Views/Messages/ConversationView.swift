//
//  ConversationView.swift
//  LobbyMarket
//
//  1-to-1 conversation thread. Outgoing messages bubble right (blue),
//  incoming messages bubble left (dark surface). Sends via PostgREST.
//  Marks conversation as read on appear. Auto-scrolls to the latest message.
//

import SwiftUI

struct ConversationView: View {
    let partner: DmProfile

    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    @State private var messages: [DirectMessage] = []
    @State private var loading = true
    @State private var sending = false
    @State private var draft = ""
    @State private var error: String?
    @FocusState private var inputFocused: Bool

    private var myId: String { auth.currentUserId ?? "" }

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            VStack(spacing: 0) {
                // Message list
                if loading {
                    loadingView
                } else if messages.isEmpty {
                    emptyThread
                } else {
                    messageList
                }

                Divider().background(Color.surface200)

                // Composer
                composer
            }
        }
        .navigationTitle(partner.displayLabel)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 1) {
                    Text(partner.displayLabel)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.textPrimary)
                    Text("@\(partner.username)")
                        .font(.lmMono)
                        .foregroundStyle(.textTertiary)
                }
            }
        }
        .task {
            await loadMessages()
            await markRead()
        }
    }

    // MARK: - Message list

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(groupedMessages.enumerated()), id: \.element.id) { idx, group in
                        // Date separator when day changes
                        if idx == 0 || !sameDay(groupedMessages[idx - 1].date, group.date) {
                            dateSeparator(group.date)
                        }
                        MessageBubble(
                            message: group,
                            isMine: group.senderId == myId
                        )
                    }
                    // Scroll anchor
                    Color.clear.frame(height: 1).id("bottom")
                }
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.md)
            }
            .onAppear {
                proxy.scrollTo("bottom", anchor: .bottom)
            }
            .onChange(of: messages.count) { _, _ in
                withAnimation(.easeOut(duration: 0.25)) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }
        }
    }

    // MARK: - Grouped message model

    private struct GroupedMessage: Identifiable {
        let id: String
        let senderId: String
        let content: String
        let date: Date
        let isRead: Bool
    }

    private var groupedMessages: [GroupedMessage] {
        messages.map { GroupedMessage(id: $0.id, senderId: $0.senderId,
                                     content: $0.content, date: $0.createdAt,
                                     isRead: $0.isRead) }
    }

    private func sameDay(_ a: Date, _ b: Date) -> Bool {
        Calendar.current.isDate(a, inSameDayAs: b)
    }

    private func dateSeparator(_ date: Date) -> some View {
        HStack {
            VStack { Divider().background(Color.surface300) }
            Text(dateSeparatorLabel(date))
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.textTertiary)
                .padding(.horizontal, 8)
                .fixedSize()
            VStack { Divider().background(Color.surface300) }
        }
        .padding(.vertical, 8)
    }

    private func dateSeparatorLabel(_ date: Date) -> String {
        if Calendar.current.isDateInToday(date)     { return "Today" }
        if Calendar.current.isDateInYesterday(date) { return "Yesterday" }
        let f = DateFormatter(); f.dateFormat = "MMM d"; return f.string(from: date)
    }

    // MARK: - Loading / empty

    private var loadingView: some View {
        VStack(spacing: Spacing.md) {
            ForEach(0..<5, id: \.self) { i in
                BubbleSkeleton(alignRight: i % 3 == 0)
            }
        }
        .padding(Spacing.md)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
    }

    private var emptyThread: some View {
        VStack(spacing: Spacing.sm) {
            AvatarCircle(
                username: partner.username,
                avatarURL: partner.avatarURL,
                size: 56
            )
            Text(partner.displayLabel)
                .font(.lmTitle)
                .foregroundStyle(.textPrimary)
            Text("Start your conversation with\n@\(partner.username)")
                .font(.lmBody)
                .foregroundStyle(.textTertiary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(Spacing.xl)
    }

    // MARK: - Composer

    private var composer: some View {
        HStack(alignment: .bottom, spacing: Spacing.sm) {
            ZStack(alignment: .topLeading) {
                if draft.isEmpty {
                    Text("Message \(partner.displayLabel)…")
                        .font(.lmBody)
                        .foregroundStyle(.textTertiary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 9)
                }
                TextEditor(text: $draft)
                    .font(.lmBody)
                    .foregroundStyle(.textPrimary)
                    .scrollContentBackground(.hidden)
                    .frame(minHeight: 36, maxHeight: 120)
                    .focused($inputFocused)
            }
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, 6)
            .background(Color.surface200)
            .clipShape(RoundedRectangle(cornerRadius: 16))

            Button {
                Task { await sendMessage() }
            } label: {
                ZStack {
                    Circle()
                        .fill(canSend ? Color.forBlue : Color.surface200)
                        .frame(width: 36, height: 36)
                    if sending {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .tint(.white)
                            .scaleEffect(0.7)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundStyle(canSend ? .white : .textTertiary)
                    }
                }
            }
            .disabled(!canSend || sending)
            .animation(.easeInOut(duration: 0.15), value: canSend)
        }
        .padding(.horizontal, Spacing.md)
        .padding(.vertical, Spacing.sm)
        .background(Color.surface0)
    }

    private var canSend: Bool {
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !sending
    }

    // MARK: - Actions

    private func loadMessages() async {
        loading = true
        error = nil
        do {
            messages = try await SupabaseClient.shared.fetchDirectMessages(
                myId: myId, partnerId: partner.id
            )
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func markRead() async {
        try? await SupabaseClient.shared.markConversationRead(myId: myId, partnerId: partner.id)
    }

    private func sendMessage() async {
        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        sending = true
        draft = ""
        do {
            let msg = try await SupabaseClient.shared.sendDirectMessage(
                senderId: myId,
                receiverId: partner.id,
                content: content
            )
            messages.append(msg)
        } catch {
            // Restore draft if send failed
            draft = content
            self.error = "Failed to send — check your connection."
        }
        sending = false
    }
}

// MARK: - Message bubble

private struct MessageBubble: View {
    let message: ConversationView.GroupedMessage
    let isMine: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: 4) {
            if isMine { Spacer(minLength: 60) }

            VStack(alignment: isMine ? .trailing : .leading, spacing: 3) {
                Text(message.content)
                    .font(.lmBody)
                    .foregroundStyle(isMine ? .white : .textPrimary)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(isMine ? Color.forBlue : Color.surface200)
                    .clipShape(ChatBubbleShape(isOutgoing: isMine))

                Text(timeString(message.date))
                    .font(.system(size: 10))
                    .foregroundStyle(.textTertiary)
                    .padding(.horizontal, 4)
            }

            if !isMine { Spacer(minLength: 60) }
        }
        .padding(.vertical, 2)
    }

    private func timeString(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return f.string(from: date)
    }
}

// MARK: - Custom bubble shape (rounded with one sharp corner)

private struct ChatBubbleShape: Shape {
    let isOutgoing: Bool
    let radius: CGFloat = 16

    func path(in rect: CGRect) -> Path {
        let tr = isOutgoing ? CGFloat(4) : radius
        let tl = isOutgoing ? radius    : CGFloat(4)
        let bl: CGFloat = radius
        let br: CGFloat = radius

        var path = Path()
        path.move(to: CGPoint(x: rect.minX + tl, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX - tr, y: rect.minY))
        path.addArc(center: CGPoint(x: rect.maxX - tr, y: rect.minY + tr),
                    radius: tr, startAngle: .degrees(-90), endAngle: .degrees(0), clockwise: false)
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - br))
        path.addArc(center: CGPoint(x: rect.maxX - br, y: rect.maxY - br),
                    radius: br, startAngle: .degrees(0), endAngle: .degrees(90), clockwise: false)
        path.addLine(to: CGPoint(x: rect.minX + bl, y: rect.maxY))
        path.addArc(center: CGPoint(x: rect.minX + bl, y: rect.maxY - bl),
                    radius: bl, startAngle: .degrees(90), endAngle: .degrees(180), clockwise: false)
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + tl))
        path.addArc(center: CGPoint(x: rect.minX + tl, y: rect.minY + tl),
                    radius: tl, startAngle: .degrees(180), endAngle: .degrees(270), clockwise: false)
        path.closeSubpath()
        return path
    }
}

// MARK: - Bubble skeleton

private struct BubbleSkeleton: View {
    let alignRight: Bool
    @State private var animate = false

    var body: some View {
        HStack {
            if alignRight { Spacer(minLength: 80) }
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.surface200)
                .frame(height: 40)
            if !alignRight { Spacer(minLength: 80) }
        }
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
    NavigationStack {
        ConversationView(partner: DmProfile(
            id: "preview",
            username: "rep_vega",
            displayName: "Rep. Vega",
            role: "elder"
        ))
        .environmentObject(AuthService())
    }
    .preferredColorScheme(.dark)
}
