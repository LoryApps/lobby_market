import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface SubscribedTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number
  created_at: string
  updated_at: string | null
  subscribed_at: string
}

export interface SubscribedTopicsResponse {
  topics: SubscribedTopic[]
  total: number
}

/**
 * GET /api/topics/subscribed
 * Returns all topics the current user is subscribed to, ordered by
 * most recently subscribed.
 */
export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Step 1: fetch subscription rows for this user
  const { data: subRows, error: subError } = await supabase
    .from('topic_subscriptions')
    .select('topic_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 })
  }

  if (!subRows || subRows.length === 0) {
    return NextResponse.json({ topics: [], total: 0 } satisfies SubscribedTopicsResponse)
  }

  const topicIds = subRows.map((r) => r.topic_id)
  const subscribedAtMap: Record<string, string> = {}
  for (const r of subRows) {
    subscribedAtMap[r.topic_id] = r.created_at
  }

  // Step 2: fetch the topics themselves
  const { data: topicRows, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score, created_at, updated_at')
    .in('id', topicIds)

  if (topicError) {
    return NextResponse.json({ error: topicError.message }, { status: 500 })
  }

  // Reorder to match subscription order (most recently subscribed first)
  const topicMap: Record<string, (typeof topicRows)[number]> = {}
  for (const t of topicRows ?? []) {
    topicMap[t.id] = t
  }

  const topics: SubscribedTopic[] = topicIds
    .filter((id) => topicMap[id] !== undefined)
    .map((id) => {
      const t = topicMap[id]
      return {
        id: t.id,
        statement: t.statement ?? '',
        category: t.category ?? null,
        status: t.status ?? 'proposed',
        blue_pct: (t.blue_pct as number | null) ?? 50,
        total_votes: (t.total_votes as number | null) ?? 0,
        feed_score: (t.feed_score as number | null) ?? 0,
        created_at: t.created_at ?? '',
        updated_at: (t.updated_at as string | null) ?? null,
        subscribed_at: subscribedAtMap[id] ?? '',
      }
    })

  return NextResponse.json({ topics, total: topics.length } satisfies SubscribedTopicsResponse)
}
