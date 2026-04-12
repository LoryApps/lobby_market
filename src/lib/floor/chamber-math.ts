/**
 * Chamber math — geometry helpers for The Floor's isometric
 * parliamentary chamber. Seats are arranged on concentric arcs that
 * form a half-bowl; we project each seat with a 2:1 isometric view
 * so the chamber reads as a 3D hemicycle on a flat canvas.
 */

export interface Seat {
  id: number;
  row: number;
  seatInRow: number;
  radialAngle: number; // -PI/2 .. +PI/2 (left -> right)
  affinity: number; // 0 = deep red, 1 = deep blue
  worldX: number;
  worldY: number; // height above floor (positive = up)
  worldZ: number; // depth from camera (+ into scene)
  screenX: number;
  screenY: number;
  size: number;
  // Animation state
  pulse: number; // 0..1, extra brightness on vote
  pulseTarget: number;
  fadeIn: number; // 0..1, boot-up fade
}

export interface SeatLayoutParams {
  rows: number;
  seatsPerRow: number[];
  baseRadius: number;
  rowSpacing: number;
  rowHeightStep: number; // each row steps up this many units
  seatSize: number;
}

const DEG = Math.PI / 180;
export const ISO_ANGLE = 30 * DEG;
export const COS_ISO = Math.cos(ISO_ANGLE);
export const SIN_ISO = Math.sin(ISO_ANGLE);

/**
 * Generate seats in concentric arcs. Row 0 is the innermost (closest
 * to the rostrum), row N-1 is the outermost. Each row is a half-circle
 * from -PI/2 to +PI/2, and within a row seats are spread evenly.
 *
 * World coordinates: origin at the rostrum on the floor.
 *  +X is "stage right" (will become screen-right-ish)
 *  +Y is UP
 *  +Z is AWAY from camera (deeper into the chamber)
 * Since the rostrum is at the front and the back rows are further away,
 * a seat at radial angle theta lies at:
 *   X = radius * sin(theta)
 *   Z = radius * cos(theta)      (back of chamber = larger Z)
 *   Y = row * rowHeightStep      (back rows stepped up slightly)
 */
export function generateSeats(params: SeatLayoutParams): Seat[] {
  const {
    rows,
    seatsPerRow,
    baseRadius,
    rowSpacing,
    rowHeightStep,
    seatSize,
  } = params;
  const seats: Seat[] = [];
  let id = 0;
  for (let row = 0; row < rows; row++) {
    const countInRow = seatsPerRow[row] ?? seatsPerRow[seatsPerRow.length - 1];
    const radius = baseRadius + row * rowSpacing;
    const height = row * rowHeightStep;
    // Spread seats along -PI/2 .. +PI/2 (semicircle facing rostrum)
    // Pad the edges slightly so outermost seats don't hug the ends.
    const span = Math.PI * 0.92;
    const start = -span / 2;
    for (let s = 0; s < countInRow; s++) {
      const t =
        countInRow === 1 ? 0.5 : s / (countInRow - 1);
      const angle = start + t * span;
      const worldX = Math.sin(angle) * radius;
      const worldZ = Math.cos(angle) * radius;
      const worldY = height;
      seats.push({
        id: id++,
        row,
        seatInRow: s,
        radialAngle: angle,
        affinity: 0.5,
        worldX,
        worldY,
        worldZ,
        screenX: 0,
        screenY: 0,
        size: seatSize + row * 0.08,
        pulse: 0,
        pulseTarget: 0,
        fadeIn: 0,
      });
    }
  }
  return seats;
}

/**
 * Classic 2:1 isometric projection:
 *   screenX = (worldX - worldZ) * cos(30°)
 *   screenY = (worldX + worldZ) * sin(30°) - worldY
 * We rotate the view so +Z goes into the page and seats in the back
 * rows appear higher on screen.
 */
export function projectIsometric(
  worldX: number,
  worldY: number,
  worldZ: number
): { x: number; y: number } {
  const x = (worldX - worldZ) * COS_ISO;
  const y = (worldX + worldZ) * SIN_ISO - worldY;
  return { x, y };
}

/**
 * Update screen positions for all seats (call once at layout time
 * and on resize — projection itself is deterministic from worldX/Y/Z).
 */
export function projectSeats(seats: Seat[]) {
  for (const seat of seats) {
    const p = projectIsometric(seat.worldX, seat.worldY, seat.worldZ);
    seat.screenX = p.x;
    seat.screenY = p.y;
  }
}

/**
 * Assign affinities so the chamber reads like a real parliament —
 * leftmost seats are the bluest (most-agree), rightmost are the
 * reddest (most-disagree). We add a little natural variance so the
 * boundary between the two "sides" isn't a razor edge.
 */
export function assignAffinities(seats: Seat[], bluePct: number): Seat[] {
  const blueFrac = Math.max(0, Math.min(1, bluePct / 100));
  // Sort ids by radial angle (leftmost first). We clone + mutate affinity.
  const sorted = [...seats].sort((a, b) => a.radialAngle - b.radialAngle);
  const total = sorted.length;
  for (let i = 0; i < total; i++) {
    const seat = sorted[i];
    // Position in the 0..1 sorted axis (0 = far left, 1 = far right)
    const t = total === 1 ? 0.5 : i / (total - 1);
    // Deterministic pseudo-random variance per seat (no Math.random
    // so rerenders don't flicker affinities).
    const seed = Math.sin(seat.id * 12.9898 + seat.row * 78.233) * 43758.5453;
    const jitter = (seed - Math.floor(seed) - 0.5) * 0.08;
    // Seats up to blueFrac are blue, rest red. Soft transition around the
    // boundary for texture (no pure step function).
    const dist = t - blueFrac;
    // Logistic-ish soft boundary
    const soft = 1 / (1 + Math.exp(dist * 14));
    seat.affinity = Math.max(0, Math.min(1, soft + jitter));
  }
  return seats;
}

/**
 * Interpolate between against-500 (#ef4444) and for-500 (#3b82f6)
 * on affinity 0..1. Returns a plain {r,g,b} so we can also emit
 * rgba() strings for glows.
 */
export function colorFromAffinity(affinity: number): {
  r: number;
  g: number;
  b: number;
} {
  // against-500 -> for-500
  const a = Math.max(0, Math.min(1, affinity));
  const red = { r: 0xef, g: 0x44, b: 0x44 };
  const blue = { r: 0x3b, g: 0x82, b: 0xf6 };
  return {
    r: Math.round(red.r + (blue.r - red.r) * a),
    g: Math.round(red.g + (blue.g - red.g) * a),
    b: Math.round(red.b + (blue.b - red.b) * a),
  };
}

export function rgb(c: { r: number; g: number; b: number }, alpha = 1): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

/**
 * Compute the tight screen bounds of the projected seats so the
 * caller can center + fit the chamber inside the canvas.
 */
export function computeBounds(seats: Seat[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const seat of seats) {
    if (seat.screenX < minX) minX = seat.screenX;
    if (seat.screenX > maxX) maxX = seat.screenX;
    if (seat.screenY < minY) minY = seat.screenY;
    if (seat.screenY > maxY) maxY = seat.screenY;
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Default chamber geometry — full (desktop) and compact (mobile).
 * Compact keeps the arcs but drops seat density.
 */
export const DEFAULT_LAYOUT: SeatLayoutParams = {
  rows: 12,
  seatsPerRow: [22, 26, 30, 34, 38, 42, 46, 50, 52, 54, 56, 50],
  baseRadius: 120,
  rowSpacing: 28,
  rowHeightStep: 4,
  seatSize: 6.5,
};

export const COMPACT_LAYOUT: SeatLayoutParams = {
  rows: 10,
  seatsPerRow: [12, 14, 16, 18, 20, 22, 24, 26, 24, 20],
  baseRadius: 90,
  rowSpacing: 22,
  rowHeightStep: 3,
  seatSize: 5.5,
};
