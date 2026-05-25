import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TriageTier = 'near_threshold' | 'deadlocked' | 'starved' | 'expiring'

export interface TriageTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  created_at: string
  tier: TriageTier
  urgency_label: string
  urgency_detail: string
}

export interface TriageResponse {
  near_threshold: TriageTopic[]
  deadlocked: TriageTopic[]
  starved: TriageTopic[]
  expiring: TriageTopic[]
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLS = 'id, statement, category, status, scope, blue_pct, total_votes, voting_ends_at, created_at'

/** For consensus: FOR% ≥ 75 passes as law */
const FOR_THRESHOLD = 75
/** Against rejection: FOR% ≤ 25 rejects */
const AGAINST_THRESHOLD = 25
/** "Near threshold" band: within this many pct points of passing or failing */
const NEAR_BAND = 8
/** "Deadlocked" band: within this many pct points of 50/50 */
const DEADLOCK_BAND = 4
/** "Starved" threshold: topics with fewer than this many votes */
const STARVED_MAX_VOTES = 40
/** "Expiring" window: voting topics expiring within this many hours */
const EXPIRING_HOURS = 48

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const expiryWindow = new Date(now.getTime() + EXPIRING_HOURS * 3_600_000).toISOString()
  const nowIso = now.toISOString()

  const [nearRes, deadlockRes, starvedRes, expiringRes] = await Promise.all([
    // 1. Near threshold: active/voting topics close to passing or failing
    supabase
      .from('topics')
      .select(COLS)
      .in('status', ['active', 'voting'])
      .gte('total_votes', 20)
      .or(
        `blue_pct.gte.${FOR_THRESHOLD - NEAR_BAND},blue_pct.lte.${AGAINST_THRESHOLD + NEAR_BAND}`
      )
      .order('total_votes', { ascending: false })
      .limit(20),

    // 2. Deadlocked: active/voting topics near 50/50 with high vote count (true contest)
    supabase
      .from('topics')
      .select(COLS)
      .in('status', ['active', 'voting'])
      .gte('total_votes', 30)
      .gte('blue_pct', 50 - DEADLOCK_BAND)
      .lte('blue_pct', 50 + DEADLOCK_BAND)
      .order('total_votes', { ascending: false })
      .limit(15),

    // 3. Starved: active topics with very few votes (neglected debates)
    supabase
      .from('topics')
      .select(COLS)
      .in('status', ['active', 'voting'])
      .lte('total_votes', STARVED_MAX_VOTES)
      .order('created_at', { ascending: false })
      .limit(15),

    // 4. Expiring: voting topics about to close
    supabase
      .from('topics')
      .select(COLS)
      .eq('status', 'voting')
      .gt('voting_ends_at', nowIso)
      .lte('voting_ends_at', expiryWindow)
      .order('voting_ends_at', { ascending: true })
      .limit(12),
  ])

  const rawNear = (nearRes.data ?? []) as Array<{
    id: string; statement: string; category: string | null; status: string
    scope: string | null; blue_pct: number; total_votes: number
    voting_ends_at: string | null; created_at: string
  }>
  const rawDead = (deadlockRes.data ?? []) as typeof rawNear
  const rawStar = (starvedRes.data ?? []) as typeof rawNear
  const rawExp  = (expiringRes.data ?? []) as typeof rawNear

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function pctFromFOR(pct: number) { return Math.round(pct) }
  function pctToAgainst(pct: number) { return 100 - Math.round(pct) }

  function nearLabel(pct: number): { label: string; detail: string } {
    if (pct >= FOR_THRESHOLD - NEAR_BAND) {
      const gap = FOR_THRESHOLD - pct
      return {
        label: 'Near Passing',
        detail: `${gap.toFixed(1)}% short of consensus — a push could make this law`,
      }
    }
    const gap = pct - AGAINST_THRESHOLD
    return {
      label: 'Near Failing',
      detail: `${gap.toFixed(1)}% from rejection — opposition votes could seal its fate`,
    }
  }

  function hoursUntil(iso: string): number {
    return (new Date(iso).getTime() - now.getTime()) / 3_600_000
  }

  // ── Map to TriageTopic ────────────────────────────────────────────────────

  const nearThreshold: TriageTopic[] = rawNear.map((t) => {
    const { label, detail } = nearLabel(t.blue_pct)
    return { ...t, tier: 'near_threshold', urgency_label: label, urgency_detail: detail }
  })

  const deadlocked: TriageTopic[] = rawDead
    .filter((t) => !nearThreshold.some((n) => n.id === t.id))
    .map((t) => ({
      ...t,
      tier: 'deadlocked',
      urgency_label: 'Deadlocked',
      urgency_detail: `${pctFromFOR(t.blue_pct)}% FOR / ${pctToAgainst(t.blue_pct)}% AGAINST — every vote shifts the balance`,
    }))

  const starved: TriageTopic[] = rawStar
    .filter((t) => !nearThreshold.some((n) => n.id === t.id) && !deadlocked.some((d) => d.id === t.id))
    .map((t) => ({
      ...t,
      tier: 'starved',
      urgency_label: 'Needs Votes',
      urgency_detail: `Only ${t.total_votes} vote${t.total_votes === 1 ? '' : 's'} cast — this debate needs more voices`,
    }))

  const expiring: TriageTopic[] = rawExp
    .filter(
      (t) =>
        !nearThreshold.some((n) => n.id === t.id) &&
        !deadlocked.some((d) => d.id === t.id) &&
        !starved.some((s) => s.id === t.id)
    )
    .map((t) => {
      const hrs = hoursUntil(t.voting_ends_at!)
      const timeStr = hrs < 1 ? 'Less than an hour' : hrs < 2 ? '~1 hour' : `~${Math.round(hrs)} hours`
      return {
        ...t,
        tier: 'expiring',
        urgency_label: 'Expiring Soon',
        urgency_detail: `${timeStr} left to vote — outcome decides in real time`,
      }
    })

  const response: TriageResponse = {
    near_threshold: nearThreshold.slice(0, 12),
    deadlocked: deadlocked.slice(0, 10),
    starved: starved.slice(0, 10),
    expiring: expiring.slice(0, 10),
    generated_at: now.toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60' },
  })
}
