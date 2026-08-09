import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/feed/flashpoint
 *
 * Topics at peak controversy right now — simultaneously high vote velocity
 * (lots of votes in the last 6 hours) AND high contestedness (near 50/50
 * split). These are the debates the whole Lobby is actively fighting over.
 *
 * Flashpoint score = velocity_weight × contestedness_weight
 *   velocity_weight    = votes in last 6h (capped, normalised 0–1)
 *   contestedness_weight = 1 − |blue_pct − 50| / 50  (1 = perfect split, 0 = unanimous)
 *
 * Distinct from:
 *   /battleground — topics near 50/50 based on overall totals, no velocity signal
 *   /momentum     — raw vote velocity with no polarisation weighting
 *   /deadlock     — 50/50 but STALLED (no recent votes), opposite of flashpoint
 *   /overdrive    — voting faster than expected, but not necessarily contested
 *   /converging   — recent votes pushing TOWARD consensus, opposite of flashpoint
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

  const since6h = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()

  // ── Step 1: Count recent votes per topic ──────────────────────────────────
  const { data: rawVotes, error: votesError } = await supabase
    .from('votes')
    .select('topic_id')
    .gte('created_at', since6h)
    .limit(40000)

  if (votesError) {
    return NextResponse.json({ topics: [], hasMore: false }, { status: 500 })
  }

  const velocityMap = new Map<string, number>()
  for (const v of rawVotes ?? []) {
    velocityMap.set(v.topic_id, (velocityMap.get(v.topic_id) ?? 0) + 1)
  }

  if (velocityMap.size === 0) {
    // Cold start — fallback to battleground topics by blue_pct proximity to 50
    const { data: fallback } = await supabase
      .from('topics')
      .select(`
        *,
        author:profiles!topics_author_id_fkey(
          id, username, display_name, avatar_url, role, clout
        )
      `)
      .in('status', ['active', 'voting'])
      .gte('total_votes', 10)
      .gte('blue_pct', 35)
      .lte('blue_pct', 65)
      .order('total_votes', { ascending: false })
      .range(offset, offset + limit - 1)

    return NextResponse.json({ topics: fallback ?? [], hasMore: false })
  }

  // ── Step 2: Score by velocity × contestedness ─────────────────────────────
  const MIN_VELOCITY = 3   // at least 3 votes in 6h

  const MAX_RAW_VEL = Math.max(...velocityMap.values())

  interface FlashpointMeta {
    score: number
    velocity: number
  }
  const scoreMap = new Map<string, FlashpointMeta>()

  for (const [tid, vel] of velocityMap.entries()) {
    if (vel < MIN_VELOCITY) continue
    scoreMap.set(tid, { score: 0, velocity: vel })
  }

  if (scoreMap.size === 0) {
    return NextResponse.json({ topics: [], hasMore: false })
  }

  // ── Step 3: Fetch topic rows to get blue_pct ──────────────────────────────
  const candidateIds = [...scoreMap.keys()]

  // Fetch in chunks to avoid query-size limits
  const CHUNK = 200
  const topicRows: Array<{ id: string; blue_pct: number; status: string }> = []

  for (let i = 0; i < candidateIds.length; i += CHUNK) {
    const chunk = candidateIds.slice(i, i + CHUNK)
    const { data } = await supabase
      .from('topics')
      .select('id, blue_pct, status')
      .in('id', chunk)
      .in('status', ['active', 'voting', 'proposed'])

    if (data) topicRows.push(...data)
  }

  // Score = normalised_velocity × contestedness
  let hasAnyResults = false
  for (const row of topicRows) {
    const meta = scoreMap.get(row.id)
    if (!meta) continue
    const normVel = MAX_RAW_VEL > 0 ? meta.velocity / MAX_RAW_VEL : 0
    const contestedness = 1 - Math.abs((row.blue_pct ?? 50) - 50) / 50
    meta.score = normVel * contestedness
    hasAnyResults = true
  }

  if (!hasAnyResults) {
    return NextResponse.json({ topics: [], hasMore: false })
  }

  // ── Step 4: Sort by flashpoint score ─────────────────────────────────────
  const ranked = [...scoreMap.entries()]
    .filter(([, m]) => m.score > 0)
    .sort((a, b) => b[1].score - a[1].score)
    .slice(offset, offset + limit)

  if (ranked.length === 0) {
    return NextResponse.json({ topics: [], hasMore: false })
  }

  const rankedIds = ranked.map(([id]) => id)

  // ── Step 5: Fetch full topic rows with author ─────────────────────────────
  const { data: fullTopics, error: fullError } = await supabase
    .from('topics')
    .select(`
      *,
      author:profiles!topics_author_id_fkey(
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .in('id', rankedIds)

  if (fullError || !fullTopics) {
    return NextResponse.json({ topics: [], hasMore: false }, { status: 500 })
  }

  // Restore rank order and attach flashpoint metadata
  const fullMap = new Map(fullTopics.map((t) => [t.id, t]))
  const enriched = ranked
    .map(([id, meta]) => {
      const topic = fullMap.get(id)
      if (!topic) return null
      return {
        ...topic,
        _flashpoint_score: Math.round(meta.score * 100),
        _flashpoint_velocity: meta.velocity,
      }
    })
    .filter(Boolean)

  const totalCandidates = [...scoreMap.values()].filter((m) => m.score > 0).length
  const hasMore = totalCandidates > offset + limit

  return NextResponse.json({ topics: enriched, hasMore })
}
