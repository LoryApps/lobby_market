import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CVProposer {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  clout: number
}

export interface ConfidenceVote {
  id: string
  motion_type: 'no_confidence' | 'confidence' | 'censure'
  target_name: string
  target_type: 'coalition' | 'committee' | 'elder' | 'council' | 'officer'
  reason: string
  context_note: string | null
  seconds_required: number
  seconds_count: number
  ayes: number
  noes: number
  abstentions: number
  status: 'tabling' | 'open' | 'closed' | 'withdrawn'
  outcome: 'carried' | 'defeated' | 'withdrawn' | null
  created_at: string
  seconds_deadline: string
  closes_at: string | null
  proposer: CVProposer
  user_has_seconded: boolean
  user_ballot: 'aye' | 'no' | 'abstain' | null
}

export interface CVListResponse {
  votes: ConfidenceVote[]
  user_tabled_this_week: boolean
}

// ── GET: list all confidence votes ───────────────────────────────────────────

export async function GET(): Promise<NextResponse<CVListResponse | { error: string }>> {
  const supabase = await createClient()

  await supabase.rpc('expire_confidence_votes').maybeSingle()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: rows, error } = await supabase
    .from('confidence_votes')
    .select(`
      id, motion_type, target_name, target_type, reason, context_note,
      seconds_required, seconds_count, ayes, noes, abstentions,
      status, outcome, created_at, seconds_deadline, closes_at,
      proposer:profiles!proposer_id(id, username, display_name, avatar_url, clout)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch user context in parallel
  let secondedIds = new Set<string>()
  let ballotsMap = new Map<string, string>()
  let userTabledThisWeek = false

  if (user) {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
    const [{ data: seconds }, { data: ballots }, { data: tabled }] = await Promise.all([
      supabase
        .from('confidence_vote_seconds')
        .select('confidence_vote_id')
        .eq('user_id', user.id),
      supabase
        .from('confidence_vote_ballots')
        .select('confidence_vote_id, ballot')
        .eq('user_id', user.id),
      supabase
        .from('confidence_votes')
        .select('id')
        .eq('proposer_id', user.id)
        .gte('created_at', weekAgo)
        .limit(1),
    ])

    secondedIds = new Set((seconds ?? []).map((s) => s.confidence_vote_id))
    ballotsMap = new Map((ballots ?? []).map((b) => [b.confidence_vote_id, b.ballot]))
    userTabledThisWeek = (tabled ?? []).length > 0
  }

  const votes: ConfidenceVote[] = (rows ?? []).map((r) => ({
    id: r.id,
    motion_type: r.motion_type,
    target_name: r.target_name,
    target_type: r.target_type,
    reason: r.reason,
    context_note: r.context_note,
    seconds_required: r.seconds_required,
    seconds_count: r.seconds_count,
    ayes: r.ayes,
    noes: r.noes,
    abstentions: r.abstentions,
    status: r.status,
    outcome: r.outcome,
    created_at: r.created_at,
    seconds_deadline: r.seconds_deadline,
    closes_at: r.closes_at,
    proposer: Array.isArray(r.proposer) ? r.proposer[0] : r.proposer,
    user_has_seconded: secondedIds.has(r.id),
    user_ballot: (ballotsMap.get(r.id) as ConfidenceVote['user_ballot']) ?? null,
  }))

  return NextResponse.json({ votes, user_tabled_this_week: userTabledThisWeek })
}

// ── POST: table a new confidence vote ────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body = await req.json()
  const { motion_type, target_name, target_type, reason, context_note } = body

  if (!motion_type || !target_name || !target_type || !reason) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // One motion per citizen per 7 days
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data: existing } = await supabase
    .from('confidence_votes')
    .select('id')
    .eq('proposer_id', user.id)
    .gte('created_at', weekAgo)
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'You may only table one motion per 7 days' }, { status: 429 })
  }

  const { data, error } = await supabase
    .from('confidence_votes')
    .insert({
      proposer_id: user.id,
      motion_type,
      target_name,
      target_type,
      reason,
      context_note: context_note || null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.id }, { status: 201 })
}
