import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RiskLevel = 'critical' | 'high' | 'moderate' | 'low'

export interface LawAtRisk {
  id: string
  statement: string
  full_statement: string | null
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string

  // Challenge data
  open_challenges: number
  upheld_challenges: number
  total_challenge_support: number
  total_challenge_oppose: number
  latest_challenge_at: string | null

  // Review data
  avg_stars: number | null
  review_count: number

  // Endorsement data
  endorsement_count: number

  // Derived risk score (0–100) and tier
  risk_score: number
  risk_level: RiskLevel
  risk_factors: string[]
}

export interface LawsAtRiskResponse {
  laws: LawAtRisk[]
  summary: {
    critical: number
    high: number
    moderate: number
    total_assessed: number
  }
  category_filter: string | null
}

// ─── Risk scoring ─────────────────────────────────────────────────────────────

function computeRisk(params: {
  open_challenges: number
  upheld_challenges: number
  total_challenge_support: number
  total_challenge_oppose: number
  avg_stars: number | null
  review_count: number
  endorsement_count: number
  total_votes: number | null
  days_since_established: number
}): { score: number; level: RiskLevel; factors: string[] } {
  const {
    open_challenges,
    upheld_challenges,
    total_challenge_support,
    total_challenge_oppose,
    avg_stars,
    review_count,
    endorsement_count,
    total_votes,
    days_since_established,
  } = params

  let score = 0
  const factors: string[] = []

  // Open challenges contribute most to risk (up to 40 pts)
  if (open_challenges >= 5) {
    score += 40
    factors.push(`${open_challenges} open challenges`)
  } else if (open_challenges >= 3) {
    score += 28
    factors.push(`${open_challenges} open challenges`)
  } else if (open_challenges >= 1) {
    score += 15
    factors.push(`${open_challenges} open challenge${open_challenges > 1 ? 's' : ''}`)
  }

  // Upheld challenges are serious (up to 25 pts)
  if (upheld_challenges >= 2) {
    score += 25
    factors.push(`${upheld_challenges} upheld challenges`)
  } else if (upheld_challenges === 1) {
    score += 15
    factors.push('1 upheld challenge')
  }

  // Challenge support rate — majority support = high risk (up to 20 pts)
  const totalVotes = total_challenge_support + total_challenge_oppose
  if (totalVotes > 0) {
    const supportRate = total_challenge_support / totalVotes
    if (supportRate >= 0.7 && totalVotes >= 5) {
      score += 20
      factors.push(`${Math.round(supportRate * 100)}% challenge support rate`)
    } else if (supportRate >= 0.5 && totalVotes >= 3) {
      score += 10
      factors.push(`${Math.round(supportRate * 100)}% challenge support rate`)
    }
  }

  // Low review stars — average below 3 is concerning (up to 15 pts)
  if (avg_stars !== null && review_count >= 3) {
    if (avg_stars < 2.5) {
      score += 15
      factors.push(`${avg_stars.toFixed(1)}★ avg rating`)
    } else if (avg_stars < 3.5) {
      score += 8
      factors.push(`${avg_stars.toFixed(1)}★ avg rating`)
    }
  }

  // Low endorsement relative to total votes (not enough active support)
  const voteBase = total_votes ?? 0
  if (voteBase > 0) {
    const endorsementRate = endorsement_count / voteBase
    if (endorsementRate < 0.01 && days_since_established > 30) {
      score += 5
      factors.push('low endorsement rate')
    }
  }

  // Clamp to 0–100
  score = Math.min(100, Math.max(0, score))

  let level: RiskLevel
  if (score >= 70) level = 'critical'
  else if (score >= 45) level = 'high'
  else if (score >= 20) level = 'moderate'
  else level = 'low'

  return { score, level, factors }
}

// ─── GET /api/laws/at-risk ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const url = req.nextUrl
  const categoryParam = url.searchParams.get('category')
  const levelParam = url.searchParams.get('level') as RiskLevel | null
  const limitParam = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100)

  // ── 1. Fetch all active laws ────────────────────────────────────────────────
  let lawsQuery = db
    .from('laws')
    .select('id, statement, full_statement, category, blue_pct, total_votes, established_at')
    .eq('is_active', true)
    .order('established_at', { ascending: false })
    .limit(200)

  if (categoryParam) {
    lawsQuery = lawsQuery.eq('category', categoryParam)
  }

  const { data: rawLaws } = await lawsQuery
  const laws = (rawLaws ?? []) as Array<{
    id: string
    statement: string
    full_statement: string | null
    category: string | null
    blue_pct: number | null
    total_votes: number | null
    established_at: string
  }>

  if (laws.length === 0) {
    return NextResponse.json({
      laws: [],
      summary: { critical: 0, high: 0, moderate: 0, total_assessed: 0 },
      category_filter: categoryParam,
    } satisfies LawsAtRiskResponse)
  }

  const lawIds = laws.map((l) => l.id)

  // ── 2. Batch fetch challenge aggregates ────────────────────────────────────
  const { data: challengeRows } = await db
    .from('law_challenges')
    .select('law_id, status, support_count, oppose_count, created_at')
    .in('law_id', lawIds)

  type ChallengeRow = {
    law_id: string
    status: string
    support_count: number
    oppose_count: number
    created_at: string
  }

  const challengeMap: Record<
    string,
    {
      open: number
      upheld: number
      totalSupport: number
      totalOppose: number
      latest: string | null
    }
  > = {}

  for (const c of (challengeRows ?? []) as ChallengeRow[]) {
    if (!challengeMap[c.law_id]) {
      challengeMap[c.law_id] = { open: 0, upheld: 0, totalSupport: 0, totalOppose: 0, latest: null }
    }
    const m = challengeMap[c.law_id]
    if (c.status === 'open') m.open++
    else if (c.status === 'upheld') m.upheld++
    m.totalSupport += c.support_count ?? 0
    m.totalOppose += c.oppose_count ?? 0
    if (!m.latest || c.created_at > m.latest) m.latest = c.created_at
  }

  // ── 3. Batch fetch review aggregates ─────────────────────────────────────
  const { data: reviewRows } = await db
    .from('law_reviews')
    .select('law_id, stars')
    .in('law_id', lawIds)

  type ReviewRow = { law_id: string; stars: number }

  const reviewMap: Record<string, { sum: number; count: number }> = {}
  for (const r of (reviewRows ?? []) as ReviewRow[]) {
    if (!reviewMap[r.law_id]) reviewMap[r.law_id] = { sum: 0, count: 0 }
    reviewMap[r.law_id].sum += r.stars
    reviewMap[r.law_id].count++
  }

  // ── 4. Batch fetch endorsement counts ─────────────────────────────────────
  const { data: endorseRows } = await db
    .from('law_endorsements')
    .select('law_id')
    .in('law_id', lawIds)

  type EndorseRow = { law_id: string }

  const endorseMap: Record<string, number> = {}
  for (const e of (endorseRows ?? []) as EndorseRow[]) {
    endorseMap[e.law_id] = (endorseMap[e.law_id] ?? 0) + 1
  }

  // ── 5. Compute risk for each law ──────────────────────────────────────────
  const now = Date.now()
  const scored: LawAtRisk[] = []

  for (const law of laws) {
    const ch = challengeMap[law.id] ?? { open: 0, upheld: 0, totalSupport: 0, totalOppose: 0, latest: null }
    const rv = reviewMap[law.id] ?? { sum: 0, count: 0 }
    const avgStars = rv.count >= 1 ? rv.sum / rv.count : null
    const endorsements = endorseMap[law.id] ?? 0
    const daysSince = Math.floor((now - new Date(law.established_at).getTime()) / 86_400_000)

    const { score, level, factors } = computeRisk({
      open_challenges: ch.open,
      upheld_challenges: ch.upheld,
      total_challenge_support: ch.totalSupport,
      total_challenge_oppose: ch.totalOppose,
      avg_stars: avgStars,
      review_count: rv.count,
      endorsement_count: endorsements,
      total_votes: law.total_votes,
      days_since_established: daysSince,
    })

    // Only include laws with at least some risk signal OR any challenge activity
    if (score < 15 && ch.open === 0 && ch.upheld === 0) continue

    scored.push({
      id: law.id,
      statement: law.statement,
      full_statement: law.full_statement,
      category: law.category,
      blue_pct: law.blue_pct,
      total_votes: law.total_votes,
      established_at: law.established_at,

      open_challenges: ch.open,
      upheld_challenges: ch.upheld,
      total_challenge_support: ch.totalSupport,
      total_challenge_oppose: ch.totalOppose,
      latest_challenge_at: ch.latest,

      avg_stars: avgStars !== null ? Math.round(avgStars * 10) / 10 : null,
      review_count: rv.count,
      endorsement_count: endorsements,

      risk_score: score,
      risk_level: level,
      risk_factors: factors,
    })
  }

  // Sort by risk score descending
  scored.sort((a, b) => b.risk_score - a.risk_score)

  // Apply level filter if provided
  const filtered = levelParam ? scored.filter((l) => l.risk_level === levelParam) : scored

  const result = filtered.slice(0, limitParam)

  const summary = {
    critical: scored.filter((l) => l.risk_level === 'critical').length,
    high: scored.filter((l) => l.risk_level === 'high').length,
    moderate: scored.filter((l) => l.risk_level === 'moderate').length,
    total_assessed: scored.length,
  }

  return NextResponse.json({
    laws: result,
    summary,
    category_filter: categoryParam,
  } satisfies LawsAtRiskResponse)
}
