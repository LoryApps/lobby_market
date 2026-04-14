import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// How many topics form the daily quorum
const QUORUM_SIZE = 3

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Deterministic shuffle of an array using a numeric seed (Fisher-Yates with
 * a simple LCG so the same seed always produces the same order).
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr]
  let s = seed
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Deterministic seed from today's UTC date string (YYYY-MM-DD → integer). */
function todaySeed(): number {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  return y * 10000 + m * 100 + day
}

function todayDateString(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicRow {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number
}

// ─── GET /api/challenge ───────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const dateStr = todayDateString()

  const { data: pool, error: poolErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score')
    .in('status', ['active', 'voting'])
    .order('feed_score', { ascending: false })
    .limit(30)

  if (poolErr) {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 })
  }

  const topics = (pool ?? []) as TopicRow[]

  let quorumTopics: TopicRow[] = []
  if (topics.length >= QUORUM_SIZE) {
    const shuffled = seededShuffle(topics, todaySeed())
    quorumTopics = shuffled.slice(0, QUORUM_SIZE)
  } else if (topics.length > 0) {
    quorumTopics = topics
  } else {
    const { data: fallback } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score')
      .order('created_at', { ascending: false })
      .limit(QUORUM_SIZE)
    quorumTopics = ((fallback ?? []) as TopicRow[]).slice(0, QUORUM_SIZE)
  }

  const topicIds = quorumTopics.map((t) => t.id)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let votedTopicIds: string[] = []
  let alreadyClaimed = false

  if (user) {
    const { data: voteRows } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)
      .in('topic_id', topicIds)

    votedTopicIds = (voteRows ?? []).map((r: { topic_id: string }) => r.topic_id)

    const { data: completionRow } = await supabase
      .from('daily_quorum_completions')
      .select('quorum_date, clout_earned')
      .eq('user_id', user.id)
      .eq('quorum_date', dateStr)
      .maybeSingle()

    alreadyClaimed = !!completionRow
  }

  const votedCount = votedTopicIds.length
  const isComplete = votedCount >= quorumTopics.length && quorumTopics.length > 0

  return NextResponse.json({
    date: dateStr,
    topics: quorumTopics,
    topicIds,
    votedTopicIds,
    votedCount,
    total: quorumTopics.length,
    isComplete,
    alreadyClaimed,
    cloutReward: 10,
  })
}

// ─── POST /api/challenge ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { topicIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const topicIds = Array.isArray(body.topicIds) ? body.topicIds : []
  if (topicIds.length === 0) {
    return NextResponse.json({ error: 'topicIds required' }, { status: 400 })
  }

  const dateStr = todayDateString()

  const { data, error } = await supabase.rpc('claim_daily_quorum', {
    p_user_id: user.id,
    p_topic_ids: topicIds,
    p_quorum_date: dateStr,
  })

  if (error) {
    console.error('claim_daily_quorum error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data as {
    status: 'claimed' | 'already_claimed' | 'incomplete' | 'unauthorized'
    new_balance?: number
    clout_earned?: number
    voted?: number
    needed?: number
  })
}
