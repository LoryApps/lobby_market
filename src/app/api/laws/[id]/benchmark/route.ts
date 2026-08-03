import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BenchmarkLaw {
  id: string
  statement: string
  blue_pct: number
  total_votes: number
  established_at: string | null
  mandateStrength: number
  consensusScore: number
}

export interface LawBenchmarkData {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string | null
    mandateStrength: number
    consensusScore: number
  }
  percentiles: {
    votes: number
    mandate: number
    consensus: number
    overall: number
  }
  tier: 'Landmark' | 'Strong' | 'Clear' | 'Slim' | 'Contested'
  rank: number
  totalInCategory: number
  categoryStats: {
    total: number
    avgVotes: number
    medianVotes: number
    avgMandate: number
    avgBlue: number
    topLaws: BenchmarkLaw[]
    similarLaws: BenchmarkLaw[]
  }
  insights: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mandateStrength(bluePct: number): number {
  return Math.round(Math.abs(bluePct - 50) * 2)
}

function consensusScore(bluePct: number, totalVotes: number, maxVotes: number): number {
  const mandate = Math.abs(bluePct - 50) / 50
  const participation = maxVotes > 0 ? Math.min(totalVotes / maxVotes, 1) : 0
  return Math.round((mandate * 0.6 + participation * 0.4) * 100)
}

function percentileOf(value: number, values: number[]): number {
  if (values.length === 0) return 50
  const below = values.filter((v) => v < value).length
  return Math.round((below / values.length) * 100)
}

function tierLabel(mandate: number): LawBenchmarkData['tier'] {
  if (mandate >= 80) return 'Landmark'
  if (mandate >= 60) return 'Strong'
  if (mandate >= 40) return 'Clear'
  if (mandate >= 20) return 'Slim'
  return 'Contested'
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

function generateInsights(
  law: { blue_pct: number; total_votes: number; mandateStrength: number },
  percentiles: LawBenchmarkData['percentiles'],
  categoryStats: LawBenchmarkData['categoryStats'],
  rank: number,
  total: number
): string[] {
  const insights: string[] = []
  const forSide = law.blue_pct >= 50

  if (rank === 1) {
    insights.push('This is the strongest consensus law in its category.')
  } else if (rank <= 3) {
    insights.push(`Ranks in the top 3 for mandate strength in its category (${rank} of ${total}).`)
  }

  if (percentiles.votes >= 90) {
    insights.push(
      `Exceptional voter turnout — more votes than ${percentiles.votes}% of laws in this category.`
    )
  } else if (percentiles.votes >= 70) {
    insights.push(
      `Above-average participation with ${law.total_votes.toLocaleString()} votes cast.`
    )
  } else if (percentiles.votes <= 30) {
    insights.push(
      `Relatively low participation — only ${law.total_votes.toLocaleString()} votes, below most category peers.`
    )
  }

  if (law.mandateStrength >= 80) {
    insights.push(
      `Near-unanimous ${forSide ? 'FOR' : 'AGAINST'} consensus with ${Math.round(law.blue_pct)}% support.`
    )
  } else if (law.mandateStrength <= 10) {
    insights.push(
      `Passed on a razor-thin margin — one of the most contested laws in its category.`
    )
  }

  if (percentiles.overall >= 80) {
    insights.push('Overall, this ranks among the highest-quality laws by civic mandate.')
  } else if (percentiles.overall <= 20) {
    insights.push('This law has a weaker democratic mandate than most of its peers.')
  }

  if (law.total_votes > categoryStats.avgVotes * 2) {
    insights.push(
      `Generated more than double the average voter engagement for this category (avg: ${Math.round(categoryStats.avgVotes).toLocaleString()}).`
    )
  }

  return insights
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // 1. Fetch the target law
    const { data: law, error } = await supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at')
      .eq('id', params.id)
      .eq('is_active', true)
      .single()

    if (error || !law) {
      return NextResponse.json({ error: 'Law not found' }, { status: 404 })
    }

    // 2. Fetch all laws in the same category (or all laws if no category)
    let query = supabase
      .from('laws')
      .select('id, statement, blue_pct, total_votes, established_at')
      .eq('is_active', true)
      .order('total_votes', { ascending: false })

    if (law.category) {
      query = query.eq('category', law.category)
    }

    const { data: allLaws } = await query.limit(500)
    const peers = (allLaws ?? []).filter((l) => l.id !== law.id)
    const all = [...peers, law]

    const maxVotes = Math.max(...all.map((l) => l.total_votes ?? 0), 1)

    // 3. Compute metrics for all laws
    const enriched = all.map((l) => ({
      ...l,
      mandateStrength: mandateStrength(l.blue_pct ?? 50),
      consensusScore: consensusScore(l.blue_pct ?? 50, l.total_votes ?? 0, maxVotes),
    }))

    const thisMandateStrength = mandateStrength(law.blue_pct ?? 50)
    const thisConsensusScore = consensusScore(law.blue_pct ?? 50, law.total_votes ?? 0, maxVotes)

    const allVotes = enriched.map((l) => l.total_votes ?? 0)
    const allMandates = enriched.map((l) => l.mandateStrength)
    const allConsensus = enriched.map((l) => l.consensusScore)

    const votesPct = percentileOf(law.total_votes ?? 0, allVotes)
    const mandatePct = percentileOf(thisMandateStrength, allMandates)
    const consensusPct = percentileOf(thisConsensusScore, allConsensus)
    const overallPct = Math.round((votesPct + mandatePct * 2 + consensusPct) / 4)

    // 4. Rank by mandate strength
    const sortedByMandate = [...enriched].sort((a, b) => b.mandateStrength - a.mandateStrength)
    const rank = sortedByMandate.findIndex((l) => l.id === law.id) + 1

    // 5. Category stats
    const avgVotes = all.reduce((s, l) => s + (l.total_votes ?? 0), 0) / all.length
    const avgMandate = allMandates.reduce((s, v) => s + v, 0) / allMandates.length
    const avgBlue = all.reduce((s, l) => s + (l.blue_pct ?? 50), 0) / all.length

    // Top 5 laws by mandate (excluding this law)
    const topLaws: BenchmarkLaw[] = sortedByMandate
      .filter((l) => l.id !== law.id)
      .slice(0, 5)
      .map(({ id, statement, blue_pct, total_votes, established_at, mandateStrength, consensusScore }) => ({
        id,
        statement,
        blue_pct: blue_pct ?? 50,
        total_votes: total_votes ?? 0,
        established_at,
        mandateStrength,
        consensusScore,
      }))

    // Similar laws: closest mandate strength to this law (excluding this law)
    const similarLaws: BenchmarkLaw[] = [...enriched]
      .filter((l) => l.id !== law.id)
      .sort((a, b) => Math.abs(a.mandateStrength - thisMandateStrength) - Math.abs(b.mandateStrength - thisMandateStrength))
      .slice(0, 5)
      .map(({ id, statement, blue_pct, total_votes, established_at, mandateStrength, consensusScore }) => ({
        id,
        statement,
        blue_pct: blue_pct ?? 50,
        total_votes: total_votes ?? 0,
        established_at,
        mandateStrength,
        consensusScore,
      }))

    const percentiles = {
      votes: votesPct,
      mandate: mandatePct,
      consensus: consensusPct,
      overall: overallPct,
    }

    const categoryStats = {
      total: all.length,
      avgVotes: Math.round(avgVotes),
      medianVotes: median(allVotes),
      avgMandate: Math.round(avgMandate),
      avgBlue: Math.round(avgBlue),
      topLaws,
      similarLaws,
    }

    const insights = generateInsights(
      { blue_pct: law.blue_pct ?? 50, total_votes: law.total_votes ?? 0, mandateStrength: thisMandateStrength },
      percentiles,
      categoryStats,
      rank,
      all.length
    )

    const response: LawBenchmarkData = {
      law: {
        id: law.id,
        statement: law.statement,
        category: law.category ?? null,
        blue_pct: law.blue_pct ?? 50,
        total_votes: law.total_votes ?? 0,
        established_at: law.established_at ?? null,
        mandateStrength: thisMandateStrength,
        consensusScore: thisConsensusScore,
      },
      percentiles,
      tier: tierLabel(thisMandateStrength),
      rank,
      totalInCategory: all.length,
      categoryStats,
      insights,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[law/benchmark]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
