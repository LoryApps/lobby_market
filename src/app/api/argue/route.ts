import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ArgueVote {
  vote_id: string
  topic_id: string
  side: 'blue' | 'red'
  voted_at: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  blue_pct: number
  total_votes: number
}

export interface ArgueResponse {
  votes: ArgueVote[]
  total_voted: number
  total_argued: number
  unarguned_count: number
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch user's votes with topic data
  const { data: votesRaw, error: votesErr } = await supabase
    .from('votes')
    .select('id, topic_id, side, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (votesErr) {
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 })
  }

  const votes = votesRaw ?? []
  if (votes.length === 0) {
    return NextResponse.json({
      votes: [],
      total_voted: 0,
      total_argued: 0,
      unarguned_count: 0,
    } satisfies ArgueResponse)
  }

  const topicIds = Array.from(new Set(votes.map((v) => v.topic_id)))

  // Fetch topics that are still writable
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_votes, red_votes, total_votes')
    .in('id', topicIds)
    .in('status', ['active', 'proposed', 'voting'])

  const topicMap = new Map<
    string,
    {
      statement: string
      category: string | null
      status: string
      blue_votes: number
      red_votes: number
      total_votes: number
    }
  >()
  for (const t of topicsRaw ?? []) {
    topicMap.set(t.id, t)
  }

  // Fetch topic IDs user has already argued
  const { data: arguedRaw } = await supabase
    .from('topic_arguments')
    .select('topic_id')
    .eq('user_id', user.id)
    .in('topic_id', topicIds)

  const arguedTopicIds = new Set((arguedRaw ?? []).map((a) => a.topic_id))

  // Build result: voted on writable topics without an argument yet
  const result: ArgueVote[] = []
  for (const v of votes) {
    const topic = topicMap.get(v.topic_id)
    if (!topic) continue
    if (arguedTopicIds.has(v.topic_id)) continue

    const totalVotes = topic.total_votes ?? 0
    const bluePct =
      totalVotes > 0 ? Math.round((topic.blue_votes / totalVotes) * 100) : 50

    result.push({
      vote_id: v.id,
      topic_id: v.topic_id,
      side: v.side as 'blue' | 'red',
      voted_at: v.created_at,
      topic_statement: topic.statement,
      topic_category: topic.category,
      topic_status: topic.status,
      blue_pct: bluePct,
      total_votes: totalVotes,
    })
  }

  return NextResponse.json({
    votes: result,
    total_voted: votes.length,
    total_argued: arguedTopicIds.size,
    unarguned_count: result.length,
  } satisfies ArgueResponse)
}
