import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ConvergenceTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  /** blue_pct among votes cast in the last 7 days */
  recent_blue_pct: number
  /** count of votes in last 7 days */
  recent_vote_count: number
  /** |recent_blue_pct − 50| − |current_blue_pct − 50|
   *  > 0 = recent voters pushing MORE toward one side (consensus building)
   *  < 0 = recent voters pushing TOWARD deadlock (consensus challenged) */
  convergence_momentum: number
}

export interface ConvergenceResponse {
  converging: ConvergenceTopic[]
  fracturing: ConvergenceTopic[]
  window_days: number
  generated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 7
/** Min recent votes for a topic to qualify */
const MIN_RECENT_VOTES = 5
/** Min total votes for a topic to qualify */
const MIN_TOTAL_VOTES = 25
/** Min absolute convergence_momentum to surface */
const MIN_MOMENTUM = 3
/** Max topics per list */
const MAX_RESULTS = 20

export async function GET() {
  const supabase = await createClient()

  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Recent votes (last 7 days) ─────────────────────────────────────────
  const { data: recentVotes, error: votesErr } = await supabase
    .from('votes')
    .select('topic_id, side')
    .gte('created_at', windowStart)
    .limit(50000)

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

  // Filter topic ids with enough recent engagement
  const eligibleTopicIds = Array.from(
    new Set([...recentFor.keys(), ...recentAgainst.keys()])
  ).filter((tid) => {
    const f = recentFor.get(tid) ?? 0
    const a = recentAgainst.get(tid) ?? 0
    return f + a >= MIN_RECENT_VOTES
  })

  if (eligibleTopicIds.length === 0) {
    return NextResponse.json({
      converging: [],
      fracturing: [],
      window_days: WINDOW_DAYS,
      generated_at: new Date().toISOString(),
    } satisfies ConvergenceResponse)
  }

  // ── 3. Fetch topic details ────────────────────────────────────────────────
  const { data: topics, error: topicsErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes')
    .in('id', eligibleTopicIds)
    .in('status', ['active', 'voting', 'proposed'])
    .gte('total_votes', MIN_TOTAL_VOTES)
    .not('blue_pct', 'is', null)

  if (topicsErr) {
    return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })
  }

  // ── 4. Compute convergence_momentum ──────────────────────────────────────
  const results: ConvergenceTopic[] = []

  for (const topic of topics ?? []) {
    const recentF = recentFor.get(topic.id) ?? 0
    const recentA = recentAgainst.get(topic.id) ?? 0
    const recentTotal = recentF + recentA
    if (recentTotal < MIN_RECENT_VOTES) continue

    const currentPct = topic.blue_pct ?? 50
    const recentPct = (recentF / recentTotal) * 100

    // Distance from deadlock (50): higher = more consensus
    const currentConsensus = Math.abs(currentPct - 50)
    const recentConsensus = Math.abs(recentPct - 50)

    // momentum > 0: recent voters are MORE extreme than overall average → consensus building
    // momentum < 0: recent voters are LESS extreme → consensus being challenged
    const convergence_momentum = recentConsensus - currentConsensus

    if (Math.abs(convergence_momentum) < MIN_MOMENTUM) continue

    results.push({
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      scope: topic.scope ?? null,
      blue_pct: currentPct,
      total_votes: topic.total_votes ?? 0,
      recent_blue_pct: Math.round(recentPct * 10) / 10,
      recent_vote_count: recentTotal,
      convergence_momentum: Math.round(convergence_momentum * 10) / 10,
    })
  }

  // ── 5. Split and sort ─────────────────────────────────────────────────────
  const converging = results
    .filter((t) => t.convergence_momentum > 0)
    .sort((a, b) => b.convergence_momentum - a.convergence_momentum)
    .slice(0, MAX_RESULTS)

  const fracturing = results
    .filter((t) => t.convergence_momentum < 0)
    .sort((a, b) => a.convergence_momentum - b.convergence_momentum)
    .slice(0, MAX_RESULTS)

  return NextResponse.json({
    converging,
    fracturing,
    window_days: WINDOW_DAYS,
    generated_at: new Date().toISOString(),
  } satisfies ConvergenceResponse)
}
