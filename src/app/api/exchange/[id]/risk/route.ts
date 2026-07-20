import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface MarketRiskDimension {
  key: string
  label: string
  score: number       // 0–100, higher = more risk
  grade: RiskGrade
  insight: string
  metric: string      // human-readable measured value
}

export interface RiskSignal {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  label: string
  description: string
  direction: 'bullish' | 'bearish' | 'neutral'
}

export interface CoalitionSide {
  name: string
  member_count: number
  stance: 'for' | 'against' | 'neutral'
}

export interface MarketRiskResponse {
  topic_id: string
  statement: string
  category: string | null
  status: string
  price: number
  volume: number

  // Composite
  composite_score: number
  composite_grade: RiskGrade
  composite_label: string

  // Six dimensions
  dimensions: MarketRiskDimension[]

  // Specific signals
  risk_signals: RiskSignal[]

  // Coalition breakdown
  coalition_sides: {
    for: CoalitionSide[]
    against: CoalitionSide[]
    neutral: CoalitionSide[]
  }

  // Derived metrics
  price_at_risk: number      // estimated max ¢ move in next 7 days
  argument_balance: number   // 0-100, 50 = balanced, >50 = FOR-heavy
  vol_7d: number | null      // price change magnitude over 7 days (absolute)
  days_to_close: number | null

  as_of: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function grade(score: number): RiskGrade {
  if (score <= 20) return 'A'
  if (score <= 40) return 'B'
  if (score <= 60) return 'C'
  if (score <= 75) return 'D'
  return 'F'
}

function compositeLabel(score: number): string {
  if (score <= 20) return 'Low Risk'
  if (score <= 40) return 'Moderate Risk'
  if (score <= 60) return 'Elevated Risk'
  if (score <= 75) return 'High Risk'
  return 'Critical Risk'
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function stdDev(vals: number[]): number {
  if (vals.length < 2) return 0
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length
  return Math.sqrt(variance)
}

// ─── GET /api/exchange/[id]/risk ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    // ── 1. Core topic ──────────────────────────────────────────────────────────
    const { data: topic } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at, voting_ends_at, feed_score')
      .eq('id', id)
      .maybeSingle()

    if (!topic) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 })
    }

    const price  = Math.round(topic.blue_pct ?? 50)
    const volume = topic.total_votes ?? 0
    const nowMs  = Date.now()

    // ── 2. Price history (last 60 snapshots) ───────────────────────────────────
    const { data: priceRows } = await supabase
      .from('topic_price_history')
      .select('recorded_at, price')
      .eq('topic_id', id)
      .order('recorded_at', { ascending: false })
      .limit(60)

    const priceTicks = (priceRows ?? []).map(r => ({
      ts: r.recorded_at as string,
      price: Math.round((r.price ?? 0.5) * 100),
    })).reverse()

    const prices = priceTicks.map(t => t.price)

    // 7-day price change
    const ms7d = 7 * 24 * 60 * 60 * 1000
    const cutoff7d = nowMs - ms7d
    const old7d = priceTicks.filter(t => new Date(t.ts).getTime() <= cutoff7d)
    const price7dAgo = old7d.length > 0 ? old7d[old7d.length - 1].price : null
    const vol7d = price7dAgo !== null ? Math.abs(price - price7dAgo) : null

    // Historical volatility (std dev of price snapshots)
    const historicalVol = stdDev(prices)
    const priceAtRisk   = Math.round(clamp(historicalVol * 2.5, 0, 50))

    // ── 3. Arguments (for/against balance) ────────────────────────────────────
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select('side, upvotes')
      .eq('topic_id', id)
      .limit(200)

    const args = (argRows ?? []) as Array<{ side: string; upvotes: number }>
    const forArgs     = args.filter(a => a.side === 'blue')
    const _againstArgs = args.filter(a => a.side === 'red')
    const totalArgs   = args.length
    const forPct      = totalArgs > 0 ? (forArgs.length / totalArgs) * 100 : 50
    const argumentBalance = Math.round(forPct)

    // ── 4. Coalition stances (two-step) ───────────────────────────────────────
    const { data: stanceRows } = await supabase
      .from('coalition_stances')
      .select('coalition_id, stance')
      .eq('topic_id', id)
      .limit(50)

    const stances = (stanceRows ?? []) as Array<{ coalition_id: string; stance: string }>
    const coalitionIds = stances.map(s => s.coalition_id)

    const coalitionMap: Record<string, { name: string; member_count: number }> = {}
    if (coalitionIds.length > 0) {
      const { data: coalRows } = await supabase
        .from('coalitions')
        .select('id, name, member_count')
        .in('id', coalitionIds)
        .limit(50)
      for (const c of coalRows ?? []) {
        coalitionMap[c.id] = { name: c.name, member_count: c.member_count ?? 0 }
      }
    }

    const coalitionFor: CoalitionSide[]     = []
    const coalitionAgainst: CoalitionSide[] = []
    const coalitionNeutral: CoalitionSide[] = []

    for (const s of stances) {
      const c = coalitionMap[s.coalition_id]
      if (!c) continue
      const entry: CoalitionSide = { name: c.name, member_count: c.member_count, stance: s.stance as 'for' | 'against' | 'neutral' }
      if (s.stance === 'for')     coalitionFor.push(entry)
      else if (s.stance === 'against') coalitionAgainst.push(entry)
      else coalitionNeutral.push(entry)
    }

    // ── 5. Deadline ────────────────────────────────────────────────────────────
    let daysToClose: number | null = null
    if (topic.voting_ends_at) {
      const msLeft = new Date(topic.voting_ends_at).getTime() - nowMs
      daysToClose = msLeft > 0 ? Math.ceil(msLeft / (1000 * 60 * 60 * 24)) : 0
    }

    // ── 6. Debates (upcoming) ─────────────────────────────────────────────────
    const { data: debateRows } = await supabase
      .from('debates')
      .select('id, scheduled_at, status')
      .eq('topic_id', id)
      .eq('status', 'scheduled')
      .limit(5)

    const upcomingDebates = (debateRows ?? []).length

    // ── 7. Compute risk dimensions ────────────────────────────────────────────

    // 7a. Price Extremity Risk (reversal risk when price is very high or very low)
    const distFromEdge = Math.min(price, 100 - price)   // 0 = at extreme, 50 = center
    const extremityRisk = clamp(Math.round((1 - distFromEdge / 50) * 100), 0, 100)
    const extremityInsight =
      price >= 80
        ? `Price at ${price}¢ — near-law territory; risk of surprise reversal if opposition mobilises`
        : price <= 20
        ? `Price at ${price}¢ — deeply rejected; risk of revival if new argument breaks through`
        : price >= 65
        ? `Price at ${price}¢ — building consensus; stable but susceptible to coalition opposition`
        : price <= 35
        ? `Price at ${price}¢ — strong resistance; a single debate shift could spark a rally`
        : `Price near ${price}¢ — contested middle; high sensitivity to any new information`

    // 7b. Volatility Risk
    const volRisk = clamp(Math.round(historicalVol * 4), 0, 100)
    const volInsight =
      historicalVol >= 15
        ? `Extreme price swings detected — ${Math.round(historicalVol)}¢ std dev across ${prices.length} snapshots`
        : historicalVol >= 8
        ? `Elevated volatility — price has moved ±${Math.round(historicalVol)}¢ on average between snapshots`
        : historicalVol >= 4
        ? `Moderate price movement — ${Math.round(historicalVol)}¢ typical swing`
        : prices.length < 5
        ? `Insufficient history to measure volatility — market is very new`
        : `Low volatility — consensus has been stable (${Math.round(historicalVol)}¢ std dev)`

    // 7c. Liquidity Risk (low volume = easier to move, higher risk)
    const liquidityRisk =
      volume === 0 ? 100
      : volume < 20 ? 90
      : volume < 100 ? 70
      : volume < 500 ? 40
      : volume < 2000 ? 20
      : 10
    const liquidityInsight =
      volume < 20
        ? `Only ${volume} votes cast — a small coordinated push could dramatically shift consensus`
        : volume < 100
        ? `${volume} votes — thin participation; arguments and new coalitions carry outsized weight`
        : volume < 500
        ? `${volume.toLocaleString()} votes — moderate depth; large debate events can still swing the price`
        : `${volume.toLocaleString()} votes — healthy depth; price is resistant to small manipulation`

    // 7d. Coalition Disagreement Risk
    const minorSide = Math.min(coalitionFor.length, coalitionAgainst.length)
    const totalCoalitions = coalitionFor.length + coalitionAgainst.length + coalitionNeutral.length
    const coalitionRisk =
      totalCoalitions === 0 ? 30   // no coalitions engaged = uncertain
      : minorSide === 0 ? 15       // all coalitions agree = low risk
      : clamp(Math.round((minorSide / totalCoalitions) * 100), 20, 90)
    const coalitionInsight =
      totalCoalitions === 0
        ? 'No coalitions have declared a stance — outcome depends on individual voters'
        : minorSide === 0
        ? `All ${totalCoalitions} coalitions aligned — strong institutional consensus`
        : `${coalitionFor.length} FOR vs ${coalitionAgainst.length} AGAINST coalitions — divided institutional opinion`

    // 7e. Deadline Risk
    const deadlineRisk =
      daysToClose === null ? 10
      : daysToClose <= 1 ? 95
      : daysToClose <= 3 ? 80
      : daysToClose <= 7 ? 60
      : daysToClose <= 14 ? 35
      : daysToClose <= 30 ? 20
      : 10
    const deadlineInsight =
      daysToClose === null
        ? 'No fixed voting deadline — market remains open indefinitely'
        : daysToClose <= 1
        ? 'Voting closes within 24 hours — price is locked in near-final state'
        : daysToClose <= 3
        ? `${daysToClose} days until close — late momentum shifts are high-stakes`
        : daysToClose <= 7
        ? `${daysToClose} days remaining — upcoming debates or events could still move the market`
        : `${daysToClose} days remaining — sufficient time for opinion shifts`

    // 7f. Sentiment Divergence (argument balance vs price)
    // If price says 75¢ FOR but 60% of arguments are AGAINST → high divergence
    const argSentimentPrice = argumentBalance  // 0-100, 50 = balanced
    const divergence = Math.abs(price - argSentimentPrice)
    const sentimentRisk = clamp(Math.round(divergence * 1.5), 0, 100)
    const sentimentInsight =
      divergence < 10
        ? 'Price and argument sentiment are well-aligned — stable consensus'
        : divergence < 20
        ? `Mild divergence: price at ${price}¢ but arguments lean ${argumentBalance > 50 ? 'FOR' : 'AGAINST'} at ${argumentBalance}%`
        : divergence < 35
        ? `Notable divergence: market priced ${price > argumentBalance ? 'more optimistic' : 'more pessimistic'} than argument quality suggests`
        : `Strong divergence: price at ${price}¢ while argument balance is ${argumentBalance}% FOR — potential mean reversion`

    const dimensions: MarketRiskDimension[] = [
      {
        key:     'extremity',
        label:   'Price Extremity',
        score:   extremityRisk,
        grade:   grade(extremityRisk),
        insight: extremityInsight,
        metric:  `${price}¢ current price`,
      },
      {
        key:     'volatility',
        label:   'Price Volatility',
        score:   volRisk,
        grade:   grade(volRisk),
        insight: volInsight,
        metric:  prices.length >= 2 ? `±${Math.round(historicalVol)}¢ std dev` : 'Insufficient data',
      },
      {
        key:     'liquidity',
        label:   'Liquidity Depth',
        score:   liquidityRisk,
        grade:   grade(liquidityRisk),
        insight: liquidityInsight,
        metric:  `${volume.toLocaleString()} total votes`,
      },
      {
        key:     'coalition',
        label:   'Coalition Alignment',
        score:   coalitionRisk,
        grade:   grade(coalitionRisk),
        insight: coalitionInsight,
        metric:  totalCoalitions === 0
          ? 'No stances declared'
          : `${coalitionFor.length}F / ${coalitionAgainst.length}A / ${coalitionNeutral.length}N`,
      },
      {
        key:     'deadline',
        label:   'Deadline Pressure',
        score:   deadlineRisk,
        grade:   grade(deadlineRisk),
        insight: deadlineInsight,
        metric:  daysToClose !== null ? `${daysToClose}d remaining` : 'Open-ended',
      },
      {
        key:     'sentiment',
        label:   'Sentiment Divergence',
        score:   sentimentRisk,
        grade:   grade(sentimentRisk),
        insight: sentimentInsight,
        metric:  `${divergence}¢ price-argument gap`,
      },
    ]

    // ── 8. Composite score (weighted average) ─────────────────────────────────
    const weights = [0.20, 0.20, 0.15, 0.15, 0.15, 0.15]
    const compositeScore = Math.round(
      dimensions.reduce((acc, d, i) => acc + d.score * weights[i], 0)
    )

    // ── 9. Risk signals ───────────────────────────────────────────────────────
    const riskSignals: RiskSignal[] = []

    if (price >= 80) {
      riskSignals.push({
        id: 'near_law',
        severity: 'high',
        label: 'Near-Law Threshold',
        description: `Price of ${price}¢ approaches the 75¢ consensus threshold — small reversals amplified`,
        direction: 'bullish',
      })
    }
    if (price <= 20) {
      riskSignals.push({
        id: 'near_failed',
        severity: 'high',
        label: 'Near-Failure Zone',
        description: `Price of ${price}¢ indicates strong rejection — recovery requires significant new support`,
        direction: 'bearish',
      })
    }
    if (historicalVol >= 10) {
      riskSignals.push({
        id: 'high_vol',
        severity: 'high',
        label: 'High Volatility',
        description: `Price standard deviation of ${Math.round(historicalVol)}¢ indicates this market moves sharply on new information`,
        direction: 'neutral',
      })
    }
    if (volume < 50) {
      riskSignals.push({
        id: 'thin_market',
        severity: volume < 10 ? 'critical' : 'medium',
        label: 'Thin Market',
        description: `Only ${volume} votes — low participation makes this market susceptible to coordinated vote shifts`,
        direction: 'neutral',
      })
    }
    if (upcomingDebates > 0) {
      riskSignals.push({
        id: 'debate_risk',
        severity: 'medium',
        label: 'Debate Event Risk',
        description: `${upcomingDebates} debate${upcomingDebates > 1 ? 's' : ''} scheduled — debate outcomes historically shift civic market prices`,
        direction: 'neutral',
      })
    }
    if (coalitionFor.length > 0 && coalitionAgainst.length > 0) {
      riskSignals.push({
        id: 'coalition_split',
        severity: 'medium',
        label: 'Coalition Split',
        description: `Opposing coalition declarations create institutional tension — ${coalitionFor.length} FOR vs ${coalitionAgainst.length} AGAINST`,
        direction: 'neutral',
      })
    }
    if (divergence >= 25) {
      riskSignals.push({
        id: 'sentiment_gap',
        severity: divergence >= 40 ? 'high' : 'medium',
        label: 'Sentiment-Price Divergence',
        description: `Argument quality suggests ${argumentBalance}% FOR consensus while price sits at ${price}¢ — potential reversion`,
        direction: price > argumentBalance ? 'bearish' : 'bullish',
      })
    }
    if (daysToClose !== null && daysToClose <= 3) {
      riskSignals.push({
        id: 'closing',
        severity: daysToClose <= 1 ? 'critical' : 'high',
        label: 'Closing Imminently',
        description: `Market closes in ${daysToClose <= 1 ? 'less than 24 hours' : `${daysToClose} days`} — final price will be locked`,
        direction: 'neutral',
      })
    }
    if (vol7d !== null && vol7d >= 15) {
      riskSignals.push({
        id: 'momentum',
        severity: 'medium',
        label: '7-Day Momentum Surge',
        description: `Price moved ${vol7d}¢ in the past week — strong momentum may continue or reverse sharply`,
        direction: price > (price7dAgo ?? price) ? 'bullish' : 'bearish',
      })
    }

    // Sort signals: critical > high > medium > low
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    riskSignals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    const response: MarketRiskResponse = {
      topic_id:        topic.id,
      statement:       topic.statement,
      category:        topic.category ?? null,
      status:          topic.status,
      price,
      volume,
      composite_score: compositeScore,
      composite_grade: grade(compositeScore),
      composite_label: compositeLabel(compositeScore),
      dimensions,
      risk_signals:    riskSignals,
      coalition_sides: { for: coalitionFor, against: coalitionAgainst, neutral: coalitionNeutral },
      price_at_risk:   priceAtRisk,
      argument_balance: argumentBalance,
      vol_7d:          vol7d,
      days_to_close:   daysToClose,
      as_of:           new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[/api/exchange/[id]/risk]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
