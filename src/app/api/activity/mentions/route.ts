import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MentionActivity {
  id: string
  type: 'argument' | 'reply'
  content: string
  created_at: string
  argument_id: string
  argument_content: string
  argument_side: 'blue' | 'red'
  argument_upvotes: number
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  mentioner: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface MentionsActivityResponse {
  mentions: MentionActivity[]
  totalCount: number
  username: string
}

// ─── GET /api/activity/mentions ───────────────────────────────────────────────
// Returns all arguments and replies that @mention the current user, newest first.

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit  = Math.min(50, Math.max(1, Number(searchParams.get('limit')  ?? 30)))
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0))
  const period = searchParams.get('period') ?? null

  // 1. Get the current user's username
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile?.username) {
    return NextResponse.json({ mentions: [], totalCount: 0, username: '' } satisfies MentionsActivityResponse)
  }

  const username = profile.username
  const pattern = `%@${username}%`

  // Compute date cutoff for period filter
  let cutoff: string | null = null
  if (period === '7d')  cutoff = new Date(Date.now() - 7  * 86_400_000).toISOString()
  if (period === '30d') cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()

  // 2. Find arguments mentioning this user (excluding self)
  let argQuery = supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, topic_id, user_id, created_at', { count: 'exact' })
    .ilike('content', pattern)
    .neq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (cutoff) argQuery = argQuery.gte('created_at', cutoff)

  const { data: rawArgs, count: argCount } = await argQuery

  // 3. Find replies mentioning this user (excluding self)
  let replyQuery = supabase
    .from('argument_replies')
    .select('id, content, argument_id, topic_id, user_id, created_at', { count: 'exact' })
    .ilike('content', pattern)
    .neq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (cutoff) replyQuery = replyQuery.gte('created_at', cutoff)

  const { data: rawReplies, count: replyCount } = await replyQuery

  const args    = rawArgs    ?? []
  const replies = rawReplies ?? []
  const totalCount = (argCount ?? 0) + (replyCount ?? 0)

  if (args.length === 0 && replies.length === 0) {
    return NextResponse.json({
      mentions: [],
      totalCount: 0,
      username,
    } satisfies MentionsActivityResponse)
  }

  // 4. Collect all user IDs and topic IDs for batch enrichment
  const mentionerIds = [
    ...args.map((a) => a.user_id),
    ...replies.map((r) => r.user_id),
  ].filter(Boolean) as string[]

  const topicIds = [
    ...args.map((a) => a.topic_id),
    ...replies.map((r) => r.topic_id),
  ].filter(Boolean) as string[]

  const argIdsForReplies = replies.map((r) => r.argument_id).filter(Boolean) as string[]

  // 5. Batch fetch profiles, topics, and parent arguments
  const [profilesRes, topicsRes, parentArgsRes] = await Promise.all([
    mentionerIds.length
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', [...new Set(mentionerIds)])
      : Promise.resolve({ data: [] }),
    topicIds.length
      ? supabase
          .from('topics')
          .select('id, statement, category, status')
          .in('id', [...new Set(topicIds)])
      : Promise.resolve({ data: [] }),
    argIdsForReplies.length
      ? supabase
          .from('topic_arguments')
          .select('id, content, side, upvotes')
          .in('id', [...new Set(argIdsForReplies)])
      : Promise.resolve({ data: [] }),
  ])

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p])
  )
  const topicMap = new Map(
    (topicsRes.data ?? []).map((t) => [t.id, t])
  )
  const parentArgMap = new Map(
    (parentArgsRes.data ?? []).map((a) => [a.id, a])
  )

  // 6. Combine and shape the results
  const allMentions: MentionActivity[] = []

  for (const arg of args) {
    const topic = topicMap.get(arg.topic_id)
    if (!topic) continue
    allMentions.push({
      id: arg.id,
      type: 'argument',
      content: arg.content,
      created_at: arg.created_at,
      argument_id: arg.id,
      argument_content: arg.content,
      argument_side: arg.side as 'blue' | 'red',
      argument_upvotes: arg.upvotes ?? 0,
      topic_id: topic.id,
      topic_statement: topic.statement,
      topic_category: topic.category,
      topic_status: topic.status,
      mentioner: profileMap.get(arg.user_id) ?? null,
    })
  }

  for (const reply of replies) {
    const topic = topicMap.get(reply.topic_id)
    const parentArg = parentArgMap.get(reply.argument_id)
    if (!topic || !parentArg) continue
    allMentions.push({
      id: reply.id,
      type: 'reply',
      content: reply.content,
      created_at: reply.created_at,
      argument_id: parentArg.id,
      argument_content: parentArg.content,
      argument_side: parentArg.side as 'blue' | 'red',
      argument_upvotes: parentArg.upvotes ?? 0,
      topic_id: topic.id,
      topic_statement: topic.statement,
      topic_category: topic.category,
      topic_status: topic.status,
      mentioner: profileMap.get(reply.user_id) ?? null,
    })
  }

  // Sort by newest first then paginate
  allMentions.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  const paginated = allMentions.slice(offset, offset + limit)

  return NextResponse.json({
    mentions: paginated,
    totalCount,
    username,
  } satisfies MentionsActivityResponse)
}
