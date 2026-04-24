import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Return types ─────────────────────────────────────────────────────────────

export interface ImpactVotePoint {
  date: string
  forPct: number
  totalVotes: number
  dailyVotes: number
}

export interface ImpactArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface ImpactContinuation {
  id: string
  statement: string
  status: string
  blue_pct: number
  total_votes: number
}

export interface ImpactCoalitionStance {
  coalition_id: string
  coalition_name: string
  stance: 'for' | 'against' | 'neutral'
  member_count: number
}

export interface LawImpactData {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
    topic_id: string
  }
  topic: {
    id: string
    statement: string
    scope: string
    author_id: string | null
  } | null
  voteTimeline: ImpactVotePoint[]
  topArguments: ImpactArgument[]
  continuations: ImpactContinuation[]
  coalitionStances: ImpactCoalitionStance[]
  stats: {
    daysToLaw: number | null
    peakDailyVotes: number
    finalMajority: number
    forVotes: number
    againstVotes: number
    uniqueVoters: number
  }
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

  // 1. Fetch the law
  const { data: law, error: lawError } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', id)
    .single()

  if (lawError || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const topicId = law.topic_id

  // 2. Fetch source topic in parallel with votes
  const [topicResult, votesResult, argsResult, continResult, stancesResult] =
    await Promise.all([
      // Source topic
      supabase
        .from('topics')
        .select('id, statement, scope, author_id, created_at')
        .eq('id', topicId)
        .single(),

      // All votes on this topic for the timeline
      supabase
        .from('votes')
        .select('side, created_at')
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true })
        .limit(10000),

      // Top arguments (FOR and AGAINST)
      supabase
        .from('topic_arguments')
        .select('id, content, side, upvotes, user_id')
        .eq('topic_id', topicId)
        .is('parent_id', null)
        .order('upvotes', { ascending: false })
        .limit(20),

      // Child topics (continuation chains spawned from this topic)
      supabase
        .from('topics')
        .select('id, statement, status, blue_pct, total_votes')
        .eq('parent_id', topicId)
        .limit(10),

      // Coalition stances on this topic
      supabase
        .from('coalition_stances')
        .select('coalition_id, stance')
        .eq('topic_id', topicId)
        .limit(10),
    ])

  const topic = topicResult.data ?? null
  const votes = votesResult.data ?? []
  const rawArgs = argsResult.data ?? []
  const continuationLinks = continResult.data ?? []
  const rawStances = stancesResult.data ?? []

  // 3. Build vote timeline (cumulative, grouped by day)
  const byDay = new Map<string, { for: number; against: number }>()
  for (const vote of votes) {
    const day = vote.created_at.slice(0, 10)
    const bucket = byDay.get(day) ?? { for: 0, against: 0 }
    if (vote.side === 'blue') bucket.for++
    else bucket.against++
    byDay.set(day, bucket)
  }

  const sortedDays = Array.from(byDay.keys()).sort()
  let runningFor = 0
  let runningTotal = 0

  const voteTimeline: ImpactVotePoint[] = sortedDays.map((date) => {
    const day = byDay.get(date)!
    const dailyVotes = day.for + day.against
    runningFor += day.for
    runningTotal += dailyVotes
    return {
      date,
      forPct: runningTotal > 0 ? (runningFor / runningTotal) * 100 : 50,
      totalVotes: runningTotal,
      dailyVotes,
    }
  })

  // 4. Fetch argument authors
  const userIds = Array.from(new Set(rawArgs.map((a) => a.user_id).filter(Boolean)))
  const { data: profileRows } = userIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', userIds)
    : { data: [] }

  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id, p])
  )

  // Pick top 3 FOR and top 3 AGAINST
  const forArgs = rawArgs
    .filter((a) => a.side === 'blue')
    .slice(0, 3)
  const againstArgs = rawArgs
    .filter((a) => a.side === 'red')
    .slice(0, 3)

  function mapArg(a: (typeof rawArgs)[number]): ImpactArgument {
    const p = profileMap.get(a.user_id)
    return {
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvotes: a.upvotes ?? 0,
      author: p
        ? {
            id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            role: p.role,
          }
        : null,
    }
  }

  const topArguments: ImpactArgument[] = [
    ...forArgs.map(mapArg),
    ...againstArgs.map(mapArg),
  ]

  // 5. Map continuation topics (already fetched above)
  const continuations: ImpactContinuation[] = (continuationLinks ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    status: t.status,
    blue_pct: t.blue_pct ?? 50,
    total_votes: t.total_votes ?? 0,
  }))

  // 6. Enrich coalition stances with coalition info
  let coalitionStances: ImpactCoalitionStance[] = []
  if (rawStances.length > 0) {
    const coalitionIds = rawStances.map((s) => s.coalition_id)
    const { data: coalitionRows } = await supabase
      .from('coalitions')
      .select('id, name, member_count')
      .in('id', coalitionIds)

    const coalMap = new Map(
      (coalitionRows ?? []).map((c) => [c.id, c])
    )

    coalitionStances = rawStances.map((s) => {
      const c = coalMap.get(s.coalition_id)
      return {
        coalition_id: s.coalition_id,
        coalition_name: c?.name ?? 'Unknown Coalition',
        stance: s.stance as 'for' | 'against' | 'neutral',
        member_count: c?.member_count ?? 0,
      }
    })
  }

  // 7. Compute summary stats
  const totalFor = votes.filter((v) => v.side === 'blue').length
  const totalAgainst = votes.filter((v) => v.side === 'red').length
  const uniqueVoters = votes.length // approximate (one vote per user per topic)

  let daysToLaw: number | null = null
  if (topic?.created_at) {
    const created = new Date(topic.created_at).getTime()
    const established = new Date(law.established_at).getTime()
    daysToLaw = Math.max(0, Math.round((established - created) / (1000 * 60 * 60 * 24)))
  }

  const peakDailyVotes = voteTimeline.reduce(
    (max, p) => Math.max(max, p.dailyVotes),
    0
  )

  return NextResponse.json(
    {
      law: {
        id: law.id,
        statement: law.statement,
        category: law.category,
        blue_pct: law.blue_pct,
        total_votes: law.total_votes,
        established_at: law.established_at,
        topic_id: law.topic_id,
      },
      topic: topic
        ? {
            id: topic.id,
            statement: topic.statement,
            scope: topic.scope ?? 'Global',
            author_id: topic.author_id ?? null,
          }
        : null,
      voteTimeline,
      topArguments,
      continuations,
      coalitionStances,
      stats: {
        daysToLaw,
        peakDailyVotes,
        finalMajority: Math.round(law.blue_pct),
        forVotes: totalFor,
        againstVotes: totalAgainst,
        uniqueVoters,
      },
    } satisfies LawImpactData,
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    }
  )
}
