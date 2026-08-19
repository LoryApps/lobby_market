import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ThesisCategory } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export interface ThesisNetworkNode {
  id: string
  statement: string
  category: ThesisCategory
  status: 'active' | 'vindicated' | 'refuted' | 'expired'
  agree_count: number
  disagree_count: number
  total_votes: number
  agree_ratio: number
  related_topic_id: string | null
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar: string | null
}

export interface ThesisNetworkEdge {
  source: string
  target: string
  // 'topic' = same related_topic_id, 'author' = same author, 'category' = same category
  type: 'topic' | 'author' | 'category'
  weight: number
}

export interface ThesisNetworkResponse {
  nodes: ThesisNetworkNode[]
  edges: ThesisNetworkEdge[]
  total_nodes: number
  total_edges: number
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') ?? null
  const status = searchParams.get('status') ?? 'all'

  let query = supabase
    .from('civic_theses')
    .select(
      `id, statement, category, status, agree_count, disagree_count,
       related_topic_id, user_id,
       profiles!civic_theses_user_id_fkey(username, display_name, avatar_url)`
    )
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(250)

  if (category) query = query.eq('category', category)
  if (status !== 'all') query = query.eq('status', status)

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const nodes: ThesisNetworkNode[] = (rows ?? []).map((row) => {
    const total = (row.agree_count ?? 0) + (row.disagree_count ?? 0)
    const agree_ratio = total > 0 ? (row.agree_count ?? 0) / total : 0.5
    const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      id: row.id,
      statement: row.statement,
      category: row.category as ThesisCategory,
      status: row.status as ThesisNetworkNode['status'],
      agree_count: row.agree_count ?? 0,
      disagree_count: row.disagree_count ?? 0,
      total_votes: total,
      agree_ratio,
      related_topic_id: row.related_topic_id ?? null,
      author_id: row.user_id,
      author_username: (author as { username: string } | null)?.username ?? 'anon',
      author_display_name: (author as { display_name: string | null } | null)?.display_name ?? null,
      author_avatar: (author as { avatar_url: string | null } | null)?.avatar_url ?? null,
    }
  })

  // Build edges
  const edges: ThesisNetworkEdge[] = []
  const edgeSet = new Set<string>()

  function addEdge(a: string, b: string, type: ThesisNetworkEdge['type'], weight: number) {
    const key = [a, b].sort().join('|')
    if (!edgeSet.has(key)) {
      edgeSet.add(key)
      edges.push({ source: a, target: b, type, weight })
    }
  }

  // Group by topic
  const byTopic = new Map<string, string[]>()
  for (const n of nodes) {
    if (n.related_topic_id) {
      const arr = byTopic.get(n.related_topic_id) ?? []
      arr.push(n.id)
      byTopic.set(n.related_topic_id, arr)
    }
  }

  // Group by author
  const byAuthor = new Map<string, string[]>()
  for (const n of nodes) {
    const arr = byAuthor.get(n.author_id) ?? []
    arr.push(n.id)
    byAuthor.set(n.author_id, arr)
  }

  // Group by category
  const byCategory = new Map<string, string[]>()
  for (const n of nodes) {
    const arr = byCategory.get(n.category) ?? []
    arr.push(n.id)
    byCategory.set(n.category, arr)
  }

  // Topic edges (strongest — weight 3)
  for (const ids of byTopic.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        addEdge(ids[i], ids[j], 'topic', 3)
      }
    }
  }

  // Author edges (medium — weight 2)
  for (const ids of byAuthor.values()) {
    if (ids.length > 1) {
      // Connect each author's theses in a chain to avoid too many edges
      for (let i = 0; i < Math.min(ids.length, 5) - 1; i++) {
        addEdge(ids[i], ids[i + 1], 'author', 2)
      }
    }
  }

  // Category edges: only connect highly-agreed theses in the same category
  // Limit to top-engaged nodes per category to avoid a hairball
  for (const [, ids] of byCategory.entries()) {
    if (ids.length < 2) continue
    // Sort by total_votes desc, take top 6
    const sorted = ids
      .map((id) => nodes.find((n) => n.id === id)!)
      .filter(Boolean)
      .sort((a, b) => b.total_votes - a.total_votes)
      .slice(0, 6)
      .map((n) => n.id)

    for (let i = 0; i < sorted.length - 1; i++) {
      addEdge(sorted[i], sorted[i + 1], 'category', 1)
    }
  }

  return NextResponse.json({
    nodes,
    edges,
    total_nodes: nodes.length,
    total_edges: edges.length,
  } satisfies ThesisNetworkResponse)
}
