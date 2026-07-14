import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TMRAuthor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface TMRProposal {
  id: string
  title: string
  category: string
  proposal_speech: string
  opposition_speech: string | null
  status: string
  votes_for: number
  votes_against: number
  voting_opens_at: string | null
  voting_closes_at: string | null
  decided_at: string | null
  topic_id: string | null
  bill_id: string | null
  created_at: string
  author: TMRAuthor | null
  opponent: TMRAuthor | null
  user_vote: 'for' | 'against' | null
}

export interface TMRStats {
  total: number
  voting: number
  passed: number
  seeking_opponent: number
}

export interface TMRListResponse {
  proposals: TMRProposal[]
  stats: TMRStats
}

// ─── GET /api/ten-minute-rule ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'all'
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('civic_tmr_proposals')
    .select(`
      id, title, category, proposal_speech, opposition_speech,
      status, votes_for, votes_against,
      voting_opens_at, voting_closes_at, decided_at,
      topic_id, bill_id, created_at,
      author:profiles!civic_tmr_proposals_author_id_fkey(id, username, display_name, avatar_url, role, clout),
      opponent:profiles!civic_tmr_proposals_opponent_id_fkey(id, username, display_name, avatar_url, role, clout)
    `)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status !== 'all') {
    query = query.eq('status', status)
  } else {
    query = query.neq('status', 'draft')
  }

  const { data: rows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let userVoteMap: Record<string, 'for' | 'against'> = {}
  if (user && rows && rows.length > 0) {
    const ids = (rows as Array<{ id: string }>).map((r) => r.id)
    const { data: voteRows } = await supabase
      .from('civic_tmr_votes')
      .select('proposal_id, side')
      .eq('user_id', user.id)
      .in('proposal_id', ids)
    if (voteRows) {
      userVoteMap = Object.fromEntries(
        (voteRows as Array<{ proposal_id: string; side: string }>).map((v) => [v.proposal_id, v.side as 'for' | 'against'])
      )
    }
  }

  const proposals: TMRProposal[] = ((rows ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    category: r.category as string,
    proposal_speech: r.proposal_speech as string,
    opposition_speech: r.opposition_speech as string | null,
    status: r.status as string,
    votes_for: r.votes_for as number,
    votes_against: r.votes_against as number,
    voting_opens_at: r.voting_opens_at as string | null,
    voting_closes_at: r.voting_closes_at as string | null,
    decided_at: r.decided_at as string | null,
    topic_id: r.topic_id as string | null,
    bill_id: r.bill_id as string | null,
    created_at: r.created_at as string,
    author: r.author as TMRAuthor | null,
    opponent: r.opponent as TMRAuthor | null,
    user_vote: userVoteMap[r.id as string] ?? null,
  }))

  const { data: statsRows } = await supabase
    .from('civic_tmr_proposals')
    .select('status')
    .neq('status', 'draft')

  const stats: TMRStats = {
    total: statsRows?.length ?? 0,
    voting: (statsRows as Array<{ status: string }> | null)?.filter((r) => r.status === 'voting').length ?? 0,
    passed: (statsRows as Array<{ status: string }> | null)?.filter((r) => r.status === 'passed').length ?? 0,
    seeking_opponent: (statsRows as Array<{ status: string }> | null)?.filter((r) => r.status === 'seeking_opponent').length ?? 0,
  }

  return NextResponse.json({ proposals, stats } satisfies TMRListResponse)
}

// ─── POST /api/ten-minute-rule ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, category, proposal_speech, topic_id } = body as {
    title?: string
    category?: string
    proposal_speech?: string
    topic_id?: string | null
  }

  if (!title?.trim() || title.trim().length < 10) {
    return NextResponse.json({ error: 'Title must be at least 10 characters.' }, { status: 400 })
  }
  if (!proposal_speech?.trim() || proposal_speech.trim().length < 100) {
    return NextResponse.json({ error: 'Proposal speech must be at least 100 characters.' }, { status: 400 })
  }
  if (!category?.trim()) {
    return NextResponse.json({ error: 'Category is required.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('civic_tmr_proposals')
    .insert({
      author_id: user.id,
      title: title.trim().slice(0, 120),
      category,
      proposal_speech: proposal_speech.trim().slice(0, 2000),
      topic_id: topic_id ?? null,
      status: 'seeking_opponent',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: (data as { id: string }).id }, { status: 201 })
}
