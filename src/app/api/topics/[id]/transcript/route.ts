import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranscriptReply {
  id: string
  content: string
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface TranscriptArgument {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  source_url: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  replies: TranscriptReply[]
}

export interface TranscriptTopic {
  id: string
  statement: string
  description: string | null
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
  updated_at: string | null
  voting_ends_at: string | null
}

export interface TranscriptResponse {
  topic: TranscriptTopic
  for_args: TranscriptArgument[]
  against_args: TranscriptArgument[]
  total_for: number
  total_against: number
  interleaved: TranscriptArgument[]
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Fetch topic
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, description, category, status, blue_pct, total_votes, created_at, updated_at, voting_ends_at')
    .eq('id', params.id)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch top arguments (up to 40 per side)
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select('id, user_id, side, content, upvotes, source_url, created_at')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(80)

  const args = (rawArgs ?? []) as Array<{
    id: string
    user_id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    source_url: string | null
    created_at: string
  }>

  if (args.length === 0) {
    return NextResponse.json({
      topic,
      for_args: [],
      against_args: [],
      total_for: 0,
      total_against: 0,
      interleaved: [],
    } satisfies TranscriptResponse)
  }

  // Fetch author profiles
  const userIds = Array.from(new Set(args.map((a) => a.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', userIds)

  const profileMap = new Map<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>)
  }

  // Fetch replies for top 20 arguments (to keep response manageable)
  const argIds = args.slice(0, 20).map((a) => a.id)
  const { data: rawReplies } = await supabase
    .from('argument_replies')
    .select('id, argument_id, user_id, content, created_at')
    .in('argument_id', argIds)
    .order('created_at', { ascending: true })
    .limit(200)

  const rawReplyRows = (rawReplies ?? []) as Array<{
    id: string
    argument_id: string
    user_id: string
    content: string
    created_at: string
  }>

  // Fetch reply author profiles
  if (rawReplyRows.length > 0) {
    const replyUserIds = Array.from(new Set(rawReplyRows.map((r) => r.user_id)))
    const { data: replyProfiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', replyUserIds)
    for (const p of replyProfiles ?? []) {
      profileMap.set(p.id, p as Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>)
    }
  }

  // Group replies by argument id
  const replyMap = new Map<string, TranscriptReply[]>()
  for (const r of rawReplyRows) {
    const list = replyMap.get(r.argument_id) ?? []
    list.push({
      id: r.id,
      content: r.content,
      created_at: r.created_at,
      author: profileMap.get(r.user_id) ?? null,
    })
    replyMap.set(r.argument_id, list)
  }

  // Build enriched arguments
  const enriched: TranscriptArgument[] = args.map((a) => ({
    id: a.id,
    side: a.side,
    content: a.content,
    upvotes: a.upvotes,
    source_url: a.source_url,
    created_at: a.created_at,
    author: profileMap.get(a.user_id) ?? null,
    replies: replyMap.get(a.id) ?? [],
  }))

  const for_args = enriched.filter((a) => a.side === 'blue')
  const against_args = enriched.filter((a) => a.side === 'red')

  // Interleave FOR and AGAINST for reading order (debate transcript style)
  const maxLen = Math.max(for_args.length, against_args.length)
  const interleaved: TranscriptArgument[] = []
  for (let i = 0; i < maxLen; i++) {
    if (i < for_args.length) interleaved.push(for_args[i])
    if (i < against_args.length) interleaved.push(against_args[i])
  }

  return NextResponse.json({
    topic,
    for_args,
    against_args,
    total_for: for_args.length,
    total_against: against_args.length,
    interleaved,
  } satisfies TranscriptResponse)
}
