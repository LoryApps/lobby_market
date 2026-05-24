import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface DimensionRank {
  key: string
  label: string
  description: string
  value: number
  unit: string
  rank: number
  total: number
  percentile: number
  delta: number | null
  tier: 'elite' | 'top' | 'high' | 'mid' | 'low'
}

export interface StandingResponse {
  profile: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    member_since: string
  }
  dimensions: DimensionRank[]
  overall_rank: number
  overall_total: number
  overall_percentile: number
  overall_tier: 'elite' | 'top' | 'high' | 'mid' | 'low'
  citizen_count: number
}

function tierFromPercentile(pct: number): DimensionRank['tier'] {
  if (pct >= 97) return 'elite'
  if (pct >= 90) return 'top'
  if (pct >= 70) return 'high'
  if (pct >= 40) return 'mid'
  return 'low'
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 1. Load caller's profile ───────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, avatar_url, role, clout, reputation_score, ' +
      'total_votes, total_arguments, vote_streak, member_since'
    )
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // ── 2. Platform-wide aggregates for percentile calculation ──────────────────
  const [
    { count: citizenCount },
    { count: cloutRank },
    { count: repRank },
    { count: votesRank },
    { count: argsRank },
    { count: streakRank },
    { count: cloutTotal },
    { count: repTotal },
    { count: votesTotal },
    { count: argsTotal },
    { count: streakTotal },
  ] = await Promise.all([
    // Total citizens
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    // Clout rank (how many have MORE clout than me)
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('clout', profile.clout),
    // Reputation rank
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('reputation_score', profile.reputation_score),
    // Votes rank
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('total_votes', profile.total_votes),
    // Arguments rank
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('total_arguments', profile.total_arguments),
    // Streak rank
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('vote_streak', profile.vote_streak),
    // Total with clout > 0
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('clout', 0),
    // Total with rep > 0
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('reputation_score', 0),
    // Total with votes > 0
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('total_votes', 0),
    // Total with args > 0
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('total_arguments', 0),
    // Total with streak > 0
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gt('vote_streak', 0),
  ])

  const total = citizenCount ?? 1

  function pct(rank: number | null, denominator: number | null): number {
    const r = rank ?? 0
    const d = denominator ?? total
    if (d === 0) return 0
    return Math.round(((d - r) / d) * 100)
  }

  // ── 3. Check predictions accuracy ─────────────────────────────────────────
  // ── 4. Build dimensions ────────────────────────────────────────────────────
  const cloutPct = pct(cloutRank, cloutTotal ?? total)
  const repPct = pct(repRank, repTotal ?? total)
  const votesPct = pct(votesRank, votesTotal ?? total)
  const argsPct = pct(argsRank, argsTotal ?? total)
  const streakPct = pct(streakRank, streakTotal ?? total)

  const dimensions: DimensionRank[] = [
    {
      key: 'clout',
      label: 'Clout',
      description: 'Accumulated civic currency earned through quality participation',
      value: profile.clout,
      unit: 'clout',
      rank: (cloutRank ?? 0) + 1,
      total: cloutTotal ?? total,
      percentile: cloutPct,
      delta: null,
      tier: tierFromPercentile(cloutPct),
    },
    {
      key: 'reputation',
      label: 'Reputation',
      description: 'Long-term civic standing based on consistent quality engagement',
      value: Math.round(profile.reputation_score),
      unit: 'points',
      rank: (repRank ?? 0) + 1,
      total: repTotal ?? total,
      percentile: repPct,
      delta: null,
      tier: tierFromPercentile(repPct),
    },
    {
      key: 'votes',
      label: 'Votes Cast',
      description: 'Total votes contributed to consensus formation across all topics',
      value: profile.total_votes,
      unit: 'votes',
      rank: (votesRank ?? 0) + 1,
      total: votesTotal ?? total,
      percentile: votesPct,
      delta: null,
      tier: tierFromPercentile(votesPct),
    },
    {
      key: 'arguments',
      label: 'Arguments',
      description: 'Arguments published to strengthen civic debate',
      value: profile.total_arguments,
      unit: 'arguments',
      rank: (argsRank ?? 0) + 1,
      total: argsTotal ?? total,
      percentile: argsPct,
      delta: null,
      tier: tierFromPercentile(argsPct),
    },
    {
      key: 'streak',
      label: 'Vote Streak',
      description: 'Consecutive days of active participation — consistency is civic virtue',
      value: profile.vote_streak,
      unit: 'days',
      rank: (streakRank ?? 0) + 1,
      total: streakTotal ?? total,
      percentile: streakPct,
      delta: null,
      tier: tierFromPercentile(streakPct),
    },
  ]

  // ── 5. Overall rank: composite score ──────────────────────────────────────
  // Average of the four primary percentiles (clout, rep, votes, args)
  const overallPct = Math.round((cloutPct + repPct + votesPct + argsPct) / 4)

  const response: StandingResponse = {
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      member_since: profile.member_since,
    },
    dimensions,
    overall_rank: Math.round(total * (1 - overallPct / 100)),
    overall_total: total,
    overall_percentile: overallPct,
    overall_tier: tierFromPercentile(overallPct),
    citizen_count: total,
  }

  return NextResponse.json(response)
}
