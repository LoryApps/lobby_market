import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UndertowTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  recent_blue_pct: number
  recent_vote_count: number
  /** Magnitude of the gap: recent_blue_pct vs current_blue_pct.
   *  For false_summits: current_blue_pct - recent_blue_pct (positive = losing ground)
   *  For underdogs:     recent_blue_pct - current_blue_pct (positive = gaining ground) */
  gap: number
}

export interface UndertowResponse {
  false_summits: UndertowTopic[]
  underdogs: UndertowTopic[]
  window_hours: number
  generated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const WINDOW_HOURS = 24
/** A topic is a "summit" if it currently has more than this FOR% */
const SUMMIT_THRESHOLD = 55
/** A topic is an "underdog" if it currently has less than this FOR% */
const UNDERDOG_THRESHOLD = 45
/** The momentum reversal must be at least this many percentage points */
const MIN_GAP = 8
const MIN_RECENT_VOTES = 5
const MIN_TOTAL_VOTES = 20
const MAX_PER_LIST = 20

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const category = searchParams.get('category') || null

  const supabase = await createClient()

  const windowStart = new Date(
    Date.now() - WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString()

  // ── 1. Recent votes (last 24 h) ───────────────────────────────────────────
  const { data: recentVotes, error: votesErr } = await supabase
    .from('votes')
    .select('topic_id, side')
    .gte('created_at', windowStart)
    .limit(40000)

  if (votesErr) {
    return NextResponse.json({ error: 'votes_fetch' }, { status: 500 })
  }

  // ── 2. Aggregate by topic ─────────────────────────────────────────────────
  const recentFor = new Map<string, number>()
  const recentAgainst = new Map<string, number>()

  for (const v of recentVotes ?? []) {
    if (v.side === 'blue') {
      recentFor.set(v.topic_id, (recentFor.get(v.topic_id) ?? 0) + 1)
    } else {
      recentAgainst.set(v.topic_id, (recentAgainst.get(v.topic_id) ?? 0) + 1)
    }
  }

  const eligibleIds = Array.from(
    new Set([...recentFor.keys(), ...recentAgainst.keys()])
  ).filter((id) => {
    const f = recentFor.get(id) ?? 0
    const a = recentAgainst.get(id) ?? 0
    return f + a >= MIN_RECENT_VOTES
  })

  if (eligibleIds.length === 0) {
    return NextResponse.json({
      false_summits: [],
      underdogs: [],
      window_hours: WINDOW_HOURS,
      generated_at: new Date().toISOString(),
    } satisfies UndertowResponse)
  }

  // ── 3. Fetch topic details ────────────────────────────────────────────────
  let query = supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes')
    .in('id', eligibleIds)
    .in('status', ['active', 'voting', 'proposed'])
    .gte('total_votes', MIN_TOTAL_VOTES)
    .not('blue_pct', 'is', null)

  if (category) {
    query = query.eq('category', category)
  }

  const { data: topics, error: topicsErr } = await query

  if (topicsErr) {
    return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })
  }

  // ── 4. Compute gap and classify ───────────────────────────────────────────
  const falseSummits: UndertowTopic[] = []
  const underdogs: UndertowTopic[] = []

  for (const topic of topics ?? []) {
    const recentF = recentFor.get(topic.id) ?? 0
    const recentA = recentAgainst.get(topic.id) ?? 0
    const recentTotal = recentF + recentA
    if (recentTotal < MIN_RECENT_VOTES) continue

    const currentPct = topic.blue_pct ?? 50
    const recentPct = (recentF / recentTotal) * 100

    const base: Omit<UndertowTopic, 'gap'> = {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      scope: topic.scope ?? null,
      blue_pct: Math.round(currentPct * 10) / 10,
      total_votes: topic.total_votes ?? 0,
      recent_blue_pct: Math.round(recentPct * 10) / 10,
      recent_vote_count: recentTotal,
    }

    // False summit: currently winning but recent votes trending against
    if (currentPct >= SUMMIT_THRESHOLD && recentPct < currentPct - MIN_GAP) {
      falseSummits.push({ ...base, gap: Math.round((currentPct - recentPct) * 10) / 10 })
    }

    // Underdog: currently losing but recent votes trending for
    if (currentPct <= UNDERDOG_THRESHOLD && recentPct > currentPct + MIN_GAP) {
      underdogs.push({ ...base, gap: Math.round((recentPct - currentPct) * 10) / 10 })
    }
  }

  // Sort by gap magnitude descending
  falseSummits.sort((a, b) => b.gap - a.gap)
  underdogs.sort((a, b) => b.gap - a.gap)

  return NextResponse.json({
    false_summits: falseSummits.slice(0, MAX_PER_LIST),
    underdogs: underdogs.slice(0, MAX_PER_LIST),
    window_hours: WINDOW_HOURS,
    generated_at: new Date().toISOString(),
  } satisfies UndertowResponse)
}
