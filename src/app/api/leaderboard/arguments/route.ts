import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArgumentRanked {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  source_url: string | null
  created_at: string
  author: {
    id: string
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
  rank: number
}

export interface ArgumentsLeaderboardResponse {
  allTime: ArgumentRanked[]
  thisWeek: ArgumentRanked[]
  forCamp: ArgumentRanked[]
  againstCamp: ArgumentRanked[]
  rising: ArgumentRanked[]
  generatedAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function attachRanks(rows: ArgumentRanked[]): ArgumentRanked[] {
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

// ─── GET /api/leaderboard/arguments ──────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const ARG_SELECT = `
    id, content, side, upvotes, source_url, created_at,
    author:profiles!topic_arguments_user_id_fkey(
      id, username, display_name, avatar_url, role
    ),
    topic:topics!topic_arguments_topic_id_fkey(
      id, statement, category, status
    )
  `

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

  const [
    allTimeRes,
    thisWeekRes,
    forCampRes,
    againstCampRes,
    risingRes,
  ] = await Promise.all([
    // All-time most upvoted
    supabase
      .from('topic_arguments')
      .select(ARG_SELECT)
      .order('upvotes', { ascending: false })
      .gt('upvotes', 0)
      .limit(25),

    // Most upvoted this week
    supabase
      .from('topic_arguments')
      .select(ARG_SELECT)
      .gte('created_at', weekAgo)
      .order('upvotes', { ascending: false })
      .gt('upvotes', 0)
      .limit(25),

    // Top FOR arguments
    supabase
      .from('topic_arguments')
      .select(ARG_SELECT)
      .eq('side', 'blue')
      .order('upvotes', { ascending: false })
      .gt('upvotes', 0)
      .limit(25),

    // Top AGAINST arguments
    supabase
      .from('topic_arguments')
      .select(ARG_SELECT)
      .eq('side', 'red')
      .order('upvotes', { ascending: false })
      .gt('upvotes', 0)
      .limit(25),

    // Rising: last 48h, most upvoted
    supabase
      .from('topic_arguments')
      .select(ARG_SELECT)
      .gte('created_at', twoDaysAgo)
      .order('upvotes', { ascending: false })
      .limit(25),
  ])

  function normalize(rows: unknown[]): ArgumentRanked[] {
    return (rows as ArgumentRanked[]).map((r) => ({
      id: r.id,
      content: r.content,
      side: r.side,
      upvotes: r.upvotes ?? 0,
      source_url: r.source_url ?? null,
      created_at: r.created_at,
      author: r.author ?? null,
      topic: r.topic ?? null,
      rank: 0,
    }))
  }

  const allTime = attachRanks(normalize(allTimeRes.data ?? []))
  const thisWeek = attachRanks(normalize(thisWeekRes.data ?? []))
  const forCamp = attachRanks(normalize(forCampRes.data ?? []))
  const againstCamp = attachRanks(normalize(againstCampRes.data ?? []))
  const rising = attachRanks(normalize(risingRes.data ?? []))

  const response: ArgumentsLeaderboardResponse = {
    allTime,
    thisWeek,
    forCamp,
    againstCamp,
    rising,
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
