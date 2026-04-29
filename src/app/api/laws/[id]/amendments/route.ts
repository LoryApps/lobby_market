import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AmendmentProposer {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface Amendment {
  id: string
  law_id: string
  topic_id: string | null
  proposer_id: string
  title: string
  body: string
  status: 'pending' | 'ratified' | 'rejected'
  for_count: number
  against_count: number
  created_at: string
  ratified_at: string | null
  expires_at: string
  proposer: AmendmentProposer | null
  user_vote: boolean | null
}

export interface AmendmentsResponse {
  amendments: Amendment[]
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
  } | null
}

// ─── GET /api/laws/[id]/amendments ───────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [lawResult, amendmentsResult] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, category, established_at')
      .eq('id', params.id)
      .maybeSingle(),

    supabase
      .from('law_amendments')
      .select('*')
      .eq('law_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (!lawResult.data) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const rawAmendments = amendmentsResult.data ?? []

  if (rawAmendments.length === 0) {
    return NextResponse.json({
      amendments: [],
      law: lawResult.data,
    } satisfies AmendmentsResponse)
  }

  // Batch-fetch proposer profiles
  const proposerIds = [...new Set(rawAmendments.map((a) => a.proposer_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', proposerIds)

  const profileMap = new Map<string, AmendmentProposer>()
  for (const p of profiles ?? []) profileMap.set(p.id, p)

  // Fetch current user's votes if authenticated
  const userVoteMap = new Map<string, boolean>()
  if (user) {
    const amendmentIds = rawAmendments.map((a) => a.id)
    const { data: votes } = await supabase
      .from('law_amendment_votes')
      .select('amendment_id, vote')
      .in('amendment_id', amendmentIds)
      .eq('user_id', user.id)

    for (const v of votes ?? []) userVoteMap.set(v.amendment_id, v.vote)
  }

  const amendments: Amendment[] = rawAmendments.map((a) => ({
    id: a.id,
    law_id: a.law_id,
    topic_id: a.topic_id,
    proposer_id: a.proposer_id,
    title: a.title,
    body: a.body,
    status: a.status as Amendment['status'],
    for_count: a.for_count,
    against_count: a.against_count,
    created_at: a.created_at,
    ratified_at: a.ratified_at,
    expires_at: a.expires_at,
    proposer: profileMap.get(a.proposer_id) ?? null,
    user_vote: userVoteMap.has(a.id) ? userVoteMap.get(a.id)! : null,
  }))

  return NextResponse.json({
    amendments,
    law: lawResult.data,
  } satisfies AmendmentsResponse)
}

// ─── POST /api/laws/[id]/amendments ──────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let title: string
  let body: string
  try {
    const json = await req.json()
    title = (json.title ?? '').trim()
    body = (json.body ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!title || title.length < 5 || title.length > 120) {
    return NextResponse.json({ error: 'Title must be 5–120 characters' }, { status: 400 })
  }
  if (!body || body.length < 20 || body.length > 1000) {
    return NextResponse.json({ error: 'Body must be 20–1000 characters' }, { status: 400 })
  }

  // Confirm law exists
  const { data: law } = await supabase
    .from('laws')
    .select('id, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return NextResponse.json({ error: 'Law not found' }, { status: 404 })

  // Rate-limit: max 2 pending amendments per user per law
  const { count } = await supabase
    .from('law_amendments')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', params.id)
    .eq('proposer_id', user.id)
    .eq('status', 'pending')

  if ((count ?? 0) >= 2) {
    return NextResponse.json(
      { error: 'You already have 2 pending amendments on this law' },
      { status: 429 }
    )
  }

  const { data: amendment, error } = await supabase
    .from('law_amendments')
    .insert({
      law_id: params.id,
      topic_id: law.topic_id ?? null,
      proposer_id: user.id,
      title,
      body,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create amendment' }, { status: 500 })
  }

  return NextResponse.json({ amendment }, { status: 201 })
}
