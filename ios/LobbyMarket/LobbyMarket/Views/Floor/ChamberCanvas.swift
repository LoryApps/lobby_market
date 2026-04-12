//
//  ChamberCanvas.swift
//  LobbyMarket
//
//  Custom Canvas-rendered isometric parliamentary chamber.
//

import SwiftUI

struct ChamberCanvas: View {
    let seats: [Seat]
    let bluePct: Double

    @State private var phase: Double = 0

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: false)) { context in
            let time = context.date.timeIntervalSinceReferenceDate
            Canvas { ctx, size in
                draw(ctx: &ctx, size: size, time: time)
            }
            .background(backgroundGradient)
        }
    }

    private var backgroundGradient: some View {
        RadialGradient(
            colors: [
                Color.surface200,
                Color.surface100,
                Color.surface0
            ],
            center: .center,
            startRadius: 20,
            endRadius: 600
        )
    }

    // MARK: - Drawing

    private func draw(ctx: inout GraphicsContext, size: CGSize, time: TimeInterval) {
        drawFloor(ctx: &ctx, size: size)
        drawDais(ctx: &ctx, size: size)

        let partition = ChamberLayout.partition(seats: seats, bluePct: bluePct)
        let phase = time.truncatingRemainder(dividingBy: .pi * 4)

        // Sort seats by y so back-to-front painter's algorithm works.
        let projected = seats.map { seat -> (Seat, CGPoint) in
            let p = ChamberLayout.project(x: seat.worldX, z: seat.worldZ, size: size)
            return (seat, p)
        }.sorted { $0.1.y < $1.1.y }

        for (seat, point) in projected {
            let breathY = ChamberLayout.breathingOffset(phase: phase, seatRow: seat.row)
            let shifted = CGPoint(x: point.x, y: point.y + breathY)
            let isBlue = partition.blueIDs.contains(seat.id)
            drawSeat(ctx: &ctx, at: shifted, isBlue: isBlue, affinity: seat.affinity, row: seat.row)
        }

        drawCenterAisle(ctx: &ctx, size: size)
    }

    private func drawFloor(ctx: inout GraphicsContext, size: CGSize) {
        // Semi-ellipse floor
        let rect = CGRect(
            x: size.width * 0.08,
            y: size.height * 0.36,
            width: size.width * 0.84,
            height: size.height * 0.5
        )
        let floorPath = Path(ellipseIn: rect)
        ctx.fill(
            floorPath,
            with: .linearGradient(
                Gradient(colors: [
                    Color.surface300.opacity(0.9),
                    Color.surface200.opacity(0.6)
                ]),
                startPoint: CGPoint(x: rect.midX, y: rect.minY),
                endPoint: CGPoint(x: rect.midX, y: rect.maxY)
            )
        )
        // Concentric rings
        for ring in stride(from: 0.95, through: 0.45, by: -0.08) {
            let r = CGRect(
                x: rect.midX - rect.width * ring / 2,
                y: rect.midY - rect.height * ring / 2,
                width: rect.width * ring,
                height: rect.height * ring
            )
            ctx.stroke(Path(ellipseIn: r), with: .color(.white.opacity(0.04)), lineWidth: 1)
        }
    }

    private func drawDais(ctx: inout GraphicsContext, size: CGSize) {
        let daisWidth = size.width * 0.18
        let daisHeight: CGFloat = 14
        let cx = size.width / 2
        let cy = size.height * 0.70

        var path = Path()
        path.move(to: CGPoint(x: cx - daisWidth / 2, y: cy))
        path.addLine(to: CGPoint(x: cx + daisWidth / 2, y: cy))
        path.addLine(to: CGPoint(x: cx + daisWidth / 2 - 8, y: cy + daisHeight))
        path.addLine(to: CGPoint(x: cx - daisWidth / 2 + 8, y: cy + daisHeight))
        path.closeSubpath()

        ctx.fill(path, with: .color(.gold.opacity(0.6)))
        ctx.stroke(path, with: .color(.gold), lineWidth: 1.5)
    }

    private func drawSeat(
        ctx: inout GraphicsContext,
        at point: CGPoint,
        isBlue: Bool,
        affinity: Double,
        row: Int
    ) {
        let seatWidth: CGFloat = 14
        let seatHeight: CGFloat = 8

        // Isometric diamond
        var diamond = Path()
        diamond.move(to: CGPoint(x: point.x, y: point.y - seatHeight / 2))
        diamond.addLine(to: CGPoint(x: point.x + seatWidth / 2, y: point.y))
        diamond.addLine(to: CGPoint(x: point.x, y: point.y + seatHeight / 2))
        diamond.addLine(to: CGPoint(x: point.x - seatWidth / 2, y: point.y))
        diamond.closeSubpath()

        // Shadow
        var shadow = diamond
        shadow = shadow.offsetBy(dx: 1, dy: 3)
        ctx.fill(shadow, with: .color(.black.opacity(0.35)))

        // Fill color with gradient based on affinity
        let fillColor: Color = isBlue ? Color.forBlue : Color.againstRed
        let darker: Color = isBlue ? Color.forBlueDark : Color.againstRedDark

        ctx.fill(
            diamond,
            with: .linearGradient(
                Gradient(colors: [fillColor, darker]),
                startPoint: CGPoint(x: point.x, y: point.y - seatHeight / 2),
                endPoint: CGPoint(x: point.x, y: point.y + seatHeight / 2)
            )
        )

        // Top highlight
        var highlight = Path()
        highlight.move(to: CGPoint(x: point.x, y: point.y - seatHeight / 2))
        highlight.addLine(to: CGPoint(x: point.x + seatWidth / 2 - 2, y: point.y - 1))
        highlight.addLine(to: CGPoint(x: point.x - seatWidth / 2 + 2, y: point.y - 1))
        highlight.closeSubpath()
        ctx.fill(highlight, with: .color(.white.opacity(0.22)))

        // Outline
        ctx.stroke(diamond, with: .color(.black.opacity(0.4)), lineWidth: 0.5)
    }

    private func drawCenterAisle(ctx: inout GraphicsContext, size: CGSize) {
        let cx = size.width / 2
        let topY = size.height * 0.36
        let bottomY = size.height * 0.82

        var aisle = Path()
        aisle.move(to: CGPoint(x: cx - 3, y: topY))
        aisle.addLine(to: CGPoint(x: cx + 3, y: topY))
        aisle.addLine(to: CGPoint(x: cx + 6, y: bottomY))
        aisle.addLine(to: CGPoint(x: cx - 6, y: bottomY))
        aisle.closeSubpath()
        ctx.fill(aisle, with: .color(.gold.opacity(0.14)))
    }
}

#Preview {
    ChamberCanvas(seats: ChamberLayout.generateSeats(), bluePct: 62)
        .frame(height: 420)
        .padding()
        .background(Color.surface0)
}
