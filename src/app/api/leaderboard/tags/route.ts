import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TagArguer {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  argument_count: number
  total_upvotes: number
  rank: number
}

export interface TagTopic {
  id: string
  statement: string
  status: string
  blue_pct: number
  total_votes: number
  argument_count: number
}

export interface TagStats {
  tag: string
  topic_count: number
  law_count: number
  active_count: number
  total_votes: number
  total_arguments: number
  consensus_for_pct: number
}

export interface TagLeaderboardResponse {
  tag: string
  stats: TagStats
  topArguers: TagArguer[]
  topTopics: TagTopic[]
  generated_at: string
}

export interface TagsOverviewResponse {
  tags: TagStats[]
  generated_at: string
}

// ─── GET /api/leaderboard/tags?tag=<tagname> ─────────────────────────────────
// Without ?tag: returns summary stats for all tags (overview).
// With ?tag: returns top arguers + top topics for that specific tag.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tag = searchParams.get('tag')?.trim().toLowerCase() ?? ''

  const supabase = await createClient()

  if (!tag) {
    // ── Overview: all tags with stats ─────────────────────────────────────────
    const { data: topicRows, error } = await supabase
      .from('topics')
      .select('id, tags, status, blue_pct, total_votes')
      .not('tags', 'eq', '{}')
      .not('status', 'eq', 'archived')

    if (error) {
      return NextResponse.json({ tags: [], generated_at: new Date().toISOString() } satisfies TagsOverviewResponse)
    }

    const tagMap = new Map<string, {
      topic_count: number
      law_count: number
      active_count: number
      total_votes: number
      for_count: number
    }>()

    for (const row of topicRows ?? []) {
      const tags: string[] = row.tags ?? []
      for (const t of tags) {
        if (!t) continue
        const tl = t.toLowerCase()
        const s = tagMap.get(tl) ?? { topic_count: 0, law_count: 0, active_count: 0, total_votes: 0, for_count: 0 }
        s.topic_count++
        s.total_votes += row.total_votes ?? 0
        if (row.status === 'law') s.law_count++
        if (row.status === 'active' || row.status === 'voting') s.active_count++
        if ((row.blue_pct ?? 50) > 50) s.for_count++
        tagMap.set(tl, s)
      }
    }

    // Fetch argument counts per tag (via topic_arguments + topics join)
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select('topic_id')

    const argsByTopic = new Map<string, number>()
    for (const r of argRows ?? []) {
      argsByTopic.set(r.topic_id, (argsByTopic.get(r.topic_id) ?? 0) + 1)
    }

    // Build tag → argument count mapping through topics
    const tagArgCounts = new Map<string, number>()
    for (const row of topicRows ?? []) {
      const argCount = argsByTopic.get(row.id) ?? 0
      if (argCount === 0) continue
      for (const t of (row.tags ?? []) as string[]) {
        if (!t) continue
        const tl = t.toLowerCase()
        tagArgCounts.set(tl, (tagArgCounts.get(tl) ?? 0) + argCount)
      }
    }

    const tags: TagStats[] = Array.from(tagMap.entries())
      .map(([t, s]) => ({
        tag: t,
        topic_count: s.topic_count,
        law_count: s.law_count,
        active_count: s.active_count,
        total_votes: s.total_votes,
        total_arguments: tagArgCounts.get(t) ?? 0,
        consensus_for_pct: s.topic_count > 0 ? Math.round((s.for_count / s.topic_count) * 100) : 50,
      }))
      .filter((t) => t.topic_count >= 1)
      .sort((a, b) => b.topic_count - a.topic_count || b.total_votes - a.total_votes)
      .slice(0, 60)

    return NextResponse.json({ tags, generated_at: new Date().toISOString() } satisfies TagsOverviewResponse)
  }

  // ── Tag-specific leaderboard ────────────────────────────────────────────────

  // 1. Find all topics that carry this tag
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, status, blue_pct, total_votes, tags')
    .contains('tags', [tag])
    .not('status', 'eq', 'archived')
    .order('total_votes', { ascending: false })

  const topics = topicRows ?? []
  const topicIds = topics.map((t) => t.id)

  if (topicIds.length === 0) {
    const emptyStats: TagStats = {
      tag,
      topic_count: 0,
      law_count: 0,
      active_count: 0,
      total_votes: 0,
      total_arguments: 0,
      consensus_for_pct: 50,
    }
    return NextResponse.json({
      tag,
      stats: emptyStats,
      topArguers: [],
      topTopics: [],
      generated_at: new Date().toISOString(),
    } satisfies TagLeaderboardResponse)
  }

  // 2. Fetch arguments for these topics
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('id, user_id, upvotes, topic_id')
    .in('topic_id', topicIds.slice(0, 400))

  const args = argRows ?? []

  // 3. Aggregate per user
  const userMap = new Map<string, { argument_count: number; total_upvotes: number }>()
  const argCountByTopic = new Map<string, number>()

  for (const arg of args) {
    const u = userMap.get(arg.user_id) ?? { argument_count: 0, total_upvotes: 0 }
    u.argument_count++
    u.total_upvotes += arg.upvotes ?? 0
    userMap.set(arg.user_id, u)
    argCountByTopic.set(arg.topic_id, (argCountByTopic.get(arg.topic_id) ?? 0) + 1)
  }

  // 4. Fetch profiles for top arguers (sorted by total upvotes)
  const topUserIds = Array.from(userMap.entries())
    .sort((a, b) => b[1].total_upvotes - a[1].total_upvotes || b[1].argument_count - a[1].argument_count)
    .slice(0, 20)
    .map(([uid]) => uid)

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .in('id', topUserIds)

  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id, p])
  )

  const topArguers: TagArguer[] = topUserIds
    .map((uid, i) => {
      const stats = userMap.get(uid)!
      const p = profileMap.get(uid)
      if (!p) return null
      return {
        user_id: uid,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
        clout: p.clout ?? 0,
        argument_count: stats.argument_count,
        total_upvotes: stats.total_upvotes,
        rank: i + 1,
      } satisfies TagArguer
    })
    .filter((x): x is TagArguer => x !== null)

  // 5. Build top topics
  const topTopics: TagTopic[] = topics
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      argument_count: argCountByTopic.get(t.id) ?? 0,
    }))

  // 6. Compute tag stats
  const totalVotes = topics.reduce((s, t) => s + (t.total_votes ?? 0), 0)
  const lawCount = topics.filter((t) => t.status === 'law').length
  const activeCount = topics.filter((t) => t.status === 'active' || t.status === 'voting').length
  const forCount = topics.filter((t) => (t.blue_pct ?? 50) > 50).length

  const stats: TagStats = {
    tag,
    topic_count: topics.length,
    law_count: lawCount,
    active_count: activeCount,
    total_votes: totalVotes,
    total_arguments: args.length,
    consensus_for_pct: topics.length > 0 ? Math.round((forCount / topics.length) * 100) : 50,
  }

  return NextResponse.json({
    tag,
    stats,
    topArguers,
    topTopics,
    generated_at: new Date().toISOString(),
  } satisfies TagLeaderboardResponse)
}
