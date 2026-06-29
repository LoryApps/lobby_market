import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JourneyVote {
  side: 'blue' | 'red'
  created_at: string
  agreesWithMajority: boolean
}

export interface JourneyArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  reply_count: number
  created_at: string
  ai_score: number | null
}

export interface JourneyPrediction {
  id: string
  predicted_law: boolean
  confidence: number
  correct: boolean | null
  clout_earned: number | null
  created_at: string
  resolved_at: string | null
}

export interface JourneyStats {
  totalInteractions: number
  totalUpvotesReceived: number
  firstInteractionAt: string | null
  daysSinceFirst: number
}

export interface JourneyTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
}

export interface JourneyResponse {
  topic: JourneyTopic
  myVote: JourneyVote | null
  myArguments: JourneyArgument[]
  myPredictions: JourneyPrediction[]
  stats: JourneyStats
  notAuthenticated?: boolean
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Fetch topic
  const { data: topicRow } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topicRow) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const topic: JourneyTopic = {
    id: topicRow.id,
    statement: topicRow.statement,
    category: topicRow.category,
    status: topicRow.status,
    blue_pct: topicRow.blue_pct ?? 50,
    total_votes: topicRow.total_votes ?? 0,
    created_at: topicRow.created_at,
  }

  // Auth check — unauthenticated still gets topic info
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({
      topic,
      myVote: null,
      myArguments: [],
      myPredictions: [],
      stats: { totalInteractions: 0, totalUpvotesReceived: 0, firstInteractionAt: null, daysSinceFirst: 0 },
      notAuthenticated: true,
    } satisfies JourneyResponse)
  }

  // Parallel data fetches
  const [voteRes, argsRes, predsRes] = await Promise.all([
    // My vote
    supabase
      .from('votes')
      .select('side, created_at')
      .eq('topic_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle(),

    // My arguments on this topic
    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, reply_count, created_at, ai_score')
      .eq('topic_id', params.id)
      .eq('author_id', user.id)
      .order('created_at', { ascending: true }),

    // My predictions on this topic
    supabase
      .from('topic_predictions')
      .select('id, predicted_law, confidence, correct, clout_earned, created_at, resolved_at')
      .eq('topic_id', params.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  // Build vote
  const myVote: JourneyVote | null = voteRes.data
    ? {
        side: voteRes.data.side as 'blue' | 'red',
        created_at: voteRes.data.created_at,
        agreesWithMajority:
          (voteRes.data.side === 'blue' && topic.blue_pct >= 50) ||
          (voteRes.data.side === 'red' && topic.blue_pct < 50),
      }
    : null

  // Build arguments
  const myArguments: JourneyArgument[] = (argsRes.data ?? []).map((a) => ({
    id: a.id,
    content: a.content,
    side: a.side as 'blue' | 'red',
    upvotes: a.upvotes ?? 0,
    reply_count: a.reply_count ?? 0,
    created_at: a.created_at,
    ai_score: a.ai_score ?? null,
  }))

  // Build predictions
  const myPredictions: JourneyPrediction[] = (predsRes.data ?? []).map((p) => ({
    id: p.id,
    predicted_law: p.predicted_law,
    confidence: p.confidence,
    correct: p.correct,
    clout_earned: p.clout_earned,
    created_at: p.created_at,
    resolved_at: p.resolved_at,
  }))

  // Stats
  const totalUpvotesReceived = myArguments.reduce((s, a) => s + a.upvotes, 0)
  const allTimestamps = [
    myVote?.created_at,
    ...myArguments.map((a) => a.created_at),
    ...myPredictions.map((p) => p.created_at),
  ].filter(Boolean) as string[]

  const firstInteractionAt =
    allTimestamps.length > 0
      ? allTimestamps.reduce((earliest, ts) =>
          ts < earliest ? ts : earliest
        )
      : null

  const daysSinceFirst = firstInteractionAt
    ? Math.floor(
        (Date.now() - new Date(firstInteractionAt).getTime()) / 86_400_000
      )
    : 0

  const totalInteractions =
    (myVote ? 1 : 0) + myArguments.length + myPredictions.length

  const stats: JourneyStats = {
    totalInteractions,
    totalUpvotesReceived,
    firstInteractionAt,
    daysSinceFirst,
  }

  return NextResponse.json({
    topic,
    myVote,
    myArguments,
    myPredictions,
    stats,
  } satisfies JourneyResponse)
}
