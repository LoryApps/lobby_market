import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TranscriptMessage {
  id: string
  content: string
  side: 'blue' | 'red' | null
  is_argument: boolean
  upvotes: number
  parent_id: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface TranscriptDebate {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  scheduled_at: string | null
  ended_at: string | null
  topic: {
    id: string
    statement: string
    category: string | null
  } | null
}

export interface TranscriptResponse {
  debate: TranscriptDebate
  messages: TranscriptMessage[]
  stats: {
    total: number
    for_count: number
    against_count: number
    neutral_count: number
    argument_count: number
    duration_minutes: number | null
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  // Fetch debate + topic
  const { data: debate, error: debateError } = await supabase
    .from('debates')
    .select('id, title, description, type, status, scheduled_at, ended_at, topic_id')
    .eq('id', id)
    .single()

  if (debateError || !debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  // Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category')
    .eq('id', debate.topic_id)
    .maybeSingle()

  // Fetch all messages ordered by creation time
  const { data: messages } = await supabase
    .from('debate_messages')
    .select('id, content, side, is_argument, upvotes, parent_id, created_at, user_id')
    .eq('debate_id', id)
    .order('created_at', { ascending: true })

  const rawMessages = messages ?? []

  // Hydrate author profiles
  const authorIds = Array.from(new Set(rawMessages.map((m) => m.user_id)))
  const profileMap: Record<string, TranscriptMessage['author']> = {}

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)

    for (const p of profiles ?? []) {
      profileMap[p.id] = {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
      }
    }
  }

  const hydratedMessages: TranscriptMessage[] = rawMessages.map((m) => ({
    id: m.id,
    content: m.content,
    side: m.side as 'blue' | 'red' | null,
    is_argument: m.is_argument,
    upvotes: m.upvotes,
    parent_id: m.parent_id,
    created_at: m.created_at,
    author: profileMap[m.user_id] ?? null,
  }))

  // Compute stats
  const forCount = hydratedMessages.filter((m) => m.side === 'blue').length
  const againstCount = hydratedMessages.filter((m) => m.side === 'red').length
  const neutralCount = hydratedMessages.filter((m) => m.side === null).length
  const argumentCount = hydratedMessages.filter((m) => m.is_argument).length

  let durationMinutes: number | null = null
  if (debate.scheduled_at && debate.ended_at) {
    const diff = new Date(debate.ended_at).getTime() - new Date(debate.scheduled_at).getTime()
    durationMinutes = Math.round(diff / 60000)
  } else if (debate.scheduled_at && rawMessages.length > 0) {
    const lastMsg = rawMessages[rawMessages.length - 1]
    const diff = new Date(lastMsg.created_at).getTime() - new Date(debate.scheduled_at).getTime()
    durationMinutes = Math.max(0, Math.round(diff / 60000))
  }

  return NextResponse.json({
    debate: {
      id: debate.id,
      title: debate.title,
      description: debate.description,
      type: debate.type,
      status: debate.status,
      scheduled_at: debate.scheduled_at,
      ended_at: debate.ended_at,
      topic: topic ?? null,
    },
    messages: hydratedMessages,
    stats: {
      total: hydratedMessages.length,
      for_count: forCount,
      against_count: againstCount,
      neutral_count: neutralCount,
      argument_count: argumentCount,
      duration_minutes: durationMinutes,
    },
  } satisfies TranscriptResponse)
}
