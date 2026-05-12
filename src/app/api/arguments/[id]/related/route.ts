import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelatedArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
  }
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  rank: number
}

export interface RelatedArgumentsResponse {
  related: RelatedArgument[]
  source_argument_id: string
}

// ─── GET /api/arguments/[id]/related ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid argument ID' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch the source argument to get its content and topic_id
  const { data: source } = await supabase
    .from('topic_arguments')
    .select('id, content, topic_id')
    .eq('id', id)
    .maybeSingle()

  if (!source) {
    return NextResponse.json({ error: 'Argument not found' }, { status: 404 })
  }

  // Use the FTS index to find arguments with similar content from OTHER topics.
  // plainto_tsquery automatically tokenises and stems the content.
  // We limit to 6 candidates, exclude the current topic, then rank by
  // similarity score * upvote weight.
  const { data: rawRelated, error } = await supabase.rpc('find_related_arguments', {
    p_argument_id: id,
    p_topic_id: source.topic_id,
    p_content: source.content,
    p_limit: 5,
  })

  if (error) {
    // Fallback: if the RPC doesn't exist yet, use a simpler query
    const words = source.content
      .split(/\s+/)
      .filter((w: string) => w.length > 4)
      .slice(0, 8)
      .join(' | ')

    if (!words) {
      return NextResponse.json({ related: [], source_argument_id: id })
    }

    const { data: fallback } = await supabase
      .from('topic_arguments')
      .select(`
        id,
        content,
        side,
        upvotes,
        ai_score,
        ai_grade,
        created_at,
        topic_id,
        user_id
      `)
      .neq('topic_id', source.topic_id)
      .textSearch('fts', words, { type: 'plain', config: 'english' })
      .order('upvotes', { ascending: false })
      .limit(5)

    if (!fallback || fallback.length === 0) {
      return NextResponse.json({ related: [], source_argument_id: id })
    }

    // Enrich with topic and author data
    const topicIds = [...new Set(fallback.map((a: { topic_id: string }) => a.topic_id))]
    const userIds = [...new Set(fallback.map((a: { user_id: string }) => a.user_id))]

    const [{ data: topics }, { data: profiles }] = await Promise.all([
      supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct')
        .in('id', topicIds),
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', userIds),
    ])

    const topicMap = new Map((topics ?? []).map((t: { id: string }) => [t.id, t]))
    const profileMap = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]))

    const related: RelatedArgument[] = fallback
      .map((a: { id: string; content: string; side: string; upvotes: number; ai_score: number | null; ai_grade: string | null; created_at: string; topic_id: string; user_id: string }, idx: number) => ({
        id: a.id,
        content: a.content,
        side: a.side as 'blue' | 'red',
        upvotes: a.upvotes,
        ai_score: a.ai_score,
        ai_grade: a.ai_grade,
        created_at: a.created_at,
        topic: topicMap.get(a.topic_id) ?? null,
        author: profileMap.get(a.user_id) ?? null,
        rank: idx + 1,
      }))
      .filter((a: RelatedArgument) => a.topic !== null)

    return NextResponse.json({ related, source_argument_id: id })
  }

  // If RPC succeeded, enrich similarly
  const fallbackData = rawRelated ?? []
  if (fallbackData.length === 0) {
    return NextResponse.json({ related: [], source_argument_id: id })
  }

  const topicIds = [...new Set(fallbackData.map((a: { topic_id: string }) => a.topic_id))]
  const userIds = [...new Set(fallbackData.map((a: { user_id: string }) => a.user_id))]

  const [{ data: topics }, { data: profiles }] = await Promise.all([
    supabase.from('topics').select('id, statement, category, status, blue_pct').in('id', topicIds),
    supabase.from('profiles').select('id, username, display_name, avatar_url, role').in('id', userIds),
  ])

  const topicMap = new Map((topics ?? []).map((t: { id: string }) => [t.id, t]))
  const profileMap = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]))

  const related: RelatedArgument[] = fallbackData
    .map((a: { id: string; content: string; side: string; upvotes: number; ai_score: number | null; ai_grade: string | null; created_at: string; topic_id: string; user_id: string }, idx: number) => ({
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvotes: a.upvotes,
      ai_score: a.ai_score,
      ai_grade: a.ai_grade,
      created_at: a.created_at,
      topic: topicMap.get(a.topic_id) ?? null,
      author: profileMap.get(a.user_id) ?? null,
      rank: idx + 1,
    }))
    .filter((a: RelatedArgument) => a.topic !== null)

  return NextResponse.json({ related, source_argument_id: id })
}
