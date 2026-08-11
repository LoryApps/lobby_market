import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImpactLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string | null
  endorsement_count: number
  argument_count: number
  debate_count: number
  verdict_count: number
}

export interface CategoryImpact {
  category: string
  law_count: number
  total_votes: number
  avg_blue_pct: number
  total_endorsements: number
}

export interface LawImpactResponse {
  summary: {
    total_laws: number
    total_votes: number
    total_endorsements: number
    avg_blue_pct: number
    most_voted_law: ImpactLaw | null
    most_endorsed_law: ImpactLaw | null
    newest_law: ImpactLaw | null
    most_debated_law: ImpactLaw | null
  }
  categories: CategoryImpact[]
  top_by_votes: ImpactLaw[]
  top_by_endorsements: ImpactLaw[]
  top_by_arguments: ImpactLaw[]
  recent: ImpactLaw[]
}

// ─── GET /api/laws/impact ─────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  // Fetch all laws with basic fields
  const { data: laws, error } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at')
    .order('total_votes', { ascending: false })

  if (error || !laws) {
    return NextResponse.json({ error: 'Failed to load laws' }, { status: 500 })
  }

  if (laws.length === 0) {
    const empty: LawImpactResponse = {
      summary: {
        total_laws: 0,
        total_votes: 0,
        total_endorsements: 0,
        avg_blue_pct: 0,
        most_voted_law: null,
        most_endorsed_law: null,
        newest_law: null,
        most_debated_law: null,
      },
      categories: [],
      top_by_votes: [],
      top_by_endorsements: [],
      top_by_arguments: [],
      recent: [],
    }
    return NextResponse.json(empty)
  }

  const lawIds = laws.map((l) => l.id)

  // Fetch endorsement counts per law
  const { data: endorsementRows } = await supabase
    .from('law_endorsements')
    .select('law_id')
    .in('law_id', lawIds)

  const endorsementMap: Record<string, number> = {}
  for (const row of endorsementRows ?? []) {
    endorsementMap[row.law_id] = (endorsementMap[row.law_id] ?? 0) + 1
  }

  // Fetch argument counts per topic (laws link to topics)
  const { data: topicLawRows } = await supabase
    .from('laws')
    .select('id, topic_id')
    .in('id', lawIds)

  const topicToLaw: Record<string, string> = {}
  for (const r of topicLawRows ?? []) {
    if (r.topic_id) topicToLaw[r.topic_id] = r.id
  }
  const topicIds = Object.keys(topicToLaw)

  const { data: argRows } = topicIds.length > 0
    ? await supabase
        .from('arguments')
        .select('topic_id')
        .in('topic_id', topicIds)
    : { data: [] }

  const argMap: Record<string, number> = {}
  for (const r of argRows ?? []) {
    const lawId = topicToLaw[r.topic_id]
    if (lawId) argMap[lawId] = (argMap[lawId] ?? 0) + 1
  }

  // Fetch debate counts per topic
  const { data: debateRows } = topicIds.length > 0
    ? await supabase
        .from('debates')
        .select('topic_id')
        .in('topic_id', topicIds)
    : { data: [] }

  const debateMap: Record<string, number> = {}
  for (const r of debateRows ?? []) {
    const lawId = topicToLaw[r.topic_id]
    if (lawId) debateMap[lawId] = (debateMap[lawId] ?? 0) + 1
  }

  // Fetch verdict counts
  const { data: verdictRows } = await supabase
    .from('law_verdicts')
    .select('law_id')
    .in('law_id', lawIds)

  const verdictMap: Record<string, number> = {}
  for (const r of verdictRows ?? []) {
    verdictMap[r.law_id] = (verdictMap[r.law_id] ?? 0) + 1
  }

  // Assemble enriched law objects
  const enriched: ImpactLaw[] = laws.map((l) => ({
    id: l.id,
    statement: l.statement,
    category: l.category ?? null,
    blue_pct: l.blue_pct ?? 50,
    total_votes: l.total_votes ?? 0,
    established_at: l.established_at ?? null,
    endorsement_count: endorsementMap[l.id] ?? 0,
    argument_count: argMap[l.id] ?? 0,
    debate_count: debateMap[l.id] ?? 0,
    verdict_count: verdictMap[l.id] ?? 0,
  }))

  // Summary stats
  const totalVotes = enriched.reduce((s, l) => s + l.total_votes, 0)
  const totalEndorsements = enriched.reduce((s, l) => s + l.endorsement_count, 0)
  const avgBluePct = enriched.length > 0
    ? Math.round(enriched.reduce((s, l) => s + l.blue_pct, 0) / enriched.length)
    : 0

  const mostVoted = [...enriched].sort((a, b) => b.total_votes - a.total_votes)[0] ?? null
  const mostEndorsed = [...enriched].sort((a, b) => b.endorsement_count - a.endorsement_count)[0] ?? null
  const mostDebated = [...enriched].sort((a, b) => b.debate_count - a.debate_count)[0] ?? null
  const newest = [...enriched]
    .filter((l) => l.established_at)
    .sort((a, b) => new Date(b.established_at!).getTime() - new Date(a.established_at!).getTime())[0] ?? null

  // Category breakdown
  const catMap: Record<string, { laws: ImpactLaw[] }> = {}
  for (const l of enriched) {
    const cat = l.category ?? 'Uncategorized'
    if (!catMap[cat]) catMap[cat] = { laws: [] }
    catMap[cat].laws.push(l)
  }

  const categories: CategoryImpact[] = Object.entries(catMap)
    .map(([category, { laws: catLaws }]) => ({
      category,
      law_count: catLaws.length,
      total_votes: catLaws.reduce((s, l) => s + l.total_votes, 0),
      avg_blue_pct: Math.round(catLaws.reduce((s, l) => s + l.blue_pct, 0) / catLaws.length),
      total_endorsements: catLaws.reduce((s, l) => s + l.endorsement_count, 0),
    }))
    .sort((a, b) => b.total_votes - a.total_votes)

  const response: LawImpactResponse = {
    summary: {
      total_laws: enriched.length,
      total_votes: totalVotes,
      total_endorsements: totalEndorsements,
      avg_blue_pct: avgBluePct,
      most_voted_law: mostVoted,
      most_endorsed_law: mostEndorsed,
      newest_law: newest,
      most_debated_law: mostDebated,
    },
    categories,
    top_by_votes: enriched.slice(0, 20),
    top_by_endorsements: [...enriched].sort((a, b) => b.endorsement_count - a.endorsement_count).slice(0, 20),
    top_by_arguments: [...enriched].sort((a, b) => b.argument_count - a.argument_count).slice(0, 20),
    recent: newest ? [...enriched]
      .filter((l) => l.established_at)
      .sort((a, b) => new Date(b.established_at!).getTime() - new Date(a.established_at!).getTime())
      .slice(0, 20) : [],
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
