import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CorrelatedTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  correlation: number       // −1 to 1
  alignment_rate: number    // 0–1
  shared_voters: number
  direction: 'aligned' | 'opposed'
}

export interface TopicCorrelationsResponse {
  topic_id: string
  correlations: CorrelatedTopic[]
  has_data: boolean
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const topicId = params.id
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '8', 10), 30)
  const supabase = await createClient()

  // Pull a generous number of correlation pairs — we'll filter to this topic
  const { data, error } = await supabase.rpc('get_topic_correlations', {
    p_limit: 200,
    p_min_shared: 3,
    p_category: null,
  })

  if (error) {
    // Function not yet deployed — return empty gracefully
    if (error.code === '42883') {
      return NextResponse.json({
        topic_id: topicId,
        correlations: [],
        has_data: false,
      } satisfies TopicCorrelationsResponse)
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type RawPair = {
    topic_a_id: string
    topic_b_id: string
    shared_voters: string | number
    alignment_rate: number
    correlation: number
    topic_a_statement: string
    topic_a_category: string | null
    topic_a_status: string
    topic_a_blue_pct: number
    topic_a_total_votes: string | number
    topic_b_statement: string
    topic_b_category: string | null
    topic_b_status: string
    topic_b_blue_pct: number
    topic_b_total_votes: string | number
  }

  const rows = (data ?? []) as RawPair[]

  // Filter to pairs that include this topic, then map to the "other" side
  const correlations: CorrelatedTopic[] = rows
    .filter((r) => r.topic_a_id === topicId || r.topic_b_id === topicId)
    .map((r) => {
      const isA = r.topic_a_id === topicId
      return {
        id: isA ? r.topic_b_id : r.topic_a_id,
        statement: isA ? r.topic_b_statement : r.topic_a_statement,
        category: isA ? r.topic_b_category : r.topic_a_category,
        status: isA ? r.topic_b_status : r.topic_a_status,
        blue_pct: isA ? r.topic_b_blue_pct : r.topic_a_blue_pct,
        total_votes: Number(isA ? r.topic_b_total_votes : r.topic_a_total_votes),
        correlation: r.correlation,
        alignment_rate: r.alignment_rate,
        shared_voters: Number(r.shared_voters),
        direction: r.correlation >= 0 ? 'aligned' : 'opposed',
      } satisfies CorrelatedTopic
    })
    // Sort by absolute correlation descending
    .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
    .slice(0, limit)

  return NextResponse.json({
    topic_id: topicId,
    correlations,
    has_data: correlations.length > 0,
  } satisfies TopicCorrelationsResponse)
}
