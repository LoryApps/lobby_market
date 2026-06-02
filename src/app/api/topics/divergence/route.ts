import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5-min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export type DivergenceClass =
  | 'fracture'  // |swing| ≥ 30pp — opinion reversed dramatically
  | 'rupture'   // |swing| ≥ 20pp — strong directional flip
  | 'split'     // |swing| ≥ 12pp — measurable week-over-week instability

export interface DivergenceTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  total_votes: number
  blue_pct: number
  // Window A = votes from 0–7 days ago (most recent)
  window_a_pct: number
  window_a_count: number
  // Window B = votes from 7–14 days ago (prior week)
  window_b_pct: number
  window_b_count: number
  // swing = window_a_pct − window_b_pct
  // positive: community shifted FOR recently
  // negative: community shifted AGAINST recently
  swing: number
  divergence_class: DivergenceClass
}

export interface CategoryDivergence {
  category: string
  topic_count: number
  avg_swing: number
  fracture_count: number
  rupture_count: number
  split_count: number
}

export interface DivergenceStats {
  total_diverging: number
  fracture_count: number
  rupture_count: number
  split_count: number
  max_swing: number
  avg_swing: number
  most_volatile_category: string | null
  platform_stability: 'volatile' | 'unstable' | 'settling'
}

export interface DivergenceResponse {
  fracture: DivergenceTopic[]
  rupture: DivergenceTopic[]
  split: DivergenceTopic[]
  category_breakdown: CategoryDivergence[]
  stats: DivergenceStats
  window_days: number
  generated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const WINDOW_DAYS = 7
const MIN_WINDOW_VOTES = 4   // each window must have at least this many votes
const MIN_TOTAL_VOTES  = 20  // topic must have a meaningful vote base
const SPLIT_THRESHOLD    = 12
const RUPTURE_THRESHOLD  = 20
const FRACTURE_THRESHOLD = 30
const MAX_PER_CLASS = 25

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()
  const windowAStart = new Date(now - WINDOW_DAYS * 86_400_000).toISOString()
  const windowBStart = new Date(now - 2 * WINDOW_DAYS * 86_400_000).toISOString()
  const windowBEnd   = windowAStart // window B ends where window A starts

  // ── 1. Fetch votes in window A (last 7 days) ────────────────────────────────
  const { data: aVotes, error: aErr } = await supabase
    .from('votes')
    .select('topic_id, side')
    .gte('created_at', windowAStart)
    .limit(60_000)

  if (aErr) return NextResponse.json({ error: 'votes_a_fetch' }, { status: 500 })

  // ── 2. Fetch votes in window B (7–14 days ago) ──────────────────────────────
  const { data: bVotes, error: bErr } = await supabase
    .from('votes')
    .select('topic_id, side')
    .gte('created_at', windowBStart)
    .lt('created_at', windowBEnd)
    .limit(60_000)

  if (bErr) return NextResponse.json({ error: 'votes_b_fetch' }, { status: 500 })

  // ── 3. Aggregate per topic ───────────────────────────────────────────────────

  function aggregate(votes: { topic_id: string; side: string }[]) {
    const forMap = new Map<string, number>()
    const totMap = new Map<string, number>()
    for (const v of votes) {
      totMap.set(v.topic_id, (totMap.get(v.topic_id) ?? 0) + 1)
      if (v.side === 'blue') forMap.set(v.topic_id, (forMap.get(v.topic_id) ?? 0) + 1)
    }
    return { forMap, totMap }
  }

  const A = aggregate(aVotes ?? [])
  const B = aggregate(bVotes ?? [])

  // Topics that appear in both windows with enough votes
  const topicIds = new Set([...A.totMap.keys(), ...B.totMap.keys()])
  const candidates: string[] = []
  for (const tid of topicIds) {
    const aCount = A.totMap.get(tid) ?? 0
    const bCount = B.totMap.get(tid) ?? 0
    if (aCount >= MIN_WINDOW_VOTES && bCount >= MIN_WINDOW_VOTES) {
      candidates.push(tid)
    }
  }

  if (candidates.length === 0) return NextResponse.json(buildEmpty())

  // ── 4. Fetch topic metadata ──────────────────────────────────────────────────
  const { data: topicsData, error: topicsErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes')
    .in('id', candidates.slice(0, 400))
    .gte('total_votes', MIN_TOTAL_VOTES)
    .not('blue_pct', 'is', null)

  if (topicsErr) return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })

  // ── 5. Compute divergence ────────────────────────────────────────────────────
  const results: DivergenceTopic[] = []

  for (const t of topicsData ?? []) {
    const aCount = A.totMap.get(t.id) ?? 0
    const bCount = B.totMap.get(t.id) ?? 0
    if (aCount < MIN_WINDOW_VOTES || bCount < MIN_WINDOW_VOTES) continue

    const aFor = A.forMap.get(t.id) ?? 0
    const bFor = B.forMap.get(t.id) ?? 0

    const aPct = (aFor / aCount) * 100
    const bPct = (bFor / bCount) * 100
    const swing = aPct - bPct

    const absSwing = Math.abs(swing)
    if (absSwing < SPLIT_THRESHOLD) continue

    const divergence_class: DivergenceClass =
      absSwing >= FRACTURE_THRESHOLD ? 'fracture'
      : absSwing >= RUPTURE_THRESHOLD ? 'rupture'
      : 'split'

    results.push({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      status: t.status,
      scope: (t as { scope?: string | null }).scope ?? null,
      total_votes: t.total_votes ?? 0,
      blue_pct: Math.round((t.blue_pct ?? 50) * 10) / 10,
      window_a_pct: Math.round(aPct * 10) / 10,
      window_a_count: aCount,
      window_b_pct: Math.round(bPct * 10) / 10,
      window_b_count: bCount,
      swing: Math.round(swing * 10) / 10,
      divergence_class,
    })
  }

  // Sort by absolute swing descending
  results.sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing))

  // ── 6. Partition ─────────────────────────────────────────────────────────────
  const fracture = results.filter((t) => t.divergence_class === 'fracture').slice(0, MAX_PER_CLASS)
  const rupture  = results.filter((t) => t.divergence_class === 'rupture').slice(0, MAX_PER_CLASS)
  const split    = results.filter((t) => t.divergence_class === 'split').slice(0, MAX_PER_CLASS)

  // ── 7. Category breakdown ─────────────────────────────────────────────────────
  const catMap = new Map<string, DivergenceTopic[]>()
  for (const t of results) {
    const cat = t.category ?? 'Other'
    const arr = catMap.get(cat) ?? []
    arr.push(t)
    catMap.set(cat, arr)
  }

  const category_breakdown: CategoryDivergence[] = [...catMap.entries()]
    .map(([category, items]) => ({
      category,
      topic_count: items.length,
      avg_swing: Math.round(
        (items.reduce((s, t) => s + Math.abs(t.swing), 0) / items.length) * 10
      ) / 10,
      fracture_count: items.filter((t) => t.divergence_class === 'fracture').length,
      rupture_count:  items.filter((t) => t.divergence_class === 'rupture').length,
      split_count:    items.filter((t) => t.divergence_class === 'split').length,
    }))
    .sort((a, b) => b.avg_swing - a.avg_swing)

  // ── 8. Platform stats ─────────────────────────────────────────────────────────
  const total = results.length
  const avgSwing = total > 0
    ? Math.round((results.reduce((s, t) => s + Math.abs(t.swing), 0) / total) * 10) / 10
    : 0
  const maxSwing = total > 0
    ? Math.round(Math.max(...results.map((t) => Math.abs(t.swing))) * 10) / 10
    : 0

  const stability: DivergenceStats['platform_stability'] =
    fracture.length >= 5 ? 'volatile'
    : rupture.length >= 5 || total >= 10 ? 'unstable'
    : 'settling'

  const stats: DivergenceStats = {
    total_diverging: total,
    fracture_count: fracture.length,
    rupture_count: rupture.length,
    split_count: split.length,
    max_swing: maxSwing,
    avg_swing: avgSwing,
    most_volatile_category: category_breakdown[0]?.category ?? null,
    platform_stability: stability,
  }

  return NextResponse.json({
    fracture,
    rupture,
    split,
    category_breakdown,
    stats,
    window_days: WINDOW_DAYS,
    generated_at: new Date().toISOString(),
  } satisfies DivergenceResponse)
}

// ─── Empty helper ─────────────────────────────────────────────────────────────

function buildEmpty(): DivergenceResponse {
  return {
    fracture: [],
    rupture: [],
    split: [],
    category_breakdown: [],
    stats: {
      total_diverging: 0,
      fracture_count: 0,
      rupture_count: 0,
      split_count: 0,
      max_swing: 0,
      avg_swing: 0,
      most_volatile_category: null,
      platform_stability: 'settling',
    },
    window_days: 7,
    generated_at: new Date().toISOString(),
  }
}
