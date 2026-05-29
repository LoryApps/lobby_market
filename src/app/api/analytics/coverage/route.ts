import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryCoverage {
  category: string
  user_votes: number
  total_topics: number
  coverage_pct: number
}

export interface MonthlyCoverage {
  month: string           // 'YYYY-MM'
  votes_in_month: number
  cumulative_votes: number
}

export interface SuggestedTopic {
  id: string
  statement: string
  category: string
  blue_pct: number
  total_votes: number
  status: string
}

export type CoverageTier =
  | 'Lurker'
  | 'Observer'
  | 'Participant'
  | 'Engaged Citizen'
  | 'Civic Stalwart'
  | 'Omnivote'

export interface CoverageData {
  total_user_votes: number
  total_platform_topics: number
  coverage_pct: number
  tier: CoverageTier
  tier_desc: string
  tier_next: CoverageTier | null
  pct_to_next_tier: number | null
  by_category: CategoryCoverage[]
  monthly: MonthlyCoverage[]
  least_covered_category: string | null
  most_covered_category: string | null
  platform_avg_coverage_pct: number
  unvoted_suggestions: SuggestedTopic[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const TIERS: { tier: CoverageTier; min: number; desc: string }[] = [
  { tier: 'Lurker',          min: 0,   desc: 'Just watching for now.' },
  { tier: 'Observer',        min: 5,   desc: 'You\'ve dipped your toes in.' },
  { tier: 'Participant',     min: 15,  desc: 'Engaging with the Lobby.' },
  { tier: 'Engaged Citizen', min: 30,  desc: 'An active voice in the chamber.' },
  { tier: 'Civic Stalwart',  min: 55,  desc: 'You\'ve seen most of what the Lobby debates.' },
  { tier: 'Omnivote',        min: 80,  desc: 'You\'ve voted on almost everything.' },
]

function getTier(pct: number): { tier: CoverageTier; desc: string; next: CoverageTier | null; pctToNext: number | null } {
  let current = TIERS[0]
  for (const t of TIERS) {
    if (pct >= t.min) current = t
    else break
  }
  const idx = TIERS.indexOf(current)
  const next = TIERS[idx + 1] ?? null
  return {
    tier: current.tier,
    desc: current.desc,
    next: next?.tier ?? null,
    pctToNext: next ? next.min - pct : null,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Total active/voting/law topics on the platform
  const { count: totalPlatformTopics } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'voting', 'law', 'proposed', 'failed'])

  const platformTopicsCount = totalPlatformTopics ?? 0

  // All the user's votes (to count coverage)
  const { data: userVoteRows } = await supabase
    .from('votes')
    .select('topic_id, created_at')
    .eq('user_id', user.id)

  const userVotes = userVoteRows ?? []
  const totalUserVotes = userVotes.length

  // Per-category breakdown
  const { data: topicCategoryRows } = await supabase
    .from('topics')
    .select('id, category')
    .in('status', ['active', 'voting', 'law', 'proposed', 'failed'])

  const topicCategories = topicCategoryRows ?? []
  const topicCategoryMap: Record<string, string> = {}
  const categoryTotals: Record<string, number> = {}
  for (const t of topicCategories) {
    const cat = t.category ?? 'Other'
    topicCategoryMap[t.id] = cat
    categoryTotals[cat] = (categoryTotals[cat] ?? 0) + 1
  }

  const userVotedTopicIds = new Set(userVotes.map((v) => v.topic_id))

  const userVotesByCategory: Record<string, number> = {}
  for (const topicId of userVotedTopicIds) {
    const cat = topicCategoryMap[topicId] ?? 'Other'
    userVotesByCategory[cat] = (userVotesByCategory[cat] ?? 0) + 1
  }

  const byCategory: CategoryCoverage[] = ALL_CATEGORIES.map((cat) => {
    const total = categoryTotals[cat] ?? 0
    const votes = userVotesByCategory[cat] ?? 0
    return {
      category: cat,
      user_votes: votes,
      total_topics: total,
      coverage_pct: total > 0 ? Math.round((votes / total) * 1000) / 10 : 0,
    }
  }).sort((a, b) => b.coverage_pct - a.coverage_pct)

  // Overall coverage %
  const coveragePct = platformTopicsCount > 0
    ? Math.round((totalUserVotes / platformTopicsCount) * 1000) / 10
    : 0

  // Tier
  const tierInfo = getTier(coveragePct)

  // Monthly cumulative vote counts
  const monthlyMap: Record<string, number> = {}
  for (const v of userVotes) {
    const month = v.created_at.slice(0, 7)
    monthlyMap[month] = (monthlyMap[month] ?? 0) + 1
  }
  const sortedMonths = Object.keys(monthlyMap).sort()
  let cumulative = 0
  const monthly: MonthlyCoverage[] = sortedMonths.map((month) => {
    cumulative += monthlyMap[month]
    return { month, votes_in_month: monthlyMap[month], cumulative_votes: cumulative }
  })

  // Least and most covered categories (among categories with topics)
  const categoriesWithTopics = byCategory.filter((c) => c.total_topics > 0)
  const leastCovered = categoriesWithTopics.at(-1)?.category ?? null
  const mostCovered = categoriesWithTopics[0]?.category ?? null

  // Platform average coverage (approximate): avg votes per user / total topics
  // Quick estimate: median topics voted across all users would be ideal but
  // is expensive — use total_votes / total_users as a proxy
  const { count: totalVoteCount } = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })

  const { count: totalUserCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  const avgVotesPerUser = totalUserCount && totalUserCount > 0
    ? (totalVoteCount ?? 0) / totalUserCount
    : 0
  const platformAvgCoveragePct = platformTopicsCount > 0
    ? Math.round((avgVotesPerUser / platformTopicsCount) * 1000) / 10
    : 0

  // Suggest 3 unvoted topics from the least-covered category
  let unvotedSuggestions: SuggestedTopic[] = []
  if (leastCovered) {
    const { data: suggestRows } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, status')
      .eq('category', leastCovered)
      .in('status', ['active', 'voting', 'proposed'])
      .not('id', 'in', `(${[...userVotedTopicIds].join(',') || '00000000-0000-0000-0000-000000000000'})`)
      .order('total_votes', { ascending: false })
      .limit(3)

    unvotedSuggestions = (suggestRows ?? []).map((r) => ({
      id: r.id,
      statement: r.statement,
      category: r.category ?? 'Unknown',
      blue_pct: r.blue_pct ?? 50,
      total_votes: r.total_votes ?? 0,
      status: r.status ?? 'active',
    }))
  }

  const result: CoverageData = {
    total_user_votes: totalUserVotes,
    total_platform_topics: platformTopicsCount,
    coverage_pct: coveragePct,
    tier: tierInfo.tier,
    tier_desc: tierInfo.desc,
    tier_next: tierInfo.next,
    pct_to_next_tier: tierInfo.pctToNext ? Math.round(tierInfo.pctToNext * 10) / 10 : null,
    by_category: byCategory,
    monthly,
    least_covered_category: leastCovered,
    most_covered_category: mostCovered,
    platform_avg_coverage_pct: platformAvgCoveragePct,
    unvoted_suggestions: unvotedSuggestions,
  }

  return NextResponse.json(result)
}
