import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 60

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrucibleAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface CrucibleArgument {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  created_at: string
  rank: number
  author: CrucibleAuthor | null
}

export interface CrucibleTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface CruciblePreviousWinner {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  topic_statement: string
  date: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface CrucibleResponse {
  topic: CrucibleTopic | null
  forArguments: CrucibleArgument[]
  againstArguments: CrucibleArgument[]
  forScore: number
  againstScore: number
  leadingSide: 'for' | 'against' | 'tied'
  totalForArguments: number
  totalAgainstArguments: number
  hoursRemaining: number
  roundDate: string
  previousWinner: CruciblePreviousWinner | null
  generatedAt: string
}

// ─── GET /api/crucible ────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // ── 1. Find today's crucible topic: most contested + most engaged ─────────
  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting'])
    .gt('total_votes', 4)
    .gte('blue_pct', 20)
    .lte('blue_pct', 80)
    .order('total_votes', { ascending: false })
    .limit(50)

  if (!topics || topics.length === 0) {
    const now = new Date()
    return NextResponse.json({
      topic: null,
      forArguments: [],
      againstArguments: [],
      forScore: 0,
      againstScore: 0,
      leadingSide: 'tied',
      totalForArguments: 0,
      totalAgainstArguments: 0,
      hoursRemaining: computeHoursRemaining(now),
      roundDate: toDateStr(now),
      previousWinner: null,
      generatedAt: now.toISOString(),
    } satisfies CrucibleResponse)
  }

  // Score each topic by engagement × contestedness: votes × (1 - |pct-50|/50)
  const crucibleTopic = topics.reduce((best, t) => {
    const score = t.total_votes * (1 - Math.abs(t.blue_pct - 50) / 50)
    const bestScore = best.total_votes * (1 - Math.abs(best.blue_pct - 50) / 50)
    return score > bestScore ? t : best
  })

  // ── 2. Fetch top arguments for the crucible topic ─────────────────────────
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select(
      `id, side, content, upvotes, created_at,
       profiles:user_id (id, username, display_name, avatar_url, role)`
    )
    .eq('topic_id', crucibleTopic.id)
    .order('upvotes', { ascending: false })
    .limit(30)

  type RawArg = {
    id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    created_at: string
    profiles: CrucibleAuthor | CrucibleAuthor[] | null
  }

  const args = (rawArgs ?? []) as unknown as RawArg[]

  function resolveAuthor(profiles: RawArg['profiles']): CrucibleAuthor | null {
    if (!profiles) return null
    return Array.isArray(profiles) ? (profiles[0] ?? null) : profiles
  }

  // Split by side, rank by upvotes (already sorted from DB), take top 5 each
  const forArguments: CrucibleArgument[] = args
    .filter((a) => a.side === 'blue')
    .slice(0, 5)
    .map((a, i) => ({ ...a, rank: i + 1, author: resolveAuthor(a.profiles) }))

  const againstArguments: CrucibleArgument[] = args
    .filter((a) => a.side === 'red')
    .slice(0, 5)
    .map((a, i) => ({ ...a, rank: i + 1, author: resolveAuthor(a.profiles) }))

  // ── 3. Aggregate scores ───────────────────────────────────────────────────
  const forScore = forArguments.reduce((s, a) => s + a.upvotes, 0)
  const againstScore = againstArguments.reduce((s, a) => s + a.upvotes, 0)
  const leadingSide: 'for' | 'against' | 'tied' =
    forScore > againstScore ? 'for' : againstScore > forScore ? 'against' : 'tied'

  // ── 4. Count all arguments for the topic ─────────────────────────────────
  const [{ count: forCount }, { count: againstCount }] = await Promise.all([
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', crucibleTopic.id)
      .eq('side', 'blue'),
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', crucibleTopic.id)
      .eq('side', 'red'),
  ])

  // ── 5. Previous winner: top argument from a different topic 24–48h ago ────
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

  const { data: prevRaw } = await supabase
    .from('topic_arguments')
    .select(
      `id, side, content, upvotes, created_at,
       profiles:user_id (username, display_name, avatar_url),
       topics:topic_id (statement)`
    )
    .gte('created_at', twoDaysAgo)
    .lte('created_at', yesterday)
    .gt('upvotes', 0)
    .order('upvotes', { ascending: false })
    .limit(1)
    .maybeSingle()

  let previousWinner: CruciblePreviousWinner | null = null
  if (prevRaw) {
    type PrevRaw = {
      id: string
      side: 'blue' | 'red'
      content: string
      upvotes: number
      created_at: string
      profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
      topics: { statement: string } | null
    }
    const p = prevRaw as unknown as PrevRaw
    previousWinner = {
      id: p.id,
      content: p.content,
      side: p.side,
      upvotes: p.upvotes,
      topic_statement: p.topics?.statement ?? '',
      date: p.created_at.split('T')[0],
      author: p.profiles,
    }
  }

  return NextResponse.json({
    topic: {
      id: crucibleTopic.id,
      statement: crucibleTopic.statement,
      category: crucibleTopic.category,
      status: crucibleTopic.status,
      blue_pct: Math.round(crucibleTopic.blue_pct),
      total_votes: crucibleTopic.total_votes,
    },
    forArguments,
    againstArguments,
    forScore,
    againstScore,
    leadingSide,
    totalForArguments: forCount ?? 0,
    totalAgainstArguments: againstCount ?? 0,
    hoursRemaining: computeHoursRemaining(now),
    roundDate: toDateStr(now),
    previousWinner,
    generatedAt: now.toISOString(),
  } satisfies CrucibleResponse)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeHoursRemaining(now: Date): number {
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 3_600_000))
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}
