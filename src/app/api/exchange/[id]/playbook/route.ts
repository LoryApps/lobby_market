import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MarketStage =
  | 'early'        // < 100 votes, price still forming
  | 'building'     // 100–500 votes, trend emerging
  | 'contested'    // near 50%, active debate
  | 'converging'   // moving steadily toward resolution
  | 'mature'       // high volume, price stable
  | 'law'          // resolved as law
  | 'failed'       // rejected

export type TrendDirection = 'rising' | 'falling' | 'flat' | 'volatile'

export interface PriceLevel {
  pct: number
  label: string
  description: string
  color: string
}

export interface CategoryBenchmark {
  category: string
  total_resolved: number
  resolved_as_law: number
  law_rate: number               // 0–1
  avg_resolution_votes: number
  avg_peak_for_pct: number
  avg_for_at_resolution: number
}

export interface PlaybookSignal {
  id: string
  label: string
  description: string
  strength: 'strong' | 'moderate' | 'weak'
  direction: 'for' | 'against' | 'neutral'
}

export interface PlaybookData {
  market: {
    id: string
    statement: string
    category: string | null
    status: string
    price: number             // blue_pct
    volume: number
    blue_votes: number
    red_votes: number
    created_at: string
    voting_ends_at: string | null
  }
  stage: MarketStage
  trend: TrendDirection
  trend_delta: number           // price change over last 5 snapshots
  recent_snapshots: Array<{ price: number; volume: number; recorded_at: string }>
  price_levels: PriceLevel[]
  signals: PlaybookSignal[]
  benchmark: CategoryBenchmark | null
  similar_resolved: Array<{
    id: string
    statement: string
    final_price: number
    resolved_as: 'law' | 'failed'
    total_votes: number
  }>
  days_active: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectStage(
  status: string,
  volume: number,
  price: number,
): MarketStage {
  if (status === 'law') return 'law'
  if (status === 'failed') return 'failed'
  if (volume < 100) return 'early'
  if (volume < 500) return 'building'
  const dist = Math.abs(price - 50)
  if (dist < 8) return 'contested'
  if (volume >= 2000 && dist >= 15) return 'mature'
  return 'converging'
}

function detectTrend(
  snapshots: Array<{ price: number }>,
): { direction: TrendDirection; delta: number } {
  if (snapshots.length < 3) return { direction: 'flat', delta: 0 }
  const recent = snapshots.slice(-5)
  const first = recent[0].price
  const last = recent[recent.length - 1].price
  const delta = last - first
  if (Math.abs(delta) < 2) {
    // Check volatility
    const prices = recent.map((s) => s.price)
    const max = Math.max(...prices)
    const min = Math.min(...prices)
    if (max - min > 8) return { direction: 'volatile', delta }
    return { direction: 'flat', delta }
  }
  return { direction: delta > 0 ? 'rising' : 'falling', delta }
}

function buildPriceLevels(price: number): PriceLevel[] {
  return [
    {
      pct: 80,
      label: 'Strong Consensus',
      description: 'FOR side holds an 80%+ supermajority — historically very likely to become law.',
      color: 'emerald',
    },
    {
      pct: 65,
      label: 'Clear Majority',
      description: 'FOR leads convincingly. Historically resolves FOR in ~70% of cases at this level.',
      color: 'for',
    },
    {
      pct: 50,
      label: 'Deadlock',
      description: 'Market is evenly split. Either side can still win — follow the debate closely.',
      color: 'surface',
    },
    {
      pct: 35,
      label: 'AGAINST Lead',
      description: 'AGAINST side leads. Market likely to fail unless sentiment shifts significantly.',
      color: 'against',
    },
    {
      pct: 20,
      label: 'Strong Rejection',
      description: 'Heavy AGAINST consensus. Market on track to fail.',
      color: 'against',
    },
  ].map((level) => ({
    ...level,
    active: price >= level.pct - 7 && price <= level.pct + 7,
  })) as PriceLevel[]
}

function buildSignals(
  price: number,
  volume: number,
  trend: TrendDirection,
  trendDelta: number,
  stage: MarketStage,
  snapshot_count: number,
): PlaybookSignal[] {
  const signals: PlaybookSignal[] = []

  // Trend signal
  if (trend === 'rising' && trendDelta >= 5) {
    signals.push({
      id: 'momentum_for',
      label: 'FOR Momentum',
      description: `Price has risen ${Math.round(trendDelta)}¢ over the last ${Math.min(5, snapshot_count)} snapshots. FOR side is gaining.`,
      strength: trendDelta >= 10 ? 'strong' : 'moderate',
      direction: 'for',
    })
  } else if (trend === 'falling' && Math.abs(trendDelta) >= 5) {
    signals.push({
      id: 'momentum_against',
      label: 'AGAINST Momentum',
      description: `Price has fallen ${Math.round(Math.abs(trendDelta))}¢ over the last ${Math.min(5, snapshot_count)} snapshots. AGAINST is gaining ground.`,
      strength: Math.abs(trendDelta) >= 10 ? 'strong' : 'moderate',
      direction: 'against',
    })
  } else if (trend === 'volatile') {
    signals.push({
      id: 'volatility',
      label: 'High Volatility',
      description: 'Price is swinging sharply — new arguments or votes are creating rapid consensus shifts.',
      strength: 'moderate',
      direction: 'neutral',
    })
  } else if (trend === 'flat' && stage === 'mature') {
    signals.push({
      id: 'stable',
      label: 'Price Stable',
      description: 'Consensus is holding steady. Market has reached equilibrium — major shifts need new catalysts.',
      strength: 'weak',
      direction: 'neutral',
    })
  }

  // Price level signals
  if (price >= 75) {
    signals.push({
      id: 'near_law',
      label: 'Near Law Threshold',
      description: `At ${Math.round(price)}¢ FOR, this market is approaching the supermajority needed to establish as law.`,
      strength: price >= 85 ? 'strong' : 'moderate',
      direction: 'for',
    })
  } else if (price <= 25) {
    signals.push({
      id: 'near_fail',
      label: 'Near Failure Threshold',
      description: `At ${Math.round(price)}¢ FOR, this market is approaching the point where AGAINST consensus becomes decisive.`,
      strength: price <= 15 ? 'strong' : 'moderate',
      direction: 'against',
    })
  } else if (Math.abs(price - 50) <= 5) {
    signals.push({
      id: 'deadlock',
      label: 'Deadlock',
      description: 'The market is split almost evenly. New arguments and high-quality debate will determine the outcome.',
      strength: 'strong',
      direction: 'neutral',
    })
  }

  // Volume signals
  if (stage === 'early') {
    signals.push({
      id: 'low_volume',
      label: 'Low Volume',
      description: `With only ${volume} votes, this market is still forming. Early positions have the most price impact.`,
      strength: 'moderate',
      direction: 'neutral',
    })
  } else if (volume >= 5000) {
    signals.push({
      id: 'high_conviction',
      label: 'High Conviction',
      description: `${volume.toLocaleString()} votes cast — strong community conviction. The consensus here is battle-tested.`,
      strength: 'strong',
      direction: price >= 55 ? 'for' : price <= 45 ? 'against' : 'neutral',
    })
  }

  return signals
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  // 1. Fetch the market (topic)
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select(
      'id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes, created_at, voting_ends_at',
    )
    .eq('id', params.id)
    .maybeSingle()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  // 2. Price history — most recent 20 snapshots
  const { data: history } = await supabase
    .from('topic_price_history')
    .select('price, volume, recorded_at')
    .eq('topic_id', params.id)
    .order('recorded_at', { ascending: false })
    .limit(20)

  const snapshots = (history ?? []).reverse() // oldest-first

  // 3. Category benchmark — resolved topics in the same category
  let benchmark: CategoryBenchmark | null = null
  if (topic.category) {
    const { data: resolved } = await supabase
      .from('topics')
      .select('status, blue_pct, total_votes, created_at, updated_at')
      .eq('category', topic.category)
      .in('status', ['law', 'failed'])
      .not('id', 'eq', params.id)
      .limit(100)

    if (resolved && resolved.length > 0) {
      const lawCount = resolved.filter((t) => t.status === 'law').length
      const avgVotes = Math.round(
        resolved.reduce((sum, t) => sum + (t.total_votes ?? 0), 0) / resolved.length,
      )
      const lawTopics = resolved.filter((t) => t.status === 'law')
      const avgForAtRes =
        lawTopics.length > 0
          ? Math.round(
              lawTopics.reduce((sum, t) => sum + (t.blue_pct ?? 50), 0) / lawTopics.length,
            )
          : 50

      benchmark = {
        category: topic.category,
        total_resolved: resolved.length,
        resolved_as_law: lawCount,
        law_rate: lawCount / resolved.length,
        avg_resolution_votes: avgVotes,
        avg_peak_for_pct: avgForAtRes,
        avg_for_at_resolution: avgForAtRes,
      }
    }
  }

  // 4. Similar resolved markets — same category, resolved
  const { data: similarRaw } = topic.category
    ? await supabase
        .from('topics')
        .select('id, statement, blue_pct, total_votes, status')
        .eq('category', topic.category)
        .in('status', ['law', 'failed'])
        .not('id', 'eq', params.id)
        .order('total_votes', { ascending: false })
        .limit(5)
    : { data: [] }

  const similar = (similarRaw ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    final_price: Math.round(t.blue_pct ?? 50),
    resolved_as: t.status as 'law' | 'failed',
    total_votes: t.total_votes ?? 0,
  }))

  // 5. Compute derived values
  const price = topic.blue_pct ?? 50
  const volume = topic.total_votes ?? 0
  const stage = detectStage(topic.status, volume, price)
  const { direction: trend, delta: trendDelta } = detectTrend(snapshots)
  const priceLevels = buildPriceLevels(price)
  const signals = buildSignals(price, volume, trend, trendDelta, stage, snapshots.length)

  const createdAt = new Date(topic.created_at).getTime()
  const daysActive = Math.floor((Date.now() - createdAt) / 86_400_000)

  const payload: PlaybookData = {
    market: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      price,
      volume,
      blue_votes: topic.blue_votes ?? 0,
      red_votes: topic.red_votes ?? 0,
      created_at: topic.created_at,
      voting_ends_at: topic.voting_ends_at,
    },
    stage,
    trend,
    trend_delta: trendDelta,
    recent_snapshots: snapshots.slice(-10).map((s) => ({
      price: s.price,
      volume: s.volume,
      recorded_at: s.recorded_at,
    })),
    price_levels: priceLevels,
    signals,
    benchmark,
    similar_resolved: similar,
    days_active: daysActive,
  }

  return NextResponse.json(payload)
}
