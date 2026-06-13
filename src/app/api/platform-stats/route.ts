import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryStat {
  category: string
  laws: number
  topics: number
  totalVotes: number
  forPct: number
}

export interface RecentLaw {
  id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number
  total_votes: number
}

export interface MonthlyPoint {
  month: string       // "2025-01"
  label: string       // "Jan"
  laws: number
  votes: number
  newUsers: number
}

export interface TopContributor {
  username: string
  displayName: string | null
  avatarUrl: string | null
  clout: number
  totalVotes: number
  totalArguments: number
  role: string
}

export interface Milestone {
  type: 'laws' | 'votes' | 'users'
  label: string
  current: number
  next: number
  pct: number
}

export interface PlatformStatsResponse {
  totals: {
    laws: number
    activeTopics: number
    proposedTopics: number
    failedTopics: number
    votingTopics: number
    totalTopics: number
    votes: number
    arguments: number
    users: number
    debates: number
    coalitions: number
    predictions: number
  }
  categoryBreakdown: CategoryStat[]
  recentLaws: RecentLaw[]
  monthlyGrowth: MonthlyPoint[]
  topContributors: TopContributor[]
  milestone: Milestone
  generatedAt: string
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Run all heavy queries in parallel for speed
  const [
    lawsRes,
    topicsRes,
    profilesRes,
    debatesRes,
    coalitionsRes,
    predictionsRes,
    recentLawsRes,
    topContributorsRes,
  ] = await Promise.all([
    // Laws totals + category breakdown
    supabase
      .from('laws')
      .select('id, statement, category, established_at, blue_pct, total_votes')
      .order('established_at', { ascending: false }),

    // Topics by status + vote totals
    supabase
      .from('topics')
      .select('id, status, category, blue_pct, total_votes, created_at'),

    // Users (count + top contributors)
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url, clout, total_votes, total_arguments, role')
      .order('clout', { ascending: false })
      .limit(500),

    // Debates count
    supabase.from('debates').select('id', { count: 'exact', head: true }),

    // Coalitions count
    supabase.from('coalitions').select('id', { count: 'exact', head: true }),

    // Predictions count
    supabase.from('predictions').select('id', { count: 'exact', head: true }),

    // Most recent 8 laws for display
    supabase
      .from('laws')
      .select('id, statement, category, established_at, blue_pct, total_votes')
      .order('established_at', { ascending: false })
      .limit(8),

    // Top 6 contributors by clout
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url, clout, total_votes, total_arguments, role')
      .order('clout', { ascending: false })
      .limit(6),
  ])

  const allLaws = lawsRes.data ?? []
  const allTopics = topicsRes.data ?? []
  const allProfiles = profilesRes.data ?? []

  // ── Totals ─────────────────────────────────────────────────────────────────

  const statusCounts = allTopics.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const totalVotes = allTopics.reduce((sum, t) => sum + (t.total_votes ?? 0), 0)
  const totalArguments = allProfiles.reduce((sum, p) => sum + (p.total_arguments ?? 0), 0)

  const totals = {
    laws: allLaws.length,
    activeTopics: statusCounts['active'] ?? 0,
    proposedTopics: statusCounts['proposed'] ?? 0,
    failedTopics: statusCounts['failed'] ?? 0,
    votingTopics: statusCounts['voting'] ?? 0,
    totalTopics: allTopics.length,
    votes: totalVotes,
    arguments: totalArguments,
    users: allProfiles.length,
    debates: debatesRes.count ?? 0,
    coalitions: coalitionsRes.count ?? 0,
    predictions: predictionsRes.count ?? 0,
  }

  // ── Category breakdown ─────────────────────────────────────────────────────

  const catMap = new Map<
    string,
    { laws: number; topics: number; totalVotes: number; forVotes: number }
  >()

  for (const law of allLaws) {
    const cat = law.category ?? 'Other'
    const entry = catMap.get(cat) ?? { laws: 0, topics: 0, totalVotes: 0, forVotes: 0 }
    entry.laws++
    entry.totalVotes += law.total_votes ?? 0
    entry.forVotes += Math.round(((law.blue_pct ?? 50) / 100) * (law.total_votes ?? 0))
    catMap.set(cat, entry)
  }

  for (const topic of allTopics) {
    const cat = topic.category ?? 'Other'
    const entry = catMap.get(cat) ?? { laws: 0, topics: 0, totalVotes: 0, forVotes: 0 }
    entry.topics++
    if (topic.status !== 'law') {
      entry.totalVotes += topic.total_votes ?? 0
      entry.forVotes += Math.round(((topic.blue_pct ?? 50) / 100) * (topic.total_votes ?? 0))
    }
    catMap.set(cat, entry)
  }

  const categoryBreakdown: CategoryStat[] = Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      laws: data.laws,
      topics: data.topics,
      totalVotes: data.totalVotes,
      forPct: data.totalVotes > 0 ? Math.round((data.forVotes / data.totalVotes) * 100) : 50,
    }))
    .sort((a, b) => b.laws - a.laws)
    .slice(0, 10)

  // ── Monthly growth (last 6 months) ─────────────────────────────────────────

  const monthlyGrowth: MonthlyPoint[] = []
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = d.toLocaleDateString('en-US', { month: 'short' })

    const lawsThisMonth = allLaws.filter((l) => {
      const ea = l.established_at
      return ea >= d.toISOString() && ea < nextD.toISOString()
    }).length

    const votesThisMonth = allTopics
      .filter((t) => {
        const ca = t.created_at
        return ca >= d.toISOString() && ca < nextD.toISOString()
      })
      .reduce((sum, t) => sum + (t.total_votes ?? 0), 0)

    const newUsersThisMonth = 0

    monthlyGrowth.push({
      month: monthKey,
      label: monthLabel,
      laws: lawsThisMonth,
      votes: votesThisMonth,
      newUsers: newUsersThisMonth,
    })
  }

  // ── Recent laws ────────────────────────────────────────────────────────────

  const recentLaws: RecentLaw[] = (recentLawsRes.data ?? []).map((l) => ({
    id: l.id,
    statement: l.statement,
    category: l.category,
    established_at: l.established_at,
    blue_pct: l.blue_pct,
    total_votes: l.total_votes,
  }))

  // ── Top contributors ───────────────────────────────────────────────────────

  const topContributors: TopContributor[] = (topContributorsRes.data ?? []).map((p) => ({
    username: p.username,
    displayName: p.display_name,
    avatarUrl: p.avatar_url,
    clout: p.clout,
    totalVotes: p.total_votes,
    totalArguments: p.total_arguments,
    role: p.role,
  }))

  // ── Milestone ──────────────────────────────────────────────────────────────

  const VOTE_MILESTONES = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000]
  const LAW_MILESTONES = [10, 25, 50, 100, 250, 500, 1_000]
  const USER_MILESTONES = [100, 500, 1_000, 5_000, 10_000, 50_000]

  function nextMilestone(current: number, milestones: number[]) {
    return milestones.find((m) => m > current) ?? milestones[milestones.length - 1]
  }

  const nextVotes = nextMilestone(totals.votes, VOTE_MILESTONES)
  const nextLaws = nextMilestone(totals.laws, LAW_MILESTONES)
  const nextUsers = nextMilestone(totals.users, USER_MILESTONES)

  const prevVotes = VOTE_MILESTONES[VOTE_MILESTONES.indexOf(nextVotes) - 1] ?? 0
  const prevLaws = LAW_MILESTONES[LAW_MILESTONES.indexOf(nextLaws) - 1] ?? 0
  const prevUsers = USER_MILESTONES[USER_MILESTONES.indexOf(nextUsers) - 1] ?? 0

  const votePct = Math.min(99, Math.round(((totals.votes - prevVotes) / (nextVotes - prevVotes)) * 100))
  const lawPct = Math.min(99, Math.round(((totals.laws - prevLaws) / (nextLaws - prevLaws)) * 100))
  const userPct = Math.min(99, Math.round(((totals.users - prevUsers) / (nextUsers - prevUsers)) * 100))

  // Pick whichever milestone is closest (highest pct)
  let milestone: Milestone
  if (lawPct >= votePct && lawPct >= userPct) {
    milestone = { type: 'laws', label: `${nextLaws.toLocaleString()} Laws`, current: totals.laws, next: nextLaws, pct: lawPct }
  } else if (votePct >= userPct) {
    milestone = { type: 'votes', label: `${nextVotes.toLocaleString()} Votes`, current: totals.votes, next: nextVotes, pct: votePct }
  } else {
    milestone = { type: 'users', label: `${nextUsers.toLocaleString()} Citizens`, current: totals.users, next: nextUsers, pct: userPct }
  }

  const response: PlatformStatsResponse = {
    totals,
    categoryBreakdown,
    recentLaws,
    monthlyGrowth,
    topContributors,
    milestone,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  })
}
