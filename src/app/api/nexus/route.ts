import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TopicNode, TopicEdge } from '@/components/topic/TopicGraph'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NexusEdge extends TopicEdge {
  /** How this connection was established */
  type: 'wiki' | 'tag'
  /** Shared tag name (only for 'tag' type) */
  tag?: string
}

export interface NexusStats {
  topicCount: number
  wikiEdgeCount: number
  tagEdgeCount: number
  mostConnectedTopic: { id: string; statement: string; connections: number } | null
  topSharedTag: { tag: string; count: number } | null
}

export interface NexusResponse {
  nodes: TopicNode[]
  edges: NexusEdge[]
  stats: NexusStats
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Only consider tags that appear on at least 2 topics to be meaningful connectors
const MIN_TAG_TOPICS = 2
// Cap tag edges per tag to avoid one mega-popular tag dominating the graph
const MAX_EDGES_PER_TAG = 30

export async function GET() {
  const supabase = await createClient()

  // ── 1. Fetch topics ─────────────────────────────────────────────────────────
  const { data: rawTopics, error: topicsError } = await supabase
    .from('topics')
    .select('id, statement, category, status, total_votes, blue_pct, tags')
    .not('status', 'in', '(failed,archived,continued)')
    .order('feed_score', { ascending: false })
    .limit(120)

  if (topicsError || !rawTopics) {
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 })
  }

  const topicIds = rawTopics.map((t) => t.id)
  const topicMap = new Map(rawTopics.map((t) => [t.id, t]))

  // ── 2. Fetch wiki links (topic_links) ───────────────────────────────────────
  const { data: rawLinks } = await supabase
    .from('topic_links')
    .select('source_topic_id, target_topic_id')
    .in('source_topic_id', topicIds)
    .in('target_topic_id', topicIds)

  // ── 3. Build wiki edges ──────────────────────────────────────────────────────
  const wikiEdges: NexusEdge[] = []
  const seenWikiPairs = new Set<string>()

  for (const link of rawLinks ?? []) {
    const a = link.source_topic_id
    const b = link.target_topic_id
    if (!topicMap.has(a) || !topicMap.has(b)) continue
    const key = a < b ? `${a}::${b}` : `${b}::${a}`
    if (seenWikiPairs.has(key)) continue
    seenWikiPairs.add(key)
    wikiEdges.push({ source: a, target: b, weight: 2, type: 'wiki' })
  }

  // ── 4. Build tag-based edges ─────────────────────────────────────────────────
  // Build an inverted index: tag → [topicId, ...]
  const tagIndex = new Map<string, string[]>()
  for (const topic of rawTopics) {
    const tags: string[] = topic.tags ?? []
    for (const tag of tags) {
      if (!tag) continue
      const list = tagIndex.get(tag) ?? []
      list.push(topic.id)
      tagIndex.set(tag, list)
    }
  }

  const tagEdges: NexusEdge[] = []
  const seenTagPairs = new Set<string>()
  const tagFrequency = new Map<string, number>()

  for (const [tag, ids] of tagIndex.entries()) {
    if (ids.length < MIN_TAG_TOPICS) continue
    tagFrequency.set(tag, ids.length)

    // Create at most MAX_EDGES_PER_TAG edges for this tag
    // Pick the pairs among the most-voted topics
    const sorted = ids
      .map((id) => ({ id, votes: topicMap.get(id)?.total_votes ?? 0 }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 12) // cap per-tag participants to avoid O(n²) explosion

    let edgesForTag = 0
    for (let i = 0; i < sorted.length - 1 && edgesForTag < MAX_EDGES_PER_TAG; i++) {
      for (let j = i + 1; j < sorted.length && edgesForTag < MAX_EDGES_PER_TAG; j++) {
        const a = sorted[i].id
        const b = sorted[j].id
        const pairKey = a < b ? `${a}::${b}` : `${b}::${a}`
        if (seenTagPairs.has(pairKey) || seenWikiPairs.has(pairKey)) {
          edgesForTag++
          continue
        }
        seenTagPairs.add(pairKey)
        tagEdges.push({ source: a, target: b, weight: 1, type: 'tag', tag })
        edgesForTag++
      }
    }
  }

  // ── 5. Merge edges, cap total ─────────────────────────────────────────────
  // Prefer wiki edges, then fill with tag edges sorted by tag popularity
  const sortedTagEdges = tagEdges.sort((a, b) => {
    const fa = tagFrequency.get(a.tag ?? '') ?? 0
    const fb = tagFrequency.get(b.tag ?? '') ?? 0
    return fb - fa
  })

  // Cap total edges to keep graph performant
  const MAX_TOTAL_EDGES = 300
  const allEdges: NexusEdge[] = [
    ...wikiEdges,
    ...sortedTagEdges.slice(0, MAX_TOTAL_EDGES - wikiEdges.length),
  ]

  // ── 6. Compute stats ─────────────────────────────────────────────────────────
  const connectionCount = new Map<string, number>()
  for (const edge of allEdges) {
    connectionCount.set(edge.source, (connectionCount.get(edge.source) ?? 0) + 1)
    connectionCount.set(edge.target, (connectionCount.get(edge.target) ?? 0) + 1)
  }

  let mostConnected: NexusStats['mostConnectedTopic'] = null
  let maxConn = 0
  for (const [id, count] of connectionCount.entries()) {
    if (count > maxConn) {
      maxConn = count
      const t = topicMap.get(id)
      mostConnected = t ? { id, statement: t.statement, connections: count } : null
    }
  }

  let topSharedTag: NexusStats['topSharedTag'] = null
  let maxTagCount = 0
  for (const [tag, count] of tagFrequency.entries()) {
    if (count > maxTagCount) {
      maxTagCount = count
      topSharedTag = { tag, count }
    }
  }

  // ── 7. Build node list (only topics that have at least one edge) ─────────────
  const connectedIds = new Set<string>()
  for (const edge of allEdges) {
    connectedIds.add(edge.source)
    connectedIds.add(edge.target)
  }

  // Include all topics, but if graph is sparse include isolated nodes too
  const nodes: TopicNode[] = rawTopics.map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    status: t.status,
    total_votes: t.total_votes ?? 0,
    blue_pct: t.blue_pct ?? 50,
  }))

  const stats: NexusStats = {
    topicCount: nodes.length,
    wikiEdgeCount: wikiEdges.length,
    tagEdgeCount: Math.min(sortedTagEdges.length, MAX_TOTAL_EDGES - wikiEdges.length),
    mostConnectedTopic: mostConnected,
    topSharedTag,
  }

  return NextResponse.json({ nodes, edges: allEdges, stats } satisfies NexusResponse)
}
