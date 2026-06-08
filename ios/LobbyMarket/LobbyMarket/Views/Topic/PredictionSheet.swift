//
//  PredictionSheet.swift
//  LobbyMarket
//
//  Modal sheet for viewing crowd prediction and placing your own forecast
//  on whether a topic will resolve as law or fail.
//

import SwiftUI

// MARK: - Main sheet

struct PredictionSheet: View {
    let topic: Topic

    @EnvironmentObject var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    @State private var crowdStats: TopicPredictionStats?
    @State private var myPrediction: Prediction?
    @State private var isLoading = true
    @State private var isSaving  = false
    @State private var errorMsg: String?

    // Slider state (0–100 representing "% chance it becomes law")
    @State private var sliderValue: Double = 50

    // Which outcome the slider implies
    private var predictedLaw: Bool { sliderValue >= 50 }

    private var confidenceValue: Int {
        // map: "law" = slider directly, "fail" = 100 - slider
        predictedLaw ? Int(sliderValue) : Int(100 - sliderValue)
    }

    var body: some View {
        ZStack {
            Color.surface0.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    headerSection
                    Divider().background(Color.white.opacity(0.08))
                    if isLoading {
                        loadingSkeleton
                    } else {
                        crowdSection
                        Divider().background(Color.white.opacity(0.08))
                        predictionSection
                    }
                    if let err = errorMsg {
                        Text(err)
                            .font(.lmCaption)
                            .foregroundStyle(.againstRed)
                            .padding(.horizontal)
                    }
                    Spacer(minLength: Spacing.xl)
                }
                .padding(.top, Spacing.md)
            }
        }
        .task { await load() }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.gold)
                Text("Prediction Market")
                    .font(.lmTitle)
                    .foregroundStyle(.textPrimary)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(.textTertiary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, Spacing.md)

            Text(topic.statement)
                .font(.lmBody)
                .foregroundStyle(.textSecondary)
                .lineLimit(3)
                .padding(.horizontal, Spacing.md)
        }
    }

    // MARK: - Crowd section

    private var crowdSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text("CROWD FORECAST")
                .font(.lmCaption)
                .kerning(1.2)
                .foregroundStyle(.textTertiary)
                .padding(.horizontal, Spacing.md)

            if let stats = crowdStats, stats.totalPredictions > 0 {
                VStack(spacing: Spacing.sm) {
                    // Law vs Fail bar
                    GeometryReader { geo in
                        HStack(spacing: 0) {
                            // Law portion
                            Rectangle()
                                .fill(Color.forBlue)
                                .frame(width: geo.size.width * stats.lawConfidence / 100)
                            // Fail portion
                            Rectangle()
                                .fill(Color.againstRed)
                        }
                    }
                    .frame(height: 12)
                    .clipShape(Capsule())
                    .padding(.horizontal, Spacing.md)

                    HStack {
                        Label("\(Int(stats.lawConfidence))% LAW", systemImage: "checkmark.seal.fill")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.forBlue)
                        Spacer()
                        Label("\(Int(100 - stats.lawConfidence))% FAIL", systemImage: "xmark.seal.fill")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.againstRed)
                    }
                    .padding(.horizontal, Spacing.md)

                    Text("\(stats.totalPredictions) citizen\(stats.totalPredictions == 1 ? "" : "s") have forecast this motion")
                        .font(.lmCaption)
                        .foregroundStyle(.textTertiary)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            } else {
                Text("No predictions yet — be the first forecaster.")
                    .font(.lmBody)
                    .foregroundStyle(.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, Spacing.sm)
            }
        }
        .padding(.vertical, Spacing.sm)
    }

    // MARK: - Prediction input section

    private var predictionSection: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            Text(myPrediction == nil ? "YOUR FORECAST" : "UPDATE FORECAST")
                .font(.lmCaption)
                .kerning(1.2)
                .foregroundStyle(.textTertiary)
                .padding(.horizontal, Spacing.md)

            if auth.currentUserId == nil {
                Text("Sign in to place a prediction and track your accuracy.")
                    .font(.lmBody)
                    .foregroundStyle(.textSecondary)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, Spacing.sm)
            } else {
                // Slider
                VStack(spacing: Spacing.md) {
                    // Outcome label
                    HStack {
                        Image(systemName: predictedLaw ? "checkmark.seal.fill" : "xmark.seal.fill")
                            .foregroundStyle(predictedLaw ? .forBlue : .againstRed)
                        Text(predictedLaw
                             ? "Will become Law"
                             : "Will Fail")
                            .font(.lmBodyBold)
                            .foregroundStyle(predictedLaw ? .forBlue : .againstRed)
                        Spacer()
                        Text("\(Int(sliderValue))%")
                            .font(.lmMono)
                            .foregroundStyle(.textSecondary)
                    }
                    .padding(.horizontal, Spacing.md)
                    .animation(.spring(duration: 0.2), value: predictedLaw)

                    // Slider — represents "% chance of becoming law"
                    Slider(value: $sliderValue, in: 1...99, step: 1)
                        .tint(predictedLaw ? .forBlue : .againstRed)
                        .padding(.horizontal, Spacing.md)
                        .onChange(of: sliderValue) { _ in Haptics.selection() }

                    HStack {
                        Text("Definitely Fails")
                            .font(.lmCaption)
                            .foregroundStyle(.textTertiary)
                        Spacer()
                        Text("Definitely Law")
                            .font(.lmCaption)
                            .foregroundStyle(.textTertiary)
                    }
                    .padding(.horizontal, Spacing.md)

                    // Previous prediction badge
                    if let prev = myPrediction {
                        HStack(spacing: Spacing.xs) {
                            Image(systemName: "clock")
                                .font(.system(size: 11))
                            Text("Your current forecast: \(prev.predictedLaw ? "Law" : "Fail") at \(prev.confidence)% confidence")
                                .font(.lmCaption)
                        }
                        .foregroundStyle(.textTertiary)
                        .padding(.horizontal, Spacing.md)
                    }

                    // Submit button
                    Button {
                        Haptics.impact(.medium)
                        Task { await save() }
                    } label: {
                        Group {
                            if isSaving {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .tint(.white)
                            } else {
                                Text(myPrediction == nil ? "Place Forecast" : "Update Forecast")
                                    .font(.lmBodyBold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.sm)
                        .background(predictedLaw ? Color.forBlue : Color.againstRed)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                    }
                    .buttonStyle(.plain)
                    .disabled(isSaving)
                    .padding(.horizontal, Spacing.md)
                }
                .padding(.vertical, Spacing.xs)
            }
        }
        .padding(.vertical, Spacing.sm)
    }

    // MARK: - Skeleton

    private var loadingSkeleton: some View {
        VStack(spacing: Spacing.md) {
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: Radii.md)
                    .fill(Color.surface200)
                    .frame(height: 40)
                    .padding(.horizontal, Spacing.md)
            }
        }
    }

    // MARK: - Data

    private func load() async {
        isLoading = true
        defer { isLoading = false }

        let stats = try? await SupabaseClient.shared.fetchTopicPredictionStats(topicId: topic.id)
        crowdStats = stats

        if let uid = auth.currentUserId {
            let pred = try? await SupabaseClient.shared.fetchMyPrediction(topicId: topic.id, userId: uid)
            myPrediction = pred
            if let p = pred {
                sliderValue = p.predictedLaw ? Double(p.confidence) : Double(100 - p.confidence)
            }
        }
    }

    private func save() async {
        guard let uid = auth.currentUserId else { return }
        isSaving = true
        errorMsg = nil
        defer { isSaving = false }

        do {
            let saved = try await SupabaseClient.shared.upsertPrediction(
                topicId: topic.id,
                userId: uid,
                predictedLaw: predictedLaw,
                confidence: confidenceValue
            )
            await MainActor.run {
                myPrediction = saved
                Haptics.notify(.success)
            }
            // Refresh crowd stats
            let stats = try? await SupabaseClient.shared.fetchTopicPredictionStats(topicId: topic.id)
            await MainActor.run { crowdStats = stats }
        } catch {
            await MainActor.run {
                errorMsg = "Could not save forecast — \(error.localizedDescription)"
                Haptics.notify(.error)
            }
        }
    }
}

// MARK: - Preview

#Preview {
    PredictionSheet(topic: Topic.sampleData[0])
        .environmentObject(AuthService())
}
