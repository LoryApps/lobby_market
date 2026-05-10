import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type ReactionType = 'insightful' | 'compelling' | 'balanced' | 'needs_evidence'
export type ReactionPeriod = 'week' | 'month' | 'all'

export interface ReactedArgument {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_grade: string | null
  created_at: string
  reaction_count: number
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

export interface ReactionsLeaderboardResponse {
  arguments: ReactedArgument[]
  total: number
  reaction: ReactionType
  period: ReactionPeriod
}

const PERIOD_CUTOFFS: Record<ReactionPeriod, string | null> = {
  week: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  all: null,
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const reaction = (searchParams.get('reaction') ?? 'insightful') as ReactionType
  const period = (searchParams.get('period') ?? 'week') as ReactionPeriod
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)

  const validReactions: ReactionType[] = ['insightful', 'compelling', 'balanced', 'needs_evidence']
  if (!validReactions.includes(reaction)) {
    return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 })
  }

  const cutoff = PERIOD_CUTOFFS[period]

  // Step 1: Get argument_id counts for the requested reaction type
  let reactionsQuery = supabase
    .from('argument_reactions')
    .select('argument_id')
    .eq('reaction', reaction)

  if (cutoff) {
    reactionsQuery = reactionsQuery.gte('created_at', cutoff)
  }

  const { data: reactionRows, error: reactErr } = await reactionsQuery
  if (reactErr) {
    return NextResponse.json({ error: reactErr.message }, { status: 500 })
  }

  if (!reactionRows || reactionRows.length === 0) {
    return NextResponse.json({
      arguments: [],
      total: 0,
      reaction,
      period,
    } satisfies ReactionsLeaderboardResponse)
  }

  // Step 2: Count occurrences per argument
  const countMap = new Map<string, number>()
  for (const row of reactionRows) {
    const id = row.argument_id as string
    countMap.set(id, (countMap.get(id) ?? 0) + 1)
  }

  // Step 3: Sort by count descending, take top N
  const sorted = Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  const topIds = sorted.map(([id]) => id)

  // Step 4: Fetch argument details
  const { data: args, error: argsErr } = await supabase
    .from('topic_arguments')
    .select(
      `id, topic_id, side, content, upvotes, ai_grade, created_at,
       profiles:user_id (username, display_name, avatar_url, role),
       topics:topic_id (id, statement, category, status)`
    )
    .in('id', topIds)

  if (argsErr) {
    return NextResponse.json({ error: argsErr.message }, { status: 500 })
  }

  // Step 5: Enrich with reaction counts and sort to match original order
  const idToCount = new Map(sorted)
  const enriched: ReactedArgument[] = (args ?? [])
    .map((arg) => {
      const profiles = arg.profiles as { username: string; display_name: string | null; avatar_url: string | null; role: string } | null
      const topics = arg.topics as { id: string; statement: string; category: string | null; status: string } | null
      return {
        id: arg.id,
        topic_id: arg.topic_id,
        side: arg.side as 'blue' | 'red',
        content: arg.content,
        upvotes: arg.upvotes,
        ai_grade: arg.ai_grade as string | null,
        created_at: arg.created_at,
        reaction_count: idToCount.get(arg.id) ?? 0,
        author: profiles ?? null,
        topic: topics ?? null,
      }
    })
    .sort((a, b) => b.reaction_count - a.reaction_count)

  return NextResponse.json({
    arguments: enriched,
    total: countMap.size,
    reaction,
    period,
  } satisfies ReactionsLeaderboardResponse)
}
