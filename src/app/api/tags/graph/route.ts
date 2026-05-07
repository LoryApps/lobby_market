import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TagGraphNode {
  tag: string
  topic_count: number
  law_count: number
  active_count: number
  total_votes: number
}

export interface TagGraphEdge {
  source: string
  target: string
  weight: number  // number of topics sharing both tags
}

export interface TagGraphResponse {
  nodes: TagGraphNode[]
  edges: TagGraphEdge[]
  topicCount: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select('tags, status, total_votes')
    .not('tags', 'eq', '{}')
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .limit(1500)

  if (error) {
    return NextResponse.json(
      { nodes: [], edges: [], topicCount: 0 } satisfies TagGraphResponse,
    )
  }

  const rows = data ?? []

  // ── 1. Build node stats ───────────────────────────────────────────────────

  const nodeMap = new Map<string, TagGraphNode>()

  for (const row of rows) {
    const tags: string[] = row.tags ?? []
    for (const tag of tags) {
      if (!tag) continue
      const n = nodeMap.get(tag) ?? {
        tag,
        topic_count: 0,
        law_count: 0,
        active_count: 0,
        total_votes: 0,
      }
      n.topic_count++
      n.total_votes += row.total_votes ?? 0
      if (row.status === 'law') n.law_count++
      if (row.status === 'active' || row.status === 'voting') n.active_count++
      nodeMap.set(tag, n)
    }
  }

  // Keep only tags appearing on 2+ topics to avoid a hairball
  const MIN_TOPICS = 2
  const nodes = Array.from(nodeMap.values())
    .filter((n) => n.topic_count >= MIN_TOPICS)
    .sort((a, b) => b.topic_count - a.topic_count)
    .slice(0, 80) // cap at 80 nodes for performance

  const nodeSet = new Set(nodes.map((n) => n.tag))

  // ── 2. Build co-occurrence edges ──────────────────────────────────────────

  const edgeMap = new Map<string, number>()

  for (const row of rows) {
    const tags: string[] = (row.tags ?? []).filter((t: string) => nodeSet.has(t))
    // Every pair of tags on the same topic gets an edge
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = tags[i] < tags[j] ? `${tags[i]}|${tags[j]}` : `${tags[j]}|${tags[i]}`
        edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1)
      }
    }
  }

  // Only include edges where at least 2 topics share both tags
  const MIN_EDGE_WEIGHT = 2
  const edges: TagGraphEdge[] = Array.from(edgeMap.entries())
    .filter(([, w]) => w >= MIN_EDGE_WEIGHT)
    .map(([key, weight]) => {
      const [source, target] = key.split('|')
      return { source, target, weight }
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 200) // cap edges

  return NextResponse.json({
    nodes,
    edges,
    topicCount: rows.length,
  } satisfies TagGraphResponse)
}
