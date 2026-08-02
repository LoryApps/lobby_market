import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F'

export interface AuditDimension {
  key: string
  label: string
  grade: AuditGrade
  score: number          // 0–100
  description: string    // one-line explanation
  finding: string        // concrete data finding
  passed: boolean        // did it meet the minimum democratic standard?
}

export interface LawAuditResponse {
  law_id: string
  statement: string
  category: string | null
  established_at: string
  total_votes: number
  blue_pct: number
  overall_grade: AuditGrade
  overall_score: number
  dimensions: AuditDimension[]
  headline: string          // e.g. "Strong democratic mandate, thin debate record"
  deliberation_days: number // how many days the debate ran
  total_arguments: number
  for_arguments: number
  against_arguments: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreToGrade(score: number): AuditGrade {
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

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n))
}

// ─── Dimension calculators ────────────────────────────────────────────────────

/** Consensus Strength — how decisively the community voted FOR or AGAINST */
function calcConsensusStrength(bluePct: number, totalVotes: number): {
  score: number
  finding: string
  passed: boolean
} {
  const deviation = Math.abs(bluePct - 50)
  // 67% threshold = 17 deviation → starts scoring. 85%+ = perfect
  const thresholdDev = 17
  const devScore = clamp(((deviation - thresholdDev) / (35 - thresholdDev)) * 100)
  // Vote count modifier: log scale up to 10k
  const volumeBonus = clamp((Math.log1p(totalVotes) / Math.log1p(10000)) * 20)
  const score = clamp(Math.round(devScore * 0.8 + volumeBonus))
  const side = bluePct >= 67 ? 'FOR' : 'AGAINST'
  const pct = bluePct >= 67 ? Math.round(bluePct) : Math.round(100 - bluePct)
  const finding = `${pct}% voted ${side} across ${totalVotes.toLocaleString()} ballots`
  return { score, finding, passed: deviation >= thresholdDev }
}

/** Deliberation Depth — how long the debate ran and how many days had arguments */
function calcDeliberationDepth(
  topicCreatedAt: string,
  establishedAt: string,
  activeDays: number,
  totalArgs: number
): { score: number; finding: string; passed: boolean } {
  const debateDays = Math.max(
    1,
    Math.round(
      (new Date(establishedAt).getTime() - new Date(topicCreatedAt).getTime()) /
        86_400_000
    )
  )
  // At least 3 days + 5 active days = minimum. 14+ days = excellent.
  const dayScore = clamp((debateDays / 14) * 60)
  // Arguments contribute up to 40 points (50+ args = max)
  const argScore = clamp((totalArgs / 50) * 40)
  const score = clamp(Math.round(dayScore + argScore))
  const finding = `${debateDays}d debate · ${activeDays} active days · ${totalArgs} arguments`
  return { score, finding, passed: debateDays >= 3 && totalArgs >= 5 }
}

/** Voice Balance — were both sides heard proportionally? */
function calcVoiceBalance(
  forArgs: number,
  againstArgs: number,
  forUpvotes: number,
  againstUpvotes: number
): { score: number; finding: string; passed: boolean } {
  const totalArgs = forArgs + againstArgs
  if (totalArgs === 0) {
    return { score: 30, finding: 'No arguments recorded', passed: false }
  }
  // Balance ratio: 50/50 = 100, 90/10 = 20
  const ratio = totalArgs > 0 ? Math.min(forArgs, againstArgs) / Math.max(forArgs, againstArgs, 1) : 0
  const balanceScore = clamp(ratio * 100)
  // Engagement balance (upvotes)
  const totalUp = forUpvotes + againstUpvotes
  const upRatio = totalUp > 0 ? Math.min(forUpvotes, againstUpvotes) / Math.max(forUpvotes, againstUpvotes, 1) : 0.5
  const upScore = clamp(upRatio * 100)
  const score = clamp(Math.round(balanceScore * 0.6 + upScore * 0.4))
  const finding = `${forArgs} FOR · ${againstArgs} AGAINST · ${Math.round(ratio * 100)}% balance`
  return { score, finding, passed: ratio >= 0.3 }
}

/** Argument Quality — engagement (upvotes) relative to argument count */
function calcArgumentQuality(
  totalArgs: number,
  totalUpvotes: number,
  avgUpvotes: number
): { score: number; finding: string; passed: boolean } {
  if (totalArgs === 0) {
    return { score: 20, finding: 'No arguments to assess', passed: false }
  }
  // Average upvotes per argument: 0 = 0, 10+ = solid, 50+ = excellent
  const engagementScore = clamp((Math.log1p(avgUpvotes) / Math.log1p(50)) * 80)
  // Volume bonus: more arguments = more deliberation
  const volumeScore = clamp((Math.log1p(totalArgs) / Math.log1p(100)) * 20)
  const score = clamp(Math.round(engagementScore + volumeScore))
  const finding =
    `${totalArgs} arguments · avg ${Math.round(avgUpvotes)} upvotes · ${totalUpvotes.toLocaleString()} total upvotes`
  return { score, finding, passed: totalArgs >= 3 && avgUpvotes >= 1 }
}

/** Participation Scale — raw voter count relative to expected civic engagement */
function calcParticipationScale(totalVotes: number): {
  score: number
  finding: string
  passed: boolean
} {
  // 100 votes = C, 1000 = B, 5000 = A, 10000+ = A+
  const score = clamp(Math.round((Math.log1p(totalVotes) / Math.log1p(10000)) * 100))
  const finding = `${totalVotes.toLocaleString()} votes cast`
  return { score, finding, passed: totalVotes >= 50 }
}

/** Post-Law Scrutiny — community follow-through (verdicts, amendments, challenges) */
function calcPostLawScrutiny(
  verdictCount: number,
  amendmentCount: number,
  challengeCount: number
): { score: number; finding: string; passed: boolean } {
  // Any post-law engagement is positive (shows community still cares)
  const totalEngagement = verdictCount + amendmentCount + challengeCount
  const baseScore = clamp((Math.log1p(totalEngagement) / Math.log1p(30)) * 100)
  const parts = []
  if (verdictCount > 0) parts.push(`${verdictCount} verdict${verdictCount !== 1 ? 's' : ''}`)
  if (amendmentCount > 0) parts.push(`${amendmentCount} amendment${amendmentCount !== 1 ? 's' : ''}`)
  if (challengeCount > 0) parts.push(`${challengeCount} challenge${challengeCount !== 1 ? 's' : ''}`)
  const finding = parts.length > 0 ? parts.join(' · ') : 'No post-law activity yet'
  return { score: Math.round(baseScore), finding, passed: totalEngagement > 0 }
}

function buildHeadline(dims: AuditDimension[]): string {
  const scores = Object.fromEntries(dims.map((d) => [d.key, d.score]))
  const weakest = dims.reduce((a, b) => (a.score < b.score ? a : b))
  const strongest = dims.reduce((a, b) => (a.score > b.score ? a : b))
  if (scores['consensus'] >= 85 && scores['participation'] >= 80) {
    return 'Strong democratic mandate with broad participation'
  }
  if (scores['deliberation'] < 50 || scores['balance'] < 50) {
    return `Decisive vote but limited deliberation — ${weakest.label.toLowerCase()} needs attention`
  }
  if (scores['quality'] >= 80 && scores['balance'] >= 80) {
    return 'Well-argued law: balanced voices and high-quality debate'
  }
  return `${strongest.label} was the debate's standout — ${weakest.label.toLowerCase()} could be stronger`
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // ── Law & topic ──────────────────────────────────────────────────────────────
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, blue_pct, total_votes, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const topicId = law.topic_id

  // ── Topic creation date ──────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('created_at')
    .eq('id', topicId)
    .maybeSingle()

  // ── Arguments ────────────────────────────────────────────────────────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('id, side, upvotes, created_at')
    .eq('topic_id', topicId)

  const args = argRows ?? []
  const forArgs = args.filter((a) => a.side === 'blue')
  const againstArgs = args.filter((a) => a.side === 'red')

  const forUpvotes = forArgs.reduce((s, a) => s + (a.upvotes ?? 0), 0)
  const againstUpvotes = againstArgs.reduce((s, a) => s + (a.upvotes ?? 0), 0)
  const totalUpvotes = forUpvotes + againstUpvotes
  const avgUpvotes = args.length > 0 ? totalUpvotes / args.length : 0

  // Active days = distinct calendar days with at least one argument
  const daySet = new Set(
    args.map((a) => a.created_at.slice(0, 10))
  )
  const activeDays = daySet.size

  // ── Post-law scrutiny ────────────────────────────────────────────────────────
  const [{ count: verdictCount }, { count: amendmentCount }, { count: challengeCount }] =
    await Promise.all([
      supabase.from('law_verdict_votes').select('*', { count: 'exact', head: true }).eq('law_id', law.id),
      supabase.from('law_amendments').select('*', { count: 'exact', head: true }).eq('law_id', law.id),
      supabase.from('law_challenges').select('*', { count: 'exact', head: true }).eq('law_id', law.id),
    ])

  // ── Calculate dimensions ─────────────────────────────────────────────────────
  const topicCreatedAt = topic?.created_at ?? law.established_at
  const bluePct = law.blue_pct ?? 50
  const totalVotes = law.total_votes ?? 0

  const consensusDim = calcConsensusStrength(bluePct, totalVotes)
  const participationDim = calcParticipationScale(totalVotes)
  const deliberationDim = calcDeliberationDepth(topicCreatedAt, law.established_at, activeDays, args.length)
  const balanceDim = calcVoiceBalance(forArgs.length, againstArgs.length, forUpvotes, againstUpvotes)
  const qualityDim = calcArgumentQuality(args.length, totalUpvotes, avgUpvotes)
  const scrutinyDim = calcPostLawScrutiny(verdictCount ?? 0, amendmentCount ?? 0, challengeCount ?? 0)

  const deliberationDays = Math.max(
    1,
    Math.round(
      (new Date(law.established_at).getTime() - new Date(topicCreatedAt).getTime()) / 86_400_000
    )
  )

  const dimensions: AuditDimension[] = [
    {
      key: 'consensus',
      label: 'Consensus Strength',
      score: consensusDim.score,
      grade: scoreToGrade(consensusDim.score),
      description: 'How decisively the community voted — measured above the 67% supermajority threshold',
      finding: consensusDim.finding,
      passed: consensusDim.passed,
    },
    {
      key: 'participation',
      label: 'Participation Scale',
      score: participationDim.score,
      grade: scoreToGrade(participationDim.score),
      description: 'The raw breadth of civic engagement — more voters means broader mandate',
      finding: participationDim.finding,
      passed: participationDim.passed,
    },
    {
      key: 'deliberation',
      label: 'Deliberation Depth',
      score: deliberationDim.score,
      grade: scoreToGrade(deliberationDim.score),
      description: 'How long and actively the debate ran before reaching consensus',
      finding: deliberationDim.finding,
      passed: deliberationDim.passed,
    },
    {
      key: 'balance',
      label: 'Voice Balance',
      score: balanceDim.score,
      grade: scoreToGrade(balanceDim.score),
      description: 'Whether both sides of the debate were heard proportionally',
      finding: balanceDim.finding,
      passed: balanceDim.passed,
    },
    {
      key: 'quality',
      label: 'Argument Quality',
      score: qualityDim.score,
      grade: scoreToGrade(qualityDim.score),
      description: 'The depth and engagement of arguments made — upvote engagement as a quality proxy',
      finding: qualityDim.finding,
      passed: qualityDim.passed,
    },
    {
      key: 'scrutiny',
      label: 'Post-Law Scrutiny',
      score: scrutinyDim.score,
      grade: scoreToGrade(scrutinyDim.score),
      description: 'Whether the community continues to engage with this law after passage',
      finding: scrutinyDim.finding,
      passed: scrutinyDim.passed,
    },
  ]

  const overallScore = Math.round(
    dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length
  )

  const response: LawAuditResponse = {
    law_id: law.id,
    statement: law.statement,
    category: law.category,
    established_at: law.established_at,
    total_votes: totalVotes,
    blue_pct: bluePct,
    overall_grade: scoreToGrade(overallScore),
    overall_score: overallScore,
    dimensions,
    headline: buildHeadline(dimensions),
    deliberation_days: deliberationDays,
    total_arguments: args.length,
    for_arguments: forArgs.length,
    against_arguments: againstArgs.length,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
