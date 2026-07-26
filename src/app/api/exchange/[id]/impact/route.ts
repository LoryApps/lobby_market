import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImpactTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string | null
  link_type: 'incoming' | 'outgoing' | 'related'
}

export interface PrecedentLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number
  established_at: string | null
  blue_pct_at_law: number
}

export interface ImpactStats {
  affected_topics: number
  affected_categories: string[]
  laws_as_precedent: number
  total_affected_votes: number
  scope_breakdown: Record<string, number>
  impact_score: number   // 0–100, computed from breadth + depth
  impact_label: 'Narrow' | 'Moderate' | 'Broad' | 'Systemic'
}

export interface ImpactData {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  total_votes: number
  scope: string | null

  incoming_links: ImpactTopic[]   // topics whose wikis link TO this topic
  outgoing_links: ImpactTopic[]   // topics that THIS topic's wiki links to
  related_topics: ImpactTopic[]   // same-category active/voting topics
  precedent_laws: PrecedentLaw[]  // established laws in same category

  stats: ImpactStats
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { id } = params

  // 1. Fetch the target topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // 2. Incoming links — topics whose wiki descriptions link TO this topic
  const { data: incomingRaw } = await supabase
    .from('topic_links')
    .select(`
      source_topic:source_topic_id (
        id, statement, category, status, blue_pct, total_votes, scope
      )
    `)
    .eq('target_topic_id', id)
    .limit(20)

  const incoming: ImpactTopic[] = (incomingRaw ?? [])
    .map((r) => {
      const t = r.source_topic as { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number; scope: string | null } | null
      if (!t) return null
      return { ...t, link_type: 'incoming' as const }
    })
    .filter((t): t is ImpactTopic => t !== null)

  // 3. Outgoing links — topics this topic's wiki links TO
  const { data: outgoingRaw } = await supabase
    .from('topic_links')
    .select(`
      target_topic:target_topic_id (
        id, statement, category, status, blue_pct, total_votes, scope
      )
    `)
    .eq('source_topic_id', id)
    .limit(20)

  const outgoing: ImpactTopic[] = (outgoingRaw ?? [])
    .map((r) => {
      const t = r.target_topic as { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number; scope: string | null } | null
      if (!t) return null
      return { ...t, link_type: 'outgoing' as const }
    })
    .filter((t): t is ImpactTopic => t !== null)

  // 4. Related topics by category (active or voting, not this topic)
  let related: ImpactTopic[] = []
  if (topic.category) {
    const { data: relatedRaw } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, scope')
      .eq('category', topic.category)
      .in('status', ['active', 'voting'])
      .neq('id', id)
      .order('total_votes', { ascending: false })
      .limit(10)

    related = (relatedRaw ?? []).map((t) => ({ ...t, link_type: 'related' as const }))
  }

  // 5. Precedent laws — established laws in the same category
  let precedent: PrecedentLaw[] = []
  if (topic.category) {
    const { data: lawsRaw } = await supabase
      .from('topics')
      .select('id, statement, category, total_votes, created_at, blue_pct')
      .eq('category', topic.category)
      .eq('status', 'law')
      .order('total_votes', { ascending: false })
      .limit(8)

    precedent = (lawsRaw ?? []).map((l) => ({
      id: l.id,
      statement: l.statement,
      category: l.category,
      total_votes: l.total_votes ?? 0,
      established_at: l.created_at,
      blue_pct_at_law: l.blue_pct ?? 0,
    }))
  }

  // 6. Compute impact stats
  const allAffected = [
    ...incoming,
    ...outgoing,
    ...related,
  ]
  // Deduplicate by id
  const seenIds = new Set<string>()
  const uniqueAffected = allAffected.filter((t) => {
    if (seenIds.has(t.id)) return false
    seenIds.add(t.id)
    return true
  })

  const affectedCategories = [...new Set(uniqueAffected.map((t) => t.category).filter((c): c is string => c !== null))]
  const totalAffectedVotes = uniqueAffected.reduce((acc, t) => acc + (t.total_votes ?? 0), 0)

  const scopeBreakdown: Record<string, number> = {}
  for (const t of uniqueAffected) {
    const s = t.scope ?? 'Global'
    scopeBreakdown[s] = (scopeBreakdown[s] ?? 0) + 1
  }

  // Impact score: 0–100 based on breadth (unique topics), reach (votes), and precedent
  const breadthScore = Math.min(40, uniqueAffected.length * 3)
  const reachScore = Math.min(35, Math.log10(Math.max(totalAffectedVotes, 1) + 1) * 7)
  const precedentScore = Math.min(25, precedent.length * 4)
  const impactScore = Math.round(breadthScore + reachScore + precedentScore)

  const impactLabel: ImpactStats['impact_label'] =
    impactScore >= 70 ? 'Systemic' :
    impactScore >= 45 ? 'Broad' :
    impactScore >= 20 ? 'Moderate' :
    'Narrow'

  const stats: ImpactStats = {
    affected_topics: uniqueAffected.length,
    affected_categories: affectedCategories,
    laws_as_precedent: precedent.length,
    total_affected_votes: totalAffectedVotes,
    scope_breakdown: scopeBreakdown,
    impact_score: impactScore,
    impact_label: impactLabel,
  }

  const result: ImpactData = {
    id: topic.id,
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    price: topic.blue_pct ?? 50,
    total_votes: topic.total_votes ?? 0,
    scope: topic.scope,
    incoming_links: incoming,
    outgoing_links: outgoing,
    related_topics: related,
    precedent_laws: precedent,
    stats,
  }

  return NextResponse.json(result)
}
