import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5-minute cache

export interface ContextSource {
  id: string
  url: string
  title: string
  description: string | null
  domain: string | null
  display_order: number
}

export interface ContextArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_grade: string | null
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface LawContextResponse {
  law: {
    id: string
    statement: string
    full_statement: string | null
    body_markdown: string | null
    wiki_content: string | null
    wiki_updated_at: string | null
    category: string | null
    scope: string | null
    blue_pct: number
    total_votes: number
    established_at: string
    topic_id: string
  }
  topic: {
    id: string
    description: string | null
    created_at: string
    author_username: string | null
    author_display_name: string | null
    author_avatar_url: string | null
  } | null
  sources: ContextSource[]
  top_for_args: ContextArgument[]
  top_against_args: ContextArgument[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing law id' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch law with wiki content
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select(`
      id, statement, full_statement, body_markdown, wiki_content, wiki_updated_at,
      category, scope, blue_pct, total_votes, established_at, topic_id
    `)
    .eq('id', id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // Fetch original topic with author info
  const { data: topic } = await supabase
    .from('topics')
    .select(`
      id, description, created_at,
      profiles!topics_user_id_fkey(username, display_name, avatar_url)
    `)
    .eq('id', law.topic_id)
    .maybeSingle()

  type TopicRow = typeof topic & {
    profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null
  }

  const topicRow = topic as TopicRow | null

  // Fetch sources from original topic
  const { data: rawSources } = await supabase
    .from('topic_sources')
    .select('id, url, title, description, domain, display_order')
    .eq('topic_id', law.topic_id)
    .order('display_order', { ascending: true })
    .limit(5)

  const sources: ContextSource[] = (rawSources ?? []) as ContextSource[]

  // Fetch top arguments (3 FOR, 3 AGAINST)
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select(`
      id, content, side, upvotes, ai_grade,
      profiles!topic_arguments_user_id_fkey(username, display_name, avatar_url)
    `)
    .eq('topic_id', law.topic_id)
    .order('upvotes', { ascending: false })
    .limit(60) // fetch more to get good split

  type ArgRow = {
    id: string; content: string; side: 'blue' | 'red'; upvotes: number; ai_grade: string | null
    profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null
  }

  const allArgs = (rawArgs ?? []) as unknown as ArgRow[]

  function mapArg(a: ArgRow): ContextArgument {
    return {
      id: a.id,
      content: a.content,
      side: a.side,
      upvotes: a.upvotes,
      ai_grade: a.ai_grade,
      author_username: a.profiles?.username ?? null,
      author_display_name: a.profiles?.display_name ?? null,
      author_avatar_url: a.profiles?.avatar_url ?? null,
    }
  }

  const top_for_args = allArgs.filter((a) => a.side === 'blue').slice(0, 3).map(mapArg)
  const top_against_args = allArgs.filter((a) => a.side === 'red').slice(0, 3).map(mapArg)

  return NextResponse.json({
    law: {
      id: law.id,
      statement: law.statement,
      full_statement: (law as { full_statement?: string | null }).full_statement ?? null,
      body_markdown: (law as { body_markdown?: string | null }).body_markdown ?? null,
      wiki_content: (law as { wiki_content?: string | null }).wiki_content ?? null,
      wiki_updated_at: (law as { wiki_updated_at?: string | null }).wiki_updated_at ?? null,
      category: law.category ?? null,
      scope: (law as { scope?: string | null }).scope ?? null,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
      topic_id: law.topic_id,
    },
    topic: topicRow
      ? {
          id: topicRow.id,
          description: topicRow.description ?? null,
          created_at: topicRow.created_at,
          author_username: topicRow.profiles?.username ?? null,
          author_display_name: topicRow.profiles?.display_name ?? null,
          author_avatar_url: topicRow.profiles?.avatar_url ?? null,
        }
      : null,
    sources,
    top_for_args,
    top_against_args,
  } satisfies LawContextResponse)
}
