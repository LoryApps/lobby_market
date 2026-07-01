import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CohortSlice {
  label: string
  key: string
  forVotes: number
  againstVotes: number
  total: number
  forPct: number
  delta: number // diff from platform average (forPct - topic.blue_pct)
}

export interface BreakdownResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  byRole: CohortSlice[]
  byClout: CohortSlice[]
  byEngagement: CohortSlice[]
  byTiming: CohortSlice[]
  insight: string | null
}

// ─── Role display metadata ────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; description: string }> = {
  person:        { label: 'Citizen',      description: 'Standard community member' },
  debator:       { label: 'Debater',      description: 'Active argument author' },
  troll_catcher: { label: 'Moderator',    description: 'Community safety guardian' },
  elder:         { label: 'Elder',        description: 'Senior trusted voice' },
}

// ─── GET /api/topics/[id]/breakdown ──────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { id } = params

  // ── Topic ─────────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const platformAvg = topic.blue_pct ?? 50

  // ── Fetch all votes with voter profile ───────────────────────────────────
  const { data: votes } = await supabase
    .from('votes')
    .select('side, created_at, user_id, profiles(role, clout, total_arguments)')
    .eq('topic_id', id)
    .order('created_at', { ascending: true })

  if (!votes || votes.length === 0) {
    const empty: BreakdownResponse = {
      topic,
      byRole: [],
      byClout: [],
      byEngagement: [],
      byTiming: [],
      insight: 'No votes recorded yet.',
    }
    return NextResponse.json(empty)
  }

  // ── Helper ────────────────────────────────────────────────────────────────
  function buildSlice(
    key: string,
    label: string,
    description: string,
    subset: typeof votes,
  ): CohortSlice {
    const forVotes = subset.filter((v) => v.side === 'blue').length
    const againstVotes = subset.filter((v) => v.side === 'red').length
    const total = subset.length
    const forPct = total > 0 ? Math.round((forVotes / total) * 100) : 0
    return {
      label,
      key,
      forVotes,
      againstVotes,
      total,
      forPct,
      delta: forPct - Math.round(platformAvg),
    }
  }

  // ── By Role ───────────────────────────────────────────────────────────────
  const roleGroups: Record<string, typeof votes> = {}
  for (const v of votes) {
    const role = (v.profiles as { role?: string } | null)?.role ?? 'person'
    if (!roleGroups[role]) roleGroups[role] = []
    roleGroups[role].push(v)
  }

  const byRole: CohortSlice[] = Object.entries(roleGroups)
    .map(([role, subset]) => {
      const meta = ROLE_META[role] ?? { label: role, description: '' }
      return buildSlice(role, meta.label, meta.description, subset)
    })
    .sort((a, b) => b.total - a.total)

  // ── By Clout Tier ─────────────────────────────────────────────────────────
  const cloutBuckets = [
    { key: 'newcomer',  label: 'Newcomer',   min: 0,    max: 99,    description: 'Clout 0–99'   },
    { key: 'rising',    label: 'Rising',     min: 100,  max: 499,   description: 'Clout 100–499' },
    { key: 'established', label: 'Established', min: 500, max: 1999, description: 'Clout 500–1999' },
    { key: 'elite',     label: 'Elite',      min: 2000, max: Infinity, description: 'Clout 2000+' },
  ]

  const byClout: CohortSlice[] = cloutBuckets
    .map(({ key, label, description, min, max }) => {
      const subset = votes.filter((v) => {
        const clout = (v.profiles as { clout?: number } | null)?.clout ?? 0
        return clout >= min && clout <= max
      })
      return buildSlice(key, label, description, subset)
    })
    .filter((s) => s.total > 0)

  // ── By Engagement Type ────────────────────────────────────────────────────
  const activeVoters = votes.filter(
    (v) => ((v.profiles as { total_arguments?: number } | null)?.total_arguments ?? 0) > 0,
  )
  const silentVoters = votes.filter(
    (v) => ((v.profiles as { total_arguments?: number } | null)?.total_arguments ?? 0) === 0,
  )

  const byEngagement: CohortSlice[] = [
    buildSlice('active',  'Argument Authors', 'Voted AND posted arguments', activeVoters),
    buildSlice('silent',  'Silent Voters',    'Voted only, no arguments',   silentVoters),
  ].filter((s) => s.total > 0)

  // ── By Timing Cohort ──────────────────────────────────────────────────────
  const total = votes.length
  const q1 = Math.floor(total * 0.25)
  const q3 = Math.floor(total * 0.75)

  const earlyVotes  = votes.slice(0, q1)
  const middleVotes = votes.slice(q1, q3)
  const lateVotes   = votes.slice(q3)

  const byTiming: CohortSlice[] = [
    buildSlice('early',  'Early Adopters', 'First 25% of voters', earlyVotes),
    buildSlice('middle', 'Majority Wave',  'Middle 50% of voters', middleVotes),
    buildSlice('late',   'Late Arrivals',  'Last 25% of voters',   lateVotes),
  ].filter((s) => s.total > 0)

  // ── Insight ───────────────────────────────────────────────────────────────
  let insight: string | null = null

  const elderSlice = byRole.find((r) => r.key === 'elder')
  const citizenSlice = byRole.find((r) => r.key === 'person')
  if (elderSlice && citizenSlice && Math.abs(elderSlice.forPct - citizenSlice.forPct) >= 15) {
    const direction = elderSlice.forPct > citizenSlice.forPct ? 'more supportive' : 'less supportive'
    insight = `Elders are ${direction} of this motion than regular citizens (${elderSlice.forPct}% vs ${citizenSlice.forPct}% FOR).`
  }

  const earlySlice = byTiming.find((t) => t.key === 'early')
  const lateSlice  = byTiming.find((t) => t.key === 'late')
  if (!insight && earlySlice && lateSlice && Math.abs(earlySlice.forPct - lateSlice.forPct) >= 15) {
    const direction = lateSlice.forPct > earlySlice.forPct ? 'strengthened' : 'weakened'
    insight = `Support has ${direction} over time — early voters were ${earlySlice.forPct}% FOR, late voters are ${lateSlice.forPct}% FOR.`
  }

  const activeSlice = byEngagement.find((e) => e.key === 'active')
  const silentSlice = byEngagement.find((e) => e.key === 'silent')
  if (!insight && activeSlice && silentSlice && Math.abs(activeSlice.forPct - silentSlice.forPct) >= 12) {
    const direction = activeSlice.forPct > silentSlice.forPct ? 'more enthusiastic' : 'more skeptical'
    insight = `Argument authors are ${direction} about this motion than silent voters (${activeSlice.forPct}% vs ${silentSlice.forPct}% FOR).`
  }

  const eliteSlice    = byClout.find((c) => c.key === 'elite')
  const newcomerSlice = byClout.find((c) => c.key === 'newcomer')
  if (!insight && eliteSlice && newcomerSlice && Math.abs(eliteSlice.forPct - newcomerSlice.forPct) >= 15) {
    const direction = eliteSlice.forPct > newcomerSlice.forPct ? 'strongly back' : 'push back on'
    insight = `Elite-tier members (Clout 2000+) ${direction} this motion, differing from newcomers by ${Math.abs(eliteSlice.forPct - newcomerSlice.forPct)} points.`
  }

  const payload: BreakdownResponse = {
    topic,
    byRole,
    byClout,
    byEngagement,
    byTiming,
    insight,
  }

  return NextResponse.json(payload)
}
