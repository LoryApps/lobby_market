import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export type TremorType =
  | 'surge'     // recent voters much more FOR than historical (+15pp)
  | 'reversal'  // recent voters much more AGAINST than historical (-15pp)
  | 'deepening' // moderate reinforcement of majority side (+5 to +14pp)
  | 'erosion'   // moderate weakening of majority side (-5 to -14pp)

export interface TremorTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  // All-time consensus
  overall_blue_pct: number
  total_votes: number
  // Recent 24h window
  recent_votes: number
  recent_blue_pct: number
  // Deviation metrics
  tremor_pp: number        // recent_blue_pct - overall_blue_pct (signed, pp)
  tremor_abs: number       // |tremor_pp|
  tremor_type: TremorType
  // Context
  created_at: string
}

export interface TremorWindow {
  hours: number
  from: string
}

export interface CategoryTremor {
  category: string
  topic_count: number
  avg_tremor_pp: number
  surges: number
  reversals: number
  deepening: number
  erosion: number
  dominant_direction: 'net_for' | 'net_against' | 'balanced'
}

export interface TremorStats {
  total_active: number         // topics with qualifying recent votes
  surge_count: number
  reversal_count: number
  deepening_count: number
  erosion_count: number
  avg_tremor_abs: number       // mean deviation across all active
  most_volatile_category: string | null
  net_platform_shift: number   // platform-wide: avg(recent_blue_pct) - avg(overall_blue_pct)
}

export interface TremorResponse {
  surges: TremorTopic[]
  reversals: TremorTopic[]
  deepening: TremorTopic[]
  erosion: TremorTopic[]
  category_breakdown: CategoryTremor[]
  stats: TremorStats
  window: TremorWindow
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyTremor(pp: number): TremorType {
  if (pp >= 15) return 'surge'
  if (pp <= -15) return 'reversal'
  if (pp > 0) return 'deepening'
  return 'erosion'
}

function dominant(avgPp: number): CategoryTremor['dominant_direction'] {
  if (avgPp > 3) return 'net_for'
  if (avgPp < -3) return 'net_against'
  return 'balanced'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const WINDOW_HOURS = 24
  const since = new Date(Date.now() - WINDOW_HOURS * 3_600_000).toISOString()
  const MIN_RECENT_VOTES = 3   // need at least 3 recent votes to be meaningful
  const MIN_TOTAL_VOTES  = 10  // topic needs baseline volume
  const MAX_TOPICS       = 200 // cap for performance

  // ── 1. Fetch recent votes ──────────────────────────────────────────────────
  const { data: recentVotes, error: votesError } = await supabase
    .from('votes')
    .select('topic_id, side')
    .gte('created_at', since)
    .limit(10000)

  if (votesError) {
    return NextResponse.json({ error: votesError.message }, { status: 500 })
  }

  const votes = recentVotes ?? []
  if (votes.length === 0) {
    const empty: TremorResponse = {
      surges: [],
      reversals: [],
      deepening: [],
      erosion: [],
      category_breakdown: [],
      stats: {
        total_active: 0, surge_count: 0, reversal_count: 0,
        deepening_count: 0, erosion_count: 0,
        avg_tremor_abs: 0, most_volatile_category: null, net_platform_shift: 0,
      },
      window: { hours: WINDOW_HOURS, from: since },
      generated_at: new Date().toISOString(),
    }
    return NextResponse.json(empty)
  }

  // ── 2. Aggregate per topic ─────────────────────────────────────────────────
  const recentByTopic = new Map<string, { blue: number; total: number }>()
  for (const v of votes) {
    const tid = v.topic_id
    const cur = recentByTopic.get(tid) ?? { blue: 0, total: 0 }
    cur.total++
    if (v.side === 'blue') cur.blue++
    recentByTopic.set(tid, cur)
  }

  // Filter to topics with enough recent activity
  const qualifyingIds = [...recentByTopic.entries()]
    .filter(([, c]) => c.total >= MIN_RECENT_VOTES)
    .map(([id]) => id)
    .slice(0, MAX_TOPICS)

  if (qualifyingIds.length === 0) {
    const empty: TremorResponse = {
      surges: [],
      reversals: [],
      deepening: [],
      erosion: [],
      category_breakdown: [],
      stats: {
        total_active: 0, surge_count: 0, reversal_count: 0,
        deepening_count: 0, erosion_count: 0,
        avg_tremor_abs: 0, most_volatile_category: null, net_platform_shift: 0,
      },
      window: { hours: WINDOW_HOURS, from: since },
      generated_at: new Date().toISOString(),
    }
    return NextResponse.json(empty)
  }

  // ── 3. Fetch topic metadata ────────────────────────────────────────────────
  const { data: topicsData, error: topicsError } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, created_at')
    .in('id', qualifyingIds)
    .in('status', ['active', 'voting', 'proposed'])
    .gte('total_votes', MIN_TOTAL_VOTES)

  if (topicsError) {
    return NextResponse.json({ error: topicsError.message }, { status: 500 })
  }

  const topics = topicsData ?? []

  // ── 4. Compute tremor metrics ─────────────────────────────────────────────
  const tremorTopics: TremorTopic[] = []

  for (const t of topics) {
    const recent = recentByTopic.get(t.id)
    if (!recent) continue

    const overall_blue_pct = t.blue_pct ?? 50
    const recent_blue_pct = recent.total > 0
      ? Math.round((recent.blue / recent.total) * 1000) / 10
      : 50

    const tremor_pp = Math.round((recent_blue_pct - overall_blue_pct) * 10) / 10
    const tremor_abs = Math.abs(tremor_pp)

    // Only include topics with at least a 5pp deviation (noise floor)
    if (tremor_abs < 5) continue

    tremorTopics.push({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      scope: (t as { scope?: string | null }).scope ?? null,
      overall_blue_pct,
      total_votes: t.total_votes ?? 0,
      recent_votes: recent.total,
      recent_blue_pct,
      tremor_pp,
      tremor_abs,
      tremor_type: classifyTremor(tremor_pp),
      created_at: t.created_at,
    })
  }

  // Sort by abs deviation descending
  tremorTopics.sort((a, b) => b.tremor_abs - a.tremor_abs)

  // ── 5. Partition by type ──────────────────────────────────────────────────
  const surges    = tremorTopics.filter((t) => t.tremor_type === 'surge').slice(0, 20)
  const reversals = tremorTopics.filter((t) => t.tremor_type === 'reversal').slice(0, 20)
  const deepening = tremorTopics.filter((t) => t.tremor_type === 'deepening').slice(0, 20)
  const erosion   = tremorTopics.filter((t) => t.tremor_type === 'erosion').slice(0, 20)

  // ── 6. Category breakdown ─────────────────────────────────────────────────
  const catMap = new Map<string, number[]>()  // category → array of tremor_pp values
  for (const t of tremorTopics) {
    const cat = t.category ?? 'Other'
    const arr = catMap.get(cat) ?? []
    arr.push(t.tremor_pp)
    catMap.set(cat, arr)
  }

  const category_breakdown: CategoryTremor[] = [...catMap.entries()]
    .map(([category, pps]) => {
      const avg = pps.reduce((s, v) => s + v, 0) / pps.length
      return {
        category,
        topic_count: pps.length,
        avg_tremor_pp: Math.round(avg * 10) / 10,
        surges: pps.filter((p) => p >= 15).length,
        reversals: pps.filter((p) => p <= -15).length,
        deepening: pps.filter((p) => p > 0 && p < 15).length,
        erosion: pps.filter((p) => p < 0 && p > -15).length,
        dominant_direction: dominant(avg),
      }
    })
    .sort((a, b) => Math.abs(b.avg_tremor_pp) - Math.abs(a.avg_tremor_pp))

  // ── 7. Platform stats ─────────────────────────────────────────────────────
  const allAbsPp = tremorTopics.map((t) => t.tremor_abs)
  const allPp    = tremorTopics.map((t) => t.tremor_pp)

  const most_volatile_category = category_breakdown.length > 0
    ? category_breakdown[0].category
    : null

  const net_platform_shift = allPp.length > 0
    ? Math.round((allPp.reduce((s, v) => s + v, 0) / allPp.length) * 10) / 10
    : 0

  const avg_tremor_abs = allAbsPp.length > 0
    ? Math.round((allAbsPp.reduce((s, v) => s + v, 0) / allAbsPp.length) * 10) / 10
    : 0

  const stats: TremorStats = {
    total_active: tremorTopics.length,
    surge_count: surges.length,
    reversal_count: reversals.length,
    deepening_count: deepening.length,
    erosion_count: erosion.length,
    avg_tremor_abs,
    most_volatile_category,
    net_platform_shift,
  }

  const response: TremorResponse = {
    surges,
    reversals,
    deepening,
    erosion,
    category_breakdown,
    stats,
    window: { hours: WINDOW_HOURS, from: since },
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
