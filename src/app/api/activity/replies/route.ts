import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplyActivity {
  reply_id: string
  reply_content: string
  reply_created_at: string
  argument_id: string
  argument_content: string
  argument_side: 'blue' | 'red'
  argument_upvotes: number
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  replier: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface RepliesActivityResponse {
  replies: ReplyActivity[]
  totalCount: number
  unreadCount: number
}

// ─── GET /api/activity/replies ────────────────────────────────────────────────
// Returns all replies received on the current user's arguments, newest first.
// Paginates via ?offset= and ?limit= query params.

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit  = Math.min(50, Math.max(1, Number(searchParams.get('limit')  ?? 30)))
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0))

  // 1. Fetch the current user's arguments (we need their IDs)
  const { data: myArgs, error: myArgsErr } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, topic_id')
    .eq('user_id', user.id)

  if (myArgsErr) {
    return NextResponse.json({ error: 'Failed to load arguments' }, { status: 500 })
  }

  const args = myArgs ?? []
  if (args.length === 0) {
    return NextResponse.json({
      replies: [],
      totalCount: 0,
      unreadCount: 0,
    } satisfies RepliesActivityResponse)
  }

  const argIds = args.map((a) => a.id)

  // 2. Fetch replies to those arguments (excluding self-replies)
  const { data: rawReplies, error: repliesErr, count } = await supabase
    .from('argument_replies')
    .select('id, argument_id, topic_id, user_id, content, created_at', { count: 'exact' })
    .in('argument_id', argIds)
    .neq('user_id', user.id)       // skip own replies
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (repliesErr) {
    return NextResponse.json({ error: 'Failed to load replies' }, { status: 500 })
  }

  const replies = rawReplies ?? []

  if (replies.length === 0) {
    return NextResponse.json({
      replies: [],
      totalCount: count ?? 0,
      unreadCount: 0,
    } satisfies RepliesActivityResponse)
  }

  // 3. Hydrate replier profiles
  const replierIds = Array.from(new Set(replies.map((r) => r.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', replierIds)

  const profileMap = new Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p)
  }

  // 4. Build an arg map for quick lookup
  const argMap = new Map<string, { id: string; content: string; side: 'blue' | 'red'; upvotes: number; topic_id: string }>()
  for (const a of args) {
    argMap.set(a.id, a as { id: string; content: string; side: 'blue' | 'red'; upvotes: number; topic_id: string })
  }

  // 5. Hydrate topic statements for context
  const topicIds = Array.from(new Set(replies.map((r) => r.topic_id)))
  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .in('id', topicIds)

  const topicMap = new Map<string, { statement: string; category: string | null; status: string }>()
  for (const t of topics ?? []) {
    topicMap.set(t.id, { statement: t.statement, category: t.category, status: t.status })
  }

  // 6. Count unread: replies newer than the last time we saw the notification-read marker
  //    Use a lightweight proxy: replies in the last 24 h that the user hasn't clicked
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const unreadCount = replies.filter((r) => r.created_at > oneDayAgo).length

  // 7. Shape the response
  const shaped: ReplyActivity[] = replies.map((r) => {
    const arg   = argMap.get(r.argument_id)
    const topic = topicMap.get(r.topic_id)

    return {
      reply_id:          r.id,
      reply_content:     r.content,
      reply_created_at:  r.created_at,
      argument_id:       r.argument_id,
      argument_content:  arg?.content ?? '',
      argument_side:     (arg?.side ?? 'blue') as 'blue' | 'red',
      argument_upvotes:  arg?.upvotes ?? 0,
      topic_id:          r.topic_id,
      topic_statement:   topic?.statement ?? 'Unknown topic',
      topic_category:    topic?.category ?? null,
      topic_status:      topic?.status ?? 'active',
      replier:           profileMap.get(r.user_id) ?? null,
    }
  })

  return NextResponse.json({
    replies: shaped,
    totalCount: count ?? 0,
    unreadCount,
  } satisfies RepliesActivityResponse)
}
