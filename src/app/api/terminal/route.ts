import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TerminalTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string
  blue_pct: number
  blue_votes: number
  red_votes: number
  total_votes: number
  view_count: number
  feed_score: number
  created_at: string
  voting_ends_at: string | null
  // derived
  ticker: string          // abbreviated statement for terminal row
  consensus_bar: number   // blue_pct rounded
  spread: number          // |blue_pct - 50| * 2  — 0 = deadlock, 100 = consensus
  vote_velocity: number   // votes per day since creation
  momentum: 'surging' | 'rising' | 'stable' | 'falling' | 'cooling'
  argument_count_24h: number
  is_contested: boolean   // within 10% of 50/50
  is_approaching_law: boolean  // FOR >= 60 and active
  is_approaching_failure: boolean  // AGAINST >= 60 and active
}

export interface TerminalStats {
  total_active: number
  total_in_voting: number
  total_votes_today: number  // approximated from today's active topics
  contested_count: number
  approaching_law_count: number
  avg_consensus: number
  fetched_at: string
}

export interface TerminalResponse {
  topics: TerminalTopic[]
  stats: TerminalStats
}

const TOPIC_COLS =
  'id, statement, category, status, scope, blue_pct, blue_votes, red_votes, ' +
  'total_votes, view_count, feed_score, created_at, voting_ends_at'

function makeTicker(statement: string, maxLen = 40): string {
  if (statement.length <= maxLen) return statement.toUpperCase()
  // Try to truncate at a word boundary
  const truncated = statement.slice(0, maxLen)
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated).toUpperCase() + '…'
}

function votesPerDay(totalVotes: number, createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageDays = Math.max(ageMs / 86_400_000, 0.1)
  return Math.round(totalVotes / ageDays)
}

function classifyMomentum(feedScore: number, totalVotes: number): TerminalTopic['momentum'] {
  // feed_score is roughly: log(total_votes) * view_factor + recency_bonus
  // Use per-vote feed score as proxy for momentum
  if (totalVotes === 0) return 'stable'
  const perVote = feedScore / Math.max(totalVotes, 1)
  if (perVote >= 0.8)  return 'surging'
  if (perVote >= 0.4)  return 'rising'
  if (perVote >= 0.15) return 'stable'
  if (perVote >= 0.05) return 'falling'
  return 'cooling'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all active + voting topics — the "live market"
    const { data: rows, error } = await supabase
      .from('topics')
      .select(TOPIC_COLS)
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(200)

    if (error) throw error

    const rawTopics = rows ?? []

    // Fetch 24h argument counts per topic
    const since24h = new Date(Date.now() - 86_400_000).toISOString()
    const topicIds = rawTopics.map((t) => t.id)

    const argCounts: Record<string, number> = {}
    if (topicIds.length > 0) {
      const { data: argRows } = await supabase
        .from('topic_arguments')
        .select('topic_id')
        .in('topic_id', topicIds)
        .gte('created_at', since24h)

      if (argRows) {
        for (const row of argRows) {
          argCounts[row.topic_id] = (argCounts[row.topic_id] ?? 0) + 1
        }
      }
    }

    // Build enriched terminal rows
    const topics: TerminalTopic[] = rawTopics.map((t) => {
      const spread = Math.round(Math.abs(t.blue_pct - 50) * 2)
      const arg24h = argCounts[t.id] ?? 0

      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        scope: t.scope,
        blue_pct: t.blue_pct,
        blue_votes: t.blue_votes,
        red_votes: t.red_votes,
        total_votes: t.total_votes,
        view_count: t.view_count,
        feed_score: t.feed_score,
        created_at: t.created_at,
        voting_ends_at: t.voting_ends_at,
        ticker: makeTicker(t.statement),
        consensus_bar: Math.round(t.blue_pct),
        spread,
        vote_velocity: votesPerDay(t.total_votes, t.created_at),
        momentum: classifyMomentum(t.feed_score, t.total_votes),
        argument_count_24h: arg24h,
        is_contested: spread <= 20,
        is_approaching_law: t.blue_pct >= 60 && t.status === 'active',
        is_approaching_failure: t.blue_pct <= 40 && t.status === 'active',
      }
    })

    const stats: TerminalStats = {
      total_active: topics.filter((t) => t.status === 'active').length,
      total_in_voting: topics.filter((t) => t.status === 'voting').length,
      total_votes_today: topics.reduce((s, t) => s + (t.argument_count_24h > 0 ? t.total_votes : 0), 0),
      contested_count: topics.filter((t) => t.is_contested).length,
      approaching_law_count: topics.filter((t) => t.is_approaching_law).length,
      avg_consensus: topics.length
        ? Math.round(topics.reduce((s, t) => s + t.blue_pct, 0) / topics.length)
        : 50,
      fetched_at: new Date().toISOString(),
    }

    return NextResponse.json({ topics, stats } satisfies TerminalResponse)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch terminal data' }, { status: 500 })
  }
}
