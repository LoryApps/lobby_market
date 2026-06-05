import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FulcrumArgument {
  id: string
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  author_username: string
  author_display_name: string | null
  created_at: string
}

export interface FulcrumTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  blue_votes: number
  red_votes: number
  /** How close to 50/50 weighted by vote volume. 0–100. */
  balance_score: number
  blue_args_count: number
  red_args_count: number
  /** The strongest FOR argument (by upvotes + ai_score) */
  top_blue_arg: FulcrumArgument | null
  /** The strongest AGAINST argument (by upvotes + ai_score) */
  top_red_arg: FulcrumArgument | null
  voting_ends_at: string | null
  created_at: string
}

export interface FulcrumResponse {
  topics: FulcrumTopic[]
  total_analyzed: number
  generated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MIN_VOTES = 50
const BALANCE_LOW = 35   // FOR% floor — below this it's not balanced
const BALANCE_HIGH = 65  // FOR% ceiling — above this it's not balanced
const MAX_RESULTS = 25

// Argument quality weight: upvotes count 60%, ai_score 40%
function argQuality(upvotes: number, aiScore: number | null): number {
  const normalized_ai = aiScore !== null ? aiScore / 100 : 0.5
  return upvotes * 0.6 + normalized_ai * 40
}

function balanceScore(bluePct: number, totalVotes: number): number {
  // Max when bluePct = 50; falls to 0 at 35% or 65%
  const proximity = 1 - Math.abs(bluePct - 50) / 50
  // Weight by log of votes so well-debated topics rank higher
  const volumeWeight = Math.log10(Math.max(totalVotes, 1))
  return Math.round(proximity * volumeWeight * 100) / 100
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // 1. Fetch balanced topics
  const { data: topics, error: topicsErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, blue_votes, red_votes, voting_ends_at, created_at')
    .in('status', ['active', 'voting'])
    .gte('total_votes', MIN_VOTES)
    .gte('blue_pct', BALANCE_LOW)
    .lte('blue_pct', BALANCE_HIGH)
    .order('total_votes', { ascending: false })
    .limit(100)

  if (topicsErr) {
    return NextResponse.json({ error: topicsErr.message }, { status: 500 })
  }

  if (!topics || topics.length === 0) {
    return NextResponse.json<FulcrumResponse>({
      topics: [],
      total_analyzed: 0,
      generated_at: new Date().toISOString(),
    })
  }

  const totalAnalyzed = topics.length

  // Score and sort topics
  const scored = topics
    .map(t => ({ ...t, balance_score: balanceScore(t.blue_pct, t.total_votes) }))
    .sort((a, b) => b.balance_score - a.balance_score)
    .slice(0, MAX_RESULTS)

  const topicIds = scored.map(t => t.id)

  // 2. Fetch all arguments for these topics in a single query
  const { data: allArgs, error: argsErr } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, side, content, upvotes, ai_score, ai_grade, user_id, created_at')
    .in('topic_id', topicIds)
    .order('upvotes', { ascending: false })

  if (argsErr) {
    return NextResponse.json({ error: argsErr.message }, { status: 500 })
  }

  // 3. Fetch author profiles for the top args we'll surface
  const authorIds = [...new Set((allArgs ?? []).map(a => a.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .in('id', authorIds)

  const profileMap = new Map(
    (profiles ?? []).map(p => [p.id, { username: p.username, display_name: p.display_name }])
  )

  // 4. Build per-topic argument maps
  const argsByTopic = new Map<string, { blue: typeof allArgs; red: typeof allArgs }>()
  for (const arg of allArgs ?? []) {
    if (!argsByTopic.has(arg.topic_id)) {
      argsByTopic.set(arg.topic_id, { blue: [], red: [] })
    }
    const bucket = argsByTopic.get(arg.topic_id)!
    if (arg.side === 'blue') bucket.blue.push(arg)
    else bucket.red.push(arg)
  }

  // 5. Assemble final results
  const result: FulcrumTopic[] = scored.map(t => {
    const args = argsByTopic.get(t.id) ?? { blue: [], red: [] }

    const topBlue = args.blue
      .sort((a, b) => argQuality(b.upvotes, b.ai_score) - argQuality(a.upvotes, a.ai_score))[0]
    const topRed = args.red
      .sort((a, b) => argQuality(b.upvotes, b.ai_score) - argQuality(a.upvotes, a.ai_score))[0]

    function toFulcrumArg(a: typeof topBlue): FulcrumArgument | null {
      if (!a) return null
      const p = profileMap.get(a.user_id)
      return {
        id: a.id,
        content: a.content,
        upvotes: a.upvotes,
        ai_score: a.ai_score,
        ai_grade: a.ai_grade,
        author_username: p?.username ?? 'unknown',
        author_display_name: p?.display_name ?? null,
        created_at: a.created_at,
      }
    }

    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      scope: t.scope,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      blue_votes: t.blue_votes,
      red_votes: t.red_votes,
      balance_score: t.balance_score,
      blue_args_count: args.blue.length,
      red_args_count: args.red.length,
      top_blue_arg: toFulcrumArg(topBlue),
      top_red_arg: toFulcrumArg(topRed),
      voting_ends_at: t.voting_ends_at,
      created_at: t.created_at,
    }
  })

  return NextResponse.json<FulcrumResponse>({
    topics: result,
    total_analyzed: totalAnalyzed,
    generated_at: new Date().toISOString(),
  })
}
