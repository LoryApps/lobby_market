import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/topics/[id]/next
 *
 * Returns the next unvoted active/voting topic for the authenticated user,
 * preferring topics in the same category as the source topic.
 *
 * Priority:
 *  1. Same category, ordered by feed_score desc
 *  2. Any category, ordered by feed_score desc
 *
 * Returns 204 when no unvoted topics remain.
 * Returns 401 when the user is not authenticated (can't know what they've voted on).
 */
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const topicId = params.id

  // Get source topic's category
  const { data: source } = await supabase
    .from('topics')
    .select('category')
    .eq('id', topicId)
    .single()

  const category = source?.category ?? null

  // Get IDs of topics the user has already voted on (limit 2000 to avoid huge payloads)
  const { data: votedRows } = await supabase
    .from('votes')
    .select('topic_id')
    .eq('user_id', user.id)
    .limit(2000)

  const votedIds = new Set<string>((votedRows ?? []).map((r: { topic_id: string }) => r.topic_id))
  votedIds.add(topicId) // exclude current topic

  type TopicRow = { id: string; statement: string; category: string | null }

  const tryFetch = async (extra: Record<string, string | null> = {}) => {
    let query = supabase
      .from('topics')
      .select('id, statement, category')
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(50)

    if (extra.category) {
      query = query.eq('category', extra.category)
    }

    const { data } = await query
    const rows = (data ?? []) as TopicRow[]
    return rows.find((r) => !votedIds.has(r.id)) ?? null
  }

  // Prefer same-category unvoted topic
  const next = category
    ? (await tryFetch({ category })) ?? (await tryFetch())
    : await tryFetch()

  if (!next) {
    return new NextResponse(null, { status: 204 })
  }

  return NextResponse.json({ topic: { id: next.id, statement: next.statement, category: next.category } })
}
