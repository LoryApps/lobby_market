import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpposingArg {
  id: string
  content: string
  upvotes: number
  side: 'blue' | 'red'
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
  created_at: string
}

export interface OpposingUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  reputation_score: number
  clout: number
  opposing_count: number
  total_upvotes: number
  top_category: string | null
}

export interface CategoryOpposition {
  category: string
  opposing_args: number
  topics_opposed: number
  avg_upvotes: number
  top_arg_content: string | null
}

export interface OppositionResponse {
  authenticated: boolean
  total_votes: number
  topics_with_opposition: number
  total_opposing_args: number
  avg_opposing_upvotes: number
  top_opponents: OpposingUser[]
  top_opposing_args: OpposingArg[]
  category_breakdown: CategoryOpposition[]
  hardest_fought_topic: {
    id: string
    statement: string
    category: string | null
    opposing_arg_count: number
    user_side: 'blue' | 'red'
    blue_pct: number
  } | null
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      total_votes: 0,
      topics_with_opposition: 0,
      total_opposing_args: 0,
      avg_opposing_upvotes: 0,
      top_opponents: [],
      top_opposing_args: [],
      category_breakdown: [],
      hardest_fought_topic: null,
    } satisfies OppositionResponse)
  }

  // 1. Fetch user's recent votes (capped for performance)
  const { data: myVotes } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(250)

  if (!myVotes || myVotes.length === 0) {
    return NextResponse.json({
      authenticated: true,
      total_votes: 0,
      topics_with_opposition: 0,
      total_opposing_args: 0,
      avg_opposing_upvotes: 0,
      top_opponents: [],
      top_opposing_args: [],
      category_breakdown: [],
      hardest_fought_topic: null,
    } satisfies OppositionResponse)
  }

  // Build vote map: topicId → user's side
  const voteMap = new Map<string, 'blue' | 'red'>()
  for (const v of myVotes) {
    voteMap.set(v.topic_id, v.side as 'blue' | 'red')
  }
  const topicIds = Array.from(voteMap.keys())

  // 2. Fetch topic metadata for those topics
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct')
    .in('id', topicIds)

  const topicMap = new Map<string, {
    statement: string
    category: string | null
    status: string
    blue_pct: number
  }>()
  for (const t of topicRows ?? []) {
    topicMap.set(t.id, {
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
    })
  }

  // 3. Fetch opposing arguments on those topics (other users, opposite side)
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id, side, content, upvotes, created_at')
    .in('topic_id', topicIds)
    .neq('user_id', user.id)
    .order('upvotes', { ascending: false })
    .limit(2000)

  // Filter to only args on the OPPOSING side of the user's vote
  const opposingArgs = (argRows ?? []).filter((arg) => {
    const userSide = voteMap.get(arg.topic_id)
    if (!userSide) return false
    // Opposing means their arg side ≠ user's vote side
    return arg.side !== userSide
  })

  if (opposingArgs.length === 0) {
    return NextResponse.json({
      authenticated: true,
      total_votes: myVotes.length,
      topics_with_opposition: 0,
      total_opposing_args: 0,
      avg_opposing_upvotes: 0,
      top_opponents: [],
      top_opposing_args: [],
      category_breakdown: [],
      hardest_fought_topic: null,
    } satisfies OppositionResponse)
  }

  // 4. Batch-fetch author profiles
  const authorIds = Array.from(new Set(opposingArgs.map((a) => a.user_id)))
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, reputation_score, clout')
    .in('id', authorIds)

  const profileMap = new Map<string, {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    reputation_score: number
    clout: number
  }>()
  for (const p of profileRows ?? []) {
    profileMap.set(p.id, p)
  }

  // 5. Compute per-topic opposition count for "hardest fought"
  const topicOppositionCount = new Map<string, number>()
  for (const arg of opposingArgs) {
    topicOppositionCount.set(arg.topic_id, (topicOppositionCount.get(arg.topic_id) ?? 0) + 1)
  }

  // 6. Find hardest-fought topic
  let hardestTopicId: string | null = null
  let hardestCount = 0
  for (const [topicId, count] of topicOppositionCount) {
    if (count > hardestCount) {
      hardestCount = count
      hardestTopicId = topicId
    }
  }

  const hardestFought = hardestTopicId
    ? (() => {
        const topic = topicMap.get(hardestTopicId)
        if (!topic) return null
        return {
          id: hardestTopicId,
          statement: topic.statement,
          category: topic.category,
          opposing_arg_count: hardestCount,
          user_side: voteMap.get(hardestTopicId) ?? 'blue',
          blue_pct: topic.blue_pct,
        } as OppositionResponse['hardest_fought_topic']
      })()
    : null

  // 7. Build top opponents (by number of opposing args, then by upvotes)
  const userOppositionStats = new Map<string, {
    opposing_count: number
    total_upvotes: number
    categories: Map<string, number>
  }>()

  for (const arg of opposingArgs) {
    const existing = userOppositionStats.get(arg.user_id) ?? {
      opposing_count: 0,
      total_upvotes: 0,
      categories: new Map(),
    }
    existing.opposing_count++
    existing.total_upvotes += arg.upvotes ?? 0
    const cat = topicMap.get(arg.topic_id)?.category ?? 'Other'
    existing.categories.set(cat, (existing.categories.get(cat) ?? 0) + 1)
    userOppositionStats.set(arg.user_id, existing)
  }

  const topOpponents: OpposingUser[] = Array.from(userOppositionStats.entries())
    .filter(([, stats]) => stats.opposing_count >= 1)
    .sort((a, b) => {
      const scoreA = a[1].opposing_count * 3 + a[1].total_upvotes
      const scoreB = b[1].opposing_count * 3 + b[1].total_upvotes
      return scoreB - scoreA
    })
    .slice(0, 8)
    .map(([userId, stats]) => {
      const profile = profileMap.get(userId)
      if (!profile) return null
      // Find top category
      let topCat: string | null = null
      let topCatCount = 0
      for (const [cat, count] of stats.categories) {
        if (count > topCatCount) {
          topCatCount = count
          topCat = cat
        }
      }
      return {
        id: userId,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        reputation_score: profile.reputation_score,
        clout: profile.clout,
        opposing_count: stats.opposing_count,
        total_upvotes: stats.total_upvotes,
        top_category: topCat,
      } satisfies OpposingUser
    })
    .filter((u): u is OpposingUser => u !== null)

  // 8. Top opposing args (by upvotes)
  const topOpposingArgs: OpposingArg[] = opposingArgs
    .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))
    .slice(0, 10)
    .map((arg) => {
      const topic = topicMap.get(arg.topic_id)
      const author = profileMap.get(arg.user_id)
      if (!topic || !author) return null
      return {
        id: arg.id,
        content: arg.content,
        upvotes: arg.upvotes ?? 0,
        side: arg.side as 'blue' | 'red',
        topic_id: arg.topic_id,
        topic_statement: topic.statement,
        topic_category: topic.category,
        topic_status: topic.status,
        author_id: arg.user_id,
        author_username: author.username,
        author_display_name: author.display_name,
        author_avatar_url: author.avatar_url,
        author_role: author.role,
        created_at: arg.created_at,
      } satisfies OpposingArg
    })
    .filter((a): a is OpposingArg => a !== null)

  // 9. Category breakdown
  const catStats = new Map<string, {
    opposing_args: number
    topics_opposed: Set<string>
    total_upvotes: number
    top_arg_content: string | null
    top_arg_upvotes: number
  }>()

  for (const arg of opposingArgs) {
    const cat = topicMap.get(arg.topic_id)?.category ?? 'Other'
    const existing = catStats.get(cat) ?? {
      opposing_args: 0,
      topics_opposed: new Set(),
      total_upvotes: 0,
      top_arg_content: null,
      top_arg_upvotes: 0,
    }
    existing.opposing_args++
    existing.topics_opposed.add(arg.topic_id)
    existing.total_upvotes += arg.upvotes ?? 0
    if ((arg.upvotes ?? 0) > existing.top_arg_upvotes) {
      existing.top_arg_upvotes = arg.upvotes ?? 0
      existing.top_arg_content = arg.content
    }
    catStats.set(cat, existing)
  }

  const categoryBreakdown: CategoryOpposition[] = Array.from(catStats.entries())
    .map(([category, stats]) => ({
      category,
      opposing_args: stats.opposing_args,
      topics_opposed: stats.topics_opposed.size,
      avg_upvotes: stats.opposing_args > 0
        ? Math.round(stats.total_upvotes / stats.opposing_args)
        : 0,
      top_arg_content: stats.top_arg_content,
    }))
    .sort((a, b) => b.opposing_args - a.opposing_args)

  // 10. Aggregate stats
  const topicsWithOpposition = topicOppositionCount.size
  const avgOpposingUpvotes = opposingArgs.length > 0
    ? Math.round(
        opposingArgs.reduce((s, a) => s + (a.upvotes ?? 0), 0) / opposingArgs.length
      )
    : 0

  return NextResponse.json({
    authenticated: true,
    total_votes: myVotes.length,
    topics_with_opposition: topicsWithOpposition,
    total_opposing_args: opposingArgs.length,
    avg_opposing_upvotes: avgOpposingUpvotes,
    top_opponents: topOpponents,
    top_opposing_args: topOpposingArgs,
    category_breakdown: categoryBreakdown,
    hardest_fought_topic: hardestFought,
  } satisfies OppositionResponse)
}
