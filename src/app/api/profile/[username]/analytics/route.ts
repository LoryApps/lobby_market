import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CategoryStat {
  category: string
  votes: number
  blue: number
  red: number
  forPct: number
}

export interface DayActivity {
  date: string   // YYYY-MM-DD
  count: number
}

export interface AnalyticsProfile {
  id: string
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
  followers_count: number
  civic_archetype: string | null
  created_at: string
}

export interface ProfileAnalyticsResponse {
  profile: AnalyticsProfile
  accuracy: number | null
  resolvedVotes: number
  correctVotes: number
  categories: CategoryStat[]
  dailyActivity: DayActivity[]
  argumentsUpvotes: number
  argumentsTotal: number
  predictionsAccuracy: number | null
  predictionsTotal: number
  topCategory: string | null
  leaningLabel: string
  leaningPct: number
  platformAvgVotes: number
  isOwnProfile: boolean
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  // Fetch the target profile
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, role, clout, reputation_score, ' +
      'total_votes, total_arguments, blue_vote_count, red_vote_count, vote_streak, ' +
      'followers_count, civic_archetype, created_at'
    )
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  const isOwnProfile = user?.id === profile.id

  const userId = profile.id
  const yearAgo = new Date()
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)

  // ── Votes (last year) ──────────────────────────────────────────────────────
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('id, side, created_at, topic_id')
    .eq('user_id', userId)
    .gte('created_at', yearAgo.toISOString())
    .order('created_at', { ascending: true })
    .limit(3000)

  const votes = votesRaw ?? []

  // Fetch topic metadata for voted topics
  const topicIds = Array.from(new Set(votes.map((v) => v.topic_id)))
  const topicMap = new Map<string, { status: string; category: string | null; blue_pct: number }>()

  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, status, category, blue_pct')
      .in('id', topicIds)
    for (const t of topics ?? []) {
      topicMap.set(t.id, { status: t.status, category: t.category, blue_pct: t.blue_pct })
    }
  }

  // ── Accuracy ──────────────────────────────────────────────────────────────
  const resolvedVotesList = votes.filter((v) => {
    const t = topicMap.get(v.topic_id)
    return t && (t.status === 'law' || t.status === 'failed')
  })
  const correctVotesList = resolvedVotesList.filter((v) => {
    const t = topicMap.get(v.topic_id)!
    return (t.status === 'law' && v.side === 'blue') || (t.status === 'failed' && v.side === 'red')
  })
  const accuracy =
    resolvedVotesList.length > 0
      ? Math.round((correctVotesList.length / resolvedVotesList.length) * 100)
      : null

  // ── Category breakdown ─────────────────────────────────────────────────────
  const catMap = new Map<string, { votes: number; blue: number; red: number }>()
  for (const v of votes) {
    const t = topicMap.get(v.topic_id)
    const cat = t?.category ?? 'Uncategorized'
    const existing = catMap.get(cat) ?? { votes: 0, blue: 0, red: 0 }
    existing.votes++
    if (v.side === 'blue') existing.blue++
    else existing.red++
    catMap.set(cat, existing)
  }
  const categories: CategoryStat[] = Array.from(catMap.entries())
    .map(([category, stats]) => ({
      category,
      votes: stats.votes,
      blue: stats.blue,
      red: stats.red,
      forPct: stats.votes > 0 ? Math.round((stats.blue / stats.votes) * 100) : 50,
    }))
    .sort((a, b) => b.votes - a.votes)

  const topCategory = categories[0]?.category ?? null

  // ── Daily activity (for heatmap) ───────────────────────────────────────────
  const dayMap = new Map<string, number>()
  for (const v of votes) {
    const d = v.created_at.slice(0, 10)
    dayMap.set(d, (dayMap.get(d) ?? 0) + 1)
  }
  const dailyActivity: DayActivity[] = Array.from(dayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── Arguments ─────────────────────────────────────────────────────────────
  const { data: argsRaw } = await supabase
    .from('arguments')
    .select('id, upvotes')
    .eq('user_id', userId)
    .limit(500)

  const args = argsRaw ?? []
  const argumentsUpvotes = args.reduce((s, a) => s + (a.upvotes ?? 0), 0)

  // ── Predictions accuracy ───────────────────────────────────────────────────
  const { data: predsRaw } = await supabase
    .from('predictions')
    .select('id, resolved, correct')
    .eq('user_id', userId)
    .limit(500)

  const preds = predsRaw ?? []
  const resolvedPreds = preds.filter((p) => p.resolved)
  const correctPreds = resolvedPreds.filter((p) => p.correct)
  const predictionsAccuracy =
    resolvedPreds.length >= 3
      ? Math.round((correctPreds.length / resolvedPreds.length) * 100)
      : null

  // ── Overall leaning ────────────────────────────────────────────────────────
  const totalV = profile.total_votes ?? 0
  const blueV = profile.blue_vote_count ?? 0
  const _redV = profile.red_vote_count ?? 0
  let leaningLabel = 'Balanced'
  let leaningPct = 50
  if (totalV > 0) {
    const forPct = Math.round((blueV / totalV) * 100)
    leaningPct = forPct
    if (forPct >= 65) leaningLabel = 'Strongly For'
    else if (forPct >= 55) leaningLabel = 'Leaning For'
    else if (forPct <= 35) leaningLabel = 'Strongly Against'
    else if (forPct <= 45) leaningLabel = 'Leaning Against'
  }

  // ── Platform average votes (rough benchmark) ───────────────────────────────
  const { data: avgData } = await supabase
    .rpc('get_platform_avg_votes')
    .maybeSingle()
    .catch(() => ({ data: null }))

  const platformAvgVotes =
    (avgData as { avg_votes?: number } | null)?.avg_votes ?? 120

  return NextResponse.json({
    profile,
    accuracy,
    resolvedVotes: resolvedVotesList.length,
    correctVotes: correctVotesList.length,
    categories,
    dailyActivity,
    argumentsUpvotes,
    argumentsTotal: args.length,
    predictionsAccuracy,
    predictionsTotal: preds.length,
    topCategory,
    leaningLabel,
    leaningPct,
    platformAvgVotes,
    isOwnProfile,
  } satisfies ProfileAnalyticsResponse)
}
