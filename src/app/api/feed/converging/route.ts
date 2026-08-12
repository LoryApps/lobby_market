import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/converging
 *
 * Topics where the community is actively building consensus — recent votes
 * (last 12 hours) are going in the SAME direction as the current majority,
 * strengthening rather than reversing the established lean.
 *
 * These are debates where the community is converging on an answer in
 * real time. Includes topics in the "resolving" band (55–79% FOR or
 * 21–45% AGAINST) where consensus is not yet overwhelming but is building.
 *
 * Convergence score = |recent_blue_pct − 50| − |broad_blue_pct − 50|
 *   > 0: recent voters push FURTHER toward one side (convergence)
 *   < 0: recent voters push BACK toward centre (divergence / swing)
 *
 * Distinct from:
 *   /swing      — recent votes going OPPOSITE to majority (divergence)
 *   /flux       — any opinion shift in 24h vs prior 24h
 *   /mandate    — already at 80%+ or 20%- overwhelming consensus
 *   /deadlock   — stuck at 50/50 for 7+ days with no movement
 *   /momentum   — raw vote velocity with no direction weighting
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

  const since12h = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  // ── Step 1: Fetch recent votes (48h window for broad context) ─────────────
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
  const recent = new Map<string, WindowCounts>()   // last 12 hours
  const broader = new Map<string, WindowCounts>()  // last 48 hours

  for (const v of votes) {
    const tid = v.topic_id
    const br = broader.get(tid) ?? { blue: 0, red: 0 }
    if (v.side === 'blue') br.blue++; else br.red++
    broader.set(tid, br)

    if (v.created_at >= since12h) {
      const rc = recent.get(tid) ?? { blue: 0, red: 0 }
      if (v.side === 'blue') rc.blue++; else rc.red++
      recent.set(tid, rc)
    }
  }

  // ── Step 2: Score by convergence magnitude ────────────────────────────────
  const MIN_RECENT_VOTES  = 5
  const MIN_BROADER_VOTES = 15
  const MIN_CONVERGENCE   = 5  // percentage points toward consensus

  interface ConvergeMeta {
    convergeScore:   number
    recentPct:       number
    broadPct:        number
    convergenceDelta: number
    recentVotes:     number
  }
  const convergeMap = new Map<string, ConvergeMeta>()

  for (const [tid, rc] of recent.entries()) {
    const recentTotal = rc.blue + rc.red
    if (recentTotal < MIN_RECENT_VOTES) continue

    const br = broader.get(tid)
    if (!br) continue
    const broadTotal = br.blue + br.red
    if (broadTotal < MIN_BROADER_VOTES) continue

    const recentPct = (rc.blue / recentTotal) * 100
    const broadPct  = (br.blue / broadTotal) * 100

    // Convergence: how much MORE extreme (away from 50%) are recent votes vs. broader?
    // |recentPct - 50| > |broadPct - 50| means recent voters push further toward one side
    const convergenceDelta = Math.abs(recentPct - 50) - Math.abs(broadPct - 50)

    // Only surface topics where recent votes are meaningfully converging
    if (convergenceDelta < MIN_CONVERGENCE) continue

    // Also require that recent votes are in the SAME direction as the broader lean
    const broadLean = broadPct >= 50 ? 'blue' : 'red'
    const recentLean = recentPct >= 50 ? 'blue' : 'red'
    if (broadLean !== recentLean) continue // Diverging, not converging

    // Score by convergence × volume
    const volumeWeight = Math.min(recentTotal / 20, 2.0)
    const convergeScore = convergenceDelta * volumeWeight

    convergeMap.set(tid, {
      convergeScore,
      recentPct,
      broadPct,
      convergenceDelta,
      recentVotes: recentTotal,
    })
  }

  if (convergeMap.size === 0) {
    // Fallback: topics with meaningful majority in active/voting status
    const { data: fallback } = await supabase
      .from('topics')
      .select(`
        *,
        author:profiles!topics_author_id_fkey(
          id, username, display_name, avatar_url, role, clout
        )
      `)
      .in('status', ['active', 'voting'])
      .or('blue_pct.gte.60,blue_pct.lte.40')
      .gt('total_votes', 20)
      .order('feed_score', { ascending: false })
      .range(offset, offset + limit - 1)

    return NextResponse.json({ topics: fallback ?? [], hasMore: false })
  }

  // ── Step 3: Rank by convergence score ────────────────────────────────────
  const ranked = [...convergeMap.entries()]
    .sort((a, b) => b[1].convergeScore - a[1].convergeScore)
    .slice(offset, offset + limit)

  if (ranked.length === 0) {
    return NextResponse.json({ topics: [], hasMore: false })
  }

  const topicIds = ranked.map(([id]) => id)

  // ── Step 4: Fetch full topic rows ────────────────────────────────────────
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

  // Restore rank order and attach convergence metadata
  const topicMap = new Map(topicsData.map((t) => [t.id, t]))
  const enriched = ranked
    .map(([id, meta]) => {
      const topic = topicMap.get(id)
      if (!topic) return null
      return {
        ...topic,
        _converge_score:    meta.convergeScore,
        _converge_recent_pct: Math.round(meta.recentPct),
        _converge_broad_pct:  Math.round(meta.broadPct),
        _converge_delta:      Math.round(meta.convergenceDelta),
        _converge_votes:      meta.recentVotes,
      }
    })
    .filter(Boolean)

  const hasMore = convergeMap.size > offset + limit

  return NextResponse.json({ topics: enriched, hasMore })
}
