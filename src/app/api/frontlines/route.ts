import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FrontlineTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  red_pct: number
  total_votes: number
  created_at: string
  updated_at: string
  margin: number       // |blue_pct - 50| — lower = more contested
  tier: 'battle-zone' | 'contested' | 'leaning'
  lean: 'blue' | 'red' | 'deadlock'
  votes_needed: number // approximate votes that would tip the balance
}

export interface FrontlineCategory {
  category: string
  battle_zone: number
  contested: number
  leaning: number
  avg_margin: number
}

export interface FrontlinesStats {
  total_active: number
  battle_zone_count: number
  contested_count: number
  leaning_count: number
  hottest_category: string | null
  narrowest_margin: number
  total_votes_at_stake: number
  most_active_category: string | null
}

export interface FrontlinesResponse {
  battle_zone: FrontlineTopic[]
  contested: FrontlineTopic[]
  leaning: FrontlineTopic[]
  category_breakdown: FrontlineCategory[]
  stats: FrontlinesStats
  updated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyTier(margin: number): FrontlineTopic['tier'] {
  if (margin <= 5) return 'battle-zone'
  if (margin <= 15) return 'contested'
  return 'leaning'
}

function computeVotesNeeded(blue_pct: number, total_votes: number): number {
  // How many votes on the trailing side would flip the debate to 50/50?
  if (total_votes === 0) return 0
  const blue_votes = Math.round((blue_pct / 100) * total_votes)
  const red_votes  = total_votes - blue_votes

  if (blue_pct >= 50) {
    // Blue is winning; how many red votes to tie?
    // blue_votes = red_votes + x  →  x = blue_votes - red_votes
    return Math.max(0, blue_votes - red_votes)
  } else {
    return Math.max(0, red_votes - blue_votes)
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: rawTopics, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, created_at, updated_at')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 3)
    .order('total_votes', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 })
  }

  const topics = (rawTopics ?? [])
    .filter((t) => t.blue_pct !== null)
    .map((t) => {
      const blue = t.blue_pct ?? 50
      const margin = Math.abs(blue - 50)
      return {
        id:           t.id,
        statement:    t.statement,
        category:     t.category,
        status:       t.status,
        scope:        t.scope,
        blue_pct:     Math.round(blue * 10) / 10,
        red_pct:      Math.round((100 - blue) * 10) / 10,
        total_votes:  t.total_votes ?? 0,
        created_at:   t.created_at,
        updated_at:   t.updated_at,
        margin:       Math.round(margin * 10) / 10,
        tier:         classifyTier(margin) as FrontlineTopic['tier'],
        lean:         blue > 50.5 ? 'blue' : blue < 49.5 ? 'red' : 'deadlock' as FrontlineTopic['lean'],
        votes_needed: computeVotesNeeded(blue, t.total_votes ?? 0),
      } satisfies FrontlineTopic
    })
    // Sort by margin ascending (narrowest = most contested first)
    .sort((a, b) => a.margin - b.margin || b.total_votes - a.total_votes)

  const battle_zone = topics.filter((t) => t.tier === 'battle-zone')
  const contested   = topics.filter((t) => t.tier === 'contested')
  const leaning     = topics.filter((t) => t.tier === 'leaning')

  // ── Category breakdown ─────────────────────────────────────────────────────
  const catAgg = new Map<string, { bz: number; c: number; l: number; marginSum: number; count: number }>()
  for (const t of topics) {
    const cat = t.category ?? 'Other'
    if (!catAgg.has(cat)) catAgg.set(cat, { bz: 0, c: 0, l: 0, marginSum: 0, count: 0 })
    const a = catAgg.get(cat)!
    if (t.tier === 'battle-zone') a.bz++
    else if (t.tier === 'contested') a.c++
    else a.l++
    a.marginSum += t.margin
    a.count++
  }

  const category_breakdown: FrontlineCategory[] = Array.from(catAgg.entries())
    .map(([category, a]) => ({
      category,
      battle_zone: a.bz,
      contested:   a.c,
      leaning:     a.l,
      avg_margin:  a.count > 0 ? Math.round((a.marginSum / a.count) * 10) / 10 : 0,
    }))
    .sort((a, b) => (b.battle_zone + b.contested) - (a.battle_zone + a.contested))

  // ── Platform stats ─────────────────────────────────────────────────────────
  const hottest_category = category_breakdown.find((c) => c.battle_zone > 0)?.category ??
    category_breakdown[0]?.category ?? null

  // Category with most debate activity (highest total topics in bz+contested)
  const most_active_category = category_breakdown
    .sort((a, b) => (b.battle_zone + b.contested) - (a.battle_zone + a.contested))[0]?.category ?? null

  const stats: FrontlinesStats = {
    total_active:       topics.length,
    battle_zone_count:  battle_zone.length,
    contested_count:    contested.length,
    leaning_count:      leaning.length,
    hottest_category,
    narrowest_margin:   topics[0]?.margin ?? 0,
    total_votes_at_stake: topics.reduce((s, t) => s + t.total_votes, 0),
    most_active_category,
  }

  return NextResponse.json({
    battle_zone,
    contested,
    leaning,
    category_breakdown,
    stats,
    updated_at: new Date().toISOString(),
  } satisfies FrontlinesResponse, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=30' },
  })
}
