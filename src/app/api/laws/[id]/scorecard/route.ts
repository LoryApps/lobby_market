import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LetterGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F'

export interface LawScorecardDimension {
  key: string
  label: string
  grade: LetterGrade
  score: number        // 0–100
  description: string
  detail: string
  href: string
}

export interface LawScorecardResponse {
  law_id: string
  statement: string
  category: string | null
  established_at: string
  overall_grade: LetterGrade
  overall_score: number
  dimensions: LawScorecardDimension[]
  summary: string
  generated_at: string
}

// ─── Grade helpers ────────────────────────────────────────────────────────────

function scoreToGrade(score: number): LetterGrade {
  if (score >= 97) return 'A+'
  if (score >= 93) return 'A'
  if (score >= 90) return 'A-'
  if (score >= 87) return 'B+'
  if (score >= 83) return 'B'
  if (score >= 80) return 'B-'
  if (score >= 77) return 'C+'
  if (score >= 73) return 'C'
  if (score >= 70) return 'C-'
  if (score >= 60) return 'D'
  return 'F'
}

// ─── Dimension calculators ────────────────────────────────────────────────────

/** Legitimacy — broad participation + decisive majority at establishment */
function calcLegitimacy(totalVotes: number, bluePct: number): number {
  // Vote count: log scale, 500 = 50 points, 5000 = max 50
  const voteScore = Math.min(50, (Math.log1p(totalVotes) / Math.log1p(5000)) * 50)
  // Decisiveness: 50/50 = 0, 70%+ one way = full points (max 50)
  const deviation = Math.abs(bluePct - 50)
  const decisiveScore = Math.min(50, deviation * 2)
  return Math.round(voteScore + decisiveScore)
}

/**
 * Community Verdict — retrospective verdict votes.
 * succeeded/mostly_succeeded → high score, mixed → 50, failed → low.
 */
function calcCommunityVerdict(
  succeedCount: number,
  mixedCount: number,
  failedCount: number
): number {
  const total = succeedCount + mixedCount + failedCount
  if (total === 0) return 55 // no data yet — neutral
  const weighted =
    succeedCount * 100 +
    mixedCount   * 50  +
    failedCount  * 10
  return Math.round(weighted / total)
}

/** Resilience — challenges dismissed vs upheld; no challenges = good baseline */
function calcResilience(
  totalChallenges: number,
  dismissedCount: number,
  upheldCount: number
): number {
  if (totalChallenges === 0) return 80 // no challenges = stable baseline
  const openCount = totalChallenges - dismissedCount - upheldCount
  // Dismissed → good, upheld → bad, open → neutral
  const score =
    (dismissedCount * 100 + openCount * 60 + upheldCount * 0) / totalChallenges
  // Penalise slightly for being challenged at all
  return Math.round(score * 0.92)
}

/** Amendment Stability — fewer ratified amendments = stable; lots = unstable */
function calcAmendmentStability(
  totalAmendments: number,
  ratifiedCount: number
): number {
  // 0 amendments = 90 (nobody felt the need to change it)
  // Each ratified amendment reduces score (law kept needing fixes)
  const base = 90
  const ratiPenalty = ratifiedCount * 8
  const pendingPenalty = Math.max(0, totalAmendments - ratifiedCount) * 2
  return Math.max(20, Math.round(base - ratiPenalty - pendingPenalty))
}

/** Ongoing Engagement — active debate after establishment (arguments posted) */
function calcOngoingEngagement(postEstablishmentArgs: number): number {
  // Still generating arguments = the law is still relevant
  if (postEstablishmentArgs === 0) return 40
  return Math.min(95, Math.round(40 + Math.log1p(postEstablishmentArgs) / Math.log1p(100) * 55))
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Fetch core law data
  const { data: law, error: lawError } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (lawError || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const bluePct   = law.blue_pct ?? 50
  const totalVotes = law.total_votes ?? 0
  const establishedAt = law.established_at

  // ── Parallel data fetches ─────────────────────────────────────────────────

  const [
    { data: verdicts },
    { data: amendments },
    { data: challenges },
    { data: postArgs },
  ] = await Promise.all([
    // Community verdicts
    supabase
      .from('law_verdict_votes')
      .select('verdict')
      .eq('law_id', params.id),

    // Amendment proposals
    supabase
      .from('law_amendments')
      .select('status')
      .eq('law_id', params.id),

    // Formal challenges
    supabase
      .from('law_challenges')
      .select('status')
      .eq('law_id', params.id),

    // Arguments posted after establishment
    law.topic_id
      ? supabase
          .from('topic_arguments')
          .select('id', { count: 'exact', head: true })
          .eq('topic_id', law.topic_id)
          .gte('created_at', establishedAt)
      : Promise.resolve({ data: null, count: 0, error: null }),
  ])

  // ── Aggregate verdict counts ───────────────────────────────────────────────

  let succeedCount = 0
  let mixedCount   = 0
  let failedCount  = 0
  for (const v of verdicts ?? []) {
    if (v.verdict === 'succeeded' || v.verdict === 'mostly_succeeded') succeedCount++
    else if (v.verdict === 'mixed') mixedCount++
    else failedCount++
  }
  const verdictTotal = succeedCount + mixedCount + failedCount

  // ── Aggregate amendment counts ─────────────────────────────────────────────

  const totalAmendments  = amendments?.length ?? 0
  const ratifiedAmends   = amendments?.filter((a) => a.status === 'ratified').length ?? 0

  // ── Aggregate challenge counts ─────────────────────────────────────────────

  const totalChallenges = challenges?.length ?? 0
  const dismissed       = challenges?.filter((c) => c.status === 'dismissed').length ?? 0
  const upheld          = challenges?.filter((c) => c.status === 'upheld').length ?? 0

  // ── Calculate dimension scores ─────────────────────────────────────────────

  const postEstablishmentArgs = (postArgs as { count?: number } | null)?.count ?? 0

  const legitimacyScore   = calcLegitimacy(totalVotes, bluePct)
  const verdictScore      = calcCommunityVerdict(succeedCount, mixedCount, failedCount)
  const resilienceScore   = calcResilience(totalChallenges, dismissed, upheld)
  const stabilityScore    = calcAmendmentStability(totalAmendments, ratifiedAmends)
  const engagementScore   = calcOngoingEngagement(postEstablishmentArgs)

  const overall = Math.round(
    legitimacyScore  * 0.25 +
    verdictScore     * 0.30 +
    resilienceScore  * 0.20 +
    stabilityScore   * 0.15 +
    engagementScore  * 0.10
  )

  // ── Build dimension objects ────────────────────────────────────────────────

  const dimensions: LawScorecardDimension[] = [
    {
      key:   'legitimacy',
      label: 'Legitimacy',
      grade: scoreToGrade(legitimacyScore),
      score: legitimacyScore,
      description: 'Breadth of participation and decisiveness of the original vote',
      detail: `${totalVotes.toLocaleString()} votes cast · ${Math.round(bluePct)}% FOR / ${Math.round(100 - bluePct)}% AGAINST`,
      href:  `/law/${params.id}/voters`,
    },
    {
      key:   'verdict',
      label: 'Community Verdict',
      grade: scoreToGrade(verdictScore),
      score: verdictScore,
      description: 'Retrospective community assessment of whether the law achieved its goals',
      detail: verdictTotal === 0
        ? 'No community verdicts submitted yet'
        : `${verdictTotal} verdict${verdictTotal !== 1 ? 's' : ''} · ${succeedCount} succeeded · ${mixedCount} mixed · ${failedCount} failed`,
      href:  `/law/${params.id}/verdict`,
    },
    {
      key:   'resilience',
      label: 'Resilience',
      grade: scoreToGrade(resilienceScore),
      score: resilienceScore,
      description: 'How well the law has withstood formal legal challenges',
      detail: totalChallenges === 0
        ? 'No formal challenges have been filed'
        : `${totalChallenges} challenge${totalChallenges !== 1 ? 's' : ''} · ${dismissed} dismissed · ${upheld} upheld · ${totalChallenges - dismissed - upheld} open`,
      href:  `/law/${params.id}/challenge`,
    },
    {
      key:   'stability',
      label: 'Text Stability',
      grade: scoreToGrade(stabilityScore),
      score: stabilityScore,
      description: 'How stable the law\'s text has been since establishment',
      detail: totalAmendments === 0
        ? 'No amendments have been proposed'
        : `${totalAmendments} amendment${totalAmendments !== 1 ? 's' : ''} proposed · ${ratifiedAmends} ratified`,
      href:  `/law/${params.id}/amendments`,
    },
    {
      key:   'engagement',
      label: 'Ongoing Debate',
      grade: scoreToGrade(engagementScore),
      score: engagementScore,
      description: 'Continued community engagement and argument activity since establishment',
      detail: postEstablishmentArgs === 0
        ? 'No new arguments posted since establishment'
        : `${postEstablishmentArgs} argument${postEstablishmentArgs !== 1 ? 's' : ''} posted after establishment`,
      href:  `/law/${params.id}/discuss`,
    },
  ]

  // ── Summary sentence ───────────────────────────────────────────────────────

  const overallGrade = scoreToGrade(overall)

  const summaryParts: string[] = []
  if (legitimacyScore >= 80) summaryParts.push('strong democratic mandate')
  else if (legitimacyScore < 60) summaryParts.push('narrow passage')

  if (verdictTotal > 0) {
    if (verdictScore >= 75) summaryParts.push('positive community assessment')
    else if (verdictScore < 50) summaryParts.push('community doubts about effectiveness')
  }

  if (totalChallenges > 0 && resilienceScore >= 70) summaryParts.push('withstood challenges')
  if (ratifiedAmends > 0) summaryParts.push(`amended ${ratifiedAmends}x`)

  const summary = summaryParts.length > 0
    ? `Overall grade ${overallGrade} — this law has ${summaryParts.join(', ')}.`
    : `Overall grade ${overallGrade} — an established consensus law with ${totalVotes.toLocaleString()} votes and ${Math.round(bluePct)}% FOR.`

  const response: LawScorecardResponse = {
    law_id:         params.id,
    statement:      law.statement,
    category:       law.category,
    established_at: establishedAt,
    overall_grade:  overallGrade,
    overall_score:  overall,
    dimensions,
    summary,
    generated_at:   new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
