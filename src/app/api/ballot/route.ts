import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface BallotTopic {
  id: string
  statement: string
  description: string | null
  category: string | null
  scope: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
}

export interface BallotResponse {
  topics: BallotTopic[]
  total: number
  authenticated: boolean
}

const COLS =
  'id, statement, description, category, scope, status, blue_pct, total_votes, created_at'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch active + voting topics
  let query = supabase
    .from('topics')
    .select(COLS)
    .in('status', ['active', 'voting'])
    .order('feed_score', { ascending: false })
    .limit(50)

  if (user) {
    // Exclude topics the user has already voted on
    const { data: voted } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)

    const votedIds = (voted ?? []).map((v) => v.topic_id)

    if (votedIds.length > 0) {
      query = query.not('id', 'in', `(${votedIds.join(',')})`)
    }
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    topics: data ?? [],
    total: (data ?? []).length,
    authenticated: !!user,
  } satisfies BallotResponse)
}
