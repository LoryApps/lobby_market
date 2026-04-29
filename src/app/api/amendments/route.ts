import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AmendmentEntry {
  id: string
  law_id: string
  topic_id: string | null
  title: string
  body: string
  status: 'pending' | 'ratified' | 'rejected'
  for_count: number
  against_count: number
  created_at: string
  ratified_at: string | null
  expires_at: string
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
    total_votes: number | null
    blue_pct: number | null
  } | null
  proposer: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  user_vote: boolean | null
}

export interface AllAmendmentsResponse {
  amendments: AmendmentEntry[]
  total: number
}

// ─── GET /api/amendments ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'pending'
  const category = searchParams.get('category')
  const limit = Math.min(Number(searchParams.get('limit') ?? 30), 50)
  const offset = Number(searchParams.get('offset') ?? 0)

  // Fetch amendments joined with law data
  let query = supabase
    .from('law_amendments')
    .select('*, law:laws(id, statement, category, established_at, total_votes, blue_pct)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: rawAmendments, count, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch amendments' }, { status: 500 })
  }

  let amendments = rawAmendments ?? []

  // Filter by category after join (Supabase doesn't support nested eq in this pattern easily)
  if (category) {
    amendments = amendments.filter(
      (a) => (a.law as { category?: string | null } | null)?.category === category
    )
  }

  if (amendments.length === 0) {
    return NextResponse.json({ amendments: [], total: count ?? 0 } satisfies AllAmendmentsResponse)
  }

  // Batch-fetch proposer profiles
  const proposerIds = [...new Set(amendments.map((a) => a.proposer_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', proposerIds)

  const profileMap = new Map<string, AmendmentEntry['proposer']>()
  for (const p of profiles ?? []) profileMap.set(p.id, p)

  // Fetch current user's votes
  const userVoteMap = new Map<string, boolean>()
  if (user) {
    const amendmentIds = amendments.map((a) => a.id)
    const { data: votes } = await supabase
      .from('law_amendment_votes')
      .select('amendment_id, vote')
      .in('amendment_id', amendmentIds)
      .eq('user_id', user.id)

    for (const v of votes ?? []) userVoteMap.set(v.amendment_id, v.vote)
  }

  const result: AmendmentEntry[] = amendments.map((a) => ({
    id: a.id,
    law_id: a.law_id,
    topic_id: a.topic_id,
    title: a.title,
    body: a.body,
    status: a.status as AmendmentEntry['status'],
    for_count: a.for_count,
    against_count: a.against_count,
    created_at: a.created_at,
    ratified_at: a.ratified_at,
    expires_at: a.expires_at,
    law: a.law as AmendmentEntry['law'],
    proposer: profileMap.get(a.proposer_id) ?? null,
    user_vote: userVoteMap.has(a.id) ? userVoteMap.get(a.id)! : null,
  }))

  return NextResponse.json({ amendments: result, total: count ?? 0 } satisfies AllAmendmentsResponse)
}
