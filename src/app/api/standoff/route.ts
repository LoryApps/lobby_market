import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StandoffArgument {
  id: string
  content: string
  upvotes: number
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface StandoffTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  /** Votes cast in the last 48 h */
  recent_votes: number
  /** FOR% among recent votes only */
  recent_blue_pct: number
  /** Absolute distance from 50/50 (lower = tighter deadlock) */
  margin: number
  top_for_arg: StandoffArgument | null
  top_against_arg: StandoffArgument | null
}

export interface StandoffResponse {
  topics: StandoffTopic[]
  count: number
  window_hours: number
  generated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const WINDOW_HOURS = 48
/** Topics must be within this many pp of 50 to qualify */
const DEADLOCK_BAND = 8
/** Minimum total votes to filter out low-signal topics */
const MIN_TOTAL_VOTES = 15
/** Minimum recent votes to confirm the deadlock is still active */
const MIN_RECENT_VOTES = 4
const MAX_TOPICS = 25

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const category = searchParams.get('category') || null

  const supabase = await createClient()

  const windowStart = new Date(
    Date.now() - WINDOW_HOURS * 60 * 60 * 1000
  ).toISOString()

  // ── 1. Fetch recent votes (last 48 h) ─────────────────────────────────────
  const { data: recentVotes, error: votesErr } = await supabase
    .from('votes')
    .select('topic_id, side')
    .gte('created_at', windowStart)
    .limit(50000)

  if (votesErr) {
    return NextResponse.json({ error: 'votes_fetch' }, { status: 500 })
  }

  // Aggregate recent votes per topic
  const recentFor = new Map<string, number>()
  const recentTotal = new Map<string, number>()

  for (const v of recentVotes ?? []) {
    const tid = v.topic_id
    recentTotal.set(tid, (recentTotal.get(tid) ?? 0) + 1)
    if (v.side === 'blue') {
      recentFor.set(tid, (recentFor.get(tid) ?? 0) + 1)
    }
  }

  // Only topics with enough recent votes to confirm the deadlock persists
  const eligibleIds = Array.from(recentTotal.keys()).filter(
    (id) => (recentTotal.get(id) ?? 0) >= MIN_RECENT_VOTES
  )

  if (eligibleIds.length === 0) {
    return NextResponse.json({
      topics: [],
      count: 0,
      window_hours: WINDOW_HOURS,
      generated_at: new Date().toISOString(),
    } satisfies StandoffResponse)
  }

  // ── 2. Fetch topic metadata for eligible IDs ──────────────────────────────
  let topicQuery = supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes')
    .in('id', eligibleIds)
    .gte('total_votes', MIN_TOTAL_VOTES)
    .in('status', ['proposed', 'active', 'voting'])
    // Only topics within the deadlock band
    .gte('blue_pct', 50 - DEADLOCK_BAND)
    .lte('blue_pct', 50 + DEADLOCK_BAND)

  if (category) {
    topicQuery = topicQuery.eq('category', category)
  }

  const { data: topicsRaw, error: topicsErr } = await topicQuery.limit(200)

  if (topicsErr) {
    return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })
  }

  // ── 3. Compute margin and recent_blue_pct, filter for dual deadlock ───────
  const standoffs = (topicsRaw ?? [])
    .map((t) => {
      const rf = recentFor.get(t.id) ?? 0
      const rt = recentTotal.get(t.id) ?? 0
      const recentBluePct = rt > 0 ? (rf / rt) * 100 : 50
      const margin = Math.abs((t.blue_pct ?? 50) - 50)
      const recentMargin = Math.abs(recentBluePct - 50)

      return {
        ...t,
        blue_pct: t.blue_pct ?? 50,
        recent_votes: rt,
        recent_blue_pct: recentBluePct,
        margin,
        recentMargin,
      }
    })
    // Require recent votes to ALSO be in deadlock band (confirms persistence)
    .filter((t) => t.recentMargin < DEADLOCK_BAND + 4)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, MAX_TOPICS)

  if (standoffs.length === 0) {
    return NextResponse.json({
      topics: [],
      count: 0,
      window_hours: WINDOW_HOURS,
      generated_at: new Date().toISOString(),
    } satisfies StandoffResponse)
  }

  // ── 4. Fetch top FOR and AGAINST argument for each standoff topic ─────────
  const standoffIds = standoffs.map((t) => t.id)

  const { data: argsRaw, error: argsErr } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      topic_id,
      side,
      content,
      upvotes,
      profiles:user_id ( username, display_name, avatar_url )
    `)
    .in('topic_id', standoffIds)
    .order('upvotes', { ascending: false })
    .limit(standoffIds.length * 4) // up to 4 args per topic

  const argsByTopic = new Map<
    string,
    { for: StandoffArgument | null; against: StandoffArgument | null }
  >()

  if (!argsErr && argsRaw) {
    for (const arg of argsRaw) {
      if (!argsByTopic.has(arg.topic_id)) {
        argsByTopic.set(arg.topic_id, { for: null, against: null })
      }
      const bucket = argsByTopic.get(arg.topic_id)!
      const profile = arg.profiles as {
        username: string | null
        display_name: string | null
        avatar_url: string | null
      } | null

      const mapped: StandoffArgument = {
        id: arg.id,
        content: arg.content,
        upvotes: arg.upvotes ?? 0,
        author_username: profile?.username ?? null,
        author_display_name: profile?.display_name ?? null,
        author_avatar_url: profile?.avatar_url ?? null,
      }

      if (arg.side === 'blue' && !bucket.for) {
        bucket.for = mapped
      } else if (arg.side === 'red' && !bucket.against) {
        bucket.against = mapped
      }
    }
  }

  // ── 5. Assemble final response ────────────────────────────────────────────
  const topics: StandoffTopic[] = standoffs.map((t) => {
    const args = argsByTopic.get(t.id)
    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      scope: t.scope,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      recent_votes: t.recent_votes,
      recent_blue_pct: t.recent_blue_pct,
      margin: t.margin,
      top_for_arg: args?.for ?? null,
      top_against_arg: args?.against ?? null,
    }
  })

  return NextResponse.json({
    topics,
    count: topics.length,
    window_hours: WINDOW_HOURS,
    generated_at: new Date().toISOString(),
  } satisfies StandoffResponse)
}
