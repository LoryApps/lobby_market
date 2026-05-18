import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DepthCategoryStat {
  category: string
  voted: number
  argued: number
  predicted: number
  bookmarked: number
  subscribed: number
  depth_score: number  // 0–100
}

export interface DepthTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  argued: boolean
  predicted: boolean
  bookmarked: boolean
  subscribed: boolean
  depth_points: number
}

export interface DepthAnalyticsResponse {
  // Overall stats
  total_voted: number
  total_argued: number
  total_predicted: number
  total_bookmarked: number
  total_subscribed: number

  // Tier counts (of voted topics)
  tier_surface: number    // voted only
  tier_engaged: number    // voted + 1 action
  tier_deep: number       // voted + 2 actions
  tier_expert: number     // voted + 3+ actions

  // Composite depth score 0–100
  depth_score: number

  // Breakdown by category
  by_category: DepthCategoryStat[]

  // Most-deeply-engaged topics (top 10 by depth_points)
  top_topics: DepthTopic[]

  profile: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
}

// ─── Score weights ────────────────────────────────────────────────────────────
// Each action contributes to the 0–100 depth score.
// The "argued" dimension is weighted most heavily — posting a case requires
// the highest effort and signals the deepest engagement.

const W_ARGUED     = 0.45
const W_PREDICTED  = 0.25
const W_BOOKMARKED = 0.15
const W_SUBSCRIBED = 0.15

function computeDepthScore(
  total: number,
  argued: number,
  predicted: number,
  bookmarked: number,
  subscribed: number,
): number {
  if (total === 0) return 0
  const score =
    (argued / total) * W_ARGUED * 100 +
    (predicted / total) * W_PREDICTED * 100 +
    (bookmarked / total) * W_BOOKMARKED * 100 +
    (subscribed / total) * W_SUBSCRIBED * 100
  return Math.round(score)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Fetch profile ───────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── 2. Fetch all voted topics with metadata ────────────────────────────────
  const { data: voteRows } = await supabase
    .from('votes')
    .select('topic_id, topics(id, statement, category, status, blue_pct, total_votes)')
    .eq('user_id', user.id)
    .limit(500)

  const votedTopicIds: string[] = []
  const topicMeta: Record<string, {
    id: string; statement: string; category: string | null
    status: string; blue_pct: number; total_votes: number
  }> = {}

  for (const row of voteRows ?? []) {
    const t = row.topics as { id: string; statement: string; category: string | null; status: string; blue_pct: number | null; total_votes: number | null } | null
    if (!t) continue
    votedTopicIds.push(t.id)
    topicMeta[t.id] = {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: Math.round(t.blue_pct ?? 50),
      total_votes: t.total_votes ?? 0,
    }
  }

  const total_voted = votedTopicIds.length

  if (total_voted === 0) {
    return NextResponse.json({
      total_voted: 0,
      total_argued: 0,
      total_predicted: 0,
      total_bookmarked: 0,
      total_subscribed: 0,
      tier_surface: 0,
      tier_engaged: 0,
      tier_deep: 0,
      tier_expert: 0,
      depth_score: 0,
      by_category: [],
      top_topics: [],
      profile,
    } satisfies DepthAnalyticsResponse)
  }

  // ── 3. Fetch engagement sets for voted topics (in parallel) ───────────────
  const [argRes, predRes, bkmkRes, subRes] = await Promise.all([
    supabase
      .from('topic_arguments')
      .select('topic_id')
      .eq('user_id', user.id)
      .in('topic_id', votedTopicIds),
    supabase
      .from('topic_predictions')
      .select('topic_id')
      .eq('user_id', user.id)
      .in('topic_id', votedTopicIds),
    supabase
      .from('topic_bookmarks')
      .select('topic_id')
      .eq('user_id', user.id)
      .in('topic_id', votedTopicIds),
    supabase
      .from('topic_subscriptions')
      .select('topic_id')
      .eq('user_id', user.id)
      .in('topic_id', votedTopicIds),
  ])

  const arguedSet    = new Set((argRes.data  ?? []).map((r) => r.topic_id))
  const predictedSet = new Set((predRes.data ?? []).map((r) => r.topic_id))
  const bookmarkedSet = new Set((bkmkRes.data ?? []).map((r) => r.topic_id))
  const subscribedSet = new Set((subRes.data ?? []).map((r) => r.topic_id))

  const total_argued     = arguedSet.size
  const total_predicted  = predictedSet.size
  const total_bookmarked = bookmarkedSet.size
  const total_subscribed = subscribedSet.size

  // ── 4. Per-topic depth points ──────────────────────────────────────────────
  // Surface=0, each additional action adds 1 point (max 4)
  const topicDepth: Record<string, number> = {}
  for (const id of votedTopicIds) {
    let pts = 0
    if (arguedSet.has(id))    pts++
    if (predictedSet.has(id)) pts++
    if (bookmarkedSet.has(id)) pts++
    if (subscribedSet.has(id)) pts++
    topicDepth[id] = pts
  }

  // ── 5. Tier counts ─────────────────────────────────────────────────────────
  let tier_surface = 0, tier_engaged = 0, tier_deep = 0, tier_expert = 0
  for (const id of votedTopicIds) {
    const p = topicDepth[id]
    if (p === 0) tier_surface++
    else if (p === 1) tier_engaged++
    else if (p === 2) tier_deep++
    else tier_expert++
  }

  // ── 6. Overall depth score ─────────────────────────────────────────────────
  const depth_score = computeDepthScore(
    total_voted,
    total_argued,
    total_predicted,
    total_bookmarked,
    total_subscribed,
  )

  // ── 7. Category breakdown ──────────────────────────────────────────────────
  const catMap: Record<string, {
    voted: number; argued: number; predicted: number; bookmarked: number; subscribed: number
  }> = {}

  for (const id of votedTopicIds) {
    const cat = topicMeta[id]?.category ?? 'Uncategorized'
    if (!catMap[cat]) catMap[cat] = { voted: 0, argued: 0, predicted: 0, bookmarked: 0, subscribed: 0 }
    catMap[cat].voted++
    if (arguedSet.has(id))     catMap[cat].argued++
    if (predictedSet.has(id))  catMap[cat].predicted++
    if (bookmarkedSet.has(id)) catMap[cat].bookmarked++
    if (subscribedSet.has(id)) catMap[cat].subscribed++
  }

  const by_category: DepthCategoryStat[] = Object.entries(catMap)
    .map(([category, s]) => ({
      category,
      voted: s.voted,
      argued: s.argued,
      predicted: s.predicted,
      bookmarked: s.bookmarked,
      subscribed: s.subscribed,
      depth_score: computeDepthScore(s.voted, s.argued, s.predicted, s.bookmarked, s.subscribed),
    }))
    .sort((a, b) => b.depth_score - a.depth_score)

  // ── 8. Top deeply-engaged topics ──────────────────────────────────────────
  const top_topics: DepthTopic[] = votedTopicIds
    .map((id) => ({
      id,
      ...topicMeta[id],
      argued: arguedSet.has(id),
      predicted: predictedSet.has(id),
      bookmarked: bookmarkedSet.has(id),
      subscribed: subscribedSet.has(id),
      depth_points: topicDepth[id],
    }))
    .filter((t) => t.depth_points > 0)
    .sort((a, b) => b.depth_points - a.depth_points || b.total_votes - a.total_votes)
    .slice(0, 12)

  return NextResponse.json({
    total_voted,
    total_argued,
    total_predicted,
    total_bookmarked,
    total_subscribed,
    tier_surface,
    tier_engaged,
    tier_deep,
    tier_expert,
    depth_score,
    by_category,
    top_topics,
    profile,
  } satisfies DepthAnalyticsResponse)
}
