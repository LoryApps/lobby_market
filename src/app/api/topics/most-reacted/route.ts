import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VALID_REACTIONS = ['insightful', 'controversial', 'complex', 'surprising'] as const
type ReactionType = (typeof VALID_REACTIONS)[number]

function isReaction(v: unknown): v is ReactionType {
  return typeof v === 'string' && (VALID_REACTIONS as readonly string[]).includes(v)
}

export interface ReactionSummary {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  reactions: Record<ReactionType, number>
  total_reactions: number
}

// GET /api/topics/most-reacted?reaction=controversial&limit=20
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl
  const filterReaction = searchParams.get('reaction')
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10))

  // Fetch all reactions with topic info
  const { data: reactionRows, error } = await supabase
    .from('topic_reactions')
    .select('topic_id, reaction')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aggregate by topic
  const topicReactionMap = new Map<
    string,
    Record<ReactionType, number>
  >()

  for (const row of reactionRows ?? []) {
    if (!isReaction(row.reaction)) continue
    if (!topicReactionMap.has(row.topic_id)) {
      topicReactionMap.set(row.topic_id, {
        insightful: 0,
        controversial: 0,
        complex: 0,
        surprising: 0,
      })
    }
    const counts = topicReactionMap.get(row.topic_id)!
    counts[row.reaction]++
  }

  if (topicReactionMap.size === 0) {
    return NextResponse.json({ topics: [] })
  }

  // Sort by the requested reaction (or total)
  const topicIds = Array.from(topicReactionMap.keys())

  // Filter and sort
  const sorted = topicIds
    .map((id) => ({
      id,
      counts: topicReactionMap.get(id)!,
      total: Object.values(topicReactionMap.get(id)!).reduce((a, b) => a + b, 0),
    }))
    .filter((t) => {
      if (filterReaction && isReaction(filterReaction)) {
        return t.counts[filterReaction] > 0
      }
      return t.total > 0
    })
    .sort((a, b) => {
      if (filterReaction && isReaction(filterReaction)) {
        return b.counts[filterReaction] - a.counts[filterReaction]
      }
      return b.total - a.total
    })
    .slice(0, limit)

  if (sorted.length === 0) {
    return NextResponse.json({ topics: [] })
  }

  // Fetch topic details
  const ids = sorted.map((t) => t.id)
  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', ids)

  const topicMap = new Map((topics ?? []).map((t) => [t.id, t]))

  const result: ReactionSummary[] = sorted
    .filter((t) => topicMap.has(t.id))
    .map((t) => ({
      topic_id: t.id,
      statement: topicMap.get(t.id)!.statement,
      category: topicMap.get(t.id)!.category,
      status: topicMap.get(t.id)!.status,
      blue_pct: topicMap.get(t.id)!.blue_pct,
      total_votes: topicMap.get(t.id)!.total_votes,
      reactions: t.counts,
      total_reactions: t.total,
    }))

  return NextResponse.json({ topics: result })
}
