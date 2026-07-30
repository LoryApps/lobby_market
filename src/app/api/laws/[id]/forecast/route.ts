import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type StabilityTier = 'bedrock' | 'stable' | 'contested' | 'fragile'
export type RiskLevel = 'low' | 'moderate' | 'elevated' | 'critical'

export interface ForecastSignal {
  label: string
  value: string | number
  direction: 'positive' | 'negative' | 'neutral'
  description: string
}

export interface LawForecastData {
  law: {
    id: string
    statement: string
    category: string | null
    is_active: boolean
    total_votes: number | null
    blue_pct: number | null
    established_at: string | null
  }

  stability_score: number        // 0–100
  stability_tier: StabilityTier

  repeal_risk: RiskLevel
  repeal_risk_score: number      // 0–100 (higher = more risk)

  amendment_pressure: RiskLevel
  amendment_pressure_score: number // 0–100

  // Raw counts
  amendment_pending: number
  amendment_ratified: number
  amendment_rejected: number
  challenge_open: number
  challenge_upheld: number
  challenge_dismissed: number
  review_count: number
  review_avg: number | null
  review_stars_1: number
  review_stars_2: number
  review_stars_3: number
  review_stars_4: number
  review_stars_5: number

  // Age in days
  law_age_days: number

  // Signals
  signals: ForecastSignal[]

  // Forecast headline
  headline: string
  summary: string
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function riskLevel(score: number): RiskLevel {
  if (score <= 20) return 'low'
  if (score <= 45) return 'moderate'
  if (score <= 70) return 'elevated'
  return 'critical'
}

function stabilityTier(score: number): StabilityTier {
  if (score >= 80) return 'bedrock'
  if (score >= 55) return 'stable'
  if (score >= 30) return 'contested'
  return 'fragile'
}

function headline(tier: StabilityTier, repeal: RiskLevel, amendment: RiskLevel): string {
  if (tier === 'bedrock') return 'Solidly established — community fully behind this law'
  if (tier === 'stable' && repeal === 'low') return 'Stable and uncontested — minor refinement possible'
  if (tier === 'stable') return 'Stable but under watch — amendment pressure building'
  if (tier === 'contested' && repeal === 'elevated') return 'Under fire — significant repeal challenge in progress'
  if (tier === 'contested') return 'Mixed reception — community divided on this law\'s value'
  if (amendment === 'critical') return 'Major reforms incoming — multiple amendments proposed'
  return 'Fragile standing — community challenges threaten this law'
}

function summary(
  tier: StabilityTier,
  pending: number,
  open: number,
  avgStars: number | null,
  ageDays: number,
): string {
  const parts: string[] = []

  if (tier === 'bedrock') {
    parts.push('This law enjoys strong community support and has settled into the legal landscape.')
  } else if (tier === 'stable') {
    parts.push('This law is broadly accepted with limited friction.')
  } else if (tier === 'contested') {
    parts.push('Community sentiment is split — supporters and critics remain active.')
  } else {
    parts.push('This law faces significant opposition and may be overturned or heavily amended.')
  }

  if (open > 0) parts.push(`${open} open challenge${open !== 1 ? 's' : ''} currently filed.`)
  if (pending > 0) parts.push(`${pending} amendment proposal${pending !== 1 ? 's' : ''} awaiting ratification.`)
  if (avgStars !== null) {
    parts.push(`Community rates it ${avgStars.toFixed(1)}/5 stars on average.`)
  }
  if (ageDays < 30) parts.push('Still early — community assessment is ongoing.')
  else if (ageDays > 365) parts.push('A mature law with a long track record.')

  return parts.join(' ')
}

// ─── GET /api/laws/[id]/forecast ──────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const supabase = await createClient()

  // ── Law info ──────────────────────────────────────────────────────────────
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, statement, category, is_active, total_votes, blue_pct, established_at')
    .eq('id', id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // ── Amendments ────────────────────────────────────────────────────────────
  const { data: amendments } = await supabase
    .from('law_amendments')
    .select('status')
    .eq('law_id', id)

  const amendmentCounts = (amendments ?? []).reduce(
    (acc, a) => {
      if (a.status === 'pending') acc.pending++
      else if (a.status === 'ratified') acc.ratified++
      else if (a.status === 'rejected') acc.rejected++
      return acc
    },
    { pending: 0, ratified: 0, rejected: 0 },
  )

  // ── Challenges ────────────────────────────────────────────────────────────
  const { data: challenges } = await supabase
    .from('law_challenges')
    .select('status')
    .eq('law_id', id)

  const challengeCounts = (challenges ?? []).reduce(
    (acc, c) => {
      if (c.status === 'open') acc.open++
      else if (c.status === 'upheld') acc.upheld++
      else if (c.status === 'dismissed') acc.dismissed++
      return acc
    },
    { open: 0, upheld: 0, dismissed: 0 },
  )

  // ── Reviews ───────────────────────────────────────────────────────────────
  const { data: reviews } = await supabase
    .from('law_reviews')
    .select('stars')
    .eq('law_id', id)

  const reviewStars = [0, 0, 0, 0, 0] // index 0 = 1 star
  let starSum = 0
  for (const r of reviews ?? []) {
    const idx = Math.min(Math.max(r.stars - 1, 0), 4)
    reviewStars[idx]++
    starSum += r.stars
  }
  const reviewCount = (reviews ?? []).length
  const reviewAvg = reviewCount > 0 ? starSum / reviewCount : null

  // ── Law age ───────────────────────────────────────────────────────────────
  const ageDays = law.established_at
    ? Math.floor((Date.now() - new Date(law.established_at).getTime()) / 86_400_000)
    : 0

  // ── Compute scores ────────────────────────────────────────────────────────
  //
  // Repeal risk: driven by open challenges, upheld challenges, low star ratings
  // Each open challenge adds 8 pts; upheld = 20 pts; avg stars < 2.5 adds up to 25 pts
  let repealScore = 0
  repealScore += Math.min(challengeCounts.open * 8, 40)
  repealScore += Math.min(challengeCounts.upheld * 20, 40)
  if (reviewAvg !== null) {
    if (reviewAvg < 2) repealScore += 25
    else if (reviewAvg < 3) repealScore += 12
    else if (reviewAvg < 3.5) repealScore += 5
  }
  repealScore = Math.min(repealScore, 100)

  // Amendment pressure: driven by pending amendments
  let amendmentScore = 0
  amendmentScore += Math.min(amendmentCounts.pending * 15, 60)
  amendmentScore += Math.min(amendmentCounts.ratified * 5, 20) // ratified = ongoing change culture
  if (reviewAvg !== null && reviewAvg < 3) amendmentScore += 15 // unhappy community
  amendmentScore = Math.min(amendmentScore, 100)

  // Stability score (inverse of combined risk)
  // Start at 100, subtract for risks, add for maturity and positive signals
  let stabilityScore = 100
  stabilityScore -= repealScore * 0.5
  stabilityScore -= amendmentScore * 0.3
  if (challengeCounts.dismissed > 0) stabilityScore += Math.min(challengeCounts.dismissed * 3, 10)
  if (amendmentCounts.rejected > 0) stabilityScore += Math.min(amendmentCounts.rejected * 2, 8)
  if (reviewAvg !== null && reviewAvg >= 4) stabilityScore += 10
  if (ageDays > 180) stabilityScore += 5  // settled law bonus
  if (ageDays > 365) stabilityScore += 5
  stabilityScore = Math.min(100, Math.max(0, Math.round(stabilityScore)))

  // ── Build signals ─────────────────────────────────────────────────────────
  const signals: ForecastSignal[] = []

  // Review sentiment
  if (reviewCount === 0) {
    signals.push({
      label: 'Community Rating',
      value: 'No reviews yet',
      direction: 'neutral',
      description: 'Be the first to rate this law',
    })
  } else {
    signals.push({
      label: 'Community Rating',
      value: `${reviewAvg!.toFixed(1)} / 5 (${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'})`,
      direction: reviewAvg! >= 3.5 ? 'positive' : reviewAvg! >= 2.5 ? 'neutral' : 'negative',
      description:
        reviewAvg! >= 4
          ? 'Strong community approval'
          : reviewAvg! >= 3
          ? 'Mixed but leaning positive'
          : 'Community dissatisfied with this law',
    })
  }

  // Amendment activity
  if (amendmentCounts.pending === 0 && amendmentCounts.ratified === 0) {
    signals.push({
      label: 'Amendment Activity',
      value: 'None proposed',
      direction: 'positive',
      description: 'No community demand for changes',
    })
  } else {
    signals.push({
      label: 'Amendment Activity',
      value: `${amendmentCounts.pending} pending · ${amendmentCounts.ratified} ratified`,
      direction: amendmentCounts.pending > 2 ? 'negative' : 'neutral',
      description:
        amendmentCounts.pending > 2
          ? 'Multiple reforms being proposed — law is evolving'
          : amendmentCounts.ratified > 0
          ? 'Law has been refined through community amendments'
          : 'Community is proposing refinements',
    })
  }

  // Challenge status
  if (challengeCounts.open === 0 && challengeCounts.upheld === 0) {
    signals.push({
      label: 'Legal Challenges',
      value: challengeCounts.dismissed > 0 ? `${challengeCounts.dismissed} dismissed` : 'None filed',
      direction: 'positive',
      description:
        challengeCounts.dismissed > 0
          ? 'Previous challenges dismissed — law held firm'
          : 'No formal challenges have been filed',
    })
  } else {
    signals.push({
      label: 'Legal Challenges',
      value: `${challengeCounts.open} open · ${challengeCounts.upheld} upheld`,
      direction: challengeCounts.upheld > 0 ? 'negative' : 'neutral',
      description:
        challengeCounts.upheld > 0
          ? 'Upheld challenges indicate serious constitutional or ethical concerns'
          : 'Active challenges are under review',
    })
  }

  // Mandate strength (original vote)
  const forPct = Math.round(law.blue_pct ?? 50)
  signals.push({
    label: 'Original Mandate',
    value: `${forPct}% FOR across ${(law.total_votes ?? 0).toLocaleString()} votes`,
    direction: forPct >= 60 ? 'positive' : forPct >= 50 ? 'neutral' : 'negative',
    description:
      forPct >= 70
        ? 'Strong democratic mandate — this law passed with a supermajority'
        : forPct >= 60
        ? 'Solid mandate — clear majority support at passage'
        : forPct >= 50
        ? 'Narrow mandate — passed by a slim majority'
        : 'Weak mandate — originally passed with minority support',
  })

  // Age signal
  signals.push({
    label: 'Law Maturity',
    value: ageDays < 30 ? 'New law' : ageDays < 365 ? `${Math.floor(ageDays / 30)} months old` : `${Math.floor(ageDays / 365)} year${Math.floor(ageDays / 365) !== 1 ? 's' : ''} old`,
    direction: ageDays > 180 ? 'positive' : 'neutral',
    description:
      ageDays < 30
        ? 'Recently established — community assessment still forming'
        : ageDays < 180
        ? 'Settling in — community opinion maturing'
        : 'Established law — has weathered initial scrutiny',
  })

  // ── Assemble response ─────────────────────────────────────────────────────
  const tier = stabilityTier(stabilityScore)
  const repealRisk = riskLevel(repealScore)
  const amendRisk = riskLevel(amendmentScore)

  const result: LawForecastData = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      is_active: law.is_active,
      total_votes: law.total_votes,
      blue_pct: law.blue_pct,
      established_at: law.established_at,
    },
    stability_score: stabilityScore,
    stability_tier: tier,
    repeal_risk: repealRisk,
    repeal_risk_score: repealScore,
    amendment_pressure: amendRisk,
    amendment_pressure_score: amendmentScore,
    amendment_pending: amendmentCounts.pending,
    amendment_ratified: amendmentCounts.ratified,
    amendment_rejected: amendmentCounts.rejected,
    challenge_open: challengeCounts.open,
    challenge_upheld: challengeCounts.upheld,
    challenge_dismissed: challengeCounts.dismissed,
    review_count: reviewCount,
    review_avg: reviewAvg,
    review_stars_1: reviewStars[0],
    review_stars_2: reviewStars[1],
    review_stars_3: reviewStars[2],
    review_stars_4: reviewStars[3],
    review_stars_5: reviewStars[4],
    law_age_days: ageDays,
    signals,
    headline: headline(tier, repealRisk, amendRisk),
    summary: summary(tier, amendmentCounts.pending, challengeCounts.open, reviewAvg, ageDays),
  }

  return NextResponse.json(result)
}
