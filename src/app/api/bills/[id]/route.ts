import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BillAmendment {
  id: string
  clause_number: string
  amendment: string
  status: string
  votes_for: number
  votes_against: number
  created_at: string
  proposer: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
  user_vote: boolean | null
}

export interface BillDetail {
  id: string
  short_title: string
  long_title: string
  category: string
  bill_type: string
  stage: string
  status: string
  votes_for: number
  votes_against: number
  first_reading_at: string
  second_reading_at: string | null
  committee_at: string | null
  report_at: string | null
  third_reading_at: string | null
  lords_at: string | null
  royal_assent_at: string | null
  defeated_at: string | null
  debate_closes_at: string | null
  view_count: number
  created_at: string
  sponsor: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  amendments: BillAmendment[]
  user_vote: string | null
  is_sponsor: boolean
  user_role: string | null
}

// ─── GET /api/bills/[id] ──────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: bill, error } = await supabase
    .from('civic_bills')
    .select(`
      *,
      sponsor:profiles!civic_bills_sponsor_id_fkey(
        id, username, display_name, avatar_url, role
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !bill) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  }

  // Increment view count (fire and forget)
  supabase
    .from('civic_bills')
    .update({ view_count: (bill.view_count ?? 0) + 1 })
    .eq('id', params.id)
    .then(() => {})

  // Fetch amendments
  const { data: amendments } = await supabase
    .from('bill_amendments')
    .select(`
      id, clause_number, amendment, status, votes_for, votes_against, created_at,
      proposer:profiles!bill_amendments_proposer_id_fkey(
        id, username, display_name, avatar_url
      )
    `)
    .eq('bill_id', params.id)
    .order('created_at', { ascending: true })

  // Fetch user's vote + role + amendment votes
  let userVote: string | null = null
  let isSponsor = false
  let userRole: string | null = null
  const userAmendmentVotes: Record<string, boolean> = {}

  if (user) {
    const amendmentIds = (amendments ?? []).map((a) => a.id)

    const queries: Promise<unknown>[] = [
      supabase
        .from('bill_reading_votes')
        .select('position')
        .eq('bill_id', params.id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single(),
    ]

    if (amendmentIds.length > 0) {
      queries.push(
        supabase
          .from('bill_amendment_votes')
          .select('amendment_id, vote')
          .eq('user_id', user.id)
          .in('amendment_id', amendmentIds)
      )
    }

    const [voteRes, profileRes, amendVotesRes] = await Promise.all(queries) as [
      { data: { position: string } | null },
      { data: { role: string } | null },
      { data: Array<{ amendment_id: string; vote: boolean }> | null } | undefined,
    ]

    userVote  = voteRes.data?.position ?? null
    isSponsor = bill.sponsor_id === user.id
    userRole  = profileRes.data?.role ?? null

    if (amendVotesRes?.data) {
      for (const av of amendVotesRes.data) {
        userAmendmentVotes[av.amendment_id] = av.vote
      }
    }
  }

  const sponsor = Array.isArray(bill.sponsor) ? bill.sponsor[0] ?? null : bill.sponsor

  const detail: BillDetail = {
    ...bill,
    sponsor,
    amendments: (amendments ?? []).map((a) => ({
      ...a,
      proposer: Array.isArray(a.proposer) ? a.proposer[0] ?? null : a.proposer,
      user_vote: userAmendmentVotes[a.id] ?? null,
    })),
    user_vote: userVote,
    is_sponsor: isSponsor || userRole === 'elder' || userRole === 'troll_catcher',
    user_role:  userRole,
  }

  return NextResponse.json(detail)
}

// ─── POST /api/bills/[id] — cast a reading vote ───────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as { reading: string; position: string }
  const { reading, position } = body

  if (!['second_reading', 'third_reading'].includes(reading)) {
    return NextResponse.json({ error: 'Invalid reading' }, { status: 400 })
  }

  if (!['for', 'against', 'abstain'].includes(position)) {
    return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
  }

  // Upsert vote
  const { error } = await supabase
    .from('bill_reading_votes')
    .upsert(
      { bill_id: params.id, user_id: user.id, reading, position },
      { onConflict: 'bill_id,user_id,reading' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Re-tally from bill_reading_votes
  const { data: allVotes } = await supabase
    .from('bill_reading_votes')
    .select('position')
    .eq('bill_id', params.id)

  const forCount = allVotes?.filter((v) => v.position === 'for').length ?? 0
  const againstCount = allVotes?.filter((v) => v.position === 'against').length ?? 0

  await supabase
    .from('civic_bills')
    .update({ votes_for: forCount, votes_against: againstCount })
    .eq('id', params.id)

  return NextResponse.json({ ok: true, votes_for: forCount, votes_against: againstCount })
}
