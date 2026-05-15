import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BenchmarkStat {
  key: string
  label: string
  unit: string
  value: number
  cohort_median: number
  cohort_p75: number
  cohort_p90: number
  percentile: number
}

export interface CohortPeer {
  rank: number
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_votes: number
  reputation_score: number
  joined_at: string
}

export interface BenchmarkResponse {
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    joined_at: string
  }
  cohort_window_days: number
  cohort_size: number
  stats: BenchmarkStat[]
  top_peers: CohortPeer[]
  overall_percentile: number
}

// ─── Helper: compute percentile of `value` in a sorted array ─────────────────

function pctile(sorted: number[], value: number): number {
  if (sorted.length === 0) return 50
  const below = sorted.filter((v) => v < value).length
  return Math.round((below / sorted.length) * 100)
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

function p75(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const idx = Math.floor(sorted.length * 0.75)
  return sorted[Math.min(idx, sorted.length - 1)]
}

function p90(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const idx = Math.floor(sorted.length * 0.9)
  return sorted[Math.min(idx, sorted.length - 1)]
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch current user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, avatar_url, role, clout, total_votes, reputation_score, total_arguments, created_at'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const joinedAt = new Date(profile.created_at as string)

  // Cohort window: ±15 days from user join date (30-day window)
  const windowDays = 15
  const windowStart = new Date(joinedAt.getTime() - windowDays * 86_400_000).toISOString()
  const windowEnd = new Date(joinedAt.getTime() + windowDays * 86_400_000).toISOString()

  // Fetch cohort profiles
  const { data: cohortRows } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, role, clout, total_votes, reputation_score, total_arguments, created_at'
    )
    .gte('created_at', windowStart)
    .lte('created_at', windowEnd)
    .order('clout', { ascending: false })
    .limit(500)

  const cohort = (cohortRows ?? []).filter((p) => p.id !== user.id)
  const cohortSize = cohort.length

  // Build sorted arrays for each metric (ascending for percentile calc)
  type ProfileRow = (typeof cohort)[number]

  function sortedMetric(key: keyof ProfileRow): number[] {
    return cohort
      .map((p) => (typeof p[key] === 'number' ? (p[key] as number) : 0))
      .sort((a, b) => a - b)
  }

  const cloutArr = sortedMetric('clout')
  const votesArr = sortedMetric('total_votes')
  const repArr = sortedMetric('reputation_score')
  const argsArr = sortedMetric('total_arguments')

  const myClout = (profile.clout as number) ?? 0
  const myVotes = (profile.total_votes as number) ?? 0
  const myRep = (profile.reputation_score as number) ?? 0
  const myArgs = (profile.total_arguments as number) ?? 0

  const stats: BenchmarkStat[] = [
    {
      key: 'clout',
      label: 'Clout',
      unit: 'pts',
      value: myClout,
      cohort_median: median(cloutArr),
      cohort_p75: p75(cloutArr),
      cohort_p90: p90(cloutArr),
      percentile: pctile(cloutArr, myClout),
    },
    {
      key: 'total_votes',
      label: 'Votes Cast',
      unit: '',
      value: myVotes,
      cohort_median: median(votesArr),
      cohort_p75: p75(votesArr),
      cohort_p90: p90(votesArr),
      percentile: pctile(votesArr, myVotes),
    },
    {
      key: 'reputation_score',
      label: 'Reputation',
      unit: 'pts',
      value: myRep,
      cohort_median: median(repArr),
      cohort_p75: p75(repArr),
      cohort_p90: p90(repArr),
      percentile: pctile(repArr, myRep),
    },
    {
      key: 'total_arguments',
      label: 'Arguments',
      unit: '',
      value: myArgs,
      cohort_median: median(argsArr),
      cohort_p75: p75(argsArr),
      cohort_p90: p90(argsArr),
      percentile: pctile(argsArr, myArgs),
    },
  ]

  // Overall percentile: average across the four stat percentiles
  const overallPercentile = Math.round(
    stats.reduce((sum, s) => sum + s.percentile, 0) / stats.length
  )

  // Top 5 peers by clout
  const top_peers: CohortPeer[] = cohort.slice(0, 5).map((p, i) => ({
    rank: i + 1,
    username: p.username as string,
    display_name: (p.display_name as string | null) ?? null,
    avatar_url: (p.avatar_url as string | null) ?? null,
    role: p.role as string,
    clout: (p.clout as number) ?? 0,
    total_votes: (p.total_votes as number) ?? 0,
    reputation_score: (p.reputation_score as number) ?? 0,
    joined_at: p.created_at as string,
  }))

  return NextResponse.json({
    user: {
      username: profile.username as string,
      display_name: (profile.display_name as string | null) ?? null,
      avatar_url: (profile.avatar_url as string | null) ?? null,
      role: profile.role as string,
      joined_at: profile.created_at as string,
    },
    cohort_window_days: windowDays,
    cohort_size: cohortSize,
    stats,
    top_peers,
    overall_percentile: overallPercentile,
  } satisfies BenchmarkResponse)
}
