import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CategoryComparison {
  category: string
  user_pct: number   // % of user's votes in this category
  platform_pct: number // % of platform votes in this category
  user_for_pct: number // user's FOR% in this category
  platform_for_pct: number // platform's overall FOR% in this category
  user_count: number
  platform_count: number
}

export interface DimensionStat {
  key: string
  label: string
  description: string
  user_value: number
  platform_median: number
  platform_avg: number
  unit: string
  higher_is_better: boolean
  percentile: number // 0–100: how user ranks vs all users
}

export interface CompareResponse {
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    total_votes: number
    total_arguments: number
    clout: number
    reputation_score: number
    vote_streak: number
    blue_vote_count: number
    red_vote_count: number
    member_since: string
  }
  platform_totals: {
    total_users: number
    total_votes: number
    total_arguments: number
    avg_clout: number
    median_clout: number
    avg_votes: number
    median_votes: number
    avg_arguments: number
    median_arguments: number
    avg_reputation: number
    median_reputation: number
    avg_streak: number
    median_streak: number
    platform_for_pct: number // overall FOR% across all votes
  }
  dimensions: DimensionStat[]
  categories: CategoryComparison[]
  overall_percentile: number // composite percentile
  archetype: string // "Above Average", "Top Tier", "Average", "Emerging"
  archetype_color: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function percentile(sorted: number[], value: number): number {
  if (sorted.length === 0) return 50
  const below = sorted.filter((v) => v < value).length
  return Math.round((below / sorted.length) * 100)
}

function classifyArchetype(pct: number): { label: string; color: string } {
  if (pct >= 90) return { label: 'Elite Civic Voice', color: 'text-gold' }
  if (pct >= 75) return { label: 'Top Tier Citizen', color: 'text-emerald' }
  if (pct >= 50) return { label: 'Above Average', color: 'text-for-400' }
  if (pct >= 25) return { label: 'Average Citizen', color: 'text-surface-500' }
  return { label: 'Emerging Voice', color: 'text-purple' }
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Fetch user profile ────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, avatar_url, role, total_votes, blue_vote_count, red_vote_count, clout, reputation_score, vote_streak, total_arguments, created_at'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // ── Fetch all profiles for platform-wide stats (lightweight) ──────────────
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('total_votes, blue_vote_count, red_vote_count, clout, reputation_score, vote_streak, total_arguments')
    .gt('total_votes', 0)
    .limit(5000)

  const peers = allProfiles ?? []

  const cloutArr   = peers.map((p) => (p.clout as number) ?? 0).sort((a, b) => a - b)
  const votesArr   = peers.map((p) => (p.total_votes as number) ?? 0).sort((a, b) => a - b)
  const argsArr    = peers.map((p) => (p.total_arguments as number) ?? 0).sort((a, b) => a - b)
  const repArr     = peers.map((p) => (p.reputation_score as number) ?? 0).sort((a, b) => a - b)
  const streakArr  = peers.map((p) => (p.vote_streak as number) ?? 0).sort((a, b) => a - b)

  const totalBlue  = peers.reduce((s, p) => s + ((p.blue_vote_count as number) ?? 0), 0)
  const totalRed   = peers.reduce((s, p) => s + ((p.red_vote_count as number) ?? 0), 0)
  const totalVotes = totalBlue + totalRed
  const platformForPct = totalVotes > 0 ? Math.round((totalBlue / totalVotes) * 100) : 50

  // ── User category breakdown ───────────────────────────────────────────────
  const { data: userVotes } = await supabase
    .from('votes')
    .select('side, topic_id')
    .eq('user_id', user.id)
    .limit(3000)

  const userVoteList = userVotes ?? []

  // Get categories for these topics
  let topicCatMap: Map<string, string | null> = new Map()
  if (userVoteList.length > 0) {
    const tids = Array.from(new Set(userVoteList.map((v) => v.topic_id as string)))
    const { data: topicCats } = await supabase
      .from('topics')
      .select('id, category, blue_pct')
      .in('id', tids)
    if (topicCats) {
      topicCatMap = new Map(topicCats.map((t) => [t.id as string, t.category as string | null]))
    }
  }

  // User votes per category
  const userCatCounts: Record<string, { total: number; for: number }> = {}
  for (const v of userVoteList) {
    const cat = topicCatMap.get(v.topic_id as string) ?? 'Other'
    if (!userCatCounts[cat]) userCatCounts[cat] = { total: 0, for: 0 }
    userCatCounts[cat].total++
    if (v.side === 'blue') userCatCounts[cat].for++
  }

  // Platform category distribution from topics
  const { data: platformTopics } = await supabase
    .from('topics')
    .select('category, total_votes, blue_pct')
    .not('category', 'is', null)
    .gt('total_votes', 0)
    .limit(5000)

  const platformCatVotes: Record<string, { total: number; weighted_for: number }> = {}
  for (const t of platformTopics ?? []) {
    const cat = (t.category as string) ?? 'Other'
    if (!platformCatVotes[cat]) platformCatVotes[cat] = { total: 0, weighted_for: 0 }
    const tv = (t.total_votes as number) ?? 0
    const bp = ((t.blue_pct as number) ?? 50) / 100
    platformCatVotes[cat].total += tv
    platformCatVotes[cat].weighted_for += tv * bp
  }

  const totalPlatformVotesCat = Object.values(platformCatVotes).reduce((s, v) => s + v.total, 0)
  const totalUserVotesCat = Object.values(userCatCounts).reduce((s, v) => s + v.total, 0)

  const categories: CategoryComparison[] = CATEGORIES.filter(
    (c) => userCatCounts[c] || platformCatVotes[c]
  ).map((cat) => {
    const uc = userCatCounts[cat] ?? { total: 0, for: 0 }
    const pc = platformCatVotes[cat] ?? { total: 0, weighted_for: 0 }
    return {
      category: cat,
      user_pct:       totalUserVotesCat > 0 ? Math.round((uc.total / totalUserVotesCat) * 1000) / 10 : 0,
      platform_pct:   totalPlatformVotesCat > 0 ? Math.round((pc.total / totalPlatformVotesCat) * 1000) / 10 : 0,
      user_for_pct:   uc.total > 0 ? Math.round((uc.for / uc.total) * 100) : 50,
      platform_for_pct: pc.total > 0 ? Math.round((pc.weighted_for / pc.total) * 100) : 50,
      user_count: uc.total,
      platform_count: pc.total,
    }
  }).filter((c) => c.user_count > 0 || c.platform_count > 50)

  // ── Build dimensions ──────────────────────────────────────────────────────
  const myClout  = (profile.clout as number) ?? 0
  const myVotes  = (profile.total_votes as number) ?? 0
  const myArgs   = (profile.total_arguments as number) ?? 0
  const myRep    = (profile.reputation_score as number) ?? 0
  const myStreak = (profile.vote_streak as number) ?? 0

  const dimensions: DimensionStat[] = [
    {
      key: 'votes',
      label: 'Votes Cast',
      description: 'Total votes you\'ve cast vs. the median active citizen',
      user_value: myVotes,
      platform_median: Math.round(median(votesArr)),
      platform_avg: Math.round(average(votesArr)),
      unit: '',
      higher_is_better: true,
      percentile: percentile(votesArr, myVotes),
    },
    {
      key: 'arguments',
      label: 'Arguments Written',
      description: 'Arguments you\'ve published vs. platform median',
      user_value: myArgs,
      platform_median: Math.round(median(argsArr)),
      platform_avg: Math.round(average(argsArr)),
      unit: '',
      higher_is_better: true,
      percentile: percentile(argsArr, myArgs),
    },
    {
      key: 'clout',
      label: 'Clout',
      description: 'Your clout score vs. the median active citizen',
      user_value: myClout,
      platform_median: Math.round(median(cloutArr)),
      platform_avg: Math.round(average(cloutArr)),
      unit: 'pts',
      higher_is_better: true,
      percentile: percentile(cloutArr, myClout),
    },
    {
      key: 'reputation',
      label: 'Reputation',
      description: 'Your reputation score vs. the platform median',
      user_value: myRep,
      platform_median: Math.round(median(repArr)),
      platform_avg: Math.round(average(repArr)),
      unit: 'pts',
      higher_is_better: true,
      percentile: percentile(repArr, myRep),
    },
    {
      key: 'streak',
      label: 'Vote Streak',
      description: 'Your current streak vs. the platform median',
      user_value: myStreak,
      platform_median: Math.round(median(streakArr)),
      platform_avg: Math.round(average(streakArr)),
      unit: 'days',
      higher_is_better: true,
      percentile: percentile(streakArr, myStreak),
    },
  ]

  const overallPct = Math.round(
    dimensions.reduce((s, d) => s + d.percentile, 0) / dimensions.length
  )

  const { label: archetype, color: archetypeColor } = classifyArchetype(overallPct)

  const platform_totals = {
    total_users: peers.length,
    total_votes: peers.reduce((s, p) => s + ((p.total_votes as number) ?? 0), 0),
    total_arguments: peers.reduce((s, p) => s + ((p.total_arguments as number) ?? 0), 0),
    avg_clout:          Math.round(average(cloutArr)),
    median_clout:       Math.round(median(cloutArr)),
    avg_votes:          Math.round(average(votesArr)),
    median_votes:       Math.round(median(votesArr)),
    avg_arguments:      Math.round(average(argsArr)),
    median_arguments:   Math.round(median(argsArr)),
    avg_reputation:     Math.round(average(repArr)),
    median_reputation:  Math.round(median(repArr)),
    avg_streak:         Math.round(average(streakArr)),
    median_streak:      Math.round(median(streakArr)),
    platform_for_pct:   platformForPct,
  }

  return NextResponse.json({
    user: {
      username:         profile.username as string,
      display_name:     (profile.display_name as string | null) ?? null,
      avatar_url:       (profile.avatar_url as string | null) ?? null,
      role:             profile.role as string,
      total_votes:      myVotes,
      total_arguments:  myArgs,
      clout:            myClout,
      reputation_score: myRep,
      vote_streak:      myStreak,
      blue_vote_count:  (profile.blue_vote_count as number) ?? 0,
      red_vote_count:   (profile.red_vote_count as number) ?? 0,
      member_since:     profile.created_at as string,
    },
    platform_totals,
    dimensions,
    categories,
    overall_percentile: overallPct,
    archetype,
    archetype_color:    archetypeColor,
  } satisfies CompareResponse)
}
