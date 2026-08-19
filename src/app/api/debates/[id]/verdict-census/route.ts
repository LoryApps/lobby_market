import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────
//
// Verdict Census: who voted which side won a debate (blue / red / tie),
// broken down by seniority, civic role, clout, and voting activity.
//
// This is the debate analog of /api/topics/[id]/census — instead of FOR/AGAINST
// on a policy, the segmentation is BLUE/RED/TIE on a debate outcome poll.

export interface VerdictSegment {
  label: string
  total: number
  pct: number         // % of all census voters in this segment
  blue: number
  red: number
  tie: number
  bluePct: number     // % within segment voting BLUE
  redPct: number      // % within segment voting RED
  tiePct: number      // % within segment voting TIE
}

export interface VerdictDimension {
  dimension: string
  label: string
  segments: VerdictSegment[]
}

export interface VerdictCensusResponse {
  debate: {
    id: string
    title: string | null
    type: string
    status: string
    topic_id: string
    topic_statement: string | null
    category: string | null
    started_at: string | null
    ended_at: string | null
  }
  poll: {
    blue: number
    red: number
    tie: number
    total: number
    bluePct: number
    redPct: number
    tiePct: number
    winner: 'blue' | 'red' | 'tie' | null
  }
  dimensions: VerdictDimension[]
  // Summary signals — segments with the most decisive lean
  veteranWinner: 'blue' | 'red' | 'tie' | null
  veteranBluePct: number | null
  newcomerWinner: 'blue' | 'red' | 'tie' | null
  newcomerBluePct: number | null
  elderWinner: 'blue' | 'red' | 'tie' | null
  elderBluePct: number | null
  luminaryWinner: 'blue' | 'red' | 'tie' | null
  luminaryBluePct: number | null
  viewerVote: 'blue' | 'red' | 'tie' | null
  totalVotersWithData: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function decideWinner(counts: { blue: number; red: number; tie: number }): 'blue' | 'red' | 'tie' | null {
  const total = counts.blue + counts.red + counts.tie
  if (total === 0) return null
  if (counts.blue > counts.red && counts.blue > counts.tie) return 'blue'
  if (counts.red > counts.blue && counts.red > counts.tie) return 'red'
  if (counts.tie > counts.blue && counts.tie > counts.red) return 'tie'
  // Two-way tie → treat as tie
  return 'tie'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const [debateRes, userRes] = await Promise.all([
    supabase
      .from('debates')
      .select('id, title, type, status, topic_id, started_at, ended_at')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ])

  if (!debateRes.data) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  const debate = debateRes.data
  const viewerId = userRes.data.user?.id ?? null

  // Fetch topic context for header display
  const topicRes = await supabase
    .from('topics')
    .select('statement, category')
    .eq('id', debate.topic_id)
    .maybeSingle()

  const topicStatement = topicRes.data?.statement ?? null
  const category = topicRes.data?.category ?? null

  // Fetch all winner-poll votes for the debate
  const { data: pollRows } = await supabase
    .from('debate_winner_polls')
    .select('user_id, winner')
    .eq('debate_id', params.id)

  const pollVotes = (pollRows ?? []) as Array<{ user_id: string; winner: 'blue' | 'red' | 'tie' }>
  const voterIds = pollVotes.map((v) => v.user_id)

  // Fetch voter profiles in chunks (Supabase in-list cap)
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

  // ── Poll totals (across all voters — not just profiled ones)
  const pollCounts = { blue: 0, red: 0, tie: 0 }
  let viewerVote: 'blue' | 'red' | 'tie' | null = null
  for (const row of pollVotes) {
    pollCounts[row.winner] = (pollCounts[row.winner] ?? 0) + 1
    if (viewerId && row.user_id === viewerId) viewerVote = row.winner
  }
  const pollTotal = pollVotes.length
  const bluePct = pollTotal > 0 ? Math.round((pollCounts.blue / pollTotal) * 100) : 0
  const redPct = pollTotal > 0 ? Math.round((pollCounts.red / pollTotal) * 100) : 0
  const tiePct = pollTotal > 0 ? Math.round((pollCounts.tie / pollTotal) * 100) : 0
  const pollWinner = decideWinner(pollCounts)

  // ── Dimension counters
  type Counts = Record<string, { blue: number; red: number; tie: number; total: number }>

  const seniorityCounts: Counts = {
    '< 1 month': { blue: 0, red: 0, tie: 0, total: 0 },
    '1–6 months': { blue: 0, red: 0, tie: 0, total: 0 },
    '6+ months': { blue: 0, red: 0, tie: 0, total: 0 },
  }

  const roleCounts: Counts = {}

  const cloutCounts: Counts = {
    'Emerging': { blue: 0, red: 0, tie: 0, total: 0 },
    'Established': { blue: 0, red: 0, tie: 0, total: 0 },
    'Influential': { blue: 0, red: 0, tie: 0, total: 0 },
    'Luminary': { blue: 0, red: 0, tie: 0, total: 0 },
  }

  const activityCounts: Counts = {
    'New (< 10)': { blue: 0, red: 0, tie: 0, total: 0 },
    'Active (10–99)': { blue: 0, red: 0, tie: 0, total: 0 },
    'Veteran (100+)': { blue: 0, red: 0, tie: 0, total: 0 },
  }

  for (const vote of pollVotes) {
    const profile = profileMap.get(vote.user_id)
    if (!profile) continue

    const sKey = seniorityBucket(profile.created_at)
    seniorityCounts[sKey].total++
    seniorityCounts[sKey][vote.winner]++

    const rKey = profile.role ?? 'person'
    if (!roleCounts[rKey]) roleCounts[rKey] = { blue: 0, red: 0, tie: 0, total: 0 }
    roleCounts[rKey].total++
    roleCounts[rKey][vote.winner]++

    const cKey = cloutBucket(profile.clout)
    cloutCounts[cKey].total++
    cloutCounts[cKey][vote.winner]++

    const aKey = activityBucket(profile.total_votes)
    activityCounts[aKey].total++
    activityCounts[aKey][vote.winner]++
  }

  // ── Convert to segments
  function toSegments(counts: Counts, orderedKeys: string[], labelFn: (k: string) => string): VerdictSegment[] {
    return orderedKeys.map((key) => {
      const c = counts[key] ?? { blue: 0, red: 0, tie: 0, total: 0 }
      return {
        label: labelFn(key),
        total: c.total,
        pct: totalVotersWithData > 0 ? Math.round((c.total / totalVotersWithData) * 100) : 0,
        blue: c.blue,
        red: c.red,
        tie: c.tie,
        bluePct: c.total > 0 ? Math.round((c.blue / c.total) * 100) : 0,
        redPct: c.total > 0 ? Math.round((c.red / c.total) * 100) : 0,
        tiePct: c.total > 0 ? Math.round((c.tie / c.total) * 100) : 0,
      }
    })
  }

  const SENIORITY_ORDER = ['< 1 month', '1–6 months', '6+ months']
  const ROLE_ORDER = ['person', 'debator', 'troll_catcher', 'elder']
  const CLOUT_ORDER = ['Emerging', 'Established', 'Influential', 'Luminary']
  const ACTIVITY_ORDER = ['New (< 10)', 'Active (10–99)', 'Veteran (100+)']

  const dimensions: VerdictDimension[] = [
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

  // ── Summary signals
  const vet = seniorityCounts['6+ months']
  const newcomer = seniorityCounts['< 1 month']
  const elder = roleCounts['elder']
  const luminary = cloutCounts['Luminary']

  const veteranWinner = vet.total >= 5 ? decideWinner(vet) : null
  const veteranBluePct = vet.total >= 5 ? Math.round((vet.blue / vet.total) * 100) : null
  const newcomerWinner = newcomer.total >= 5 ? decideWinner(newcomer) : null
  const newcomerBluePct = newcomer.total >= 5 ? Math.round((newcomer.blue / newcomer.total) * 100) : null
  const elderWinner = elder && elder.total >= 3 ? decideWinner(elder) : null
  const elderBluePct = elder && elder.total >= 3 ? Math.round((elder.blue / elder.total) * 100) : null
  const luminaryWinner = luminary.total >= 3 ? decideWinner(luminary) : null
  const luminaryBluePct = luminary.total >= 3 ? Math.round((luminary.blue / luminary.total) * 100) : null

  const response: VerdictCensusResponse = {
    debate: {
      id: debate.id,
      title: debate.title ?? null,
      type: debate.type,
      status: debate.status,
      topic_id: debate.topic_id,
      topic_statement: topicStatement,
      category,
      started_at: debate.started_at ?? null,
      ended_at: debate.ended_at ?? null,
    },
    poll: {
      blue: pollCounts.blue,
      red: pollCounts.red,
      tie: pollCounts.tie,
      total: pollTotal,
      bluePct,
      redPct,
      tiePct,
      winner: pollWinner,
    },
    dimensions,
    veteranWinner,
    veteranBluePct,
    newcomerWinner,
    newcomerBluePct,
    elderWinner,
    elderBluePct,
    luminaryWinner,
    luminaryBluePct,
    viewerVote,
    totalVotersWithData,
  }

  return NextResponse.json(response)
}
