import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TopicArgumentWithAuthor } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export interface LawArgumentsResponse {
  arguments: TopicArgumentWithAuthor[]
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string | null
    blue_pct: number
    total_votes: number
    topic_id: string | null
  }
  totalFor: number
  totalAgainst: number
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id: lawId } = params
    const sort = req.nextUrl.searchParams.get('sort') ?? 'top'

    const { data: { user } } = await supabase.auth.getUser()

    // Fetch the law to get its topic_id
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, statement, category, established_at, blue_pct, total_votes, topic_id')
      .eq('id', lawId)
      .maybeSingle()

    if (lawError || !law) {
      return NextResponse.json({ error: 'Law not found' }, { status: 404 })
    }

    if (!law.topic_id) {
      return NextResponse.json({
        arguments: [],
        law,
        totalFor: 0,
        totalAgainst: 0,
      } satisfies LawArgumentsResponse)
    }

    // Build argument query
    let query = supabase
      .from('topic_arguments')
      .select('*')
      .eq('topic_id', law.topic_id)
      .limit(100)

    if (sort === 'new') {
      query = query.order('created_at', { ascending: false })
    } else if (sort === 'quality') {
      query = query
        .order('ai_score', { ascending: false, nullsFirst: false })
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: false })
    } else {
      query = query
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: false })
    }

    const { data: rawArgs, error: argsError } = await query

    if (argsError) throw argsError

    if (!rawArgs || rawArgs.length === 0) {
      return NextResponse.json({
        arguments: [],
        law,
        totalFor: 0,
        totalAgainst: 0,
      } satisfies LawArgumentsResponse)
    }

    const userIds = Array.from(new Set(rawArgs.map((a) => a.user_id)))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds)

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    )

    const argIds = rawArgs.map((a) => a.id)

    // Upvoted set for current user
    const upvotedSet = new Set<string>()
    if (user) {
      const { data: votes } = await supabase
        .from('topic_argument_votes')
        .select('argument_id')
        .in('argument_id', argIds)
        .eq('user_id', user.id)
      for (const v of votes ?? []) upvotedSet.add(v.argument_id)
    }

    // Reply counts
    const replyCounts = new Map<string, number>()
    const { data: replies } = await supabase
      .from('argument_replies')
      .select('argument_id')
      .in('argument_id', argIds)
    for (const r of replies ?? []) {
      replyCounts.set(r.argument_id, (replyCounts.get(r.argument_id) ?? 0) + 1)
    }

    const enriched: TopicArgumentWithAuthor[] = rawArgs.map((a) => ({
      ...a,
      side: a.side as 'blue' | 'red',
      author: profileMap.get(a.user_id) ?? null,
      has_upvoted: upvotedSet.has(a.id),
      reply_count: replyCounts.get(a.id) ?? 0,
    }))

    const totalFor = rawArgs.filter((a) => a.side === 'blue').length
    const totalAgainst = rawArgs.filter((a) => a.side === 'red').length

    return NextResponse.json({
      arguments: enriched,
      law,
      totalFor,
      totalAgainst,
    } satisfies LawArgumentsResponse)
  } catch (err) {
    console.error('[law-arguments GET]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
