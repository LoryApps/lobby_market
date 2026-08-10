import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/vortex
 *
 * Topics that are "argument black holes" — highest ratio of argumentation
 * intensity to vote volume. Uses the same scoring formula as /api/vortex
 * but returns paginated standard TopicWithAuthor rows for the main feed.
 *
 * Vortex Score = (arg_count × 12 + unique_arguers × 8 + reply_count × 3)
 *                / log2(total_votes + 2)
 *
 * Distinct from:
 *   /argued      — raw argument count, no voter normalisation
 *   /flashpoint  — high velocity × contestedness, not argument intensity
 *   /livedebates — only topics with scheduled video debates
 *
 * Query params:
 *   offset – pagination offset (default 0)
 *   limit  – page size (default 20, max 50)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')

  const supabase = await createClient()

  const MIN_VOTES = 10
  const MIN_ARGS = 3
  const CANDIDATE_CAP = 2000

  // ── Step 1: Get candidate topic IDs and vote counts ──────────────────────
  const { data: topicRows, error: topicsError } = await supabase
    .from('topics')
    .select('id, total_votes')
    .in('status', ['active', 'voting', 'proposed'])
    .gte('total_votes', MIN_VOTES)
    .order('total_votes', { ascending: false })
    .limit(CANDIDATE_CAP)

  if (topicsError || !topicRows?.length) {
    return NextResponse.json({ topics: [], hasMore: false }, { status: topicsError ? 500 : 200 })
  }

  const topicIds = topicRows.map((t) => t.id)
  const voteMap = new Map(topicRows.map((t) => [t.id, t.total_votes as number]))

  // ── Step 2: Fetch arguments for candidates ────────────────────────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id')
    .in('topic_id', topicIds)

  interface ArgMeta { count: number; userIdSet: Set<string> }
  const argMap = new Map<string, ArgMeta>()
  for (const a of argRows ?? []) {
    let m = argMap.get(a.topic_id)
    if (!m) { m = { count: 0, userIdSet: new Set() }; argMap.set(a.topic_id, m) }
    m.count++
    if (a.user_id) m.userIdSet.add(a.user_id)
  }

  // ── Step 3: Fetch reply counts for candidates ─────────────────────────────
  const { data: replyRows } = await supabase
    .from('argument_replies')
    .select('topic_id')
    .in('topic_id', topicIds)

  const replyMap = new Map<string, number>()
  for (const r of replyRows ?? []) {
    replyMap.set(r.topic_id, (replyMap.get(r.topic_id) ?? 0) + 1)
  }

  // ── Step 4: Score and rank ────────────────────────────────────────────────
  interface Scored { id: string; score: number }
  const scored: Scored[] = []

  for (const [tid, meta] of argMap.entries()) {
    if (meta.count < MIN_ARGS) continue
    const votes = Math.max(voteMap.get(tid) ?? 1, 1)
    const replies = replyMap.get(tid) ?? 0
    const numerator = meta.count * 12 + meta.userIdSet.size * 8 + replies * 3
    const score = numerator / Math.log2(votes + 2)
    scored.push({ id: tid, score })
  }

  if (scored.length === 0) {
    return NextResponse.json({ topics: [], hasMore: false })
  }

  scored.sort((a, b) => b.score - a.score)

  const totalQualified = scored.length
  const page = scored.slice(offset, offset + limit)

  if (page.length === 0) {
    return NextResponse.json({ topics: [], hasMore: false })
  }

  // ── Step 5: Fetch full rows with author for paginated slice ───────────────
  const pageIds = page.map((s) => s.id)

  const { data: fullTopics, error: fullError } = await supabase
    .from('topics')
    .select(`
      *,
      author:profiles!topics_author_id_fkey(
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .in('id', pageIds)

  if (fullError || !fullTopics) {
    return NextResponse.json({ topics: [], hasMore: false }, { status: 500 })
  }

  // Restore vortex-score order
  const fullMap = new Map(fullTopics.map((t) => [t.id, t]))
  const enriched = page
    .map(({ id, score }) => {
      const topic = fullMap.get(id)
      if (!topic) return null
      return { ...topic, _vortex_score: Math.round(score * 10) / 10 }
    })
    .filter(Boolean)

  return NextResponse.json({
    topics: enriched,
    hasMore: totalQualified > offset + limit,
  })
}
