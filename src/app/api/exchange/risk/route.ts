import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RiskPosition {
  topic_id: string
  statement: string
  category: string | null
  side: 'blue' | 'red'
  voted_at: string
  entry_price: number
  current_price: number
  status: string
  total_votes: number
  pnl: number
  outcome: 'winning' | 'losing' | 'settled_win' | 'settled_loss'
}

export interface RiskDimension {
  key: string
  label: string
  score: number       // 0–100, higher = more risk
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  insight: string
  value: string       // human-readable metric
}

export interface RiskResponse {
  dimensions: RiskDimension[]
  composite_score: number          // 0–100
  composite_grade: 'A' | 'B' | 'C' | 'D' | 'F'
  total_positions: number
  open_positions: number
  positions: RiskPosition[]
  top_risk_positions: RiskPosition[]
  diversification_map: Array<{ category: string; count: number; pct: number; avg_pnl: number }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function letterGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score <= 20) return 'A'
  if (score <= 40) return 'B'
  if (score <= 60) return 'C'
  if (score <= 75) return 'D'
  return 'F'
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all user votes joined with current topic data
  const { data: votes, error } = await supabase
    .from('votes')
    .select(`
      topic_id,
      side,
      created_at,
      topics!inner (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(300)

  if (error || !votes) {
    return NextResponse.json({ error: 'Failed to load positions' }, { status: 500 })
  }

  // Build position list with price history approximation
  // Fetch price history for recent votes to get entry price
  const topicIds = votes.map((v) => v.topic_id)

  const { data: priceHistory } = topicIds.length
    ? await supabase
        .from('topic_price_history')
        .select('topic_id, price, recorded_at')
        .in('topic_id', topicIds)
        .order('recorded_at', { ascending: true })
    : { data: [] as Array<{ topic_id: string; price: number; recorded_at: string }> }

  const historyByTopic = new Map<
    string,
    Array<{ price: number; recorded_at: string }>
  >()
  for (const row of priceHistory ?? []) {
    const arr = historyByTopic.get(row.topic_id) ?? []
    arr.push(row)
    historyByTopic.set(row.topic_id, arr)
  }

  function entryPriceFor(topicId: string, votedAt: string): number | null {
    const history = historyByTopic.get(topicId)
    if (!history || history.length === 0) return null
    // Find the closest price snapshot at or before vote time
    const voteMs = new Date(votedAt).getTime()
    let best: { price: number; recorded_at: string } | null = null
    for (const tick of history) {
      if (new Date(tick.recorded_at).getTime() <= voteMs) {
        best = tick
      }
    }
    return best?.price ?? null
  }

  const positions: RiskPosition[] = []

  for (const vote of votes) {
    const topic = vote.topics as unknown as {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    }
    if (!topic) continue

    const currentPrice = topic.blue_pct ?? 50
    const entryRaw = entryPriceFor(topic.id, vote.created_at)
    const entry = entryRaw ?? currentPrice  // fallback: assume flat entry

    const isBull = vote.side === 'blue'
    const pnl = isBull ? currentPrice - entry : entry - currentPrice

    const isSettled = topic.status === 'law' || topic.status === 'failed'
    const settledWin =
      (topic.status === 'law' && vote.side === 'blue') ||
      (topic.status === 'failed' && vote.side === 'red')

    let outcome: RiskPosition['outcome'] = 'winning'
    if (isSettled) {
      outcome = settledWin ? 'settled_win' : 'settled_loss'
    } else {
      outcome = pnl >= 0 ? 'winning' : 'losing'
    }

    positions.push({
      topic_id: topic.id,
      statement: topic.statement,
      category: topic.category,
      side: vote.side as 'blue' | 'red',
      voted_at: vote.created_at,
      entry_price: entry,
      current_price: currentPrice,
      status: topic.status,
      total_votes: topic.total_votes ?? 0,
      pnl,
      outcome,
    })
  }

  // Open (unresolved) positions only for most risk calculations
  const open = positions.filter(
    (p) => p.status !== 'law' && p.status !== 'failed'
  )

  // ── 1. Concentration Risk ────────────────────────────────────────────────
  // Measure how concentrated the open portfolio is in a single category.
  // HHI (Herfindahl-Hirschman Index) normalized 0-100.
  const catCount = new Map<string, number>()
  for (const p of open) {
    const cat = p.category ?? 'Unknown'
    catCount.set(cat, (catCount.get(cat) ?? 0) + 1)
  }
  const total = open.length || 1
  let hhiRaw = 0
  for (const c of catCount.values()) {
    const share = c / total
    hhiRaw += share * share
  }
  // HHI ranges from 1/n (perfectly spread) to 1 (all in one)
  const n = catCount.size || 1
  const hhiMin = 1 / n
  const concentrationScore = open.length < 2
    ? 100
    : clamp(Math.round(((hhiRaw - hhiMin) / (1 - hhiMin)) * 100), 0, 100)

  const topCategory = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0]
  const topCatPct = topCategory ? Math.round((topCategory[1] / total) * 100) : 0

  const concentrationDim: RiskDimension = {
    key: 'concentration',
    label: 'Concentration',
    score: concentrationScore,
    grade: letterGrade(concentrationScore),
    insight:
      concentrationScore <= 20
        ? 'Portfolio well-diversified across categories.'
        : concentrationScore <= 50
        ? `${topCatPct}% of positions in ${topCategory?.[0] ?? 'one category'} — moderate concentration.`
        : `${topCatPct}% in ${topCategory?.[0] ?? 'one category'} — high concentration risk.`,
    value: `${topCatPct}% in ${topCategory?.[0] ?? '—'}`,
  }

  // ── 2. Time (Resolution) Risk ────────────────────────────────────────────
  // How many open positions are in 'voting' status (imminent resolution)?
  const votingPositions = open.filter((p) => p.status === 'voting')
  const timeScore = open.length === 0 ? 0 : clamp(
    Math.round((votingPositions.length / open.length) * 100),
    0,
    100
  )

  const timeDim: RiskDimension = {
    key: 'time',
    label: 'Resolution',
    score: timeScore,
    grade: letterGrade(timeScore),
    insight:
      votingPositions.length === 0
        ? 'No positions are in active voting — low imminent resolution risk.'
        : votingPositions.length === 1
        ? '1 position is in active voting and approaching resolution.'
        : `${votingPositions.length} positions are in active voting and nearing resolution.`,
    value: `${votingPositions.length} of ${open.length} voting`,
  }

  // ── 3. Momentum Risk ─────────────────────────────────────────────────────
  // Are positions moving against the user? % of open positions with negative P&L.
  const losing = open.filter((p) => p.pnl < -3)
  const momentumScore = open.length === 0 ? 0 : clamp(
    Math.round((losing.length / open.length) * 100),
    0,
    100
  )
  const avgPnl =
    open.length === 0
      ? 0
      : open.reduce((s, p) => s + p.pnl, 0) / open.length

  const momentumDim: RiskDimension = {
    key: 'momentum',
    label: 'Momentum',
    score: momentumScore,
    grade: letterGrade(momentumScore),
    insight:
      momentumScore <= 20
        ? 'Most positions are moving in your favour.'
        : momentumScore <= 50
        ? `${losing.length} of ${open.length} positions are losing ground — watch sentiment shifts.`
        : `${losing.length} of ${open.length} positions are underwater — consider your entry thesis.`,
    value: `${Math.round(Math.abs(avgPnl))}pt avg ${avgPnl >= 0 ? 'gain' : 'loss'}`,
  }

  // ── 4. Liquidity Risk ────────────────────────────────────────────────────
  // Low-vote markets are thinly traded — harder to read consensus.
  // Score based on % of open positions with < 20 total votes.
  const thinPositions = open.filter((p) => p.total_votes < 20)
  const liquidityScore = open.length === 0 ? 0 : clamp(
    Math.round((thinPositions.length / open.length) * 100),
    0,
    100
  )
  const medianVotes =
    open.length === 0
      ? 0
      : [...open].sort((a, b) => a.total_votes - b.total_votes)[Math.floor(open.length / 2)]
          .total_votes

  const liquidityDim: RiskDimension = {
    key: 'liquidity',
    label: 'Liquidity',
    score: liquidityScore,
    grade: letterGrade(liquidityScore),
    insight:
      liquidityScore <= 20
        ? 'Most markets have healthy vote depth — reliable consensus signals.'
        : liquidityScore <= 50
        ? `${thinPositions.length} thin markets (< 20 votes) — consensus may be unstable.`
        : `${thinPositions.length} of ${open.length} positions in low-volume markets — high noise.`,
    value: `${medianVotes} median votes`,
  }

  // ── 5. Drawdown Risk ─────────────────────────────────────────────────────
  // Max single-position loss (negative P&L swing).
  const worstPnl =
    open.length === 0 ? 0 : Math.min(...open.map((p) => p.pnl))
  const drawdownScore = clamp(Math.round(Math.max(0, -worstPnl) * 2.5), 0, 100)

  const drawdownDim: RiskDimension = {
    key: 'drawdown',
    label: 'Drawdown',
    score: drawdownScore,
    grade: letterGrade(drawdownScore),
    insight:
      drawdownScore <= 20
        ? 'No significant single-position drawdowns detected.'
        : drawdownScore <= 50
        ? `Worst position is down ${Math.round(-worstPnl)}pts — manageable exposure.`
        : `Worst position is down ${Math.round(-worstPnl)}pts — consider your thesis.`,
    value: `${Math.round(worstPnl)}pt worst`,
  }

  // ── Composite score ───────────────────────────────────────────────────────
  const dims = [concentrationDim, timeDim, momentumDim, liquidityDim, drawdownDim]
  const composite = Math.round(
    dims.reduce((s, d) => s + d.score, 0) / dims.length
  )

  // ── Diversification map ───────────────────────────────────────────────────
  const catPnl = new Map<string, { count: number; pnl: number }>()
  for (const p of open) {
    const cat = p.category ?? 'Unknown'
    const existing = catPnl.get(cat) ?? { count: 0, pnl: 0 }
    catPnl.set(cat, { count: existing.count + 1, pnl: existing.pnl + p.pnl })
  }
  const diversificationMap = [...catPnl.entries()]
    .map(([category, { count, pnl }]) => ({
      category,
      count,
      pct: Math.round((count / total) * 100),
      avg_pnl: count > 0 ? Math.round((pnl / count) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // ── Top risk positions ────────────────────────────────────────────────────
  const topRiskPositions = [...open]
    .sort((a, b) => a.pnl - b.pnl) // worst first
    .slice(0, 5)

  return NextResponse.json({
    dimensions: dims,
    composite_score: composite,
    composite_grade: letterGrade(composite),
    total_positions: positions.length,
    open_positions: open.length,
    positions: open,
    top_risk_positions: topRiskPositions,
    diversification_map: diversificationMap,
  } satisfies RiskResponse)
}
