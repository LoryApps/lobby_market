import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatalystTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
  inbound_links: number
  outbound_links: number
  argument_count: number
  catalyst_score: number
  rank: number
  citing_topics: Array<{
    id: string
    statement: string
    category: string | null
    status: string
  }>
}

export interface CatalystStats {
  topics_analyzed: number
  total_links: number
  total_catalysts: number
  most_catalytic_category: string | null
  category_breakdown: Array<{
    category: string
    count: number
    avg_inbound: number
  }>
}

export interface CatalystResponse {
  catalysts: CatalystTopic[]
  stats: CatalystStats
  updated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') ?? '30', 10)))
  const category = searchParams.get('category') ?? null
  const minLinks = parseInt(searchParams.get('min_links') ?? '1', 10)

  const supabase = await createClient()

  // ── Fetch all topic links ─────────────────────────────────────────────────
  const { data: allLinks, error: linksErr } = await supabase
    .from('topic_links')
    .select('source_topic_id, target_topic_id')

  if (linksErr) {
    return NextResponse.json({ error: 'Failed to load links' }, { status: 500 })
  }

  const links = allLinks ?? []

  // Count inbound links per target topic
  const inboundMap = new Map<string, Set<string>>()
  const outboundMap = new Map<string, number>()

  for (const link of links) {
    if (!inboundMap.has(link.target_topic_id)) {
      inboundMap.set(link.target_topic_id, new Set())
    }
    inboundMap.get(link.target_topic_id)!.add(link.source_topic_id)

    outboundMap.set(link.source_topic_id, (outboundMap.get(link.source_topic_id) ?? 0) + 1)
  }

  // Get unique target topic IDs that meet minimum threshold
  const eligibleTargets = Array.from(inboundMap.entries())
    .filter(([, sources]) => sources.size >= minLinks)
    .map(([id]) => id)

  if (eligibleTargets.length === 0) {
    return NextResponse.json({
      catalysts: [],
      stats: {
        topics_analyzed: 0,
        total_links: links.length,
        total_catalysts: 0,
        most_catalytic_category: null,
        category_breakdown: [],
      },
      updated_at: new Date().toISOString(),
    } satisfies CatalystResponse)
  }

  // ── Fetch catalyst topic details ──────────────────────────────────────────
  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, view_count, created_at')
    .in('id', eligibleTargets)
    .in('status', ['active', 'voting', 'proposed', 'law'])

  if (category) {
    topicsQuery = topicsQuery.eq('category', category)
  }

  const { data: topicsRaw, error: topicsErr } = await topicsQuery.limit(500)

  if (topicsErr) {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 })
  }

  const topics = topicsRaw ?? []

  // ── Fetch argument counts per topic ───────────────────────────────────────
  const topicIds = topics.map((t) => t.id)
  const { data: argCounts } = await supabase
    .from('arguments')
    .select('topic_id')
    .in('topic_id', topicIds)

  const argCountMap = new Map<string, number>()
  for (const a of argCounts ?? []) {
    argCountMap.set(a.topic_id, (argCountMap.get(a.topic_id) ?? 0) + 1)
  }

  // ── Fetch citing topic details for each catalyst ──────────────────────────
  const allSourceIds = new Set<string>()
  for (const topicId of topicIds) {
    const sources = inboundMap.get(topicId)
    if (sources) {
      for (const sid of sources) allSourceIds.add(sid)
    }
  }

  const { data: sourceTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .in('id', Array.from(allSourceIds))
    .limit(300)

  const sourceMap = new Map((sourceTopics ?? []).map((t) => [t.id, t]))

  // ── Compute catalyst score ────────────────────────────────────────────────
  // catalyst_score = inbound_links (primary) + log(votes+1) * 0.3 + log(views+1) * 0.1
  const scored = topics.map((t) => {
    const inbound = inboundMap.get(t.id)?.size ?? 0
    const outbound = outboundMap.get(t.id) ?? 0
    const args = argCountMap.get(t.id) ?? 0
    const votes = t.total_votes ?? 0
    const views = t.view_count ?? 0

    const score = inbound * 10 + Math.log(votes + 1) * 0.3 + Math.log(views + 1) * 0.1 + args * 0.5

    const sources = inboundMap.get(t.id) ?? new Set<string>()
    const citing = Array.from(sources)
      .map((sid) => sourceMap.get(sid))
      .filter(Boolean)
      .slice(0, 5) as Array<{ id: string; statement: string; category: string | null; status: string }>

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      scope: t.scope,
      blue_pct: t.blue_pct ?? 50,
      total_votes: votes,
      view_count: views,
      created_at: t.created_at,
      inbound_links: inbound,
      outbound_links: outbound,
      argument_count: args,
      catalyst_score: Math.round(score * 100) / 100,
      rank: 0,
      citing_topics: citing,
    }
  })

  // Sort and rank
  scored.sort((a, b) => b.catalyst_score - a.catalyst_score)
  const topN = scored.slice(0, limit).map((t, i) => ({ ...t, rank: i + 1 }))

  // ── Stats ─────────────────────────────────────────────────────────────────
  const catMap = new Map<string, { count: number; totalInbound: number }>()
  for (const t of scored) {
    const cat = t.category ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, { count: 0, totalInbound: 0 })
    const c = catMap.get(cat)!
    c.count++
    c.totalInbound += t.inbound_links
  }

  const categoryBreakdown = Array.from(catMap.entries())
    .map(([cat, { count, totalInbound }]) => ({
      category: cat,
      count,
      avg_inbound: Math.round((totalInbound / count) * 10) / 10,
    }))
    .sort((a, b) => b.count - a.count)

  const mostCatalyticCategory = categoryBreakdown[0]?.category ?? null

  return NextResponse.json({
    catalysts: topN,
    stats: {
      topics_analyzed: topics.length,
      total_links: links.length,
      total_catalysts: scored.length,
      most_catalytic_category: mostCatalyticCategory,
      category_breakdown: categoryBreakdown,
    },
    updated_at: new Date().toISOString(),
  } satisfies CatalystResponse)
}
