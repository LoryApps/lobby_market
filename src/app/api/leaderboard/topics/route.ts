import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopicRanked {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  feed_score: number
  created_at: string
}

export interface LawRanked {
  id: string
  topic_id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  topic_created_at: string
  days_to_law: number
}

export interface TopicsLeaderboardResponse {
  byVotes: TopicRanked[]
  byViews: TopicRanked[]
  controversial: TopicRanked[]
  trending: TopicRanked[]
  fastestLaws: LawRanked[]
  generatedAt: string
}

// ─── GET /api/leaderboard/topics ─────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const TOPIC_SELECT =
    'id, statement, category, status, blue_pct, total_votes, view_count, feed_score, created_at'

  const [
    byVotesRes,
    byViewsRes,
    controversialPoolRes,
    trendingRes,
    lawsRes,
  ] = await Promise.all([
    // 1. Most voted
    supabase
      .from('topics')
      .select(TOPIC_SELECT)
      .order('total_votes', { ascending: false })
      .limit(25),

    // 2. Most viewed
    supabase
      .from('topics')
      .select(TOPIC_SELECT)
      .order('view_count', { ascending: false })
      .limit(25),

    // 3. Controversial pool — active/voting/proposed with at least 3 votes
    //    We sort in JS since Supabase can't ORDER BY ABS(blue_pct - 50)
    supabase
      .from('topics')
      .select(TOPIC_SELECT)
      .in('status', ['active', 'voting', 'proposed'])
      .gte('total_votes', 3)
      .limit(300),

    // 4. Trending (highest feed_score)
    supabase
      .from('topics')
      .select(TOPIC_SELECT)
      .order('feed_score', { ascending: false })
      .limit(25),

    // 5. Fastest laws — fetch laws without join, then look up topic created_at separately
    supabase
      .from('laws')
      .select('id, topic_id, statement, category, blue_pct, total_votes, established_at')
      .eq('is_active', true)
      .order('established_at', { ascending: true })
      .limit(200),
  ])

  // Sort controversial by closeness to 50/50 split
  const controversialPool = (controversialPoolRes.data ?? []) as TopicRanked[]
  const controversial = [...controversialPool]
    .sort((a, b) => Math.abs(a.blue_pct - 50) - Math.abs(b.blue_pct - 50))
    .slice(0, 25)

  // Build fastest-laws list with computed days_to_law
  type LawRow = {
    id: string
    topic_id: string
    statement: string
    category: string | null
    blue_pct: number | null
    total_votes: number | null
    established_at: string
  }

  const rawLaws = (lawsRes.data ?? []) as LawRow[]

  // Fetch topic created_at values in bulk for all law topic_ids
  const lawTopicIds = Array.from(new Set(rawLaws.map((l) => l.topic_id)))
  const topicCreatedAtMap = new Map<string, string>()
  if (lawTopicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, created_at')
      .in('id', lawTopicIds)
    for (const t of topicRows ?? []) {
      topicCreatedAtMap.set(t.id, t.created_at)
    }
  }

  const fastestLaws: LawRanked[] = rawLaws
    .map((row) => {
      const topicCreatedAt = topicCreatedAtMap.get(row.topic_id) ?? row.established_at
      const ms =
        new Date(row.established_at).getTime() -
        new Date(topicCreatedAt).getTime()
      const days = Math.max(0, Math.round(ms / 86_400_000))
      return {
        id: row.id,
        topic_id: row.topic_id,
        statement: row.statement,
        category: row.category,
        blue_pct: row.blue_pct ?? 50,
        total_votes: row.total_votes ?? 0,
        established_at: row.established_at,
        topic_created_at: topicCreatedAt,
        days_to_law: days,
      }
    })
    // Sort by fastest first (fewest days)
    .sort((a, b) => a.days_to_law - b.days_to_law)
    .slice(0, 25)

  return NextResponse.json({
    byVotes: (byVotesRes.data ?? []) as TopicRanked[],
    byViews: (byViewsRes.data ?? []) as TopicRanked[],
    controversial,
    trending: (trendingRes.data ?? []) as TopicRanked[],
    fastestLaws,
    generatedAt: new Date().toISOString(),
  } satisfies TopicsLeaderboardResponse)
}
