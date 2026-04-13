import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/topics/[id]/related
 *
 * Returns up to 4 related topics for a given topic.
 *
 * Relevance strategy:
 *  1. Same category, any active/proposed/voting/law status, ordered by feed_score
 *  2. If fewer than 4 results, fill with high-score topics from any category
 *
 * Excludes: the current topic, failed/archived/continued topics
 * Does NOT require authentication.
 */
export const dynamic = 'force-dynamic'

const VISIBLE_STATUSES = ['proposed', 'active', 'voting', 'law'] as const

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const topicId = params.id

  // Fetch the source topic to get its category
  const { data: source } = await supabase
    .from('topics')
    .select('category, statement')
    .eq('id', topicId)
    .single()

  const category = source?.category ?? null

  type TopicRow = {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    feed_score: number
  }

  const results: TopicRow[] = []

  // Step 1: same-category topics
  if (category) {
    const { data: sameCategory } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score')
      .eq('category', category)
      .in('status', VISIBLE_STATUSES)
      .neq('id', topicId)
      .order('feed_score', { ascending: false })
      .limit(4)

    for (const t of sameCategory ?? []) {
      results.push(t as TopicRow)
    }
  }

  // Step 2: fill up to 4 with high-score topics from any category
  if (results.length < 4) {
    const exclude = [topicId, ...results.map((r) => r.id)]
    const needed = 4 - results.length

    const { data: topPicks } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score')
      .in('status', VISIBLE_STATUSES)
      .not('id', 'in', `(${exclude.map((id) => `'${id}'`).join(',')})`)
      .order('feed_score', { ascending: false })
      .limit(needed)

    for (const t of topPicks ?? []) {
      results.push(t as TopicRow)
    }
  }

  return NextResponse.json({ topics: results.slice(0, 4) })
}
