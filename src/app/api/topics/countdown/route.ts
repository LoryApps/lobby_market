import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CountdownTopic {
  id: string
  statement: string
  category: string | null
  scope: string
  blue_pct: number
  total_votes: number
  voting_ends_at: string
  voting_duration_hours: number
  user_vote: 'blue' | 'red' | null
}

export interface CountdownResponse {
  topics: CountdownTopic[]
  stats: {
    critical: number  // < 6h
    urgent: number    // 6–24h
    active: number    // 24–48h
    extended: number  // > 48h
    total: number
  }
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch voting-phase topics with a deadline
  const { data: rows, error } = await supabase
    .from('topics')
    .select('id, statement, category, scope, blue_pct, total_votes, voting_ends_at, voting_duration_hours')
    .eq('status', 'voting')
    .not('voting_ends_at', 'is', null)
    .order('voting_ends_at', { ascending: true })
    .limit(60)

  if (error) {
    return NextResponse.json({ topics: [], stats: { critical: 0, urgent: 0, active: 0, extended: 0, total: 0 } })
  }

  const topics = (rows ?? []) as Omit<CountdownTopic, 'user_vote'>[]

  // Fetch the current user's votes for these topics
  const voteMap = new Map<string, 'blue' | 'red'>()
  if (user && topics.length > 0) {
    const topicIds = topics.map((t) => t.id)
    const { data: votes } = await supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .in('topic_id', topicIds)

    if (votes) {
      for (const v of votes) {
        voteMap.set(v.topic_id, v.side as 'blue' | 'red')
      }
    }
  }

  const enriched: CountdownTopic[] = topics.map((t) => ({
    ...t,
    user_vote: voteMap.get(t.id) ?? null,
  }))

  // Compute stats by time bucket
  const now = Date.now()
  const stats = { critical: 0, urgent: 0, active: 0, extended: 0, total: enriched.length }
  for (const t of enriched) {
    const ms = new Date(t.voting_ends_at).getTime() - now
    if (ms <= 0) continue
    const h = ms / 3_600_000
    if (h < 6) stats.critical++
    else if (h < 24) stats.urgent++
    else if (h < 48) stats.active++
    else stats.extended++
  }

  return NextResponse.json({ topics: enriched, stats })
}
