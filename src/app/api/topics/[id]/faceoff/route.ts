import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FaceoffArg {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_grade: string | null
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  arena: {
    wins: number
    bouts: number
    win_pct: number | null
  }
}

export interface TopicFaceoffPair {
  for_arg: FaceoffArg | null
  against_arg: FaceoffArg | null
  /** winner_id of the user's existing vote on this pair, or null if not voted */
  user_vote: string | null
}

export interface TopicFaceoffLeader {
  id: string
  content: string
  side: 'blue' | 'red'
  wins: number
  bouts: number
  win_pct: number
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
}

export interface TopicFaceoffResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    status: string
  }
  pair: TopicFaceoffPair
  /** Top argument leaders for this topic by faceoff wins */
  leaderboard: TopicFaceoffLeader[]
  total_faceoffs: number
}

// ─── GET — serve a FOR vs AGAINST pair for a specific topic ──────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Load topic
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, status')
    .eq('id', params.id)
    .maybeSingle()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Load all arguments for this topic (need both sides)
  const { data: args } = await supabase
    .from('topic_arguments')
    .select(`
      id, content, side, upvotes, ai_grade,
      profiles!inner ( id, username, display_name, avatar_url )
    `)
    .eq('topic_id', params.id)
    .gte('upvotes', 0)
    .order('upvotes', { ascending: false })
    .limit(50)

  const forArgs = (args ?? []).filter(a => a.side === 'blue')
  const againstArgs = (args ?? []).filter(a => a.side === 'red')

  const allArgIds = (args ?? []).map(a => a.id)

  // Load arena stats for all arguments in this topic
  const boutMap: Record<string, number> = {}
  const winMap: Record<string, number> = {}

  if (allArgIds.length > 0) {
    const { data: boutRows } = await supabase
      .from('argument_faceoff_votes')
      .select('argument_a_id, argument_b_id, winner_id')
      .or(allArgIds.map(id => `argument_a_id.eq.${id},argument_b_id.eq.${id}`).join(','))

    for (const id of allArgIds) {
      boutMap[id] = (boutRows ?? []).filter(
        v => v.argument_a_id === id || v.argument_b_id === id
      ).length
      winMap[id] = (boutRows ?? []).filter(v => v.winner_id === id).length
    }
  }

  function toFaceoffArg(raw: NonNullable<typeof args>[0]): FaceoffArg {
    const profile = Array.isArray((raw as unknown as { profiles: unknown }).profiles)
      ? (raw as unknown as { profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null }[] }).profiles[0]
      : (raw as unknown as { profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null } }).profiles
    const bouts = boutMap[raw.id] ?? 0
    const wins = winMap[raw.id] ?? 0
    return {
      id: raw.id,
      content: raw.content,
      side: raw.side as 'blue' | 'red',
      upvotes: raw.upvotes,
      ai_grade: raw.ai_grade,
      author: profile,
      arena: {
        wins,
        bouts,
        win_pct: bouts > 0 ? Math.round((wins / bouts) * 100) : null,
      },
    }
  }

  // Find a fresh pair the user hasn't seen yet
  let forArg: FaceoffArg | null = null
  let againstArg: FaceoffArg | null = null
  let userVote: string | null = null

  const seenPairKeys = new Set<string>()

  if (user && forArgs.length > 0 && againstArgs.length > 0) {
    // Collect pairs the user already voted on
    const { data: userVotes } = await supabase
      .from('argument_faceoff_votes')
      .select('argument_a_id, argument_b_id, winner_id')
      .eq('user_id', user.id)
      .in('argument_a_id', allArgIds)

    for (const v of userVotes ?? []) {
      seenPairKeys.add(`${v.argument_a_id}|${v.argument_b_id}`)
    }

    // Try each FOR arg with each AGAINST arg (sorted by upvotes desc) to find unseen pair
    outerLoop: for (const fa of forArgs) {
      for (const aa of againstArgs) {
        const [canonA, canonB] = [fa.id, aa.id].sort()
        const key = `${canonA}|${canonB}`
        if (!seenPairKeys.has(key)) {
          forArg = toFaceoffArg(fa)
          againstArg = toFaceoffArg(aa)
          break outerLoop
        }
      }
    }

    // If all pairs seen, just return the top pair (show results)
    if (!forArg && forArgs.length > 0) {
      forArg = toFaceoffArg(forArgs[0])
    }
    if (!againstArg && againstArgs.length > 0) {
      againstArg = toFaceoffArg(againstArgs[0])
    }

    // Check if user has voted on the returned pair
    if (forArg && againstArg) {
      const [canonA, canonB] = [forArg.id, againstArg.id].sort()
      const { data: existingVote } = await supabase
        .from('argument_faceoff_votes')
        .select('winner_id')
        .eq('user_id', user.id)
        .eq('argument_a_id', canonA)
        .eq('argument_b_id', canonB)
        .maybeSingle()
      userVote = existingVote?.winner_id ?? null
    }
  } else {
    // Unauthenticated — show top pair
    if (forArgs.length > 0) forArg = toFaceoffArg(forArgs[0])
    if (againstArgs.length > 0) againstArg = toFaceoffArg(againstArgs[0])
  }

  // Total faceoffs for this topic
  const totalFaceoffs = allArgIds.length > 0
    ? Object.values(boutMap).reduce((s, n) => s + n, 0) / 2
    : 0

  // Leaderboard: top 5 arguments by wins
  const leaderboard: TopicFaceoffLeader[] = (args ?? [])
    .filter(a => (winMap[a.id] ?? 0) > 0)
    .sort((a, b) => (winMap[b.id] ?? 0) - (winMap[a.id] ?? 0))
    .slice(0, 5)
    .map(a => {
      const fa = toFaceoffArg(a)
      return {
        id: fa.id,
        content: fa.content,
        side: fa.side,
        wins: fa.arena.wins,
        bouts: fa.arena.bouts,
        win_pct: fa.arena.win_pct ?? 0,
        author: fa.author,
      }
    })

  return NextResponse.json({
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
      status: topic.status,
    },
    pair: {
      for_arg: forArg,
      against_arg: againstArg,
      user_vote: userVote,
    },
    leaderboard,
    total_faceoffs: Math.round(totalFaceoffs),
  } satisfies TopicFaceoffResponse)
}
