import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatchupLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
}

export interface CatchupTopicUpdate {
  topic_id: string
  statement: string
  category: string | null
  old_status: string | null
  new_status: string
  blue_pct: number
  total_votes: number
  user_side: 'blue' | 'red'
  user_won: boolean
}

export interface CatchupArgument {
  id: string
  topic_id: string
  topic_statement: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
}

export interface CatchupDebate {
  id: string
  topic_id: string
  topic_statement: string
  category: string | null
  debate_type: string
  scheduled_at: string
  status: string
}

export interface CatchupData {
  since: string
  hoursAway: number
  newLaws: CatchupLaw[]
  topicUpdates: CatchupTopicUpdate[]
  hotArguments: CatchupArgument[]
  upcomingDebates: CatchupDebate[]
  isAuthenticated: boolean
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()

  const sinceParam = request.nextUrl.searchParams.get('since')
  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(Date.now() - 24 * 60 * 60 * 1000)
  const sinceIso = since.toISOString()

  const hoursAway = Math.round(
    (Date.now() - since.getTime()) / (1000 * 60 * 60)
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── New laws since `since` ─────────────────────────────────────────────────
  const { data: lawRows } = await supabase
    .from('laws')
    .select('id, topic_id, statement, category, blue_pct, total_votes, established_at')
    .eq('is_active', true)
    .gte('established_at', sinceIso)
    .order('established_at', { ascending: false })
    .limit(10)

  const newLaws: CatchupLaw[] = (lawRows ?? []).map((r) => ({
    id: r.id as string,
    topic_id: r.topic_id as string,
    statement: r.statement as string,
    category: r.category as string | null,
    blue_pct: r.blue_pct as number,
    total_votes: r.total_votes as number,
    established_at: r.established_at as string,
  }))

  // ── Topics the user voted on that changed status ───────────────────────────
  let topicUpdates: CatchupTopicUpdate[] = []

  if (user) {
    const { data: votes } = await supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)

    const votedTopicIds = Array.from(
      new Set((votes ?? []).map((v) => v.topic_id as string))
    )
    const voteMap = new Map(
      (votes ?? []).map((v) => [v.topic_id as string, v.side as 'blue' | 'red'])
    )

    if (votedTopicIds.length > 0) {
      const { data: changedTopics } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes, updated_at')
        .in('id', votedTopicIds)
        .gte('updated_at', sinceIso)
        .in('status', ['active', 'voting', 'law', 'failed'])
        .order('updated_at', { ascending: false })
        .limit(20)

      topicUpdates = (changedTopics ?? []).map((t) => {
        const side = voteMap.get(t.id as string) ?? 'blue'
        const status = t.status as string
        const isLaw = status === 'law'
        const isFailed = status === 'failed'
        const userWon =
          (isLaw && side === 'blue') || (isFailed && side === 'red')

        return {
          topic_id: t.id as string,
          statement: t.statement as string,
          category: t.category as string | null,
          old_status: null,
          new_status: status,
          blue_pct: t.blue_pct as number,
          total_votes: t.total_votes as number,
          user_side: side,
          user_won: userWon,
        }
      })
    }
  }

  // ── Hot new arguments on topics user voted on ──────────────────────────────
  let hotArguments: CatchupArgument[] = []

  if (user) {
    const { data: votes } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const votedIds = Array.from(
      new Set((votes ?? []).map((v) => v.topic_id as string))
    )

    if (votedIds.length > 0) {
      const { data: argRows } = await supabase
        .from('topic_arguments')
        .select(
          `
          id,
          topic_id,
          content,
          side,
          upvotes,
          created_at,
          author:profiles!user_id(username, display_name, avatar_url),
          topic:topics!topic_id(statement)
        `
        )
        .in('topic_id', votedIds)
        .gte('created_at', sinceIso)
        .neq('user_id', user.id)
        .order('upvotes', { ascending: false })
        .limit(8)

      hotArguments = (argRows ?? []).map((r) => {
        const author = (r.author as unknown as { username: string; display_name: string | null; avatar_url: string | null } | null) ?? null
        const topic = (r.topic as unknown as { statement: string } | null) ?? null
        return {
          id: r.id as string,
          topic_id: r.topic_id as string,
          topic_statement: topic?.statement ?? '',
          author_username: author?.username ?? 'unknown',
          author_display_name: author?.display_name ?? null,
          author_avatar_url: author?.avatar_url ?? null,
          content: r.content as string,
          side: r.side as 'blue' | 'red',
          upvotes: r.upvotes as number,
          created_at: r.created_at as string,
        }
      })
    }
  } else {
    // For unauthenticated users: top arguments from the past period
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select(
        `
        id,
        topic_id,
        content,
        side,
        upvotes,
        created_at,
        author:profiles!user_id(username, display_name, avatar_url),
        topic:topics!topic_id(statement)
      `
      )
      .gte('created_at', sinceIso)
      .order('upvotes', { ascending: false })
      .limit(6)

    hotArguments = (argRows ?? []).map((r) => {
      const author = (r.author as unknown as { username: string; display_name: string | null; avatar_url: string | null } | null) ?? null
      const topic = (r.topic as unknown as { statement: string } | null) ?? null
      return {
        id: r.id as string,
        topic_id: r.topic_id as string,
        topic_statement: topic?.statement ?? '',
        author_username: author?.username ?? 'unknown',
        author_display_name: author?.display_name ?? null,
        author_avatar_url: author?.avatar_url ?? null,
        content: r.content as string,
        side: r.side as 'blue' | 'red',
        upvotes: r.upvotes as number,
        created_at: r.created_at as string,
      }
    })
  }

  // ── Upcoming debates in the next 48 hours ──────────────────────────────────
  const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data: debateRows } = await supabase
    .from('debates')
    .select(
      `
      id,
      topic_id,
      type,
      scheduled_at,
      status,
      topic:topics!topic_id(statement, category)
    `
    )
    .in('status', ['scheduled', 'live'])
    .gte('scheduled_at', new Date().toISOString())
    .lte('scheduled_at', in48h)
    .order('scheduled_at', { ascending: true })
    .limit(5)

  const upcomingDebates: CatchupDebate[] = (debateRows ?? []).map((r) => {
    const topic = (r.topic as unknown as { statement: string; category: string | null } | null) ?? null
    return {
      id: r.id as string,
      topic_id: r.topic_id as string,
      topic_statement: topic?.statement ?? '',
      category: topic?.category ?? null,
      debate_type: r.type as string,
      scheduled_at: r.scheduled_at as string,
      status: r.status as string,
    }
  })

  const result: CatchupData = {
    since: sinceIso,
    hoursAway,
    newLaws,
    topicUpdates,
    hotArguments,
    upcomingDebates,
    isAuthenticated: !!user,
  }

  return NextResponse.json(result)
}
