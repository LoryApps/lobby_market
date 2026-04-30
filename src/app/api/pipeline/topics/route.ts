import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PipelineTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string
  blue_pct: number
  total_votes: number
  support_count: number
  activation_threshold: number
  voting_ends_at: string | null
  feed_score: number
  created_at: string
}

export interface PipelineResponse {
  topics: PipelineTopic[]
  counts: Record<string, number>
}

/**
 * GET /api/pipeline/topics
 *
 * Returns all non-archived/continued topics for the pipeline board,
 * ordered by feed_score descending within each status group.
 * Caps at 200 topics total to keep the board navigable.
 */
export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select(
      'id, statement, category, status, scope, blue_pct, total_votes, support_count, activation_threshold, voting_ends_at, feed_score, created_at'
    )
    .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
    .order('feed_score', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch pipeline data' },
      { status: 500 }
    )
  }

  const topics = (data ?? []) as PipelineTopic[]

  const counts: Record<string, number> = {}
  for (const t of topics) {
    counts[t.status] = (counts[t.status] ?? 0) + 1
  }

  return NextResponse.json({ topics, counts } satisfies PipelineResponse)
}
