import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ForecastOutcome = 'likely_law' | 'possible_law' | 'contested' | 'likely_fail' | 'certain_fail'

export interface ForecastTopic {
  id: string
  statement: string
  category: string | null
  scope: string
  status: string
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  created_at: string
  feed_score: number
  // Forecast-specific fields
  law_probability: number       // 0–100: model estimate of passing
  confidence: number            // 0–100: how confident we are in the forecast
  outcome: ForecastOutcome
  hours_remaining: number | null // null = not in voting phase
  momentum_label: string        // 'surging' | 'stable' | 'fading' | 'unknown'
  swing_risk: boolean           // true = within 5pp of 50%, could go either way
  // Price history snapshot for sparkline
  price_history: Array<{ price: number; volume: number; recorded_at: string }>
}

export interface ForecastResponse {
  law_candidates: ForecastTopic[]   // likely_law, voting
  contested: ForecastTopic[]        // contested, swing topics
  at_risk: ForecastTopic[]          // likely_fail topics in voting
  active_movers: ForecastTopic[]    // active topics gaining fast
  stats: {
    total_active: number
    total_voting: number
    avg_law_probability: number
    high_confidence_count: number
  }
  generated_at: string
}

// ─── Forecast math ────────────────────────────────────────────────────────────

function computeForecast(topic: {
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  status: string
  feed_score: number
  price_history: Array<{ price: number; volume: number; recorded_at: string }>
}): Pick<ForecastTopic, 'law_probability' | 'confidence' | 'outcome' | 'hours_remaining' | 'momentum_label' | 'swing_risk'> {
  const { blue_pct, total_votes, voting_ends_at, status, price_history } = topic

  // Hours remaining in voting phase
  let hours_remaining: number | null = null
  let time_pressure = 0
  if (voting_ends_at) {
    const msDiff = new Date(voting_ends_at).getTime() - Date.now()
    hours_remaining = Math.max(0, msDiff / (1000 * 60 * 60))
    // Time pressure: 0 = lots of time, 1 = ending very soon
    time_pressure = hours_remaining < 6 ? 0.8 : hours_remaining < 12 ? 0.5 : 0.2
  }

  // Momentum: compare last snapshot to earlier snapshot
  let momentum_label: string = 'unknown'
  let velocity_bonus = 0
  if (price_history.length >= 2) {
    const latest = price_history[0].price
    const earlier = price_history[Math.min(price_history.length - 1, 4)].price
    const delta = latest - earlier
    if (delta > 5) {
      momentum_label = 'surging'
      velocity_bonus = delta > 10 ? 10 : 5
    } else if (delta < -5) {
      momentum_label = 'fading'
      velocity_bonus = delta < -10 ? -10 : -5
    } else {
      momentum_label = 'stable'
    }
  } else if (total_votes > 100) {
    momentum_label = 'stable'
  }

  // Law probability model (logistic-style):
  // Base probability from current blue_pct
  // Topics need > 50% to pass — landslide at 60%+, near-certain at 70%+
  let base_prob: number
  if (blue_pct >= 75) {
    base_prob = 90 + (blue_pct - 75) * 0.4
  } else if (blue_pct >= 60) {
    base_prob = 70 + (blue_pct - 60) * 1.33
  } else if (blue_pct >= 55) {
    base_prob = 55 + (blue_pct - 55) * 3
  } else if (blue_pct >= 50) {
    base_prob = 40 + (blue_pct - 50) * 3
  } else if (blue_pct >= 45) {
    base_prob = 20 + (blue_pct - 45) * 4
  } else if (blue_pct >= 35) {
    base_prob = 5 + (blue_pct - 35) * 1.5
  } else {
    base_prob = Math.max(0, (blue_pct / 35) * 5)
  }

  // Adjustments
  const vote_depth_bonus = Math.min(8, total_votes / 500)
  const law_probability = Math.min(99, Math.max(1, base_prob + velocity_bonus + vote_depth_bonus))

  // Confidence: higher with more votes and clear signal
  const vote_confidence = Math.min(40, total_votes / 50)
  const signal_confidence = Math.abs(blue_pct - 50) > 15 ? 30 : Math.abs(blue_pct - 50) > 5 ? 15 : 5
  const history_confidence = price_history.length >= 3 ? 20 : price_history.length >= 1 ? 10 : 0
  const voting_phase_boost = status === 'voting' ? 10 : 0
  const confidence = Math.min(95, vote_confidence + signal_confidence + history_confidence + voting_phase_boost)

  // Swing risk: within 5pp of 50%
  const swing_risk = Math.abs(blue_pct - 50) <= 5

  // Outcome bucket
  let outcome: ForecastOutcome
  if (law_probability >= 75) {
    outcome = 'likely_law'
  } else if (law_probability >= 55) {
    outcome = 'possible_law'
  } else if (law_probability >= 40) {
    outcome = 'contested'
  } else if (law_probability >= 20) {
    outcome = 'likely_fail'
  } else {
    outcome = 'certain_fail'
  }

  return { law_probability, confidence, outcome, hours_remaining, momentum_label, swing_risk }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch active and voting topics
  const { data: rawTopics, error } = await supabase
    .from('topics')
    .select('id, statement, category, scope, status, blue_pct, total_votes, voting_ends_at, created_at, feed_score, updated_at')
    .in('status', ['active', 'voting'])
    .order('total_votes', { ascending: false })
    .limit(120)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  const topics = rawTopics ?? []
  if (topics.length === 0) {
    return NextResponse.json({
      law_candidates: [],
      contested: [],
      at_risk: [],
      active_movers: [],
      stats: {
        total_active: 0,
        total_voting: 0,
        avg_law_probability: 0,
        high_confidence_count: 0,
      },
      generated_at: new Date().toISOString(),
    } satisfies ForecastResponse)
  }

  // Fetch price history for these topics (last 10 snapshots per topic)
  const topicIds = topics.map((t) => t.id)
  const { data: historyRows } = await supabase
    .from('topic_price_history')
    .select('topic_id, price, volume, recorded_at')
    .in('topic_id', topicIds)
    .order('recorded_at', { ascending: false })
    .limit(topicIds.length * 10)

  const historyByTopic = new Map<string, Array<{ price: number; volume: number; recorded_at: string }>>()
  for (const row of historyRows ?? []) {
    const arr = historyByTopic.get(row.topic_id) ?? []
    if (arr.length < 10) {
      arr.push({ price: row.price, volume: row.volume, recorded_at: row.recorded_at })
      historyByTopic.set(row.topic_id, arr)
    }
  }

  // Compute forecasts
  const forecasted: ForecastTopic[] = topics.map((t) => {
    const history = historyByTopic.get(t.id) ?? []
    const forecast = computeForecast({
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      voting_ends_at: t.voting_ends_at,
      status: t.status,
      feed_score: t.feed_score ?? 0,
      price_history: history,
    })
    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      scope: t.scope,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      voting_ends_at: t.voting_ends_at,
      created_at: t.created_at,
      feed_score: t.feed_score ?? 0,
      price_history: history,
      ...forecast,
    }
  })

  // Categorise into response buckets
  const law_candidates = forecasted
    .filter((t) => t.status === 'voting' && t.law_probability >= 55)
    .sort((a, b) => b.law_probability - a.law_probability)
    .slice(0, 15)

  const contested = forecasted
    .filter((t) => t.swing_risk || t.outcome === 'contested')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)

  const at_risk = forecasted
    .filter((t) => t.status === 'voting' && t.law_probability < 45)
    .sort((a, b) => a.law_probability - b.law_probability)
    .slice(0, 10)

  const active_movers = forecasted
    .filter((t) => t.status === 'active' && t.momentum_label === 'surging')
    .sort((a, b) => b.law_probability - a.law_probability)
    .slice(0, 10)

  // Stats
  const total_active = forecasted.filter((t) => t.status === 'active').length
  const total_voting = forecasted.filter((t) => t.status === 'voting').length
  const avg_law_probability = forecasted.length
    ? Math.round(forecasted.reduce((s, t) => s + t.law_probability, 0) / forecasted.length)
    : 0
  const high_confidence_count = forecasted.filter((t) => t.confidence >= 70).length

  return NextResponse.json({
    law_candidates,
    contested,
    at_risk,
    active_movers,
    stats: {
      total_active,
      total_voting,
      avg_law_probability,
      high_confidence_count,
    },
    generated_at: new Date().toISOString(),
  } satisfies ForecastResponse)
}
