import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface SprintTopic {
  id: string
  statement: string
  category: string | null
  /** Hidden from the UI until user answers — 'law' or 'failed' */
  outcome: 'law' | 'failed'
  total_votes: number
  /** Shown as a hint — but this is the FINAL percentage */
  blue_pct: number
}

export interface SprintResponse {
  topics: SprintTopic[]
  seed: string
}

/**
 * GET /api/sprint
 *
 * Returns 10 closed topics (law or failed) for the Civic Sprint game.
 * Topics are chosen so the batch is balanced (≈ 5 laws, ≈ 5 failed) and
 * rotated daily (different each calendar day) so returning players get
 * fresh content.
 *
 * Requires ≥ 15 votes so results are meaningful signal.
 */
export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['law', 'failed'])
    .gte('total_votes', 15)
    .order('total_votes', { ascending: false })
    .limit(300)

  if (error || !data || data.length === 0) {
    return NextResponse.json({ topics: [], seed: '' } satisfies SprintResponse)
  }

  // Daily seed for deterministic-per-day shuffle
  const today = new Date().toISOString().slice(0, 10)
  const seed = today

  // Split into law / failed pools
  const laws = data.filter((t) => t.status === 'law')
  const failed = data.filter((t) => t.status === 'failed')

  // Deterministic seeded shuffle — mulberry32 PRNG
  function mulberry32(s: number) {
    return function () {
      let t = (s += 0x6d2b79f5)
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const dateNum = parseInt(today.replace(/-/g, ''), 10)
  const rand = mulberry32(dateNum)

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const shuffledLaws = shuffle(laws)
  const shuffledFailed = shuffle(failed)

  // Take up to 5 from each pool; pad from the other if needed
  const pickedLaws = shuffledLaws.slice(0, 5)
  const pickedFailed = shuffledFailed.slice(0, 5)
  const combined = shuffle([...pickedLaws, ...pickedFailed]).slice(0, 10)

  const topics: SprintTopic[] = combined.map((t) => ({
    id: t.id as string,
    statement: t.statement as string,
    category: (t.category as string | null) ?? null,
    outcome: t.status === 'law' ? 'law' : 'failed',
    total_votes: t.total_votes as number,
    blue_pct: Math.round((t.blue_pct as number) ?? 50),
  }))

  return NextResponse.json({ topics, seed } satisfies SprintResponse)
}
