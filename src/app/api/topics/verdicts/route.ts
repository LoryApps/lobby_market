import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerdictItem {
  id: string
  statement: string
  category: string | null
  status: 'law' | 'failed'
  blue_pct: number
  total_votes: number
  updated_at: string
  created_at: string
  // null when unauthenticated or user didn't vote on this topic
  user_vote: 'blue' | 'red' | null
  // true = user's side won; false = lost; null = didn't vote
  user_won: boolean | null
  // null when unauthenticated or user didn't predict this topic
  prediction_correct: boolean | null
  // linked law id for navigation (only set when status === 'law')
  law_id: string | null
}

export interface VerdictsResponse {
  verdicts: VerdictItem[]
  total: number
  has_more: boolean
  next_cursor: string | null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') ?? 'all'   // all | law | failed
  const limit  = Math.min(Math.max(1, Number.parseInt(searchParams.get('limit') ?? '20', 10) || 20), 50)
  const cursor = searchParams.get('cursor') ?? null     // ISO timestamp for pagination

  // ── Determine topic statuses to include ─────────────────────────────────────
  type TopicStatus = 'proposed' | 'active' | 'voting' | 'continued' | 'law' | 'failed' | 'archived'
  const statuses: TopicStatus[] =
    filter === 'law'    ? ['law']    :
    filter === 'failed' ? ['failed'] :
    ['law', 'failed']

  // ── Fetch resolved topics ───────────────────────────────────────────────────
  let query = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, updated_at, created_at')
    .in('status', statuses)
    .order('updated_at', { ascending: false })
    .limit(limit + 1)   // fetch one extra to determine has_more

  if (cursor) {
    query = query.lt('updated_at', cursor)
  }

  const { data: topicRows, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch verdicts' }, { status: 500 })
  }

  const topics = (topicRows ?? []) as {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    updated_at: string
    created_at: string
  }[]

  const has_more = topics.length > limit
  const page = has_more ? topics.slice(0, limit) : topics
  const next_cursor = has_more ? page[page.length - 1].updated_at : null

  if (page.length === 0) {
    return NextResponse.json({
      verdicts: [],
      total: 0,
      has_more: false,
      next_cursor: null,
    } satisfies VerdictsResponse)
  }

  const topicIds = page.map((t) => t.id)

  // ── Auth-dependent enrichment (votes + predictions) ──────────────────────────
  const { data: { user } } = await supabase.auth.getUser()

  const userVoteMap  = new Map<string, 'blue' | 'red'>()
  const predCorrectMap = new Map<string, boolean | null>()
  const lawIdMap     = new Map<string, string>()

  await Promise.all([
    // User's votes on these topics
    user
      ? supabase
          .from('votes')
          .select('topic_id, side')
          .eq('user_id', user.id)
          .in('topic_id', topicIds)
          .then(({ data }) => {
            for (const v of data ?? []) {
              userVoteMap.set(v.topic_id, v.side as 'blue' | 'red')
            }
          })
      : Promise.resolve(),

    // User's resolved predictions on these topics
    user
      ? supabase
          .from('topic_predictions')
          .select('topic_id, correct')
          .eq('user_id', user.id)
          .in('topic_id', topicIds)
          .not('resolved_at', 'is', null)
          .then(({ data }) => {
            for (const p of data ?? []) {
              predCorrectMap.set(p.topic_id, p.correct ?? null)
            }
          })
      : Promise.resolve(),

    // Law IDs for topics that became law
    supabase
      .from('laws')
      .select('topic_id, id')
      .in('topic_id', topicIds)
      .then(({ data }) => {
        for (const l of data ?? []) {
          lawIdMap.set(l.topic_id, l.id)
        }
      }),
  ])

  // ── Assemble verdict items ───────────────────────────────────────────────────
  const verdicts: VerdictItem[] = page.map((t) => {
    const userVote  = userVoteMap.get(t.id) ?? null
    const isLaw     = t.status === 'law'
    // FOR = blue; against = red.  If status is law, FOR side won.
    const user_won  = userVote === null ? null : (isLaw ? userVote === 'blue' : userVote === 'red')

    return {
      id:               t.id,
      statement:        t.statement,
      category:         t.category,
      status:           t.status as 'law' | 'failed',
      blue_pct:         t.blue_pct,
      total_votes:      t.total_votes,
      updated_at:       t.updated_at,
      created_at:       t.created_at,
      user_vote:        userVote,
      user_won:         user_won,
      prediction_correct: predCorrectMap.get(t.id) ?? null,
      law_id:           lawIdMap.get(t.id) ?? null,
    }
  })

  // ── Count total (approximate, just the page filter) ──────────────────────────
  const { count } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .in('status', statuses)

  return NextResponse.json({
    verdicts,
    total: count ?? 0,
    has_more,
    next_cursor,
  } satisfies VerdictsResponse)
}
