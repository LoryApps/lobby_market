import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 1800 // 30 min — laws change slowly

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegacyVerdict {
  verdict: 'succeeded' | 'mostly_succeeded' | 'mixed' | 'mostly_failed' | 'failed'
  count: number
}

export interface LegacyChallenge {
  id: string
  title: string
  grounds: string
  status: 'open' | 'upheld' | 'dismissed'
  support_count: number
  oppose_count: number
  created_at: string
}

export interface LegacyRelatedLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
}

export interface LegacyContinuation {
  id: string
  statement: string
  status: string
  blue_pct: number
  total_votes: number
  category: string | null
}

export interface LawLegacyData {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
    is_active: boolean
    topic_id: string
  }
  topic: {
    id: string
    statement: string
    scope: string | null
    view_count: number | null
    total_arguments: number | null
    created_at: string
  } | null
  // How long the original debate ran
  debate_days: number
  // Community retrospective: succeeded / failed?
  verdicts: LegacyVerdict[]
  verdict_total: number
  dominant_verdict: string | null
  // Formal legal challenges
  challenges: LegacyChallenge[]
  challenge_counts: { open: number; upheld: number; dismissed: number; total: number }
  // Revision history (wiki/content edits)
  revision_count: number
  amendment_count: number
  // Related laws (linked via law_links)
  related_laws: LegacyRelatedLaw[]
  // Continuation topics — debates that sprang from this law
  continuations: LegacyContinuation[]
  // Participation rank vs all laws
  law_rank: {
    percentile: number
    total_laws: number
    rank_position: number
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // 1. Law
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, topic_id, statement, category, blue_pct, total_votes, established_at, is_active')
    .eq('id', params.id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // 2. Original topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, scope, view_count, total_arguments, created_at')
    .eq('id', law.topic_id)
    .maybeSingle()

  // 3. Debate duration
  const debateDays = topic?.created_at
    ? Math.max(
        1,
        Math.round(
          (new Date(law.established_at).getTime() - new Date(topic.created_at).getTime()) /
            86_400_000
        )
      )
    : 0

  // 4. Verdict aggregation
  const { data: verdictRows } = await supabase
    .from('law_verdict_votes')
    .select('verdict')
    .eq('law_id', params.id)

  const verdictCounts: Record<string, number> = {}
  for (const row of verdictRows ?? []) {
    verdictCounts[row.verdict] = (verdictCounts[row.verdict] ?? 0) + 1
  }
  const verdictOrder = ['succeeded', 'mostly_succeeded', 'mixed', 'mostly_failed', 'failed'] as const
  const verdicts: LegacyVerdict[] = verdictOrder
    .filter((v) => verdictCounts[v] !== undefined)
    .map((v) => ({ verdict: v, count: verdictCounts[v] }))
  const verdictTotal = Object.values(verdictCounts).reduce((a, b) => a + b, 0)
  let dominantVerdict: string | null = null
  let maxVerdictCount = 0
  for (const [v, c] of Object.entries(verdictCounts)) {
    if (c > maxVerdictCount) { maxVerdictCount = c; dominantVerdict = v }
  }

  // 5. Formal challenges
  const { data: challengeRows } = await supabase
    .from('law_challenges')
    .select('id, title, grounds, status, support_count, oppose_count, created_at')
    .eq('law_id', params.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const challenges: LegacyChallenge[] = (challengeRows ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    grounds: c.grounds,
    status: c.status as 'open' | 'upheld' | 'dismissed',
    support_count: c.support_count,
    oppose_count: c.oppose_count,
    created_at: c.created_at,
  }))

  const { data: challengeCountRows } = await supabase
    .from('law_challenges')
    .select('status')
    .eq('law_id', params.id)

  const challengeCounts = { open: 0, upheld: 0, dismissed: 0, total: 0 }
  for (const row of challengeCountRows ?? []) {
    const s = row.status as keyof typeof challengeCounts
    if (s in challengeCounts) challengeCounts[s]++
    challengeCounts.total++
  }

  // 6. Revision count
  const { count: revisionCount } = await supabase
    .from('law_revisions')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', params.id)

  // 7. Amendment count
  const { count: amendmentCount } = await supabase
    .from('law_amendments')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', params.id)

  // 8. Related laws via law_links (outgoing + incoming)
  const { data: outLinks } = await supabase
    .from('law_links')
    .select('target_law_id')
    .eq('source_law_id', params.id)
    .limit(6)

  const { data: inLinks } = await supabase
    .from('law_links')
    .select('source_law_id')
    .eq('target_law_id', params.id)
    .limit(6)

  const relatedIds = [
    ...(outLinks ?? []).map((l) => l.target_law_id),
    ...(inLinks ?? []).map((l) => l.source_law_id),
  ].filter((id, i, arr) => id !== params.id && arr.indexOf(id) === i).slice(0, 6)

  let relatedLaws: LegacyRelatedLaw[] = []
  if (relatedIds.length > 0) {
    const { data: related } = await supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at')
      .in('id', relatedIds)
      .order('total_votes', { ascending: false })
    relatedLaws = (related ?? []).map((l) => ({
      id: l.id,
      statement: l.statement,
      category: l.category,
      blue_pct: l.blue_pct,
      total_votes: l.total_votes,
      established_at: l.established_at,
    }))
  }

  // 9. Continuation topics (topics that follow from the original topic)
  const { data: contRows } = await supabase
    .from('continuations')
    .select('id, statement, status, blue_pct, total_votes, category')
    .eq('parent_topic_id', law.topic_id)
    .order('total_votes', { ascending: false })
    .limit(5)

  const continuations: LegacyContinuation[] = (contRows ?? []).map((c) => ({
    id: c.id,
    statement: c.statement,
    status: c.status,
    blue_pct: c.blue_pct ?? 50,
    total_votes: c.total_votes ?? 0,
    category: c.category ?? null,
  }))

  // 10. Participation rank among all laws
  const { count: totalLaws } = await supabase
    .from('laws')
    .select('id', { count: 'exact', head: true })

  const { count: lawsAbove } = await supabase
    .from('laws')
    .select('id', { count: 'exact', head: true })
    .gt('total_votes', law.total_votes)

  const lawRank = {
    total_laws: totalLaws ?? 1,
    rank_position: (lawsAbove ?? 0) + 1,
    percentile: Math.round(
      (1 - (lawsAbove ?? 0) / Math.max(1, totalLaws ?? 1)) * 100
    ),
  }

  const payload: LawLegacyData = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct,
      total_votes: law.total_votes,
      established_at: law.established_at,
      is_active: law.is_active,
      topic_id: law.topic_id,
    },
    topic: topic
      ? {
          id: topic.id,
          statement: topic.statement,
          scope: topic.scope ?? null,
          view_count: topic.view_count ?? null,
          total_arguments: topic.total_arguments ?? null,
          created_at: topic.created_at,
        }
      : null,
    debate_days: debateDays,
    verdicts,
    verdict_total: verdictTotal,
    dominant_verdict: dominantVerdict,
    challenges,
    challenge_counts: challengeCounts,
    revision_count: revisionCount ?? 0,
    amendment_count: amendmentCount ?? 0,
    related_laws: relatedLaws,
    continuations,
    law_rank: lawRank,
  }

  return NextResponse.json(payload)
}
