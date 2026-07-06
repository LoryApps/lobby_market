import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface SwipeArgument {
  id: string
  content: string
  upvotes: number
}

export interface SwipeTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  description: string | null
  created_at: string
  voting_ends_at: string | null
  feed_score: number | null
  top_for: SwipeArgument | null
  top_against: SwipeArgument | null
  user_vote: 'blue' | 'red' | null
}

export interface SwipeResponse {
  topics: SwipeTopic[]
  has_more: boolean
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const limit = 20

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: topicRows, error } = await supabase
    .from('topics')
    .select(
      'id, statement, category, status, blue_pct, total_votes, view_count, description, created_at, voting_ends_at, feed_score'
    )
    .in('status', ['active', 'voting', 'proposed'])
    .gte('total_votes', 0)
    .order('feed_score', { ascending: false, nullsFirst: false })
    .order('total_votes', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const topics = (topicRows ?? []) as {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    view_count: number
    description: string | null
    created_at: string
    voting_ends_at: string | null
    feed_score: number | null
  }[]

  if (topics.length === 0) {
    return NextResponse.json({ topics: [], has_more: false })
  }

  const topicIds = topics.map((t) => t.id)

  // Fetch top FOR argument per topic
  const { data: forArgs } = await supabase
    .from('arguments')
    .select('id, topic_id, content, upvotes')
    .in('topic_id', topicIds)
    .eq('side', 'blue')
    .order('upvotes', { ascending: false })

  // Fetch top AGAINST argument per topic
  const { data: againstArgs } = await supabase
    .from('arguments')
    .select('id, topic_id, content, upvotes')
    .in('topic_id', topicIds)
    .eq('side', 'red')
    .order('upvotes', { ascending: false })

  // Fetch user votes if logged in
  const userVoteMap = new Map<string, 'blue' | 'red'>()
  if (user) {
    const { data: votes } = await supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .in('topic_id', topicIds)

    for (const v of votes ?? []) {
      if (v.side === 'blue' || v.side === 'red') {
        userVoteMap.set(v.topic_id, v.side)
      }
    }
  }

  // Build per-topic argument maps (keep only top 1 each)
  const topForMap = new Map<string, SwipeArgument>()
  const topAgainstMap = new Map<string, SwipeArgument>()

  for (const arg of (forArgs ?? []) as { id: string; topic_id: string; content: string; upvotes: number }[]) {
    if (!topForMap.has(arg.topic_id)) {
      topForMap.set(arg.topic_id, {
        id: arg.id,
        content: arg.content.slice(0, 200),
        upvotes: arg.upvotes ?? 0,
      })
    }
  }

  for (const arg of (againstArgs ?? []) as { id: string; topic_id: string; content: string; upvotes: number }[]) {
    if (!topAgainstMap.has(arg.topic_id)) {
      topAgainstMap.set(arg.topic_id, {
        id: arg.id,
        content: arg.content.slice(0, 200),
        upvotes: arg.upvotes ?? 0,
      })
    }
  }

  const result: SwipeTopic[] = topics.map((t) => ({
    ...t,
    top_for: topForMap.get(t.id) ?? null,
    top_against: topAgainstMap.get(t.id) ?? null,
    user_vote: userVoteMap.get(t.id) ?? null,
  }))

  return NextResponse.json({ topics: result, has_more: topics.length === limit })
}
