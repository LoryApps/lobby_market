import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TimelineLaw {
  id: string
  statement: string
  category: string | null
  established_at: string  // ISO date string, hidden from player until reveal
  total_votes: number
}

export interface TimelineRound {
  laws: TimelineLaw[]  // 5 laws in shuffled (wrong) order — correct order is established_at ascending
}

export interface CivicTimelinePayload {
  date: string           // YYYY-MM-DD used as seed
  rounds: TimelineRound[] // 3 rounds of 5 laws each
}

// ─── Seeded shuffle (same algorithm as Civic Rank / Bingo) ─────────────────

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
  return new Date().toISOString().slice(0, 10)
}

/**
 * GET /api/civic-timeline
 *
 * Returns 3 daily rounds for Civic Timeline.  Each round contains 5 laws
 * pre-shuffled into a random order — the player's task is to re-sort them
 * into chronological order (oldest established_at first).
 *
 * Rounds are seeded by today's date so all players face the same 15 laws.
 * established_at is included so the client can score without a second request,
 * but the game page hides it until the reveal phase.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const date = getTodayUTC()

    // Pull laws that have a valid established_at so we can sort chronologically
    // Need at least 15 for 3 rounds × 5 laws
    const { data, error } = await supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at')
      .eq('is_active', true)
      .gte('total_votes', 20)
      .not('established_at', 'is', null)
      .order('total_votes', { ascending: false })
      .limit(300)

    if (error || !data || data.length < 15) {
      return NextResponse.json({ date, rounds: [] } satisfies CivicTimelinePayload)
    }

    const pool = data as TimelineLaw[]

    // Filter out laws where all dates are identical (would make round unsolvable)
    // Then take a seeded daily selection
    const shuffled = seededShuffle(pool, date)
    const selected = shuffled.slice(0, 15)

    // Split into 3 rounds of 5 laws each
    const rounds: TimelineRound[] = []
    for (let r = 0; r < 3; r++) {
      const group = selected.slice(r * 5, r * 5 + 5)
      // Shuffle so they don't start in chronological order
      const shuffledGroup = seededShuffle(group, `${date}-round-${r}`)
      rounds.push({ laws: shuffledGroup })
    }

    return NextResponse.json({ date, rounds } satisfies CivicTimelinePayload)
  } catch {
    return NextResponse.json({ date: getTodayUTC(), rounds: [] } satisfies CivicTimelinePayload)
  }
}
