import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Shared types (mirrored from topic census) ───────────────────────────────

export interface CensusSegment {
  label: string
  total: number
  pct: number
  forVotes: number
  againstVotes: number
  forPct: number
}

export interface CensusDimension {
  dimension: string
  label: string
  segments: CensusSegment[]
}

export interface LawCensusResponse {
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string | null
    blue_pct: number
    total_votes: number
    topic_id: string
  }
  dimensions: CensusDimension[]
  veteranForPct: number | null
  veteranAgainstPct: number | null
  newcormerForPct: number | null
  elderForPct: number | null
  highCloutForPct: number | null
  viewerVoteSide: string | null
  totalVotersWithData: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seniorityBucket(createdAt: string): '< 1 month' | '1–6 months' | '6+ months' {
  const daysSince = (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  if (daysSince < 30) return '< 1 month'
  if (daysSince < 180) return '1–6 months'
  return '6+ months'
}

function cloutBucket(clout: number): 'Emerging' | 'Established' | 'Influential' | 'Luminary' {
  if (clout < 100) return 'Emerging'
  if (clout < 500) return 'Established'
  if (clout < 2000) return 'Influential'
  return 'Luminary'
}

function activityBucket(totalVotes: number): 'New (< 10)' | 'Active (10–99)' | 'Veteran (100+)' {
  if (totalVotes < 10) return 'New (< 10)'
  if (totalVotes < 100) return 'Active (10–99)'
  return 'Veteran (100+)'
}

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const [lawRes, userRes] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, category, established_at, blue_pct, total_votes, topic_id')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ])

  if (!lawRes.data) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const law = lawRes.data
  const viewerId = userRes.data.user?.id ?? null

  if (!law.topic_id) {
    return NextResponse.json({ error: 'Law has no associated topic' }, { status: 422 })
  }

  // Fetch all votes for the law's underlying topic
  const { data: voteRows } = await supabase
    .from('votes')
    .select('user_id, side')
    .eq('topic_id', law.topic_id)

  const votes = voteRows ?? []
  const voterIds = votes.map((v) => v.user_id)

  type ProfileData = {
    created_at: string
    role: string
    clout: number
    total_votes: number
  }
  const profileMap = new Map<string, ProfileData>()

  if (voterIds.length > 0) {
    const CHUNK = 500
    for (let i = 0; i < voterIds.length; i += CHUNK) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, created_at, role, clout, total_votes')
        .in('id', voterIds.slice(i, i + CHUNK))
      for (const p of profiles ?? []) {
        profileMap.set(p.id, {
          created_at: p.created_at,
          role: p.role,
          clout: p.clout ?? 0,
          total_votes: p.total_votes ?? 0,
        })
      }
    }
  }

  const totalVotersWithData = profileMap.size

  type Counts = Record<string, { for: number; against: number; total: number }>

  const seniorityCounts: Counts = {
    '< 1 month': { for: 0, against: 0, total: 0 },
    '1–6 months': { for: 0, against: 0, total: 0 },
    '6+ months': { for: 0, against: 0, total: 0 },
  }
  const roleCounts: Counts = {}
  const cloutCounts: Counts = {
    'Emerging': { for: 0, against: 0, total: 0 },
    'Established': { for: 0, against: 0, total: 0 },
    'Influential': { for: 0, against: 0, total: 0 },
    'Luminary': { for: 0, against: 0, total: 0 },
  }
  const activityCounts: Counts = {
    'New (< 10)': { for: 0, against: 0, total: 0 },
    'Active (10–99)': { for: 0, against: 0, total: 0 },
    'Veteran (100+)': { for: 0, against: 0, total: 0 },
  }

  let viewerVoteSide: string | null = null

  for (const vote of votes) {
    const isFor = vote.side === 'blue'
    if (vote.user_id === viewerId) {
      viewerVoteSide = isFor ? 'for' : 'against'
    }

    const profile = profileMap.get(vote.user_id)
    if (!profile) continue

    const sKey = seniorityBucket(profile.created_at)
    seniorityCounts[sKey].total++
    if (isFor) seniorityCounts[sKey].for++
    else seniorityCounts[sKey].against++

    const rKey = profile.role ?? 'person'
    if (!roleCounts[rKey]) roleCounts[rKey] = { for: 0, against: 0, total: 0 }
    roleCounts[rKey].total++
    if (isFor) roleCounts[rKey].for++
    else roleCounts[rKey].against++

    const cKey = cloutBucket(profile.clout)
    cloutCounts[cKey].total++
    if (isFor) cloutCounts[cKey].for++
    else cloutCounts[cKey].against++

    const aKey = activityBucket(profile.total_votes)
    activityCounts[aKey].total++
    if (isFor) activityCounts[aKey].for++
    else activityCounts[aKey].against++
  }

  function toSegments(
    counts: Counts,
    orderedKeys: string[],
    labelFn: (k: string) => string
  ): CensusSegment[] {
    return orderedKeys.map((key) => {
      const c = counts[key] ?? { for: 0, against: 0, total: 0 }
      return {
        label: labelFn(key),
        total: c.total,
        pct: totalVotersWithData > 0 ? Math.round((c.total / totalVotersWithData) * 100) : 0,
        forVotes: c.for,
        againstVotes: c.against,
        forPct: c.total > 0 ? Math.round((c.for / c.total) * 100) : 50,
      }
    })
  }

  const SENIORITY_ORDER = ['< 1 month', '1–6 months', '6+ months']
  const ROLE_ORDER = ['person', 'debator', 'troll_catcher', 'elder']
  const CLOUT_ORDER = ['Emerging', 'Established', 'Influential', 'Luminary']
  const ACTIVITY_ORDER = ['New (< 10)', 'Active (10–99)', 'Veteran (100+)']

  const dimensions: CensusDimension[] = [
    {
      dimension: 'seniority',
      label: 'Member Seniority',
      segments: toSegments(seniorityCounts, SENIORITY_ORDER, (k) => k),
    },
    {
      dimension: 'role',
      label: 'Civic Role',
      segments: toSegments(
        roleCounts,
        ROLE_ORDER.filter((r) => roleCounts[r]?.total > 0),
        (k) => ROLE_LABELS[k] ?? k
      ),
    },
    {
      dimension: 'clout',
      label: 'Clout Standing',
      segments: toSegments(cloutCounts, CLOUT_ORDER, (k) => k),
    },
    {
      dimension: 'activity',
      label: 'Voting Activity',
      segments: toSegments(activityCounts, ACTIVITY_ORDER, (k) => k),
    },
  ]

  const vet = seniorityCounts['6+ months']
  const newcomer = seniorityCounts['< 1 month']
  const elder = roleCounts['elder']
  const luminary = cloutCounts['Luminary']

  const response: LawCensusResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category ?? null,
      established_at: law.established_at ?? null,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      topic_id: law.topic_id,
    },
    dimensions,
    veteranForPct: vet.total >= 5 ? Math.round((vet.for / vet.total) * 100) : null,
    veteranAgainstPct: vet.total >= 5 ? Math.round((vet.against / vet.total) * 100) : null,
    newcormerForPct: newcomer.total >= 5 ? Math.round((newcomer.for / newcomer.total) * 100) : null,
    elderForPct: elder && elder.total >= 3 ? Math.round((elder.for / elder.total) * 100) : null,
    highCloutForPct: luminary.total >= 3 ? Math.round((luminary.for / luminary.total) * 100) : null,
    viewerVoteSide,
    totalVotersWithData,
  }

  return NextResponse.json(response)
}
