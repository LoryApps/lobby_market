//
//  CoalitionsView.swift
//  LobbyMarket
//
//  Browse and join public coalitions — persistent alliances that campaign
//  across multiple civic topics. The screen mirrors /lobby on the web.
//

import SwiftUI

// MARK: - CoalitionsView

struct CoalitionsView: View {
    @EnvironmentObject var auth: AuthService

    @State private var coalitions: [Coalition] = []
    @State private var myCoalitionIds: Set<String> = []
    @State private var isLoading = true
    @State private var errorMsg: String?
    @State private var searchQuery = ""
    @State private var selectedCoalition: Coalition?

    private var filtered: [Coalition] {
        guard !searchQuery.isEmpty else { return coalitions }
        let q = searchQuery.lowercased()
        return coalitions.filter {
            $0.name.lowercased().contains(q) ||
            ($0.description?.lowercased().contains(q) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                if isLoading {
                    CoalitionsSkeleton()
                } else if let err = errorMsg {
                    errorView(err)
                } else {
                    listContent
                }
            }
            .navigationTitle("Coalitions")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.surface0, for: .navigationBar)
            .searchable(text: $searchQuery, prompt: "Search coalitions…")
            .task { await load() }
            .refreshable { await load() }
            .sheet(item: $selectedCoalition) { coalition in
                CoalitionDetailView(
                    coalition: coalition,
                    isMember: myCoalitionIds.contains(coalition.id),
                    onJoin: { await join(coalition) },
                    onLeave: { await leave(coalition) }
                )
            }
        }
    }

    // MARK: - List

    private var listContent: some View {
        ScrollView {
            LazyVStack(spacing: Spacing.sm) {
                // My coalitions header
                if !myCoalitionIds.isEmpty {
                    let mine = filtered.filter { myCoalitionIds.contains($0.id) }
                    if !mine.isEmpty {
                        sectionHeader("Your Coalitions")
                        ForEach(mine) { coalition in
                            CoalitionCard(
                                coalition: coalition,
                                isMember: true,
                                onTap: { selectedCoalition = coalition }
                            )
                        }
                    }
                }

                // Discover
                let discover = filtered.filter { !myCoalitionIds.contains($0.id) }
                if !discover.isEmpty {
                    sectionHeader(myCoalitionIds.isEmpty ? "Discover" : "More Coalitions")
                    ForEach(discover) { coalition in
                        CoalitionCard(
                            coalition: coalition,
                            isMember: false,
                            onTap: { selectedCoalition = coalition }
                        )
                    }
                }

                if filtered.isEmpty {
                    emptySearch
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm)
            .padding(.bottom, 80)
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.lmMono)
            .foregroundStyle(.textTertiary)
            .kerning(1.2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, Spacing.xs)
    }

    private var emptySearch: some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "person.3.sequence")
                .font(.system(size: 44))
                .foregroundStyle(.textTertiary)
            Text("No coalitions found")
                .font(.lmTitle)
                .foregroundStyle(.textSecondary)
            Text("Try a different search term.")
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
        }
        .padding(.top, Spacing.xxl)
        .frame(maxWidth: .infinity)
    }

    private func errorView(_ msg: String) -> some View {
        VStack(spacing: Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 44))
                .foregroundStyle(.againstRed)
            Text("Could not load coalitions")
                .font(.lmTitle)
                .foregroundStyle(.textPrimary)
            Text(msg)
                .font(.lmCaption)
                .foregroundStyle(.textTertiary)
                .multilineTextAlignment(.center)
            Button("Retry") { Task { await load() } }
                .buttonStyle(PrimaryButtonStyle(color: .purple))
        }
        .padding(Spacing.xl)
    }

    // MARK: - Data

    private func load() async {
        isLoading = true
        errorMsg = nil
        do {
            async let coalitionsFetch = SupabaseClient.shared.fetchCoalitions()
            async let myIdsFetch: [String] = {
                guard let uid = auth.currentUserId else { return [] }
                return (try? await SupabaseClient.shared.fetchMyCoalitionIds(userId: uid)) ?? []
            }()
            let (c, ids) = try await (coalitionsFetch, myIdsFetch)
            coalitions = c
            myCoalitionIds = Set(ids)
        } catch {
            errorMsg = error.localizedDescription
        }
        isLoading = false
    }

    private func join(_ coalition: Coalition) async {
        guard let uid = auth.currentUserId else { return }
        try? await SupabaseClient.shared.joinCoalition(coalitionId: coalition.id, userId: uid)
        myCoalitionIds.insert(coalition.id)
        Haptics.notify(.success)
        selectedCoalition = nil
    }

    private func leave(_ coalition: Coalition) async {
        guard let uid = auth.currentUserId else { return }
        try? await SupabaseClient.shared.leaveCoalition(coalitionId: coalition.id, userId: uid)
        myCoalitionIds.remove(coalition.id)
        Haptics.notify(.warning)
        selectedCoalition = nil
    }
}

// MARK: - CoalitionCard

struct CoalitionCard: View {
    let coalition: Coalition
    let isMember: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: Spacing.sm) {
                // Top row: name + member badge
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: Spacing.xxs) {
                        Text(coalition.name)
                            .font(.lmBodyBold)
                            .foregroundStyle(.textPrimary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                        if isMember {
                            Text("MEMBER")
                                .font(.lmCaption)
                                .kerning(0.8)
                                .foregroundStyle(.purple)
                                .padding(.horizontal, Spacing.xs)
                                .padding(.vertical, 2)
                                .background(Color.purple.opacity(0.12))
                                .clipShape(Capsule())
                        }
                    }
                    Spacer()
                    // Influence orb
                    VStack(spacing: 2) {
                        Text(coalition.influenceLabel)
                            .font(.lmMono)
                            .foregroundStyle(.gold)
                        Text("influence")
                            .font(.system(size: 9, weight: .medium))
                            .foregroundStyle(.textTertiary)
                    }
                }

                // Description
                if let desc = coalition.description {
                    Text(desc)
                        .font(.lmCaption)
                        .foregroundStyle(.textSecondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }

                Divider().background(Color.white.opacity(0.08))

                // Stats row
                HStack(spacing: Spacing.md) {
                    statChip(
                        icon: "person.2.fill",
                        value: "\(coalition.memberCount)",
                        label: "members",
                        color: .forBlue
                    )
                    statChip(
                        icon: "checkmark.seal.fill",
                        value: "\(coalition.wins)W \(coalition.losses)L",
                        label: "record",
                        color: coalition.wins >= coalition.losses ? .emerald : .surface400
                    )
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.textTertiary)
                }
            }
        }
        .buttonStyle(.plain)
        .lmCard()
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(isMember ? Color.purple.opacity(0.35) : Color.white.opacity(0.06), lineWidth: 1)
        )
    }

    private func statChip(
        icon: String,
        value: String,
        label: String,
        color: Color
    ) -> some View {
        HStack(spacing: Spacing.xxs) {
            Image(systemName: icon)
                .font(.system(size: 11))
                .foregroundStyle(color)
            Text(value)
                .font(.lmMono)
                .foregroundStyle(.textSecondary)
        }
    }
}

// MARK: - Skeleton

private struct CoalitionsSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.sm) {
                ForEach(0..<6) { _ in
                    SkeletonCard()
                }
            }
            .padding(.horizontal, Spacing.md)
            .padding(.top, Spacing.sm)
        }
    }
}

private struct SkeletonCard: View {
    @State private var shimmer = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            HStack {
                RoundedRectangle(cornerRadius: 4).fill(Color.surface300)
                    .frame(width: 180, height: 18)
                Spacer()
                RoundedRectangle(cornerRadius: 4).fill(Color.surface300)
                    .frame(width: 50, height: 18)
            }
            RoundedRectangle(cornerRadius: 4).fill(Color.surface300)
                .frame(maxWidth: .infinity)
                .frame(height: 12)
            RoundedRectangle(cornerRadius: 4).fill(Color.surface300)
                .frame(width: 200, height: 12)
        }
        .padding(Spacing.md)
        .background(Color.surface200)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .opacity(shimmer ? 0.6 : 1.0)
        .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: shimmer)
        .onAppear { shimmer = true }
    }
}

// MARK: - PrimaryButtonStyle helper

private struct PrimaryButtonStyle: ButtonStyle {
    var color: Color = .forBlue
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.lmBodyBold)
            .foregroundStyle(.white)
            .padding(.horizontal, Spacing.lg)
            .padding(.vertical, Spacing.sm)
            .background(color.opacity(configuration.isPressed ? 0.7 : 1))
            .clipShape(Capsule())
    }
}

#Preview {
    CoalitionsView()
        .environmentObject(AuthService())
}
