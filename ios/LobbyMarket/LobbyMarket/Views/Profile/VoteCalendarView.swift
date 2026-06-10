//
//  VoteCalendarView.swift
//  LobbyMarket
//
//  GitHub-style 16-week vote activity heatmap. Each day cell is colored
//  by vote count: surface300 (0) → forBlue at 35 / 60 / 82 / 100 % opacity.
//  Streak badge shows a flame with progressive color (blue → gold → red).
//

import SwiftUI

// MARK: - View

struct VoteCalendarView: View {
    let voteDates: [Date]
    let streak: Int

    private let weeksToShow = 16
    private let cellSize: CGFloat = 11
    private let cellGap: CGFloat  = 3

    // MARK: - Grid

    /// 16 columns × 7 rows (Sun = 0 … Sat = 6). nil means future or padding.
    private var grid: [[Date?]] {
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        // weekday: 1 = Sun … 7 = Sat
        let sunOffset = cal.component(.weekday, from: today) - 1
        guard
            let thisSunday  = cal.date(byAdding: .day, value: -sunOffset, to: today),
            let firstSunday = cal.date(byAdding: .weekOfYear, value: -(weeksToShow - 1), to: thisSunday)
        else { return [] }

        return (0..<weeksToShow).map { w in
            guard let weekStart = cal.date(byAdding: .weekOfYear, value: w, to: firstSunday) else {
                return [Date?](repeating: nil, count: 7)
            }
            return (0..<7).map { d in
                guard let day = cal.date(byAdding: .day, value: d, to: weekStart) else { return nil }
                return day <= today ? day : nil
            }
        }
    }

    /// Votes per calendar day (start-of-day keyed)
    private var countsByDay: [Date: Int] {
        let cal = Calendar.current
        return voteDates.reduce(into: [:]) { acc, d in
            acc[cal.startOfDay(for: d), default: 0] += 1
        }
    }

    /// Short month label to display above a column, only when the 1st of a
    /// month falls inside that week (or it's the very first column).
    private func monthLabel(for col: Int) -> String? {
        guard col < grid.count else { return nil }
        let cal = Calendar.current
        let fmt = DateFormatter()
        fmt.dateFormat = "MMM"
        for case let date? in grid[col] {
            let dayNum = cal.component(.day, from: date)
            if dayNum <= 7 || col == 0 {
                return fmt.string(from: date)
            }
        }
        return nil
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm) {
            headerRow
            monthRow
            dayGrid
            legendRow
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radii.lg)
                .fill(Color.surface200)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
        )
    }

    // MARK: - Sub-views

    private var headerRow: some View {
        HStack {
            Label {
                Text("VOTE ACTIVITY")
                    .font(.lmMono)
                    .kerning(1.2)
            } icon: {
                Image(systemName: "calendar.badge.checkmark")
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(.textTertiary)
            Spacer()
            if streak > 0 {
                streakBadge
            }
        }
    }

    private var streakBadge: some View {
        HStack(spacing: 3) {
            Image(systemName: "flame.fill")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(streakColor)
            Text("\(streak)d")
                .font(.system(size: 12, weight: .bold, design: .monospaced))
                .foregroundStyle(streakColor)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            Capsule()
                .fill(streakColor.opacity(0.12))
                .overlay(Capsule().stroke(streakColor.opacity(0.3), lineWidth: 1))
        )
    }

    private var monthRow: some View {
        HStack(alignment: .top, spacing: cellGap) {
            ForEach(0..<grid.count, id: \.self) { col in
                if let label = monthLabel(for: col) {
                    Text(label)
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundStyle(.textTertiary)
                        .frame(width: cellSize, alignment: .leading)
                } else {
                    Color.clear.frame(width: cellSize, height: 1)
                }
            }
        }
    }

    private var dayGrid: some View {
        // Row = day of week (0 = Sun, 6 = Sat)
        VStack(spacing: cellGap) {
            ForEach(0..<7, id: \.self) { row in
                HStack(spacing: cellGap) {
                    ForEach(0..<grid.count, id: \.self) { col in
                        dayCell(grid[col][row])
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func dayCell(_ date: Date?) -> some View {
        if let date {
            let count = countsByDay[date] ?? 0
            let isToday = Calendar.current.isDateInToday(date)
            RoundedRectangle(cornerRadius: 2)
                .fill(cellFill(count))
                .frame(width: cellSize, height: cellSize)
                .overlay(
                    isToday
                    ? RoundedRectangle(cornerRadius: 2)
                        .stroke(Color.white.opacity(0.55), lineWidth: 1)
                    : nil
                )
        } else {
            Color.clear.frame(width: cellSize, height: cellSize)
        }
    }

    private var legendRow: some View {
        HStack(spacing: 5) {
            Text("Less")
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(.textTertiary)
            ForEach([0, 1, 2, 3, 4], id: \.self) { level in
                RoundedRectangle(cornerRadius: 2)
                    .fill(cellFill(level))
                    .frame(width: cellSize, height: cellSize)
            }
            Text("More")
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(.textTertiary)
            Spacer()
            let daysActive = countsByDay.count
            Text("\(daysActive) day\(daysActive == 1 ? "" : "s") active")
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(.textTertiary)
        }
    }

    // MARK: - Helpers

    private func cellFill(_ count: Int) -> Color {
        switch count {
        case 0:   return Color.surface300
        case 1:   return Color.forBlue.opacity(0.35)
        case 2:   return Color.forBlue.opacity(0.60)
        case 3:   return Color.forBlue.opacity(0.82)
        default:  return Color.forBlue
        }
    }

    private var streakColor: Color {
        streak >= 30 ? .againstRed : streak >= 7 ? .gold : .forBlue
    }

    // MARK: - Static helper (usable from parent views)

    /// Computes the current vote streak from an array of vote dates.
    /// Allows skipping today if the user hasn't voted yet.
    static func streak(from dates: [Date]) -> Int {
        guard !dates.isEmpty else { return 0 }
        let cal = Calendar.current
        var day = cal.startOfDay(for: Date())
        var count = 0

        while true {
            let voted = dates.contains { cal.isDate(cal.startOfDay(for: $0), inSameDayAs: day) }
            if voted {
                count += 1
                day = cal.date(byAdding: .day, value: -1, to: day)!
            } else if count == 0 {
                // Today wasn't voted — check yesterday before breaking
                let yesterday = cal.date(byAdding: .day, value: -1, to: day)!
                if dates.contains(where: { cal.isDate(cal.startOfDay(for: $0), inSameDayAs: yesterday) }) {
                    day = yesterday
                } else {
                    break
                }
            } else {
                break
            }
        }
        return count
    }
}

// MARK: - Preview

#Preview {
    let sampleDates: [Date] = (0..<112).compactMap { i in
        Bool.random() ? Calendar.current.date(byAdding: .day, value: -i, to: Date()) : nil
    }
    return VStack {
        VoteCalendarView(voteDates: sampleDates, streak: 14)
            .padding()
    }
    .background(Color.surface0)
}
