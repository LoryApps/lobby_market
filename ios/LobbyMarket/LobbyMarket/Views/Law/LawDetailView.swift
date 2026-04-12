//
//  LawDetailView.swift
//  LobbyMarket
//
//  Single law "wiki page" — renders body with markdown-ish formatting.
//

import SwiftUI

struct LawDetailView: View {
    let law: Law
    let allLaws: [Law]

    var linked: [Law] {
        allLaws.filter { law.linkedLawIds.contains($0.id) }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                if let category = law.category {
                    Text(category.uppercased())
                        .font(.lmCaption)
                        .kerning(1.2)
                        .foregroundStyle(.gold)
                }

                Text(law.title)
                    .font(.lmDisplayLarge)
                    .foregroundStyle(.white)

                if let summary = law.summary {
                    Text(summary)
                        .font(.lmBody)
                        .foregroundStyle(.textSecondary)
                }

                // Tags
                if !law.tags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(law.tags, id: \.self) { tag in
                                Text("#\(tag)")
                                    .font(.lmCaption)
                                    .foregroundStyle(.textSecondary)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(Capsule().fill(Color.surface200))
                            }
                        }
                    }
                }

                Divider().background(Color.white.opacity(0.1))

                bodyRendered

                if !linked.isEmpty {
                    Divider().background(Color.white.opacity(0.1))
                    Text("LINKED LAWS")
                        .font(.system(size: 11, weight: .heavy))
                        .kerning(1.2)
                        .foregroundStyle(.textSecondary)
                    ForEach(linked) { law in
                        NavigationLink(value: law) {
                            HStack {
                                Image(systemName: "link.circle.fill")
                                    .foregroundStyle(.forBlue)
                                Text(law.title)
                                    .foregroundStyle(.white)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .foregroundStyle(.textTertiary)
                            }
                            .padding(Spacing.sm)
                            .background(RoundedRectangle(cornerRadius: Radii.md).fill(Color.surface200))
                        }
                        .buttonStyle(.plain)
                    }
                }

                Spacer(minLength: 40)
            }
            .padding(Spacing.md)
        }
        .background(Color.surface0.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: Law.self) { next in
            LawDetailView(law: next, allLaws: allLaws)
        }
    }

    // MARK: - Lightweight markdown renderer

    @ViewBuilder
    private var bodyRendered: some View {
        let lines = law.body.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        VStack(alignment: .leading, spacing: Spacing.xs) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                if line.hasPrefix("## ") {
                    Text(line.replacingOccurrences(of: "## ", with: ""))
                        .font(.lmTitle)
                        .foregroundStyle(.white)
                        .padding(.top, Spacing.xs)
                } else if line.hasPrefix("# ") {
                    Text(line.replacingOccurrences(of: "# ", with: ""))
                        .font(.lmDisplayMedium)
                        .foregroundStyle(.white)
                } else if line.isEmpty {
                    Spacer().frame(height: 4)
                } else {
                    Text(line)
                        .font(.lmBody)
                        .foregroundStyle(.textSecondary)
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        LawDetailView(law: Law.sampleData[0], allLaws: Law.sampleData)
    }
}
