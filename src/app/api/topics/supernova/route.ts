import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 900 // 15-min cache — supernova signals are slow-moving

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupernovaClass =
  | 'nova'   // avg_rate ≥ 20× current — once blinding, now dark
  | 'flare'  // avg_rate ≥ 8× current — strong burst, faded fast
  | 'ember'  // avg_rate ≥ 3× current — notably above-average launch, cooling

export interface SupernovaTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  total_votes: number
  blue_pct: number
  /** Age of topic in days (rounded) */
  age_days: number
  /** Average votes/day across the topic's entire lifetime */
  avg_daily_rate: number
  /** Votes cast in the last 7 days */
  recent_7d_count: number
  /** Current daily vote rate (recent_7d / 7) */
  current_daily_rate: number
  /**
   * supernova_ratio = avg_daily_rate / max(0.1, current_daily_rate)
   * Higher = burned much hotter in its prime than today.
   */
  supernova_ratio: number
  supernova_class: SupernovaClass
  /** Estimated days until completely quiet at current decay trajectory */
  days_until_dark: number | null
}

export interface CategorySupernova {
  category: string
  topic_count: number
  avg_ratio: number
  nova_count: number
  flare_count: number
  ember_count: number
}

export interface SupernovaStats {
  total_supernovas: number
  nova_count: number
  flare_count: number
  ember_count: number
  max_ratio: number
  avg_ratio: number
  brightest_category: string | null
  /** Topics that have gone completely dark (0 votes last 7 days) */
  total_dark: number
}

export interface SupernovaResponse {
  nova: SupernovaTopic[]
  flare: SupernovaTopic[]
  ember: SupernovaTopic[]
  category_breakdown: CategorySupernova[]
  stats: SupernovaStats
  min_age_days: number
  generated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MIN_AGE_DAYS       = 14  // topic must be at least 2 weeks old
const MIN_TOTAL_VOTES    = 20  // must have non-trivial vote base
const MIN_AVG_DAILY      = 1.5 // must have averaged at least 1.5 votes/day in its lifetime
const EMBER_THRESHOLD    = 3   // ratio ≥ 3
const FLARE_THRESHOLD    = 8   // ratio ≥ 8
const NOVA_THRESHOLD     = 20  // ratio ≥ 20
const MAX_PER_CLASS      = 30

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()
  const minCreatedAt = new Date(now - MIN_AGE_DAYS * 86_400_000).toISOString()
  const recentStart  = new Date(now - 7 * 86_400_000).toISOString()

  // ── 1. Candidate topics (old enough + enough total votes) ──────────────────
  const { data: topicsData, error: topicsErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, created_at')
    .lt('created_at', minCreatedAt)
    .gte('total_votes', MIN_TOTAL_VOTES)
    .in('status', ['active', 'voting', 'law', 'failed', 'proposed'])
    .order('total_votes', { ascending: false })
    .limit(500)

  if (topicsErr) return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })

  const topics = topicsData ?? []
  if (topics.length === 0) return NextResponse.json(buildEmpty())

  const topicIds = topics.map((t) => t.id)

  // ── 2. Recent votes (last 7 days) for candidate topics ────────────────────
  const { data: recentVotes, error: recentErr } = await supabase
    .from('votes')
    .select('topic_id')
    .gte('created_at', recentStart)
    .in('topic_id', topicIds.slice(0, 400))
    .limit(50_000)

  if (recentErr) return NextResponse.json({ error: 'recent_votes_fetch' }, { status: 500 })

  // ── 3. Aggregate recent counts per topic ───────────────────────────────────
  const recentMap = new Map<string, number>()
  for (const v of recentVotes ?? []) {
    recentMap.set(v.topic_id, (recentMap.get(v.topic_id) ?? 0) + 1)
  }

  // ── 4. Compute supernova metrics per topic ─────────────────────────────────
  const results: SupernovaTopic[] = []

  for (const t of topics) {
    const createdMs = new Date(t.created_at as string).getTime()
    const ageDays   = Math.max(1, (now - createdMs) / 86_400_000)

    const avgDailyRate    = t.total_votes / ageDays
    const recent7d        = recentMap.get(t.id) ?? 0
    const currentDailyRate = recent7d / 7

    // Only surface topics that were meaningfully active in their prime
    if (avgDailyRate < MIN_AVG_DAILY) continue

    const ratio = avgDailyRate / Math.max(0.1, currentDailyRate)

    if (ratio < EMBER_THRESHOLD) continue

    const supernovaClass: SupernovaClass =
      ratio >= NOVA_THRESHOLD  ? 'nova'
      : ratio >= FLARE_THRESHOLD ? 'flare'
      : 'ember'

    // Estimate days until dark:
    // If recent_7d = 0 already dark.
    // Otherwise: extrapolate how many days until votes/day drops to < 0.1
    // We use exponential model: daysUntilDark ≈ ln(currentRate / 0.1) / ln(ratio/7)
    let daysUntilDark: number | null = null
    if (currentDailyRate > 0.1) {
      const weeklyDecayFactor = Math.max(0.01, currentDailyRate / avgDailyRate)
      if (weeklyDecayFactor < 0.99) {
        daysUntilDark = Math.round(
          (Math.log(currentDailyRate / 0.1) / Math.log(1 / weeklyDecayFactor)) * 7
        )
        if (daysUntilDark < 0 || daysUntilDark > 3650) daysUntilDark = null
      }
    }

    results.push({
      id:                t.id,
      statement:         t.statement,
      category:          t.category,
      status:            t.status,
      scope:             t.scope,
      total_votes:       t.total_votes,
      blue_pct:          t.blue_pct,
      age_days:          Math.round(ageDays),
      avg_daily_rate:    Math.round(avgDailyRate * 10) / 10,
      recent_7d_count:   recent7d,
      current_daily_rate: Math.round(currentDailyRate * 100) / 100,
      supernova_ratio:   Math.round(ratio * 10) / 10,
      supernova_class:   supernovaClass,
      days_until_dark:   daysUntilDark,
    })
  }

  // Sort within each class by ratio descending
  results.sort((a, b) => b.supernova_ratio - a.supernova_ratio)

  const nova  = results.filter((t) => t.supernova_class === 'nova').slice(0, MAX_PER_CLASS)
  const flare = results.filter((t) => t.supernova_class === 'flare').slice(0, MAX_PER_CLASS)
  const ember = results.filter((t) => t.supernova_class === 'ember').slice(0, MAX_PER_CLASS)

  // ── 5. Category breakdown ──────────────────────────────────────────────────
  const catMap = new Map<string, SupernovaTopic[]>()
  for (const t of results) {
    const cat = t.category ?? 'Other'
    const arr = catMap.get(cat) ?? []
    arr.push(t)
    catMap.set(cat, arr)
  }

  const category_breakdown: CategorySupernova[] = [...catMap.entries()]
    .map(([category, items]) => ({
      category,
      topic_count: items.length,
      avg_ratio: Math.round(
        (items.reduce((s, t) => s + t.supernova_ratio, 0) / items.length) * 10
      ) / 10,
      nova_count:  items.filter((t) => t.supernova_class === 'nova').length,
      flare_count: items.filter((t) => t.supernova_class === 'flare').length,
      ember_count: items.filter((t) => t.supernova_class === 'ember').length,
    }))
    .sort((a, b) => b.avg_ratio - a.avg_ratio)

  // ── 6. Platform stats ──────────────────────────────────────────────────────
  const total   = results.length
  const avgRatio = total > 0
    ? Math.round((results.reduce((s, t) => s + t.supernova_ratio, 0) / total) * 10) / 10
    : 0
  const maxRatio = total > 0
    ? Math.round(Math.max(...results.map((t) => t.supernova_ratio)) * 10) / 10
    : 0
  const totalDark = results.filter((t) => t.recent_7d_count === 0).length

  const stats: SupernovaStats = {
    total_supernovas: total,
    nova_count:  nova.length,
    flare_count: flare.length,
    ember_count: ember.length,
    max_ratio:   maxRatio,
    avg_ratio:   avgRatio,
    brightest_category: category_breakdown[0]?.category ?? null,
    total_dark:  totalDark,
  }

  return NextResponse.json({
    nova,
    flare,
    ember,
    category_breakdown,
    stats,
    min_age_days: MIN_AGE_DAYS,
    generated_at: new Date().toISOString(),
  } satisfies SupernovaResponse)
}

// ─── Empty fallback ───────────────────────────────────────────────────────────

function buildEmpty(): SupernovaResponse {
  return {
    nova: [],
    flare: [],
    ember: [],
    category_breakdown: [],
    stats: {
      total_supernovas: 0,
      nova_count: 0,
      flare_count: 0,
      ember_count: 0,
      max_ratio: 0,
      avg_ratio: 0,
      brightest_category: null,
      total_dark: 0,
    },
    min_age_days: 14,
    generated_at: new Date().toISOString(),
  }
}
