import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SignalArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvote_count: number
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
}

export interface SignalTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  scope: string | null
  created_at: string
  /** Distance from nearest decisive threshold (75% law / 25% fail) */
  threshold_gap: number
  /** Which threshold this topic is closest to */
  nearest_threshold: 'law' | 'fail'
  /** Composite urgency score (0–100) */
  signal_score: number
  /** Hours remaining in voting window, null if no deadline */
  hours_remaining: number | null
  /** Human-readable reason this topic is the signal */
  signal_reason: string
  top_for_arg: SignalArgument | null
  top_against_arg: SignalArgument | null
}

export interface SignalRunner {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  signal_score: number
  hours_remaining: number | null
}

export interface SignalResponse {
  signal: SignalTopic | null
  runners: SignalRunner[]
  computed_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeSignalScore(
  bluePct: number,
  votingEndsAt: string | null,
  totalVotes: number,
  now: number
): {
  score: number
  thresholdGap: number
  nearestThreshold: 'law' | 'fail'
  hoursRemaining: number | null
  reason: string
} {
  // Nearest threshold: law at 75%, fail at 25%
  const distToLaw = Math.abs(bluePct - 75)
  const distToFail = Math.abs(bluePct - 25)
  const nearestThreshold: 'law' | 'fail' = distToLaw <= distToFail ? 'law' : 'fail'
  const thresholdGap = Math.min(distToLaw, distToFail)

  // Threshold proximity score (0–50): closer = higher
  // Max score at gap=0, zero at gap>=20
  const proximityScore = Math.max(0, 50 - thresholdGap * 2.5)

  // Time pressure score (0–40): closer deadline = higher
  let timePressureScore = 0
  let hoursRemaining: number | null = null
  if (votingEndsAt) {
    const msRemaining = new Date(votingEndsAt).getTime() - now
    hoursRemaining = Math.max(0, msRemaining / (1000 * 3600))
    if (hoursRemaining <= 24) {
      // Linear: 40 points at 0h, 0 points at 24h
      timePressureScore = Math.max(0, 40 * (1 - hoursRemaining / 24))
    }
  }

  // Engagement bonus (0–10): more votes = more stakes
  const engagementScore = Math.min(10, Math.log10(Math.max(1, totalVotes)) * 3)

  const score = Math.round(proximityScore + timePressureScore + engagementScore)

  // Build reason
  let reason: string
  if (hoursRemaining !== null && hoursRemaining < 6) {
    const hrs = Math.round(hoursRemaining)
    const mins = Math.round((hoursRemaining % 1) * 60)
    const timeStr = hrs === 0 ? `${mins}m` : mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
    reason = `Voting closes in ${timeStr} — ${thresholdGap.toFixed(1)}% from ${nearestThreshold === 'law' ? 'becoming law' : 'being defeated'}`
  } else if (thresholdGap < 5) {
    reason = `Within ${thresholdGap.toFixed(1)}% of ${nearestThreshold === 'law' ? 'achieving consensus (75%)' : 'decisive rejection (25%)'}`
  } else if (hoursRemaining !== null && hoursRemaining < 12) {
    const hrs = Math.round(hoursRemaining)
    reason = `${hrs}h left to vote · ${thresholdGap.toFixed(1)}% from the ${nearestThreshold === 'law' ? '75% law threshold' : '25% rejection threshold'}`
  } else {
    reason = `${thresholdGap.toFixed(1)}% from ${nearestThreshold === 'law' ? 'consensus (FOR ≥ 75%)' : 'decisive defeat (FOR ≤ 25%)'}`
  }

  return { score, thresholdGap, nearestThreshold, hoursRemaining, reason }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const now = Date.now()

  const TOPIC_COLS =
    'id, statement, category, status, blue_pct, total_votes, voting_ends_at, scope, created_at'

  // Fetch voting topics — those within striking distance of either threshold
  // Also grab active topics with votes > 200 and no deadline (for low-traffic periods)
  const [votingRes, activeRes] = await Promise.all([
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .eq('status', 'voting')
      .order('total_votes', { ascending: false })
      .limit(80),

    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .eq('status', 'active')
      .gt('total_votes', 100)
      .or(`blue_pct.lte.35,blue_pct.gte.65`)
      .order('feed_score', { ascending: false })
      .limit(30),
  ])

  type RawTopic = {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    voting_ends_at: string | null
    scope: string | null
    created_at: string
  }

  const candidates: RawTopic[] = [
    ...((votingRes.data as RawTopic[] | null) ?? []),
    ...((activeRes.data as RawTopic[] | null) ?? []),
  ]

  // Score all candidates
  const scored = candidates
    .map((t) => {
      const { score, thresholdGap, nearestThreshold, hoursRemaining, reason } =
        computeSignalScore(t.blue_pct, t.voting_ends_at, t.total_votes, now)
      return { ...t, signal_score: score, threshold_gap: thresholdGap, nearest_threshold: nearestThreshold, hours_remaining: hoursRemaining, signal_reason: reason }
    })
    .filter((t) => t.signal_score > 5)
    .sort((a, b) => b.signal_score - a.signal_score)

  if (scored.length === 0) {
    return NextResponse.json({
      signal: null,
      runners: [],
      computed_at: new Date(now).toISOString(),
    } satisfies SignalResponse)
  }

  const [top, ...rest] = scored
  const runners: SignalRunner[] = rest.slice(0, 5).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    blue_pct: t.blue_pct,
    total_votes: t.total_votes,
    voting_ends_at: t.voting_ends_at,
    signal_score: t.signal_score,
    hours_remaining: t.hours_remaining,
  }))

  // Fetch top FOR and AGAINST arguments for the signal topic
  const { data: argRows } = await supabase
    .from('arguments')
    .select(`
      id,
      content,
      side,
      upvote_count,
      author:profiles!arguments_author_id_fkey (
        username,
        display_name,
        avatar_url,
        role
      )
    `)
    .eq('topic_id', top.id)
    .eq('is_deleted', false)
    .in('side', ['blue', 'red'])
    .order('upvote_count', { ascending: false })
    .limit(20)

  type ArgRow = {
    id: string
    content: string
    side: string
    upvote_count: number
    author: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  }

  const args = (argRows as ArgRow[] | null) ?? []
  const topFor = args.find((a) => a.side === 'blue') ?? null
  const topAgainst = args.find((a) => a.side === 'red') ?? null

  function toSignalArg(a: ArgRow | null): SignalArgument | null {
    if (!a || !a.author) return null
    return {
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvote_count: a.upvote_count,
      author_username: a.author.username,
      author_display_name: a.author.display_name,
      author_avatar_url: a.author.avatar_url,
      author_role: a.author.role,
    }
  }

  const signal: SignalTopic = {
    id: top.id,
    statement: top.statement,
    category: top.category,
    status: top.status,
    blue_pct: top.blue_pct,
    total_votes: top.total_votes,
    voting_ends_at: top.voting_ends_at,
    scope: top.scope,
    created_at: top.created_at,
    threshold_gap: top.threshold_gap,
    nearest_threshold: top.nearest_threshold,
    signal_score: top.signal_score,
    hours_remaining: top.hours_remaining,
    signal_reason: top.signal_reason,
    top_for_arg: toSignalArg(topFor),
    top_against_arg: toSignalArg(topAgainst),
  }

  return NextResponse.json({
    signal,
    runners,
    computed_at: new Date(now).toISOString(),
  } satisfies SignalResponse)
}
