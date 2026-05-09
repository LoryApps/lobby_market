import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface RankLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
}

export interface RankRound {
  laws: RankLaw[]  // 4 laws in shuffled (wrong) order — correct order is blue_pct descending
}

export interface CivicRankPayload {
  date: string        // YYYY-MM-DD used as seed
  rounds: RankRound[] // 5 rounds
}

// ─── Seeded shuffle (same algorithm as Bingo) ─────────────────────────────────

function seededShuffle<T>(arr: T[], seed: string): T[] {
  const clone = [...arr]
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0
  }
  let rng = h
  function next() {
    rng ^= rng << 13
    rng ^= rng >> 17
    rng ^= rng << 5
    return (rng >>> 0) / 4294967296
  }
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[clone[i], clone[j]] = [clone[j], clone[i]]
  }
  return clone
}

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
}

/**
 * GET /api/civic-rank
 *
 * Returns 5 daily rounds for Civic Rank.  Each round contains 4 laws
 * pre-shuffled into a random order — the player's task is to re-sort
 * them from highest community support (blue_pct) to lowest.
 *
 * Rounds are seeded by today's date so all players face the same 20 laws.
 * blue_pct is included so the client can score the answer without a second
 * request.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const date = getTodayUTC()

    // Need at least 20 laws with meaningful vote counts for 5 rounds × 4 laws
    const { data, error } = await supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes')
      .eq('is_active', true)
      .gte('total_votes', 20)
      .order('total_votes', { ascending: false })
      .limit(200)

    if (error || !data || data.length < 20) {
      return NextResponse.json({ date, rounds: [] } satisfies CivicRankPayload)
    }

    // Deterministic daily selection: shuffle the pool, take first 20
    const pool = seededShuffle(data as RankLaw[], date)
    const selected = pool.slice(0, 20)

    // Split into 5 rounds of 4 laws each
    const rounds: RankRound[] = []
    for (let r = 0; r < 5; r++) {
      const group = selected.slice(r * 4, r * 4 + 4)
      // Shuffle the group so they don't start in the correct order
      const shuffled = seededShuffle(group, `${date}-round-${r}`)
      rounds.push({ laws: shuffled })
    }

    return NextResponse.json({ date, rounds } satisfies CivicRankPayload)
  } catch {
    return NextResponse.json({ date: getTodayUTC(), rounds: [] } satisfies CivicRankPayload)
  }
}
