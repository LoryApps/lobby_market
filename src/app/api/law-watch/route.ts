import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LawChance = 'imminent' | 'likely' | 'contested' | 'unlikely' | 'failing'

export interface WatchedTopic {
  id: string
  statement: string
  category: string | null
  scope: string
  status: string
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  created_at: string
  // computed
  law_chance: LawChance
  chance_pct: number
  hours_remaining: number | null
  days_active: number
  votes_per_hour: number
  projected_pct: number | null
  distance_to_law: number
  signal_label: string
  signal_detail: string
}

export interface LawWatchResponse {
  imminent: WatchedTopic[]
  likely: WatchedTopic[]
  contested: WatchedTopic[]
  unlikely: WatchedTopic[]
  failing: WatchedTopic[]
  active_watch: WatchedTopic[]
  total_voting: number
  total_active_near: number
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** % threshold at which a topic becomes law */
const LAW_THRESHOLD = 75
/** % threshold below which topic is rejected */
const REJECT_THRESHOLD = 25

const COLS = 'id, statement, category, scope, status, blue_pct, total_votes, voting_ends_at, created_at'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursRemaining(votingEndsAt: string | null, now: Date): number | null {
  if (!votingEndsAt) return null
  const end = new Date(votingEndsAt)
  const ms = end.getTime() - now.getTime()
  return ms > 0 ? ms / 3_600_000 : 0
}

function daysActive(createdAt: string, now: Date): number {
  return Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86_400_000)
}

/**
 * "Law probability" 0–100 computed from:
 *   - Current FOR%  (primary driver)
 *   - Distance to threshold
 *   - Time pressure (imminent votes carry higher certainty if passing)
 */
function computeChancePct(bluePct: number, hoursLeft: number | null): number {
  const dist = bluePct - LAW_THRESHOLD
  // Logistic-style mapping: 0% at 25%, 50% at 75%, 100% at 95%+
  const base = Math.max(0, Math.min(100, ((bluePct - REJECT_THRESHOLD) / (100 - REJECT_THRESHOLD)) * 100))

  if (hoursLeft !== null && hoursLeft < 24 && dist > 0) {
    // High confidence in the lead if running out of time
    return Math.min(100, base + (1 - hoursLeft / 24) * 15)
  }
  return base
}

function lawChanceLabel(bluePct: number, hoursLeft: number | null): LawChance {
  const hrs = hoursLeft ?? 999
  if (bluePct >= LAW_THRESHOLD) return hrs < 48 ? 'imminent' : 'likely'
  if (bluePct >= 60) return 'likely'
  if (bluePct >= 45) return 'contested'
  if (bluePct >= REJECT_THRESHOLD) return 'unlikely'
  return 'failing'
}

function buildSignal(
  t: { blue_pct: number; total_votes: number; voting_ends_at: string | null },
  chance: LawChance,
  hrs: number | null
): { signal_label: string; signal_detail: string } {
  const forPct = Math.round(t.blue_pct)
  const againstPct = 100 - forPct
  const dist = Math.abs(forPct - LAW_THRESHOLD).toFixed(1)
  const timeStr = hrs === null ? '' : hrs < 1 ? ' · <1 h left' : hrs < 24 ? ` · ${Math.round(hrs)}h left` : ` · ${Math.round(hrs / 24)}d left`

  switch (chance) {
    case 'imminent':
      return {
        signal_label: 'LAW IMMINENT',
        signal_detail: `${forPct}% FOR — ${dist}% above the 75% threshold${timeStr}`,
      }
    case 'likely':
      return {
        signal_label: 'On Track',
        signal_detail: `${forPct}% FOR — needs ${dist}% more to pass${timeStr}`,
      }
    case 'contested':
      return {
        signal_label: 'Too Close to Call',
        signal_detail: `${forPct}% FOR / ${againstPct}% AGAINST — outcome uncertain${timeStr}`,
      }
    case 'unlikely':
      return {
        signal_label: 'Uphill',
        signal_detail: `${forPct}% FOR — ${dist}% below threshold, momentum needed${timeStr}`,
      }
    case 'failing':
      return {
        signal_label: 'Heading to Rejection',
        signal_detail: `${forPct}% FOR / ${againstPct}% AGAINST — below rejection threshold${timeStr}`,
      }
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const now = new Date()

  const [votingRes, activeNearRes] = await Promise.all([
    // All currently voting topics
    supabase
      .from('topics')
      .select(COLS)
      .eq('status', 'voting')
      .order('blue_pct', { ascending: false })
      .limit(60),

    // Active topics already at ≥60% FOR (approaching voting phase)
    supabase
      .from('topics')
      .select(COLS)
      .eq('status', 'active')
      .gte('blue_pct', 60)
      .order('blue_pct', { ascending: false })
      .limit(20),
  ])

  const rawVoting = votingRes.data ?? []
  const rawActive = activeNearRes.data ?? []

  function toWatched(t: typeof rawVoting[0]): WatchedTopic {
    const hrs = hoursRemaining(t.voting_ends_at, now)
    const chance = lawChanceLabel(t.blue_pct, hrs)
    const chancePct = computeChancePct(t.blue_pct, hrs)
    const { signal_label, signal_detail } = buildSignal(t, chance, hrs)

    // Rough projection: assume current FOR% holds
    const projected_pct = t.blue_pct

    // Votes-per-hour estimate based on total votes and days active
    const days = Math.max(1, daysActive(t.created_at, now))
    const votes_per_hour = parseFloat((t.total_votes / (days * 24)).toFixed(2))

    return {
      ...t,
      law_chance: chance,
      chance_pct: Math.round(chancePct),
      hours_remaining: hrs,
      days_active: days,
      votes_per_hour,
      projected_pct,
      distance_to_law: parseFloat((LAW_THRESHOLD - t.blue_pct).toFixed(1)),
      signal_label,
      signal_detail,
    }
  }

  const votingWatched = rawVoting.map(toWatched)
  const activeWatched = rawActive.map(toWatched)

  const result: LawWatchResponse = {
    imminent: votingWatched.filter((t) => t.law_chance === 'imminent'),
    likely: votingWatched.filter((t) => t.law_chance === 'likely'),
    contested: votingWatched.filter((t) => t.law_chance === 'contested'),
    unlikely: votingWatched.filter((t) => t.law_chance === 'unlikely'),
    failing: votingWatched.filter((t) => t.law_chance === 'failing'),
    active_watch: activeWatched,
    total_voting: rawVoting.length,
    total_active_near: rawActive.length,
    generated_at: now.toISOString(),
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=45' },
  })
}
