import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpvoteActivity {
  vote_created_at: string
  argument_id: string
  argument_content: string
  argument_side: 'blue' | 'red'
  argument_upvotes: number
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  voter: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface UpvotesActivityResponse {
  upvotes: UpvoteActivity[]
  totalCount: number
}

// ─── GET /api/activity/upvotes ────────────────────────────────────────────────
// Returns all upvotes received on the current user's arguments, newest first.
// Paginates via ?offset= and ?limit= query params.
// Optional ?category= and ?side= filters.

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const limit    = Math.min(50, Math.max(1, Number(searchParams.get('limit')    ?? 30)))
  const offset   = Math.max(0, Number(searchParams.get('offset') ?? 0))
  const category = searchParams.get('category') ?? null
  const side     = searchParams.get('side') ?? null   // 'blue' | 'red'
  const period   = searchParams.get('period') ?? null  // '7d' | '30d'

  // 1. Fetch the current user's arguments
  let argQuery = supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, topic_id')
    .eq('user_id', user.id)

  if (side === 'blue' || side === 'red') {
    argQuery = argQuery.eq('side', side)
  }

  const { data: myArgs, error: myArgsErr } = await argQuery

  if (myArgsErr) {
    return NextResponse.json({ error: 'Failed to load arguments' }, { status: 500 })
  }

  const args = myArgs ?? []
  if (args.length === 0) {
    return NextResponse.json({
      upvotes: [],
      totalCount: 0,
    } satisfies UpvotesActivityResponse)
  }

  let argIds = args.map((a) => a.id)

  // 2. Apply category filter: fetch topics and filter args by category
  if (category) {
    const topicIds = Array.from(new Set(args.map((a) => a.topic_id)))
    const { data: filteredTopics } = await supabase
      .from('topics')
      .select('id')
      .in('id', topicIds)
      .eq('category', category)

    const allowedTopicIds = new Set((filteredTopics ?? []).map((t) => t.id))
    argIds = argIds.filter((id) => {
      const arg = args.find((a) => a.id === id)
      return arg && allowedTopicIds.has(arg.topic_id)
    })

    if (argIds.length === 0) {
      return NextResponse.json({
        upvotes: [],
        totalCount: 0,
      } satisfies UpvotesActivityResponse)
    }
  }

  // 3. Build the votes query
  let votesQuery = supabase
    .from('topic_argument_votes')
    .select('argument_id, user_id, created_at', { count: 'exact' })
    .in('argument_id', argIds)
    .neq('user_id', user.id)       // skip self-upvotes
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (period === '7d') {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    votesQuery = votesQuery.gte('created_at', since)
  } else if (period === '30d') {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    votesQuery = votesQuery.gte('created_at', since)
  }

  const { data: rawVotes, error: votesErr, count } = await votesQuery

  if (votesErr) {
    return NextResponse.json({ error: 'Failed to load upvotes' }, { status: 500 })
  }

  const votes = rawVotes ?? []

  if (votes.length === 0) {
    return NextResponse.json({
      upvotes: [],
      totalCount: count ?? 0,
    } satisfies UpvotesActivityResponse)
  }

  // 4. Hydrate voter profiles
  const voterIds = Array.from(new Set(votes.map((v) => v.user_id)))
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', voterIds)

  const profileMap = new Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p)
  }

  // 5. Build arg map
  const argMap = new Map<string, { id: string; content: string; side: 'blue' | 'red'; upvotes: number; topic_id: string }>()
  for (const a of args) {
    argMap.set(a.id, a as { id: string; content: string; side: 'blue' | 'red'; upvotes: number; topic_id: string })
  }

  // 6. Hydrate topic statements
  const topicIds = Array.from(new Set(votes.map((v) => {
    const arg = argMap.get(v.argument_id)
    return arg?.topic_id
  }).filter(Boolean) as string[]))

  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .in('id', topicIds)

  const topicMap = new Map<string, { statement: string; category: string | null; status: string }>()
  for (const t of topics ?? []) {
    topicMap.set(t.id, { statement: t.statement, category: t.category, status: t.status })
  }

  // 7. Shape response
  const shaped: UpvoteActivity[] = votes.map((v) => {
    const arg   = argMap.get(v.argument_id)
    const topic = arg ? topicMap.get(arg.topic_id) : undefined

    return {
      vote_created_at:  v.created_at,
      argument_id:      v.argument_id,
      argument_content: arg?.content ?? '',
      argument_side:    (arg?.side ?? 'blue') as 'blue' | 'red',
      argument_upvotes: arg?.upvotes ?? 0,
      topic_id:         arg?.topic_id ?? '',
      topic_statement:  topic?.statement ?? 'Unknown topic',
      topic_category:   topic?.category ?? null,
      topic_status:     topic?.status ?? 'active',
      voter:            profileMap.get(v.user_id) ?? null,
    }
  })

  return NextResponse.json({
    upvotes: shaped,
    totalCount: count ?? 0,
  } satisfies UpvotesActivityResponse)
}
