import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklyArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_grade: string | null
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  created_at: string
}

export interface WeeklyContributor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  argument_count: number
  upvotes_received: number
}

export interface WeeklyConsensusTick {
  day: string  // YYYY-MM-DD
  price: number
}

export interface WeeklyTopicDigest {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string
  current_pct: number
  total_votes: number
  blue_votes: number
  red_votes: number

  // 7-day deltas
  votes_this_week: number
  votes_prev_week: number
  votes_pct_change: number | null

  // Consensus chart (14-day price ticks, clamped to available data)
  price_ticks: WeeklyConsensusTick[]
  pct_7d_ago: number | null
  pct_change_7d: number | null

  // Top arguments posted this week
  top_for_args: WeeklyArgument[]
  top_against_args: WeeklyArgument[]

  // Top contributors this week
  top_contributors: WeeklyContributor[]

  // New arguments count
  new_for_count: number
  new_against_count: number

  // Signals
  is_trending: boolean
  is_near_law: boolean
  is_deadlocked: boolean
  is_surging: boolean   // vote volume up >50% vs prior week

  generated_at: string
}

// ─── GET /api/topics/[id]/weekly ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Core topic ─────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, blue_votes, red_votes, feed_score, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const nowMs = Date.now()
  const ms7d = 7 * 24 * 60 * 60 * 1000
  const ms14d = 14 * 24 * 60 * 60 * 1000
  const cutoff7d = new Date(nowMs - ms7d).toISOString()
  const cutoff14d = new Date(nowMs - ms14d).toISOString()
  const cutoffPrev7d = new Date(nowMs - ms14d).toISOString()
  const cutoffPrevEnd = cutoff7d

  // ── 2. Price history ticks (14d) ──────────────────────────────────────────
  const { data: priceRows } = await supabase
    .from('topic_price_history')
    .select('recorded_at, price')
    .eq('topic_id', id)
    .gte('recorded_at', cutoff14d)
    .order('recorded_at', { ascending: true })

  const priceTicks: WeeklyConsensusTick[] = (priceRows ?? []).map((r) => ({
    day: (r.recorded_at as string).slice(0, 10),
    price: Math.round(r.price ?? 50),
  }))

  // Deduplicate by day (keep last tick of each day)
  const dayMap = new Map<string, number>()
  for (const t of priceTicks) {
    dayMap.set(t.day, t.price)
  }
  const dedupedTicks: WeeklyConsensusTick[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, price]) => ({ day, price }))

  // ── 3. Consensus 7d ago ───────────────────────────────────────────────────
  const { data: oldPriceRow } = await supabase
    .from('topic_price_history')
    .select('price')
    .eq('topic_id', id)
    .lte('recorded_at', cutoff7d)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const currentPct = Math.round(topic.blue_pct ?? 50)
  const pct7dAgo = oldPriceRow ? Math.round(oldPriceRow.price ?? 50) : null
  const pctChange7d = pct7dAgo !== null ? currentPct - pct7dAgo : null

  // ── 4. Vote volume this week vs prior week ────────────────────────────────
  const [{ count: votesThisWeek }, { count: votesPrevWeek }] = await Promise.all([
    supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', id)
      .gte('created_at', cutoff7d),
    supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', id)
      .gte('created_at', cutoffPrev7d)
      .lt('created_at', cutoffPrevEnd),
  ])

  const thisWeekVotes = votesThisWeek ?? 0
  const prevWeekVotes = votesPrevWeek ?? 0
  const votesPctChange =
    prevWeekVotes > 0
      ? Math.round(((thisWeekVotes - prevWeekVotes) / prevWeekVotes) * 100)
      : null

  // ── 5. New arguments this week ────────────────────────────────────────────
  const { data: newArgRows } = await supabase
    .from('topic_arguments')
    .select('id, user_id, side, content, upvotes, ai_grade, created_at')
    .eq('topic_id', id)
    .gte('created_at', cutoff7d)
    .order('upvotes', { ascending: false })
    .limit(20)

  const newArgs = newArgRows ?? []

  // Fetch profiles for argument authors
  const argAuthorIds = Array.from(new Set(newArgs.map((a) => a.user_id)))
  const { data: argProfiles } = argAuthorIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', argAuthorIds)
    : { data: [] }

  const argProfileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; role: string }>()
  for (const p of argProfiles ?? []) {
    argProfileMap.set(p.id, p)
  }

  const mappedArgs: WeeklyArgument[] = newArgs.map((a) => {
    const p = argProfileMap.get(a.user_id)
    return {
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvotes: a.upvotes ?? 0,
      ai_grade: a.ai_grade ?? null,
      author_username: p?.username ?? 'unknown',
      author_display_name: p?.display_name ?? null,
      author_avatar_url: p?.avatar_url ?? null,
      created_at: a.created_at as string,
    }
  })

  const topForArgs = mappedArgs.filter((a) => a.side === 'blue').slice(0, 3)
  const topAgainstArgs = mappedArgs.filter((a) => a.side === 'red').slice(0, 3)
  const newForCount = mappedArgs.filter((a) => a.side === 'blue').length
  const newAgainstCount = mappedArgs.filter((a) => a.side === 'red').length

  // ── 6. Top contributors this week ─────────────────────────────────────────
  const contributorMap = new Map<string, { argument_count: number; upvotes_received: number }>()
  for (const a of newArgs) {
    const existing = contributorMap.get(a.user_id) ?? { argument_count: 0, upvotes_received: 0 }
    contributorMap.set(a.user_id, {
      argument_count: existing.argument_count + 1,
      upvotes_received: existing.upvotes_received + (a.upvotes ?? 0),
    })
  }

  const topContributors: WeeklyContributor[] = Array.from(contributorMap.entries())
    .sort(([, a], [, b]) => (b.argument_count + b.upvotes_received) - (a.argument_count + a.upvotes_received))
    .slice(0, 5)
    .map(([userId, stats]) => {
      const p = argProfileMap.get(userId)
      return {
        user_id: userId,
        username: p?.username ?? 'unknown',
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        role: p?.role ?? 'citizen',
        argument_count: stats.argument_count,
        upvotes_received: stats.upvotes_received,
      }
    })

  // ── 7. Signals ────────────────────────────────────────────────────────────
  const isTrending = (topic.feed_score ?? 0) > 40
  const isNearLaw = currentPct >= 75
  const isDeadlocked = currentPct >= 44 && currentPct <= 56
  const isSurging = prevWeekVotes > 0 && thisWeekVotes / prevWeekVotes >= 1.5

  const digest: WeeklyTopicDigest = {
    id: topic.id,
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    scope: topic.scope ?? 'Global',
    current_pct: currentPct,
    total_votes: topic.total_votes ?? 0,
    blue_votes: topic.blue_votes ?? 0,
    red_votes: topic.red_votes ?? 0,
    votes_this_week: thisWeekVotes,
    votes_prev_week: prevWeekVotes,
    votes_pct_change: votesPctChange,
    price_ticks: dedupedTicks,
    pct_7d_ago: pct7dAgo,
    pct_change_7d: pctChange7d,
    top_for_args: topForArgs,
    top_against_args: topAgainstArgs,
    new_for_count: newForCount,
    new_against_count: newAgainstCount,
    top_contributors: topContributors,
    is_trending: isTrending,
    is_near_law: isNearLaw,
    is_deadlocked: isDeadlocked,
    is_surging: isSurging,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(digest)
}
