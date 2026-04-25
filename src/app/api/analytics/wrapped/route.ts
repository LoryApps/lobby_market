import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────���───────────────────────────────��───────────────

export interface WrappedArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  topic_statement: string
}

export interface WrappedCategory {
  category: string
  count: number
  side: 'for' | 'against' | 'balanced'
}

export interface WrappedData {
  profile: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
    total_votes: number
    total_arguments: number
    blue_vote_count: number
    red_vote_count: number
    vote_streak: number
    created_at: string
  }
  year: number
  period_label: string
  // Activity
  votes_this_year: number
  arguments_this_year: number
  // Impact
  laws_supported: number
  accuracy: number | null
  resolved_votes: number
  // Top category
  top_category: WrappedCategory | null
  all_categories: WrappedCategory[]
  // Leaderboard
  leaderboard_rank: number
  total_users: number
  percentile: number
  // Best argument
  best_argument: WrappedArgument | null
  // Platform context
  platform_avg_votes: number
}

// ─── GET /api/analytics/wrapped ─────────────────────────────��────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Profile ────────────���──────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, avatar_url, role, clout, reputation_score, total_votes, total_arguments, blue_vote_count, red_vote_count, vote_streak, created_at'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const now = new Date()
  const year = now.getFullYear()
  const yearStart = new Date(year, 0, 1).toISOString()

  // ── Votes this year ─────────────────���───────────────────────────���─────────
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('id, side, topic_id, created_at')
    .eq('user_id', user.id)
    .gte('created_at', yearStart)
    .limit(5000)

  const votes = votesRaw ?? []

  // Get topic details for all voted topics
  const topicIds = Array.from(new Set(votes.map((v) => v.topic_id)))
  let topicMap = new Map<string, { status: string; category: string | null; blue_pct: number; statement: string }>()

  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, status, category, blue_pct, statement')
      .in('id', topicIds)

    if (topics) {
      topicMap = new Map(topics.map((t) => [t.id, t]))
    }
  }

  // ── Accuracy ────────────────────────────���─────────────────────────────────
  const resolvedVotes = votes.filter((v) => {
    const t = topicMap.get(v.topic_id)
    return t && (t.status === 'law' || t.status === 'failed')
  })

  const correctVotes = resolvedVotes.filter((v) => {
    const t = topicMap.get(v.topic_id)!
    return (t.status === 'law' && v.side === 'blue') || (t.status === 'failed' && v.side === 'red')
  })

  const accuracy =
    resolvedVotes.length >= 3
      ? Math.round((correctVotes.length / resolvedVotes.length) * 100)
      : null

  // Laws the user supported that passed
  const lawsSupported = resolvedVotes.filter((v) => {
    const t = topicMap.get(v.topic_id)!
    return t.status === 'law' && v.side === 'blue'
  }).length

  // ── Category breakdown ──────────────────────────────���─────────────────────
  const catMap = new Map<string, { count: number; blue: number; red: number }>()
  for (const v of votes) {
    const cat = topicMap.get(v.topic_id)?.category ?? 'Uncategorized'
    const existing = catMap.get(cat) ?? { count: 0, blue: 0, red: 0 }
    existing.count++
    if (v.side === 'blue') existing.blue++
    else existing.red++
    catMap.set(cat, existing)
  }

  const allCategories: WrappedCategory[] = Array.from(catMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([category, stats]) => {
      const forPct = stats.count > 0 ? stats.blue / stats.count : 0.5
      const side: WrappedCategory['side'] =
        forPct > 0.6 ? 'for' : forPct < 0.4 ? 'against' : 'balanced'
      return { category, count: stats.count, side }
    })

  const topCategory = allCategories[0] ?? null

  // ── Arguments this year ───────────────────────────────────────────────────
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, topic_id, created_at')
    .eq('user_id', user.id)
    .gte('created_at', yearStart)
    .order('upvotes', { ascending: false })
    .limit(200)

  const args = argsRaw ?? []

  // Best argument (highest upvotes)
  let bestArgument: WrappedArgument | null = null
  if (args.length > 0) {
    const top = args[0]
    const topicStatement = topicMap.get(top.topic_id)?.statement ?? ''
    bestArgument = {
      id: top.id,
      content: top.content,
      side: top.side as 'blue' | 'red',
      upvotes: top.upvotes ?? 0,
      topic_statement: topicStatement,
    }
  }

  // ── Leaderboard rank ──────────────────────────────────────────────────────
  const userRep = profile.reputation_score ?? 0

  const [{ count: rankAbove }, { count: totalUsers }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt('reputation_score', userRep),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
  ])

  const rank = (rankAbove ?? 0) + 1
  const total = totalUsers ?? 1
  const percentile = Math.round((1 - (rank - 1) / total) * 100)

  // ── Platform average votes (rough) ────────────────────���──────────────────
  // Use total_votes summed / total_users as avg
  const { data: avgData } = await supabase
    .from('profiles')
    .select('total_votes')
    .gt('total_votes', 0)
    .limit(100)

  const platformAvgVotes =
    avgData && avgData.length > 0
      ? Math.round(avgData.reduce((s, p) => s + (p.total_votes ?? 0), 0) / avgData.length)
      : 0

  return NextResponse.json({
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
      reputation_score: profile.reputation_score,
      total_votes: profile.total_votes,
      total_arguments: profile.total_arguments,
      blue_vote_count: profile.blue_vote_count,
      red_vote_count: profile.red_vote_count,
      vote_streak: profile.vote_streak,
      created_at: profile.created_at,
    },
    year,
    period_label: `${year}`,
    votes_this_year: votes.length,
    arguments_this_year: args.length,
    laws_supported: lawsSupported,
    accuracy,
    resolved_votes: resolvedVotes.length,
    top_category: topCategory,
    all_categories: allCategories.slice(0, 6),
    leaderboard_rank: rank,
    total_users: total,
    percentile,
    best_argument: bestArgument,
    platform_avg_votes: platformAvgVotes,
  } satisfies WrappedData)
}
