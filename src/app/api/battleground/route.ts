import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BattleArgument {
  id: string
  content: string
  upvotes: number
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface BattleVote {
  side: 'blue' | 'red'
  reason: string | null
  voter_username: string | null
  voter_display_name: string | null
  voter_avatar: string | null
  voted_at: string
}

export interface BattleTopic {
  id: string
  statement: string
  category: string | null
  scope: string
  status: string
  blue_pct: number
  total_votes: number
  support_count: number
  activation_threshold: number
  created_at: string
  /** Votes in the last hour */
  recent_velocity: number
  for_arg: BattleArgument | null
  against_arg: BattleArgument | null
  recent_votes: BattleVote[]
}

export interface BattlegroundResponse {
  topic: BattleTopic | null
  /** Other hot topics the user can switch to */
  alternates: Array<{
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    recent_velocity: number
  }>
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const topicId = searchParams.get('topic_id')

  const supabase = await createClient()

  // Fetch active/voting topics ordered by recent activity
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // Get candidate topics (most-voted active/voting first)
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, scope, status, blue_pct, total_votes, support_count, activation_threshold, created_at')
    .in('status', ['active', 'voting'])
    .order('total_votes', { ascending: false })
    .limit(20)

  const topics = topicsRaw ?? []
  if (topics.length === 0) {
    return NextResponse.json({ topic: null, alternates: [] } satisfies BattlegroundResponse)
  }

  // Compute recent velocity (votes in last hour) for each topic
  const topicIds = topics.map((t) => t.id)
  const { data: recentVotesRaw } = await supabase
    .from('votes')
    .select('topic_id')
    .in('topic_id', topicIds)
    .gte('created_at', oneHourAgo)

  const velocityMap: Record<string, number> = {}
  for (const v of recentVotesRaw ?? []) {
    velocityMap[v.topic_id] = (velocityMap[v.topic_id] ?? 0) + 1
  }

  // Pick the most active topic or use the requested one
  const sortedTopics = [...topics].sort((a, b) => {
    const va = velocityMap[a.id] ?? 0
    const vb = velocityMap[b.id] ?? 0
    return vb - va
  })

  const mainTopic = topicId
    ? (topics.find((t) => t.id === topicId) ?? sortedTopics[0])
    : sortedTopics[0]

  if (!mainTopic) {
    return NextResponse.json({ topic: null, alternates: [] } satisfies BattlegroundResponse)
  }

  // Fetch top arguments for the main topic in parallel with recent votes
  const [argsRes, recentVoteRes] = await Promise.all([
    supabase
      .from('topic_arguments')
      .select('id, content, upvotes, side, author_id')
      .eq('topic_id', mainTopic.id)
      .order('upvotes', { ascending: false })
      .limit(20),
    supabase
      .from('votes')
      .select('side, reason, user_id, created_at')
      .eq('topic_id', mainTopic.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const args = argsRes.data ?? []
  const recentVoteRows = recentVoteRes.data ?? []

  // Fetch author profiles for top arguments
  const topForArg = args.find((a) => a.side === 'blue') ?? null
  const topAgainstArg = args.find((a) => a.side === 'red') ?? null

  const authorIds = [topForArg?.author_id, topAgainstArg?.author_id].filter(Boolean) as string[]
  const voterIds = Array.from(new Set(recentVoteRows.map((v) => v.user_id).filter(Boolean))) as string[]

  const [authorsRes, votersRes] = await Promise.all([
    authorIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', authorIds)
      : Promise.resolve({ data: [] }),
    voterIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', voterIds.slice(0, 20))
      : Promise.resolve({ data: [] }),
  ])

  const authorMap: Record<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }> = {}
  for (const a of authorsRes.data ?? []) {
    authorMap[a.id] = a
  }
  const voterMap: Record<string, { id: string; username: string; display_name: string | null; avatar_url: string | null }> = {}
  for (const v of votersRes.data ?? []) {
    voterMap[v.id] = v
  }

  function buildArg(raw: typeof topForArg): BattleArgument | null {
    if (!raw) return null
    const author = raw.author_id ? (authorMap[raw.author_id] ?? null) : null
    return {
      id: raw.id,
      content: raw.content,
      upvotes: raw.upvotes ?? 0,
      author,
    }
  }

  const recentVotes: BattleVote[] = recentVoteRows
    .filter((v) => v.reason || voterMap[v.user_id])
    .slice(0, 12)
    .map((v) => {
      const voter = voterMap[v.user_id]
      return {
        side: v.side === 'blue' ? 'blue' : 'red',
        reason: v.reason ?? null,
        voter_username: voter?.username ?? null,
        voter_display_name: voter?.display_name ?? null,
        voter_avatar: voter?.avatar_url ?? null,
        voted_at: v.created_at,
      }
    })

  const topic: BattleTopic = {
    id: mainTopic.id,
    statement: mainTopic.statement,
    category: mainTopic.category,
    scope: mainTopic.scope,
    status: mainTopic.status,
    blue_pct: mainTopic.blue_pct ?? 50,
    total_votes: mainTopic.total_votes ?? 0,
    support_count: mainTopic.support_count ?? 0,
    activation_threshold: mainTopic.activation_threshold ?? 50,
    created_at: mainTopic.created_at,
    recent_velocity: velocityMap[mainTopic.id] ?? 0,
    for_arg: buildArg(topForArg),
    against_arg: buildArg(topAgainstArg),
    recent_votes: recentVotes,
  }

  const alternates = sortedTopics
    .filter((t) => t.id !== mainTopic!.id)
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      recent_velocity: velocityMap[t.id] ?? 0,
    }))

  return NextResponse.json({ topic, alternates } satisfies BattlegroundResponse, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
