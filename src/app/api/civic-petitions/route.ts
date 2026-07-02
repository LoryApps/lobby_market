import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type ActionType = 'hearing' | 'referendum' | 'assembly' | 'review'
export type PetitionStatus = 'open' | 'fulfilled' | 'expired' | 'rejected'

export interface CivicPetitionEntry {
  id: string
  title: string
  description: string
  committee: string
  action_type: ActionType
  target_signatures: number
  signature_count: number
  status: PetitionStatus
  closes_at: string
  created_at: string
  topic_id: string | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
  creator: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  user_has_signed: boolean
  pct_complete: number
}

export interface CivicPetitionsResponse {
  petitions: CivicPetitionEntry[]
  total: number
}

/**
 * GET /api/civic-petitions
 *
 * List civic petitions.
 * Query params:
 *   status    — 'open' | 'fulfilled' | 'expired' | 'rejected' | 'all'  (default: 'open')
 *   topic_id  — filter by topic
 *   limit     — number (default 30, max 100)
 *   offset    — number (default 0)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const rawStatus = searchParams.get('status') ?? 'open'
  const topicId = searchParams.get('topic_id')
  const limit = Math.min(Math.max(1, Number(searchParams.get('limit') ?? '30')), 100)
  const offset = Math.max(0, Number(searchParams.get('offset') ?? '0'))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Build query
  let query = supabase
    .from('civic_petitions')
    .select(
      `id, title, description, committee, action_type,
       target_signatures, signature_count, status, closes_at, created_at,
       topic_id,
       topics:topic_id ( id, statement, category, status ),
       creator:creator_id ( id, username, display_name, avatar_url, role )`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const VALID_STATUSES: PetitionStatus[] = ['open', 'fulfilled', 'expired', 'rejected']
  if (rawStatus !== 'all' && VALID_STATUSES.includes(rawStatus as PetitionStatus)) {
    query = query.eq('status', rawStatus)
  }
  if (topicId) {
    query = query.eq('topic_id', topicId)
  }

  const { data: rows, count, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch which petitions the current user has signed
  let signedIds = new Set<string>()
  if (user && rows && rows.length > 0) {
    const ids = rows.map((r) => r.id)
    const { data: sigs } = await supabase
      .from('civic_petition_signatures')
      .select('petition_id')
      .eq('user_id', user.id)
      .in('petition_id', ids)
    if (sigs) signedIds = new Set(sigs.map((s) => s.petition_id))
  }

  const petitions: CivicPetitionEntry[] = (rows ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    committee: row.committee,
    action_type: row.action_type as ActionType,
    target_signatures: row.target_signatures,
    signature_count: row.signature_count,
    status: row.status as PetitionStatus,
    closes_at: row.closes_at,
    created_at: row.created_at,
    topic_id: row.topic_id ?? null,
    topic: Array.isArray(row.topics) ? (row.topics[0] ?? null) : (row.topics as CivicPetitionEntry['topic'] | null),
    creator: Array.isArray(row.creator) ? (row.creator[0] ?? null) : (row.creator as CivicPetitionEntry['creator'] | null),
    user_has_signed: signedIds.has(row.id),
    pct_complete: row.target_signatures > 0
      ? Math.min(100, Math.round((row.signature_count / row.target_signatures) * 100))
      : 0,
  }))

  return NextResponse.json({ petitions, total: count ?? 0 } satisfies CivicPetitionsResponse)
}

/**
 * POST /api/civic-petitions
 *
 * Create a new civic petition. Requires auth.
 * Body: { title, description, committee, action_type, target_signatures, topic_id?, closes_in_days? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const title = String(body.title ?? '').trim()
  const description = String(body.description ?? '').trim()
  const committee = String(body.committee ?? '').trim()
  const action_type = String(body.action_type ?? 'hearing')
  const topic_id = typeof body.topic_id === 'string' && body.topic_id ? body.topic_id : null
  const target_signatures = Math.max(10, Math.min(10_000, Number(body.target_signatures ?? 100)))
  const closes_in_days = Math.max(7, Math.min(90, Number(body.closes_in_days ?? 30)))

  if (title.length < 10 || title.length > 200)
    return NextResponse.json({ error: 'title_length' }, { status: 400 })
  if (description.length < 20 || description.length > 2000)
    return NextResponse.json({ error: 'description_length' }, { status: 400 })
  if (!committee)
    return NextResponse.json({ error: 'committee_required' }, { status: 400 })
  if (!['hearing', 'referendum', 'assembly', 'review'].includes(action_type))
    return NextResponse.json({ error: 'invalid_action_type' }, { status: 400 })

  const closes_at = new Date(Date.now() + closes_in_days * 86_400_000).toISOString()

  const { data: petition, error } = await supabase
    .from('civic_petitions')
    .insert({
      title,
      description,
      committee,
      action_type,
      topic_id,
      creator_id: user.id,
      target_signatures,
      closes_at,
      status: 'open',
    })
    .select('id, title, status, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ petition }, { status: 201 })
}
