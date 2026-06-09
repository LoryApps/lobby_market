//
//  FeedView.swift
//  LobbyMarket
//
//  TikTok-style vertical paging feed of topics with category filter strip.
//

import SwiftUI

// MARK: - Category filter config

private struct CategoryFilter: Identifiable, Hashable {
    let id: String
    let label: String
    let icon: String
    let color: Color

    static let all = CategoryFilter(id: "all",         label: "All",         icon: "house.fill",                    color: .white)
    static let filters: [CategoryFilter] = [
        all,
        CategoryFilter(id: "Politics",     label: "Politics",     icon: "building.columns.fill",         color: .forBlue),
        CategoryFilter(id: "Economics",    label: "Economics",    icon: "chart.line.uptrend.xyaxis",     color: .gold),
        CategoryFilter(id: "Technology",   label: "Technology",   icon: "cpu.fill",                      color: .purple),
        CategoryFilter(id: "Science",      label: "Science",      icon: "flask.fill",                    color: .emerald),
        CategoryFilter(id: "Ethics",       label: "Ethics",       icon: "scale.3d",                      color: .againstRed),
        CategoryFilter(id: "Philosophy",   label: "Philosophy",   icon: "book.fill",                     color: .purple),
        CategoryFilter(id: "Culture",      label: "Culture",      icon: "music.note",                    color: .againstRed),
        CategoryFilter(id: "Health",       label: "Health",       icon: "heart.fill",                    color: .emerald),
        CategoryFilter(id: "Environment",  label: "Environment",  icon: "leaf.fill",                     color: .emerald),
        CategoryFilter(id: "Education",    label: "Education",    icon: "graduationcap.fill",             color: .gold),
    ]
}

// MARK: - Main view

struct FeedView: View {
    @EnvironmentObject var auth: AuthService
    @EnvironmentObject var realtime: RealtimeService

    @State private var topics: [Topic] = Topic.sampleData
    @State private var currentIndex: Int = 0
    @State private var isLoading: Bool = false
    @State private var hasLoadedOnce: Bool = false
    @State private var errorMessage: String?
    @State private var selectedFilter: CategoryFilter = .all
    @State private var showFilterStrip: Bool = true
    @State private var lastScrollY: CGFloat = 0
    @State private var showBriefing: Bool = false

    private var activeCategory: String? {
        selectedFilter.id == "all" ? nil : selectedFilter.id
    }

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

            // Top overlay — brand + filter strip
            VStack(spacing: 0) {
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
                    // Daily Brief shortcut
                    Button {
                        showBriefing = true
                        Haptics.selection()
                    } label: {
                        Image(systemName: "sun.horizon.fill")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.gold)
                            .frame(width: 36, height: 36)
                            .background(Circle().fill(Color.surface300.opacity(0.55)))
                    }
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
                .padding(.bottom, 6)

                if showFilterStrip {
                    categoryFilterStrip
                        .transition(.move(edge: .top).combined(with: .opacity))
                }

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
        .sheet(isPresented: $showBriefing) {
            BriefingView()
        }
    }

    // MARK: - Category filter strip

    private var categoryFilterStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(CategoryFilter.filters) { filter in
                    filterChip(filter)
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, 6)
        }
        .background(
            LinearGradient(
                colors: [Color.surface0, Color.surface0.opacity(0)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }

    private func filterChip(_ filter: CategoryFilter) -> some View {
        let isActive = selectedFilter == filter
        return Button {
            guard selectedFilter != filter else { return }
            Haptics.selection()
            withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) {
                selectedFilter = filter
            }
            Task { await refresh() }
        } label: {
            HStack(spacing: 5) {
                Image(systemName: filter.icon)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(isActive ? filter.color : Color.textSecondary)
                Text(filter.label)
                    .font(.system(size: 12, weight: isActive ? .heavy : .medium))
                    .foregroundStyle(isActive ? .white : Color.textSecondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                Capsule()
                    .fill(isActive ? filter.color.opacity(0.18) : Color.surface200.opacity(0.7))
                    .overlay(
                        Capsule()
                            .stroke(isActive ? filter.color.opacity(0.5) : Color.white.opacity(0.06), lineWidth: 1)
                    )
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(isActive ? 1.04 : 1.0)
        .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isActive)
    }

    // MARK: - Data

    private func refresh() async {
        isLoading = true
        errorMessage = nil
        do {
            let list = try await SupabaseClient.shared.fetchTopics(
                limit: Config.feedPageSize,
                offset: 0,
                category: activeCategory
            )
            topics = list.isEmpty ? Topic.sampleData.filter { activeCategory == nil || $0.category == activeCategory } : list
            currentIndex = 0
        } catch {
            errorMessage = error.localizedDescription
            topics = Topic.sampleData.filter { activeCategory == nil || $0.category == activeCategory }
        }
        isLoading = false
    }

    private func loadMore() async {
        guard !isLoading else { return }
        isLoading = true
        do {
            let more = try await SupabaseClient.shared.fetchTopics(
                limit: Config.feedPageSize,
                offset: topics.count,
                category: activeCategory
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

// MARK: - Vertical paging container

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
