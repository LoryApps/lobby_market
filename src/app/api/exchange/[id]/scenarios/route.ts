import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScenarioOutcome = 'law' | 'contested' | 'failed' | 'active'

export interface PriceMilestone {
  price: number          // target price in ¢
  label: string
  description: string
  votes_needed: number   // estimated additional FOR votes to reach this
  probability: number    // 0–100
  outcome_hint: ScenarioOutcome
}

export interface TimeProjection {
  days: 7 | 30 | 90
  label: string
  projected_price: number
  confidence: 'low' | 'medium' | 'high'
  narrative: string
}

export interface VolumeImpact {
  additional_for_votes: number
  additional_against_votes: number
  new_price_for: number
  new_price_against: number
  price_delta_for: number
  price_delta_against: number
}

export interface ComparableMarket {
  id: string
  statement: string
  category: string | null
  peak_price: number
  final_price: number
  final_status: string
  total_votes: number
  similarity_reason: string
}

export interface ScenariosResponse {
  topic_id: string
  statement: string
  category: string | null
  status: string
  current_price: number
  current_volume: number
  price_7d_ago: number | null
  momentum_7d: number | null   // ¢ change over 7 days

  // What happens at each price level
  milestones: PriceMilestone[]

  // Projected price at future dates
  projections: TimeProjection[]

  // Volume impact model
  volume_impact: VolumeImpact

  // Similar markets and how they resolved
  comparables: ComparableMarket[]

  // Key thresholds
  law_threshold: number        // minimum % to pass as law (platform rule)
  fail_threshold: number       // maximum % before considered failed

  // Summary sentence
  summary: string

  as_of: string
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── Core topic data ───────────────────────────────────────────────────────
  const { data: topic, error } = await supabase
    .from('topics')
    .select(`
      id, statement, category, status,
      blue_pct, blue_votes, red_votes, total_votes,
      voting_ends_at, created_at, updated_at
    `)
    .eq('id', id)
    .maybeSingle()

  if (error || !topic) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  const price = Math.round(topic.blue_pct ?? 50)
  const volume = (topic.total_votes ?? 0) as number
  const blueVotes = (topic.blue_votes ?? 0) as number
  const redVotes = (topic.red_votes ?? 0) as number

  // ── Price history — last 14 days ──────────────────────────────────────────
  const { data: history } = await supabase
    .from('topic_price_history')
    .select('price, recorded_at')
    .eq('topic_id', id)
    .order('recorded_at', { ascending: false })
    .limit(14)

  const price7dAgo: number | null = (() => {
    if (!history || history.length === 0) return null
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    const old = history.find((h) => new Date(h.recorded_at).getTime() <= cutoff)
    return old ? Math.round(old.price) : null
  })()

  const momentum7d = price7dAgo !== null ? price - price7dAgo : null

  // ── Comparable markets ────────────────────────────────────────────────────
  const { data: rawComparables } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, status')
    .neq('id', id)
    .in('status', ['law', 'failed', 'active'])
    .gte('total_votes', Math.max(5, Math.floor(volume * 0.3)))
    .eq('category', topic.category ?? '')
    .order('total_votes', { ascending: false })
    .limit(6)

  // Fallback: any category if the above returns nothing
  let comparableRows = rawComparables ?? []
  if (comparableRows.length < 2) {
    const { data: fallback } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, status')
      .neq('id', id)
      .in('status', ['law', 'failed', 'active'])
      .order('total_votes', { ascending: false })
      .limit(4)
    comparableRows = fallback ?? []
  }

  const comparables: ComparableMarket[] = comparableRows.map((c) => {
    const cPrice = Math.round(c.blue_pct ?? 50)
    const priceDiff = Math.abs(cPrice - price)
    const sameCategory = c.category === topic.category
    const reason =
      sameCategory && priceDiff <= 10
        ? 'Same category, similar price'
        : sameCategory
          ? `Same category (${c.category})`
          : priceDiff <= 10
            ? 'Similar consensus price'
            : 'Cross-category comparable'

    return {
      id: c.id,
      statement: c.statement,
      category: c.category ?? null,
      peak_price: cPrice,
      final_price: cPrice,
      final_status: c.status,
      total_votes: c.total_votes ?? 0,
      similarity_reason: reason,
    }
  })

  // ── Price milestones ──────────────────────────────────────────────────────
  const LAW_THRESHOLD = 67
  const FAIL_THRESHOLD = 33

  function votesNeededToReach(targetPct: number): number {
    // Current: blueVotes / (blueVotes + redVotes) = price/100
    // After adding N FOR votes: (blueVotes + N) / (blueVotes + redVotes + N) = target/100
    // Solving for N: N = (blueVotes - target*blueVotes - target*redVotes) / (target - 1)
    const t = targetPct / 100
    if (t <= 0 || t >= 1) return Infinity
    const denom = t - 1
    if (Math.abs(denom) < 0.001) return Infinity
    const n = (blueVotes - t * blueVotes - t * redVotes) / denom
    return Math.max(0, Math.ceil(n))
  }

  function milestoneProbability(targetPct: number): number {
    const dist = Math.abs(targetPct - price)
    if (dist === 0) return 100
    const base = Math.max(0, 100 - dist * 2.5)
    // Adjust for momentum
    const momentumBoost = momentum7d !== null && Math.sign(momentum7d) === Math.sign(targetPct - price)
      ? Math.min(20, Math.abs(momentum7d) * 1.5)
      : 0
    return Math.min(99, Math.round(base + momentumBoost))
  }

  const milestoneTargets = [40, 50, 60, 67, 75, 85].filter((t) => t !== price)

  const milestones: PriceMilestone[] = milestoneTargets.map((target) => {
    const votesNeeded = votesNeededToReach(target)
    const prob = milestoneProbability(target)
    const outcome: ScenarioOutcome =
      target >= LAW_THRESHOLD ? 'law' :
      target <= FAIL_THRESHOLD ? 'failed' :
      target >= 58 ? 'contested' : 'active'

    const description =
      target >= LAW_THRESHOLD
        ? `At ${target}¢ the community reaches supermajority FOR — this topic would meet the threshold to become civic law.`
        : target <= FAIL_THRESHOLD
          ? `At ${target}¢ AGAINST sentiment dominates — the topic would be at risk of failing and being archived.`
          : target >= 58
            ? `At ${target}¢ the FOR side holds a significant lead but hasn't reached the law threshold — debate would intensify.`
            : `At ${target}¢ the debate is highly contested — both sides are within striking distance.`

    return {
      price: target,
      label: target >= LAW_THRESHOLD ? 'Law Threshold' : target <= FAIL_THRESHOLD ? 'Failure Zone' : `${target}¢ Consensus`,
      description,
      votes_needed: votesNeeded === Infinity ? 99999 : votesNeeded,
      probability: prob,
      outcome_hint: outcome,
    }
  }).sort((a, b) => a.price - b.price)

  // ── Time projections ──────────────────────────────────────────────────────
  const dailyMomentum = momentum7d !== null ? momentum7d / 7 : 0

  function project(days: 7 | 30 | 90): TimeProjection {
    const rawProjected = price + dailyMomentum * days
    const projected = Math.min(99, Math.max(1, Math.round(rawProjected)))
    const confidence: TimeProjection['confidence'] =
      days === 7 ? (volume >= 20 ? 'high' : 'medium') :
      days === 30 ? (volume >= 50 ? 'medium' : 'low') : 'low'

    const direction = projected > price ? 'upward' : projected < price ? 'downward' : 'flat'
    const narrative =
      direction === 'flat'
        ? `Price is expected to remain near ${price}¢ over the next ${days} days if current voting patterns hold.`
        : direction === 'upward'
          ? `If the current ${Math.abs(Math.round(dailyMomentum * 10) / 10)}¢/day FOR momentum continues, the market could reach ${projected}¢${projected >= LAW_THRESHOLD ? ' — crossing the law threshold' : ''}.`
          : `If the current ${Math.abs(Math.round(dailyMomentum * 10) / 10)}¢/day AGAINST momentum continues, the market could fall to ${projected}¢${projected <= FAIL_THRESHOLD ? ' — entering failure territory' : ''}.`

    return {
      days,
      label: days === 7 ? '1 Week' : days === 30 ? '1 Month' : '3 Months',
      projected_price: projected,
      confidence,
      narrative,
    }
  }

  const projections: TimeProjection[] = [project(7), project(30), project(90)]

  // ── Volume impact model ───────────────────────────────────────────────────
  const IMPACT_VOTES = Math.max(10, Math.round(volume * 0.05))

  const newPriceFor = Math.round(((blueVotes + IMPACT_VOTES) / (volume + IMPACT_VOTES)) * 100)
  const newPriceAgainst = Math.round((blueVotes / (volume + IMPACT_VOTES)) * 100)

  const volumeImpact: VolumeImpact = {
    additional_for_votes: IMPACT_VOTES,
    additional_against_votes: IMPACT_VOTES,
    new_price_for: Math.min(99, newPriceFor),
    new_price_against: Math.max(1, newPriceAgainst),
    price_delta_for: Math.min(99, newPriceFor) - price,
    price_delta_against: Math.max(1, newPriceAgainst) - price,
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const summary = (() => {
    if (topic.status === 'law') return `This market has settled as law at ${price}¢ — a historic consensus record.`
    if (topic.status === 'failed') return `This market ended in failure at ${price}¢ — the community rejected this proposal.`
    if (price >= LAW_THRESHOLD) {
      return `Currently at ${price}¢, this market is above the law threshold. Sustained support could cement it as civic law.`
    }
    if (price <= FAIL_THRESHOLD) {
      return `Currently at ${price}¢, AGAINST sentiment dominates. Recovery requires a significant shift in community opinion.`
    }
    if (momentum7d !== null && Math.abs(momentum7d) >= 5) {
      const dir = momentum7d > 0 ? 'gaining' : 'losing'
      return `At ${price}¢ and ${dir} ${Math.abs(momentum7d)}¢ in 7 days — this market has live momentum worth watching.`
    }
    return `Trading at ${price}¢ with ${volume.toLocaleString()} votes — neither side has decisive control. The debate remains genuinely open.`
  })()

  const response: ScenariosResponse = {
    topic_id:       topic.id,
    statement:      topic.statement,
    category:       topic.category ?? null,
    status:         topic.status,
    current_price:  price,
    current_volume: volume,
    price_7d_ago:   price7dAgo,
    momentum_7d:    momentum7d,
    milestones,
    projections,
    volume_impact:  volumeImpact,
    comparables,
    law_threshold:  LAW_THRESHOLD,
    fail_threshold: FAIL_THRESHOLD,
    summary,
    as_of:          new Date().toISOString(),
  }

  return NextResponse.json(response)
}
