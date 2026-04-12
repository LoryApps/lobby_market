/**
 * Deterministic math for placing user plots in the 3D city.
 * Pure functions — no side effects, no react, no three.js.
 */

/** Unit spacing between plot centers (world units). */
export const PLOT_SPACING = 12

/**
 * djb2 hash — simple, fast, deterministic. Returns a non-negative integer.
 */
export function simpleHash(input: string): number {
  let h = 5381
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i)
  }
  // Coerce to unsigned 32-bit
  return h >>> 0
}

/**
 * Ulam / Rosenblatt square spiral.
 * n = 0 -> (0, 0)
 * n = 1 -> (1, 0), n = 2 -> (1, 1), n = 3 -> (0, 1), n = 4 -> (-1, 1), ...
 * Walks outward in concentric square rings.
 */
export function spiralCoords(n: number): { x: number; y: number } {
  if (n === 0) return { x: 0, y: 0 }

  // Ring index r: the square ring this n belongs to
  const r = Math.ceil((Math.sqrt(n + 1) - 1) / 2)
  // Each ring r has 8*r cells, starting at index (2r-1)^2
  const ringStart = (2 * r - 1) * (2 * r - 1)
  const offset = n - ringStart
  const sideLen = 2 * r
  const side = Math.floor(offset / sideLen)
  const pos = offset % sideLen

  let x = 0
  let y = 0
  switch (side) {
    case 0: // right side, moving up
      x = r
      y = -r + 1 + pos
      break
    case 1: // top side, moving left
      x = r - 1 - pos
      y = r
      break
    case 2: // left side, moving down
      x = -r
      y = r - 1 - pos
      break
    case 3: // bottom side, moving right
      x = -r + 1 + pos
      y = -r
      break
  }
  return { x, y }
}

/**
 * Deterministic world position from a user ID.
 * Distinct users map to distinct cells (with high probability for the first ~10k users).
 */
export function plotPosition(userId: string): [number, number] {
  const h = simpleHash(userId)
  const { x, y } = spiralCoords(h % 10000)
  return [x * PLOT_SPACING, y * PLOT_SPACING]
}

/**
 * Map reputation score to a building tier 0..6.
 * - 0-99       -> tier 0 (tent)
 * - 100-499    -> tier 1 (wooden house)
 * - 500-1499   -> tier 2 (stone cottage)
 * - 1500-3499  -> tier 3 (townhouse)
 * - 3500-6499  -> tier 4 (office)
 * - 6500-9999  -> tier 5 (apartment tower)
 * - 10000+     -> tier 6 (skyscraper)
 */
export function buildingTier(reputation: number | null | undefined): number {
  const r = reputation ?? 0
  if (r < 100) return 0
  if (r < 500) return 1
  if (r < 1500) return 2
  if (r < 3500) return 3
  if (r < 6500) return 4
  if (r < 10000) return 5
  return 6
}

export const TIER_NAMES = [
  'Tent',
  'Wooden House',
  'Stone Cottage',
  'Townhouse',
  'Office Building',
  'Apartment Tower',
  'Skyscraper',
] as const

export function tierName(tier: number): string {
  return TIER_NAMES[Math.max(0, Math.min(TIER_NAMES.length - 1, tier))]
}

export function tierRange(tier: number): { min: number; max: number } {
  switch (tier) {
    case 0:
      return { min: 0, max: 100 }
    case 1:
      return { min: 100, max: 500 }
    case 2:
      return { min: 500, max: 1500 }
    case 3:
      return { min: 1500, max: 3500 }
    case 4:
      return { min: 3500, max: 6500 }
    case 5:
      return { min: 6500, max: 10000 }
    default:
      return { min: 10000, max: Infinity }
  }
}

/**
 * Progress (0..1) within the current tier toward the next tier.
 * Returns 1 for max tier.
 */
export function tierProgress(reputation: number | null | undefined): number {
  const r = reputation ?? 0
  const tier = buildingTier(r)
  if (tier >= 6) return 1
  const { min, max } = tierRange(tier)
  if (max === Infinity) return 1
  return Math.max(0, Math.min(1, (r - min) / (max - min)))
}

/**
 * Deterministic pseudo-random scalar in [0, 1) from a user id and a tag.
 * Used for small visual variations (rotation, color jitter).
 */
export function seededScalar(userId: string, tag: string): number {
  const h = simpleHash(userId + ':' + tag)
  return (h % 100000) / 100000
}
