import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface RapidTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string
}

export interface RapidResponse {
  topics: RapidTopic[]
  authenticated: boolean
}

/**
 * GET /api/rapid
 *
 * Returns a batch of active/voting topics the current user hasn't voted on yet,
 * ordered by feed_score desc. For anonymous users, returns random active topics
 * without filtering by vote history.
 *
 * Query params:
 *   limit    — number of topics to return (default 15, max 30)
 *   category — optional category filter
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '15', 10), 30)
  const category = searchParams.get('category') || null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let topics: RapidTopic[] = []

  if (user) {
    // Fetch topics the user hasn't voted on yet
    const { data: votedRows } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)

    const votedIds = (votedRows ?? []).map((v) => v.topic_id as string)

    let query = supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, scope')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(limit + votedIds.length + 20) // over-fetch to filter

    if (category) query = query.eq('category', category)

    const { data } = await query
    const rows = (data ?? []) as RapidTopic[]

    topics = rows
      .filter((t) => !votedIds.includes(t.id))
      .slice(0, limit)

    // If we don't have enough unvoted topics, pad with proposed ones
    if (topics.length < Math.min(5, limit)) {
      const { data: proposed } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, scope')
        .eq('status', 'proposed')
        .not('id', 'in', `(${[...votedIds, ...topics.map((t) => t.id)].join(',') || 'null'})`)
        .order('feed_score', { ascending: false })
        .limit(limit - topics.length)

      topics = [...topics, ...((proposed ?? []) as RapidTopic[])]
    }
  } else {
    // Anonymous: just return top active topics
    let query = supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, scope')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(limit)

    if (category) query = query.eq('category', category)

    const { data } = await query
    topics = (data ?? []) as RapidTopic[]
  }

  return NextResponse.json({
    topics,
    authenticated: !!user,
  } satisfies RapidResponse)
}
