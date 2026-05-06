import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/topics/[id]/related
 *
 * Returns up to 5 related topics for a given topic.
 *
 * Relevance strategy (in priority order):
 *  1. Tag overlap — topics sharing the most tags with the source topic
 *  2. Same category fallback — high feed_score topics in the same category
 *  3. Global fallback — any high-score topics to fill remaining slots
 *
 * The response includes `shared_tags` (string[]) on each result so the
 * UI can display which tags caused the match.
 *
 * Excludes: the current topic, failed/archived/continued topics.
 * Does NOT require authentication.
 */
export const dynamic = 'force-dynamic'

const VISIBLE_STATUSES = ['proposed', 'active', 'voting', 'law'] as const
const MAX_RESULTS = 5

export interface RelatedTopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  shared_tags: string[]
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const topicId = params.id

  // Fetch the source topic's category and tags
  const { data: source } = await supabase
    .from('topics')
    .select('category, tags')
    .eq('id', topicId)
    .single()

  const category = source?.category ?? null
  const sourceTags: string[] = source?.tags ?? []

  type TopicRow = {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    feed_score: number
    tags: string[]
  }

  const seen = new Set<string>([topicId])
  const results: (TopicRow & { shared_tags: string[] })[] = []

  // ── Step 1: tag-matched topics ──────────────────────────────────────────────
  if (sourceTags.length > 0) {
    // Fetch candidate topics that share at least one tag using the overlap
    // operator (&&). PostgREST exposes this as the 'ov' filter.
    const tagFilter = `{${sourceTags.join(',')}}`
    const { data: tagMatches } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score, tags')
      .filter('tags', 'ov', tagFilter)
      .in('status', VISIBLE_STATUSES)
      .neq('id', topicId)
      .order('feed_score', { ascending: false })
      .limit(20)

    if (tagMatches) {
      // Score by number of shared tags (descending), then feed_score
      const scored = (tagMatches as TopicRow[])
        .map((t) => {
          const shared = (t.tags ?? []).filter((tag) => sourceTags.includes(tag))
          return { ...t, shared_tags: shared, _score: shared.length * 1000 + (t.feed_score ?? 0) }
        })
        .sort((a, b) => b._score - a._score)

      for (const t of scored) {
        if (results.length >= MAX_RESULTS) break
        if (!seen.has(t.id)) {
          seen.add(t.id)
          results.push(t)
        }
      }
    }
  }

  // ── Step 2: same-category fallback ─────────────────────────────────────────
  if (results.length < MAX_RESULTS && category) {
    const needed = MAX_RESULTS - results.length
    const { data: sameCategory } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score, tags')
      .eq('category', category)
      .in('status', VISIBLE_STATUSES)
      .neq('id', topicId)
      .order('feed_score', { ascending: false })
      .limit(needed + seen.size)

    for (const t of (sameCategory ?? []) as TopicRow[]) {
      if (results.length >= MAX_RESULTS) break
      if (!seen.has(t.id)) {
        seen.add(t.id)
        const shared = (t.tags ?? []).filter((tag) => sourceTags.includes(tag))
        results.push({ ...t, shared_tags: shared })
      }
    }
  }

  // ── Step 3: global high-score fallback ─────────────────────────────────────
  if (results.length < MAX_RESULTS) {
    const needed = MAX_RESULTS - results.length
    const { data: topPicks } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score, tags')
      .in('status', VISIBLE_STATUSES)
      .order('feed_score', { ascending: false })
      .limit(needed + seen.size + 10)

    for (const t of (topPicks ?? []) as TopicRow[]) {
      if (results.length >= MAX_RESULTS) break
      if (!seen.has(t.id)) {
        seen.add(t.id)
        const shared = (t.tags ?? []).filter((tag) => sourceTags.includes(tag))
        results.push({ ...t, shared_tags: shared })
      }
    }
  }

  const output: RelatedTopicResult[] = results.slice(0, MAX_RESULTS).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    blue_pct: t.blue_pct,
    total_votes: t.total_votes,
    shared_tags: t.shared_tags,
  }))

  return NextResponse.json({ topics: output })
}
