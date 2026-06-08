//
//  OnboardingView.swift
//  LobbyMarket
//
//  First-launch welcome experience: brand intro → 5-question calibration
//  quiz → category selection → notification opt-in → completion.
//

import SwiftUI
import UserNotifications

// MARK: - Model

private struct QuizQuestion {
    let topic: String
    let icon: String
    let leftLabel: String
    let rightLabel: String
    let leftColor: Color
    let rightColor: Color
}

private let QUIZ_QUESTIONS: [QuizQuestion] = [
    QuizQuestion(
        topic: "Economics",
        icon: "chart.bar.fill",
        leftLabel: "Markets need\nregulation",
        rightLabel: "Markets should\nbe free",
        leftColor: .forBlue,
        rightColor: .gold
    ),
    QuizQuestion(
        topic: "Technology",
        icon: "cpu",
        leftLabel: "AI poses\nserious risks",
        rightLabel: "AI accelerates\nprogress",
        leftColor: .againstRed,
        rightColor: .emerald
    ),
    QuizQuestion(
        topic: "Governance",
        icon: "building.2.fill",
        leftLabel: "Local decisions\nwork best",
        rightLabel: "Central coordination\nmatters",
        leftColor: .purple,
        rightColor: .forBlue
    ),
    QuizQuestion(
        topic: "Society",
        icon: "person.3.fill",
        leftLabel: "Collective\nwellbeing first",
        rightLabel: "Individual\nliberty first",
        leftColor: .emerald,
        rightColor: .gold
    ),
    QuizQuestion(
        topic: "Future",
        icon: "sparkles",
        leftLabel: "Cautious about\nrapid change",
        rightLabel: "Optimistic about\nhumanity",
        leftColor: .surface400,
        rightColor: .purple
    ),
]

private let CATEGORIES = [
    ("Economics", "chart.bar.fill", Color.gold),
    ("Politics", "building.columns.fill", Color.forBlue),
    ("Technology", "cpu", Color.purple),
    ("Science", "atom", Color.emerald),
    ("Ethics", "scale.3d", Color.againstRed),
    ("Philosophy", "brain.head.profile", Color.purple),
    ("Culture", "theatermasks.fill", Color.gold),
    ("Health", "heart.fill", Color.emerald),
    ("Environment", "leaf.fill", Color.emerald),
    ("Education", "graduationcap.fill", Color.forBlue),
]

// MARK: - Root View

struct OnboardingView: View {
    @Binding var isComplete: Bool
    @EnvironmentObject var auth: AuthService

    @State private var step: Int = 0
    @State private var quizAnswers: [Int] = Array(repeating: -1, count: 5) // 0 = left, 1 = right
    @State private var selectedCategories: Set<String> = []
    @State private var isSaving = false
    @State private var slideDirection: Int = 1 // 1 = forward, -1 = back

    private let totalSteps = 8 // 0=welcome, 1–5=quiz, 6=categories, 7=done

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            VStack(spacing: 0) {
                // Progress bar (hidden on welcome and done screens)
                if step > 0 && step < 7 {
                    progressBar
                        .padding(.horizontal, Spacing.lg)
                        .padding(.top, Spacing.lg)
                        .transition(.opacity)
                }

                // Page content
                stepContent
                    .transition(
                        .asymmetric(
                            insertion: .move(edge: slideDirection > 0 ? .trailing : .leading).combined(with: .opacity),
                            removal: .move(edge: slideDirection > 0 ? .leading : .trailing).combined(with: .opacity)
                        )
                    )
                    .id(step)
            }
        }
    }

    // MARK: - Progress bar

    private var progressBar: some View {
        let quizProgress = min(step, 6)
        let total = 6
        return VStack(alignment: .trailing, spacing: Spacing.xxs) {
            HStack(spacing: 4) {
                ForEach(1..<total + 1, id: \.self) { i in
                    Capsule()
                        .fill(i <= quizProgress ? Color.forBlue : Color.surface300)
                        .frame(height: 3)
                        .animation(.easeInOut(duration: 0.3), value: quizProgress)
                }
            }
            Text("Step \(quizProgress) of \(total)")
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
        }
    }

    // MARK: - Step routing

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0:
            WelcomeStep(onContinue: advance)
        case 1...5:
            let index = step - 1
            QuizStep(
                question: QUIZ_QUESTIONS[index],
                questionNumber: index + 1,
                totalQuestions: 5,
                selectedAnswer: quizAnswers[index],
                onSelect: { answer in
                    quizAnswers[index] = answer
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { advance() }
                }
            )
        case 6:
            CategoriesStep(
                categories: CATEGORIES,
                selectedCategories: $selectedCategories,
                onContinue: advance
            )
        case 7:
            CompleteStep(isSaving: isSaving, onStart: finish)
        default:
            EmptyView()
        }
    }

    // MARK: - Navigation

    private func advance() {
        slideDirection = 1
        withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) {
            step += 1
        }
        Haptics.selection()
    }

    private func finish() {
        guard !isSaving else { return }
        isSaving = true
        Haptics.notify(.success)

        Task {
            await savePreferences()
            await MainActor.run {
                isSaving = false
                withAnimation(.easeInOut(duration: 0.4)) {
                    isComplete = true
                }
            }
        }
    }

    // MARK: - Save to Supabase

    private func savePreferences() async {
        guard let userId = auth.currentUserId else { return }
        let categories = Array(selectedCategories)
        do {
            try await SupabaseClient.shared.completeOnboarding(
                userId: userId,
                categoryPreferences: categories
            )
        } catch {
            // Non-fatal — onboarding still completes locally
        }
    }
}

// MARK: - Welcome Step

private struct WelcomeStep: View {
    let onContinue: () -> Void

    @State private var appeared = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Brand mark
            VStack(spacing: Spacing.lg) {
                ZStack {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [Color.forBlue.opacity(0.25), Color.clear],
                                center: .center,
                                startRadius: 20,
                                endRadius: 70
                            )
                        )
                        .frame(width: 140, height: 140)

                    Image(systemName: "building.columns.fill")
                        .font(.system(size: 56, weight: .semibold))
                        .foregroundStyle(
                            LinearGradient(
                                colors: [.forBlue, Color(red: 99/255, green: 102/255, blue: 241/255)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                }
                .scaleEffect(appeared ? 1 : 0.6)
                .opacity(appeared ? 1 : 0)

                VStack(spacing: Spacing.sm) {
                    Text("LOBBY MARKET")
                        .font(.system(size: 32, weight: .heavy, design: .rounded))
                        .kerning(2)
                        .foregroundStyle(.white)

                    Text("Where ideas compete,\nvotes decide, and the best\narguments become law.")
                        .font(.lmBody)
                        .foregroundStyle(.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                }
                .offset(y: appeared ? 0 : 16)
                .opacity(appeared ? 1 : 0)
            }

            Spacer()

            // Feature pills
            VStack(spacing: Spacing.xs) {
                HStack(spacing: Spacing.xs) {
                    FeaturePill(icon: "hand.thumbsup.fill", label: "Vote on Topics", color: .forBlue)
                    FeaturePill(icon: "mic.fill", label: "Watch Debates", color: .purple)
                }
                HStack(spacing: Spacing.xs) {
                    FeaturePill(icon: "books.vertical.fill", label: "Shape Laws", color: .gold)
                    FeaturePill(icon: "chart.bar.fill", label: "Track Impact", color: .emerald)
                }
            }
            .padding(.horizontal, Spacing.lg)
            .offset(y: appeared ? 0 : 24)
            .opacity(appeared ? 1 : 0)

            Spacer()

            // CTA
            Button(action: onContinue) {
                HStack(spacing: Spacing.sm) {
                    Text("Get Started")
                        .font(.lmBodyBold)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 15, weight: .semibold))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.md)
                .background(
                    LinearGradient(
                        colors: [.forBlue, Color(red: 37/255, green: 99/255, blue: 235/255)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .cornerRadius(Radii.lg)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, Spacing.xxl)
            .offset(y: appeared ? 0 : 20)
            .opacity(appeared ? 1 : 0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.8).delay(0.1)) {
                appeared = true
            }
        }
    }
}

private struct FeaturePill: View {
    let icon: String
    let label: String
    let color: Color

    var body: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(color)
            Text(label)
                .font(.lmCaption)
                .foregroundStyle(.textSecondary)
        }
        .padding(.horizontal, Spacing.sm)
        .padding(.vertical, Spacing.xs)
        .background(
            RoundedRectangle(cornerRadius: Radii.sm)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.sm)
                        .stroke(color.opacity(0.3), lineWidth: 1)
                )
        )
    }
}

// MARK: - Quiz Step

private struct QuizStep: View {
    let question: QuizQuestion
    let questionNumber: Int
    let totalQuestions: Int
    let selectedAnswer: Int
    let onSelect: (Int) -> Void

    @State private var pressedIndex: Int? = nil
    @State private var appeared = false

    var body: some View {
        VStack(spacing: Spacing.xl) {
            Spacer()

            // Question header
            VStack(spacing: Spacing.sm) {
                HStack(spacing: Spacing.xs) {
                    Image(systemName: question.icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.textTertiary)
                    Text(question.topic.uppercased())
                        .font(.lmMono)
                        .foregroundStyle(.textTertiary)
                        .kerning(1.5)
                }

                Text("Which position is\ncloser to your view?")
                    .font(.lmDisplayMedium)
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
            }
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 12)

            // Choice cards
            HStack(spacing: Spacing.md) {
                QuizChoiceCard(
                    label: question.leftLabel,
                    color: question.leftColor,
                    isSelected: selectedAnswer == 0,
                    isPressed: pressedIndex == 0
                ) {
                    pressedIndex = 0
                    onSelect(0)
                }

                QuizChoiceCard(
                    label: question.rightLabel,
                    color: question.rightColor,
                    isSelected: selectedAnswer == 1,
                    isPressed: pressedIndex == 1
                ) {
                    pressedIndex = 1
                    onSelect(1)
                }
            }
            .padding(.horizontal, Spacing.lg)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 20)

            Text("Tap to select · No wrong answers")
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
                .opacity(appeared ? 1 : 0)

            Spacer()
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.05)) {
                appeared = true
            }
        }
        .onChange(of: questionNumber) { _ in
            appeared = false
            pressedIndex = nil
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.05)) {
                appeared = true
            }
        }
    }
}

private struct QuizChoiceCard: View {
    let label: String
    let color: Color
    let isSelected: Bool
    let isPressed: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: {
            Haptics.impact(.medium)
            onTap()
        }) {
            VStack(spacing: Spacing.sm) {
                Spacer()
                Circle()
                    .fill(color.opacity(isSelected ? 0.2 : 0.08))
                    .frame(width: 48, height: 48)
                    .overlay(
                        Circle().stroke(color.opacity(isSelected ? 0.8 : 0.25), lineWidth: isSelected ? 2 : 1)
                    )
                    .overlay(
                        Image(systemName: isSelected ? "checkmark" : "questionmark")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(isSelected ? color : .textTertiary)
                    )

                Text(label)
                    .font(.lmBodyBold)
                    .foregroundStyle(isSelected ? .white : .textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer()
            }
            .frame(maxWidth: .infinity, minHeight: 160)
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .fill(isSelected ? color.opacity(0.08) : Color.surface200)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg)
                            .stroke(isSelected ? color.opacity(0.6) : Color.white.opacity(0.06), lineWidth: isSelected ? 1.5 : 1)
                    )
            )
            .scaleEffect(isPressed ? 0.96 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isSelected)
            .animation(.spring(response: 0.2, dampingFraction: 0.6), value: isPressed)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Categories Step

private struct CategoriesStep: View {
    let categories: [(String, String, Color)]
    @Binding var selectedCategories: Set<String>
    let onContinue: () -> Void

    @State private var appeared = false

    private var canContinue: Bool { selectedCategories.count >= 2 }

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: Spacing.lg)

            VStack(spacing: Spacing.sm) {
                Text("What interests you?")
                    .font(.lmDisplayMedium)
                    .foregroundStyle(.white)

                Text("Pick at least 2 topics you care about.\nWe'll tune your feed accordingly.")
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
            }
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 12)
            .padding(.horizontal, Spacing.lg)

            Spacer(minLength: Spacing.lg)

            // Category grid
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Spacing.sm) {
                ForEach(categories, id: \.0) { name, icon, color in
                    CategoryToggle(
                        name: name,
                        icon: icon,
                        color: color,
                        isSelected: selectedCategories.contains(name)
                    ) {
                        Haptics.selection()
                        if selectedCategories.contains(name) {
                            selectedCategories.remove(name)
                        } else {
                            selectedCategories.insert(name)
                        }
                    }
                }
            }
            .padding(.horizontal, Spacing.lg)
            .opacity(appeared ? 1 : 0)
            .offset(y: appeared ? 0 : 20)

            Spacer(minLength: Spacing.lg)

            VStack(spacing: Spacing.sm) {
                if !canContinue {
                    Text("\(max(0, 2 - selectedCategories.count)) more to go")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                        .transition(.opacity)
                }

                Button(action: onContinue) {
                    HStack(spacing: Spacing.sm) {
                        Text(canContinue ? "Continue" : "Select at least 2")
                            .font(.lmBodyBold)
                        if canContinue {
                            Image(systemName: "arrow.right")
                                .font(.system(size: 14, weight: .semibold))
                        }
                    }
                    .foregroundStyle(canContinue ? .white : .textTertiary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.lg)
                            .fill(canContinue ? Color.forBlue : Color.surface200)
                            .overlay(
                                RoundedRectangle(cornerRadius: Radii.lg)
                                    .stroke(canContinue ? Color.clear : Color.white.opacity(0.06), lineWidth: 1)
                            )
                    )
                }
                .disabled(!canContinue)
                .animation(.spring(response: 0.3, dampingFraction: 0.8), value: canContinue)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, Spacing.xxl)
            .opacity(appeared ? 1 : 0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.05)) {
                appeared = true
            }
        }
    }
}

private struct CategoryToggle: View {
    let name: String
    let icon: String
    let color: Color
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Spacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(isSelected ? color : .textTertiary)
                    .frame(width: 20)

                Text(name)
                    .font(.lmHeadline)
                    .foregroundStyle(isSelected ? .white : .textSecondary)

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(isSelected ? color : .surface400)
            }
            .padding(.horizontal, Spacing.sm)
            .padding(.vertical, Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(isSelected ? color.opacity(0.08) : Color.surface200)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .stroke(isSelected ? color.opacity(0.5) : Color.white.opacity(0.06), lineWidth: 1)
                    )
            )
            .animation(.spring(response: 0.25, dampingFraction: 0.75), value: isSelected)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Complete Step

private struct CompleteStep: View {
    let isSaving: Bool
    let onStart: () -> Void

    @State private var appeared = false
    @State private var notifRequested = false
    @State private var pulseScale: CGFloat = 1

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: Spacing.xl) {
                // Animated checkmark / spinner
                ZStack {
                    Circle()
                        .fill(Color.emerald.opacity(0.1))
                        .frame(width: 120, height: 120)
                        .scaleEffect(pulseScale)
                        .animation(
                            .easeInOut(duration: 1.8).repeatForever(autoreverses: true),
                            value: pulseScale
                        )

                    Circle()
                        .fill(Color.emerald.opacity(0.2))
                        .frame(width: 90, height: 90)

                    if isSaving {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .tint(.emerald)
                            .scaleEffect(1.3)
                    } else {
                        Image(systemName: "checkmark")
                            .font(.system(size: 40, weight: .bold))
                            .foregroundStyle(.emerald)
                    }
                }
                .scaleEffect(appeared ? 1 : 0.5)
                .opacity(appeared ? 1 : 0)
                .onAppear { pulseScale = 1.08 }

                VStack(spacing: Spacing.sm) {
                    Text("You're in the Lobby.")
                        .font(.lmDisplayLarge)
                        .foregroundStyle(.white)
                        .multilineTextAlignment(.center)

                    Text("Your feed is calibrated.\nVote, argue, and help shape\nthe laws of tomorrow.")
                        .font(.lmBody)
                        .foregroundStyle(.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(4)
                }
                .offset(y: appeared ? 0 : 16)
                .opacity(appeared ? 1 : 0)
            }

            Spacer()

            VStack(spacing: Spacing.sm) {
                // Push notification opt-in
                if !notifRequested {
                    Button {
                        Haptics.impact(.light)
                        requestNotifications()
                    } label: {
                        HStack(spacing: Spacing.sm) {
                            Image(systemName: "bell.badge.fill")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(.gold)
                            Text("Enable Debate Alerts")
                                .font(.lmHeadline)
                                .foregroundStyle(.textSecondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: Radii.lg)
                                .fill(Color.surface200)
                                .overlay(
                                    RoundedRectangle(cornerRadius: Radii.lg)
                                        .stroke(Color.gold.opacity(0.3), lineWidth: 1)
                                )
                        )
                    }
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                }

                Button(action: onStart) {
                    HStack(spacing: Spacing.sm) {
                        Text(isSaving ? "Saving…" : "Enter the Lobby")
                            .font(.lmBodyBold)
                        if !isSaving {
                            Image(systemName: "arrow.right")
                                .font(.system(size: 14, weight: .semibold))
                        }
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.md)
                    .background(
                        LinearGradient(
                            colors: isSaving
                                ? [Color.surface300, Color.surface300]
                                : [.forBlue, Color(red: 37/255, green: 99/255, blue: 235/255)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .cornerRadius(Radii.lg)
                }
                .disabled(isSaving)
                .animation(.easeInOut(duration: 0.2), value: isSaving)
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, Spacing.xxl)
            .offset(y: appeared ? 0 : 20)
            .opacity(appeared ? 1 : 0)
        }
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.75).delay(0.1)) {
                appeared = true
            }
        }
    }

    private func requestNotifications() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in
            DispatchQueue.main.async {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    notifRequested = true
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    OnboardingView(isComplete: .constant(false))
        .environmentObject(AuthService())
}
