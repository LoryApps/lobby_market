import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/comeback
 *
 * Topics that went dormant (no votes for 48h+ within the last 30 days)
 * but have received fresh votes in the last 24 hours.
 * These are "revival debates" — the civic conversation came back.
 *
 * Algorithm:
 *   1. Find topics with recent votes in the last 24h (the "revived" window)
 *   2. For each of those, find the gap before the latest burst:
 *      check if there were NO votes in the 48h preceding the revival
 *   3. Filter to status 'proposed' | 'active' with total_votes >= 10
 *   4. Sort by revival_votes DESC (most-revived first) or by revival time
 *
 * Query params:
 *   offset – pagination offset (default 0)
 *   limit  – page size (default 20, max 50)
 *   sort   – "top" (most revival votes) | "new" (most recently revived) | "hot"
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  const sort = searchParams.get('sort') ?? 'top'

  const supabase = await createClient()

  const now = Date.now()
  const ms24h = 24 * 60 * 60 * 1000
  const ms72h = 72 * 60 * 60 * 1000
  const ms30d = 30 * 24 * 60 * 60 * 1000

  const since24h = new Date(now - ms24h).toISOString()
  const since72h = new Date(now - ms72h).toISOString()
  const since30d = new Date(now - ms30d).toISOString()

  // ── Step 1: Topics that received votes in the last 24h (fresh activity) ────
  const { data: recentVotes, error: recentErr } = await supabase
    .from('votes')
    .select('topic_id, created_at')
    .gte('created_at', since24h)
    .limit(50000)

  if (recentErr || !recentVotes?.length) {
    return NextResponse.json({ topics: [], hasMore: false, total: 0 })
  }

  // Count revival votes per topic and track the earliest revival vote
  interface RevivalEntry { count: number; firstRevivalAt: string }
  const revivalMap = new Map<string, RevivalEntry>()

  for (const v of recentVotes) {
    const tid = v.topic_id as string
    const ex = revivalMap.get(tid) ?? { count: 0, firstRevivalAt: v.created_at as string }
    ex.count++
    if ((v.created_at as string) < ex.firstRevivalAt) ex.firstRevivalAt = v.created_at as string
    revivalMap.set(tid, ex)
  }

  const candidates = [...revivalMap.keys()]
  if (!candidates.length) {
    return NextResponse.json({ topics: [], hasMore: false, total: 0 })
  }

  // ── Step 2: Among candidates, find ones that had a silence gap ───────────
  // Check if there were votes in the 48h-72h window before the revival
  // (i.e., votes between 72h ago and 24h ago — the "silence window")
  const { data: silenceVotes } = await supabase
    .from('votes')
    .select('topic_id')
    .in('topic_id', candidates)
    .gte('created_at', since72h)
    .lt('created_at', since24h)
    .limit(50000)

  const silenceSet = new Set((silenceVotes ?? []).map(v => v.topic_id as string))

  // Also verify these topics had previous activity (votes 3-30 days ago)
  // to confirm there was something to "come back" from
  const since3d = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString()

  const { data: historicVotes } = await supabase
    .from('votes')
    .select('topic_id')
    .in('topic_id', candidates)
    .gte('created_at', since30d)
    .lt('created_at', since3d)
    .limit(50000)

  const historicSet = new Set((historicVotes ?? []).map(v => v.topic_id as string))

  // A comeback topic: had historic activity + NO votes in the 48-72h silence window
  const comebackIds = candidates.filter(
    (id) => historicSet.has(id) && !silenceSet.has(id)
  )

  if (!comebackIds.length) {
    return NextResponse.json({ topics: [], hasMore: false, total: 0 })
  }

  // ── Step 3: Sort candidates ──────────────────────────────────────────────
  const sortedEntries = comebackIds
    .map((id) => ({ id, entry: revivalMap.get(id)! }))
    .sort((a, b) => {
      if (sort === 'new') {
        return b.entry.firstRevivalAt.localeCompare(a.entry.firstRevivalAt)
      }
      // 'top' or 'hot': most revival votes first
      return b.entry.count - a.entry.count
    })

  const total = sortedEntries.length
  const pageEntries = sortedEntries.slice(offset, offset + limit)
  const pageIds = pageEntries.map((e) => e.id)

  if (!pageIds.length) {
    return NextResponse.json({ topics: [], hasMore: false, total })
  }

  // ── Step 4: Fetch topic details ──────────────────────────────────────────
  const { data: rawTopics, error: topicsErr } = await supabase
    .from('topics')
    .select('*, author:profiles!author_id(id, username, display_name, avatar_url, role)')
    .in('id', pageIds)
    .in('status', ['proposed', 'active', 'voting'])
    .gte('total_votes', 10)

  if (topicsErr || !rawTopics) {
    return NextResponse.json({ topics: [], hasMore: false, total: 0 })
  }

  // Rebuild in sorted order and attach comeback metadata
  const topicMap = new Map(rawTopics.map((t) => [t.id as string, t]))
  const topics = pageIds
    .map((id) => {
      const t = topicMap.get(id)
      if (!t) return null
      const entry = revivalMap.get(id)!
      return {
        ...t,
        _comeback_vote_count: entry.count,
        _comeback_revived_at: entry.firstRevivalAt,
      }
    })
    .filter(Boolean)

  return NextResponse.json({
    topics,
    hasMore: offset + limit < total,
    total,
  })
}
