import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/flux
 *
 * Topics with the most significant consensus shift in the last 24 hours vs
 * the prior 24-hour window. Surfaces topics where opinion is actively moving —
 * neither settled battlegrounds nor calm majority votes.
 *
 * Returns topics in TopicWithAuthor format so the main feed can render them
 * with the standard TopicCard, with extra _flux_* fields for the shift badge.
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
  const ms24h = 24 * 60 * 60 * 1000
  const ms48h = 48 * 60 * 60 * 1000

  const since48h = new Date(now - ms48h).toISOString()
  const since24h = new Date(now - ms24h).toISOString()

  // ── Step 1: Fetch votes from the last 48h ─────────────────────────────────
  const { data: rawVotes, error: votesError } = await supabase
    .from('votes')
    .select('topic_id, side, created_at')
    .gte('created_at', since48h)
    .limit(30000)

  if (votesError) {
    return NextResponse.json({ topics: [], hasMore: false, total: 0 })
  }

  const votes = rawVotes ?? []

  // ── Step 2: Bucket into recent (0-24h) and prior (24-48h) windows ─────────
  interface WindowCounts { blue: number; red: number }
  const recent = new Map<string, WindowCounts>()
  const prior  = new Map<string, WindowCounts>()

  for (const v of votes) {
    const tid = v.topic_id
    const isRecent = v.created_at >= since24h
    const map = isRecent ? recent : prior
    const existing = map.get(tid) ?? { blue: 0, red: 0 }
    if (v.side === 'blue') existing.blue++
    else existing.red++
    map.set(tid, existing)
  }

  // ── Step 3: Score each topic by shift magnitude ────────────────────────────
  const MIN_VOTES = 5
  interface FluxMeta { shift: number; magnitude: number; direction: 'for' | 'against' | 'contested' }
  const fluxMap = new Map<string, FluxMeta>()

  for (const [tid, r] of recent.entries()) {
    const recentTotal = r.blue + r.red
    if (recentTotal < MIN_VOTES) continue

    const p = prior.get(tid)
    const priorTotal = p ? p.blue + p.red : 0
    const recentPct = (r.blue / recentTotal) * 100

    let shift: number
    let priorPct: number
    if (priorTotal >= MIN_VOTES && p) {
      priorPct = (p.blue / priorTotal) * 100
      shift = recentPct - priorPct
    } else {
      // Fall back to comparing recent window against nothing — treat as contested
      shift = 0
      priorPct = recentPct
    }

    const magnitude = Math.abs(shift)
    const direction: FluxMeta['direction'] = shift > 3 ? 'for' : shift < -3 ? 'against' : 'contested'
    fluxMap.set(tid, { shift: Math.round(shift * 10) / 10, magnitude: Math.round(magnitude * 10) / 10, direction })
  }

  if (fluxMap.size === 0) {
    return NextResponse.json({ topics: [], hasMore: false, total: 0 })
  }

  // Sort all topic IDs by magnitude desc
  const ranked = Array.from(fluxMap.entries())
    .sort((a, b) => b[1].magnitude - a[1].magnitude)

  const rankedIds = ranked.map(([id]) => id)
  const page = rankedIds.slice(offset, offset + limit)
  const hasMore = rankedIds.length > offset + limit

  if (page.length === 0) {
    return NextResponse.json({ topics: [], hasMore: false, total: ranked.length })
  }

  // ── Step 4: Fetch full topic rows with author profiles ────────────────────
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select(`
      id, statement, description, category, scope, status,
      blue_pct, total_votes, total_arguments, blue_votes, red_votes,
      support_count, activation_threshold, voting_ends_at,
      created_at, updated_at, author_id, feed_score, tags,
      author:profiles!topics_author_id_fkey (
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .in('id', page)
    .in('status', ['active', 'voting'])

  if (!topicsRaw || topicsRaw.length === 0) {
    return NextResponse.json({ topics: [], hasMore: false, total: 0 })
  }

  // Preserve flux-rank order and inject flux metadata
  const topicMap = new Map(topicsRaw.map((t) => [t.id, t]))
  const ordered = page
    .map((id) => {
      const t = topicMap.get(id)
      if (!t) return null
      const meta = fluxMap.get(id)!
      return {
        ...t,
        _flux_shift: meta.shift,
        _flux_magnitude: meta.magnitude,
        _flux_direction: meta.direction,
      }
    })
    .filter(Boolean)

  return NextResponse.json({
    topics: ordered,
    hasMore,
    total: ranked.length,
  })
}
