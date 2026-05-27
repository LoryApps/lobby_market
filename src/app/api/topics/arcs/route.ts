import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArcPoint {
  day: string
  cumulative_blue: number
  cumulative_total: number
  pct: number
}

export interface TopicArc {
  id: string
  statement: string
  category: string | null
  status: string
  final_blue_pct: number
  total_votes: number
  created_at: string
  resolved_at: string | null
  arc: ArcPoint[]
}

export interface ArcsResponse {
  topics: TopicArc[]
  category: string | null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl
  const category = searchParams.get('category') || null

  // Fetch top resolved topics (law or failed) ordered by vote count
  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at, updated_at')
    .in('status', ['law', 'failed'])
    .gte('total_votes', 10)
    .order('total_votes', { ascending: false })
    .limit(12)

  if (category) {
    topicsQuery = topicsQuery.eq('category', category)
  }

  const { data: topicsRaw } = await topicsQuery
  const topics = topicsRaw ?? []

  if (topics.length === 0) {
    return NextResponse.json({ topics: [], category } satisfies ArcsResponse)
  }

  // For each topic, fetch daily vote snapshot
  const topicIds = topics.map((t) => t.id)

  const { data: votesRaw } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .in('topic_id', topicIds)
    .order('created_at', { ascending: true })

  const votes = votesRaw ?? []

  // Group votes by (topic_id, day)
  const votesByTopicDay: Map<string, Map<string, { blue: number; total: number }>> = new Map()

  for (const vote of votes) {
    const day = vote.created_at.slice(0, 10)
    if (!votesByTopicDay.has(vote.topic_id)) {
      votesByTopicDay.set(vote.topic_id, new Map())
    }
    const dayMap = votesByTopicDay.get(vote.topic_id)!
    if (!dayMap.has(day)) {
      dayMap.set(day, { blue: 0, total: 0 })
    }
    const bucket = dayMap.get(day)!
    bucket.total++
    if (vote.side === 'blue') bucket.blue++
  }

  // Build arc for each topic
  const result: TopicArc[] = topics.map((topic) => {
    const dayMap = votesByTopicDay.get(topic.id)
    const arc: ArcPoint[] = []

    if (dayMap && dayMap.size > 0) {
      const days = Array.from(dayMap.keys()).sort()
      let cumBlue = 0
      let cumTotal = 0

      for (const day of days) {
        const bucket = dayMap.get(day)!
        cumBlue += bucket.blue
        cumTotal += bucket.total
        arc.push({
          day,
          cumulative_blue: cumBlue,
          cumulative_total: cumTotal,
          pct: cumTotal > 0 ? Math.round((cumBlue / cumTotal) * 1000) / 10 : 50,
        })
      }
    }

    // Resolved_at approximation: use updated_at for resolved topics
    const resolvedAt = topic.status === 'law' || topic.status === 'failed'
      ? (topic.updated_at as string | null)
      : null

    return {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      final_blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
      created_at: topic.created_at,
      resolved_at: resolvedAt,
      arc,
    }
  })

  return NextResponse.json({ topics: result, category } satisfies ArcsResponse)
}
