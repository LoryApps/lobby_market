import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/groundswell
 *
 * Topics that were quiet but are suddenly attracting a burst of engagement.
 * Revival rate = votes in last 24h / avg daily votes in prior 7 days.
 * Topics with 2.5x+ their baseline rate surface here.
 *
 * Distinct from:
 *   /momentum  — absolute vote velocity (already loud topics staying loud)
 *   /rising    — new topics gaining traction
 *   /flux      — consensus shifting direction
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

  const now = Date.now()
  const window24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const window8d = new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString()

  const MIN_RECENT_VOTES = 5
  const MIN_REVIVAL_RATE = 2.5

  // Fetch votes in last 24h
  const { data: recentVotes, error: recentErr } = await supabase
    .from('votes')
    .select('topic_id')
    .gte('created_at', window24h)
    .limit(40000)

  if (recentErr || !recentVotes?.length) {
    // Fallback: return active topics by total_votes
    const { data: fallback } = await supabase
      .from('topics')
      .select(`
        *,
        author:profiles!topics_author_id_fkey(
          id, username, display_name, avatar_url, role, clout
        )
      `)
      .in('status', ['active', 'voting', 'proposed'])
      .order('total_votes', { ascending: false })
      .range(offset, offset + limit - 1)

    return NextResponse.json({ topics: fallback ?? [], hasMore: (fallback?.length ?? 0) >= limit })
  }

  // Fetch votes 2–8 days ago (prior baseline)
  const { data: priorVotes } = await supabase
    .from('votes')
    .select('topic_id')
    .gte('created_at', window8d)
    .lt('created_at', window24h)
    .limit(100000)

  // Count recent and prior votes per topic
  const recent24hMap: Record<string, number> = {}
  for (const v of recentVotes) {
    recent24hMap[v.topic_id] = (recent24hMap[v.topic_id] ?? 0) + 1
  }

  const prior7dMap: Record<string, number> = {}
  for (const v of priorVotes ?? []) {
    prior7dMap[v.topic_id] = (prior7dMap[v.topic_id] ?? 0) + 1
  }

  // Find topics with significant revival rate
  type Candidate = { id: string; revival_rate: number }
  const candidates: Candidate[] = Object.entries(recent24hMap)
    .filter(([, votes24h]) => votes24h >= MIN_RECENT_VOTES)
    .map(([id, votes24h]) => {
      const prior7d = prior7dMap[id] ?? 0
      const baselineDaily = prior7d / 7
      const rate = baselineDaily < 0.5 ? votes24h * 2 : votes24h / baselineDaily
      return { id, revival_rate: rate }
    })
    .filter((c) => c.revival_rate >= MIN_REVIVAL_RATE)
    .sort((a, b) => b.revival_rate - a.revival_rate)

  if (candidates.length === 0) {
    // Fallback: return active topics by total_votes
    const { data: fallback } = await supabase
      .from('topics')
      .select(`
        *,
        author:profiles!topics_author_id_fkey(
          id, username, display_name, avatar_url, role, clout
        )
      `)
      .in('status', ['active', 'voting', 'proposed'])
      .order('total_votes', { ascending: false })
      .range(offset, offset + limit - 1)

    return NextResponse.json({ topics: fallback ?? [], hasMore: (fallback?.length ?? 0) >= limit })
  }

  const page = candidates.slice(offset, offset + limit)
  const topicIds = page.map((c) => c.id)

  const { data: topicsData, error: topicsErr } = await supabase
    .from('topics')
    .select(`
      *,
      author:profiles!topics_author_id_fkey(
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .in('id', topicIds)

  if (topicsErr) {
    return NextResponse.json({ topics: [], hasMore: false }, { status: 500 })
  }

  const topicsById = new Map((topicsData ?? []).map((t) => [t.id, t]))
  const topics = page
    .map(({ id, revival_rate }) => {
      const t = topicsById.get(id)
      if (!t) return null
      return { ...t, _revival_rate: revival_rate }
    })
    .filter(Boolean)

  return NextResponse.json({
    topics,
    hasMore: candidates.length > offset + limit,
  })
}
