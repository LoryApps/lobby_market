import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 minute cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryVoice {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  metric: number
}

export interface CategoryStats {
  category: string
  topic_count: number
  law_count: number
  total_votes: number
  avg_blue_pct: number
  /** % of topics where consensus is FOR (blue_pct > 50) */
  consensus_for_pct: number
  /** Top user by argument upvotes in this category */
  top_debater: CategoryVoice | null
  /** Top user by votes cast on topics in this category */
  top_voter: CategoryVoice | null
  /** Most active topic (most total votes) */
  hottest_topic: {
    id: string
    statement: string
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface CategoryLeaderboardResponse {
  categories: CategoryStats[]
  generated_at: string
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // ── 1. Topic stats per category ───────────────────────────────────────────
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('category', CATEGORIES as unknown as string[])
    .not('status', 'eq', 'archived')

  const topics = topicsRaw ?? []

  // ── 2. Law counts per category ────────────────────────────────────────────
  const { data: lawsRaw } = await supabase
    .from('laws')
    .select('id, category')
    .in('category', CATEGORIES as unknown as string[])
    .eq('is_active', true)

  const laws = lawsRaw ?? []

  // Build a topic → category lookup from the already-fetched topics list
  const topicCategoryMap = new Map<string, string>()
  for (const t of topics) {
    if (t.category) topicCategoryMap.set(t.id, t.category)
  }

  // ── 3. Argument upvotes per user (fetch separately, map category via topics) ─
  const { data: argUpvotesRaw } = await supabase
    .from('topic_arguments')
    .select('user_id, upvotes, topic_id')
    .gt('upvotes', 0)

  const argUpvotes = (argUpvotesRaw ?? []) as Array<{
    user_id: string
    upvotes: number
    topic_id: string
  }>

  // ── 4. Votes cast per user (fetch separately, map category via topics) ─────
  const { data: voteRowsRaw } = await supabase
    .from('votes')
    .select('user_id, topic_id')

  const voteRows = (voteRowsRaw ?? []) as Array<{
    user_id: string
    topic_id: string
  }>

  // ── 5. Fetch all profiles referenced above ────────────────────────────────
  const allUserIds = new Set<string>()
  for (const r of argUpvotes) allUserIds.add(r.user_id)
  for (const r of voteRows) allUserIds.add(r.user_id)

  const profilesMap: Map<string, CategoryVoice> = new Map()

  if (allUserIds.size > 0) {
    const { data: profilesRaw } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .in('id', Array.from(allUserIds))

    for (const p of profilesRaw ?? []) {
      profilesMap.set(p.id, {
        user_id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
        clout: p.clout,
        reputation_score: p.reputation_score,
        metric: 0,
      })
    }
  }

  // ── 6. Build per-category aggregates ─────────────────────────────────────

  // argument upvotes: category → userId → total
  const argUpvotesByCat = new Map<string, Map<string, number>>()
  for (const r of argUpvotes) {
    const cat = topicCategoryMap.get(r.topic_id)
    if (!cat) continue
    if (!argUpvotesByCat.has(cat)) argUpvotesByCat.set(cat, new Map())
    const catMap = argUpvotesByCat.get(cat)!
    catMap.set(r.user_id, (catMap.get(r.user_id) ?? 0) + r.upvotes)
  }

  // votes cast: category → userId → count
  const votesByCat = new Map<string, Map<string, number>>()
  for (const r of voteRows) {
    const cat = topicCategoryMap.get(r.topic_id)
    if (!cat) continue
    if (!votesByCat.has(cat)) votesByCat.set(cat, new Map())
    const catMap = votesByCat.get(cat)!
    catMap.set(r.user_id, (catMap.get(r.user_id) ?? 0) + 1)
  }

  // law counts by category
  const lawCountByCat = new Map<string, number>()
  for (const l of laws) {
    if (l.category) lawCountByCat.set(l.category, (lawCountByCat.get(l.category) ?? 0) + 1)
  }

  // topics by category
  const topicsByCat = new Map<string, typeof topics>()
  for (const t of topics) {
    if (!t.category) continue
    if (!topicsByCat.has(t.category)) topicsByCat.set(t.category, [])
    topicsByCat.get(t.category)!.push(t)
  }

  // ── 7. Assemble results ───────────────────────────────────────────────────

  function topUser(
    catMap: Map<string, number> | undefined,
    _metric_key: string
  ): CategoryVoice | null {
    if (!catMap || catMap.size === 0) return null
    let topId = ''
    let topVal = 0
    Array.from(catMap.entries()).forEach(([uid, val]) => {
      if (val > topVal) {
        topVal = val
        topId = uid
      }
    })
    if (!topId || !profilesMap.has(topId)) return null
    const p = profilesMap.get(topId)!
    return { ...p, metric: topVal }
  }

  const results: CategoryStats[] = []

  for (const cat of CATEGORIES) {
    const catTopics = topicsByCat.get(cat) ?? []
    if (catTopics.length === 0) continue

    const totalVotes = catTopics.reduce((s, t) => s + (t.total_votes ?? 0), 0)
    const bluePcts = catTopics.filter((t) => t.total_votes && t.total_votes > 0)
    const avgBluePct =
      bluePcts.length > 0
        ? bluePcts.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / bluePcts.length
        : 50

    const forCount = catTopics.filter((t) => (t.blue_pct ?? 50) > 50).length
    const consensusForPct =
      catTopics.length > 0 ? Math.round((forCount / catTopics.length) * 100) : 50

    const hottestTopic = [...catTopics].sort(
      (a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0)
    )[0] ?? null

    results.push({
      category: cat,
      topic_count: catTopics.length,
      law_count: lawCountByCat.get(cat) ?? 0,
      total_votes: totalVotes,
      avg_blue_pct: Math.round(avgBluePct),
      consensus_for_pct: consensusForPct,
      top_debater: topUser(argUpvotesByCat.get(cat), 'upvotes'),
      top_voter: topUser(votesByCat.get(cat), 'votes'),
      hottest_topic: hottestTopic
        ? {
            id: hottestTopic.id,
            statement: hottestTopic.statement,
            status: hottestTopic.status,
            blue_pct: hottestTopic.blue_pct ?? 50,
            total_votes: hottestTopic.total_votes ?? 0,
          }
        : null,
    })
  }

  // Sort by total votes desc
  results.sort((a, b) => b.total_votes - a.total_votes)

  return NextResponse.json({
    categories: results,
    generated_at: new Date().toISOString(),
  } satisfies CategoryLeaderboardResponse)
}
