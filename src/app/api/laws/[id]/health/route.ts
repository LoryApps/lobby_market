import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawHealthDimension {
  label: string
  score: number      // 0–100
  weight: number     // contribution to overall score
  detail: string
  status: 'good' | 'fair' | 'poor'
}

export interface VerdictSummary {
  total: number
  succeeded: number
  mostly_succeeded: number
  mixed: number
  mostly_failed: number
  failed: number
  success_pct: number  // (succeeded + mostly_succeeded) / total
  user_verdict: string | null
}

export interface WikiSummary {
  has_content: boolean
  word_count: number
  char_count: number
  total_edits: number
  last_edited_at: string | null
}

export interface ChallengeSummary {
  total: number
  open: number
  upheld: number
  dismissed: number
  latest_grounds: string | null
}

export interface DiscussionSummary {
  total_messages: number
  recent_7d: number
  last_message_at: string | null
}

export interface LawHealthData {
  law_id: string
  law_statement: string
  law_category: string | null
  law_established_at: string | null
  law_blue_pct: number
  law_total_votes: number

  overall_health: number      // 0–100 composite
  health_grade: 'A' | 'B' | 'C' | 'D' | 'F'
  dimensions: LawHealthDimension[]

  verdict: VerdictSummary
  wiki: WikiSummary
  challenges: ChallengeSummary
  discussion: DiscussionSummary

  recommendations: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function healthGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 80) return 'A'
  if (score >= 65) return 'B'
  if (score >= 50) return 'C'
  if (score >= 35) return 'D'
  return 'F'
}

function dimStatus(score: number): 'good' | 'fair' | 'poor' {
  if (score >= 65) return 'good'
  if (score >= 35) return 'fair'
  return 'poor'
}

// ─── GET /api/laws/[id]/health ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Fetch the law itself
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, blue_pct, total_votes, wiki_content, wiki_updated_at')
    .eq('id', params.id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // ── 1. Verdict coverage ────────────────────────────────────────────────────
  const { data: verdictRows } = await supabase
    .from('law_verdict_votes')
    .select('verdict')
    .eq('law_id', params.id)

  const verdictCounts = { succeeded: 0, mostly_succeeded: 0, mixed: 0, mostly_failed: 0, failed: 0 }
  for (const r of verdictRows ?? []) {
    const v = r.verdict as keyof typeof verdictCounts
    if (v in verdictCounts) verdictCounts[v]++
  }
  const totalVerdicts = (verdictRows ?? []).length
  const successVerdicts = verdictCounts.succeeded + verdictCounts.mostly_succeeded
  const successPct = totalVerdicts > 0 ? Math.round((successVerdicts / totalVerdicts) * 100) : 0

  // Verdict score: 100 if 20+ verdicts, scaled down for fewer
  const verdictCoverageScore = Math.min(100, Math.round((totalVerdicts / 20) * 100))

  // ── 2. Wiki quality ────────────────────────────────────────────────────────
  const wikiContent: string = (law as { wiki_content?: string | null }).wiki_content ?? ''
  const wikiCharCount = wikiContent.length
  const wikiWordCount = wikiContent ? wikiContent.split(/\s+/).filter(Boolean).length : 0
  const wikiUpdatedAt: string | null = (law as { wiki_updated_at?: string | null }).wiki_updated_at ?? null

  const { count: totalWikiEdits } = await supabase
    .from('law_wiki_history')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', params.id)

  // Wiki score: 100 if ≥500 words + multiple edits
  let wikiScore = 0
  if (wikiWordCount >= 500) wikiScore = 100
  else if (wikiWordCount >= 200) wikiScore = 70
  else if (wikiWordCount >= 50) wikiScore = 40
  else if (wikiWordCount > 0) wikiScore = 20

  // ── 3. Challenge scrutiny ──────────────────────────────────────────────────
  const { data: challengeRows } = await supabase
    .from('law_challenges')
    .select('status, grounds')
    .eq('law_id', params.id)
    .order('created_at', { ascending: false })

  const totalChallenges = (challengeRows ?? []).length
  const openChallenges = (challengeRows ?? []).filter(c => c.status === 'open').length
  const upheldChallenges = (challengeRows ?? []).filter(c => c.status === 'upheld').length
  const dismissedChallenges = (challengeRows ?? []).filter(c => c.status === 'dismissed').length
  const latestGrounds = challengeRows?.[0]?.grounds ?? null

  // Challenge score: having challenges is healthy (peer review), upheld is slightly negative
  let challengeScore = 0
  if (totalChallenges >= 3) challengeScore = 80
  else if (totalChallenges >= 1) challengeScore = 50
  // Upheld challenges reduce confidence
  if (upheldChallenges > 0) challengeScore = Math.max(0, challengeScore - 20)

  // ── 4. Discussion activity ─────────────────────────────────────────────────
  const { count: totalMessages } = await supabase
    .from('law_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', params.id)

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { count: recentMessages } = await supabase
    .from('law_chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', params.id)
    .gte('created_at', sevenDaysAgo)

  const { data: lastMessage } = await supabase
    .from('law_chat_messages')
    .select('created_at')
    .eq('law_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const discussionScore = Math.min(100, Math.round(((recentMessages ?? 0) / 10) * 100))

  // ── Overall score ──────────────────────────────────────────────────────────
  const overall = Math.round(
    verdictCoverageScore * 0.35 +
    wikiScore * 0.30 +
    challengeScore * 0.20 +
    discussionScore * 0.15
  )

  // ── Recommendations ────────────────────────────────────────────────────────
  const recommendations: string[] = []
  if (totalVerdicts === 0)
    recommendations.push('Cast the first verdict — was this law a success?')
  else if (totalVerdicts < 5)
    recommendations.push('Only a few verdicts cast. Share the verdict page to get more community input.')
  if (wikiWordCount === 0)
    recommendations.push('Write the wiki — add context, history, and impact notes for this law.')
  else if (wikiWordCount < 100)
    recommendations.push('Expand the wiki article with more detailed context and analysis.')
  if (totalChallenges === 0)
    recommendations.push('No challenges yet. If you see issues with this law, file a formal challenge.')
  if ((recentMessages ?? 0) === 0)
    recommendations.push('Start a discussion — what should citizens know about this law today?')

  const dimensions: LawHealthDimension[] = [
    {
      label: 'Verdict Coverage',
      score: verdictCoverageScore,
      weight: 35,
      detail: totalVerdicts === 0
        ? 'No one has voted on whether this law achieved its goals.'
        : `${totalVerdicts} verdict${totalVerdicts === 1 ? '' : 's'} cast · ${successPct}% say it succeeded.`,
      status: dimStatus(verdictCoverageScore),
    },
    {
      label: 'Wiki Documentation',
      score: wikiScore,
      weight: 30,
      detail: wikiWordCount === 0
        ? 'No wiki article yet — citizens haven\'t documented this law.'
        : `${wikiWordCount.toLocaleString()} words · ${totalWikiEdits ?? 0} edit${(totalWikiEdits ?? 0) === 1 ? '' : 's'}.`,
      status: dimStatus(wikiScore),
    },
    {
      label: 'Formal Scrutiny',
      score: challengeScore,
      weight: 20,
      detail: totalChallenges === 0
        ? 'No formal challenges filed — law has not been peer-reviewed.'
        : `${totalChallenges} challenge${totalChallenges === 1 ? '' : 's'} · ${upheldChallenges} upheld · ${dismissedChallenges} dismissed.`,
      status: dimStatus(challengeScore),
    },
    {
      label: 'Active Discussion',
      score: discussionScore,
      weight: 15,
      detail: (totalMessages ?? 0) === 0
        ? 'No discussion yet — be the first to start a conversation.'
        : `${recentMessages ?? 0} message${(recentMessages ?? 0) === 1 ? '' : 's'} in the last 7 days.`,
      status: dimStatus(discussionScore),
    },
  ]

  const body: LawHealthData = {
    law_id: law.id,
    law_statement: law.statement,
    law_category: law.category,
    law_established_at: law.established_at,
    law_blue_pct: law.blue_pct ?? 50,
    law_total_votes: law.total_votes ?? 0,
    overall_health: overall,
    health_grade: healthGrade(overall),
    dimensions,
    verdict: {
      total: totalVerdicts,
      succeeded: verdictCounts.succeeded,
      mostly_succeeded: verdictCounts.mostly_succeeded,
      mixed: verdictCounts.mixed,
      mostly_failed: verdictCounts.mostly_failed,
      failed: verdictCounts.failed,
      success_pct: successPct,
      user_verdict: null,
    },
    wiki: {
      has_content: wikiWordCount > 0,
      word_count: wikiWordCount,
      char_count: wikiCharCount,
      total_edits: totalWikiEdits ?? 0,
      last_edited_at: wikiUpdatedAt,
    },
    challenges: {
      total: totalChallenges,
      open: openChallenges,
      upheld: upheldChallenges,
      dismissed: dismissedChallenges,
      latest_grounds: latestGrounds,
    },
    discussion: {
      total_messages: totalMessages ?? 0,
      recent_7d: recentMessages ?? 0,
      last_message_at: lastMessage?.created_at ?? null,
    },
    recommendations,
  }

  return NextResponse.json(body)
}
