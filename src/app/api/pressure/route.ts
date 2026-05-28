import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PressureTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  /** Votes cast in the last 24 h */
  recent_votes: number
  /** FOR% among recent 24 h votes */
  recent_blue_pct: number
  /** pp distance from 50 (0 = exactly tied) */
  margin: number
  /** How many votes would flip the current outcome (approx) */
  votes_to_flip: number
  /** 0–100 pressure score: closeness × activity × recency */
  pressure_score: number
  /** Whether the authenticated user has voted on this topic */
  user_voted: boolean
  /** The user's vote side if they've voted */
  user_vote: 'blue' | 'red' | null
  top_for_arg: PressureArgument | null
  top_against_arg: PressureArgument | null
}

export interface PressureArgument {
  id: string
  content: string
  upvotes: number
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface PressureResponse {
  topics: PressureTopic[]
  count: number
  window_hours: number
  generated_at: string
  user_unvoted_count: number
}

// ─── Config ───────────────────────────────────────────────────────────────────

const WINDOW_HOURS = 24
/** Topics must be within this many pp of 50 to be high-pressure */
const MAX_MARGIN = 20
const MIN_TOTAL_VOTES = 10
const MIN_RECENT_VOTES = 2
const MAX_TOPICS = 30

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Pressure score (0–100):
 *   - Closeness: exponential — topics at exactly 50/50 score 100, margin=20 scores ~14
 *   - Activity:  log-scale of recent_votes (capped at 50 for normalization)
 *   - Recency:   not a factor at this level; we already filter to 24 h votes
 *
 * Formula: closeness_score × activity_weight
 *   closeness_score = 100 × exp(−0.12 × margin²)
 *   activity_weight = 0.4 + 0.6 × min(recent_votes, 50) / 50
 */
function computePressure(margin: number, recentVotes: number): number {
  const closeness = 100 * Math.exp(-0.12 * margin * margin)
  const activityRatio = Math.min(recentVotes, 50) / 50
  const activity = 0.4 + 0.6 * activityRatio
  return Math.round(closeness * activity)
}

/**
 * Rough estimate of how many votes the trailing side would need to flip
 * the current outcome to the other side (needs 50%+1 vote to flip).
 *
 * current trailing_votes = total × (1 - blue_pct/100)
 * needed = total × 0.5 + 1 − trailing_votes = total × (0.5 − (1 − blue_pct/100)) + 1
 *        = total × (blue_pct/100 − 0.5) + 1
 * (works for both sides: if blue_pct > 50, red needs that many; if < 50, blue needs it)
 */
function votesToFlip(bluePct: number, totalVotes: number): number {
  const gap = Math.abs(bluePct / 100 - 0.5)
  return Math.max(1, Math.round(totalVotes * gap) + 1)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const category = searchParams.get('category') || null
  const onlyUnvoted = searchParams.get('unvoted') === '1'

  const supabase = await createClient()

  // Check auth (optional — pressure scores work for guests too)
  const { data: { user } } = await supabase.auth.getUser()

  const windowStart = new Date(
    Date.now() - WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString()

  // ── 1. Recent votes in window ─────────────────────────────────────────────
  const { data: recentVotes, error: votesErr } = await supabase
    .from('votes')
    .select('topic_id, side')
    .gte('created_at', windowStart)
    .limit(80000)

  if (votesErr) {
    return NextResponse.json({ error: 'votes_fetch' }, { status: 500 })
  }

  // Aggregate per topic
  const recentFor = new Map<string, number>()
  const recentTotal = new Map<string, number>()
  for (const v of recentVotes ?? []) {
    const tid = v.topic_id
    recentTotal.set(tid, (recentTotal.get(tid) ?? 0) + 1)
    if (v.side === 'blue') recentFor.set(tid, (recentFor.get(tid) ?? 0) + 1)
  }

  // Topics with at least MIN_RECENT_VOTES in the window
  const eligibleIds = Array.from(recentTotal.keys()).filter(
    (id) => (recentTotal.get(id) ?? 0) >= MIN_RECENT_VOTES
  )

  if (eligibleIds.length === 0) {
    return NextResponse.json({
      topics: [],
      count: 0,
      window_hours: WINDOW_HOURS,
      generated_at: new Date().toISOString(),
      user_unvoted_count: 0,
    } satisfies PressureResponse)
  }

  // ── 2. Fetch topic metadata ───────────────────────────────────────────────
  let topicQuery = supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes')
    .in('id', eligibleIds)
    .gte('total_votes', MIN_TOTAL_VOTES)
    .in('status', ['proposed', 'active', 'voting'])
    .gte('blue_pct', 50 - MAX_MARGIN)
    .lte('blue_pct', 50 + MAX_MARGIN)

  if (category) topicQuery = topicQuery.eq('category', category)

  const { data: topicsRaw, error: topicsErr } = await topicQuery.limit(300)

  if (topicsErr) {
    return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })
  }

  const topics = topicsRaw ?? []
  if (topics.length === 0) {
    return NextResponse.json({
      topics: [],
      count: 0,
      window_hours: WINDOW_HOURS,
      generated_at: new Date().toISOString(),
      user_unvoted_count: 0,
    } satisfies PressureResponse)
  }

  const topicIds = topics.map((t) => t.id)

  // ── 3. User's existing votes (if logged in) ───────────────────────────────
  const userVoteMap = new Map<string, 'blue' | 'red'>()
  if (user) {
    const { data: uvotes } = await supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .in('topic_id', topicIds)
    for (const v of uvotes ?? []) {
      userVoteMap.set(v.topic_id, v.side as 'blue' | 'red')
    }
  }

  // ── 4. Top arguments for each topic ──────────────────────────────────────
  type ArgRow = {
    id: string
    topic_id: string
    side: string
    content: string
    upvotes: number
    user_id: string
  }

  const { data: argsRaw } = await supabase
    .from('arguments')
    .select('id, topic_id, side, content, upvotes, user_id')
    .in('topic_id', topicIds)
    .order('upvotes', { ascending: false })
    .limit(topicIds.length * 4)

  const argsTyped: ArgRow[] = (argsRaw ?? []) as ArgRow[]

  // Build top-for and top-against per topic
  const topForMap = new Map<string, ArgRow>()
  const topAgainstMap = new Map<string, ArgRow>()
  const argAuthorIds = new Set<string>()

  for (const arg of argsTyped) {
    if (arg.side === 'blue' && !topForMap.has(arg.topic_id)) {
      topForMap.set(arg.topic_id, arg)
      argAuthorIds.add(arg.user_id)
    } else if (arg.side === 'red' && !topAgainstMap.has(arg.topic_id)) {
      topAgainstMap.set(arg.topic_id, arg)
      argAuthorIds.add(arg.user_id)
    }
  }

  // Fetch argument authors
  const authorMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>()
  if (argAuthorIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', Array.from(argAuthorIds))
    for (const p of profiles ?? []) {
      authorMap.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url })
    }
  }

  function buildArg(raw: ArgRow | undefined): PressureArgument | null {
    if (!raw) return null
    const author = authorMap.get(raw.user_id)
    return {
      id: raw.id,
      content: raw.content,
      upvotes: raw.upvotes,
      author_username: author?.username ?? null,
      author_display_name: author?.display_name ?? null,
      author_avatar_url: author?.avatar_url ?? null,
    }
  }

  // ── 5. Score and sort ─────────────────────────────────────────────────────
  const scored: PressureTopic[] = topics
    .map((t) => {
      const recent = recentTotal.get(t.id) ?? 0
      const recentF = recentFor.get(t.id) ?? 0
      const recentBluePct = recent > 0 ? (recentF / recent) * 100 : t.blue_pct
      const margin = Math.abs(t.blue_pct - 50)
      const pressure = computePressure(margin, recent)
      const userVote = userVoteMap.get(t.id) ?? null

      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        scope: t.scope ?? null,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        recent_votes: recent,
        recent_blue_pct: recentBluePct,
        margin,
        votes_to_flip: votesToFlip(t.blue_pct, t.total_votes),
        pressure_score: pressure,
        user_voted: userVoteMap.has(t.id),
        user_vote: userVote,
        top_for_arg: buildArg(topForMap.get(t.id)),
        top_against_arg: buildArg(topAgainstMap.get(t.id)),
      }
    })
    .filter((t) => !onlyUnvoted || !t.user_voted)
    .sort((a, b) => b.pressure_score - a.pressure_score)
    .slice(0, MAX_TOPICS)

  const userUnvotedCount = user
    ? scored.filter((t) => !t.user_voted).length
    : 0

  return NextResponse.json({
    topics: scored,
    count: scored.length,
    window_hours: WINDOW_HOURS,
    generated_at: new Date().toISOString(),
    user_unvoted_count: userUnvotedCount,
  } satisfies PressureResponse)
}
