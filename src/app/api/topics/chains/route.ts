import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ChainTopicNode {
  id: string
  statement: string
  connector: string | null
  chain_depth: number
  status: string
  blue_pct: number
  total_votes: number
  category: string | null
  scope: string | null
  created_at: string
}

export interface TopicChain {
  root: ChainTopicNode
  nodes: ChainTopicNode[]   // ordered by chain_depth, root excluded
  depth: number             // max chain_depth in this chain
  total_votes: number       // sum of votes across all nodes
  latest_status: string     // status of the leaf node
  category: string | null
}

export interface TopicChainsResponse {
  chains: TopicChain[]
  total: number
}

const VALID_SORTS = ['votes', 'depth', 'recent'] as const
const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

/**
 * GET /api/topics/chains
 *
 * Returns topic chains — lineages of continuation topics that evolved from a root.
 *
 * Query params:
 *   sort     — 'votes' | 'depth' | 'recent'   (default: 'votes')
 *   category — filter to a specific category   (default: all)
 *   limit    — 1..50                           (default: 20)
 *   offset   — ≥0                              (default: 0)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const rawSort = searchParams.get('sort') ?? 'votes'
  const sort = (VALID_SORTS as readonly string[]).includes(rawSort)
    ? (rawSort as (typeof VALID_SORTS)[number])
    : 'votes'

  const rawCategory = searchParams.get('category') ?? ''
  const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : ''

  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

  const supabase = await createClient()

  // Step 1: Fetch all topics that are part of any chain (chain_depth > 0).
  // Then also fetch root topics (chain_depth = 0) that appear as parent_id.
  const { data: continuationRows, error: contErr } = await supabase
    .from('topics')
    .select('id, statement, connector, chain_depth, status, blue_pct, total_votes, category, scope, created_at, parent_id')
    .gt('chain_depth', 0)
    .order('chain_depth', { ascending: true })

  if (contErr) {
    console.error('[chains GET] continuations:', contErr)
    return NextResponse.json({ error: 'Failed to fetch chains' }, { status: 500 })
  }

  const continuations = continuationRows ?? []

  if (continuations.length === 0) {
    return NextResponse.json({ chains: [], total: 0 } satisfies TopicChainsResponse)
  }

  // Collect all unique root IDs (walk up to find chain roots via parent_id recursion
  // is expensive; instead, we fetch depth-0 ancestors by collecting all parent_ids
  // from depth-1 nodes).
  const depth1 = continuations.filter((t) => t.chain_depth === 1)
  const rootIds = Array.from(new Set(depth1.map((t) => t.parent_id).filter(Boolean) as string[]))

  if (rootIds.length === 0) {
    return NextResponse.json({ chains: [], total: 0 } satisfies TopicChainsResponse)
  }

  let rootQuery = supabase
    .from('topics')
    .select('id, statement, connector, chain_depth, status, blue_pct, total_votes, category, scope, created_at')
    .in('id', rootIds)

  if (category) rootQuery = rootQuery.eq('category', category)

  const { data: rootRows } = await rootQuery
  const rootMap = new Map((rootRows ?? []).map((r) => [r.id, r]))

  // Build chains: group continuation nodes by their root
  const chainMap = new Map<string, ChainTopicNode[]>()

  for (const rootId of rootIds) {
    if (!rootMap.has(rootId)) continue
    chainMap.set(rootId, [])
  }

  for (const node of continuations) {
    // Walk up to root by depth-1 ancestor's parent_id
    let rootId: string | null = null
    if (node.chain_depth === 1) {
      rootId = node.parent_id
    } else {
      // Find the depth-1 ancestor — for deeper nodes we need to trace up.
      // Optimisation: since we have all continuation nodes, build a parentMap.
      rootId = node.parent_id
      // For chain_depth > 1, the root is found by following parent_id links.
      // We already built continuations, so find its depth-0 ancestor.
      let cursor = node
      for (let i = 0; i < 8; i++) {
        const parent = continuations.find((t) => t.id === cursor.parent_id)
        if (!parent) {
          // cursor.parent_id is the root (depth 0)
          rootId = cursor.parent_id
          break
        }
        cursor = parent
      }
    }

    if (!rootId || !chainMap.has(rootId)) continue
    chainMap.get(rootId)!.push({
      id: node.id,
      statement: node.statement,
      connector: node.connector,
      chain_depth: node.chain_depth,
      status: node.status,
      blue_pct: node.blue_pct,
      total_votes: node.total_votes,
      category: node.category,
      scope: node.scope,
      created_at: node.created_at,
    })
  }

  // Assemble TopicChain objects
  const chains: TopicChain[] = []

  for (const [rootId, nodes] of Array.from(chainMap.entries())) {
    const root = rootMap.get(rootId)
    if (!root) continue

    const allNodes = [
      {
        id: root.id,
        statement: root.statement,
        connector: root.connector,
        chain_depth: root.chain_depth,
        status: root.status,
        blue_pct: root.blue_pct,
        total_votes: root.total_votes,
        category: root.category,
        scope: root.scope,
        created_at: root.created_at,
      },
      ...nodes,
    ]

    const sortedNodes = nodes.sort((a, b) => a.chain_depth - b.chain_depth)
    const leaf = sortedNodes[sortedNodes.length - 1] ?? allNodes[0]
    const maxDepth = Math.max(root.chain_depth, ...nodes.map((n) => n.chain_depth))
    const totalVotes = allNodes.reduce((s, n) => s + (n.total_votes ?? 0), 0)

    chains.push({
      root: {
        id: root.id,
        statement: root.statement,
        connector: root.connector,
        chain_depth: root.chain_depth,
        status: root.status,
        blue_pct: root.blue_pct,
        total_votes: root.total_votes,
        category: root.category,
        scope: root.scope,
        created_at: root.created_at,
      },
      nodes: sortedNodes,
      depth: maxDepth,
      total_votes: totalVotes,
      latest_status: leaf.status,
      category: root.category,
    })
  }

  // Sort
  if (sort === 'votes') {
    chains.sort((a, b) => b.total_votes - a.total_votes)
  } else if (sort === 'depth') {
    chains.sort((a, b) => b.depth - a.depth || b.total_votes - a.total_votes)
  } else {
    // recent: sort by the root's created_at descending
    chains.sort((a, b) =>
      new Date(b.root.created_at).getTime() - new Date(a.root.created_at).getTime()
    )
  }

  const total = chains.length
  const paginated = chains.slice(offset, offset + limit)

  return NextResponse.json({ chains: paginated, total } satisfies TopicChainsResponse)
}
