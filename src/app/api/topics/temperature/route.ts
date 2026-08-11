import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemperatureTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  votes_6h: number
  votes_24h: number
  /** Composite heat score 0–100 */
  heat_score: number
  /** Human label for this heat band */
  heat_label: 'Freezing' | 'Cold' | 'Warm' | 'Hot' | 'Burning'
  /** Controversy: how close to 50/50 (0–100, max at 50/50 split) */
  controversy: number
  /** Velocity score relative to the hottest topic (0–100) */
  velocity_score: number
}

export interface TemperatureResponse {
  topics: TemperatureTopic[]
  platform: {
    /** Average heat score across all topics with ≥ 10 votes */
    avg_heat: number
    /** Total active topics considered */
    active_count: number
    /** Total votes cast in the last 6 hours */
    votes_6h_total: number
    /** Total votes cast in the last 24 hours */
    votes_24h_total: number
  }
}

// ─── Heat label helpers ───────────────────────────────────────────────────────

function getHeatLabel(score: number): TemperatureTopic['heat_label'] {
  if (score >= 80) return 'Burning'
  if (score >= 60) return 'Hot'
  if (score >= 40) return 'Warm'
  if (score >= 20) return 'Cold'
  return 'Freezing'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()
  const since6h  = new Date(now - 6  * 60 * 60 * 1000).toISOString()
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  // Fetch recent votes to compute per-topic velocity
  const { data: recentVotes, error: votesError } = await supabase
    .from('votes')
    .select('topic_id, created_at')
    .gte('created_at', since24h)
    .limit(20000)

  if (votesError) {
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 })
  }

  const votes = recentVotes ?? []

  // Count per topic for 6h and 24h windows
  const counts24h = new Map<string, number>()
  const counts6h  = new Map<string, number>()

  for (const v of votes) {
    const tid = v.topic_id
    counts24h.set(tid, (counts24h.get(tid) ?? 0) + 1)
    if (v.created_at >= since6h) counts6h.set(tid, (counts6h.get(tid) ?? 0) + 1)
  }

  // Fetch active topics (exclude settled/failed)
  const { data: topicsData, error: topicsError } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes')
    .in('status', ['proposed', 'active', 'voting'])
    .gte('total_votes', 5)
    .limit(500)

  if (topicsError) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  const topics = topicsData ?? []

  if (topics.length === 0) {
    return NextResponse.json({
      topics: [],
      platform: { avg_heat: 0, active_count: 0, votes_6h_total: 0, votes_24h_total: 0 },
    } satisfies TemperatureResponse)
  }

  // Find max 6h votes for normalization
  let maxVotes6h = 1
  for (const t of topics) {
    const v6 = counts6h.get(t.id) ?? 0
    if (v6 > maxVotes6h) maxVotes6h = v6
  }

  // Compute heat scores
  const scored = topics.map((t) => {
    const v6  = counts6h.get(t.id) ?? 0
    const v24 = counts24h.get(t.id) ?? 0
    const forPct = t.blue_pct ?? 50

    // Controversy: 100 when perfectly split, 0 when unanimous
    const controversy = 100 - Math.abs(forPct - 50) * 2

    // Velocity: normalized to [0, 100] based on the most active topic in the window
    const velocity_score = Math.round((v6 / maxVotes6h) * 100)

    // Total volume score: engagement depth, capped at 1000 votes for max score
    const volume_score = Math.min(100, Math.round((t.total_votes / 1000) * 100))

    // Composite heat: controversy matters most, then velocity, then depth
    const heat_score = Math.round(
      controversy   * 0.40 +
      velocity_score * 0.40 +
      volume_score  * 0.20
    )

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      scope: t.scope,
      blue_pct: forPct,
      total_votes: t.total_votes ?? 0,
      votes_6h: v6,
      votes_24h: v24,
      heat_score,
      heat_label: getHeatLabel(heat_score),
      controversy: Math.round(controversy),
      velocity_score,
    } satisfies TemperatureTopic
  })

  // Sort by heat score descending
  scored.sort((a, b) => b.heat_score - a.heat_score)

  // Platform aggregate — use top 200 or all if fewer
  const forAvg = scored.slice(0, 200)
  const avg_heat = forAvg.length > 0
    ? Math.round(forAvg.reduce((s, t) => s + t.heat_score, 0) / forAvg.length)
    : 0

  const votes_6h_total  = Array.from(counts6h.values()).reduce((s, v) => s + v, 0)
  const votes_24h_total = votes.length

  // Return top 50 topics
  return NextResponse.json({
    topics: scored.slice(0, 50),
    platform: {
      avg_heat,
      active_count: scored.length,
      votes_6h_total,
      votes_24h_total,
    },
  } satisfies TemperatureResponse)
}
