import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HotSeatArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvote_count: number
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
}

export interface HotSeatTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  scope: string | null
  created_at: string
  /** How contested the topic is — 0 = perfectly split, 50 = one-sided */
  divisiveness: number
  top_for_args: HotSeatArgument[]
  top_against_args: HotSeatArgument[]
}

export interface HotSeatResponse {
  topic: HotSeatTopic | null
  /** ISO date string for today (YYYY-MM-DD) */
  date: string
  computed_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const now = Date.now()

  // Today's date stamp — the hot seat topic is stable for the whole UTC day.
  const todayDate = new Date(now).toISOString().slice(0, 10)

  const TOPIC_COLS =
    'id, statement, category, status, blue_pct, total_votes, voting_ends_at, scope, created_at'

  // Fetch the most contested active/voting topics — those closest to 50/50
  // Minimum 50 votes so we don't feature a brand-new topic with no engagement.
  const [votingRes, activeRes] = await Promise.all([
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .eq('status', 'voting')
      .gt('total_votes', 50)
      .gte('blue_pct', 30)
      .lte('blue_pct', 70)
      .order('total_votes', { ascending: false })
      .limit(60),

    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .eq('status', 'active')
      .gt('total_votes', 100)
      .gte('blue_pct', 35)
      .lte('blue_pct', 65)
      .order('total_votes', { ascending: false })
      .limit(40),
  ])

  type RawTopic = {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    voting_ends_at: string | null
    scope: string | null
    created_at: string
  }

  const candidates: RawTopic[] = [
    ...((votingRes.data as RawTopic[] | null) ?? []),
    ...((activeRes.data as RawTopic[] | null) ?? []),
  ]

  if (candidates.length === 0) {
    return NextResponse.json({
      topic: null,
      date: todayDate,
      computed_at: new Date(now).toISOString(),
    } satisfies HotSeatResponse)
  }

  // Score by divisiveness (distance from 50) — lower = more contested
  const scored = candidates
    .map((t) => ({
      ...t,
      divisiveness: Math.abs(t.blue_pct - 50),
    }))
    .sort((a, b) => a.divisiveness - b.divisiveness)

  // Pick deterministically for the day: use date hash to cycle through top-10
  // so the hot seat rotates across the most contested topics daily.
  const TOP_N = Math.min(10, scored.length)
  const dateHash = todayDate
    .split('-')
    .reduce((acc, part) => acc + parseInt(part, 10), 0)
  const picked = scored[dateHash % TOP_N]

  // Fetch top FOR and AGAINST arguments for the picked topic
  const { data: argRows } = await supabase
    .from('arguments')
    .select(`
      id,
      content,
      side,
      upvote_count,
      author:profiles!arguments_author_id_fkey (
        username,
        display_name,
        avatar_url,
        role
      )
    `)
    .eq('topic_id', picked.id)
    .eq('is_deleted', false)
    .in('side', ['blue', 'red'])
    .order('upvote_count', { ascending: false })
    .limit(30)

  type ArgRow = {
    id: string
    content: string
    side: string
    upvote_count: number
    author: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null
  }

  function toHotSeatArg(a: ArgRow): HotSeatArgument {
    return {
      id: a.id,
      content: a.content,
      side: a.side as 'blue' | 'red',
      upvote_count: a.upvote_count,
      author_username: a.author?.username ?? 'anonymous',
      author_display_name: a.author?.display_name ?? null,
      author_avatar_url: a.author?.avatar_url ?? null,
      author_role: a.author?.role ?? 'person',
    }
  }

  const args = (argRows as ArgRow[] | null) ?? []
  const topForArgs = args.filter((a) => a.side === 'blue').slice(0, 3).map(toHotSeatArg)
  const topAgainstArgs = args.filter((a) => a.side === 'red').slice(0, 3).map(toHotSeatArg)

  const topic: HotSeatTopic = {
    id: picked.id,
    statement: picked.statement,
    category: picked.category,
    status: picked.status,
    blue_pct: picked.blue_pct,
    total_votes: picked.total_votes,
    voting_ends_at: picked.voting_ends_at,
    scope: picked.scope,
    created_at: picked.created_at,
    divisiveness: picked.divisiveness,
    top_for_args: topForArgs,
    top_against_args: topAgainstArgs,
  }

  return NextResponse.json({
    topic,
    date: todayDate,
    computed_at: new Date(now).toISOString(),
  } satisfies HotSeatResponse)
}
