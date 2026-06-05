import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WellspringChild {
  id: string
  statement: string
  status: string
  blue_pct: number
  total_votes: number
  chain_depth: number
  /** Number of this child's own children (grandchildren of the root) */
  grandchildren: number
}

export interface WellspringTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  chain_depth: number
  created_at: string
  /** Direct children spawned from this topic */
  direct_children: number
  /** Total descendants (children + grandchildren + ...) */
  total_descendants: number
  /** Children that themselves became laws */
  law_descendants: number
  /** Generative power score: direct × 3 + total_descendants + log10(votes+1)×5 */
  wellspring_score: number
  /** The 3 most-voted direct children */
  top_children: WellspringChild[]
  /** Maximum chain depth reached from this topic */
  max_depth: number
}

export interface WellspringResponse {
  topics: WellspringTopic[]
  total_analyzed: number
  total_with_chains: number
  generated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MIN_VOTES = 3
const MAX_RESULTS = 30

function wellspringScore(direct: number, total: number, votes: number): number {
  const volumeBonus = Math.log10(Math.max(votes, 1)) * 5
  return Math.round((direct * 3 + total + volumeBonus) * 10) / 10
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  const supabase = await createClient()

  // 1. Fetch all topics with their parent relationships
  const { data: allTopics, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, chain_depth, parent_id, created_at')
    .gte('total_votes', MIN_VOTES)

  if (error || !allTopics) {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 })
  }

  // 2. Build a parent-to-children map
  const childrenMap = new Map<string, string[]>()
  for (const t of allTopics) {
    if (t.parent_id) {
      if (!childrenMap.has(t.parent_id)) childrenMap.set(t.parent_id, [])
      childrenMap.get(t.parent_id)!.push(t.id)
    }
  }

  const topicById = new Map(allTopics.map((t) => [t.id, t]))

  // 3. For each topic, compute total descendants recursively (BFS)
  function countDescendants(id: string): { total: number; laws: number; maxDepth: number } {
    const queue: { id: string; depth: number }[] = [{ id, depth: 0 }]
    let total = 0
    let laws = 0
    let maxDepth = 0
    const visited = new Set<string>()

    while (queue.length > 0) {
      const { id: current, depth } = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)

      const children = childrenMap.get(current) ?? []
      for (const childId of children) {
        const child = topicById.get(childId)
        if (!child) continue
        total++
        if (child.status === 'law') laws++
        if (depth + 1 > maxDepth) maxDepth = depth + 1
        queue.push({ id: childId, depth: depth + 1 })
      }
    }
    return { total, laws, maxDepth }
  }

  // 4. Filter to root or shallow topics with children
  const rootTopics = allTopics.filter(
    (t) => (t.parent_id === null || t.chain_depth <= 1) && childrenMap.has(t.id)
  )

  // 5. Apply category filter
  const filtered = category
    ? rootTopics.filter((t) => t.category?.toLowerCase() === category.toLowerCase())
    : rootTopics

  // 6. Score and sort
  const scored: WellspringTopic[] = filtered.map((t) => {
    const directChildren = childrenMap.get(t.id) ?? []
    const { total, laws, maxDepth } = countDescendants(t.id)

    const topChildren: WellspringChild[] = directChildren
      .map((cid) => topicById.get(cid))
      .filter(Boolean)
      .sort((a, b) => (b?.total_votes ?? 0) - (a?.total_votes ?? 0))
      .slice(0, 3)
      .map((c) => ({
        id: c!.id,
        statement: c!.statement,
        status: c!.status,
        blue_pct: c!.blue_pct,
        total_votes: c!.total_votes,
        chain_depth: c!.chain_depth,
        grandchildren: (childrenMap.get(c!.id) ?? []).length,
      }))

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      chain_depth: t.chain_depth,
      created_at: t.created_at,
      direct_children: directChildren.length,
      total_descendants: total,
      law_descendants: laws,
      wellspring_score: wellspringScore(directChildren.length, total, t.total_votes),
      top_children: topChildren,
      max_depth: maxDepth,
    }
  })

  scored.sort((a, b) => b.wellspring_score - a.wellspring_score)

  return NextResponse.json({
    topics: scored.slice(0, MAX_RESULTS),
    total_analyzed: allTopics.length,
    total_with_chains: rootTopics.length,
    generated_at: new Date().toISOString(),
  } satisfies WellspringResponse)
}
