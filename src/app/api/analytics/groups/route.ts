import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type CivicRole = 'person' | 'debator' | 'troll_catcher' | 'elder'

export interface RoleVotePattern {
  role: CivicRole
  roleLabel: string
  count: number
  totalVotes: number
  avgVotesPerMember: number
  blueVotePct: number
  avgClout: number
  avgReputation: number
  avgArguments: number
  avgStreak: number
}

export interface CategoryRoleBreakdown {
  category: string
  roles: {
    role: CivicRole
    roleLabel: string
    forPct: number
    voteCount: number
  }[]
}

export interface RoleActivityBucket {
  role: CivicRole
  roleLabel: string
  newMembers30d: number
  activeMembers30d: number
  totalMembers: number
  participationRate: number
}

export interface GroupsAnalyticsResponse {
  roles: RoleVotePattern[]
  categoryBreakdown: CategoryRoleBreakdown[]
  activity: RoleActivityBucket[]
  topCategories: { category: string; totalVotes: number }[]
  generatedAt: string
}

const ROLE_LABELS: Record<CivicRole, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

const ROLES: CivicRole[] = ['person', 'debator', 'troll_catcher', 'elder']

const TOP_CATEGORIES = [
  'Politics',
  'Economics',
  'Technology',
  'Ethics',
  'Science',
  'Environment',
  'Health',
  'Education',
  'Culture',
  'Philosophy',
] as const

export async function GET() {
  const supabase = await createClient()

  // ── 1. Role-level profile aggregates ────────────────────────────────────────
  const { data: profileRows } = await supabase
    .from('profiles')
    .select(
      'role, clout, reputation_score, total_votes, total_arguments, vote_streak, blue_vote_count, created_at'
    )
    .in('role', ROLES)
    .limit(5000)

  const profiles = (profileRows ?? []) as {
    role: CivicRole
    clout: number
    reputation_score: number
    total_votes: number
    total_arguments: number
    vote_streak: number
    blue_vote_count: number
    created_at: string
  }[]

  // Aggregate by role
  const byRole: Record<CivicRole, typeof profiles> = {
    person: [],
    debator: [],
    troll_catcher: [],
    elder: [],
  }
  for (const p of profiles) {
    if (ROLES.includes(p.role)) byRole[p.role].push(p)
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const roles: RoleVotePattern[] = ROLES.map((role) => {
    const group = byRole[role]
    const count = group.length
    if (count === 0) {
      return {
        role,
        roleLabel: ROLE_LABELS[role],
        count: 0,
        totalVotes: 0,
        avgVotesPerMember: 0,
        blueVotePct: 50,
        avgClout: 0,
        avgReputation: 0,
        avgArguments: 0,
        avgStreak: 0,
      }
    }
    const totalVotes = group.reduce((s, p) => s + p.total_votes, 0)
    const totalBlue = group.reduce((s, p) => s + p.blue_vote_count, 0)
    const avgClout = group.reduce((s, p) => s + p.clout, 0) / count
    const avgReputation = group.reduce((s, p) => s + p.reputation_score, 0) / count
    const avgArguments = group.reduce((s, p) => s + p.total_arguments, 0) / count
    const avgStreak = group.reduce((s, p) => s + p.vote_streak, 0) / count
    const blueVotePct = totalVotes > 0 ? (totalBlue / totalVotes) * 100 : 50

    return {
      role,
      roleLabel: ROLE_LABELS[role],
      count,
      totalVotes,
      avgVotesPerMember: totalVotes / count,
      blueVotePct,
      avgClout,
      avgReputation,
      avgArguments,
      avgStreak,
    }
  })

  // ── 2. Category breakdown by role ────────────────────────────────────────────
  // Fetch recent votes with topic category
  const { data: voteRows } = await supabase
    .from('votes')
    .select('side, user_id, topic_id')
    .limit(10000)

  const votes = (voteRows ?? []) as { side: string; user_id: string; topic_id: string }[]

  // Get topic categories
  const topicIds = [...new Set(votes.map((v) => v.topic_id))]

  const topicCategoryMap: Record<string, string> = {}
  if (topicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, category')
      .in('id', topicIds.slice(0, 1000))

    for (const t of topicRows ?? []) {
      if (t.category) topicCategoryMap[t.id] = t.category
    }
  }

  // Build userId→role map from a query that includes profile IDs
  const { data: profileIdRows } = await supabase
    .from('profiles')
    .select('id, role')
    .in('role', ROLES)
    .limit(5000)

  const userIdRoleMap: Record<string, CivicRole> = {}
  for (const p of profileIdRows ?? []) {
    userIdRoleMap[p.id] = p.role as CivicRole
  }

  // Category breakdown
  const categoryData: Record<string, Record<CivicRole, { for: number; total: number }>> = {}
  for (const vote of votes) {
    const role = userIdRoleMap[vote.user_id]
    if (!role) continue
    const category = topicCategoryMap[vote.topic_id]
    if (!category) continue
    if (!categoryData[category]) {
      categoryData[category] = { person: { for: 0, total: 0 }, debator: { for: 0, total: 0 }, troll_catcher: { for: 0, total: 0 }, elder: { for: 0, total: 0 } }
    }
    categoryData[category][role].total++
    if (vote.side === 'blue') categoryData[category][role].for++
  }

  // Build category breakdown for top categories with sufficient data
  const categoryBreakdown: CategoryRoleBreakdown[] = TOP_CATEGORIES
    .map((category) => {
      const data = categoryData[category]
      if (!data) return null
      const roleEntries = ROLES
        .map((role) => {
          const { for: f, total } = data[role] ?? { for: 0, total: 0 }
          return {
            role,
            roleLabel: ROLE_LABELS[role],
            forPct: total > 0 ? Math.round((f / total) * 100) : 50,
            voteCount: total,
          }
        })
        .filter((r) => r.voteCount >= 5)
      if (roleEntries.length < 2) return null
      return { category, roles: roleEntries }
    })
    .filter(Boolean) as CategoryRoleBreakdown[]

  // ── 3. Activity metrics ──────────────────────────────────────────────────────
  const activity: RoleActivityBucket[] = ROLES.map((role) => {
    const group = byRole[role]
    const total = group.length
    const newMembers = group.filter((p) => p.created_at >= thirtyDaysAgo).length
    const active = group.filter((p) => p.vote_streak > 0 || p.total_votes > 0).length
    return {
      role,
      roleLabel: ROLE_LABELS[role],
      totalMembers: total,
      newMembers30d: newMembers,
      activeMembers30d: active,
      participationRate: total > 0 ? Math.round((active / total) * 100) : 0,
    }
  })

  // ── 4. Top categories overall ────────────────────────────────────────────────
  const catTotals: Record<string, number> = {}
  for (const [cat, roleMap] of Object.entries(categoryData)) {
    catTotals[cat] = ROLES.reduce((s, r) => s + (roleMap[r]?.total ?? 0), 0)
  }
  const topCategories = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, totalVotes]) => ({ category, totalVotes }))

  return NextResponse.json({
    roles,
    categoryBreakdown,
    activity,
    topCategories,
    generatedAt: new Date().toISOString(),
  } satisfies GroupsAnalyticsResponse)
}
