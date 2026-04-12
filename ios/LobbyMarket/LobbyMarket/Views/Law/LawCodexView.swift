//
//  LawCodexView.swift
//  LobbyMarket
//
//  Obsidian-style wiki browser.
//

import SwiftUI

struct LawCodexView: View {
    @State private var laws: [Law] = Law.sampleData
    @State private var searchText: String = ""
    @State private var isLoading: Bool = false

    private var filtered: [Law] {
        if searchText.isEmpty { return laws }
        let q = searchText.lowercased()
        return laws.filter {
            $0.title.lowercased().contains(q) ||
            ($0.summary?.lowercased().contains(q) ?? false) ||
            $0.tags.contains { $0.lowercased().contains(q) }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()

                VStack(spacing: 0) {
                    searchBar
                        .padding(.horizontal, Spacing.md)
                        .padding(.vertical, Spacing.sm)

                    ScrollView {
                        LazyVStack(spacing: Spacing.sm) {
                            ForEach(filtered) { law in
                                NavigationLink(value: law) {
                                    LawRow(law: law)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal, Spacing.md)
                        .padding(.bottom, Spacing.xl)
                    }
                }
            }
            .navigationTitle("Codex")
            .navigationBarTitleDisplayMode(.large)
            .navigationDestination(for: Law.self) { law in
                LawDetailView(law: law, allLaws: laws)
            }
            .task { await load() }
            .refreshable { await load() }
        }
    }

    private var searchBar: some View {
        HStack(spacing: Spacing.xs) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.textSecondary)
            TextField("Search laws, tags, topics...", text: $searchText)
                .textFieldStyle(.plain)
                .foregroundStyle(.white)
                .tint(.forBlue)
            if !searchText.isEmpty {
                Button {
                    searchText = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.textTertiary)
                }
            }
        }
        .padding(Spacing.sm)
        .background(RoundedRectangle(cornerRadius: Radii.md).fill(Color.surface200))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private func load() async {
        isLoading = true
        do {
            let result = try await SupabaseClient.shared.fetchLaws(search: nil)
            laws = result.isEmpty ? Law.sampleData : result
        } catch {
            laws = Law.sampleData
        }
        isLoading = false
    }
}

struct LawRow: View {
    let law: Law

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(law.title)
                    .font(.lmBodyBold)
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.textTertiary)
            }
            if let summary = law.summary {
                Text(summary)
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .lineLimit(2)
            }
            HStack(spacing: 6) {
                if let category = law.category {
                    Text(category)
                        .font(.system(size: 10, weight: .heavy))
                        .foregroundStyle(.gold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Color.gold.opacity(0.12)))
                }
                ForEach(law.tags.prefix(3), id: \.self) { tag in
                    Text("#\(tag)")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.textSecondary)
                }
                Spacer()
                Label("\(law.citations)", systemImage: "link")
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
            }
        }
        .lmCard()
    }
}

#Preview {
    LawCodexView()
}
