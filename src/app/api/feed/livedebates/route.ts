import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/livedebates
 *
 * Topics that currently have a live or imminent (starting within 30 min) debate.
 * Ordered by debate start time so the most urgent surfaces first.
 *
 * Distinct from:
 *   /debate           — debate list page
 *   /debate/calendar  — scheduled calendar view
 *   /live             — argument stream
 *
 * Returns topics (with author join) enriched with debate metadata
 * so the feed card can show a "LIVE" or "STARTING SOON" badge.
 *
 * Query params:
 *   offset  – pagination offset (default 0)
 *   limit   – page size (default 20, max 50)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')

  const supabase = await createClient()

  const now = new Date()
  // Include debates starting within the next 30 minutes
  const soonThreshold = new Date(now.getTime() + 30 * 60 * 1000).toISOString()

  // Fetch live and imminent debates ordered by urgency (live first, then soonest)
  const { data: debates, error: debatesErr } = await supabase
    .from('debates')
    .select('id, topic_id, status, scheduled_at, title, debate_type')
    .or(`status.eq.live,and(status.eq.scheduled,scheduled_at.lte.${soonThreshold})`)
    .not('topic_id', 'is', null)
    .order('status', { ascending: false }) // 'live' > 'scheduled' alphabetically — swap below
    .order('scheduled_at', { ascending: true })
    .limit(200)

  if (debatesErr || !debates?.length) {
    // Fallback: return active topics sorted by most-voted
    const { data: fallback } = await supabase
      .from('topics')
      .select(`
        *,
        author:profiles!topics_author_id_fkey(
          id, username, display_name, avatar_url, role, clout
        )
      `)
      .in('status', ['active', 'voting'])
      .order('total_votes', { ascending: false })
      .range(offset, offset + limit - 1)

    return NextResponse.json({
      topics: fallback ?? [],
      hasMore: (fallback?.length ?? 0) >= limit,
    })
  }

  // Sort: live debates first, then by scheduled_at ascending
  const sorted = [...debates].sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1
    if (b.status === 'live' && a.status !== 'live') return 1
    return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  })

  // Deduplicate by topic_id (keep earliest/most-urgent debate per topic)
  const seenTopics = new Set<string>()
  const debateByTopicId: Record<string, typeof debates[number]> = {}
  for (const d of sorted) {
    if (d.topic_id && !seenTopics.has(d.topic_id)) {
      seenTopics.add(d.topic_id)
      debateByTopicId[d.topic_id] = d
    }
  }

  const allTopicIds = Object.keys(debateByTopicId)
  if (allTopicIds.length === 0) {
    return NextResponse.json({ topics: [], hasMore: false })
  }

  const pageIds = allTopicIds.slice(offset, offset + limit)

  const { data: topicsData, error: topicsErr } = await supabase
    .from('topics')
    .select(`
      *,
      author:profiles!topics_author_id_fkey(
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .in('id', pageIds)

  if (topicsErr) {
    return NextResponse.json({ topics: [], hasMore: false }, { status: 500 })
  }

  // Re-order to match the sorted debate order and attach debate metadata
  const topicsById = new Map((topicsData ?? []).map((t) => [t.id, t]))
  const enriched = pageIds
    .map((id) => {
      const topic = topicsById.get(id)
      if (!topic) return null
      const debate = debateByTopicId[id]
      return {
        ...topic,
        _live_debate: {
          id: debate.id,
          status: debate.status,
          scheduled_at: debate.scheduled_at,
          debate_type: debate.debate_type,
          title: debate.title,
        },
      }
    })
    .filter(Boolean)

  return NextResponse.json({
    topics: enriched,
    hasMore: allTopicIds.length > offset + limit,
  })
}
