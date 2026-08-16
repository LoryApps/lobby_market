import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface BenchmarkMetric {
  label: string
  key: string
  userValue: number
  platformMedian: number
  platformP90: number
  percentile: number
  unit?: string
  higher_is_better: boolean
}

export interface BenchmarkData {
  profile: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    civic_archetype: string | null
  }
  metrics: BenchmarkMetric[]
  overallScore: number
  tier: 'observer' | 'active' | 'engaged' | 'power' | 'champion'
  tierLabel: string
  totalUsers: number
  memberSinceDays: number
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch the requesting user's profile ────────────────────────────────────

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, avatar_url, role, civic_archetype, clout, reputation_score, total_votes, total_arguments, vote_streak, followers_count, created_at'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── Fetch platform-wide aggregate stats ────────────────────────────────────
  // We compute median and P90 approximations from the full profiles table.
  // Using percentile_cont requires a DB function; instead we use a counted approach:
  // fetch count of users with < userValue to get percentile.

  const [totalRes, ...percentilesRes] = await Promise.all([
    // Total user count
    supabase.from('profiles').select('id', { count: 'exact', head: true }),

    // Votes percentile
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .lt('total_votes', profile.total_votes),

    // Arguments percentile
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .lt('total_arguments', profile.total_arguments),

    // Clout percentile
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .lt('clout', profile.clout),

    // Reputation percentile
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .lt('reputation_score', profile.reputation_score),

    // Streak percentile
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .lt('vote_streak', profile.vote_streak),

    // Followers percentile
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .lt('followers_count', profile.followers_count ?? 0),
  ])

  const totalUsers = totalRes.count ?? 1

  const pctVotes = Math.round(((percentilesRes[0].count ?? 0) / totalUsers) * 100)
  const pctArgs = Math.round(((percentilesRes[1].count ?? 0) / totalUsers) * 100)
  const pctClout = Math.round(((percentilesRes[2].count ?? 0) / totalUsers) * 100)
  const pctRep = Math.round(((percentilesRes[3].count ?? 0) / totalUsers) * 100)
  const pctStreak = Math.round(((percentilesRes[4].count ?? 0) / totalUsers) * 100)
  const pctFollowers = Math.round(((percentilesRes[5].count ?? 0) / totalUsers) * 100)

  // ── Approximate platform medians ───────────────────────────────────────────
  // Fetch users at the 50th and 90th percentile positions
  const median50 = Math.floor(totalUsers * 0.5)
  const top10 = Math.floor(totalUsers * 0.9)

  const [medianRow, p90Row] = await Promise.all([
    supabase
      .from('profiles')
      .select('total_votes, total_arguments, clout, reputation_score, vote_streak, followers_count')
      .order('total_votes', { ascending: true })
      .range(median50, median50)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('total_votes, total_arguments, clout, reputation_score, vote_streak, followers_count')
      .order('total_votes', { ascending: true })
      .range(top10, top10)
      .maybeSingle(),
  ])

  const median = medianRow.data ?? {
    total_votes: 5,
    total_arguments: 1,
    clout: 100,
    reputation_score: 10,
    vote_streak: 1,
    followers_count: 0,
  }
  const p90 = p90Row.data ?? {
    total_votes: 50,
    total_arguments: 10,
    clout: 500,
    reputation_score: 50,
    vote_streak: 7,
    followers_count: 5,
  }

  // ── Build metrics array ────────────────────────────────────────────────────

  const metrics: BenchmarkMetric[] = [
    {
      label: 'Votes Cast',
      key: 'votes',
      userValue: profile.total_votes,
      platformMedian: median.total_votes ?? 5,
      platformP90: p90.total_votes ?? 50,
      percentile: pctVotes,
      higher_is_better: true,
    },
    {
      label: 'Arguments Written',
      key: 'arguments',
      userValue: profile.total_arguments,
      platformMedian: median.total_arguments ?? 1,
      platformP90: p90.total_arguments ?? 10,
      percentile: pctArgs,
      higher_is_better: true,
    },
    {
      label: 'Clout',
      key: 'clout',
      userValue: profile.clout,
      platformMedian: median.clout ?? 100,
      platformP90: p90.clout ?? 500,
      percentile: pctClout,
      unit: 'pts',
      higher_is_better: true,
    },
    {
      label: 'Reputation',
      key: 'reputation',
      userValue: profile.reputation_score,
      platformMedian: median.reputation_score ?? 10,
      platformP90: p90.reputation_score ?? 50,
      percentile: pctRep,
      unit: 'pts',
      higher_is_better: true,
    },
    {
      label: 'Vote Streak',
      key: 'streak',
      userValue: profile.vote_streak,
      platformMedian: median.vote_streak ?? 1,
      platformP90: p90.vote_streak ?? 7,
      percentile: pctStreak,
      unit: 'days',
      higher_is_better: true,
    },
    {
      label: 'Followers',
      key: 'followers',
      userValue: profile.followers_count ?? 0,
      platformMedian: median.followers_count ?? 0,
      platformP90: p90.followers_count ?? 5,
      percentile: pctFollowers,
      higher_is_better: true,
    },
  ]

  // ── Overall score = mean of all percentiles ────────────────────────────────
  const overallScore = Math.round(
    metrics.reduce((sum, m) => sum + m.percentile, 0) / metrics.length
  )

  const tier =
    overallScore >= 90
      ? 'champion'
      : overallScore >= 70
      ? 'power'
      : overallScore >= 45
      ? 'engaged'
      : overallScore >= 20
      ? 'active'
      : 'observer'

  const tierLabel: Record<string, string> = {
    observer: 'Observer',
    active: 'Active Citizen',
    engaged: 'Engaged Civic Voice',
    power: 'Power User',
    champion: 'Civic Champion',
  }

  const memberSinceDays = Math.floor(
    (Date.now() - new Date(profile.created_at).getTime()) / 86_400_000
  )

  const body: BenchmarkData = {
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      civic_archetype: profile.civic_archetype,
    },
    metrics,
    overallScore,
    tier,
    tierLabel: tierLabel[tier],
    totalUsers,
    memberSinceDays,
  }

  return NextResponse.json(body)
}
