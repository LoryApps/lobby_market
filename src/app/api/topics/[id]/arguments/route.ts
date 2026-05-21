import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TopicArgument, TopicArgumentWithAuthor, Profile } from '@/lib/supabase/types'

// GET /api/topics/[id]/arguments?sort=top|new|quality|discussed
// Returns the arguments for a topic, enriched with author info and the
// authenticated user's upvote status.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const sort = req.nextUrl.searchParams.get('sort') ?? 'top'

  // Build the query with the appropriate server-side ordering
  let query = supabase
    .from('topic_arguments')
    .select('*')
    .eq('topic_id', params.id)
    .limit(50)

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'quality') {
    // ai_score DESC NULLS LAST, then upvotes, then newest
    query = query
      .order('ai_score', { ascending: false, nullsFirst: false })
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: false })
  } else {
    // top (default) and discussed: upvotes desc, then newest
    // (discussed re-sorts client-side by reply_count once counts are attached)
    query = query
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: false })
  }

  const { data: args, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const rawArgs = (args ?? []) as TopicArgument[]

  if (rawArgs.length === 0) {
    return NextResponse.json({ arguments: [], myArgumentId: null })
  }

  // Batch-fetch author profiles
  const userIds = Array.from(new Set(rawArgs.map((a) => a.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', userIds)

  const profileMap = new Map<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p)
  }

  const argIds = rawArgs.map((a) => a.id)

  // Fetch which arguments the current user has upvoted
  const upvotedArgIds = new Set<string>()
  if (user) {
    const { data: myVotes } = await supabase
      .from('topic_argument_votes')
      .select('argument_id')
      .in('argument_id', argIds)
      .eq('user_id', user.id)

    for (const v of myVotes ?? []) {
      upvotedArgIds.add(v.argument_id)
    }
  }

  // Batch-fetch reply counts for all arguments
  const replyCountMap = new Map<string, number>()
  const { data: replyCounts } = await supabase
    .from('argument_replies')
    .select('argument_id')
    .in('argument_id', argIds)

  for (const r of replyCounts ?? []) {
    replyCountMap.set(r.argument_id, (replyCountMap.get(r.argument_id) ?? 0) + 1)
  }

  const enriched: TopicArgumentWithAuthor[] = rawArgs.map((a) => ({
    ...a,
    side: a.side as 'blue' | 'red',
    author: profileMap.get(a.user_id) ?? null,
    has_upvoted: upvotedArgIds.has(a.id),
    reply_count: replyCountMap.get(a.id) ?? 0,
  }))

  // Tell the client which argument belongs to the current user (if any)
  const myArgumentId = user
    ? (rawArgs.find((a) => a.user_id === user.id)?.id ?? null)
    : null

  return NextResponse.json({ arguments: enriched, myArgumentId })
}

// POST /api/topics/[id]/arguments
// Body: { side: 'blue' | 'red', content: string }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { side?: string; content?: string; source_url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { side, content, source_url } = body

  if (!side || !['blue', 'red'].includes(side)) {
    return NextResponse.json({ error: 'side must be "blue" or "red"' }, { status: 400 })
  }

  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const trimmed = content.trim()
  if (trimmed.length < 10 || trimmed.length > 500) {
    return NextResponse.json(
      { error: 'Argument must be between 10 and 500 characters' },
      { status: 400 }
    )
  }

  let normalizedUrl: string | null = null
  if (source_url && typeof source_url === 'string') {
    const u = source_url.trim()
    if (u) {
      try {
        const parsed = new URL(u)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return NextResponse.json({ error: 'Source URL must use http or https' }, { status: 400 })
        }
        if (u.length > 2000) {
          return NextResponse.json({ error: 'Source URL is too long' }, { status: 400 })
        }
        normalizedUrl = u
      } catch {
        return NextResponse.json({ error: 'Invalid source URL' }, { status: 400 })
      }
    }
  }

  const { data: inserted, error } = await supabase
    .from('topic_arguments')
    .insert({
      topic_id: params.id,
      user_id: user.id,
      side: side as 'blue' | 'red',
      content: trimmed,
      source_url: normalizedUrl,
    })
    .select('*')
    .single()

  if (error) {
    // Unique violation = user already posted an argument for this topic
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'You have already posted an argument for this topic' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Failed to post argument' }, { status: 500 })
  }

  return NextResponse.json({ argument: inserted }, { status: 201 })
}
