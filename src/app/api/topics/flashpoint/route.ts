import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlashpointArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvote_count: number
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
}

export interface FlashpointTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  votes_1h: number
  votes_6h: number
  /** contestedness score: 100 = perfectly split, 0 = unanimous */
  contestedness: number
  /** combined score used to pick the flashpoint */
  flashpoint_score: number
  top_for_arg: FlashpointArgument | null
  top_against_arg: FlashpointArgument | null
  voting_ends_at: string | null
}

export interface FlashpointResponse {
  flashpoint: FlashpointTopic | null
  recent_flashpoints: Array<{
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    became_flashpoint_at: string
  }>
  platform: {
    total_votes_1h: number
    total_active_topics: number
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()
  const since6h = new Date(now - 6 * 60 * 60 * 1000).toISOString()
  const since1h = new Date(now - 1 * 60 * 60 * 1000).toISOString()
  const since48h = new Date(now - 48 * 60 * 60 * 1000).toISOString()

  // ── Pull recent votes ──────────────────────────────────────────────────────
  const { data: recentVotes } = await supabase
    .from('votes')
    .select('topic_id, created_at')
    .gte('created_at', since6h)
    .limit(15000)

  const votes = recentVotes ?? []

  // Count votes per topic for 1h and 6h windows
  const counts6h = new Map<string, number>()
  const counts1h  = new Map<string, number>()

  let totalVotes1h = 0
  for (const v of votes) {
    counts6h.set(v.topic_id, (counts6h.get(v.topic_id) ?? 0) + 1)
    if (v.created_at >= since1h) {
      counts1h.set(v.topic_id, (counts1h.get(v.topic_id) ?? 0) + 1)
      totalVotes1h++
    }
  }

  // ── Get active topics with most 6h vote activity ───────────────────────────
  const topIds = Array.from(counts6h.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id]) => id)

  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, voting_ends_at')
    .in('id', topIds.length > 0 ? topIds : ['00000000-0000-0000-0000-000000000000'])
    .in('status', ['active', 'voting', 'proposed'])

  const topics = topicsData ?? []

  // ── Score: velocity × contestedness ───────────────────────────────────────
  // contestedness = 100 when 50/50, 0 when 100/0
  // We want debates that are both fast AND contested
  const scored = topics.map((t) => {
    const v6 = counts6h.get(t.id) ?? 0
    const v1 = counts1h.get(t.id) ?? 0
    const pct = t.blue_pct ?? 50
    const contestedness = 100 - Math.abs(pct - 50) * 2 // 100 at 50/50, 0 at 100/0
    const velocity = v6 / 6  // votes per hour
    const flashpoint_score = velocity * (contestedness / 100) * 1.5 + v1 * 2
    return { ...t, votes_1h: v1, votes_6h: v6, contestedness, flashpoint_score, velocity }
  })

  // Sort by flashpoint_score descending
  scored.sort((a, b) => b.flashpoint_score - a.flashpoint_score)

  const winner = scored[0] ?? null

  // ── Fetch top arguments for the flashpoint topic ───────────────────────────
  let topForArg: FlashpointArgument | null = null
  let topAgainstArg: FlashpointArgument | null = null

  if (winner) {
    const { data: argsData } = await supabase
      .from('arguments')
      .select(`
        id, content, side, upvote_count,
        profiles!arguments_author_id_fkey (
          username, display_name, avatar_url, role
        )
      `)
      .eq('topic_id', winner.id)
      .eq('is_deleted', false)
      .order('upvote_count', { ascending: false })
      .limit(10)

    const args = (argsData ?? []) as Array<{
      id: string
      content: string
      side: string
      upvote_count: number
      profiles: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null
    }>

    for (const arg of args) {
      const author = arg.profiles
      if (!author) continue
      const mapped: FlashpointArgument = {
        id: arg.id,
        content: arg.content,
        side: arg.side as 'blue' | 'red',
        upvote_count: arg.upvote_count,
        author_username: author.username,
        author_display_name: author.display_name,
        author_avatar_url: author.avatar_url,
        author_role: author.role,
      }
      if (arg.side === 'blue' && !topForArg) topForArg = mapped
      if (arg.side === 'red' && !topAgainstArg) topAgainstArg = mapped
      if (topForArg && topAgainstArg) break
    }
  }

  // ── Recent flashpoints: active topics with most total votes in last 48h ───
  const { data: recentTopics } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, updated_at')
    .in('status', ['active', 'voting', 'law'])
    .gte('updated_at', since48h)
    .order('total_votes', { ascending: false })
    .limit(6)

  const recentFlashpoints = (recentTopics ?? [])
    .filter((t) => !winner || t.id !== winner.id)
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      became_flashpoint_at: t.updated_at,
    }))

  // ── Active topics count ────────────────────────────────────────────────────
  const { count: activeCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'voting'])

  const flashpointTopic: FlashpointTopic | null = winner
    ? {
        id: winner.id,
        statement: winner.statement,
        category: winner.category,
        status: winner.status,
        blue_pct: winner.blue_pct ?? 50,
        total_votes: winner.total_votes ?? 0,
        votes_1h: winner.votes_1h,
        votes_6h: winner.votes_6h,
        contestedness: Math.round(winner.contestedness),
        flashpoint_score: Math.round(winner.flashpoint_score * 10) / 10,
        top_for_arg: topForArg,
        top_against_arg: topAgainstArg,
        voting_ends_at: winner.voting_ends_at ?? null,
      }
    : null

  return NextResponse.json({
    flashpoint: flashpointTopic,
    recent_flashpoints: recentFlashpoints,
    platform: {
      total_votes_1h: totalVotes1h,
      total_active_topics: activeCount ?? 0,
    },
  } satisfies FlashpointResponse)
}
