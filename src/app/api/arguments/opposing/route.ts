import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpposingArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  user_vote: 'blue' | 'red'
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface OpposingArgumentsResponse {
  arguments: OpposingArgument[]
  voted_topic_count: number
  is_authenticated: boolean
}

// ─── GET /api/arguments/opposing ─────────────────────────────────────────────
//
// Returns the highest-quality arguments on the OPPOSING side of every topic
// the authenticated user has voted on. If the user voted blue, we return the
// best red arguments; if they voted red, we return the best blue arguments.
//
// Ranking: ai_score DESC NULLS LAST, upvotes DESC.
// Limit: up to 2 best-quality opposing arguments per topic, 60 total.

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        arguments: [],
        voted_topic_count: 0,
        is_authenticated: false,
      } satisfies OpposingArgumentsResponse)
    }

    // 1. Fetch the user's votes
    const { data: voteRows } = await supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)

    const votes = (voteRows as { topic_id: string; side: 'blue' | 'red' }[] | null) ?? []
    const votedTopicCount = votes.length

    if (votes.length === 0) {
      return NextResponse.json({
        arguments: [],
        voted_topic_count: 0,
        is_authenticated: true,
      } satisfies OpposingArgumentsResponse)
    }

    // Map topic_id → user's vote side
    const userVoteMap = new Map<string, 'blue' | 'red'>()
    for (const v of votes) {
      userVoteMap.set(v.topic_id, v.side)
    }

    const topicIds = votes.map((v) => v.topic_id)

    // 2. Fetch top-quality arguments across these topics
    //    We'll filter to opposing side in JS since Supabase can't express
    //    "side != user_vote_for_this_topic" in a single query.
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select(`
        id,
        topic_id,
        user_id,
        side,
        content,
        upvotes,
        ai_score,
        ai_grade,
        created_at,
        profiles:user_id (
          id,
          username,
          display_name,
          avatar_url,
          role
        ),
        topics:topic_id (
          id,
          statement,
          category,
          status,
          blue_pct,
          total_votes
        )
      `)
      .in('topic_id', topicIds)
      .neq('user_id', user.id)
      .order('ai_score', { ascending: false, nullsFirst: false })
      .order('upvotes', { ascending: false })
      .limit(600)

    const args = (argRows as (typeof argRows extends (infer T)[] | null ? T : never)[] | null) ?? []

    // 3. Filter to opposing side per topic, keep top 2 per topic
    const seenPerTopic = new Map<string, number>()
    const opposing: OpposingArgument[] = []

    for (const arg of args) {
      const userVote = userVoteMap.get((arg as { topic_id: string }).topic_id)
      if (!userVote) continue

      const argSide = (arg as { side: string }).side as 'blue' | 'red'
      if (argSide === userVote) continue // same side as user — skip

      const topicId = (arg as { topic_id: string }).topic_id
      const count = seenPerTopic.get(topicId) ?? 0
      if (count >= 2) continue // already have 2 from this topic

      seenPerTopic.set(topicId, count + 1)

      const profile = (arg as { profiles: unknown }).profiles as {
        id: string
        username: string
        display_name: string | null
        avatar_url: string | null
        role: string
      } | null

      const topic = (arg as { topics: unknown }).topics as {
        id: string
        statement: string
        category: string | null
        status: string
        blue_pct: number
        total_votes: number
      } | null

      opposing.push({
        id: (arg as { id: string }).id,
        topic_id: topicId,
        user_id: (arg as { user_id: string }).user_id,
        side: argSide,
        content: (arg as { content: string }).content,
        upvotes: (arg as { upvotes: number }).upvotes,
        ai_score: (arg as { ai_score: number | null }).ai_score,
        ai_grade: (arg as { ai_grade: string | null }).ai_grade,
        created_at: (arg as { created_at: string }).created_at,
        user_vote: userVote,
        author: profile
          ? {
              id: profile.id,
              username: profile.username,
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
              role: profile.role,
            }
          : null,
        topic: topic
          ? {
              id: topic.id,
              statement: topic.statement,
              category: topic.category,
              status: topic.status,
              blue_pct: topic.blue_pct,
              total_votes: topic.total_votes,
            }
          : null,
      })

      if (opposing.length >= 60) break
    }

    return NextResponse.json({
      arguments: opposing,
      voted_topic_count: votedTopicCount,
      is_authenticated: true,
    } satisfies OpposingArgumentsResponse)
  } catch (err) {
    console.error('[arguments/opposing]', err)
    return NextResponse.json(
      { arguments: [], voted_topic_count: 0, is_authenticated: true },
      { status: 500 },
    )
  }
}
