//
//  PostArgumentSheet.swift
//  LobbyMarket
//
//  Compose sheet for submitting a FOR or AGAINST argument on a topic.
//  Opens from TopicDetailView's argument section header.
//

import SwiftUI

struct PostArgumentSheet: View {
    let topic: Topic
    let initialSide: Argument.ArgumentSide

    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    @State private var side: Argument.ArgumentSide
    @State private var content = ""
    @State private var submitting = false
    @State private var submitError: String?

    private let maxChars = 500

    private var remaining: Int { maxChars - content.count }
    private var canSubmit: Bool { content.trimmingCharacters(in: .whitespacesAndNewlines).count >= 20 && !submitting }
    private var remainingColor: Color {
        if remaining < 0    { return .againstRed }
        if remaining < 40   { return .gold }
        return .textTertiary
    }

    init(topic: Topic, initialSide: Argument.ArgumentSide = .blue) {
        self.topic = topic
        self.initialSide = initialSide
        _side = State(initialValue: initialSide)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                VStack(spacing: 0) {
                    // ── Side picker ─────────────────────────────────────────
                    sidePicker
                        .padding(.horizontal, Spacing.md)
                        .padding(.top, Spacing.sm)

                    Divider()
                        .background(Color.surface200)
                        .padding(.top, Spacing.sm)

                    // ── Topic statement preview ──────────────────────────────
                    topicPreview
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.sm)

                    Divider()
                        .background(Color.surface200)

                    // ── Text editor ─────────────────────────────────────────
                    textComposer
                        .padding(.horizontal, Spacing.md)

                    Spacer()

                    // ── Footer: char counter + submit ────────────────────────
                    footer
                        .padding(.horizontal, Spacing.md)
                        .padding(.bottom, Spacing.lg)
                }
            }
            .navigationTitle("Write Argument")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(.textSecondary)
                }
            }
        }
    }

    // MARK: - Subviews

    private var sidePicker: some View {
        HStack(spacing: Spacing.sm) {
            ForEach([Argument.ArgumentSide.blue, .red], id: \.self) { s in
                let isSel = side == s
                let color: Color = s == .blue ? .forBlue : .againstRed
                let label = s == .blue ? "FOR" : "AGAINST"

                Button {
                    Haptics.selection()
                    withAnimation(.spring(duration: 0.2)) { side = s }
                } label: {
                    HStack(spacing: 6) {
                        Circle()
                            .fill(isSel ? color : color.opacity(0.3))
                            .frame(width: 8, height: 8)
                        Text(label)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(isSel ? color : .textTertiary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .fill(isSel ? color.opacity(0.12) : Color.surface200)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.md)
                                    .stroke(isSel ? color.opacity(0.4) : Color.clear, lineWidth: 1)
                            )
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var topicPreview: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: "quote.opening")
                .font(.system(size: 11))
                .foregroundStyle(.textTertiary)
            Text(topic.statement)
                .font(.system(size: 12))
                .foregroundStyle(.textSecondary)
                .lineLimit(2)
        }
    }

    private var textComposer: some View {
        ZStack(alignment: .topLeading) {
            if content.isEmpty {
                Text(side == .blue
                     ? "Make the case FOR this topic…"
                     : "Make the case AGAINST this topic…")
                    .font(.lmBody)
                    .foregroundStyle(.textTertiary)
                    .padding(.top, Spacing.sm + 2)
                    .allowsHitTesting(false)
            }
            TextEditor(text: $content)
                .font(.lmBody)
                .foregroundStyle(.textPrimary)
                .scrollContentBackground(.hidden)
                .background(Color.clear)
                .frame(minHeight: 140)
                .onChange(of: content) { _, newValue in
                    if newValue.count > maxChars + 20 {
                        content = String(newValue.prefix(maxChars + 20))
                    }
                }
        }
    }

    private var footer: some View {
        VStack(spacing: Spacing.sm) {
            if let err = submitError {
                Text(err)
                    .font(.lmCaption)
                    .foregroundStyle(.againstRed)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            HStack {
                // Character counter
                Text("\(remaining)")
                    .font(.lmMono)
                    .foregroundStyle(remainingColor)

                Spacer()

                // Submit
                Button {
                    submit()
                } label: {
                    HStack(spacing: 6) {
                        if submitting {
                            ProgressView()
                                .progressViewStyle(.circular)
                                .tint(.white)
                                .scaleEffect(0.7)
                        } else {
                            Image(systemName: side == .blue ? "chevron.up.2" : "chevron.down.2")
                                .font(.system(size: 12, weight: .semibold))
                        }
                        Text(submitting ? "Posting…" : "Post Argument")
                            .font(.system(size: 14, weight: .bold))
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, 10)
                    .background(
                        Capsule()
                            .fill(side == .blue
                                  ? Color.forBlue.opacity(canSubmit ? 1.0 : 0.4)
                                  : Color.againstRed.opacity(canSubmit ? 1.0 : 0.4))
                    )
                }
                .disabled(!canSubmit || remaining < 0)
            }
        }
    }

    // MARK: - Submit

    private func submit() {
        guard canSubmit, remaining >= 0 else { return }
        guard let uid = auth.currentUserId else {
            submitError = "You must be signed in to post an argument."
            return
        }
        submitting = true
        submitError = nil
        Haptics.impact(.medium)

        Task {
            do {
                _ = try await SupabaseClient.shared.postArgument(
                    topicId: topic.id,
                    side: side,
                    content: content.trimmingCharacters(in: .whitespacesAndNewlines),
                    userId: uid
                )
                await MainActor.run {
                    submitting = false
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    submitting = false
                    submitError = "Couldn't post. Please try again."
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    PostArgumentSheet(topic: Topic.sampleData[0], initialSide: .blue)
        .environmentObject(AuthService())
        .preferredColorScheme(.dark)
}
