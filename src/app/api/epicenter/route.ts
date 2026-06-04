import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EpicenterTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
  in_links: number
  out_links: number
  total_links: number
  argument_count: number
  epicenter_score: number
  rank: number
}

export interface EpicenterStats {
  topics_analyzed: number
  total_links: number
  total_arguments: number
  most_connected_category: string | null
  category_breakdown: Array<{
    category: string
    count: number
    avg_score: number
    avg_links: number
  }>
}

export interface EpicenterResponse {
  epicenters: EpicenterTopic[]
  stats: EpicenterStats
  updated_at: string
}

// ─── Normalise a value to 0–1 given the min and max of the set ───────────────

function normalise(value: number, min: number, max: number): number {
  if (max === min) return 0
  return (value - min) / (max - min)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch all non-failed topics with vote activity
  const { data: topicsRaw, error: topicsErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, view_count, created_at')
    .in('status', ['active', 'voting', 'proposed', 'law'])
    .gte('total_votes', 1)
    .order('total_votes', { ascending: false })
    .limit(500)

  if (topicsErr) {
    return NextResponse.json({ error: topicsErr.message }, { status: 500 })
  }

  const topics = topicsRaw ?? []
  if (topics.length === 0) {
    return NextResponse.json({
      epicenters: [],
      stats: {
        topics_analyzed: 0,
        total_links: 0,
        total_arguments: 0,
        most_connected_category: null,
        category_breakdown: [],
      },
      updated_at: new Date().toISOString(),
    } satisfies EpicenterResponse)
  }

  const topicIds = topics.map((t) => t.id)

  // ── Fetch link counts ──────────────────────────────────────────────────────

  // Incoming links (this topic is the *target* of a wiki link)
  const { data: inLinksRaw } = await supabase
    .from('topic_links')
    .select('target_topic_id')
    .in('target_topic_id', topicIds)

  // Outgoing links (this topic *references* another via [[wikilink]])
  const { data: outLinksRaw } = await supabase
    .from('topic_links')
    .select('source_topic_id')
    .in('source_topic_id', topicIds)

  const inLinkMap: Record<string, number> = {}
  const outLinkMap: Record<string, number> = {}

  for (const row of inLinksRaw ?? []) {
    inLinkMap[row.target_topic_id] = (inLinkMap[row.target_topic_id] ?? 0) + 1
  }
  for (const row of outLinksRaw ?? []) {
    outLinkMap[row.source_topic_id] = (outLinkMap[row.source_topic_id] ?? 0) + 1
  }

  // ── Fetch argument counts ──────────────────────────────────────────────────

  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('topic_id')
    .in('topic_id', topicIds)

  const argCountMap: Record<string, number> = {}
  for (const row of argsRaw ?? []) {
    argCountMap[row.topic_id] = (argCountMap[row.topic_id] ?? 0) + 1
  }

  // ── Assemble raw metrics ───────────────────────────────────────────────────

  interface RawMetric {
    id: string
    statement: string
    category: string | null
    status: string
    scope: string | null
    blue_pct: number
    total_votes: number
    view_count: number
    created_at: string
    in_links: number
    out_links: number
    total_links: number
    argument_count: number
  }

  const raw: RawMetric[] = topics.map((t) => ({
    id:             t.id,
    statement:      t.statement,
    category:       t.category,
    status:         t.status,
    scope:          t.scope,
    blue_pct:       t.blue_pct,
    total_votes:    t.total_votes,
    view_count:     t.view_count ?? 0,
    created_at:     t.created_at,
    in_links:       inLinkMap[t.id]  ?? 0,
    out_links:      outLinkMap[t.id] ?? 0,
    total_links:    (inLinkMap[t.id] ?? 0) + (outLinkMap[t.id] ?? 0),
    argument_count: argCountMap[t.id] ?? 0,
  }))

  // ── Normalise and score ────────────────────────────────────────────────────

  const minLinks = Math.min(...raw.map((r) => r.total_links))
  const maxLinks = Math.max(...raw.map((r) => r.total_links))
  const minArgs  = Math.min(...raw.map((r) => r.argument_count))
  const maxArgs  = Math.max(...raw.map((r) => r.argument_count))
  const minVotes = Math.min(...raw.map((r) => r.total_votes))
  const maxVotes = Math.max(...raw.map((r) => r.total_votes))
  const minViews = Math.min(...raw.map((r) => r.view_count))
  const maxViews = Math.max(...raw.map((r) => r.view_count))

  const scored = raw
    .map((r) => ({
      ...r,
      epicenter_score:
        0.40 * normalise(r.total_links,   minLinks, maxLinks) +
        0.30 * normalise(r.argument_count, minArgs, maxArgs)  +
        0.20 * normalise(r.total_votes,   minVotes, maxVotes) +
        0.10 * normalise(r.view_count,    minViews, maxViews),
    }))
    .sort((a, b) => b.epicenter_score - a.epicenter_score)
    .slice(0, 25)
    .map((r, i) => ({ ...r, rank: i + 1 }))

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalLinks = (inLinksRaw?.length ?? 0) + (outLinksRaw?.length ?? 0)
  const totalArgs  = argsRaw?.length ?? 0

  // Category breakdown for the top 25
  const catMap: Record<string, { count: number; scoreSum: number; linkSum: number }> = {}
  for (const t of scored) {
    const cat = t.category ?? 'Uncategorised'
    if (!catMap[cat]) catMap[cat] = { count: 0, scoreSum: 0, linkSum: 0 }
    catMap[cat].count++
    catMap[cat].scoreSum += t.epicenter_score
    catMap[cat].linkSum  += t.total_links
  }

  const categoryBreakdown = Object.entries(catMap)
    .map(([category, v]) => ({
      category,
      count:     v.count,
      avg_score: v.count > 0 ? v.scoreSum / v.count : 0,
      avg_links: v.count > 0 ? v.linkSum  / v.count : 0,
    }))
    .sort((a, b) => b.count - a.count)

  const mostConnectedCategory = categoryBreakdown[0]?.category ?? null

  return NextResponse.json({
    epicenters: scored,
    stats: {
      topics_analyzed: raw.length,
      total_links:     totalLinks,
      total_arguments: totalArgs,
      most_connected_category: mostConnectedCategory,
      category_breakdown: categoryBreakdown,
    },
    updated_at: new Date().toISOString(),
  } satisfies EpicenterResponse)
}
