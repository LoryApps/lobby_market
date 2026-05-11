import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Style dimension keywords (mirrors /api/arguments/dna/route.ts) ──────────

const STYLE_SIGNALS: Record<string, string[]> = {
  empirical: [
    'data', 'evidence', 'research', 'study', 'studies', 'statistics', 'statistic',
    'survey', 'report', 'analysis', 'measured', 'percent', 'rate', 'show', 'shows',
    'found', 'proven', 'scientific', 'source', 'according', 'cited', 'cite',
  ],
  moral: [
    'right', 'wrong', 'just', 'unjust', 'fair', 'unfair', 'equal', 'equality',
    'justice', 'freedom', 'liberty', 'dignity', 'rights', 'duty', 'ethical',
    'moral', 'values', 'principle', 'should', 'ought', 'harm', 'protect',
  ],
  economic: [
    'cost', 'costs', 'benefit', 'benefits', 'market', 'growth', 'budget', 'invest',
    'afford', 'spend', 'tax', 'price', 'profit', 'economic', 'economy', 'gdp',
    'wealth', 'income', 'money', 'financial', 'fund', 'efficient', 'waste',
  ],
  social: [
    'community', 'society', 'together', 'collective', 'public', 'everyone', 'people',
    'citizens', 'neighbors', 'social', 'shared', 'common', 'mutual', 'family',
    'children', 'workers', 'voters', 'majority', 'minority', 'culture',
  ],
  visionary: [
    'future', 'generation', 'tomorrow', 'progress', 'innovation', 'change',
    'transform', 'long-term', 'vision', 'potential', 'opportunity', 'advance',
    'modern', 'new', 'evolve', 'build', 'create', 'lead', 'forward',
  ],
  pragmatic: [
    'practical', 'solution', 'works', 'effective', 'proven', 'implement',
    'apply', 'real', 'actual', 'already', 'example', 'case', 'policy',
    'regulate', 'enforce', 'manage', 'plan', 'step', 'approach', 'method',
  ],
}

const DIMENSION_MAP: Record<string, string> = {
  empirical: 'empiricist',
  moral: 'moralist',
  economic: 'economist',
  social: 'humanist',
  visionary: 'visionary',
  pragmatic: 'pragmatist',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArchetypeUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  argument_count: number
  avg_score: number | null
  best_upvotes: number
}

export interface ArchetypeEntry {
  archetype: string
  name: string
  tagline: string
  color: string
  border: string
  bg: string
  badge: string
  user_count: number
  argument_count: number
  avg_upvotes: number
  avg_score: number | null
  pct_a_grade: number
  top_categories: string[]
  top_users: ArchetypeUser[]
}

export interface ArchetypesResponse {
  archetypes: ArchetypeEntry[]
  my_archetype: string | null
  my_rank: number | null
  total_classified_users: number
}

// ─── Archetype metadata ───────────────────────────────────────────────────────

const ARCHETYPE_META: Record<
  string,
  { name: string; tagline: string; color: string; border: string; bg: string; badge: string }
> = {
  empiricist: {
    name: 'The Empiricist',
    tagline: 'Data speaks louder than opinion',
    color: 'text-for-400',
    border: 'border-for-500/40',
    bg: 'bg-for-500/10',
    badge: 'text-for-400 bg-for-500/15 border-for-500/30',
  },
  moralist: {
    name: 'The Moralist',
    tagline: 'Principles before pragmatics',
    color: 'text-purple',
    border: 'border-purple/40',
    bg: 'bg-purple/10',
    badge: 'text-purple bg-purple/15 border-purple/30',
  },
  economist: {
    name: 'The Economist',
    tagline: 'Every decision has a price tag',
    color: 'text-gold',
    border: 'border-gold/40',
    bg: 'bg-gold/10',
    badge: 'text-gold bg-gold/15 border-gold/30',
  },
  humanist: {
    name: 'The Humanist',
    tagline: 'People are the point',
    color: 'text-emerald',
    border: 'border-emerald/40',
    bg: 'bg-emerald/10',
    badge: 'text-emerald bg-emerald/15 border-emerald/30',
  },
  visionary: {
    name: 'The Visionary',
    tagline: 'Eyes on the horizon',
    color: 'text-against-300',
    border: 'border-against-400/40',
    bg: 'bg-against-500/10',
    badge: 'text-against-300 bg-against-500/15 border-against-400/30',
  },
  pragmatist: {
    name: 'The Pragmatist',
    tagline: 'What actually works matters',
    color: 'text-surface-300',
    border: 'border-surface-400/40',
    bg: 'bg-surface-300/10',
    badge: 'text-surface-300 bg-surface-300/15 border-surface-400/30',
  },
  contrarian: {
    name: 'The Contrarian',
    tagline: 'Challenge is the point',
    color: 'text-against-400',
    border: 'border-against-500/40',
    bg: 'bg-against-500/10',
    badge: 'text-against-400 bg-against-500/15 border-against-500/30',
  },
  advocate: {
    name: 'The Advocate',
    tagline: 'Champion of the case FOR',
    color: 'text-for-300',
    border: 'border-for-500/40',
    bg: 'bg-for-500/10',
    badge: 'text-for-300 bg-for-500/15 border-for-500/30',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function analyzeStyleScores(texts: string[]): Record<string, number> {
  const combined = texts.join(' ').toLowerCase()
  const wordSet = new Set(combined.split(/\s+/))
  const scores: Record<string, number> = {}
  for (const [dim, keywords] of Object.entries(STYLE_SIGNALS)) {
    const hits = keywords.filter((k) => wordSet.has(k)).length
    scores[dim] = Math.min(100, Math.round((hits / keywords.length) * 100 * 2.5))
  }
  return scores
}

function computeArchetype(
  styleScores: Record<string, number>,
  forCount: number,
  againstCount: number
): string {
  const total = forCount + againstCount
  if (total > 2) {
    if (againstCount / total > 0.75) return 'contrarian'
    if (forCount / total > 0.85) return 'advocate'
  }
  const domEntry = Object.entries(styleScores).reduce((a, b) => (b[1] > a[1] ? b : a))
  return DIMENSION_MAP[domEntry[0]] ?? 'pragmatist'
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Get current user (optional)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch a broad sample of arguments with author profile
  // Limit to 4000 most upvoted arguments from any time to keep this fast
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      user_id,
      side,
      content,
      upvotes,
      ai_score,
      ai_grade,
      topics!inner (
        category
      ),
      profiles!inner (
        id,
        username,
        display_name,
        avatar_url,
        role
      )
    `)
    .order('upvotes', { ascending: false })
    .limit(4000)

  type RawArg = {
    id: string
    user_id: string
    side: string
    content: string
    upvotes: number
    ai_score: number | null
    ai_grade: string | null
    topics: { category: string | null } | null
    profiles: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null
  }

  const args = (rawArgs ?? []) as RawArg[]

  if (args.length === 0) {
    return NextResponse.json({
      archetypes: [],
      my_archetype: null,
      my_rank: null,
      total_classified_users: 0,
    } satisfies ArchetypesResponse)
  }

  // ─── Group arguments by user ─────────────────────────────────────────────

  const userMap = new Map<
    string,
    {
      profile: RawArg['profiles']
      texts: string[]
      forCount: number
      againstCount: number
      upvotesArr: number[]
      scoresArr: number[]
      gradesArr: string[]
      categories: Record<string, number>
    }
  >()

  for (const arg of args) {
    if (!arg.profiles || !arg.user_id) continue
    if (!userMap.has(arg.user_id)) {
      userMap.set(arg.user_id, {
        profile: arg.profiles,
        texts: [],
        forCount: 0,
        againstCount: 0,
        upvotesArr: [],
        scoresArr: [],
        gradesArr: [],
        categories: {},
      })
    }
    const u = userMap.get(arg.user_id)!
    u.texts.push(arg.content)
    if (arg.side === 'blue') u.forCount++
    else u.againstCount++
    u.upvotesArr.push(arg.upvotes)
    if (arg.ai_score != null) u.scoresArr.push(arg.ai_score)
    if (arg.ai_grade) u.gradesArr.push(arg.ai_grade)
    const cat = arg.topics?.category ?? 'Other'
    u.categories[cat] = (u.categories[cat] ?? 0) + 1
  }

  // ─── Compute archetype per user ───────────────────────────────────────────

  type ClassifiedUser = {
    id: string
    archetype: string
    profile: RawArg['profiles']
    argumentCount: number
    avgUpvotes: number
    avgScore: number | null
    bestUpvotes: number
    aGradeCount: number
    topCategory: string | null
  }

  const classified: ClassifiedUser[] = []

  for (const [userId, data] of userMap.entries()) {
    if (data.texts.length < 2) continue // need at least 2 arguments for meaningful classification

    const styleScores = analyzeStyleScores(data.texts)
    const archetype = computeArchetype(styleScores, data.forCount, data.againstCount)

    const avgUpvotes =
      data.upvotesArr.length > 0
        ? data.upvotesArr.reduce((a, b) => a + b, 0) / data.upvotesArr.length
        : 0
    const avgScore =
      data.scoresArr.length > 0
        ? data.scoresArr.reduce((a, b) => a + b, 0) / data.scoresArr.length
        : null
    const bestUpvotes = data.upvotesArr.length > 0 ? Math.max(...data.upvotesArr) : 0
    const aGradeCount = data.gradesArr.filter((g) => g === 'A').length

    // Top category for this user
    const topCatEntry = Object.entries(data.categories).sort((a, b) => b[1] - a[1])[0]
    const topCategory = topCatEntry ? topCatEntry[0] : null

    classified.push({
      id: userId,
      archetype,
      profile: data.profile,
      argumentCount: data.texts.length,
      avgUpvotes,
      avgScore,
      bestUpvotes,
      aGradeCount,
      topCategory,
    })
  }

  // ─── Aggregate by archetype ───────────────────────────────────────────────

  const archetypeMap = new Map<string, ClassifiedUser[]>()
  for (const u of classified) {
    if (!archetypeMap.has(u.archetype)) archetypeMap.set(u.archetype, [])
    archetypeMap.get(u.archetype)!.push(u)
  }

  const ALL_ARCHETYPES = [
    'empiricist', 'moralist', 'economist', 'humanist',
    'visionary', 'pragmatist', 'contrarian', 'advocate',
  ]

  const archetypes: ArchetypeEntry[] = ALL_ARCHETYPES.map((archetypeId) => {
    const users = archetypeMap.get(archetypeId) ?? []
    const meta = ARCHETYPE_META[archetypeId]!

    const totalArgs = users.reduce((sum, u) => sum + u.argumentCount, 0)
    const totalUpvotes = users.reduce((sum, u) => sum + u.avgUpvotes * u.argumentCount, 0)
    const avgUpvotes = totalArgs > 0 ? totalUpvotes / totalArgs : 0

    const scoredUsers = users.filter((u) => u.avgScore !== null)
    const avgScore =
      scoredUsers.length > 0
        ? scoredUsers.reduce((sum, u) => sum + (u.avgScore ?? 0), 0) / scoredUsers.length
        : null

    const totalAGrades = users.reduce((sum, u) => sum + u.aGradeCount, 0)
    const totalGraded = users.reduce(
      (sum, u) =>
        sum + (u.avgScore !== null ? u.argumentCount : 0),
      0
    )
    const pctAGrade = totalGraded > 0 ? (totalAGrades / totalGraded) * 100 : 0

    // Category distribution
    const catCounts: Record<string, number> = {}
    for (const u of users) {
      if (u.topCategory) catCounts[u.topCategory] = (catCounts[u.topCategory] ?? 0) + 1
    }
    const topCategories = Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat)

    // Top 3 users: rank by argumentCount desc, then avgScore desc
    const topUsers: ArchetypeUser[] = users
      .sort((a, b) => {
        if (b.argumentCount !== a.argumentCount) return b.argumentCount - a.argumentCount
        return (b.avgScore ?? 0) - (a.avgScore ?? 0)
      })
      .slice(0, 3)
      .map((u) => ({
        id: u.id,
        username: u.profile?.username ?? '',
        display_name: u.profile?.display_name ?? null,
        avatar_url: u.profile?.avatar_url ?? null,
        role: u.profile?.role ?? 'person',
        argument_count: u.argumentCount,
        avg_score: u.avgScore !== null ? Math.round(u.avgScore * 10) / 10 : null,
        best_upvotes: u.bestUpvotes,
      }))

    return {
      archetype: archetypeId,
      name: meta.name,
      tagline: meta.tagline,
      color: meta.color,
      border: meta.border,
      bg: meta.bg,
      badge: meta.badge,
      user_count: users.length,
      argument_count: totalArgs,
      avg_upvotes: Math.round(avgUpvotes * 10) / 10,
      avg_score: avgScore !== null ? Math.round(avgScore * 10) / 10 : null,
      pct_a_grade: Math.round(pctAGrade),
      top_categories: topCategories,
      top_users: topUsers,
    }
  })

  // ─── My archetype + rank ─────────────────────────────────────────────────

  let myArchetype: string | null = null
  let myRank: number | null = null

  if (user) {
    const me = classified.find((u) => u.id === user.id)
    if (me) {
      myArchetype = me.archetype
      const sameArch = (archetypeMap.get(me.archetype) ?? [])
        .sort((a, b) => {
          if (b.argumentCount !== a.argumentCount) return b.argumentCount - a.argumentCount
          return (b.avgScore ?? 0) - (a.avgScore ?? 0)
        })
      myRank = sameArch.findIndex((u) => u.id === user.id) + 1
      if (myRank === 0) myRank = null
    }
  }

  return NextResponse.json({
    archetypes,
    my_archetype: myArchetype,
    my_rank: myRank,
    total_classified_users: classified.length,
  } satisfies ArchetypesResponse)
}
