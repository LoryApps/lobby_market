import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FaceoffArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_grade: string | null
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  }
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

export interface FaceoffPair {
  a: FaceoffArgument
  b: FaceoffArgument
  category: string | null
  // null = unauthenticated or not yet voted
  user_vote: string | null
}

export interface FaceoffResponse {
  pair: FaceoffPair | null
  daily_count: number
  daily_limit: number
  leaderboard: FaceoffLeader[]
}

export interface FaceoffLeader {
  id: string
  content: string
  side: 'blue' | 'red'
  wins: number
  bouts: number
  win_pct: number
  topic: {
    id: string
    statement: string
    category: string | null
  }
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
}

const DAILY_LIMIT = 10

// ─── GET — serve a new matchup pair ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const category = req.nextUrl.searchParams.get('category') ?? null

  // Count how many faceoffs the user has done today
  let dailyCount = 0
  const seenPairKeys: Set<string> = new Set()

  if (user) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)

    const { data: todayVotes } = await supabase
      .from('argument_faceoff_votes')
      .select('argument_a_id, argument_b_id')
      .eq('user_id', user.id)
      .gte('created_at', dayStart.toISOString())

    dailyCount = todayVotes?.length ?? 0

    // Track already-seen pairs so we don't show duplicates this session
    for (const v of todayVotes ?? []) {
      seenPairKeys.add(`${v.argument_a_id}|${v.argument_b_id}`)
    }
  }

  // ── Leaderboard: top 5 arena champions ────────────────────────────────────
  const { data: topWinners } = await supabase
    .from('argument_faceoff_votes')
    .select('winner_id')
    .limit(1000)

  // Tally wins per argument
  const winMap: Record<string, number> = {}
  const boutMap: Record<string, number> = {}

  for (const v of topWinners ?? []) {
    winMap[v.winner_id] = (winMap[v.winner_id] ?? 0) + 1
  }

  // Sort by wins descending, take top 5
  const topArgIds = Object.entries(winMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id)

  let leaderboard: FaceoffLeader[] = []

  if (topArgIds.length > 0) {
    const { data: leaderArgs } = await supabase
      .from('topic_arguments')
      .select(`
        id, content, side, upvotes, created_at,
        topics!inner ( id, statement, category, status ),
        profiles!inner ( username, display_name, avatar_url )
      `)
      .in('id', topArgIds)

    // Also count total bouts for each
    const { data: boutData } = await supabase
      .from('argument_faceoff_votes')
      .select('argument_a_id, argument_b_id')
      .or(topArgIds.map(id => `argument_a_id.eq.${id},argument_b_id.eq.${id}`).join(','))

    for (const id of topArgIds) {
      boutMap[id] = (boutData ?? []).filter(
        v => v.argument_a_id === id || v.argument_b_id === id
      ).length
    }

    leaderboard = (leaderArgs ?? [])
      .map(arg => {
        const wins = winMap[arg.id] ?? 0
        const bouts = boutMap[arg.id] ?? 0
        const topic = Array.isArray((arg as unknown as { topics: unknown }).topics)
          ? (arg as unknown as { topics: { id: string; statement: string; category: string | null }[] }).topics[0]
          : (arg as unknown as { topics: { id: string; statement: string; category: string | null } }).topics
        const profile = Array.isArray((arg as unknown as { profiles: unknown }).profiles)
          ? (arg as unknown as { profiles: { username: string; display_name: string | null; avatar_url: string | null }[] }).profiles[0]
          : (arg as unknown as { profiles: { username: string; display_name: string | null; avatar_url: string | null } }).profiles
        return {
          id: arg.id,
          content: arg.content,
          side: arg.side,
          wins,
          bouts,
          win_pct: bouts > 0 ? Math.round((wins / bouts) * 100) : 0,
          topic,
          author: profile,
        } satisfies FaceoffLeader
      })
      .sort((a, b) => b.wins - a.wins)
  }

  // ── Pair selection ─────────────────────────────────────────────────────────
  // Even if at limit, return leaderboard (pair will be null)
  if (dailyCount >= DAILY_LIMIT) {
    return NextResponse.json({
      pair: null,
      daily_count: dailyCount,
      daily_limit: DAILY_LIMIT,
      leaderboard,
    } satisfies FaceoffResponse)
  }

  // Pick two quality arguments from DIFFERENT topics
  let query = supabase
    .from('topic_arguments')
    .select(`
      id, content, side, upvotes, ai_grade, created_at,
      topics!inner ( id, statement, category, status ),
      profiles!inner ( id, username, display_name, avatar_url )
    `)
    .gte('upvotes', 1)
    .in('topics.status', ['active', 'voting', 'law'])

  if (category && category !== 'all') {
    query = query.eq('topics.category', category)
  }

  const { data: pool } = await query
    .order('upvotes', { ascending: false })
    .limit(80)

  if (!pool || pool.length < 2) {
    return NextResponse.json({
      pair: null,
      daily_count: dailyCount,
      daily_limit: DAILY_LIMIT,
      leaderboard,
    } satisfies FaceoffResponse)
  }

  // Shuffle and find a pair from different topics not seen today
  const shuffled = [...pool].sort(() => Math.random() - 0.5)

  let argA: (typeof pool)[0] | null = null
  let argB: (typeof pool)[0] | null = null

  for (let i = 0; i < shuffled.length && !argB; i++) {
    const candidate = shuffled[i]
    const topicA = Array.isArray((candidate as unknown as { topics: unknown }).topics)
      ? (candidate as unknown as { topics: { id: string }[] }).topics[0]
      : (candidate as unknown as { topics: { id: string } }).topics

    if (!argA) {
      argA = candidate
      continue
    }

    const topicA2 = Array.isArray((argA as unknown as { topics: unknown }).topics)
      ? (argA as unknown as { topics: { id: string }[] }).topics[0]
      : (argA as unknown as { topics: { id: string } }).topics

    if (topicA.id === topicA2.id) continue
    if (candidate.id === argA.id) continue

    // Check if this pair was already seen (canonical order)
    const [smallId, bigId] = [argA.id, candidate.id].sort()
    if (seenPairKeys.has(`${smallId}|${bigId}`)) continue

    argB = candidate
  }

  if (!argA || !argB) {
    return NextResponse.json({
      pair: null,
      daily_count: dailyCount,
      daily_limit: DAILY_LIMIT,
      leaderboard,
    } satisfies FaceoffResponse)
  }

  function toFaceoffArg(raw: (typeof pool)[0], wins: number, bouts: number): FaceoffArgument {
    const topic = Array.isArray((raw as unknown as { topics: unknown }).topics)
      ? (raw as unknown as { topics: { id: string; statement: string; category: string | null; status: string }[] }).topics[0]
      : (raw as unknown as { topics: { id: string; statement: string; category: string | null; status: string } }).topics
    const profile = Array.isArray((raw as unknown as { profiles: unknown }).profiles)
      ? (raw as unknown as { profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null }[] }).profiles[0]
      : (raw as unknown as { profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null } }).profiles
    return {
      id: raw.id,
      content: raw.content,
      side: raw.side,
      upvotes: raw.upvotes,
      ai_grade: raw.ai_grade,
      created_at: raw.created_at,
      topic,
      author: profile,
      arena: { wins, bouts, win_pct: bouts > 0 ? Math.round((wins / bouts) * 100) : null },
    }
  }

  // Fetch arena stats for the two chosen arguments
  const twoIds = [argA.id, argB.id]
  const { data: boutRows } = await supabase
    .from('argument_faceoff_votes')
    .select('argument_a_id, argument_b_id, winner_id')
    .or(twoIds.map(id => `argument_a_id.eq.${id},argument_b_id.eq.${id}`).join(','))

  for (const id of twoIds) {
    boutMap[id] = (boutRows ?? []).filter(
      v => v.argument_a_id === id || v.argument_b_id === id
    ).length
    winMap[id] = (boutRows ?? []).filter(v => v.winner_id === id).length
  }

  const topicA = Array.isArray((argA as unknown as { topics: unknown }).topics)
    ? (argA as unknown as { topics: { category: string | null }[] }).topics[0]
    : (argA as unknown as { topics: { category: string | null } }).topics

  const pair: FaceoffPair = {
    a: toFaceoffArg(argA, winMap[argA.id] ?? 0, boutMap[argA.id] ?? 0),
    b: toFaceoffArg(argB, winMap[argB.id] ?? 0, boutMap[argB.id] ?? 0),
    category: topicA.category,
    user_vote: null,
  }

  return NextResponse.json({
    pair,
    daily_count: dailyCount,
    daily_limit: DAILY_LIMIT,
    leaderboard,
  } satisfies FaceoffResponse)
}

// ─── POST — record a vote ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json() as {
    argument_a_id: string
    argument_b_id: string
    winner_id: string
  }

  const { argument_a_id, argument_b_id, winner_id } = body

  if (!argument_a_id || !argument_b_id || !winner_id) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  if (winner_id !== argument_a_id && winner_id !== argument_b_id) {
    return NextResponse.json({ error: 'winner_id must be one of the two arguments' }, { status: 400 })
  }

  // Canonical ordering: sort IDs so the UNIQUE constraint works regardless of display order
  const [canonA, canonB] = [argument_a_id, argument_b_id].sort()

  const { error } = await supabase
    .from('argument_faceoff_votes')
    .insert({
      user_id: user.id,
      argument_a_id: canonA,
      argument_b_id: canonB,
      winner_id,
    })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already voted on this pair' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return updated stats for both arguments
  const { data: boutRows } = await supabase
    .from('argument_faceoff_votes')
    .select('argument_a_id, argument_b_id, winner_id')
    .or([canonA, canonB].map(id => `argument_a_id.eq.${id},argument_b_id.eq.${id}`).join(','))

  const stats: Record<string, { wins: number; bouts: number; win_pct: number }> = {}
  for (const id of [canonA, canonB]) {
    const bouts = (boutRows ?? []).filter(v => v.argument_a_id === id || v.argument_b_id === id).length
    const wins = (boutRows ?? []).filter(v => v.winner_id === id).length
    stats[id] = {
      wins,
      bouts,
      win_pct: bouts > 0 ? Math.round((wins / bouts) * 100) : 0,
    }
  }

  return NextResponse.json({ ok: true, stats })
}
