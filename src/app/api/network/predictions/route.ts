import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface NetworkPredictionActor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface NetworkPredictionTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface NetworkPredictionItem {
  prediction_id: string
  created_at: string
  actor: NetworkPredictionActor
  topic: NetworkPredictionTopic
  predicted_law: boolean
  confidence: number
  resolved_at: string | null
  correct: boolean | null
  clout_earned: number
}

export interface NetworkPredictionsResponse {
  items: NetworkPredictionItem[]
  following_count: number
  is_empty: boolean
  cursor: string | null
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') || '40', 10), 80)
  const cursor = searchParams.get('cursor') ?? null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch IDs of users this person follows
  const { data: follows, error: followErr } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)

  if (followErr) {
    return NextResponse.json({ error: 'Failed to fetch follows' }, { status: 500 })
  }

  const followingIds = (follows ?? []).map((f) => f.following_id as string)

  if (followingIds.length === 0) {
    return NextResponse.json({
      items: [],
      following_count: 0,
      is_empty: true,
      cursor: null,
    } satisfies NetworkPredictionsResponse)
  }

  // 2. Fetch recent predictions by followed users
  let query = supabase
    .from('topic_predictions')
    .select('id, user_id, topic_id, predicted_law, confidence, resolved_at, correct, clout_earned, created_at')
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: predictions, error: predErr } = await query

  if (predErr) {
    return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 })
  }

  const rows = predictions ?? []
  const hasMore = rows.length > limit
  const slice = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? slice[slice.length - 1].created_at : null

  if (slice.length === 0) {
    return NextResponse.json({
      items: [],
      following_count: followingIds.length,
      is_empty: true,
      cursor: null,
    } satisfies NetworkPredictionsResponse)
  }

  // 3. Fetch actor profiles and topics in parallel
  const actorIds = Array.from(new Set(slice.map((r) => r.user_id as string)))
  const topicIds = Array.from(new Set(slice.map((r) => r.topic_id as string)))

  const [{ data: actors }, { data: topics }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', actorIds),
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds),
  ])

  const actorMap = new Map<string, NetworkPredictionActor>()
  for (const a of actors ?? []) {
    actorMap.set(a.id, {
      id: a.id,
      username: a.username,
      display_name: a.display_name,
      avatar_url: a.avatar_url,
      role: a.role,
    })
  }

  const topicMap = new Map<string, NetworkPredictionTopic>()
  for (const t of topics ?? []) {
    topicMap.set(t.id, {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
    })
  }

  const items: NetworkPredictionItem[] = slice
    .map((row) => {
      const actor = actorMap.get(row.user_id as string)
      const topic = topicMap.get(row.topic_id as string)
      if (!actor || !topic) return null

      return {
        prediction_id: row.id as string,
        created_at: row.created_at as string,
        actor,
        topic,
        predicted_law: row.predicted_law as boolean,
        confidence: row.confidence as number,
        resolved_at: row.resolved_at as string | null,
        correct: row.correct as boolean | null,
        clout_earned: row.clout_earned as number,
      } satisfies NetworkPredictionItem
    })
    .filter((x): x is NetworkPredictionItem => x !== null)

  return NextResponse.json({
    items,
    following_count: followingIds.length,
    is_empty: items.length === 0,
    cursor: nextCursor,
  } satisfies NetworkPredictionsResponse)
}
