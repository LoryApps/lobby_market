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
  delta: number
}

export interface LawBreakdownResponse {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
    topic_id: string
  }
  byRole: CohortSlice[]
  byClout: CohortSlice[]
  byEngagement: CohortSlice[]
  byTiming: CohortSlice[]
  insight: string | null
}

// ─── Role display metadata ─────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string }> = {
  person:        { label: 'Citizen'   },
  debator:       { label: 'Debater'   },
  troll_catcher: { label: 'Moderator' },
  elder:         { label: 'Elder'     },
}

// ─── GET /api/laws/[id]/breakdown ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { id } = params

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', id)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const platformAvg = law.blue_pct ?? 50
  const topicId = law.topic_id

  const { data: votes } = await supabase
    .from('votes')
    .select('side, created_at, user_id, profiles(role, clout, total_arguments)')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })

  if (!votes || votes.length === 0) {
    const empty: LawBreakdownResponse = {
      law,
      byRole: [],
      byClout: [],
      byEngagement: [],
      byTiming: [],
      insight: 'No vote data available for this law.',
    }
    return NextResponse.json(empty)
  }

  function buildSlice(
    key: string,
    label: string,
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
      const meta = ROLE_META[role] ?? { label: role }
      return buildSlice(role, meta.label, subset)
    })
    .sort((a, b) => b.total - a.total)

  // ── By Clout Tier ─────────────────────────────────────────────────────────
  const cloutBuckets = [
    { key: 'newcomer',    label: 'Newcomer',     min: 0,    max: 99        },
    { key: 'rising',      label: 'Rising',       min: 100,  max: 499       },
    { key: 'established', label: 'Established',  min: 500,  max: 1999      },
    { key: 'elite',       label: 'Elite',        min: 2000, max: Infinity  },
  ]

  const byClout: CohortSlice[] = cloutBuckets
    .map(({ key, label, min, max }) => {
      const subset = votes.filter((v) => {
        const clout = (v.profiles as { clout?: number } | null)?.clout ?? 0
        return clout >= min && clout <= max
      })
      return buildSlice(key, label, subset)
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
    buildSlice('active', 'Argument Authors', activeVoters),
    buildSlice('silent', 'Silent Voters',    silentVoters),
  ].filter((s) => s.total > 0)

  // ── By Timing Cohort ──────────────────────────────────────────────────────
  const total = votes.length
  const q1 = Math.floor(total * 0.25)
  const q3 = Math.floor(total * 0.75)

  const byTiming: CohortSlice[] = [
    buildSlice('early',  'Early Adopters', votes.slice(0, q1)),
    buildSlice('middle', 'Majority Wave',  votes.slice(q1, q3)),
    buildSlice('late',   'Late Arrivals',  votes.slice(q3)),
  ].filter((s) => s.total > 0)

  // ── Insight ───────────────────────────────────────────────────────────────
  let insight: string | null = null

  const elderSlice   = byRole.find((r) => r.key === 'elder')
  const citizenSlice = byRole.find((r) => r.key === 'person')
  if (elderSlice && citizenSlice && Math.abs(elderSlice.forPct - citizenSlice.forPct) >= 15) {
    const direction = elderSlice.forPct > citizenSlice.forPct ? 'more supportive' : 'less supportive'
    insight = `Elders were ${direction} of this law than regular citizens (${elderSlice.forPct}% vs ${citizenSlice.forPct}% FOR).`
  }

  const earlySlice = byTiming.find((t) => t.key === 'early')
  const lateSlice  = byTiming.find((t) => t.key === 'late')
  if (!insight && earlySlice && lateSlice && Math.abs(earlySlice.forPct - lateSlice.forPct) >= 15) {
    const direction = lateSlice.forPct > earlySlice.forPct ? 'strengthened' : 'weakened'
    insight = `Support ${direction} over time — early voters were ${earlySlice.forPct}% FOR, late voters were ${lateSlice.forPct}% FOR.`
  }

  const activeSlice = byEngagement.find((e) => e.key === 'active')
  const silentSlice = byEngagement.find((e) => e.key === 'silent')
  if (!insight && activeSlice && silentSlice && Math.abs(activeSlice.forPct - silentSlice.forPct) >= 12) {
    const direction = activeSlice.forPct > silentSlice.forPct ? 'more enthusiastic' : 'more skeptical'
    insight = `Argument authors were ${direction} than silent voters (${activeSlice.forPct}% vs ${silentSlice.forPct}% FOR).`
  }

  const eliteSlice    = byClout.find((c) => c.key === 'elite')
  const newcomerSlice = byClout.find((c) => c.key === 'newcomer')
  if (!insight && eliteSlice && newcomerSlice && Math.abs(eliteSlice.forPct - newcomerSlice.forPct) >= 15) {
    const direction = eliteSlice.forPct > newcomerSlice.forPct ? 'strongly backed' : 'pushed back on'
    insight = `Elite-tier members (Clout 2000+) ${direction} this law, differing from newcomers by ${Math.abs(eliteSlice.forPct - newcomerSlice.forPct)} points.`
  }

  return NextResponse.json(
    {
      law,
      byRole,
      byClout,
      byEngagement,
      byTiming,
      insight,
    } satisfies LawBreakdownResponse,
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    },
  )
}
