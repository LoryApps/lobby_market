import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyArgumentAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_arguments: number
}

export interface DailyArgumentTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string
}

export interface DailyArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  author: DailyArgumentAuthor | null
  topic: DailyArgumentTopic | null
  // Companion: the opposite-side top argument on the same topic
  counterpart: {
    id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
    author: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  } | null
  // How the topic shifted since this argument was posted
  impact_note: string | null
}

export interface DailyArgumentResponse {
  today: DailyArgument
  yesterday: DailyArgument | null
  day_index: number
  arg_index: number
  total_eligible: number
  next_refresh_ms: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dayIndex(): number {
  const epoch = new Date('2024-01-01T00:00:00Z').getTime()
  const now = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  )
  return Math.floor((now - epoch) / 86_400_000)
}

function msUntilMidnightUTC(): number {
  const now = new Date()
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  )
  return midnight.getTime() - now.getTime()
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function buildDailyArgument(
  supabase: Awaited<ReturnType<typeof createClient>>,
  allArgs: Array<{
    id: string
    topic_id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
    created_at: string
    author: DailyArgumentAuthor | null
    topic: DailyArgumentTopic | null
  }>,
  idx: number
): Promise<DailyArgument | null> {
  if (allArgs.length === 0) return null
  const picked = allArgs[idx % allArgs.length]

  // Fetch counterpart (best opposite-side arg on the same topic)
  const counterpartSide = picked.side === 'blue' ? 'red' : 'blue'
  const { data: counterpartRows } = await supabase
    .from('topic_arguments')
    .select(`
      id, content, side, upvotes,
      author:profiles!topic_arguments_user_id_fkey(
        username, display_name, avatar_url, role
      )
    `)
    .eq('topic_id', picked.topic_id)
    .eq('side', counterpartSide)
    .order('upvotes', { ascending: false })
    .limit(1)

  const counterpart = counterpartRows?.[0] ?? null

  // Build a brief impact note based on topic status and vote split
  let impact_note: string | null = null
  if (picked.topic) {
    const t = picked.topic
    if (t.status === 'law') {
      impact_note = `This topic reached consensus at ${t.blue_pct}% FOR and became law.`
    } else if (t.status === 'voting') {
      const lead = t.blue_pct >= 50 ? 'FOR' : 'AGAINST'
      impact_note = `Now in final voting — ${lead} leads at ${t.blue_pct}% on ${t.total_votes.toLocaleString()} votes.`
    } else if (t.status === 'active') {
      const lead = t.blue_pct >= 50 ? 'FOR' : 'AGAINST'
      impact_note = `${lead} leads ${t.blue_pct}% on ${t.total_votes.toLocaleString()} votes — debate still open.`
    }
  }

  return {
    id: picked.id,
    content: picked.content,
    side: picked.side,
    upvotes: picked.upvotes,
    created_at: picked.created_at,
    author: picked.author,
    topic: picked.topic,
    counterpart: counterpart
      ? {
          id: counterpart.id,
          content: counterpart.content,
          side: counterpart.side,
          upvotes: counterpart.upvotes,
          author: counterpart.author as DailyArgument['counterpart'] extends null ? never : NonNullable<DailyArgument['counterpart']>['author'],
        }
      : null,
    impact_note,
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch high-quality arguments (≥ 3 upvotes, at least 1 day old)
    // ordered deterministically — highest upvotes first, then oldest
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)

    const { data: args, error } = await supabase
      .from('topic_arguments')
      .select(`
        id, topic_id, content, side, upvotes, created_at,
        author:profiles!topic_arguments_user_id_fkey(
          id, username, display_name, avatar_url, role, clout, total_arguments
        ),
        topic:topics!topic_arguments_topic_id_fkey(
          id, statement, category, status, blue_pct, total_votes, scope
        )
      `)
      .gte('upvotes', 3)
      .lte('created_at', yesterday.toISOString())
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(500)

    if (error || !args || args.length === 0) {
      // Fallback: no upvote filter
      const { data: fallback } = await supabase
        .from('topic_arguments')
        .select(`
          id, topic_id, content, side, upvotes, created_at,
          author:profiles!topic_arguments_user_id_fkey(
            id, username, display_name, avatar_url, role, clout, total_arguments
          ),
          topic:topics!topic_arguments_topic_id_fkey(
            id, statement, category, status, blue_pct, total_votes, scope
          )
        `)
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(100)

      if (!fallback || fallback.length === 0) {
        return NextResponse.json({ error: 'No arguments found' }, { status: 404 })
      }

      const typedFallback = fallback as typeof args
      const idx = dayIndex()
      const today = await buildDailyArgument(supabase, typedFallback as Parameters<typeof buildDailyArgument>[1], idx)
      if (!today) return NextResponse.json({ error: 'No arguments found' }, { status: 404 })

      return NextResponse.json({
        today,
        yesterday: null,
        day_index: idx,
        arg_index: idx % typedFallback.length,
        total_eligible: typedFallback.length,
        next_refresh_ms: msUntilMidnightUTC(),
      } satisfies DailyArgumentResponse)
    }

    const typedArgs = args as Array<{
      id: string
      topic_id: string
      content: string
      side: 'blue' | 'red'
      upvotes: number
      created_at: string
      author: DailyArgumentAuthor | null
      topic: DailyArgumentTopic | null
    }>

    const idx = dayIndex()
    const todayArg = await buildDailyArgument(supabase, typedArgs, idx)
    const yesterdayArg = typedArgs.length > 1
      ? await buildDailyArgument(supabase, typedArgs, idx - 1)
      : null

    if (!todayArg) {
      return NextResponse.json({ error: 'No arguments found' }, { status: 404 })
    }

    return NextResponse.json({
      today: todayArg,
      yesterday: yesterdayArg,
      day_index: idx,
      arg_index: idx % typedArgs.length,
      total_eligible: typedArgs.length,
      next_refresh_ms: msUntilMidnightUTC(),
    } satisfies DailyArgumentResponse)
  } catch (err) {
    console.error('[api/arguments/daily]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
