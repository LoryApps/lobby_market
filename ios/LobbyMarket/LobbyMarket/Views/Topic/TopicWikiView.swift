//
//  TopicWikiView.swift
//  LobbyMarket
//
//  Native wiki article reader for a civic topic.
//  Shows the description with inline markdown rendering,
//  edit history, and outgoing topic links.
//

import SwiftUI

struct TopicWikiView: View {
    let topic: Topic

    @State private var revisions: [WikiRevision] = []
    @State private var linkedTopics: [TopicLinkEntry] = []
    @State private var isLoading = true
    @Environment(\.dismiss) private var dismiss

    private var webURL: URL {
        URL(string: "\(Config.webURL)/topic/\(topic.id)/wiki")!
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.surface0.ignoresSafeArea()
                if isLoading {
                    skeletonView
                } else {
                    mainContent
                }
            }
            .navigationTitle("Wiki")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.surface0, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(.forBlue)
                }
                ToolbarItem(placement: .primaryAction) {
                    ShareLink(item: webURL) {
                        Image(systemName: "square.and.arrow.up")
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }
            }
            .task { await loadData() }
        }
    }

    // MARK: - Main Content

    private var mainContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.lg) {
                articleHeader
                descriptionSection
                if !linkedTopics.isEmpty { linkedTopicsSection }
                if !revisions.isEmpty { editHistorySection }
                webLinkButton
            }
            .padding(Spacing.md)
            .padding(.bottom, Spacing.xl)
        }
    }

    // MARK: - Article Header

    private var articleHeader: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            if let category = topic.category {
                HStack(spacing: 6) {
                    Circle()
                        .fill(catColor(category))
                        .frame(width: 6, height: 6)
                    Text(category.uppercased())
                        .font(.lmCaption)
                        .kerning(1.2)
                        .foregroundStyle(catColor(category))
                }
            }

            Text(topic.statement)
                .font(.lmDisplayMedium)
                .foregroundStyle(.textPrimary)
                .fixedSize(horizontal: false, vertical: true)

            HStack(spacing: Spacing.xs) {
                Image(systemName: "person.3.fill")
                    .font(.system(size: 10))
                    .foregroundStyle(.textTertiary)
                Text("\(topic.totalVotes.formatted()) votes")
                    .font(.lmCaption)
                    .foregroundStyle(.textTertiary)
                Text("·")
                    .foregroundStyle(.textTertiary.opacity(0.6))
                Text("FOR \(Int(topic.bluePercentage))%")
                    .font(.lmCaption)
                    .foregroundStyle(.forBlue)
                Text("·")
                    .foregroundStyle(.textTertiary.opacity(0.6))
                Text("AGAINST \(Int(topic.redPercentage))%")
                    .font(.lmCaption)
                    .foregroundStyle(.againstRed)
            }
            .padding(.top, 2)
        }
    }

    // MARK: - Description

    @ViewBuilder
    private var descriptionSection: some View {
        Divider().background(Color.white.opacity(0.08))

        if let desc = topic.description, !desc.isEmpty {
            wikiMarkdown(desc)
        } else {
            VStack(spacing: Spacing.sm) {
                Image(systemName: "doc.text")
                    .font(.system(size: 36, weight: .thin))
                    .foregroundStyle(.textTertiary)
                Text("No wiki content yet.")
                    .font(.lmBody)
                    .foregroundStyle(.textTertiary)
                Link("Add context on the web →", destination: webURL)
                    .font(.lmCaption)
                    .foregroundStyle(.forBlue)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.xl)
        }
    }

    // MARK: - Markdown Renderer

    private func wikiMarkdown(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(wikiBlocks(text).enumerated()), id: \.offset) { _, block in
                wikiBlockView(block)
            }
        }
    }

    private enum WikiBlock { case h1(String), h2(String), h3(String), body(String), spacer }

    private func wikiBlocks(_ text: String) -> [WikiBlock] {
        text.components(separatedBy: "\n").map { line in
            if line.hasPrefix("# ")   { return .h1(String(line.dropFirst(2))) }
            if line.hasPrefix("## ")  { return .h2(String(line.dropFirst(3))) }
            if line.hasPrefix("### ") { return .h3(String(line.dropFirst(4))) }
            if line.trimmingCharacters(in: .whitespaces).isEmpty { return .spacer }
            return .body(line)
        }
    }

    @ViewBuilder
    private func wikiBlockView(_ block: WikiBlock) -> some View {
        switch block {
        case .h1(let t):
            Text(t).font(.lmTitle).foregroundStyle(.textPrimary)
                .padding(.top, Spacing.sm)
        case .h2(let t):
            Text(t).font(.lmBodyBold).foregroundStyle(.textPrimary)
                .padding(.top, Spacing.xs)
        case .h3(let t):
            Text(t).font(.lmHeadline).foregroundStyle(.textSecondary)
                .padding(.top, 4)
        case .body(let t):
            if let attr = try? AttributedString(
                markdown: t,
                options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)
            ) {
                Text(attr)
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text(t)
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        case .spacer:
            Spacer().frame(height: Spacing.xs)
        }
    }

    // MARK: - Linked Topics

    private var linkedTopicsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Divider().background(Color.white.opacity(0.08))

            HStack(spacing: 6) {
                Image(systemName: "link")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.purple)
                Text("LINKED TOPICS")
                    .font(.lmMono)
                    .kerning(1.2)
                    .foregroundStyle(.textTertiary)
            }

            VStack(spacing: Spacing.xs) {
                ForEach(linkedTopics) { entry in
                    linkedTopicRow(entry)
                }
            }
        }
    }

    private func linkedTopicRow(_ entry: TopicLinkEntry) -> some View {
        HStack(spacing: Spacing.sm) {
            if let cat = entry.category {
                Circle()
                    .fill(catColor(cat))
                    .frame(width: 6, height: 6)
            }
            Text(entry.statement)
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .lineLimit(2)
            Spacer(minLength: 0)
            Image(systemName: "arrow.up.right")
                .font(.system(size: 10))
                .foregroundStyle(.textTertiary)
        }
        .padding(Spacing.sm)
        .background(
            RoundedRectangle(cornerRadius: Radii.md)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }

    // MARK: - Edit History

    private var editHistorySection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Divider().background(Color.white.opacity(0.08))

            HStack(spacing: 6) {
                Image(systemName: "clock.arrow.circlepath")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.gold)
                Text("EDIT HISTORY")
                    .font(.lmMono)
                    .kerning(1.2)
                    .foregroundStyle(.textTertiary)
            }

            VStack(spacing: 0) {
                ForEach(revisions) { rev in
                    revisionRow(rev)
                    if rev.id != revisions.last?.id {
                        Divider()
                            .background(Color.white.opacity(0.05))
                            .padding(.leading, 44)
                    }
                }
            }
            .background(
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(Color.surface200)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.md)
                            .stroke(Color.white.opacity(0.06), lineWidth: 1)
                    )
            )
        }
    }

    private func revisionRow(_ rev: WikiRevision) -> some View {
        HStack(spacing: Spacing.sm) {
            Circle()
                .fill(Color.surface300)
                .frame(width: 28, height: 28)
                .overlay(
                    Text(String(rev.editorUsername?.prefix(1).uppercased() ?? "?"))
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.textSecondary)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text("@\(rev.editorUsername ?? "anonymous")")
                    .font(.lmCaption)
                    .foregroundStyle(.textSecondary)
                Text(relativeTime(rev.createdAt))
                    .font(.system(size: 10, weight: .regular))
                    .foregroundStyle(.textTertiary)
            }

            Spacer()

            let d = rev.charDelta
            Text(d >= 0 ? "+\(d)" : "\(d)")
                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                .foregroundStyle(d > 0 ? .emerald : d < 0 ? .againstRed : .textTertiary)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(
                    Capsule().fill(
                        d > 0 ? Color.emerald.opacity(0.12)
                              : d < 0 ? Color.againstRed.opacity(0.12)
                              : Color.surface300
                    )
                )
        }
        .padding(Spacing.sm)
    }

    // MARK: - Web Link Button

    private var webLinkButton: some View {
        Link(destination: webURL) {
            HStack {
                Image(systemName: "globe")
                    .font(.system(size: 14, weight: .semibold))
                Text("View full wiki on web")
                    .font(.lmBody)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 12))
            }
            .foregroundStyle(.forBlue)
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .fill(Color.forBlueDark.opacity(0.12))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.lg)
                            .stroke(Color.forBlue.opacity(0.2), lineWidth: 1)
                    )
            )
        }
        .padding(.top, Spacing.xs)
    }

    // MARK: - Skeleton

    private var skeletonView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.md) {
                SkeletonLine(width: 80, height: 10)
                SkeletonBlock(height: 64)
                SkeletonLine(width: 160, height: 10)
                Spacer().frame(height: 8)
                ForEach(0..<7, id: \.self) { i in
                    SkeletonLine(
                        width: i % 3 == 0 ? nil : CGFloat([260, 220, 180, 240, 200, 150, 190][i % 7]),
                        height: 13
                    )
                }
            }
            .padding(Spacing.md)
        }
    }

    // MARK: - Data Loading

    private func loadData() async {
        async let revsTask  = SupabaseClient.shared.fetchTopicWikiHistory(topicId: topic.id)
        async let linksTask = SupabaseClient.shared.fetchTopicOutgoingLinks(topicId: topic.id)
        let revs  = (try? await revsTask)  ?? []
        let links = (try? await linksTask) ?? []
        await MainActor.run {
            revisions    = revs
            linkedTopics = links
            isLoading    = false
        }
    }

    // MARK: - Helpers

    private func relativeTime(_ date: Date) -> String {
        let diff = Date().timeIntervalSince(date)
        let m = Int(diff / 60); let h = Int(diff / 3600); let d = Int(diff / 86400)
        if m < 2 { return "just now" }
        if m < 60 { return "\(m)m ago" }
        if h < 24 { return "\(h)h ago" }
        if d < 7  { return "\(d)d ago" }
        return "\(d / 7)w ago"
    }

    private func catColor(_ cat: String) -> Color {
        switch cat {
        case "Economics":   return .gold
        case "Politics":    return .forBlue
        case "Technology":  return .purple
        case "Science":     return .emerald
        case "Ethics":      return .againstRed
        case "Philosophy":  return .purple
        case "Culture":     return .gold
        case "Health":      return .emerald
        case "Environment": return .emerald
        case "Education":   return .forBlue
        default:            return .white.opacity(0.5)
        }
    }
}

// MARK: - Skeleton Helpers

private struct SkeletonLine: View {
    var width: CGFloat? = nil
    var height: CGFloat = 13
    @State private var animate = false
    var body: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(Color.surface200)
            .frame(width: width, height: height)
            .opacity(animate ? 0.5 : 1)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                    animate = true
                }
            }
    }
}

private struct SkeletonBlock: View {
    var height: CGFloat = 64
    @State private var animate = false
    var body: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color.surface200)
            .frame(height: height)
            .opacity(animate ? 0.5 : 1)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                    animate = true
                }
            }
    }
}

// MARK: - Preview

#Preview {
    TopicWikiView(topic: Topic.sampleData[0])
        .environmentObject(AuthService())
}
