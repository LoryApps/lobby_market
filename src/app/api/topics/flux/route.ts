import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FluxTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  /** Blue % among votes cast in the most recent 24h window */
  blue_pct_recent: number
  /** Blue % among votes cast in the prior 24h window (24-48h ago) */
  blue_pct_prior: number
  /** pp shift = blue_pct_recent − blue_pct_prior (positive = swinging FOR) */
  consensus_shift: number
  /** Absolute magnitude of shift */
  shift_magnitude: number
  /** Number of votes in the recent 24h window */
  votes_recent: number
  /** Number of votes in the prior 24h window */
  votes_prior: number
  /** "for" | "against" | "contested" */
  direction: 'for' | 'against' | 'contested'
}

export interface FluxResponse {
  topics: FluxTopic[]
  meta: {
    computed_at: string
    total_topics_analysed: number
    min_window_votes: number
  }
}

// Minimum votes in EITHER window to qualify for flux analysis
const MIN_VOTES = 5

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sort = (searchParams.get('sort') ?? 'magnitude') as 'magnitude' | 'for' | 'against'

  const supabase = await createClient()

  const now = Date.now()
  const ms24h = 24 * 60 * 60 * 1000
  const ms48h = 48 * 60 * 60 * 1000

  const since48h = new Date(now - ms48h).toISOString()
  const since24h = new Date(now - ms24h).toISOString()

  // Fetch all votes in the last 48h with side info
  const { data: rawVotes, error } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .gte('created_at', since48h)
    .limit(30000)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 })
  }

  const votes = rawVotes ?? []

  if (votes.length === 0) {
    return NextResponse.json({
      topics: [],
      meta: { computed_at: new Date().toISOString(), total_topics_analysed: 0, min_window_votes: MIN_VOTES },
    } satisfies FluxResponse)
  }

  // ── Bucket votes by topic and window ──────────────────────────────────────

  interface WindowCounts {
    blue: number
    red: number
  }

  // recent = last 24h, prior = 24–48h ago
  const recent = new Map<string, WindowCounts>()
  const prior  = new Map<string, WindowCounts>()

  for (const v of votes) {
    const tid = v.topic_id
    const isRecent = v.created_at >= since24h

    const map = isRecent ? recent : prior
    const existing = map.get(tid) ?? { blue: 0, red: 0 }
    if (v.side === 'blue') existing.blue++
    else existing.red++
    map.set(tid, existing)
  }

  // ── Compute flux metrics ───────────────────────────────────────────────────

  // Only analyse topics that appear in BOTH windows with MIN_VOTES each
  const candidateIds = Array.from(recent.keys()).filter((id) => {
    const r = recent.get(id)!
    const p = prior.get(id)
    const recentTotal = r.blue + r.red
    const priorTotal  = p ? p.blue + p.red : 0
    return recentTotal >= MIN_VOTES && priorTotal >= MIN_VOTES
  })

  if (candidateIds.length === 0) {
    // Fall back: include topics with only a recent window if prior is empty
    // (first-time flux — compare against overall topic blue_pct)
    const fallbackIds = Array.from(recent.keys()).filter((id) => {
      const r = recent.get(id)!
      return r.blue + r.red >= MIN_VOTES
    })

    if (fallbackIds.length === 0) {
      return NextResponse.json({
        topics: [],
        meta: { computed_at: new Date().toISOString(), total_topics_analysed: 0, min_window_votes: MIN_VOTES },
      } satisfies FluxResponse)
    }

    // Fetch topic details
    const { data: topicsData } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', fallbackIds)
      .in('status', ['active', 'voting'])

    const topics: FluxTopic[] = (topicsData ?? []).map((t) => {
      const r = recent.get(t.id)!
      const recentTotal = r.blue + r.red
      const recentPct   = recentTotal > 0 ? (r.blue / recentTotal) * 100 : 50
      const shift       = recentPct - (t.blue_pct ?? 50)
      const mag         = Math.abs(shift)

      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: Math.round((t.blue_pct ?? 50) * 10) / 10,
        total_votes: t.total_votes ?? 0,
        blue_pct_recent: Math.round(recentPct * 10) / 10,
        blue_pct_prior: Math.round((t.blue_pct ?? 50) * 10) / 10,
        consensus_shift: Math.round(shift * 10) / 10,
        shift_magnitude: Math.round(mag * 10) / 10,
        votes_recent: recentTotal,
        votes_prior: 0,
        direction: shift > 3 ? 'for' : shift < -3 ? 'against' : 'contested',
      }
    })

    topics.sort((a, b) => b.shift_magnitude - a.shift_magnitude)

    return NextResponse.json({
      topics: topics.slice(0, 25),
      meta: { computed_at: new Date().toISOString(), total_topics_analysed: topics.length, min_window_votes: MIN_VOTES },
    } satisfies FluxResponse)
  }

  // Fetch topic details for candidates
  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', candidateIds)
    .in('status', ['active', 'voting'])

  const topics: FluxTopic[] = (topicsData ?? []).map((t) => {
    const r = recent.get(t.id) ?? { blue: 0, red: 0 }
    const p = prior.get(t.id) ?? { blue: 0, red: 0 }

    const recentTotal = r.blue + r.red
    const priorTotal  = p.blue + p.red

    const recentPct = recentTotal > 0 ? (r.blue / recentTotal) * 100 : 50
    const priorPct  = priorTotal  > 0 ? (p.blue / priorTotal)  * 100 : 50

    const shift = recentPct - priorPct
    const mag   = Math.abs(shift)

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: Math.round((t.blue_pct ?? 50) * 10) / 10,
      total_votes: t.total_votes ?? 0,
      blue_pct_recent: Math.round(recentPct * 10) / 10,
      blue_pct_prior: Math.round(priorPct * 10) / 10,
      consensus_shift: Math.round(shift * 10) / 10,
      shift_magnitude: Math.round(mag * 10) / 10,
      votes_recent: recentTotal,
      votes_prior: priorTotal,
      direction: shift > 3 ? 'for' : shift < -3 ? 'against' : 'contested',
    }
  })

  // Apply sort
  if (sort === 'for') {
    topics.sort((a, b) => b.consensus_shift - a.consensus_shift)
  } else if (sort === 'against') {
    topics.sort((a, b) => a.consensus_shift - b.consensus_shift)
  } else {
    topics.sort((a, b) => b.shift_magnitude - a.shift_magnitude)
  }

  return NextResponse.json({
    topics: topics.slice(0, 25),
    meta: {
      computed_at: new Date().toISOString(),
      total_topics_analysed: topics.length,
      min_window_votes: MIN_VOTES,
    },
  } satisfies FluxResponse)
}
