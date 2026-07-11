import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type FilibusterStatus = 'active' | 'overridden' | 'extended' | 'lapsed' | 'withdrawn'
export type FilibusterGrounds =
  | 'procedural'
  | 'insufficient_debate'
  | 'missing_evidence'
  | 'rights_concern'
  | 'constitutional'

export interface FilibusterEntry {
  id: string
  topic_id: string
  filibuster_id: string | null
  title: string
  speech: string
  grounds: FilibusterGrounds
  cloture_count: number
  cloture_threshold: number
  second_count: number
  second_threshold: number
  extend_hours: number
  status: FilibusterStatus
  expires_at: string
  created_at: string
  resolved_at: string | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number | null
    total_votes: number | null
  } | null
  filibuster_user: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  user_vote: 'cloture' | 'second' | null
}

export interface FilibusterListResponse {
  filibusters: FilibusterEntry[]
  total: number
}

/**
 * GET /api/filibuster
 * Query params:
 *   status  — 'active' | 'overridden' | 'extended' | 'lapsed' | 'withdrawn' | 'all'  (default: 'active')
 *   limit   — number (default 40, max 100)
 *   offset  — number (default 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get('status') ?? 'active'
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? '40')), 100)
  const offset = Math.max(0, Number(searchParams.get('offset') ?? '0'))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let query = supabase
    .from('civic_filibusters')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const VALID: FilibusterStatus[] = ['active', 'overridden', 'extended', 'lapsed', 'withdrawn']
  if (rawStatus !== 'all' && VALID.includes(rawStatus as FilibusterStatus)) {
    query = query.eq('status', rawStatus)
  }

  const { data: rows, count, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ filibusters: [], total: count ?? 0 })
  }

  // Fetch related topics and filibusterer profiles
  const topicIds = [...new Set(rows.map((r) => r.topic_id).filter(Boolean))]
  const userIds = [...new Set(rows.map((r) => r.filibuster_id).filter(Boolean))]

  const [topicsRes, profilesRes, myVotesRes] = await Promise.all([
    topicIds.length
      ? supabase
          .from('topics')
          .select('id, statement, category, status, blue_pct, total_votes')
          .in('id', topicIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', userIds)
      : Promise.resolve({ data: [] }),
    user
      ? supabase
          .from('civic_filibuster_votes')
          .select('filibuster_id, vote')
          .eq('user_id', user.id)
          .in(
            'filibuster_id',
            rows.map((r) => r.id),
          )
      : Promise.resolve({ data: [] }),
  ])

  const topicMap = new Map((topicsRes.data ?? []).map((t) => [t.id, t]))
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))
  const voteMap = new Map(
    (myVotesRes.data ?? []).map((v) => [
      v.filibuster_id,
      v.vote as 'cloture' | 'second',
    ]),
  )

  const filibusters: FilibusterEntry[] = rows.map((row) => ({
    id: row.id,
    topic_id: row.topic_id,
    filibuster_id: row.filibuster_id,
    title: row.title,
    speech: row.speech,
    grounds: row.grounds as FilibusterGrounds,
    cloture_count: row.cloture_count ?? 0,
    cloture_threshold: row.cloture_threshold ?? 10,
    second_count: row.second_count ?? 0,
    second_threshold: row.second_threshold ?? 5,
    extend_hours: row.extend_hours ?? 48,
    status: row.status as FilibusterStatus,
    expires_at: row.expires_at,
    created_at: row.created_at,
    resolved_at: row.resolved_at ?? null,
    topic: topicMap.get(row.topic_id) ?? null,
    filibuster_user: row.filibuster_id
      ? (profileMap.get(row.filibuster_id) ?? null)
      : null,
    user_vote: voteMap.get(row.id) ?? null,
  }))

  return NextResponse.json({ filibusters, total: count ?? 0 })
}

/**
 * POST /api/filibuster
 * Body: { topic_id, title, speech, grounds }
 * Files a new filibuster on a topic. Topic must be in 'voting' status.
 * One active filibuster per topic at a time.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { topic_id?: string; title?: string; speech?: string; grounds?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { topic_id, title, speech, grounds } = body

  if (!topic_id || typeof topic_id !== 'string') {
    return NextResponse.json({ error: 'topic_id required' }, { status: 400 })
  }
  if (!title || typeof title !== 'string' || title.trim().length < 10) {
    return NextResponse.json(
      { error: 'title must be at least 10 characters' },
      { status: 400 },
    )
  }
  if (!speech || typeof speech !== 'string' || speech.trim().length < 150) {
    return NextResponse.json(
      { error: 'speech must be at least 150 characters' },
      { status: 400 },
    )
  }

  const VALID_GROUNDS: FilibusterGrounds[] = [
    'procedural',
    'insufficient_debate',
    'missing_evidence',
    'rights_concern',
    'constitutional',
  ]
  const groundsValue: FilibusterGrounds =
    VALID_GROUNDS.includes(grounds as FilibusterGrounds)
      ? (grounds as FilibusterGrounds)
      : 'insufficient_debate'

  // Check topic exists and is in 'voting' status
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, status, total_votes')
    .eq('id', topic_id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }
  if (topic.status !== 'voting' && topic.status !== 'active') {
    return NextResponse.json(
      { error: 'Filibusters can only be filed on topics in voting or active phase' },
      { status: 400 },
    )
  }

  // Check no active filibuster already exists for this topic
  const { data: existing } = await supabase
    .from('civic_filibusters')
    .select('id')
    .eq('topic_id', topic_id)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'There is already an active filibuster on this topic' },
      { status: 409 },
    )
  }

  // Scale cloture threshold based on topic's vote count (10% of votes, min 10, max 100)
  const voteCount = topic.total_votes ?? 0
  const cloture_threshold = Math.min(100, Math.max(10, Math.floor(voteCount * 0.1)))
  const second_threshold = Math.max(5, Math.floor(cloture_threshold * 0.5))

  const { data: newFilibuster, error: insertError } = await supabase
    .from('civic_filibusters')
    .insert({
      topic_id,
      filibuster_id: user.id,
      title: title.trim().slice(0, 120),
      speech: speech.trim().slice(0, 3000),
      grounds: groundsValue,
      cloture_threshold,
      second_threshold,
      extend_hours: 48,
      status: 'active',
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ id: newFilibuster.id }, { status: 201 })
}
