import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LiquidityMarket {
  id: string
  statement: string
  category: string | null
  price: number
  volume: number
  liquidity_score: number
  swing_score: number
  status: string
}

export interface CategoryLiquidity {
  category: string
  avg_volume: number
  total_volume: number
  market_count: number
  liquidity_score: number
  color: string
}

export interface LiquidityStats {
  total_markets: number
  total_volume: number
  avg_volume: number
  median_volume: number
  thin_market_count: number
  liquid_market_count: number
  swing_zone_count: number
}

export interface LiquidityResponse {
  stats: LiquidityStats
  thin_markets: LiquidityMarket[]
  liquid_markets: LiquidityMarket[]
  swing_markets: LiquidityMarket[]
  category_breakdown: CategoryLiquidity[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function liquidityScore(votes: number): number {
  if (votes <= 0) return 0
  return Math.min(100, Math.round((Math.log1p(votes) / Math.log1p(1000)) * 100))
}

function swingScore(votes: number, price: number): number {
  const liq = liquidityScore(votes)
  const centrality = 1 - Math.abs(price - 50) / 50
  return Math.round(((100 - liq) / 100) * centrality * 100)
}

const CAT_COLOR: Record<string, string> = {
  Economics:   '#F59E0B',
  Politics:    '#3B82F6',
  Technology:  '#8B5CF6',
  Science:     '#10B981',
  Ethics:      '#EC4899',
  Philosophy:  '#6366F1',
  Culture:     '#F97316',
  Health:      '#EF4444',
  Environment: '#22C55E',
  Education:   '#06B6D4',
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, status')
    .in('status', ['active', 'voting'])
    .order('total_votes', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const markets: LiquidityMarket[] = (rows ?? []).map((r) => ({
    id: r.id,
    statement: r.statement,
    category: r.category,
    price: Math.round(r.blue_pct ?? 50),
    volume: r.total_votes ?? 0,
    liquidity_score: liquidityScore(r.total_votes ?? 0),
    swing_score: swingScore(r.total_votes ?? 0, Math.round(r.blue_pct ?? 50)),
    status: r.status,
  }))

  if (markets.length === 0) {
    return NextResponse.json({
      stats: { total_markets: 0, total_volume: 0, avg_volume: 0, median_volume: 0, thin_market_count: 0, liquid_market_count: 0, swing_zone_count: 0 },
      thin_markets: [],
      liquid_markets: [],
      swing_markets: [],
      category_breakdown: [],
    })
  }

  // Stats
  const volumes = markets.map((m) => m.volume).sort((a, b) => a - b)
  const total_volume = volumes.reduce((s, v) => s + v, 0)
  const avg_volume = Math.round(total_volume / volumes.length)
  const median_volume = volumes[Math.floor(volumes.length / 2)]
  const thin_market_count = markets.filter((m) => m.liquidity_score < 30).length
  const liquid_market_count = markets.filter((m) => m.liquidity_score >= 70).length
  const swing_zone_count = markets.filter((m) => m.swing_score >= 60).length

  // Thin markets (lowest volume, still active)
  const thin_markets = [...markets]
    .sort((a, b) => a.volume - b.volume)
    .slice(0, 20)

  // Liquid markets (highest volume)
  const liquid_markets = [...markets]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 20)

  // Swing markets (highest swing score)
  const swing_markets = [...markets]
    .sort((a, b) => b.swing_score - a.swing_score)
    .slice(0, 20)

  // Category breakdown
  const byCategory = new Map<string, { total_votes: number; count: number }>()
  for (const m of markets) {
    const cat = m.category ?? 'Other'
    const existing = byCategory.get(cat) ?? { total_votes: 0, count: 0 }
    byCategory.set(cat, {
      total_votes: existing.total_votes + m.volume,
      count: existing.count + 1,
    })
  }

  const category_breakdown: CategoryLiquidity[] = Array.from(byCategory.entries())
    .map(([category, { total_votes, count }]) => ({
      category,
      avg_volume: Math.round(total_votes / count),
      total_volume: total_votes,
      market_count: count,
      liquidity_score: liquidityScore(Math.round(total_votes / count)),
      color: CAT_COLOR[category] ?? '#6B7280',
    }))
    .sort((a, b) => b.avg_volume - a.avg_volume)

  return NextResponse.json({
    stats: {
      total_markets: markets.length,
      total_volume,
      avg_volume,
      median_volume,
      thin_market_count,
      liquid_market_count,
      swing_zone_count,
    },
    thin_markets,
    liquid_markets,
    swing_markets,
    category_breakdown,
  } satisfies LiquidityResponse)
}
