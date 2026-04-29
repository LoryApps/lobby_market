import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TallyRace {
  id: string
  statement: string
  category: string | null
  scope: string
  blue_pct: number
  blue_votes: number
  red_votes: number
  total_votes: number
  voting_ends_at: string | null
  feed_score: number
  // derived
  margin: number           // |blue_pct - 50|
  called: 'for' | 'against' | 'too_close' | null
  is_expiring_soon: boolean
}

export interface RecentVerdict {
  id: string
  statement: string
  category: string | null
  status: 'law' | 'failed'
  blue_pct: number
  total_votes: number
  updated_at: string
}

export interface TallyResponse {
  races: TallyRace[]
  recent_verdicts: RecentVerdict[]
  total_votes_in_play: number
  called_for_count: number
  called_against_count: number
  too_close_count: number
  fetched_at: string
}

const TOPIC_COLS =
  'id, statement, category, scope, blue_pct, blue_votes, red_votes, total_votes, voting_ends_at, feed_score'

const CALL_THRESHOLD = 65    // pct — if FOR is ≥ 65 or ≤ 35, call it
const CLOSE_MARGIN   = 5     // pct — if margin from 50 is ≤ 5, too-close
const EXPIRING_HOURS = 4     // hours until deadline = "expiring soon"

function classifyRace(t: {
  blue_pct: number
  voting_ends_at: string | null
}): Pick<TallyRace, 'margin' | 'called' | 'is_expiring_soon'> {
  const margin = Math.abs(t.blue_pct - 50)
  let called: TallyRace['called'] = null

  if (t.voting_ends_at) {
    // Only "call" a race once voting has started (voting_ends_at is set)
    if (t.blue_pct >= CALL_THRESHOLD) {
      called = 'for'
    } else if (t.blue_pct <= 100 - CALL_THRESHOLD) {
      called = 'against'
    } else if (margin <= CLOSE_MARGIN) {
      called = 'too_close'
    }
  }

  const ms = t.voting_ends_at
    ? new Date(t.voting_ends_at).getTime() - Date.now()
    : Infinity
  const is_expiring_soon = ms > 0 && ms < EXPIRING_HOURS * 60 * 60 * 1000

  return { margin, called, is_expiring_soon }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const nowIso = new Date().toISOString()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [racesRes, verdictsRes] = await Promise.all([
    // Active voting races — topics currently in the voting phase
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .eq('status', 'voting')
      .gt('voting_ends_at', nowIso)
      .order('feed_score', { ascending: false })
      .limit(50),

    // Recent verdicts — topics that passed or failed in the last 24 hours
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, updated_at')
      .in('status', ['law', 'failed'])
      .gte('updated_at', since24h)
      .order('updated_at', { ascending: false })
      .limit(10),
  ])

  const rawRaces = (racesRes.data ?? []) as Array<{
    id: string
    statement: string
    category: string | null
    scope: string
    blue_pct: number
    blue_votes: number
    red_votes: number
    total_votes: number
    voting_ends_at: string | null
    feed_score: number
  }>

  const races: TallyRace[] = rawRaces.map((t) => ({
    ...t,
    ...classifyRace(t),
  }))

  // Sort: expiring-soon first, then too_close, then most votes
  races.sort((a, b) => {
    if (a.is_expiring_soon !== b.is_expiring_soon) {
      return a.is_expiring_soon ? -1 : 1
    }
    const aClose = a.called === 'too_close' ? 1 : 0
    const bClose = b.called === 'too_close' ? 1 : 0
    if (aClose !== bClose) return bClose - aClose
    return b.total_votes - a.total_votes
  })

  const recent_verdicts: RecentVerdict[] = (verdictsRes.data ?? []) as RecentVerdict[]

  const total_votes_in_play = races.reduce((s, r) => s + r.total_votes, 0)
  const called_for_count     = races.filter((r) => r.called === 'for').length
  const called_against_count = races.filter((r) => r.called === 'against').length
  const too_close_count      = races.filter((r) => r.called === 'too_close').length

  return NextResponse.json(
    {
      races,
      recent_verdicts,
      total_votes_in_play,
      called_for_count,
      called_against_count,
      too_close_count,
      fetched_at: new Date().toISOString(),
    } satisfies TallyResponse,
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  )
}
