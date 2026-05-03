import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyPromptTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string
  blue_pct: number
  total_votes: number
  description: string | null
  top_for_argument: {
    id: string
    content: string
    upvotes: number
    author_username: string
    author_display_name: string | null
    author_avatar_url: string | null
    author_role: string
  } | null
  top_against_argument: {
    id: string
    content: string
    upvotes: number
    author_username: string
    author_display_name: string | null
    author_avatar_url: string | null
    author_role: string
  } | null
}

export interface DailyPromptResponse {
  topic: DailyPromptTopic
  date: string
  user_vote: 'blue' | 'red' | null
  user_reason: string | null
  hot_takes: Array<{
    side: 'blue' | 'red'
    reason: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  }>
}

// ─── Deterministic daily topic selection ──────────────────────────────────────

function getDailyTopicIndex(topicIds: string[], date: string): number {
  let hash = 0
  const str = date + topicIds.join('')
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff
  }
  return Math.abs(hash) % topicIds.length
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const today = todayKey()

  // ── 1. Pick today's topic ────────────────────────────────────────────────
  const { data: candidateRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, description')
    .in('status', ['active', 'voting'])
    .gte('total_votes', 5)
    .gte('blue_pct', 10)
    .lte('blue_pct', 90)
    .order('feed_score', { ascending: false })
    .limit(60)

  const candidates = candidateRows ?? []

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No topics available' }, { status: 404 })
  }

  const idx = getDailyTopicIndex(
    candidates.map((t) => t.id),
    today
  )
  const raw = candidates[idx] as {
    id: string
    statement: string
    category: string | null
    status: string
    scope: string
    blue_pct: number
    total_votes: number
    description: string | null
  }

  // ── 2. Fetch top FOR argument ─────────────────────────────────────────────
  const { data: forArgs } = await supabase
    .from('topic_arguments')
    .select(
      `id, content, upvotes,
       author:profiles!topic_arguments_user_id_fkey(
         username, display_name, avatar_url, role
       )`
    )
    .eq('topic_id', raw.id)
    .eq('side', 'blue')
    .order('upvotes', { ascending: false })
    .limit(1)

  const forArg = forArgs?.[0] as
    | {
        id: string
        content: string
        upvotes: number
        author: {
          username: string
          display_name: string | null
          avatar_url: string | null
          role: string
        } | null
      }
    | undefined

  // ── 3. Fetch top AGAINST argument ─────────────────────────────────────────
  const { data: againstArgs } = await supabase
    .from('topic_arguments')
    .select(
      `id, content, upvotes,
       author:profiles!topic_arguments_user_id_fkey(
         username, display_name, avatar_url, role
       )`
    )
    .eq('topic_id', raw.id)
    .eq('side', 'red')
    .order('upvotes', { ascending: false })
    .limit(1)

  const againstArg = againstArgs?.[0] as
    | {
        id: string
        content: string
        upvotes: number
        author: {
          username: string
          display_name: string | null
          avatar_url: string | null
          role: string
        } | null
      }
    | undefined

  // ── 4. Fetch hot takes (recent votes with reasons) ────────────────────────
  const { data: hotTakeRows } = await supabase
    .from('votes')
    .select(
      `side, reason,
       voter:profiles!votes_user_id_fkey(
         username, display_name, avatar_url, role
       )`
    )
    .eq('topic_id', raw.id)
    .not('reason', 'is', null)
    .order('created_at', { ascending: false })
    .limit(6)

  type HotTakeRow = {
    side: string
    reason: string | null
    voter: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null
  }

  const hotTakes = ((hotTakeRows ?? []) as HotTakeRow[])
    .filter((r) => r.reason && r.voter)
    .map((r) => ({
      side: r.side as 'blue' | 'red',
      reason: r.reason!,
      username: r.voter!.username,
      display_name: r.voter!.display_name,
      avatar_url: r.voter!.avatar_url,
      role: r.voter!.role,
    }))

  // ── 5. Fetch current user's vote if authenticated ─────────────────────────
  let userVote: 'blue' | 'red' | null = null
  let userReason: string | null = null

  if (user) {
    const { data: myVote } = await supabase
      .from('votes')
      .select('side, reason')
      .eq('topic_id', raw.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (myVote) {
      userVote = myVote.side as 'blue' | 'red'
      userReason = myVote.reason ?? null
    }
  }

  // ── 6. Build response ─────────────────────────────────────────────────────
  const topic: DailyPromptTopic = {
    id: raw.id,
    statement: raw.statement,
    category: raw.category,
    status: raw.status,
    scope: raw.scope,
    blue_pct: raw.blue_pct,
    total_votes: raw.total_votes,
    description: raw.description,
    top_for_argument: forArg?.author
      ? {
          id: forArg.id,
          content: forArg.content,
          upvotes: forArg.upvotes,
          author_username: forArg.author.username,
          author_display_name: forArg.author.display_name,
          author_avatar_url: forArg.author.avatar_url,
          author_role: forArg.author.role,
        }
      : null,
    top_against_argument: againstArg?.author
      ? {
          id: againstArg.id,
          content: againstArg.content,
          upvotes: againstArg.upvotes,
          author_username: againstArg.author.username,
          author_display_name: againstArg.author.display_name,
          author_avatar_url: againstArg.author.avatar_url,
          author_role: againstArg.author.role,
        }
      : null,
  }

  return NextResponse.json({
    topic,
    date: today,
    user_vote: userVote,
    user_reason: userReason,
    hot_takes: hotTakes,
  } satisfies DailyPromptResponse)
}
