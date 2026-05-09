import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecallItem {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface RecallPayload {
  /** The 6 items the player must memorise */
  targets: RecallItem[]
  /** All 12 items in randomised order (6 targets + 6 decoys) */
  grid: RecallItem[]
  date: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  const copy = [...arr]
  let h = seed.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  for (let i = copy.length - 1; i > 0; i--) {
    h = ((h * 1664525) + 1013904223) >>> 0
    const j = h % (i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting', 'law', 'failed'])
    .gte('total_votes', 5)
    .not('category', 'is', null)
    .order('total_votes', { ascending: false })
    .limit(300)

  if (error || !data || data.length < 12) {
    return NextResponse.json({ error: 'Not enough topics to build puzzle' }, { status: 500 })
  }

  const date = todayUTC()

  // Deterministically shuffle the entire pool for today
  const shuffled = seededShuffle(data as RecallItem[], `recall-${date}`)

  // First 6 are targets, next 6 are decoys
  const targets = shuffled.slice(0, 6)
  const decoys = shuffled.slice(6, 12)

  // Shuffle the grid so targets and decoys are interleaved
  const grid = seededShuffle([...targets, ...decoys], `recall-grid-${date}`)

  return NextResponse.json({ targets, grid, date } satisfies RecallPayload)
}
