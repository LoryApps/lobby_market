import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10-min cache — window shifts slowly

// ─── Types ────────────────────────────────────────────────────────────────────

export type OvertonsZone =
  | 'mainstream'    // FOR% 30–70: genuinely contested, both sides have standing
  | 'leaning_for'   // FOR% 70–80: broadly favoured but still debated
  | 'leaning_against' // FOR% 20–30: broadly sceptical but contested
  | 'consensus_for'   // FOR% 80–90: strong community agreement FOR
  | 'consensus_against' // FOR% 10–20: strong community agreement AGAINST
  | 'extreme_for'     // FOR% > 90: near-universal acceptance
  | 'extreme_against' // FOR% < 10: near-universal rejection

export interface OvertonsWindowTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  zone: OvertonsZone
}

export interface CategoryWindow {
  category: string
  topic_count: number
  avg_for_pct: number
  mainstream_count: number
  consensus_for_count: number
  consensus_against_count: number
  /** How far the category leans from centre (negative = skews AGAINST, positive = FOR) */
  lean: number
}

export interface OvertonsWindowStats {
  total_topics: number
  mainstream_count: number
  leaning_count: number
  consensus_count: number
  extreme_count: number
  /** Weighted average FOR% across all active topics (0–100) */
  window_center: number
  /** Standard deviation of FOR% — lower = narrower window = less pluralism */
  window_width: number
  /** 0–100 centre from 7-day window for comparison */
  window_center_7d: number | null
  /** How the centre shifted vs. 7 days ago (positive = more FOR, negative = more AGAINST) */
  drift_7d: number | null
  most_mainstream_topic: OvertonsWindowTopic | null
  most_extreme_topic: OvertonsWindowTopic | null
}

export interface OvertonsResponse {
  topics: OvertonsWindowTopic[]
  category_breakdown: CategoryWindow[]
  stats: OvertonsWindowStats
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyZone(pct: number): OvertonsZone {
  if (pct >= 90) return 'extreme_for'
  if (pct >= 80) return 'consensus_for'
  if (pct >= 70) return 'leaning_for'
  if (pct >= 30) return 'mainstream'
  if (pct >= 20) return 'leaning_against'
  if (pct >= 10) return 'consensus_against'
  return 'extreme_against'
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

// ─── Route ────────────────────────────────────────────────────────────────────

const MIN_VOTES = 10 // exclude low-signal topics
const ACTIVE_STATUSES = ['active', 'voting', 'proposed']

export async function GET() {
  const supabase = await createClient()

  // Fetch all live topics with enough votes
  const { data: topicsData, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes')
    .in('status', ACTIVE_STATUSES)
    .gte('total_votes', MIN_VOTES)
    .not('blue_pct', 'is', null)
    .order('total_votes', { ascending: false })
    .limit(400)

  if (error) return NextResponse.json({ error: 'fetch_error' }, { status: 500 })

  const raw = topicsData ?? []

  // ── Classify each topic ────────────────────────────────────────────────────
  const topics: OvertonsWindowTopic[] = raw.map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    scope: t.scope,
    blue_pct: Math.round(t.blue_pct ?? 50),
    total_votes: t.total_votes ?? 0,
    zone: classifyZone(t.blue_pct ?? 50),
  }))

  // Sort by FOR% for spectrum display
  topics.sort((a, b) => a.blue_pct - b.blue_pct)

  // ── Window stats ───────────────────────────────────────────────────────────
  const pcts = topics.map((t) => t.blue_pct)
  const totalVotes = topics.reduce((s, t) => s + t.total_votes, 0)
  const windowCenter = totalVotes > 0
    ? topics.reduce((s, t) => s + t.blue_pct * t.total_votes, 0) / totalVotes
    : 50
  const windowWidth = stdDev(pcts)

  const mainstreamTopics    = topics.filter((t) => t.zone === 'mainstream')
  const leaningTopics       = topics.filter((t) => t.zone === 'leaning_for' || t.zone === 'leaning_against')
  const consensusTopics     = topics.filter((t) => t.zone === 'consensus_for' || t.zone === 'consensus_against')
  const extremeTopics       = topics.filter((t) => t.zone === 'extreme_for' || t.zone === 'extreme_against')

  // Most mainstream = closest to 50
  const mostMainstream = topics.length > 0
    ? topics.reduce((best, t) => Math.abs(t.blue_pct - 50) < Math.abs(best.blue_pct - 50) ? t : best)
    : null

  // Most extreme = furthest from 50
  const mostExtreme = topics.length > 0
    ? topics.reduce((best, t) => Math.abs(t.blue_pct - 50) > Math.abs(best.blue_pct - 50) ? t : best)
    : null

  // ── 7-day window drift ────────────────────────────────────────────────────
  // Sample votes cast in the last 7 days vs. the window before to detect drift
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since14d = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const topicIds = topics.map((t) => t.id)

  let windowCenter7d: number | null = null
  let drift7d: number | null = null

  if (topicIds.length > 0) {
    const [recentRes, priorRes] = await Promise.all([
      supabase
        .from('votes')
        .select('topic_id, side')
        .in('topic_id', topicIds.slice(0, 200))
        .gte('created_at', since7d),
      supabase
        .from('votes')
        .select('topic_id, side')
        .in('topic_id', topicIds.slice(0, 200))
        .gte('created_at', since14d)
        .lt('created_at', since7d),
    ])

    const recentVotes = recentRes.data ?? []
    const priorVotes = priorRes.data ?? []

    if (recentVotes.length >= 20) {
      const recentFor = recentVotes.filter((v) => v.side === 'blue').length
      windowCenter7d = (recentFor / recentVotes.length) * 100
    }

    if (priorVotes.length >= 20 && windowCenter7d !== null) {
      const priorFor = priorVotes.filter((v) => v.side === 'blue').length
      const priorCenter = (priorFor / priorVotes.length) * 100
      drift7d = windowCenter7d - priorCenter
    }
  }

  // ── Category breakdown ─────────────────────────────────────────────────────
  const catMap = new Map<string, OvertonsWindowTopic[]>()
  for (const t of topics) {
    const cat = t.category ?? 'Other'
    const arr = catMap.get(cat) ?? []
    arr.push(t)
    catMap.set(cat, arr)
  }

  const categoryBreakdown: CategoryWindow[] = Array.from(catMap.entries())
    .map(([category, ts]) => {
      const avgFor = ts.reduce((s, t) => s + t.blue_pct, 0) / ts.length
      return {
        category,
        topic_count: ts.length,
        avg_for_pct: Math.round(avgFor * 10) / 10,
        mainstream_count: ts.filter((t) => t.zone === 'mainstream').length,
        consensus_for_count: ts.filter((t) => t.zone === 'consensus_for' || t.zone === 'extreme_for').length,
        consensus_against_count: ts.filter((t) => t.zone === 'consensus_against' || t.zone === 'extreme_against').length,
        lean: Math.round((avgFor - 50) * 10) / 10,
      }
    })
    .sort((a, b) => b.topic_count - a.topic_count)

  const stats: OvertonsWindowStats = {
    total_topics: topics.length,
    mainstream_count: mainstreamTopics.length,
    leaning_count: leaningTopics.length,
    consensus_count: consensusTopics.length,
    extreme_count: extremeTopics.length,
    window_center: Math.round(windowCenter * 10) / 10,
    window_width: Math.round(windowWidth * 10) / 10,
    window_center_7d: windowCenter7d !== null ? Math.round(windowCenter7d * 10) / 10 : null,
    drift_7d: drift7d !== null ? Math.round(drift7d * 10) / 10 : null,
    most_mainstream_topic: mostMainstream ?? null,
    most_extreme_topic: mostExtreme ?? null,
  }

  return NextResponse.json(
    {
      topics,
      category_breakdown: categoryBreakdown,
      stats,
      generated_at: new Date().toISOString(),
    } satisfies OvertonsResponse,
    {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    }
  )
}
