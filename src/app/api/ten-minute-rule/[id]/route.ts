import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TMRAuthor, TMRProposal } from '../route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface TMRDetailResponse {
  proposal: TMRProposal
  topic_statement: string | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const id = params.id

  const { data: row, error } = await supabase
    .from('civic_tmr_proposals')
    .select(`
      id, title, category, proposal_speech, opposition_speech,
      status, votes_for, votes_against,
      voting_opens_at, voting_closes_at, decided_at,
      topic_id, bill_id, created_at,
      author:profiles!civic_tmr_proposals_author_id_fkey(id, username, display_name, avatar_url, role, clout),
      opponent:profiles!civic_tmr_proposals_opponent_id_fkey(id, username, display_name, avatar_url, role, clout)
    `)
    .eq('id', id)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let userVote: 'for' | 'against' | null = null
  if (user) {
    const { data: voteRow } = await supabase
      .from('civic_tmr_votes')
      .select('side')
      .eq('proposal_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (voteRow) userVote = (voteRow as { side: string }).side as 'for' | 'against'
  }

  let topic_statement: string | null = null
  if ((row as Record<string, unknown>).topic_id) {
    const { data: topicRow } = await supabase
      .from('topics')
      .select('statement')
      .eq('id', (row as Record<string, unknown>).topic_id as string)
      .maybeSingle()
    if (topicRow) topic_statement = (topicRow as { statement: string }).statement
  }

  const r = row as Record<string, unknown>
  const proposal: TMRProposal = {
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
    user_vote: userVote,
  }

  return NextResponse.json({ proposal, topic_statement } satisfies TMRDetailResponse)
}
