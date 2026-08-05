import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/swing
 *
 * Topics where the most recent votes (last 6 hours) are going in the
 * OPPOSITE direction to the overall established consensus. These are
 * debates where public sentiment is actively reversing.
 *
 * Swing score = |recent_blue_pct - overall_blue_pct| weighted by:
 *   - recency (last 6h vs last 48h)
 *   - vote volume (min 5 recent votes to qualify)
 *   - direction (must disagree with current majority)
 *
 * Distinct from:
 *   /flux      — consensus shift in 24h vs prior 24h window
 *   /momentum  — raw vote velocity (not direction-aware)
 *   /battleground — near 50/50 overall
 *   /pivot     — long-run historical divergence
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

  const since6h  = new Date(Date.now() - 6  * 60 * 60 * 1000).toISOString()
  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  // ── Step 1: Fetch votes from last 48h ──────────────────────────────────────
  const { data: rawVotes, error: votesError } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .gte('created_at', since48h)
    .limit(50000)

  if (votesError) {
    return NextResponse.json({ topics: [], hasMore: false }, { status: 500 })
  }

  const votes = rawVotes ?? []

  interface WindowCounts { blue: number; red: number }
  const recent  = new Map<string, WindowCounts>()  // last 6 hours
  const broader = new Map<string, WindowCounts>()  // last 48 hours (includes recent)

  for (const v of votes) {
    const tid = v.topic_id
    const br = broader.get(tid) ?? { blue: 0, red: 0 }
    if (v.side === 'blue') br.blue++; else br.red++
    broader.set(tid, br)

    if (v.created_at >= since6h) {
      const rc = recent.get(tid) ?? { blue: 0, red: 0 }
      if (v.side === 'blue') rc.blue++; else rc.red++
      recent.set(tid, rc)
    }
  }

  // ── Step 2: Score each topic by swing magnitude ────────────────────────────
  const MIN_RECENT_VOTES  = 5
  const MIN_BROADER_VOTES = 15

  interface SwingMeta {
    swingScore:     number
    recentPct:      number
    broadPct:       number
    swingDelta:     number
    direction:      'against_consensus' | 'for_consensus'
    recentVotes:    number
  }
  const swingMap = new Map<string, SwingMeta>()

  for (const [tid, rc] of recent.entries()) {
    const recentTotal = rc.blue + rc.red
    if (recentTotal < MIN_RECENT_VOTES) continue

    const br = broader.get(tid)
    if (!br) continue
    const broadTotal = br.blue + br.red
    if (broadTotal < MIN_BROADER_VOTES) continue

    const recentPct = (rc.blue / recentTotal) * 100
    const broadPct  = (br.blue / broadTotal) * 100

    // Swing = how far recent voters are from the broader window consensus
    const swingDelta = recentPct - broadPct

    // Only surface topics where recent voters are meaningfully diverging
    if (Math.abs(swingDelta) < 8) continue

    // Weight by: volume, magnitude, and how "interesting" the reversal is
    const volumeWeight  = Math.min(recentTotal / 20, 2.0)          // caps at 2×
    const reversal      = Math.abs(swingDelta)                      // 0-100
    const swingScore    = reversal * volumeWeight

    swingMap.set(tid, {
      swingScore,
      recentPct,
      broadPct,
      swingDelta,
      direction: swingDelta < 0 ? 'against_consensus' : 'for_consensus',
      recentVotes: recentTotal,
    })
  }

  if (swingMap.size === 0) {
    // Fallback: return flux topics
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

    return NextResponse.json({ topics: fallback ?? [], hasMore: false })
  }

  // ── Step 3: Rank by swing score ───────────────────────────────────────────
  const ranked = [...swingMap.entries()]
    .sort((a, b) => b[1].swingScore - a[1].swingScore)
    .slice(offset, offset + limit)

  if (ranked.length === 0) {
    return NextResponse.json({ topics: [], hasMore: false })
  }

  const topicIds = ranked.map(([id]) => id)

  // ── Step 4: Fetch full topic rows ─────────────────────────────────────────
  const { data: topicsData, error: topicsError } = await supabase
    .from('topics')
    .select(`
      *,
      author:profiles!topics_author_id_fkey(
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .in('id', topicIds)
    .in('status', ['active', 'voting', 'proposed'])

  if (topicsError || !topicsData) {
    return NextResponse.json({ topics: [], hasMore: false }, { status: 500 })
  }

  // Restore rank order and attach swing metadata
  const topicMap = new Map(topicsData.map((t) => [t.id, t]))
  const enriched = ranked
    .map(([id, meta]) => {
      const topic = topicMap.get(id)
      if (!topic) return null
      return {
        ...topic,
        _swing_score:      meta.swingScore,
        _swing_recent_pct: Math.round(meta.recentPct),
        _swing_broad_pct:  Math.round(meta.broadPct),
        _swing_delta:      Math.round(meta.swingDelta),
        _swing_direction:  meta.direction,
        _swing_votes:      meta.recentVotes,
      }
    })
    .filter(Boolean)

  const hasMore = swingMap.size > offset + limit

  return NextResponse.json({ topics: enriched, hasMore })
}
