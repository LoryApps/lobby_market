import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/stalled
 *
 * Debates that were actively voted on in the 5-30 day window but have
 * received NO new votes in the last 5 days. These are the "forgotten debates"
 * — topics that had real momentum and then went completely silent.
 *
 * Unlike "elders" (simply old), stalled topics are defined by an activity gap:
 * they were alive, then someone pulled the plug. The community moved on without
 * reaching a verdict.
 *
 * Algorithm:
 *   1. Fetch votes cast 5-30 days ago (the stalled window)
 *   2. Fetch votes cast in the last 5 days (still-active topics)
 *   3. Stalled candidates = active window − still-active window
 *   4. Filter to status 'proposed' | 'active' with total_votes >= 15
 *   5. Sort by stalled_vote_count DESC (most abandoned debates first)
 *
 * Query params:
 *   offset  – pagination offset (default 0)
 *   limit   – page size (default 20, max 50)
 *   sort    – "top" (most abandoned) | "new" (most recently stalled) | "hot"
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get('limit') ?? '20'), 50)
  const offset = Number(searchParams.get('offset') ?? '0')
  const sort = searchParams.get('sort') ?? 'top'

  const supabase = await createClient()

  const now = Date.now()
  const ms5d  = 5  * 24 * 60 * 60 * 1000
  const ms30d = 30 * 24 * 60 * 60 * 1000

  const since30d = new Date(now - ms30d).toISOString()
  const since5d  = new Date(now - ms5d).toISOString()

  // ── Step 1: Topics with votes in the stalled window (5-30 days ago) ────────
  const { data: stalledVotes, error: stalledErr } = await supabase
    .from('votes')
    .select('topic_id, created_at')
    .gte('created_at', since30d)
    .lt('created_at', since5d)
    .limit(50000)

  if (stalledErr || !stalledVotes?.length) {
    return NextResponse.json({ topics: [], hasMore: false, total: 0 })
  }

  // ── Step 2: Topics still receiving votes (last 5 days) ─────────────────────
  const { data: activeVotes } = await supabase
    .from('votes')
    .select('topic_id')
    .gte('created_at', since5d)
    .limit(50000)

  const activeTopicIds = new Set((activeVotes ?? []).map(v => v.topic_id as string))

  // ── Step 3: Count stalled votes per topic (excluding still-active) ─────────
  interface StalledEntry { count: number; latestVoteAt: string }
  const stalledMap = new Map<string, StalledEntry>()

  for (const v of stalledVotes) {
    const tid = v.topic_id as string
    if (activeTopicIds.has(tid)) continue  // still active — skip
    const existing = stalledMap.get(tid) ?? { count: 0, latestVoteAt: '' }
    existing.count++
    if (!existing.latestVoteAt || v.created_at > existing.latestVoteAt) {
      existing.latestVoteAt = v.created_at as string
    }
    stalledMap.set(tid, existing)
  }

  if (!stalledMap.size) {
    return NextResponse.json({ topics: [], hasMore: false, total: 0 })
  }

  // ── Step 4: Sort candidates ────────────────────────────────────────────────
  const sortedEntries = [...stalledMap.entries()].sort((a, b) => {
    if (sort === 'new') {
      return b[1].latestVoteAt.localeCompare(a[1].latestVoteAt)
    }
    // 'top' or 'hot': most abandoned (highest stalled vote count)
    return b[1].count - a[1].count
  })

  const total = sortedEntries.length
  const pageEntries = sortedEntries.slice(offset, offset + limit)
  const pageTopicIds = pageEntries.map(([id]) => id)

  if (!pageTopicIds.length) {
    return NextResponse.json({ topics: [], hasMore: false, total })
  }

  // ── Step 5: Fetch topic details ────────────────────────────────────────────
  const { data: rawTopics, error: topicsErr } = await supabase
    .from('topics')
    .select('*, author:profiles!author_id(id, username, display_name, avatar_url, role)')
    .in('id', pageTopicIds)
    .in('status', ['proposed', 'active'])
    .gte('total_votes', 15)

  if (topicsErr || !rawTopics) {
    return NextResponse.json({ topics: [], hasMore: false, total: 0 })
  }

  // Rebuild in the sorted order and attach stalled metadata
  const topicMap = new Map(rawTopics.map(t => [t.id as string, t]))
  const topics = pageTopicIds
    .map(id => {
      const t = topicMap.get(id)
      if (!t) return null
      const entry = stalledMap.get(id)!
      const daysSilent = Math.floor(
        (now - new Date(entry.latestVoteAt).getTime()) / (24 * 60 * 60 * 1000)
      )
      return {
        ...t,
        _stalled_vote_count: entry.count,
        _stalled_last_vote_at: entry.latestVoteAt,
        _stalled_days_silent: daysSilent,
      }
    })
    .filter(Boolean)

  return NextResponse.json({
    topics,
    hasMore: offset + limit < total,
    total,
  })
}
