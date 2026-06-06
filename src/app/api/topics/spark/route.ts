import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SparkTopic {
  id: string
  statement: string
  description: string | null
  category: string | null
  scope: string
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  feed_score: number
  created_at: string
  tags: string[]
  top_for_argument: SparkArgument | null
  top_against_argument: SparkArgument | null
  user_voted: boolean
  user_vote_side: 'blue' | 'red' | null
}

interface SparkArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
}

export interface SparkResponse {
  topic: SparkTopic | null
  total_eligible: number
  excluded_id: string | null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  // Optional: exclude a specific topic id (so "next spark" doesn't repeat)
  const excludeId = searchParams.get('exclude') ?? null

  // Get current user for personalization (not required)
  const { data: { user } } = await supabase.auth.getUser()

  try {
    // Fetch candidate topics: active/voting, meaningful votes, and relatively under-explored.
    // We pull 200 candidates and randomize client-side to avoid a DB random() call on large sets.
    // "Under-explored" = view_count < 500 OR feed_score > 30 with low view_count.
    let candidateQuery = supabase
      .from('topics')
      .select('id, statement, description, category, scope, status, blue_pct, total_votes, view_count, feed_score, created_at, tags')
      .in('status', ['active', 'voting'])
      .gte('total_votes', 3)
      .lte('view_count', 800)
      .order('feed_score', { ascending: false })
      .limit(200)

    if (excludeId) {
      candidateQuery = candidateQuery.neq('id', excludeId)
    }

    const { data: candidates, error } = await candidateQuery

    if (error || !candidates || candidates.length === 0) {
      // Fallback: any active topic
      const { data: fallback } = await supabase
        .from('topics')
        .select('id, statement, description, category, scope, status, blue_pct, total_votes, view_count, feed_score, created_at, tags')
        .in('status', ['active', 'voting'])
        .order('created_at', { ascending: false })
        .limit(50)

      if (!fallback || fallback.length === 0) {
        return NextResponse.json({ topic: null, total_eligible: 0, excluded_id: excludeId })
      }

      const picked = fallback[Math.floor(Math.random() * fallback.length)]
      return buildResponse(supabase, picked, fallback.length, excludeId, user?.id ?? null)
    }

    // Weighted random: bias toward higher feed_score but still randomize
    const totalScore = candidates.reduce((s, t) => s + Math.max(t.feed_score, 1), 0)
    let rand = Math.random() * totalScore
    let picked = candidates[0]
    for (const c of candidates) {
      rand -= Math.max(c.feed_score, 1)
      if (rand <= 0) { picked = c; break }
    }

    return buildResponse(supabase, picked, candidates.length, excludeId, user?.id ?? null)
  } catch (err) {
    console.error('[spark]', err)
    return NextResponse.json({ topic: null, total_eligible: 0, excluded_id: excludeId }, { status: 500 })
  }
}

async function buildResponse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  raw: { id: string; statement: string; description: string | null; category: string | null; scope: string; status: string; blue_pct: number; total_votes: number; view_count: number; feed_score: number; created_at: string; tags: string[] },
  total: number,
  excludeId: string | null,
  userId: string | null
) {
  // Fetch top arguments (1 for, 1 against)
  const { data: args } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes')
    .eq('topic_id', raw.id)
    .in('side', ['blue', 'red'])
    .order('upvotes', { ascending: false })
    .limit(10)

  const topFor = args?.find(a => a.side === 'blue') ?? null
  const topAgainst = args?.find(a => a.side === 'red') ?? null

  // Check if current user has voted
  let userVoted = false
  let userVoteSide: 'blue' | 'red' | null = null
  if (userId) {
    const { data: vote } = await supabase
      .from('votes')
      .select('side')
      .eq('topic_id', raw.id)
      .eq('user_id', userId)
      .maybeSingle()
    if (vote) {
      userVoted = true
      userVoteSide = vote.side as 'blue' | 'red'
    }
  }

  const topic: SparkTopic = {
    ...raw,
    top_for_argument: topFor ? { id: topFor.id, content: topFor.content, side: 'blue', upvotes: topFor.upvotes ?? 0 } : null,
    top_against_argument: topAgainst ? { id: topAgainst.id, content: topAgainst.content, side: 'red', upvotes: topAgainst.upvotes ?? 0 } : null,
    user_voted: userVoted,
    user_vote_side: userVoteSide,
  }

  return NextResponse.json({ topic, total_eligible: total, excluded_id: excludeId })
}
