import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArgumentAnalyticsData {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  ai_score: number | null
  ai_grade: string | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  }
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  reactions: {
    insightful: number
    compelling: number
    balanced: number
    needs_evidence: number
    total: number
  }
  reply_count: number
  // Topic ranking
  topic_rank: number          // 1-based rank by upvotes among all topic args
  topic_total: number
  side_rank: number           // 1-based rank by upvotes among same-side topic args
  side_total: number
  // Velocity / derived
  days_alive: number
  upvote_velocity: number     // upvotes per day (rounded to 1 dp)
  engagement_score: number    // upvotes×3 + reactions×2 + replies×1
}

export interface ArgumentAnalyticsResponse {
  data: ArgumentAnalyticsData | null
  error?: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json<ArgumentAnalyticsResponse>({ data: null, error: 'Invalid argument ID' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: arg, error: argErr } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, created_at, topic_id, user_id, ai_score, ai_grade')
    .eq('id', id)
    .single()

  if (argErr || !arg) {
    return NextResponse.json<ArgumentAnalyticsResponse>({ data: null, error: 'Argument not found' }, { status: 404 })
  }

  const [
    topicRes,
    profileRes,
    reactionsRes,
    replyRes,
    topicRankRes,
    topicTotalRes,
    sideRankRes,
    sideTotalRes,
  ] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status')
      .eq('id', arg.topic_id)
      .single(),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .eq('id', arg.user_id)
      .maybeSingle(),
    supabase
      .from('argument_reactions')
      .select('reaction')
      .eq('argument_id', id),
    supabase
      .from('argument_replies')
      .select('id', { count: 'exact', head: true })
      .eq('argument_id', id),
    // How many args on this topic have MORE upvotes? (rank = that count + 1)
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', arg.topic_id)
      .gt('upvotes', arg.upvotes),
    // Total args on this topic
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', arg.topic_id),
    // Same-side args with MORE upvotes
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', arg.topic_id)
      .eq('side', arg.side)
      .gt('upvotes', arg.upvotes),
    // Total same-side args on topic
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', arg.topic_id)
      .eq('side', arg.side),
  ])

  if (!topicRes.data) {
    return NextResponse.json<ArgumentAnalyticsResponse>({ data: null, error: 'Topic not found' }, { status: 404 })
  }

  // Aggregate reactions
  const reactionRows = reactionsRes.data ?? []
  const reactions = { insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0, total: 0 }
  for (const row of reactionRows) {
    const r = row.reaction as keyof typeof reactions
    if (r in reactions) reactions[r]++
    reactions.total++
  }

  const replyCount = replyRes.count ?? 0
  const topicRank = (topicRankRes.count ?? 0) + 1
  const topicTotal = topicTotalRes.count ?? 1
  const sideRank = (sideRankRes.count ?? 0) + 1
  const sideTotal = sideTotalRes.count ?? 1

  const createdAt = new Date(arg.created_at)
  const nowMs = Date.now()
  const daysAlive = Math.max(1, Math.round((nowMs - createdAt.getTime()) / 86_400_000))
  const upvoteVelocity = Math.round((arg.upvotes / daysAlive) * 10) / 10
  const engagementScore = arg.upvotes * 3 + reactions.total * 2 + replyCount

  const data: ArgumentAnalyticsData = {
    id: arg.id,
    content: arg.content,
    side: arg.side as 'blue' | 'red',
    upvotes: arg.upvotes,
    created_at: arg.created_at,
    ai_score: arg.ai_score as number | null,
    ai_grade: arg.ai_grade as string | null,
    topic: {
      id: topicRes.data.id,
      statement: topicRes.data.statement,
      category: topicRes.data.category,
      status: topicRes.data.status,
    },
    author: profileRes.data
      ? {
          id: profileRes.data.id,
          username: profileRes.data.username,
          display_name: profileRes.data.display_name,
          avatar_url: profileRes.data.avatar_url,
        }
      : null,
    reactions,
    reply_count: replyCount,
    topic_rank: topicRank,
    topic_total: topicTotal,
    side_rank: sideRank,
    side_total: sideTotal,
    days_alive: daysAlive,
    upvote_velocity: upvoteVelocity,
    engagement_score: engagementScore,
  }

  return NextResponse.json<ArgumentAnalyticsResponse>({ data })
}
