import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReplyToMyArgument {
  reply_id: string
  reply_content: string
  reply_created_at: string
  // Replier
  replier_id: string
  replier_username: string
  replier_display_name: string | null
  replier_avatar_url: string | null
  // The argument being replied to
  argument_id: string
  argument_content: string
  argument_side: 'blue' | 'red'
  // Topic context
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
}

export interface MyRepliesResponse {
  replies: ReplyToMyArgument[]
  total: number
  unread_since: string | null  // ISO timestamp of when user last viewed this page
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch all replies to arguments authored by this user
  //    Exclude own replies (user replying to their own argument)
  const { data: repliesRaw, error } = await supabase
    .from('argument_replies')
    .select(`
      id,
      content,
      created_at,
      user_id,
      argument_id,
      topic_id
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 })
  }

  const allReplies = repliesRaw ?? []
  if (allReplies.length === 0) {
    return NextResponse.json({
      replies: [],
      total: 0,
      unread_since: null,
    } satisfies MyRepliesResponse)
  }

  // 2. Fetch arguments authored by this user that have replies
  const argIds = Array.from(new Set(allReplies.map((r) => r.argument_id)))
  const { data: myArgsRaw } = await supabase
    .from('topic_arguments')
    .select('id, content, side, topic_id, user_id')
    .in('id', argIds)
    .eq('user_id', user.id)

  const myArgMap = new Map<string, { content: string; side: string; topic_id: string }>()
  for (const a of myArgsRaw ?? []) {
    myArgMap.set(a.id, { content: a.content, side: a.side, topic_id: a.topic_id })
  }

  // 3. Filter replies to only those targeting my arguments, excluding own replies
  const relevantReplies = allReplies.filter(
    (r) => myArgMap.has(r.argument_id) && r.user_id !== user.id
  )

  if (relevantReplies.length === 0) {
    return NextResponse.json({
      replies: [],
      total: 0,
      unread_since: null,
    } satisfies MyRepliesResponse)
  }

  // 4. Fetch topic metadata
  const topicIds = Array.from(new Set(relevantReplies.map((r) => r.topic_id)))
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .in('id', topicIds)
  const topicMap = new Map<string, { statement: string; category: string | null; status: string }>()
  for (const t of topicsRaw ?? []) {
    topicMap.set(t.id, { statement: t.statement, category: t.category ?? null, status: t.status })
  }

  // 5. Fetch replier profiles
  const replierIds = Array.from(new Set(relevantReplies.map((r) => r.user_id)))
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', replierIds)
  const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>()
  for (const p of profilesRaw ?? []) {
    profileMap.set(p.id, {
      username: p.username,
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
    })
  }

  // 6. Assemble enriched reply list
  const replies: ReplyToMyArgument[] = []
  for (const r of relevantReplies) {
    const arg = myArgMap.get(r.argument_id)
    const topic = topicMap.get(r.topic_id)
    const replier = profileMap.get(r.user_id)
    if (!arg || !topic || !replier) continue

    replies.push({
      reply_id: r.id,
      reply_content: r.content,
      reply_created_at: r.created_at,
      replier_id: r.user_id,
      replier_username: replier.username,
      replier_display_name: replier.display_name,
      replier_avatar_url: replier.avatar_url,
      argument_id: r.argument_id,
      argument_content: arg.content,
      argument_side: arg.side as 'blue' | 'red',
      topic_id: r.topic_id,
      topic_statement: topic.statement,
      topic_category: topic.category,
      topic_status: topic.status,
    })
  }

  return NextResponse.json({
    replies,
    total: replies.length,
    unread_since: null,
  } satisfies MyRepliesResponse)
}
