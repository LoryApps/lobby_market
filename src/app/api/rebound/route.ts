import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReboundClass =
  | 'phoenix'   // dormant 7+ days, now 5x+ daily average
  | 'revival'   // dormant 7+ days, now 2–5x daily average
  | 'stir'      // dormant topic, now 1.2–2x daily average

export interface ReboundTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  total_votes: number
  // Recent burst (last 24h)
  recent_votes: number
  // Dormancy baseline (days 8–30 ago)
  dormant_period_votes: number
  dormant_daily_avg: number       // dormant_period_votes / 22 days
  // Derived
  rebound_ratio: number           // recent_votes / max(dormant_daily_avg, 0.1)
  rebound_class: ReboundClass
  days_since_peak: number         // days since the topic last had ≥ recent_votes activity
  created_at: string
}

export interface CategoryRebound {
  category: string
  topic_count: number
  avg_rebound_ratio: number
  phoenix_count: number
  revival_count: number
  stir_count: number
}

export interface ReboundStats {
  total_rebounding: number
  phoenix_count: number
  revival_count: number
  stir_count: number
  avg_rebound_ratio: number
  top_category: string | null
  platform_rebound_signal: 'hot' | 'warm' | 'quiet'
}

export interface ReboundResponse {
  phoenix: ReboundTopic[]
  revival: ReboundTopic[]
  stir: ReboundTopic[]
  category_breakdown: CategoryRebound[]
  stats: ReboundStats
  generated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()

  // Time windows
  const RECENT_WINDOW_H = 24
  const DORMANT_START_DAYS = 8   // dormancy window starts 8 days ago
  const DORMANT_END_DAYS = 30    // dormancy window ends 30 days ago
  const DORMANT_WINDOW_DAYS = DORMANT_END_DAYS - DORMANT_START_DAYS // 22 days

  const recentSince = new Date(now - RECENT_WINDOW_H * 3_600_000).toISOString()
  const dormantSince = new Date(now - DORMANT_END_DAYS * 86_400_000).toISOString()
  const dormantUntil = new Date(now - DORMANT_START_DAYS * 86_400_000).toISOString()

  const MIN_RECENT_VOTES = 2
  const MIN_TOTAL_VOTES = 5
  const MIN_REBOUND_RATIO = 1.2  // at least 20% above dormancy baseline

  // ── 1. Fetch recent votes (last 24h) ───────────────────────────────────────
  const { data: recentData, error: recentErr } = await supabase
    .from('votes')
    .select('topic_id, side')
    .gte('created_at', recentSince)
    .limit(8000)

  if (recentErr) {
    return NextResponse.json({ error: recentErr.message }, { status: 500 })
  }

  const recentVotes = recentData ?? []

  // Aggregate recent votes per topic
  const recentByTopic = new Map<string, number>()
  for (const v of recentVotes) {
    recentByTopic.set(v.topic_id, (recentByTopic.get(v.topic_id) ?? 0) + 1)
  }

  // Topics with enough recent votes to qualify
  const candidateIds = [...recentByTopic.entries()]
    .filter(([, c]) => c >= MIN_RECENT_VOTES)
    .map(([id]) => id)
    .slice(0, 200)

  if (candidateIds.length === 0) {
    return NextResponse.json(buildEmpty())
  }

  // ── 2. Fetch dormancy-window votes (days 8–30 ago) for candidates ──────────
  const { data: dormantData, error: dormantErr } = await supabase
    .from('votes')
    .select('topic_id')
    .in('topic_id', candidateIds)
    .gte('created_at', dormantSince)
    .lte('created_at', dormantUntil)
    .limit(20000)

  if (dormantErr) {
    return NextResponse.json({ error: dormantErr.message }, { status: 500 })
  }

  const dormantByTopic = new Map<string, number>()
  for (const v of dormantData ?? []) {
    dormantByTopic.set(v.topic_id, (dormantByTopic.get(v.topic_id) ?? 0) + 1)
  }

  // ── 3. Fetch topic metadata ────────────────────────────────────────────────
  const { data: topicsData, error: topicsErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, created_at')
    .in('id', candidateIds)
    .gte('total_votes', MIN_TOTAL_VOTES)

  if (topicsErr) {
    return NextResponse.json({ error: topicsErr.message }, { status: 500 })
  }

  const topics = topicsData ?? []

  // ── 4. Compute rebound metrics ─────────────────────────────────────────────
  const reboundTopics: ReboundTopic[] = []

  for (const t of topics) {
    const recent = recentByTopic.get(t.id) ?? 0
    const dormant = dormantByTopic.get(t.id) ?? 0

    const dormant_daily_avg = dormant / DORMANT_WINDOW_DAYS
    // Use a floor of 0.25 votes/day so we don't divide by zero and so very cold
    // topics don't get astronomically inflated ratios from a single new vote
    const rebound_ratio = recent / Math.max(dormant_daily_avg, 0.25)

    if (rebound_ratio < MIN_REBOUND_RATIO) continue
    if (recent < MIN_RECENT_VOTES) continue

    // Classify rebound intensity
    let rebound_class: ReboundClass
    if (rebound_ratio >= 5) {
      rebound_class = 'phoenix'
    } else if (rebound_ratio >= 2) {
      rebound_class = 'revival'
    } else {
      rebound_class = 'stir'
    }

    // Rough estimate: days since peak based on how dormant the topic was
    // dormant_daily_avg = 0 means it was basically dead; higher = less dormant
    const days_since_peak = dormant_daily_avg < 0.5
      ? 20  // very dormant
      : dormant_daily_avg < 1
      ? 14
      : dormant_daily_avg < 2
      ? 10
      : 8

    reboundTopics.push({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      status: t.status,
      scope: (t as { scope?: string | null }).scope ?? null,
      total_votes: t.total_votes ?? 0,
      recent_votes: recent,
      dormant_period_votes: dormant,
      dormant_daily_avg: Math.round(dormant_daily_avg * 100) / 100,
      rebound_ratio: Math.round(rebound_ratio * 10) / 10,
      rebound_class,
      days_since_peak,
      created_at: t.created_at,
    })
  }

  // Sort by rebound_ratio descending
  reboundTopics.sort((a, b) => b.rebound_ratio - a.rebound_ratio)

  // ── 5. Partition ───────────────────────────────────────────────────────────
  const phoenix = reboundTopics.filter((t) => t.rebound_class === 'phoenix').slice(0, 20)
  const revival = reboundTopics.filter((t) => t.rebound_class === 'revival').slice(0, 20)
  const stir    = reboundTopics.filter((t) => t.rebound_class === 'stir').slice(0, 20)

  // ── 6. Category breakdown ──────────────────────────────────────────────────
  const catMap = new Map<string, ReboundTopic[]>()
  for (const t of reboundTopics) {
    const cat = t.category ?? 'Other'
    const arr = catMap.get(cat) ?? []
    arr.push(t)
    catMap.set(cat, arr)
  }

  const category_breakdown: CategoryRebound[] = [...catMap.entries()]
    .map(([category, items]) => ({
      category,
      topic_count: items.length,
      avg_rebound_ratio: Math.round(
        (items.reduce((s, t) => s + t.rebound_ratio, 0) / items.length) * 10
      ) / 10,
      phoenix_count: items.filter((t) => t.rebound_class === 'phoenix').length,
      revival_count: items.filter((t) => t.rebound_class === 'revival').length,
      stir_count: items.filter((t) => t.rebound_class === 'stir').length,
    }))
    .sort((a, b) => b.avg_rebound_ratio - a.avg_rebound_ratio)

  // ── 7. Platform stats ──────────────────────────────────────────────────────
  const total = reboundTopics.length
  const avgRatio = total > 0
    ? Math.round((reboundTopics.reduce((s, t) => s + t.rebound_ratio, 0) / total) * 10) / 10
    : 0

  const signal: ReboundStats['platform_rebound_signal'] =
    phoenix.length >= 5 ? 'hot'
    : total >= 5 ? 'warm'
    : 'quiet'

  const stats: ReboundStats = {
    total_rebounding: total,
    phoenix_count: phoenix.length,
    revival_count: revival.length,
    stir_count: stir.length,
    avg_rebound_ratio: avgRatio,
    top_category: category_breakdown[0]?.category ?? null,
    platform_rebound_signal: signal,
  }

  return NextResponse.json({
    phoenix,
    revival,
    stir,
    category_breakdown,
    stats,
    generated_at: new Date().toISOString(),
  } satisfies ReboundResponse)
}

// ─── Empty response helper ────────────────────────────────────────────────────

function buildEmpty(): ReboundResponse {
  return {
    phoenix: [],
    revival: [],
    stir: [],
    category_breakdown: [],
    stats: {
      total_rebounding: 0,
      phoenix_count: 0,
      revival_count: 0,
      stir_count: 0,
      avg_rebound_ratio: 0,
      top_category: null,
      platform_rebound_signal: 'quiet',
    },
    generated_at: new Date().toISOString(),
  }
}
