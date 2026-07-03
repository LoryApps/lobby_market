import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MindMapNode, MindMapEdge } from '@/app/api/me/mindmap/route'

export const dynamic = 'force-dynamic'

export interface TopicMindMapStats {
  argumentCount: number
  relatedTopics: number
  lawCount: number
}

export interface TopicMindMapResponse {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
  stats: TopicMindMapStats
  centralTopic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid topic ID' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const nodes: MindMapNode[] = []
  const edges: MindMapEdge[] = []

  // Central topic node — high vote count makes it the largest
  nodes.push({
    id: topic.id,
    type: 'topic',
    label: topic.statement.length > 60
      ? topic.statement.slice(0, 57) + '…'
      : topic.statement,
    category: topic.category,
    voteSide: null,
    url: `/topic/${topic.id}`,
    totalVotes: topic.total_votes ?? 0,
    bluePct: topic.blue_pct ?? 50,
    status: topic.status,
  })

  // Top FOR arguments
  const { data: forArgs } = await supabase
    .from('arguments')
    .select('id, content, upvotes')
    .eq('topic_id', id)
    .eq('side', 'blue')
    .order('upvotes', { ascending: false })
    .limit(6)

  for (const arg of forArgs ?? []) {
    const nodeId = `arg-${arg.id}`
    nodes.push({
      id: nodeId,
      type: 'argument',
      label: arg.content.length > 55 ? arg.content.slice(0, 52) + '…' : arg.content,
      category: topic.category,
      voteSide: 'blue',
      url: `/arguments/${arg.id}`,
      upvotes: arg.upvotes ?? 0,
      argSide: 'blue',
    })
    edges.push({ source: topic.id, target: nodeId, type: 'argued' })
  }

  // Top AGAINST arguments
  const { data: againstArgs } = await supabase
    .from('arguments')
    .select('id, content, upvotes')
    .eq('topic_id', id)
    .eq('side', 'red')
    .order('upvotes', { ascending: false })
    .limit(6)

  for (const arg of againstArgs ?? []) {
    const nodeId = `arg-${arg.id}`
    nodes.push({
      id: nodeId,
      type: 'argument',
      label: arg.content.length > 55 ? arg.content.slice(0, 52) + '…' : arg.content,
      category: topic.category,
      voteSide: 'red',
      url: `/arguments/${arg.id}`,
      upvotes: arg.upvotes ?? 0,
      argSide: 'red',
    })
    edges.push({ source: topic.id, target: nodeId, type: 'argued' })
  }

  // Related topics via wiki links (outbound + inbound)
  const [outboundRes, inboundRes] = await Promise.all([
    supabase
      .from('topic_links')
      .select('target_topic_id')
      .eq('source_topic_id', id)
      .limit(8),
    supabase
      .from('topic_links')
      .select('source_topic_id')
      .eq('target_topic_id', id)
      .limit(8),
  ])

  const relatedIds = new Set<string>()
  for (const l of outboundRes.data ?? []) relatedIds.add(l.target_topic_id)
  for (const l of inboundRes.data ?? []) relatedIds.add(l.source_topic_id)

  let linkedTopicsCount = 0
  if (relatedIds.size > 0) {
    const { data: relatedTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', Array.from(relatedIds))
      .limit(10)

    for (const rt of relatedTopics ?? []) {
      linkedTopicsCount++
      const isOutbound = (outboundRes.data ?? []).some((l) => l.target_topic_id === rt.id)
      nodes.push({
        id: rt.id,
        type: 'topic',
        label: rt.statement.length > 55 ? rt.statement.slice(0, 52) + '…' : rt.statement,
        category: rt.category,
        voteSide: null,
        url: `/topic/${rt.id}`,
        totalVotes: Math.min(rt.total_votes ?? 0, (topic.total_votes ?? 1) - 1),
        bluePct: rt.blue_pct ?? 50,
        status: rt.status,
      })
      edges.push({
        source: isOutbound ? topic.id : rt.id,
        target: isOutbound ? rt.id : topic.id,
        type: 'argued',
      })
    }
  }

  // Same-category topics as context (if few wiki links)
  if (linkedTopicsCount < 3 && topic.category) {
    const { data: catTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('category', topic.category)
      .neq('id', id)
      .order('total_votes', { ascending: false })
      .limit(4)

    for (const ct of catTopics ?? []) {
      if (nodes.some((n) => n.id === ct.id)) continue
      nodes.push({
        id: ct.id,
        type: 'topic',
        label: ct.statement.length > 55 ? ct.statement.slice(0, 52) + '…' : ct.statement,
        category: ct.category,
        voteSide: null,
        url: `/topic/${ct.id}`,
        totalVotes: Math.min(ct.total_votes ?? 0, (topic.total_votes ?? 1) - 1),
        bluePct: ct.blue_pct ?? 50,
        status: ct.status,
      })
      edges.push({ source: topic.id, target: ct.id, type: 'argued' })
    }
  }

  // Law node if topic became law
  let lawCount = 0
  if (topic.status === 'law') {
    const { data: law } = await supabase
      .from('laws')
      .select('id, statement')
      .eq('topic_id', id)
      .maybeSingle()

    if (law) {
      lawCount = 1
      nodes.push({
        id: `law-${law.id}`,
        type: 'law',
        label: law.statement.length > 55 ? law.statement.slice(0, 52) + '…' : law.statement,
        category: topic.category,
        voteSide: null,
        url: `/law/${law.id}`,
      })
      edges.push({ source: topic.id, target: `law-${law.id}`, type: 'argued' })
    }
  }

  return NextResponse.json({
    nodes,
    edges,
    stats: {
      argumentCount: (forArgs?.length ?? 0) + (againstArgs?.length ?? 0),
      relatedTopics: linkedTopicsCount,
      lawCount,
    },
    centralTopic: topic,
  } satisfies TopicMindMapResponse)
}
