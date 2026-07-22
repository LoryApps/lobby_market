import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlowBucket {
  label: string          // e.g. "4h ago", "8h ago"
  period_start: string   // ISO
  for_votes: number
  against_votes: number
  net_flow: number       // for_votes - against_votes (positive = FOR pressure)
  total: number
  for_clout: number      // sum of voter clout FOR
  against_clout: number  // sum of voter clout AGAINST
  net_clout_flow: number // for_clout - against_clout
}

export interface FlowCohort {
  label: string
  tier: 'smart_money' | 'experienced' | 'retail'
  min_clout: number
  for_votes: number
  against_votes: number
  net_flow: number
  flow_pct: number       // % of cohort that voted FOR
  signal: 'bullish' | 'bearish' | 'neutral'
}

export interface ArgumentFlowBucket {
  label: string
  period_start: string
  for_args: number
  against_args: number
  net_arg_flow: number
}

export type FlowLabel = 'strong_bull' | 'bull' | 'lean_bull' | 'neutral' | 'lean_bear' | 'bear' | 'strong_bear'

export interface MarketFlowData {
  topic_id: string
  statement: string
  category: string | null
  status: string
  price: number
  blue_votes: number
  red_votes: number
  total_votes: number

  // ── Overall flow score ──────────────────────────────────────────────────
  flow_score: number          // 0-100 (50 = neutral, >50 = bullish FOR)
  flow_label: FlowLabel
  flow_label_text: string

  // ── Vote velocity ───────────────────────────────────────────────────────
  recent_buckets: FlowBucket[]  // last 24h in 4-hour buckets
  daily_buckets: FlowBucket[]   // last 7 days in 1-day buckets

  // ── Acceleration ────────────────────────────────────────────────────────
  acceleration: number          // diff between newest and oldest bucket net_flow
  accelerating_toward: 'for' | 'against' | 'stable'

  // ── Clout cohorts ───────────────────────────────────────────────────────
  cohorts: FlowCohort[]
  smart_money_signal: 'bullish' | 'bearish' | 'neutral'
  retail_signal: 'bullish' | 'bearish' | 'neutral'
  smart_money_vs_retail: number  // positive = smart money more bullish than retail

  // ── Argument flow ───────────────────────────────────────────────────────
  argument_buckets: ArgumentFlowBucket[]
  total_for_args: number
  total_against_args: number
  arg_flow_edge: 'for' | 'against' | 'balanced'

  // ── Divergence ──────────────────────────────────────────────────────────
  price_vs_flow_divergence: number  // flow_score - price (+ means flow more bullish than price)
  divergence_signal: 'flow_leads_price_up' | 'flow_leads_price_down' | 'aligned'

  // ── Stats ────────────────────────────────────────────────────────────────
  recent_24h_votes: number
  recent_7d_votes: number
  avg_voter_clout: number
  as_of: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flowLabel(score: number): FlowLabel {
  if (score >= 75) return 'strong_bull'
  if (score >= 62) return 'bull'
  if (score >= 54) return 'lean_bull'
  if (score >= 46) return 'neutral'
  if (score >= 38) return 'lean_bear'
  if (score >= 25) return 'bear'
  return 'strong_bear'
}

function flowLabelText(label: FlowLabel): string {
  switch (label) {
    case 'strong_bull': return 'Strong Bullish Flow'
    case 'bull':        return 'Bullish Flow'
    case 'lean_bull':   return 'Lean Bullish'
    case 'neutral':     return 'Neutral Flow'
    case 'lean_bear':   return 'Lean Bearish'
    case 'bear':        return 'Bearish Flow'
    case 'strong_bear': return 'Strong Bearish Flow'
  }
}

function cohortSignal(forPct: number): FlowCohort['signal'] {
  if (forPct >= 56) return 'bullish'
  if (forPct <= 44) return 'bearish'
  return 'neutral'
}

interface VoteRow {
  side: string
  created_at: string
  profiles: { clout: number; role: string } | null
}

function bucketVotes(
  votes: VoteRow[],
  windowMs: number,
  bucketMs: number,
  now: number,
  labelFn: (i: number) => string,
): FlowBucket[] {
  const count = Math.floor(windowMs / bucketMs)
  const buckets: FlowBucket[] = []

  for (let i = 0; i < count; i++) {
    const bucketEnd   = now - i * bucketMs
    const bucketStart = bucketEnd - bucketMs

    const inBucket = votes.filter((v) => {
      const t = new Date(v.created_at).getTime()
      return t >= bucketStart && t < bucketEnd
    })

    const forVotes     = inBucket.filter((v) => v.side === 'blue')
    const againstVotes = inBucket.filter((v) => v.side === 'red')
    const forClout     = forVotes.reduce((s, v) => s + (v.profiles?.clout ?? 0), 0)
    const againstClout = againstVotes.reduce((s, v) => s + (v.profiles?.clout ?? 0), 0)

    buckets.push({
      label:         labelFn(i),
      period_start:  new Date(bucketStart).toISOString(),
      for_votes:     forVotes.length,
      against_votes: againstVotes.length,
      net_flow:      forVotes.length - againstVotes.length,
      total:         inBucket.length,
      for_clout:     forClout,
      against_clout: againstClout,
      net_clout_flow: forClout - againstClout,
    })
  }

  return buckets.reverse() // chronological order
}

// ─── GET /api/exchange/[id]/flow ──────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic ──────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const price    = Math.round(topic.blue_pct ?? 50)
  const blueVotes = (topic.blue_votes ?? 0) as number
  const redVotes  = (topic.red_votes  ?? 0) as number
  const total    = (topic.total_votes ?? 0) as number

  // ── 2. Recent votes (last 7 days, with clout) ─────────────────────────────
  const cutoff7d = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const { data: voteRows } = await supabase
    .from('votes')
    .select(`
      side,
      created_at,
      profiles:user_id (
        clout,
        role
      )
    `)
    .eq('topic_id', id)
    .gte('created_at', cutoff7d)
    .order('created_at', { ascending: false })
    .limit(2000)

  const votes = (voteRows ?? []) as VoteRow[]
  const now   = Date.now()
  const cutoff24h = now - 86_400_000

  const recent24h = votes.filter((v) => new Date(v.created_at).getTime() >= cutoff24h)

  // ── 3. 4-hour buckets for last 24h ────────────────────────────────────────
  const recentBuckets = bucketVotes(
    votes,
    86_400_000,
    4 * 3_600_000,
    now,
    (i) => {
      const h = (6 - i) * 4
      if (h === 0) return 'Now'
      return `${h}h ago`
    },
  )

  // ── 4. Daily buckets for last 7 days ──────────────────────────────────────
  const dailyBuckets = bucketVotes(
    votes,
    7 * 86_400_000,
    86_400_000,
    now,
    (i) => {
      const d = 7 - i
      if (d === 0) return 'Today'
      if (d === 1) return '1d ago'
      return `${d}d ago`
    },
  )

  // ── 5. Flow score (based on recent 24h weighted by clout) ─────────────────
  //   Base: overall for/against split (price)
  //   Adjustment: recent flow direction (last 24h)
  const recent24hFor     = recent24h.filter((v) => v.side === 'blue').length
  const recent24hTotal   = recent24h.length

  // Compute flow score:
  // 50% weight on overall price, 50% on recent 24h flow
  const overallScore  = price                  // already 0-100
  const recentScore   = recent24hTotal > 0
    ? (recent24hFor / recent24hTotal) * 100
    : price
  const flowScore = Math.round(overallScore * 0.5 + recentScore * 0.5)

  const fLabel     = flowLabel(flowScore)
  const fLabelText = flowLabelText(fLabel)

  // ── 6. Acceleration ────────────────────────────────────────────────────────
  const newestBucket = recentBuckets[recentBuckets.length - 1]
  const oldestBucket = recentBuckets[0]
  const acceleration = (newestBucket?.net_flow ?? 0) - (oldestBucket?.net_flow ?? 0)
  const acceleratingToward: MarketFlowData['accelerating_toward'] =
    Math.abs(acceleration) < 1 ? 'stable'
    : acceleration > 0 ? 'for'
    : 'against'

  // ── 7. Clout cohorts ──────────────────────────────────────────────────────
  const COHORT_TIERS = [
    { tier: 'smart_money' as const, label: 'Smart Money', min: 500  },
    { tier: 'experienced' as const, label: 'Experienced', min: 100  },
    { tier: 'retail'      as const, label: 'Retail',      min: 0    },
  ]

  const cohorts: FlowCohort[] = COHORT_TIERS.map(({ tier, label, min }, idx) => {
    const maxClout = idx === 0 ? Infinity : COHORT_TIERS[idx - 1].min
    const cohortVotes = votes.filter((v) => {
      const c = v.profiles?.clout ?? 0
      return c >= min && c < maxClout
    })
    const forCount     = cohortVotes.filter((v) => v.side === 'blue').length
    const againstCount = cohortVotes.filter((v) => v.side === 'red').length
    const cohortTotal  = cohortVotes.length
    const forPct       = cohortTotal > 0 ? Math.round((forCount / cohortTotal) * 100) : 50

    return {
      label,
      tier,
      min_clout:  min,
      for_votes:  forCount,
      against_votes: againstCount,
      net_flow:   forCount - againstCount,
      flow_pct:   forPct,
      signal:     cohortSignal(forPct),
    }
  })

  const smartMoneyCohort = cohorts.find((c) => c.tier === 'smart_money')!
  const retailCohort     = cohorts.find((c) => c.tier === 'retail')!

  const smVsRetail = smartMoneyCohort.flow_pct - retailCohort.flow_pct

  // ── 8. Argument flow (last 7 days) ────────────────────────────────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('side, created_at')
    .eq('topic_id', id)
    .order('created_at', { ascending: false })
    .limit(500)

  const args = (argRows ?? []) as { side: string; created_at: string }[]

  interface ArgBucket {
    label: string
    period_start: string
    for_args: number
    against_args: number
    net_arg_flow: number
  }

  const argBuckets: ArgBucket[] = dailyBuckets.map((db) => {
    const bucketStart = new Date(db.period_start).getTime()
    const bucketEnd   = bucketStart + 86_400_000
    const inBucket    = args.filter((a) => {
      const t = new Date(a.created_at).getTime()
      return t >= bucketStart && t < bucketEnd
    })
    const forArgs     = inBucket.filter((a) => a.side === 'blue').length
    const againstArgs = inBucket.filter((a) => a.side === 'red').length
    return {
      label:       db.label,
      period_start: db.period_start,
      for_args:    forArgs,
      against_args: againstArgs,
      net_arg_flow: forArgs - againstArgs,
    }
  })

  const totalForArgs     = args.filter((a) => a.side === 'blue').length
  const totalAgainstArgs = args.filter((a) => a.side === 'red').length
  const argFlowEdge: MarketFlowData['arg_flow_edge'] =
    Math.abs(totalForArgs - totalAgainstArgs) <= 1
      ? 'balanced'
      : totalForArgs > totalAgainstArgs
      ? 'for'
      : 'against'

  // ── 9. Divergence ─────────────────────────────────────────────────────────
  const pvsf = flowScore - price
  const divergenceSignal: MarketFlowData['divergence_signal'] =
    Math.abs(pvsf) < 5
      ? 'aligned'
      : pvsf > 0
      ? 'flow_leads_price_up'
      : 'flow_leads_price_down'

  // ── 10. Avg voter clout ───────────────────────────────────────────────────
  const cloutValues = votes.map((v) => v.profiles?.clout ?? 0)
  const avgVoterClout = cloutValues.length > 0
    ? Math.round(cloutValues.reduce((a, b) => a + b, 0) / cloutValues.length)
    : 0

  const response: MarketFlowData = {
    topic_id:   topic.id,
    statement:  topic.statement,
    category:   topic.category ?? null,
    status:     topic.status,
    price,
    blue_votes: blueVotes,
    red_votes:  redVotes,
    total_votes: total,

    flow_score:      flowScore,
    flow_label:      fLabel,
    flow_label_text: fLabelText,

    recent_buckets: recentBuckets,
    daily_buckets:  dailyBuckets,

    acceleration,
    accelerating_toward: acceleratingToward,

    cohorts,
    smart_money_signal: smartMoneyCohort.signal,
    retail_signal:      retailCohort.signal,
    smart_money_vs_retail: Math.round(smVsRetail),

    argument_buckets:   argBuckets,
    total_for_args:     totalForArgs,
    total_against_args: totalAgainstArgs,
    arg_flow_edge:      argFlowEdge,

    price_vs_flow_divergence: Math.round(pvsf),
    divergence_signal: divergenceSignal,

    recent_24h_votes: recent24hTotal,
    recent_7d_votes:  votes.length,
    avg_voter_clout:  avgVoterClout,
    as_of:            new Date().toISOString(),
  }

  return NextResponse.json(response)
}
