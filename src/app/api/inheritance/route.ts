import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DescendantTopic {
  id: string
  statement: string
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
  /** Days after the parent law was established */
  days_after: number
  /** Whether this descendant itself became a law */
  became_law: boolean
  law_id?: string
}

export interface InheritanceLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string
  topic_id: string
  /** Topics created in the same category after this law was established */
  descendants: DescendantTopic[]
  /** Count of descendants that became laws themselves */
  law_descendants: number
  /** Score = law_descendants * 10 + total_descendants * 2 + sum of descendant votes / 50 */
  generativity_score: number
}

export interface InheritanceCategory {
  category: string
  law_count: number
  descendant_count: number
  law_chain_count: number
}

export interface InheritanceResponse {
  laws: InheritanceLaw[]
  categories: InheritanceCategory[]
  totals: {
    laws: number
    descendants: number
    law_chains: number
  }
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Max days after a law before a topic is no longer "directly inspired" */
const INHERITANCE_WINDOW_DAYS = 120

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category') || null
  const sort = (searchParams.get('sort') || 'generativity') as
    | 'generativity'
    | 'descendants'
    | 'law_chains'
    | 'recent'

  const supabase = await createClient()

  // ── 1. Fetch all active laws ───────────────────────────────────────────────
  const lawsQuery = supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('is_active', true)
    .order('established_at', { ascending: false })

  const { data: lawRows, error: lawsErr } = await lawsQuery
  if (lawsErr) {
    return NextResponse.json({ error: lawsErr.message }, { status: 500 })
  }

  const allLaws = lawRows ?? []
  const filteredLaws = category ? allLaws.filter((l) => l.category === category) : allLaws

  // ── 2. Fetch all topics with relevant fields ──────────────────────────────
  const { data: topicRows, error: topicsErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .not('status', 'in', '("proposed")')
    .order('created_at', { ascending: true })

  if (topicsErr) {
    return NextResponse.json({ error: topicsErr.message }, { status: 500 })
  }

  const allTopics = topicRows ?? []

  // Build a map of topic_id → law (for topics that became laws)
  const topicToLaw = new Map<string, string>()
  for (const law of allLaws) {
    if (law.topic_id) topicToLaw.set(law.topic_id, law.id)
  }

  // ── 3. For each law compute its inheritance ────────────────────────────────
  const results: InheritanceLaw[] = []

  for (const law of filteredLaws) {
    if (!law.category) continue

    const lawEstablished = new Date(law.established_at).getTime()
    const windowEnd = lawEstablished + INHERITANCE_WINDOW_DAYS * 24 * 60 * 60 * 1000

    // Find topics in same category created after this law (within window)
    // Exclude the topic that IS this law
    const descendants: DescendantTopic[] = allTopics
      .filter((t) => {
        if (t.id === law.topic_id) return false
        if (t.category !== law.category) return false
        const created = new Date(t.created_at).getTime()
        return created >= lawEstablished && created <= windowEnd
      })
      .map((t) => {
        const daysAfter = Math.floor(
          (new Date(t.created_at).getTime() - lawEstablished) / (1000 * 60 * 60 * 24)
        )
        const lawId = topicToLaw.get(t.id)
        return {
          id: t.id,
          statement: t.statement,
          status: t.status,
          blue_pct: t.blue_pct ?? 50,
          total_votes: t.total_votes ?? 0,
          created_at: t.created_at,
          days_after: daysAfter,
          became_law: !!lawId,
          law_id: lawId,
        }
      })
      .slice(0, 8) // Cap at 8 descendants shown

    const lawDescendants = descendants.filter((d) => d.became_law).length
    const totalVotes = descendants.reduce((sum, d) => sum + d.total_votes, 0)
    const generativityScore =
      lawDescendants * 10 + descendants.length * 2 + Math.floor(totalVotes / 50)

    results.push({
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct,
      total_votes: law.total_votes,
      established_at: law.established_at,
      topic_id: law.topic_id,
      descendants,
      law_descendants: lawDescendants,
      generativity_score: generativityScore,
    })
  }

  // ── 4. Sort ───────────────────────────────────────────────────────────────
  if (sort === 'generativity') {
    results.sort((a, b) => b.generativity_score - a.generativity_score)
  } else if (sort === 'descendants') {
    results.sort((a, b) => b.descendants.length - a.descendants.length)
  } else if (sort === 'law_chains') {
    results.sort((a, b) => b.law_descendants - a.law_descendants)
  } else {
    results.sort(
      (a, b) =>
        new Date(b.established_at).getTime() - new Date(a.established_at).getTime()
    )
  }

  // Only return laws that have at least one descendant (for interest)
  const fertile = results.filter((l) => l.descendants.length > 0).slice(0, 30)

  // ── 5. Category stats ─────────────────────────────────────────────────────
  const catMap = new Map<string, InheritanceCategory>()
  for (const l of results) {
    if (!l.category) continue
    const existing = catMap.get(l.category) ?? {
      category: l.category,
      law_count: 0,
      descendant_count: 0,
      law_chain_count: 0,
    }
    existing.law_count++
    existing.descendant_count += l.descendants.length
    existing.law_chain_count += l.law_descendants
    catMap.set(l.category, existing)
  }
  const categories = Array.from(catMap.values()).sort(
    (a, b) => b.descendant_count - a.descendant_count
  )

  const totals = {
    laws: filteredLaws.filter((l) => l.category).length,
    descendants: fertile.reduce((s, l) => s + l.descendants.length, 0),
    law_chains: fertile.reduce((s, l) => s + l.law_descendants, 0),
  }

  return NextResponse.json({
    laws: fertile,
    categories,
    totals,
    generated_at: new Date().toISOString(),
  } satisfies InheritanceResponse)
}
