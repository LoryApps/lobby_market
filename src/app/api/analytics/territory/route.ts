import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

const SCOPES = ['Global', 'National', 'Regional', 'Local'] as const

export type CivicCategory = (typeof CATEGORIES)[number]
export type CivicScope = (typeof SCOPES)[number]

export type TerritoryArchetype =
  | 'explorer'
  | 'generalist'
  | 'specialist'
  | 'pioneer'
  | 'newcomer'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TerritoryCell {
  category: CivicCategory
  scope: CivicScope
  votes: number
  for_votes: number
  against_votes: number
  for_pct: number
  available: number
  coverage: number         // 0–100: votes / available * 100, capped at 100
  is_explored: boolean     // at least 1 vote
  is_mastered: boolean     // coverage >= 80 and votes >= 5
}

export interface TopTerritory {
  category: CivicCategory
  scope: CivicScope
  votes: number
  for_pct: number
}

export interface UnexploredTerritory {
  category: CivicCategory
  scope: CivicScope
  available: number
}

export interface TerritoryResponse {
  authenticated: true
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  total_votes: number
  territories_explored: number
  territories_mastered: number
  total_territories: number
  territory_score: number         // 0–100
  archetype: TerritoryArchetype
  archetype_label: string
  archetype_tagline: string
  archetype_description: string
  favorite_territory: TopTerritory | null
  top_territories: TopTerritory[]
  unexplored: UnexploredTerritory[]
  grid: TerritoryCell[][]         // grid[categoryIndex][scopeIndex]
  category_totals: { category: string; votes: number; explored_scopes: number }[]
  scope_totals: { scope: string; votes: number; explored_categories: number }[]
}

export interface TerritoryResponseUnauthenticated {
  authenticated: false
}

// ─── Archetype logic ──────────────────────────────────────────────────────────

const ARCHETYPE_CONFIG: Record<
  TerritoryArchetype,
  { label: string; tagline: string; description: string }
> = {
  explorer: {
    label: 'The Explorer',
    tagline: 'Mapping uncharted civic territory',
    description:
      'You range widely across categories and scopes, leaving no civic corner unexplored. Your civic fingerprint spans the full map.',
  },
  generalist: {
    label: 'The Generalist',
    tagline: 'Engaged across the civic landscape',
    description:
      'You participate broadly across civic categories, building a well-rounded picture of your views on society.',
  },
  specialist: {
    label: 'The Specialist',
    tagline: 'Deep expertise in chosen territories',
    description:
      'You concentrate your civic energy in specific categories, building deep expertise rather than broad coverage.',
  },
  pioneer: {
    label: 'The Pioneer',
    tagline: 'Staking out new civic ground',
    description:
      'You are actively expanding your civic territory, consistently voting in new categories and scopes.',
  },
  newcomer: {
    label: 'The Newcomer',
    tagline: 'Just beginning the civic journey',
    description:
      'Your civic territory is still forming. Keep voting to unlock new categories and discover your civic identity.',
  },
}

function pickArchetype(
  explored: number,
  mastered: number,
  totalVotes: number,
  uniqueCategories: number,
  uniqueScopes: number,
): TerritoryArchetype {
  if (totalVotes < 5) return 'newcomer'
  const coverage = explored / 40           // 40 = 10 categories × 4 scopes
  const catBreadth = uniqueCategories / 10
  const scopeBreadth = uniqueScopes / 4
  const masteredPct = mastered / Math.max(1, explored)

  if (coverage >= 0.7) return 'explorer'
  if (catBreadth >= 0.7 && scopeBreadth >= 0.5) return 'generalist'
  if (catBreadth <= 0.4 && masteredPct >= 0.5) return 'specialist'
  return 'pioneer'
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json<TerritoryResponseUnauthenticated>({
      authenticated: false,
    })
  }

  const [profileRes, votesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', user.id)
      .single(),

    // Fetch all user votes joined with the topic's category and scope
    supabase
      .from('topic_votes')
      .select('side, topics!inner(category, scope, status)')
      .eq('user_id', user.id),
  ])

  const profile = profileRes.data

  type VoteRow = {
    side: string
    topics: { category: string | null; scope: string | null; status: string } | null
  }
  const allVotes: VoteRow[] = (votesRes.data ?? []) as VoteRow[]

  // Count available topics per (category, scope) — only proposed/active/voting/law
  const availableRes = await supabase
    .from('topics')
    .select('category, scope')
    .in('status', ['proposed', 'active', 'voting', 'law'])

  // Build availability map: category_scope → count
  const availMap: Record<string, number> = {}
  for (const t of availableRes.data ?? []) {
    if (!t.category || !t.scope) continue
    const key = `${t.category}::${t.scope}`
    availMap[key] = (availMap[key] ?? 0) + 1
  }

  // Build vote matrix: category_scope → { votes, for_votes }
  const voteMatrix: Record<string, { votes: number; for_votes: number }> = {}
  let totalVotes = 0

  for (const v of allVotes) {
    const cat = v.topics?.category
    const scope = v.topics?.scope
    if (!cat || !scope) continue
    const key = `${cat}::${scope}`
    if (!voteMatrix[key]) voteMatrix[key] = { votes: 0, for_votes: 0 }
    voteMatrix[key].votes++
    if (v.side === 'blue') voteMatrix[key].for_votes++
    totalVotes++
  }

  // Build full 10×4 grid
  const grid: TerritoryCell[][] = CATEGORIES.map((category) =>
    SCOPES.map((scope) => {
      const key = `${category}::${scope}`
      const vm = voteMatrix[key] ?? { votes: 0, for_votes: 0 }
      const available = availMap[key] ?? 0
      const coverage = available > 0 ? Math.min(100, (vm.votes / available) * 100) : 0
      const for_pct =
        vm.votes > 0 ? Math.round((vm.for_votes / vm.votes) * 100) : 50

      return {
        category,
        scope,
        votes: vm.votes,
        for_votes: vm.for_votes,
        against_votes: vm.votes - vm.for_votes,
        for_pct,
        available,
        coverage: Math.round(coverage),
        is_explored: vm.votes > 0,
        is_mastered: coverage >= 80 && vm.votes >= 5,
      }
    }),
  )

  // Aggregate stats
  const territoriesExplored = grid.flat().filter((c) => c.is_explored).length
  const territoriesMastered = grid.flat().filter((c) => c.is_mastered).length
  const uniqueCategories = CATEGORIES.filter((cat) =>
    SCOPES.some((scope) => (voteMatrix[`${cat}::${scope}`]?.votes ?? 0) > 0),
  ).length
  const uniqueScopes = SCOPES.filter((scope) =>
    CATEGORIES.some((cat) => (voteMatrix[`${cat}::${scope}`]?.votes ?? 0) > 0),
  ).length

  // Territory score: 50% coverage breadth + 30% mastery + 20% vote volume
  const breadthScore = (territoriesExplored / 40) * 100
  const masteryScore = territoriesMastered > 0 ? (territoriesMastered / territoriesExplored) * 100 : 0
  const volumeScore = Math.min(100, (totalVotes / 200) * 100)
  const territoryScore = Math.round(
    breadthScore * 0.5 + masteryScore * 0.3 + volumeScore * 0.2,
  )

  const archetype = pickArchetype(
    territoriesExplored,
    territoriesMastered,
    totalVotes,
    uniqueCategories,
    uniqueScopes,
  )

  // Top territories (most votes)
  const allExplored: TopTerritory[] = []
  for (const row of grid) {
    for (const cell of row) {
      if (cell.is_explored) {
        allExplored.push({
          category: cell.category,
          scope: cell.scope,
          votes: cell.votes,
          for_pct: cell.for_pct,
        })
      }
    }
  }
  allExplored.sort((a, b) => b.votes - a.votes)

  // Unexplored territories with available topics
  const unexplored: UnexploredTerritory[] = []
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.is_explored && cell.available > 0) {
        unexplored.push({
          category: cell.category,
          scope: cell.scope,
          available: cell.available,
        })
      }
    }
  }
  unexplored.sort((a, b) => b.available - a.available)

  // Category totals
  const categoryTotals = CATEGORIES.map((cat) => {
    const votes = SCOPES.reduce(
      (sum, scope) => sum + (voteMatrix[`${cat}::${scope}`]?.votes ?? 0),
      0,
    )
    const exploredScopes = SCOPES.filter(
      (scope) => (voteMatrix[`${cat}::${scope}`]?.votes ?? 0) > 0,
    ).length
    return { category: cat, votes, explored_scopes: exploredScopes }
  })

  // Scope totals
  const scopeTotals = SCOPES.map((scope) => {
    const votes = CATEGORIES.reduce(
      (sum, cat) => sum + (voteMatrix[`${cat}::${scope}`]?.votes ?? 0),
      0,
    )
    const exploredCategories = CATEGORIES.filter(
      (cat) => (voteMatrix[`${cat}::${scope}`]?.votes ?? 0) > 0,
    ).length
    return { scope, votes, explored_categories: exploredCategories }
  })

  return NextResponse.json<TerritoryResponse>({
    authenticated: true,
    user: {
      username: profile?.username ?? '',
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    },
    total_votes: totalVotes,
    territories_explored: territoriesExplored,
    territories_mastered: territoriesMastered,
    total_territories: 40,
    territory_score: territoryScore,
    archetype,
    archetype_label: ARCHETYPE_CONFIG[archetype].label,
    archetype_tagline: ARCHETYPE_CONFIG[archetype].tagline,
    archetype_description: ARCHETYPE_CONFIG[archetype].description,
    favorite_territory: allExplored[0] ?? null,
    top_territories: allExplored.slice(0, 5),
    unexplored: unexplored.slice(0, 6),
    grid,
    category_totals: categoryTotals,
    scope_totals: scopeTotals,
  })
}
