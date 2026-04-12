//
//  ChamberMath.swift
//  LobbyMarket
//
//  Pure math/geometry for the parliamentary chamber.
//

import CoreGraphics
import Foundation

/// A single seat in the chamber.
struct Seat: Identifiable, Equatable {
    let id: Int
    /// Grid row (concentric arc index, 0 = innermost).
    let row: Int
    /// Grid column within the arc.
    let col: Int
    /// Normalized world position, -1..1 on x, 0..1 on y (before isometric projection).
    let worldX: Double
    let worldZ: Double
    /// Affinity in [0,1]: 0 = fully AGAINST, 1 = fully FOR.
    /// (Determined by position relative to the center aisle — left = for, right = against.)
    let affinity: Double
}

enum ChamberLayout {
    /// Generate a semicircular parliamentary seating plan with the given number of rows.
    /// - Returns: Array of seats, total count ~= rows * seatsPerRow (scaled).
    static func generateSeats(rows: Int = 10, baseSeatsFirstRow: Int = 18) -> [Seat] {
        var seats: [Seat] = []
        var id = 0
        for r in 0..<rows {
            let count = baseSeatsFirstRow + r * 4
            let radius = 0.35 + Double(r) * 0.07
            for c in 0..<count {
                // Half circle from 180° (left) to 0° (right).
                let t = Double(c) / Double(count - 1)
                let angle = Double.pi * (1.0 - t)   // π → 0
                let x = cos(angle) * radius
                let z = sin(angle) * radius
                // Affinity — left side (x < 0) leans FOR, right leans AGAINST.
                let affinity = (1.0 - t)  // left=1.0, right=0.0
                seats.append(Seat(
                    id: id,
                    row: r,
                    col: c,
                    worldX: x,
                    worldZ: z,
                    affinity: affinity
                ))
                id += 1
            }
        }
        return seats
    }

    /// Project a world-space coord (x,z) with isometric projection onto a canvas of `size`.
    /// Uses a standard 30° iso angle.
    static func project(x: Double, z: Double, size: CGSize, tilt: Double = 0.62) -> CGPoint {
        // Scale to canvas
        let scale = min(size.width, size.height) * 0.45
        let cx = size.width / 2
        let cy = size.height * 0.66
        // Iso-ish projection: x stays, z is flattened vertically by `tilt`.
        let screenX = cx + x * scale
        let screenY = cy - z * scale * tilt
        return CGPoint(x: screenX, y: screenY)
    }

    /// How many seats should appear "filled" given a blue percentage (0-100).
    /// Seats are distributed by affinity — the highest-affinity seats flip FOR first.
    static func partition(seats: [Seat], bluePct: Double) -> (blueIDs: Set<Int>, redIDs: Set<Int>) {
        let total = seats.count
        let blueCount = Int((bluePct / 100.0) * Double(total))
        let sorted = seats.sorted { $0.affinity > $1.affinity }
        let blue = Set(sorted.prefix(blueCount).map(\.id))
        let red = Set(seats.map(\.id)).subtracting(blue)
        return (blue, red)
    }

    /// Breathing animation offset — subtle vertical bob.
    static func breathingOffset(phase: Double, seatRow: Int) -> CGFloat {
        let amplitude: Double = 1.2
        let rowOffset = Double(seatRow) * 0.35
        return CGFloat(sin(phase + rowOffset) * amplitude)
    }
}
