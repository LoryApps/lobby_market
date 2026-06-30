import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LetterGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F'

export interface ScorecardDimension {
  key: string
  label: string
  grade: LetterGrade
  score: number        // 0-100
  description: string
  detail: string
  improvement: string | null
  href: string
}

export interface ScorecardResponse {
  topic_id: string
  statement: string
  category: string | null
  status: string
  overall_grade: LetterGrade
  overall_score: number
  dimensions: ScorecardDimension[]
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

/**
 * Participation — based on total votes and argument count.
 * Benchmarks: 100 votes = C, 500 = B, 2000 = A
 */
function calcParticipation(totalVotes: number, totalArguments: number): number {
  const voteScore = Math.min(50, Math.log1p(totalVotes) / Math.log1p(2000) * 50)
  const argScore  = Math.min(50, Math.log1p(totalArguments) / Math.log1p(40) * 50)
  return Math.round(voteScore + argScore)
}

/**
 * Consensus Clarity — how decisive the vote split is.
 * Closer to 50/50 = unclear (low score). Very lopsided (>70% one way) = clear.
 * Note: we reward DECISIVENESS here — a deadlock debate is unclear.
 */
function calcConsensusClarity(forPct: number): number {
  const deviation = Math.abs(forPct - 50)  // 0 (deadlock) to 50 (unanimous)
  // Map: 0 deviation → 30 score, 25 deviation → 70, 40 deviation → 90
  return Math.round(30 + deviation * 1.4)
}

/**
 * Argument Quality — based on graded argument AI scores.
 * Falls back gracefully if no AI grades exist.
 */
function calcArgumentQuality(avgScore: number | null, gradedCount: number, totalArgs: number): number {
  if (gradedCount === 0 || avgScore === null) {
    // No AI grades yet — give a neutral-low score
    return Math.min(60, 30 + totalArgs * 2)
  }
  // avgScore is 1-10; scale to 0-100 with a mild bonus for high graded coverage
  const base = (avgScore / 10) * 85
  const coverageBonus = Math.min(15, (gradedCount / Math.max(1, totalArgs)) * 15)
  return Math.round(Math.min(100, base + coverageBonus))
}

/**
 * Evidence Quality — based on sources + evidence items count.
 * Having at least 3 sources and some evidence raises score significantly.
 */
function calcEvidenceQuality(sourcesCount: number, evidenceCount: number): number {
  const srcScore = Math.min(50, sourcesCount * 12)
  const evScore  = Math.min(50, evidenceCount * 6)
  return Math.round(srcScore + evScore)
}

/**
 * Debate Balance — how balanced the FOR/AGAINST sides are in ARGUMENTS
 * (not just votes). Heavily one-sided argument pools = lower score.
 */
function calcDebateBalance(forArgs: number, againstArgs: number): number {
  const total = forArgs + againstArgs
  if (total === 0) return 40
  const ratio = Math.min(forArgs, againstArgs) / Math.max(forArgs, againstArgs)
  // ratio of 1.0 = perfectly balanced = 100; ratio of 0 = one-sided = 30
  return Math.round(30 + ratio * 70)
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = params.id
  const supabase = await createClient()

  // ── 1. Topic metadata ────────────────────────────────────────────────────────
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', topicId)
    .maybeSingle()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const forPct = topic.blue_pct ?? 50
  const totalVotes = topic.total_votes ?? 0

  // ── 2. Arguments ─────────────────────────────────────────────────────────────
  const { data: argStats } = await supabase
    .from('topic_arguments')
    .select('side, ai_score, ai_grade')
    .eq('topic_id', topicId)
    .eq('deleted', false)

  const allArgs = argStats ?? []
  const totalArguments = allArgs.length
  const forArgs     = allArgs.filter(a => a.side === 'blue').length
  const againstArgs = allArgs.filter(a => a.side === 'red').length

  const gradedArgs   = allArgs.filter(a => a.ai_score !== null && a.ai_score !== undefined)
  const gradedCount  = gradedArgs.length
  const avgScore     = gradedCount > 0
    ? gradedArgs.reduce((s, a) => s + (a.ai_score ?? 0), 0) / gradedCount
    : null

  // ── 3. Sources ───────────────────────────────────────────────────────────────
  const { count: sourcesCount } = await supabase
    .from('topic_sources')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', topicId)

  // ── 4. Evidence items ─────────────────────────────────────────────────────────
  const { count: evidenceCount } = await supabase
    .from('topic_evidence')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', topicId)

  // ── 5. Compute dimension scores ───────────────────────────────────────────────
  const participationScore    = calcParticipation(totalVotes, totalArguments)
  const consensusClarityScore = calcConsensusClarity(forPct)
  const argumentQualityScore  = calcArgumentQuality(avgScore, gradedCount, totalArguments)
  const evidenceScore         = calcEvidenceQuality(sourcesCount ?? 0, evidenceCount ?? 0)
  const debateBalanceScore    = calcDebateBalance(forArgs, againstArgs)

  const dimensions: ScorecardDimension[] = [
    {
      key: 'participation',
      label: 'Participation',
      grade: scoreToGrade(participationScore),
      score: participationScore,
      description: 'How many citizens have voted and argued on this topic.',
      detail: `${totalVotes.toLocaleString()} votes · ${totalArguments} arguments`,
      improvement: participationScore < 70
        ? 'Share this topic to attract more participants.'
        : null,
      href: `/topic/${topicId}/voters`,
    },
    {
      key: 'consensus_clarity',
      label: 'Consensus Clarity',
      grade: scoreToGrade(consensusClarityScore),
      score: consensusClarityScore,
      description: 'How decisive the community verdict is.',
      detail: `${Math.round(forPct)}% FOR · ${Math.round(100 - forPct)}% AGAINST`,
      improvement: consensusClarityScore < 70
        ? 'This debate is close. Cast your vote and share your reasoning.'
        : null,
      href: `/topic/${topicId}/stats`,
    },
    {
      key: 'argument_quality',
      label: 'Argument Quality',
      grade: scoreToGrade(argumentQualityScore),
      score: argumentQualityScore,
      description: 'The depth and strength of arguments on both sides.',
      detail: gradedCount > 0
        ? `Avg AI score ${avgScore?.toFixed(1)}/10 across ${gradedCount} graded arguments`
        : `${totalArguments} arguments — none AI-graded yet`,
      improvement: argumentQualityScore < 70
        ? 'Write a well-cited argument and request an AI quality review.'
        : null,
      href: `/topic/${topicId}/quality`,
    },
    {
      key: 'evidence',
      label: 'Evidence & Sources',
      grade: scoreToGrade(evidenceScore),
      score: evidenceScore,
      description: 'Supporting sources and evidence linked to this debate.',
      detail: `${sourcesCount ?? 0} sources · ${evidenceCount ?? 0} evidence items`,
      improvement: evidenceScore < 70
        ? 'Add credible sources to strengthen the evidence base.'
        : null,
      href: `/topic/${topicId}/evidence`,
    },
    {
      key: 'debate_balance',
      label: 'Debate Balance',
      grade: scoreToGrade(debateBalanceScore),
      score: debateBalanceScore,
      description: 'Whether both sides of the debate are equally represented.',
      detail: `${forArgs} FOR arguments · ${againstArgs} AGAINST arguments`,
      improvement: debateBalanceScore < 70
        ? 'The debate is one-sided. Consider arguing the minority position.'
        : null,
      href: `/topic/${topicId}/versus`,
    },
  ]

  // ── 6. Overall score (weighted) ───────────────────────────────────────────────
  const WEIGHTS = [0.20, 0.20, 0.25, 0.20, 0.15]
  const scores  = [participationScore, consensusClarityScore, argumentQualityScore, evidenceScore, debateBalanceScore]
  const overallScore = Math.round(scores.reduce((s, v, i) => s + v * WEIGHTS[i], 0))
  const overallGrade = scoreToGrade(overallScore)

  // ── 7. Summary sentence ───────────────────────────────────────────────────────
  const topDimension    = dimensions.reduce((best, d) => d.score > best.score ? d : best, dimensions[0])
  const bottomDimension = dimensions.reduce((worst, d) => d.score < worst.score ? d : worst, dimensions[0])

  const statusLabel: Record<string, string> = {
    proposed: 'a newly proposed',
    active: 'an active',
    voting: 'a live voting',
    law: 'a resolved (law)',
    failed: 'a resolved (failed)',
  }

  const summary = [
    `This is ${statusLabel[topic.status] ?? 'a'} debate with an overall grade of ${overallGrade}.`,
    overallScore >= 80
      ? 'It is a strong, well-rounded civic debate.'
      : overallScore >= 60
        ? 'It shows promise but has room for improvement.'
        : 'It needs more community engagement to reach its potential.',
    `Its strongest dimension is ${topDimension.label.toLowerCase()}`,
    bottomDimension.key !== topDimension.key
      ? `; its weakest is ${bottomDimension.label.toLowerCase()}.`
      : '.',
  ].join(' ')

  const response: ScorecardResponse = {
    topic_id: topicId,
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    overall_grade: overallGrade,
    overall_score: overallScore,
    dimensions,
    summary,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
