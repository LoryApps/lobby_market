import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BudgetLine {
  id: string
  category: string
  allocation: number
  description: string
  change_pct: number
  priority_rank: number
}

export interface BudgetAmendment {
  id: string
  budget_id: string
  category: string
  proposed_pct: number
  rationale: string
  upvote_count: number
  status: 'proposed' | 'accepted' | 'rejected'
  created_at: string
  proposer_username: string | null
  proposer_display: string | null
  proposer_avatar: string | null
  user_upvoted: boolean
}

export interface CivicBudget {
  id: string
  fiscal_year: number
  title: string
  chancellor_statement: string | null
  status: 'proposed' | 'debating' | 'passed' | 'failed' | 'withdrawn'
  votes_approve: number
  votes_reject: number
  debate_ends_at: string | null
  resolved_at: string | null
  created_at: string
  coalition_name: string | null
  coalition_color: string | null
  lines: BudgetLine[]
  amendments: BudgetAmendment[]
  user_vote: 'approve' | 'reject' | null
}

// ─── GET — current budget ─────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Grab the most recent budget (latest fiscal year first)
  const { data: budgets, error } = await supabase
    .from('civic_budgets')
    .select(`
      id,
      fiscal_year,
      title,
      chancellor_statement,
      status,
      votes_approve,
      votes_reject,
      debate_ends_at,
      resolved_at,
      created_at,
      coalition_id,
      coalitions (
        name,
        color
      )
    `)
    .order('fiscal_year', { ascending: false })
    .limit(5)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!budgets?.length) {
    // Return seed data so the page isn't empty
    return NextResponse.json({ budgets: [], seed: true })
  }

  const current = budgets[0]

  // Budget lines
  const { data: lines } = await supabase
    .from('civic_budget_lines')
    .select('*')
    .eq('budget_id', current.id)
    .order('allocation', { ascending: false })

  // Amendments
  const { data: rawAmendments } = await supabase
    .from('civic_budget_amendments')
    .select(`
      id, budget_id, category, proposed_pct, rationale,
      upvote_count, status, created_at,
      profiles:proposed_by (username, display_name, avatar_url)
    `)
    .eq('budget_id', current.id)
    .order('upvote_count', { ascending: false })
    .limit(20)

  // User's vote
  let userVote: 'approve' | 'reject' | null = null
  let userAmendmentUpvotes: string[] = []

  if (user) {
    const { data: voteRow } = await supabase
      .from('civic_budget_votes')
      .select('side')
      .eq('budget_id', current.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (voteRow) userVote = voteRow.side as 'approve' | 'reject'

    if (rawAmendments?.length) {
      const ids = rawAmendments.map((a) => a.id)
      const { data: upvoteRows } = await supabase
        .from('civic_budget_amendment_votes')
        .select('amendment_id')
        .eq('user_id', user.id)
        .in('amendment_id', ids)
      userAmendmentUpvotes = (upvoteRows ?? []).map((r) => r.amendment_id)
    }
  }

  const coalitionData = current.coalitions as { name: string; color: string } | null

  const amendments: BudgetAmendment[] = (rawAmendments ?? []).map((a) => {
    const p = a.profiles as { username: string; display_name: string | null; avatar_url: string | null } | null
    return {
      id: a.id,
      budget_id: a.budget_id,
      category: a.category,
      proposed_pct: a.proposed_pct,
      rationale: a.rationale,
      upvote_count: a.upvote_count,
      status: a.status,
      created_at: a.created_at,
      proposer_username: p?.username ?? null,
      proposer_display: p?.display_name ?? null,
      proposer_avatar: p?.avatar_url ?? null,
      user_upvoted: userAmendmentUpvotes.includes(a.id),
    }
  })

  const budget: CivicBudget = {
    id: current.id,
    fiscal_year: current.fiscal_year,
    title: current.title,
    chancellor_statement: current.chancellor_statement,
    status: current.status as CivicBudget['status'],
    votes_approve: current.votes_approve,
    votes_reject: current.votes_reject,
    debate_ends_at: current.debate_ends_at,
    resolved_at: current.resolved_at,
    created_at: current.created_at,
    coalition_name: coalitionData?.name ?? null,
    coalition_color: coalitionData?.color ?? null,
    lines: (lines ?? []) as BudgetLine[],
    amendments,
    user_vote: userVote,
  }

  return NextResponse.json({ budget, past: budgets.slice(1) })
}

// ─── POST — vote on budget ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { budget_id, side } = body as { budget_id: string; side: 'approve' | 'reject' }

  if (!budget_id || !['approve', 'reject'].includes(side)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
  }

  const { error } = await supabase.from('civic_budget_votes').insert({
    budget_id,
    user_id: user.id,
    side,
  })

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Already voted' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
