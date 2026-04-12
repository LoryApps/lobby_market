//
//  CreateTopicView.swift
//  LobbyMarket
//

import SwiftUI

struct CreateTopicView: View {
    @EnvironmentObject var auth: AuthService

    @State private var statement: String = ""
    @State private var description: String = ""
    @State private var category: String = "General"
    @State private var isSubmitting: Bool = false
    @State private var toast: String?

    private let categories = [
        "General", "Economics", "Tech Policy", "Transport",
        "Climate", "Healthcare", "Education", "Foreign Policy"
    ]

    var canSubmit: Bool {
        !statement.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSubmitting
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.md) {
                    header

                    labeledSection("STATEMENT", subtitle: "The one-line motion up for debate.") {
                        TextField("Should every citizen receive a universal basic income?", text: $statement, axis: .vertical)
                            .lineLimit(3...5)
                            .textFieldStyle(.plain)
                            .padding(Spacing.sm)
                            .background(RoundedRectangle(cornerRadius: Radii.md).fill(Color.surface200))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.md)
                                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
                            )
                            .foregroundStyle(.white)
                            .tint(.forBlue)
                    }

                    labeledSection("DESCRIPTION", subtitle: "Optional context for voters.") {
                        TextField("Supporting detail...", text: $description, axis: .vertical)
                            .lineLimit(4...8)
                            .textFieldStyle(.plain)
                            .padding(Spacing.sm)
                            .background(RoundedRectangle(cornerRadius: Radii.md).fill(Color.surface200))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.md)
                                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
                            )
                            .foregroundStyle(.white)
                            .tint(.forBlue)
                    }

                    labeledSection("CATEGORY", subtitle: nil) {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(categories, id: \.self) { cat in
                                    Button {
                                        category = cat
                                        Haptics.selection()
                                    } label: {
                                        Text(cat)
                                            .font(.lmCaption)
                                            .foregroundStyle(category == cat ? .black : .white)
                                            .padding(.horizontal, 12)
                                            .padding(.vertical, 8)
                                            .background(
                                                Capsule()
                                                    .fill(category == cat ? Color.gold : Color.surface200)
                                            )
                                    }
                                }
                            }
                        }
                    }

                    submitButton

                    if let toast {
                        Text(toast)
                            .font(.lmCaption)
                            .foregroundStyle(.textSecondary)
                    }

                    Spacer(minLength: 40)
                }
                .padding(Spacing.md)
            }
            .background(Color.surface0.ignoresSafeArea())
            .navigationTitle("New Topic")
            .navigationBarTitleDisplayMode(.large)
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Image(systemName: "plus.diamond.fill")
                .foregroundStyle(.gold)
            Text("Draft a new motion")
                .font(.lmTitle)
                .foregroundStyle(.white)
        }
    }

    @ViewBuilder
    private func labeledSection<Content: View>(
        _ title: String,
        subtitle: String?,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 11, weight: .heavy))
                .kerning(1.2)
                .foregroundStyle(.textSecondary)
            if let subtitle {
                Text(subtitle)
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
            }
            content()
        }
    }

    private var submitButton: some View {
        Button {
            submit()
        } label: {
            HStack {
                if isSubmitting {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "paperplane.fill")
                }
                Text(isSubmitting ? "Publishing..." : "Publish")
                    .font(.lmBodyBold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(LinearGradient.forGradient)
            )
            .foregroundStyle(.white)
            .opacity(canSubmit ? 1.0 : 0.45)
        }
        .disabled(!canSubmit)
        .buttonStyle(PressableButtonStyle())
    }

    private func submit() {
        guard canSubmit else { return }
        isSubmitting = true
        toast = nil
        let payload = NewTopicPayload(
            statement: statement.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description.isEmpty ? nil : description,
            category: category,
            author_id: auth.currentUserId
        )
        Task {
            do {
                _ = try await SupabaseClient.shared.createTopic(payload)
                statement = ""
                description = ""
                toast = "Published. Your motion is live on The Floor."
                Haptics.notify(.success)
            } catch {
                toast = "Failed: \(error.localizedDescription)"
                Haptics.notify(.error)
            }
            isSubmitting = false
        }
    }
}

#Preview {
    CreateTopicView()
        .environmentObject(AuthService())
}
