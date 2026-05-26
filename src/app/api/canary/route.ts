import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanaryTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  view_count: number
  support_count: number
  activation_threshold: number
  voting_ends_at: string | null
  created_at: string
  updated_at: string
  // Computed signals
  vote_velocity: number       // votes per hour
  hours_old: number
  arg_count_24h: number       // arguments in last 24 hours
  support_pct: number         // for proposed: support_count / activation_threshold * 100
  signal_strength: number     // 0-100 composite canary score
}

export interface CanaryResponse {
  rising_fast: CanaryTopic[]
  quiet_storm: CanaryTopic[]
  activation_imminent: CanaryTopic[]
  argument_surge: CanaryTopic[]
  platform_pulse: {
    total_active: number
    avg_velocity: number
    hottest_category: string | null
    total_canary_signals: number
  }
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLS = `
  id, statement, category, status, scope,
  blue_pct, total_votes, view_count, support_count,
  activation_threshold, voting_ends_at, created_at, updated_at
`.trim()

/** Topics younger than this qualify for rising-fast detection */
const RISING_MAX_HOURS = 72
/** Minimum votes to show in rising-fast (avoids noise from 1 vote) */
const RISING_MIN_VOTES = 3
/** Max votes for "quiet storm" — topics that haven't converted views yet */
const QUIET_MAX_VOTES = 25
/** Min view_count for "quiet storm" — has eyeballs, not votes yet */
const QUIET_MIN_VIEWS = 50
/** Activation threshold pct for "imminent" (e.g. 70 = within 30% of activation) */
const IMMINENT_SUPPORT_PCT = 65
/** Argument count in last 24h to qualify as "argument surge" */
const ARG_SURGE_MIN = 3

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

function computeVelocity(total_votes: number, created_at: string): number {
  const h = Math.max(0.25, hoursAgo(created_at)) // min 15 min to avoid infinity
  return total_votes / h
}

function computeSignalStrength(t: {
  vote_velocity: number
  arg_count_24h: number
  support_pct: number
  view_count: number
  total_votes: number
  hours_old: number
}): number {
  // Components (0-100 each):
  // velocity_score: velocity vs. a benchmark of 2 votes/hour
  const velocity_score = Math.min(100, (t.vote_velocity / 2) * 100)
  // arg_score: 1 arg/hr over the period
  const arg_rate = t.arg_count_24h / Math.max(1, Math.min(t.hours_old, 24))
  const arg_score = Math.min(100, arg_rate * 30)
  // view_to_vote: high ratio = lots of viewers not yet voting
  const view_to_vote = t.total_votes > 0 ? t.view_count / t.total_votes : 0
  const view_score = Math.min(100, view_to_vote * 5)
  // support_score for proposed topics
  const support_score = t.support_pct

  return Math.round(
    velocity_score * 0.4 + arg_score * 0.3 + view_score * 0.15 + support_score * 0.15
  )
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const cutoff30d = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString()
  const cutoff24h = new Date(Date.now() - 24 * 3_600_000).toISOString()

  // Fetch live topics created in last 30 days
  const { data: rows } = await supabase
    .from('topics')
    .select(COLS)
    .in('status', ['proposed', 'active', 'voting'])
    .gte('created_at', cutoff30d)
    .order('updated_at', { ascending: false })
    .limit(300)

  if (!rows || rows.length === 0) {
    const empty: CanaryResponse = {
      rising_fast: [],
      quiet_storm: [],
      activation_imminent: [],
      argument_surge: [],
      platform_pulse: {
        total_active: 0,
        avg_velocity: 0,
        hottest_category: null,
        total_canary_signals: 0,
      },
      generated_at: new Date().toISOString(),
    }
    return NextResponse.json(empty)
  }

  // Fetch recent argument counts (last 24h) per topic
  const topicIds = rows.map((r) => r.id)

  const { data: recentArgs } = await supabase
    .from('topic_arguments')
    .select('topic_id')
    .in('topic_id', topicIds)
    .gte('created_at', cutoff24h)

  const argMap: Record<string, number> = {}
  for (const row of recentArgs ?? []) {
    argMap[row.topic_id] = (argMap[row.topic_id] ?? 0) + 1
  }

  // Enrich topics with computed signals
  const enriched: CanaryTopic[] = rows.map((t) => {
    const hours_old = hoursAgo(t.created_at)
    const vote_velocity = computeVelocity(t.total_votes, t.created_at)
    const arg_count_24h = argMap[t.id] ?? 0
    const support_pct = t.activation_threshold > 0
      ? (t.support_count / t.activation_threshold) * 100
      : 0

    const partial = { vote_velocity, arg_count_24h, support_pct, view_count: t.view_count, total_votes: t.total_votes, hours_old }
    const signal_strength = computeSignalStrength(partial)

    return {
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      status: t.status,
      scope: t.scope ?? null,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      view_count: t.view_count ?? 0,
      support_count: t.support_count ?? 0,
      activation_threshold: t.activation_threshold ?? 500,
      voting_ends_at: t.voting_ends_at ?? null,
      created_at: t.created_at,
      updated_at: t.updated_at,
      vote_velocity,
      hours_old,
      arg_count_24h,
      support_pct,
      signal_strength,
    }
  })

  // ── Signal buckets ──────────────────────────────────────────────────────────

  // 1. Rising Fast: high vote velocity for their age, not yet huge
  const rising_fast = enriched
    .filter(
      (t) =>
        t.hours_old <= RISING_MAX_HOURS &&
        t.total_votes >= RISING_MIN_VOTES &&
        t.total_votes < 800 &&
        t.status !== 'proposed'
    )
    .sort((a, b) => b.vote_velocity - a.vote_velocity)
    .slice(0, 12)

  // 2. Quiet Storm: high views, low votes — about to ignite
  const quiet_storm = enriched
    .filter(
      (t) =>
        t.view_count >= QUIET_MIN_VIEWS &&
        t.total_votes <= QUIET_MAX_VOTES &&
        t.status === 'active'
    )
    .sort((a, b) => b.view_count / Math.max(1, b.total_votes) - a.view_count / Math.max(1, a.total_votes))
    .slice(0, 10)

  // 3. Activation Imminent: proposed topics near the support threshold
  const activation_imminent = enriched
    .filter((t) => t.status === 'proposed' && t.support_pct >= IMMINENT_SUPPORT_PCT)
    .sort((a, b) => b.support_pct - a.support_pct)
    .slice(0, 10)

  // 4. Argument Surge: topics with most arguments in last 24h
  const argument_surge = enriched
    .filter((t) => t.arg_count_24h >= ARG_SURGE_MIN)
    .sort((a, b) => b.arg_count_24h - a.arg_count_24h)
    .slice(0, 12)

  // ── Platform pulse ──────────────────────────────────────────────────────────

  const activeTopics = enriched.filter((t) => t.status === 'active' || t.status === 'voting')
  const avg_velocity =
    activeTopics.length > 0
      ? activeTopics.reduce((s, t) => s + t.vote_velocity, 0) / activeTopics.length
      : 0

  // Hottest category by combined signal strength
  const catScores: Record<string, number> = {}
  for (const t of enriched) {
    if (t.category) {
      catScores[t.category] = (catScores[t.category] ?? 0) + t.signal_strength
    }
  }
  const hottest_category =
    Object.keys(catScores).length > 0
      ? Object.entries(catScores).sort((a, b) => b[1] - a[1])[0][0]
      : null

  const total_canary_signals =
    rising_fast.length + quiet_storm.length + activation_imminent.length + argument_surge.length

  const response: CanaryResponse = {
    rising_fast,
    quiet_storm,
    activation_imminent,
    argument_surge,
    platform_pulse: {
      total_active: activeTopics.length,
      avg_velocity: Math.round(avg_velocity * 10) / 10,
      hottest_category,
      total_canary_signals,
    },
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
