import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CorrelationPair {
  topic_a_id: string
  topic_b_id: string
  shared_voters: number
  both_blue: number
  both_red: number
  alignment_rate: number       // 0–1: fraction who voted same side on both
  correlation: number          // −1 to 1
  topic_a_statement: string
  topic_a_category: string | null
  topic_a_status: string
  topic_a_blue_pct: number
  topic_a_total_votes: number
  topic_b_statement: string
  topic_b_category: string | null
  topic_b_status: string
  topic_b_blue_pct: number
  topic_b_total_votes: number
}

export interface CorrelationsResponse {
  pairs: CorrelationPair[]
  total_topics_analyzed: number
  category: string | null
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 60)
  const minShared = Math.max(parseInt(searchParams.get('min_shared') ?? '5', 10), 3)

  const supabase = await createClient()

  // Count how many popular topics exist for context
  let topicsQuery = supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .gte('total_votes', 10)
  if (category) topicsQuery = topicsQuery.eq('category', category)
  const { count: topicCount } = await topicsQuery

  // Call the SQL function
  const { data, error } = await supabase.rpc('get_topic_correlations', {
    p_limit: limit,
    p_min_shared: minShared,
    p_category: category,
  })

  if (error) {
    // If the function doesn't exist yet (migration not run), return empty gracefully
    if (error.code === '42883') {
      return NextResponse.json({
        pairs: [],
        total_topics_analyzed: topicCount ?? 0,
        category,
      } satisfies CorrelationsResponse)
    }
    console.error('[correlations]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const pairs: CorrelationPair[] = (data ?? []).map(
    (row: {
      topic_a_id: string
      topic_b_id: string
      shared_voters: string | number
      both_blue: string | number
      both_red: string | number
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
    }) => ({
      topic_a_id: row.topic_a_id,
      topic_b_id: row.topic_b_id,
      shared_voters: Number(row.shared_voters),
      both_blue: Number(row.both_blue),
      both_red: Number(row.both_red),
      alignment_rate: row.alignment_rate,
      correlation: row.correlation,
      topic_a_statement: row.topic_a_statement,
      topic_a_category: row.topic_a_category,
      topic_a_status: row.topic_a_status,
      topic_a_blue_pct: row.topic_a_blue_pct,
      topic_a_total_votes: Number(row.topic_a_total_votes),
      topic_b_statement: row.topic_b_statement,
      topic_b_category: row.topic_b_category,
      topic_b_status: row.topic_b_status,
      topic_b_blue_pct: row.topic_b_blue_pct,
      topic_b_total_votes: Number(row.topic_b_total_votes),
    })
  )

  return NextResponse.json({
    pairs,
    total_topics_analyzed: topicCount ?? 0,
    category,
  } satisfies CorrelationsResponse)
}
