import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FlipTopic {
  id: string
  statement: string
  category: string | null
  status: 'law' | 'failed'
  final_blue_pct: number
  early_blue_pct: number
  /** final - early: positive = swung FOR, negative = swung AGAINST */
  swing: number
  total_votes: number
  early_vote_count: number
  created_at: string
  updated_at: string
  /** Most impactful argument that may have triggered the swing (by upvotes) */
  pivot_argument: {
    id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
    author_username: string | null
    author_display_name: string | null
    author_avatar_url: string | null
  } | null
}

export interface FlipResponse {
  flips: FlipTopic[]
  total_topics_analysed: number
  generated_at: string
}

// ─── Early sample size ────────────────────────────────────────────────────────

const EARLY_SAMPLE = 15   // use first 15 votes to determine "early" sentiment
const MIN_VOTES    = 12   // topics need at least this many votes to be meaningful
const MAX_TOPICS   = 50   // cap how many resolved topics we analyse
const RESULT_LIMIT = 25   // return top N by |swing|

/**
 * GET /api/flip
 *
 * Returns resolved topics (law or failed) with the largest difference between
 * their early-vote blue_pct and their final blue_pct.
 *
 * Algorithm:
 *   1. Fetch up to MAX_TOPICS recently resolved topics (min MIN_VOTES votes)
 *   2. For each, fetch the first EARLY_SAMPLE votes (chronological) to compute early_blue_pct
 *   3. swing = final_blue_pct - early_blue_pct
 *   4. Return sorted by |swing| descending
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const filter = searchParams.get('filter') ?? 'all' // all | comeback | collapse

  const supabase = await createClient()

  // ── 1. Fetch resolved topics ──────────────────────────────────────────────
  const { data: rawTopics, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at, updated_at')
    .in('status', ['law', 'failed'])
    .gte('total_votes', MIN_VOTES)
    .order('updated_at', { ascending: false })
    .limit(MAX_TOPICS)

  if (error || !rawTopics) {
    return NextResponse.json({ error: error?.message ?? 'Query failed' }, { status: 500 })
  }

  type TopicRow = {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
    updated_at: string
  }
  const topics = rawTopics as unknown as TopicRow[]

  // ── 2. Fetch early votes + top argument for each topic in parallel ────────
  const analysed = await Promise.all(
    topics.map(async (topic): Promise<FlipTopic | null> => {
      const [votesRes, argRes] = await Promise.all([
        // First EARLY_SAMPLE votes by time
        supabase
          .from('votes')
          .select('side')
          .eq('topic_id', topic.id)
          .order('created_at', { ascending: true })
          .limit(EARLY_SAMPLE),
        // Most upvoted argument (the "pivot" argument)
        supabase
          .from('topic_arguments')
          .select(
            'id, content, side, upvotes, ' +
            'profiles!topic_arguments_user_id_fkey(username, display_name, avatar_url)'
          )
          .eq('topic_id', topic.id)
          .order('upvotes', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const earlyVotes = votesRes.data ?? []
      if (earlyVotes.length < 5) return null // not enough early votes

      const earlyFor = earlyVotes.filter((v) => v.side === 'blue').length
      const early_blue_pct = (earlyFor / earlyVotes.length) * 100
      const swing = topic.blue_pct - early_blue_pct

      type ArgRow = {
        id: string
        content: string
        side: 'blue' | 'red'
        upvotes: number
        profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
      }
      const arg = argRes.data as unknown as ArgRow | null

      return {
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status as 'law' | 'failed',
        final_blue_pct: Math.round(topic.blue_pct * 10) / 10,
        early_blue_pct: Math.round(early_blue_pct * 10) / 10,
        swing: Math.round(swing * 10) / 10,
        total_votes: topic.total_votes,
        early_vote_count: earlyVotes.length,
        created_at: topic.created_at,
        updated_at: topic.updated_at,
        pivot_argument: arg
          ? {
              id: arg.id,
              content: arg.content,
              side: arg.side,
              upvotes: arg.upvotes,
              author_username: arg.profiles?.username ?? null,
              author_display_name: arg.profiles?.display_name ?? null,
              author_avatar_url: arg.profiles?.avatar_url ?? null,
            }
          : null,
      }
    })
  )

  // ── 3. Filter & sort ──────────────────────────────────────────────────────
  let flips = analysed.filter((f): f is FlipTopic => f !== null)

  if (filter === 'comeback') {
    // Started losing (early < 50%) but ended as LAW, or started losing and
    // significantly gained ground
    flips = flips.filter((f) => f.swing > 5)
  } else if (filter === 'collapse') {
    // Started winning (early > 50%) but ended up FAILED, or lost ground
    flips = flips.filter((f) => f.swing < -5)
  }

  // Sort by absolute swing magnitude
  flips.sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing))
  flips = flips.slice(0, RESULT_LIMIT)

  return NextResponse.json({
    flips,
    total_topics_analysed: topics.length,
    generated_at: new Date().toISOString(),
  } satisfies FlipResponse)
}
