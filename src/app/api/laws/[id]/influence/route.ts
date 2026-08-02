import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1 hour

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InfluenceLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
}

export interface InfluenceTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
}

export interface LawInfluenceData {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
  }
  /** Laws that have a law_link pointing TO this law (i.e., they cite it) */
  incoming: InfluenceLaw[]
  /** Laws this law links TO (i.e., it cites them) */
  outgoing: InfluenceLaw[]
  /** Topics in the same category created AFTER this law was established */
  downstream: InfluenceTopic[]
  /** Laws in the same category established AFTER this law */
  successorLaws: InfluenceLaw[]
  /** Aggregate influence score (0–100) */
  influenceScore: number
  /** Tier label based on score */
  tier: 'Foundational' | 'High Impact' | 'Notable' | 'Emerging' | 'Local'
  stats: {
    incomingCount: number
    outgoingCount: number
    downstreamTopics: number
    successorLaws: number
    daysSincePassage: number
  }
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeInfluenceScore(
  incomingCount: number,
  outgoingCount: number,
  downstreamCount: number,
  successorCount: number,
  totalVotes: number,
): number {
  // Citations from other laws are the strongest signal
  const citationScore = Math.min(incomingCount * 15, 45)
  // Downstream debates it may have inspired
  const downstreamScore = Math.min(downstreamCount * 3, 25)
  // Successor laws
  const successorScore = Math.min(successorCount * 5, 20)
  // Vote scale (log-scaled)
  const voteScore = Math.min(Math.log10(Math.max(totalVotes, 1)) * 3, 10)

  return Math.round(Math.min(citationScore + downstreamScore + successorScore + voteScore, 100))
}

function scoreTier(score: number): LawInfluenceData['tier'] {
  if (score >= 75) return 'Foundational'
  if (score >= 50) return 'High Impact'
  if (score >= 30) return 'Notable'
  if (score >= 10) return 'Emerging'
  return 'Local'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { id } = params

  // 1. Fetch the law
  const { data: law, error } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', id)
    .single()

  if (error || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // 2. Incoming links: who cites THIS law
  const { data: incomingLinkRows } = await supabase
    .from('law_links')
    .select('source_law_id')
    .eq('target_law_id', id)

  const incomingIds = (incomingLinkRows ?? []).map((r) => r.source_law_id)

  const { data: incomingLaws } = incomingIds.length
    ? await supabase
        .from('laws')
        .select('id, statement, category, blue_pct, total_votes, established_at')
        .in('id', incomingIds)
        .order('total_votes', { ascending: false })
    : { data: [] as InfluenceLaw[] }

  // 3. Outgoing links: who THIS law cites
  const { data: outgoingLinkRows } = await supabase
    .from('law_links')
    .select('target_law_id')
    .eq('source_law_id', id)

  const outgoingIds = (outgoingLinkRows ?? []).map((r) => r.target_law_id)

  const { data: outgoingLaws } = outgoingIds.length
    ? await supabase
        .from('laws')
        .select('id, statement, category, blue_pct, total_votes, established_at')
        .in('id', outgoingIds)
        .order('total_votes', { ascending: false })
    : { data: [] as InfluenceLaw[] }

  // 4. Downstream topics (same category, created AFTER the law was established)
  const { data: downstreamTopics } = law.category
    ? await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, created_at')
        .eq('category', law.category)
        .gt('created_at', law.established_at)
        .neq('id', law.topic_id ?? '')
        .order('total_votes', { ascending: false })
        .limit(20)
    : { data: [] as InfluenceTopic[] }

  // 5. Successor laws (same category, established AFTER this law)
  const { data: successorLaws } = law.category
    ? await supabase
        .from('laws')
        .select('id, statement, category, blue_pct, total_votes, established_at')
        .eq('category', law.category)
        .gt('established_at', law.established_at)
        .neq('id', id)
        .order('established_at', { ascending: true })
        .limit(15)
    : { data: [] as InfluenceLaw[] }

  const incoming = (incomingLaws as InfluenceLaw[] | null) ?? []
  const outgoing = (outgoingLaws as InfluenceLaw[] | null) ?? []
  const downstream = (downstreamTopics as InfluenceTopic[] | null) ?? []
  const successors = (successorLaws as InfluenceLaw[] | null) ?? []

  const daysSincePassage = Math.floor(
    (Date.now() - new Date(law.established_at).getTime()) / 86_400_000,
  )

  const influenceScore = computeInfluenceScore(
    incoming.length,
    outgoing.length,
    downstream.length,
    successors.length,
    law.total_votes ?? 0,
  )

  const payload: LawInfluenceData = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
    },
    incoming,
    outgoing,
    downstream,
    successorLaws: successors,
    influenceScore,
    tier: scoreTier(influenceScore),
    stats: {
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
      downstreamTopics: downstream.length,
      successorLaws: successors.length,
      daysSincePassage,
    },
  }

  return NextResponse.json(payload)
}
