import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryLens {
  category: string
  userVotes: number
  userForPct: number       // user's FOR% in this category (0–100)
  communityForPct: number  // platform-wide FOR% in this category (0–100)
  divergence: number       // |userForPct − communityForPct| (0–100)
  direction: 'more_for' | 'more_against' | 'aligned'
}

export interface OutlierVote {
  topicId: string
  statement: string
  category: string | null
  side: 'blue' | 'red'
  communityForPct: number  // topic's current blue_pct
  outlierGap: number       // |user_side_pct − 50| relative magnitude
  status: string
}

export interface LensData {
  totalVotes: number
  categoriesEngaged: number    // distinct categories with ≥ 1 vote
  diversityScore: number       // 0–100 (how spread across all 10 categories)
  alignmentScore: number       // 0–100 (100 = perfectly aligned with community)
  contrarianScore: number      // 0–100 (100 = always contrarian)
  echoScore: number            // 0–100 (100 = always with majority)
  byCategory: CategoryLens[]
  outlierVotes: OutlierVote[]  // votes where user was in minority (< 35% with them)
  mostDivergentCategory: string | null
  mostAlignedCategory: string | null
  lensArchetype: LensArchetype
  archetypeLabel: string
  archetypeDescription: string
}

export type LensArchetype =
  | 'contrarian'    // diversityScore < 40 AND contrarianScore > 60
  | 'maverick'      // diversityScore > 60 AND contrarianScore > 50
  | 'oracle'        // diversityScore > 60 AND alignmentScore > 60
  | 'specialist'    // diversityScore < 40 AND alignmentScore > 60
  | 'balanced'      // everything roughly 40–60
  | 'newcomer'      // totalVotes < 10

const ARCHETYPE_META: Record<LensArchetype, { label: string; description: string }> = {
  contrarian: {
    label: 'The Contrarian',
    description: 'You consistently break from majority opinion and stick to a focused set of topics you care deeply about.',
  },
  maverick: {
    label: 'The Maverick',
    description: 'Broad civic engagement with an independent streak — you cover the whole Lobby and rarely just follow the crowd.',
  },
  oracle: {
    label: 'The Oracle',
    description: 'Wide-ranging and in tune with community consensus — you see what others see, across all civic domains.',
  },
  specialist: {
    label: 'The Specialist',
    description: 'Deep focus in your chosen categories, and your views tend to align with the community in those areas.',
  },
  balanced: {
    label: 'The Moderate',
    description: 'A well-rounded civic presence — engaged across issues, neither strongly contrarian nor a pure follower.',
  },
  newcomer: {
    label: 'The Newcomer',
    description: 'Still building your civic record. Cast more votes to reveal your unique perspective lens.',
  },
}

// Total civic categories (used for diversity calc)
const ALL_CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

function resolveArchetype(
  totalVotes: number,
  diversityScore: number,
  alignmentScore: number,
  contrarianScore: number,
): LensArchetype {
  if (totalVotes < 10) return 'newcomer'
  if (diversityScore < 40 && contrarianScore > 60) return 'contrarian'
  if (diversityScore > 60 && contrarianScore > 50) return 'maverick'
  if (diversityScore > 60 && alignmentScore > 60) return 'oracle'
  if (diversityScore < 40 && alignmentScore > 60) return 'specialist'
  return 'balanced'
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch user's votes with topic data
  const { data: rawVotes } = await supabase
    .from('topic_votes')
    .select('side, topics(id, statement, category, status, blue_pct, total_votes)')
    .eq('user_id', user.id)
    .limit(500)

  const votes = (rawVotes ?? [])
    .map((v) => {
      const t = Array.isArray(v.topics) ? v.topics[0] : v.topics
      if (!t) return null
      return {
        side: v.side as 'blue' | 'red',
        topicId: t.id as string,
        statement: t.statement as string,
        category: (t.category as string | null) ?? 'Other',
        status: t.status as string,
        bluePct: (t.blue_pct as number) ?? 50,
        totalVotes: (t.total_votes as number) ?? 0,
      }
    })
    .filter(Boolean) as {
      side: 'blue' | 'red'
      topicId: string
      statement: string
      category: string
      status: string
      bluePct: number
      totalVotes: number
    }[]

  if (votes.length === 0) {
    const empty: LensData = {
      totalVotes: 0,
      categoriesEngaged: 0,
      diversityScore: 0,
      alignmentScore: 0,
      contrarianScore: 0,
      echoScore: 0,
      byCategory: [],
      outlierVotes: [],
      mostDivergentCategory: null,
      mostAlignedCategory: null,
      lensArchetype: 'newcomer',
      archetypeLabel: ARCHETYPE_META.newcomer.label,
      archetypeDescription: ARCHETYPE_META.newcomer.description,
    }
    return NextResponse.json(empty)
  }

  // 2. Per-category analysis
  const catMap = new Map<string, { forCount: number; totalCount: number; communityForSum: number }>()
  for (const v of votes) {
    const bucket = catMap.get(v.category) ?? { forCount: 0, totalCount: 0, communityForSum: 0 }
    bucket.totalCount++
    if (v.side === 'blue') bucket.forCount++
    bucket.communityForSum += v.bluePct
    catMap.set(v.category, bucket)
  }

  const byCategory: CategoryLens[] = [...catMap.entries()]
    .filter(([, d]) => d.totalCount >= 1)
    .map(([cat, d]) => {
      const userForPct = Math.round((d.forCount / d.totalCount) * 100)
      const communityForPct = Math.round(d.communityForSum / d.totalCount)
      const divergence = Math.abs(userForPct - communityForPct)
      return {
        category: cat,
        userVotes: d.totalCount,
        userForPct,
        communityForPct,
        divergence,
        direction:
          divergence < 10 ? 'aligned'
          : userForPct > communityForPct ? 'more_for'
          : 'more_against',
      }
    })
    .sort((a, b) => b.userVotes - a.userVotes)

  // 3. Outlier votes — user voted against a supermajority (< 35% on their side)
  const outlierVotes: OutlierVote[] = votes
    .filter((v) => {
      const sidePct = v.side === 'blue' ? v.bluePct : 100 - v.bluePct
      return sidePct < 35 // user's side has <35% support
    })
    .sort((a, b) => {
      const gapA = Math.abs((a.side === 'blue' ? a.bluePct : 100 - a.bluePct) - 50)
      const gapB = Math.abs((b.side === 'blue' ? b.bluePct : 100 - b.bluePct) - 50)
      return gapA - gapB // most moderate outliers first (less extreme = more interesting)
    })
    .slice(0, 8)
    .map((v) => ({
      topicId: v.topicId,
      statement: v.statement,
      category: v.category,
      side: v.side,
      communityForPct: Math.round(v.bluePct),
      outlierGap: Math.abs((v.side === 'blue' ? v.bluePct : 100 - v.bluePct) - 50),
      status: v.status,
    }))

  // 4. Summary scores
  const totalVotes = votes.length
  const categoriesEngaged = catMap.size

  // Diversity: how many of the 10 canonical categories have ≥1 vote
  const canonicalCoverage = ALL_CATEGORIES.filter((c) => catMap.has(c)).length
  const diversityScore = Math.round((canonicalCoverage / ALL_CATEGORIES.length) * 100)

  // Alignment: average of (100 - divergence) across categories weighted by vote count
  let alignmentSum = 0
  let alignmentWeight = 0
  for (const c of byCategory) {
    alignmentSum += (100 - c.divergence) * c.userVotes
    alignmentWeight += c.userVotes
  }
  const alignmentScore = alignmentWeight > 0 ? Math.round(alignmentSum / alignmentWeight) : 50

  // Contrarian: % of votes where user's side has < 45% community support
  const contrarianCount = votes.filter((v) => {
    const sidePct = v.side === 'blue' ? v.bluePct : 100 - v.bluePct
    return sidePct < 45
  }).length
  const contrarianScore = Math.round((contrarianCount / totalVotes) * 100)
  const echoScore = 100 - contrarianScore

  // Most/least divergent categories (min 3 votes)
  const rankedByDivergence = byCategory.filter((c) => c.userVotes >= 3).sort((a, b) => b.divergence - a.divergence)
  const mostDivergentCategory = rankedByDivergence.length > 0 ? rankedByDivergence[0].category : null
  const mostAlignedCategory = rankedByDivergence.length > 1 ? rankedByDivergence[rankedByDivergence.length - 1].category : null

  // 5. Archetype
  const lensArchetype = resolveArchetype(totalVotes, diversityScore, alignmentScore, contrarianScore)
  const { label: archetypeLabel, description: archetypeDescription } = ARCHETYPE_META[lensArchetype]

  const result: LensData = {
    totalVotes,
    categoriesEngaged,
    diversityScore,
    alignmentScore,
    contrarianScore,
    echoScore,
    byCategory,
    outlierVotes,
    mostDivergentCategory,
    mostAlignedCategory,
    lensArchetype,
    archetypeLabel,
    archetypeDescription,
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=240' },
  })
}
