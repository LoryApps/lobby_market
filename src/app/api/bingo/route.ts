import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface BingoTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface BingoCard {
  week: string
  topics: BingoTopic[] // 24 topics (center is FREE)
}

export const dynamic = 'force-dynamic'
export const revalidate = 300

// Returns the ISO week string for the current week, e.g. "2026-W18"
function getISOWeekKey(): string {
  const now = new Date()
  const janFourth = new Date(Date.UTC(now.getUTCFullYear(), 0, 4))
  const startOfWeekOne = new Date(janFourth)
  startOfWeekOne.setUTCDate(janFourth.getUTCDate() - ((janFourth.getUTCDay() || 7) - 1))
  const weekNum =
    Math.ceil(
      ((now.getTime() - startOfWeekOne.getTime()) / 86400000 + 1) / 7
    )
  return `${now.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// Seeded shuffle: deterministic for a given week so every user gets the same card
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
    return ((rng >>> 0) / 4294967296)
  }
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[clone[i], clone[j]] = [clone[j], clone[i]]
  }
  return clone
}

export async function GET() {
  try {
    const supabase = await createClient()
    const week = getISOWeekKey()

    // Fetch a pool of topics to draw from — recent proposed/active/voting/law/failed,
    // so the card includes some already-resolved and some pending squares.
    const { data, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
      .order('created_at', { ascending: false })
      .limit(200)

    if (error || !data || data.length < 24) {
      return NextResponse.json(
        { error: 'Not enough topics to generate a bingo card' },
        { status: 503 }
      )
    }

    // Deterministically shuffle by week key, then take 24
    const shuffled = seededShuffle(data, week)
    const topics: BingoTopic[] = shuffled.slice(0, 24).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      status: t.status,
      blue_pct: typeof t.blue_pct === 'number' ? t.blue_pct : 50,
      total_votes: typeof t.total_votes === 'number' ? t.total_votes : 0,
    }))

    const card: BingoCard = { week, topics }
    return NextResponse.json(card, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
