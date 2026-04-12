//
//  FeedView.swift
//  LobbyMarket
//
//  TikTok-style vertical paging feed of topics.
//

import SwiftUI

struct FeedView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var realtime: RealtimeService

    @State private var topics: [Topic] = Topic.sampleData
    @State private var currentIndex: Int = 0
    @State private var isLoading: Bool = false
    @State private var hasLoadedOnce: Bool = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            if topics.isEmpty && isLoading {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(.white)
            } else {
                GeometryReader { geo in
                    VerticalPagingFeed(
                        topics: topics,
                        currentIndex: $currentIndex,
                        pageHeight: geo.size.height
                    ) { index in
                        Haptics.selection()
                        if index >= topics.count - 3 {
                            Task { await loadMore() }
                        }
                        if topics.indices.contains(index) {
                            realtime.subscribe(topicId: topics[index].id)
                        }
                    }
                }
                .ignoresSafeArea()
            }

            // Top overlay — brand + refresh
            VStack {
                HStack {
                    HStack(spacing: 6) {
                        Image(systemName: "building.columns.fill")
                            .foregroundStyle(.forBlue)
                        Text("LOBBY MARKET")
                            .font(.system(size: 14, weight: .heavy, design: .rounded))
                            .kerning(1.2)
                            .foregroundStyle(.white)
                    }
                    Spacer()
                    Button {
                        Task { await refresh() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 36, height: 36)
                            .background(Circle().fill(Color.surface300.opacity(0.55)))
                    }
                }
                .padding(.horizontal, Spacing.md)
                .padding(.top, Spacing.xs)
                Spacer()
            }

            if let errorMessage {
                VStack {
                    Spacer()
                    Text(errorMessage)
                        .font(.lmCaption)
                        .foregroundStyle(.textSecondary)
                        .padding()
                        .background(Capsule().fill(Color.surface200))
                        .padding(.bottom, 120)
                }
            }
        }
        .task {
            if !hasLoadedOnce {
                await refresh()
                hasLoadedOnce = true
            }
        }
    }

    // MARK: - Data

    private func refresh() async {
        isLoading = true
        errorMessage = nil
        do {
            let list = try await SupabaseClient.shared.fetchTopics(limit: Config.feedPageSize, offset: 0)
            topics = list.isEmpty ? Topic.sampleData : list
            currentIndex = 0
        } catch {
            errorMessage = error.localizedDescription
            topics = Topic.sampleData
        }
        isLoading = false
    }

    private func loadMore() async {
        guard !isLoading else { return }
        isLoading = true
        do {
            let more = try await SupabaseClient.shared.fetchTopics(
                limit: Config.feedPageSize,
                offset: topics.count
            )
            let existing = Set(topics.map(\.id))
            let fresh = more.filter { !existing.contains($0.id) }
            topics.append(contentsOf: fresh)
        } catch {
            // Silent on paging failure.
        }
        isLoading = false
    }
}

/// iOS 16-safe vertical paging container. Snaps to each full-height page.
struct VerticalPagingFeed: View {
    let topics: [Topic]
    @Binding var currentIndex: Int
    let pageHeight: CGFloat
    let onPageChange: (Int) -> Void

    @State private var dragOffset: CGFloat = 0
    @GestureState private var isDragging: Bool = false

    var body: some View {
        ZStack(alignment: .top) {
            ForEach(Array(topics.enumerated()), id: \.element.id) { index, topic in
                TopicCardView(topic: topic)
                    .frame(height: pageHeight)
                    .offset(y: CGFloat(index - currentIndex) * pageHeight + dragOffset)
                    .animation(.spring(response: 0.45, dampingFraction: 0.85), value: currentIndex)
                    .animation(.interactiveSpring(), value: dragOffset)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 20)
                .updating($isDragging) { _, state, _ in state = true }
                .onChanged { value in
                    dragOffset = value.translation.height
                }
                .onEnded { value in
                    let threshold: CGFloat = pageHeight * 0.2
                    let velocity = value.predictedEndTranslation.height
                    let oldIndex = currentIndex
                    var newIndex = oldIndex
                    if value.translation.height < -threshold || velocity < -400 {
                        newIndex = min(oldIndex + 1, max(0, topics.count - 1))
                    } else if value.translation.height > threshold || velocity > 400 {
                        newIndex = max(oldIndex - 1, 0)
                    }
                    withAnimation(.spring(response: 0.45, dampingFraction: 0.85)) {
                        currentIndex = newIndex
                        dragOffset = 0
                    }
                    if newIndex != oldIndex {
                        onPageChange(newIndex)
                    }
                }
        )
    }
}

#Preview {
    FeedView()
        .environmentObject(AuthService())
        .environmentObject(RealtimeService())
}
