import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600 // 10 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TurbulenceTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
  feed_score: number
  /** 0–100: how close to 50/50 (100 = exact deadlock) */
  instability: number
  /** 0–100: composite turbulence score */
  turbulence_score: number
  /** Qualitative zone */
  zone: 'extreme' | 'high' | 'moderate' | 'low'
}

export interface CategoryTurbulence {
  category: string
  topic_count: number
  avg_turbulence: number
  avg_instability: number
  top_topic: TurbulenceTopic | null
}

export interface TurbulenceStats {
  /** 0–100: platform-wide turbulence index */
  platform_turbulence_index: number
  /** Topics in extreme/high zones */
  extreme_count: number
  high_count: number
  /** Avg instability across all active topics */
  avg_instability: number
  /** % of active topics in the turbulent zone (score ≥ 60) */
  pct_turbulent: number
  total_active: number
}

export interface TurbulenceResponse {
  stats: TurbulenceStats
  top_turbulent: TurbulenceTopic[]
  category_breakdown: CategoryTurbulence[]
  extreme_swings: TurbulenceTopic[]   // highest instability regardless of volume
  surging_unstable: TurbulenceTopic[] // newest topics already in turbulence
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeInstability(blue_pct: number): number {
  // 100 when exactly 50/50, 0 when unanimous (0 or 100)
  return Math.round((1 - Math.abs(blue_pct - 50) / 50) * 100)
}

function computeTurbulence(topic: {
  blue_pct: number
  total_votes: number
  feed_score: number
}): number {
  const instability = computeInstability(topic.blue_pct)
  // Volume factor: log scale so huge topics don't overwhelm small ones
  const volumeFactor = Math.min(100, Math.log10(Math.max(topic.total_votes, 1) + 1) * 33)
  // Activity factor: recent engagement (feed_score proxy)
  const activityFactor = Math.min(100, Math.sqrt(Math.max(topic.feed_score, 0)) * 4)
  // Weighted: instability is most important, then volume, then activity
  return Math.round(instability * 0.5 + volumeFactor * 0.3 + activityFactor * 0.2)
}

function zone(score: number): TurbulenceTopic['zone'] {
  if (score >= 80) return 'extreme'
  if (score >= 60) return 'high'
  if (score >= 40) return 'moderate'
  return 'low'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: rawTopics, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at, feed_score')
    .in('status', ['active', 'voting', 'proposed'])
    .order('total_votes', { ascending: false })
    .limit(300)

  if (error || !rawTopics) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  const topics: TurbulenceTopic[] = rawTopics
    .filter((t) => t.total_votes > 0)
    .map((t) => {
      const instability = computeInstability(t.blue_pct ?? 50)
      const turbulence_score = computeTurbulence({
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        feed_score: t.feed_score ?? 0,
      })
      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        created_at: t.created_at,
        feed_score: t.feed_score ?? 0,
        instability,
        turbulence_score,
        zone: zone(turbulence_score),
      }
    })
    .sort((a, b) => b.turbulence_score - a.turbulence_score)

  const active = topics.length
  const extreme_count = topics.filter((t) => t.zone === 'extreme').length
  const high_count = topics.filter((t) => t.zone === 'high').length
  const avg_instability = active > 0
    ? Math.round(topics.reduce((s, t) => s + t.instability, 0) / active)
    : 0
  const pct_turbulent = active > 0
    ? Math.round(((extreme_count + high_count) / active) * 100)
    : 0
  const platform_turbulence_index = active > 0
    ? Math.round(topics.slice(0, 20).reduce((s, t) => s + t.turbulence_score, 0) / Math.min(20, active))
    : 0

  // Category breakdown
  const catMap = new Map<string, TurbulenceTopic[]>()
  for (const t of topics) {
    const c = t.category ?? 'Uncategorised'
    if (!catMap.has(c)) catMap.set(c, [])
    catMap.get(c)!.push(t)
  }
  const category_breakdown: CategoryTurbulence[] = Array.from(catMap.entries())
    .map(([category, ts]) => ({
      category,
      topic_count: ts.length,
      avg_turbulence: Math.round(ts.reduce((s, t) => s + t.turbulence_score, 0) / ts.length),
      avg_instability: Math.round(ts.reduce((s, t) => s + t.instability, 0) / ts.length),
      top_topic: ts[0] ?? null,
    }))
    .sort((a, b) => b.avg_turbulence - a.avg_turbulence)
    .slice(0, 10)

  // Extreme swings: highest instability (closest to 50/50), regardless of volume
  const extreme_swings = [...topics]
    .sort((a, b) => b.instability - a.instability)
    .slice(0, 8)

  // Surging unstable: newest topics already showing turbulence
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const surging_unstable = topics
    .filter((t) => t.created_at > oneWeekAgo && t.turbulence_score >= 40)
    .slice(0, 8)

  return NextResponse.json({
    stats: {
      platform_turbulence_index,
      extreme_count,
      high_count,
      avg_instability,
      pct_turbulent,
      total_active: active,
    },
    top_turbulent: topics.slice(0, 20),
    category_breakdown,
    extreme_swings,
    surging_unstable,
    generated_at: new Date().toISOString(),
  } satisfies TurbulenceResponse)
}
