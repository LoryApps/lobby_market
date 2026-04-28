import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MindMapNodeType = 'topic' | 'law' | 'argument' | 'journal'

export interface MindMapNode {
  id: string
  type: MindMapNodeType
  label: string
  category: string | null
  voteSide: 'blue' | 'red' | null
  url: string
  // topic-level
  totalVotes?: number
  bluePct?: number
  status?: string
  // argument-level
  upvotes?: number
  argSide?: 'blue' | 'red'
  // journal-level
  mood?: string | null
}

export type MindMapEdgeType = 'argued' | 'journaled'

export interface MindMapEdge {
  source: string
  target: string
  type: MindMapEdgeType
}

export interface MindMapStats {
  topicCount: number
  lawCount: number
  argumentCount: number
  journalCount: number
}

export interface MindMapData {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
  stats: MindMapStats
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Fetch user's engagement data in parallel
  const [votesRes, argumentsRes, bookmarksRes, journalRes] = await Promise.all([
    supabase
      .from('votes')
      .select(`
        side, topic_id,
        topic:topics(id, statement, category, status, blue_pct, total_votes)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60),

    supabase
      .from('topic_arguments')
      .select('id, topic_id, side, content, upvotes')
      .eq('user_id', user.id)
      .order('upvotes', { ascending: false })
      .limit(40),

    supabase
      .from('topic_bookmarks')
      .select(`
        topic_id,
        topic:topics(id, statement, category, status, blue_pct, total_votes)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30),

    supabase
      .from('civic_journal_entries')
      .select('id, topic_id, content, mood')
      .eq('user_id', user.id)
      .not('topic_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  const nodes: MindMapNode[] = []
  const edges: MindMapEdge[] = []

  // Track which topic nodes are already added
  const topicNodeIds = new Set<string>()
  // Map topic_id → vote side (from the user's vote)
  const voteMap = new Map<string, 'blue' | 'red'>()

  // ── 1. Voted topics ────────────────────────────────────────────────────────
  for (const v of (votesRes.data ?? []) as Array<{
    side: 'blue' | 'red'
    topic_id: string
    topic: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    } | null
  }>) {
    const t = v.topic
    if (!t) continue
    voteMap.set(t.id, v.side)
    if (topicNodeIds.has(t.id)) continue
    topicNodeIds.add(t.id)
    const isLaw = t.status === 'law'
    nodes.push({
      id: `topic:${t.id}`,
      type: isLaw ? 'law' : 'topic',
      label: t.statement,
      category: t.category,
      voteSide: v.side,
      url: isLaw ? `/law/${t.id}` : `/topic/${t.id}`,
      totalVotes: t.total_votes,
      bluePct: t.blue_pct,
      status: t.status,
    })
  }

  // ── 2. Bookmarked topics (not already added via vote) ─────────────────────
  for (const b of (bookmarksRes.data ?? []) as Array<{
    topic_id: string
    topic: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    } | null
  }>) {
    const t = b.topic
    if (!t || topicNodeIds.has(t.id)) continue
    topicNodeIds.add(t.id)
    const isLaw = t.status === 'law'
    nodes.push({
      id: `topic:${t.id}`,
      type: isLaw ? 'law' : 'topic',
      label: t.statement,
      category: t.category,
      voteSide: null,
      url: isLaw ? `/law/${t.id}` : `/topic/${t.id}`,
      totalVotes: t.total_votes,
      bluePct: t.blue_pct,
      status: t.status,
    })
  }

  // ── 3. Arguments ──────────────────────────────────────────────────────────
  const argTopicIds = new Set<string>()
  for (const a of (argumentsRes.data ?? []) as Array<{
    id: string
    topic_id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
  }>) {
    argTopicIds.add(a.topic_id)
    const argId = `arg:${a.id}`
    nodes.push({
      id: argId,
      type: 'argument',
      label: a.content.slice(0, 70) + (a.content.length > 70 ? '…' : ''),
      category: null,
      voteSide: null,
      argSide: a.side,
      url: `/topic/${a.topic_id}`,
      upvotes: a.upvotes,
    })
    // Edge: argument → topic
    if (topicNodeIds.has(a.topic_id)) {
      edges.push({ source: argId, target: `topic:${a.topic_id}`, type: 'argued' })
    }
  }

  // ── 4. Journal entries ────────────────────────────────────────────────────
  for (const j of (journalRes.data ?? []) as Array<{
    id: string
    topic_id: string | null
    content: string
    mood: string | null
  }>) {
    if (!j.topic_id) continue
    const jId = `journal:${j.id}`
    nodes.push({
      id: jId,
      type: 'journal',
      label: j.content.slice(0, 60) + (j.content.length > 60 ? '…' : ''),
      category: null,
      voteSide: null,
      url: `/journal`,
      mood: j.mood,
    })
    // Edge: journal → topic
    if (topicNodeIds.has(j.topic_id)) {
      edges.push({ source: jId, target: `topic:${j.topic_id}`, type: 'journaled' })
    }
  }

  const topicCount = nodes.filter((n) => n.type === 'topic').length
  const lawCount = nodes.filter((n) => n.type === 'law').length
  const argumentCount = nodes.filter((n) => n.type === 'argument').length
  const journalCount = nodes.filter((n) => n.type === 'journal').length

  return NextResponse.json({
    nodes,
    edges,
    stats: { topicCount, lawCount, argumentCount, journalCount },
  } satisfies MindMapData)
}
