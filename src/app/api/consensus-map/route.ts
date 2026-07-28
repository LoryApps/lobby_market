import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ConsensusPoint {
  topic_id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  for_pct: number
  /** How "divisive" — 0=total consensus, 100=perfect split */
  division_score: number
  /** consensus band: strong_for, lean_for, contested, lean_against, strong_against */
  band: 'strong_for' | 'lean_for' | 'contested' | 'lean_against' | 'strong_against'
}

export interface CategorySummary {
  category: string
  avg_for_pct: number
  avg_division: number
  topic_count: number
  most_unified_topic: string | null
  most_divided_topic: string | null
}

export interface ConsensusMapResponse {
  overview: {
    total_topics: number
    avg_for_pct: number
    most_unified_pct: number
    most_divided_pct: number
    strong_for: number
    lean_for: number
    contested: number
    lean_against: number
    strong_against: number
  }
  categories: CategorySummary[]
  unified: ConsensusPoint[]
  divided: ConsensusPoint[]
  trending_toward_law: ConsensusPoint[]
}

function divisionScore(forPct: number): number {
  return Math.round(100 - Math.abs(50 - forPct) * 2)
}

function band(forPct: number): ConsensusPoint['band'] {
  if (forPct >= 80) return 'strong_for'
  if (forPct >= 60) return 'lean_for'
  if (forPct >= 40) return 'contested'
  if (forPct >= 20) return 'lean_against'
  return 'strong_against'
}

export async function GET() {
  const supabase = await createClient()

  // Fetch active + voting + law topics with vote counts (min 10 votes for statistical significance)
  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status, total_votes, blue_pct')
    .in('status', ['active', 'voting', 'law'])
    .gte('total_votes', 10)
    .order('total_votes', { ascending: false })
    .limit(500)

  if (!topics || topics.length === 0) {
    return NextResponse.json({
      overview: {
        total_topics: 0,
        avg_for_pct: 50,
        most_unified_pct: 50,
        most_divided_pct: 50,
        strong_for: 0,
        lean_for: 0,
        contested: 0,
        lean_against: 0,
        strong_against: 0,
      },
      categories: [],
      unified: [],
      divided: [],
      trending_toward_law: [],
    } satisfies ConsensusMapResponse)
  }

  const points: ConsensusPoint[] = topics.map((t) => {
    const forPct = Math.round(t.blue_pct ?? 50)
    return {
      topic_id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      total_votes: t.total_votes ?? 0,
      for_pct: forPct,
      division_score: divisionScore(forPct),
      band: band(forPct),
    }
  })

  // Overview stats
  const avgForPct = Math.round(points.reduce((s, p) => s + p.for_pct, 0) / points.length)
  const bandCounts = points.reduce(
    (acc, p) => {
      acc[p.band] = (acc[p.band] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Most unified (lowest division score = strongest consensus)
  const sortedByUnity = [...points].sort((a, b) => a.division_score - b.division_score)
  const mostUnifiedPct = sortedByUnity[0]?.for_pct ?? 50
  // Most divided (highest division score)
  const sortedByDivision = [...points].sort((a, b) => b.division_score - a.division_score)
  const mostDividedPct = sortedByDivision[0]?.for_pct ?? 50

  // Category summaries
  const catGroups: Record<string, ConsensusPoint[]> = {}
  for (const p of points) {
    const cat = p.category ?? 'Other'
    if (!catGroups[cat]) catGroups[cat] = []
    catGroups[cat].push(p)
  }

  const categories: CategorySummary[] = Object.entries(catGroups)
    .map(([category, pts]) => {
      const avgFor = Math.round(pts.reduce((s, p) => s + p.for_pct, 0) / pts.length)
      const avgDiv = Math.round(pts.reduce((s, p) => s + p.division_score, 0) / pts.length)
      const sorted = [...pts].sort((a, b) => a.division_score - b.division_score)
      return {
        category,
        avg_for_pct: avgFor,
        avg_division: avgDiv,
        topic_count: pts.length,
        most_unified_topic: sorted[0]?.statement ?? null,
        most_divided_topic: sorted[sorted.length - 1]?.statement ?? null,
      }
    })
    .sort((a, b) => b.topic_count - a.topic_count)
    .slice(0, 10)

  // Top unified topics (most one-sided)
  const unified = sortedByUnity.slice(0, 10)

  // Top divided topics (closest to 50/50)
  const divided = sortedByDivision.slice(0, 10)

  // Topics trending toward law (for_pct >= 70, voting status)
  const trendingTowardLaw = points
    .filter((p) => p.for_pct >= 70 && p.status === 'voting')
    .sort((a, b) => b.for_pct - a.for_pct)
    .slice(0, 5)

  return NextResponse.json({
    overview: {
      total_topics: points.length,
      avg_for_pct: avgForPct,
      most_unified_pct: mostUnifiedPct,
      most_divided_pct: mostDividedPct,
      strong_for: bandCounts.strong_for ?? 0,
      lean_for: bandCounts.lean_for ?? 0,
      contested: bandCounts.contested ?? 0,
      lean_against: bandCounts.lean_against ?? 0,
      strong_against: bandCounts.strong_against ?? 0,
    },
    categories,
    unified,
    divided,
    trending_toward_law: trendingTowardLaw,
  } satisfies ConsensusMapResponse)
}
