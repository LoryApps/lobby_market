import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type ThresholdZone =
  | 'activating'    // proposed topics ≥ 80% of activation threshold
  | 'just_activated' // became active in last 48h
  | 'entering_vote'  // moved to voting in last 72h
  | 'nearing_law'    // voting, FOR ≥ 62%
  | 'nearing_fail'   // voting, FOR ≤ 38%

export interface ThresholdTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  support_count: number
  activation_threshold: number
  voting_ends_at: string | null
  created_at: string
  // computed
  zone: ThresholdZone
  activation_pct: number   // support_count / activation_threshold * 100
  threshold_gap: number    // votes or supporters until threshold
  hours_in_status: number  // how long since status last changed
  urgency_score: number    // 0–100, higher = more urgent
}

export interface ThresholdStats {
  activating_count: number
  just_activated_count: number
  entering_vote_count: number
  nearing_law_count: number
  nearing_fail_count: number
  total: number
}

export interface ThresholdResponse {
  activating: ThresholdTopic[]
  just_activated: ThresholdTopic[]
  entering_vote: ThresholdTopic[]
  nearing_law: ThresholdTopic[]
  nearing_fail: ThresholdTopic[]
  stats: ThresholdStats
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

function hoursUntil(iso: string | null): number | null {
  if (!iso) return null
  return (new Date(iso).getTime() - Date.now()) / 3_600_000
}

function urgencyScore(topic: {
  zone: ThresholdZone
  activation_pct: number
  blue_pct: number
  hours_in_status: number
  voting_ends_at: string | null
}): number {
  const hrs = hoursUntil(topic.voting_ends_at)

  switch (topic.zone) {
    case 'activating':
      // 80–99% activation → score from 40–90
      return Math.round(40 + (topic.activation_pct - 80) * 2.5)

    case 'just_activated':
      // Newer = higher urgency (peak excitement window)
      return Math.round(Math.max(20, 80 - topic.hours_in_status * 1.5))

    case 'entering_vote':
      return Math.round(Math.max(20, 85 - topic.hours_in_status * 1))

    case 'nearing_law':
      if (hrs !== null && hrs < 24) return 95
      if (hrs !== null && hrs < 72) return 80
      return Math.round(50 + (topic.blue_pct - 62) * 2)

    case 'nearing_fail':
      if (hrs !== null && hrs < 24) return 90
      if (hrs !== null && hrs < 72) return 75
      return Math.round(50 + (38 - topic.blue_pct) * 2)

    default:
      return 50
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const h48 = new Date(now.getTime() - 48 * 3_600_000).toISOString()
  const h72 = new Date(now.getTime() - 72 * 3_600_000).toISOString()

  const COLS =
    'id, statement, category, status, scope, blue_pct, total_votes, support_count, activation_threshold, voting_ends_at, created_at'

  // Run 5 targeted queries in parallel
  const [activatingRes, justActivatedRes, enteringVoteRes, nearingLawRes, nearingFailRes] =
    await Promise.all([
      // 1. Proposed topics ≥ 80% of their activation threshold
      supabase
        .from('topics')
        .select(COLS)
        .eq('status', 'proposed')
        .gt('activation_threshold', 0)
        .gt('support_count', 0)
        .order('support_count', { ascending: false })
        .limit(50),

      // 2. Topics that became active in the last 48h
      supabase
        .from('topics')
        .select(COLS)
        .eq('status', 'active')
        .gte('created_at', h48)
        .order('created_at', { ascending: false })
        .limit(20),

      // 3. Topics that entered voting in the last 72h
      supabase
        .from('topics')
        .select(COLS)
        .eq('status', 'voting')
        .gte('created_at', h72)
        .order('total_votes', { ascending: false })
        .limit(20),

      // 4. Voting topics with strong FOR majority (approaching law)
      supabase
        .from('topics')
        .select(COLS)
        .eq('status', 'voting')
        .gte('blue_pct', 62)
        .gt('total_votes', 20)
        .order('blue_pct', { ascending: false })
        .limit(20),

      // 5. Voting topics with strong AGAINST majority (approaching failure)
      supabase
        .from('topics')
        .select(COLS)
        .eq('status', 'voting')
        .lte('blue_pct', 38)
        .gt('total_votes', 20)
        .order('blue_pct', { ascending: true })
        .limit(20),
    ])

  type RawTopic = {
    id: string
    statement: string
    category: string | null
    status: string
    scope: string | null
    blue_pct: number | null
    total_votes: number | null
    support_count: number | null
    activation_threshold: number | null
    voting_ends_at: string | null
    created_at: string
  }

  function normalize(raw: RawTopic, zone: ThresholdZone): ThresholdTopic {
    const support = raw.support_count ?? 0
    const threshold = raw.activation_threshold ?? 100
    const activationPct = threshold > 0 ? (support / threshold) * 100 : 0
    const forPct = raw.blue_pct ?? 50

    let thresholdGap: number
    if (zone === 'activating') {
      thresholdGap = Math.max(0, threshold - support)
    } else if (zone === 'nearing_law') {
      thresholdGap = Math.max(0, Math.ceil(raw.total_votes ?? 0) * (75 - forPct) / 100)
    } else if (zone === 'nearing_fail') {
      thresholdGap = Math.max(0, Math.ceil(raw.total_votes ?? 0) * (forPct - 25) / 100)
    } else {
      thresholdGap = 0
    }

    const hoursInStatus = hoursAgo(raw.created_at)

    const partial: Omit<ThresholdTopic, 'urgency_score'> = {
      id: raw.id,
      statement: raw.statement,
      category: raw.category,
      status: raw.status,
      scope: raw.scope,
      blue_pct: forPct,
      total_votes: raw.total_votes ?? 0,
      support_count: support,
      activation_threshold: threshold,
      voting_ends_at: raw.voting_ends_at,
      created_at: raw.created_at,
      zone,
      activation_pct: Math.round(activationPct),
      threshold_gap: thresholdGap,
      hours_in_status: Math.round(hoursInStatus),
    }

    return {
      ...partial,
      urgency_score: urgencyScore({ ...partial, voting_ends_at: raw.voting_ends_at }),
    }
  }

  // Build activating — filter to ≥ 80%
  const activating: ThresholdTopic[] = (
    (activatingRes.data as RawTopic[] | null) ?? []
  )
    .filter((t) => {
      const pct = t.activation_threshold
        ? ((t.support_count ?? 0) / t.activation_threshold) * 100
        : 0
      return pct >= 80
    })
    .map((t) => normalize(t, 'activating'))
    .sort((a, b) => b.urgency_score - a.urgency_score)
    .slice(0, 8)

  const just_activated: ThresholdTopic[] = (
    (justActivatedRes.data as RawTopic[] | null) ?? []
  )
    .map((t) => normalize(t, 'just_activated'))
    .sort((a, b) => b.urgency_score - a.urgency_score)
    .slice(0, 8)

  const entering_vote: ThresholdTopic[] = (
    (enteringVoteRes.data as RawTopic[] | null) ?? []
  )
    .map((t) => normalize(t, 'entering_vote'))
    .sort((a, b) => b.urgency_score - a.urgency_score)
    .slice(0, 8)

  // Remove duplicates between entering_vote and nearing_law/fail
  const voteIds = new Set([...entering_vote.map((t) => t.id)])

  const nearing_law: ThresholdTopic[] = (
    (nearingLawRes.data as RawTopic[] | null) ?? []
  )
    .filter((t) => !voteIds.has(t.id))
    .map((t) => normalize(t, 'nearing_law'))
    .sort((a, b) => b.urgency_score - a.urgency_score)
    .slice(0, 8)

  const nearing_fail: ThresholdTopic[] = (
    (nearingFailRes.data as RawTopic[] | null) ?? []
  )
    .filter((t) => !voteIds.has(t.id))
    .map((t) => normalize(t, 'nearing_fail'))
    .sort((a, b) => b.urgency_score - a.urgency_score)
    .slice(0, 8)

  const stats: ThresholdStats = {
    activating_count: activating.length,
    just_activated_count: just_activated.length,
    entering_vote_count: entering_vote.length,
    nearing_law_count: nearing_law.length,
    nearing_fail_count: nearing_fail.length,
    total:
      activating.length +
      just_activated.length +
      entering_vote.length +
      nearing_law.length +
      nearing_fail.length,
  }

  return NextResponse.json({
    activating,
    just_activated,
    entering_vote,
    nearing_law,
    nearing_fail,
    stats,
  } satisfies ThresholdResponse)
}
