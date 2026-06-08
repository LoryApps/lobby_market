//
//  SwipeVoteView.swift
//  LobbyMarket
//
//  Card-stack swipe voting. Swipe right → FOR (blue), left → AGAINST (red),
//  tap the skip button → moves current card to the back of the stack.
//

import SwiftUI

struct SwipeVoteView: View {
    @EnvironmentObject var auth: AuthService

    // ── State ────────────────────────────────────────────────────────────────
    @State private var topics: [Topic] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    @State private var dragOffset: CGSize = .zero
    @State private var isDragging = false
    @State private var isAnimatingOut = false

    @State private var votedFor = 0
    @State private var votedAgainst = 0
    @State private var skipped = 0
    @State private var isDone = false

    @State private var selectedTopic: Topic?

    // ── Constants ────────────────────────────────────────────────────────────
    private let swipeThreshold: CGFloat = 110
    private let maxVisibleCards = 3
    private let cardHeight: CGFloat = 420

    // ── Derived ──────────────────────────────────────────────────────────────
    private var dragProgress: CGFloat {
        min(abs(dragOffset.width) / swipeThreshold, 1.0)
    }

    private var dragSide: VoteSide? {
        if dragOffset.width > 40  { return .forSide }
        if dragOffset.width < -40 { return .againstSide }
        return nil
    }

    // ── Body ─────────────────────────────────────────────────────────────────
    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            if isLoading && topics.isEmpty {
                loadingView
            } else if isDone || (topics.isEmpty && !isLoading) {
                doneScreen
            } else {
                mainLayout
            }
        }
        .sheet(item: $selectedTopic) { topic in
            NavigationStack {
                TopicDetailView(topic: topic)
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Done") { selectedTopic = nil }
                                .foregroundStyle(.forBlue)
                        }
                    }
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .task {
            await loadTopics()
        }
    }

    // MARK: - Main layout

    private var mainLayout: some View {
        VStack(spacing: 0) {
            header
                .padding(.horizontal, Spacing.md)
                .padding(.top, Spacing.sm)

            Spacer(minLength: Spacing.lg)

            // Card stack
            ZStack {
                ForEach(
                    Array(topics.prefix(maxVisibleCards).enumerated().reversed()),
                    id: \.element.id
                ) { index, topic in
                    if index == 0 {
                        topCard(topic)
                    } else {
                        stackedCard(index: index)
                    }
                }
            }
            .padding(.horizontal, Spacing.md)
            .frame(height: cardHeight + 32)

            Spacer(minLength: Spacing.md)

            // Direction hint labels
            directionHints

            Spacer(minLength: Spacing.sm)

            actionRow
                .padding(.horizontal, Spacing.xxl)
                .padding(.bottom, Spacing.xl + 64)
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .center, spacing: Spacing.sm) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Quick Vote")
                    .font(.lmTitle)
                    .foregroundStyle(.textPrimary)
                let total = votedFor + votedAgainst
                Text(total == 0 ? "Swipe to vote" : "\(total) voted this session")
                    .font(.lmCaption)
                    .foregroundStyle(.textSecondary)
            }
            Spacer()
            if !topics.isEmpty {
                Text("\(topics.count) left")
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
                    .padding(.horizontal, Spacing.sm)
                    .padding(.vertical, Spacing.xxs + 2)
                    .background(Capsule().fill(Color.surface300))
            }
        }
    }

    // MARK: - Top draggable card

    @ViewBuilder
    private func topCard(_ topic: Topic) -> some View {
        ZStack {
            // Card background
            RoundedRectangle(cornerRadius: Radii.xl)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl)
                        .stroke(Color.white.opacity(0.07), lineWidth: 1)
                )

            // FOR overlay (right swipe)
            if dragOffset.width > 0 {
                RoundedRectangle(cornerRadius: Radii.xl)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.forBlue.opacity(dragProgress * 0.40),
                                Color.forBlueDark.opacity(dragProgress * 0.20),
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
            }

            // AGAINST overlay (left swipe)
            if dragOffset.width < 0 {
                RoundedRectangle(cornerRadius: Radii.xl)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.againstRedDark.opacity(dragProgress * 0.20),
                                Color.againstRed.opacity(dragProgress * 0.40),
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
            }

            // Card content
            cardContent(topic)
        }
        .frame(height: cardHeight)
        .rotationEffect(
            .degrees(Double(dragOffset.width) / 22),
            anchor: .bottom
        )
        .offset(dragOffset)
        .gesture(
            DragGesture(minimumDistance: 8)
                .onChanged { value in
                    isDragging = true
                    dragOffset = value.translation
                }
                .onEnded { value in
                    isDragging = false
                    let w = value.translation.width
                    let v = value.predictedEndTranslation.width
                    // Use predicted translation for faster flick
                    if w > swipeThreshold || v > swipeThreshold * 1.5 {
                        swipeOut(side: .forSide)
                    } else if w < -swipeThreshold || v < -swipeThreshold * 1.5 {
                        swipeOut(side: .againstSide)
                    } else {
                        snapBack()
                    }
                }
        )
        .animation(isDragging ? nil : .spring(response: 0.45, dampingFraction: 0.80), value: dragOffset)
        .shadow(color: .black.opacity(0.45), radius: 28, x: 0, y: 14)
    }

    @ViewBuilder
    private func cardContent(_ topic: Topic) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Top row — category + vote badge
            HStack(alignment: .top) {
                if let cat = topic.category {
                    Text(cat.uppercased())
                        .font(.lmCaption)
                        .kerning(1.1)
                        .foregroundStyle(.gold)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(Color.gold.opacity(0.12)))
                }
                Spacer()
                sideIndicatorBadge
            }

            Spacer()

            // Topic statement
            Text(topic.statement)
                .font(.lmDisplayMedium)
                .foregroundStyle(.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
                .lineLimit(5)

            if let desc = topic.description {
                Text(desc)
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .lineLimit(2)
                    .padding(.top, Spacing.xs)
            }

            Spacer()

            // Vote bar
            VoteBarView(bluePct: topic.bluePercentage, totalVotes: topic.totalVotes)
                .padding(.bottom, Spacing.xs)

            // Footer stats
            HStack {
                Label(formatVotes(topic.totalVotes), systemImage: "person.2.fill")
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
                Spacer()
                Button {
                    selectedTopic = topic
                } label: {
                    Label("More", systemImage: "arrow.up.right.circle")
                        .font(.lmCaption)
                        .foregroundStyle(.forBlue.opacity(0.8))
                }
            }
        }
        .padding(Spacing.lg)
    }

    // Side indicator badge — appears when dragging
    @ViewBuilder
    private var sideIndicatorBadge: some View {
        if dragOffset.width > 40 {
            Text("FOR")
                .font(.system(size: 15, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.xxs + 2)
                .background(
                    Capsule()
                        .fill(Color.forBlue)
                        .shadow(color: Color.forBlue.opacity(0.6), radius: 8)
                )
                .opacity(Double(dragProgress))
                .scaleEffect(0.85 + dragProgress * 0.15)
        } else if dragOffset.width < -40 {
            Text("AGAINST")
                .font(.system(size: 15, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, Spacing.xxs + 2)
                .background(
                    Capsule()
                        .fill(Color.againstRed)
                        .shadow(color: Color.againstRed.opacity(0.6), radius: 8)
                )
                .opacity(Double(dragProgress))
                .scaleEffect(0.85 + dragProgress * 0.15)
        }
    }

    // MARK: - Background stacked cards (depth effect)

    @ViewBuilder
    private func stackedCard(index: Int) -> some View {
        let scale = 1.0 - CGFloat(index) * 0.055
        let yOffset = CGFloat(index) * 16.0
        let opacity = 1.0 - CGFloat(index) * 0.18

        RoundedRectangle(cornerRadius: Radii.xl)
            .fill(Color.surface200)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xl)
                    .stroke(Color.white.opacity(0.05), lineWidth: 1)
            )
            .frame(height: cardHeight)
            .scaleEffect(scale)
            .offset(y: yOffset)
            .opacity(opacity)
    }

    // MARK: - Direction hints

    private var directionHints: some View {
        HStack {
            Label("AGAINST", systemImage: "arrow.left")
                .font(.lmCaption)
                .foregroundStyle(.againstRed.opacity(0.5))
            Spacer()
            Label("FOR", systemImage: "arrow.right")
                .font(.lmCaption)
                .foregroundStyle(.forBlue.opacity(0.5))
        }
        .padding(.horizontal, Spacing.xl)
    }

    // MARK: - Action buttons

    private var actionRow: some View {
        HStack(spacing: 0) {
            // Against
            Spacer()
            actionButton(
                icon: "xmark",
                size: 64,
                color: .againstRed,
                background: Color.againstRed.opacity(0.12),
                border: Color.againstRed.opacity(0.28)
            ) {
                swipeOut(side: .againstSide)
            }
            Spacer()

            // Skip
            actionButton(
                icon: "forward.fill",
                size: 46,
                color: .textSecondary,
                background: Color.surface300,
                border: Color.clear,
                iconSize: 17
            ) {
                skipCard()
            }
            Spacer()

            // For
            actionButton(
                icon: "checkmark",
                size: 64,
                color: .forBlue,
                background: Color.forBlue.opacity(0.12),
                border: Color.forBlue.opacity(0.28)
            ) {
                swipeOut(side: .forSide)
            }
            Spacer()
        }
    }

    private func actionButton(
        icon: String,
        size: CGFloat,
        color: Color,
        background: Color,
        border: Color,
        iconSize: CGFloat = 22,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: iconSize, weight: .bold))
                .foregroundStyle(color)
                .frame(width: size, height: size)
                .background(
                    Circle()
                        .fill(background)
                        .overlay(Circle().stroke(border, lineWidth: 1.5))
                )
        }
        .disabled(topics.isEmpty || isAnimatingOut)
    }

    // MARK: - Done screen

    private var doneScreen: some View {
        VStack(spacing: Spacing.xl) {
            Spacer()

            ZStack {
                Circle()
                    .fill(Color.emerald.opacity(0.12))
                    .frame(width: 100, height: 100)
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.emerald)
            }

            VStack(spacing: Spacing.sm) {
                Text("Stack cleared!")
                    .font(.lmDisplayMedium)
                    .foregroundStyle(.textPrimary)

                let total = votedFor + votedAgainst
                Text(total == 0
                     ? "No votes yet — come back soon."
                     : "You voted on \(total) topic\(total == 1 ? "" : "s") this session.")
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .multilineTextAlignment(.center)
            }

            // Session tally
            HStack(spacing: Spacing.lg) {
                tallyPill(count: votedFor, label: "FOR", color: .forBlue)
                tallyPill(count: votedAgainst, label: "AGAINST", color: .againstRed)
                if skipped > 0 {
                    tallyPill(count: skipped, label: "Skipped", color: .textTertiary)
                }
            }
            .padding(.top, Spacing.xs)

            Spacer()

            Button {
                Task { await loadTopics() }
            } label: {
                Label("Load more topics", systemImage: "arrow.clockwise")
                    .font(.lmBodyBold)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .fill(Color.forBlue)
                    )
            }
            .padding(.horizontal, Spacing.xl)
            .padding(.bottom, Spacing.xl + 64)
        }
        .padding(.horizontal, Spacing.lg)
    }

    private func tallyPill(count: Int, label: String, color: Color) -> some View {
        VStack(spacing: Spacing.xxs + 2) {
            Text("\(count)")
                .font(.lmTitle)
                .fontDesign(.rounded)
                .foregroundStyle(color)
            Text(label)
                .font(.lmCaption)
                .foregroundStyle(.textSecondary)
        }
        .frame(minWidth: 72)
        .padding(.vertical, Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200)
        )
    }

    // MARK: - Loading view

    private var loadingView: some View {
        VStack(spacing: Spacing.lg) {
            ProgressView()
                .progressViewStyle(.circular)
                .tint(.forBlue)
                .scaleEffect(1.3)
            Text("Loading topics…")
                .font(.lmCaption)
                .foregroundStyle(.textSecondary)
        }
    }

    // MARK: - Actions

    private func swipeOut(side: VoteSide) {
        guard let topic = topics.first, !isAnimatingOut else { return }
        isAnimatingOut = true

        Haptics.impact(side == .forSide ? .medium : .heavy)
        if side == .forSide { votedFor += 1 } else { votedAgainst += 1 }

        let exitX: CGFloat = side == .forSide ? 700 : -700
        withAnimation(.spring(response: 0.38, dampingFraction: 0.82)) {
            dragOffset = CGSize(width: exitX, height: -60)
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.32) {
            if !topics.isEmpty { topics.removeFirst() }
            dragOffset = .zero
            isAnimatingOut = false
            if topics.isEmpty { isDone = true }
        }

        guard let uid = auth.currentUserId else { return }
        Task {
            try? await SupabaseClient.shared.castVote(
                topicId: topic.id,
                side: side,
                userId: uid
            )
        }
    }

    private func skipCard() {
        guard !topics.isEmpty, !isAnimatingOut else { return }
        Haptics.selection()
        skipped += 1
        let topic = topics.removeFirst()
        topics.append(topic)
        withAnimation(.spring(response: 0.42, dampingFraction: 0.80)) {
            dragOffset = .zero
        }
    }

    private func snapBack() {
        withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) {
            dragOffset = .zero
        }
    }

    // MARK: - Data

    private func loadTopics() async {
        isLoading = true
        isDone = false
        errorMessage = nil
        do {
            var loaded = try await SupabaseClient.shared.fetchTopics(limit: 30, offset: 0)
            loaded.shuffle()
            topics = loaded
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    // MARK: - Helpers

    private func formatVotes(_ n: Int) -> String {
        switch n {
        case 1_000_000...: return String(format: "%.1fM", Double(n) / 1_000_000)
        case 1_000...:     return String(format: "%.1fK", Double(n) / 1_000)
        default:           return "\(n)"
        }
    }
}

#Preview {
    SwipeVoteView()
        .environmentObject(AuthService())
}
