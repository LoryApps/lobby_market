import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChallengeGrounds =
  | 'constitutional'
  | 'procedural'
  | 'factual'
  | 'ethical'
  | 'practical'

export type ChallengeStatus = 'open' | 'upheld' | 'dismissed'

export interface GlobalChallengeItem {
  id: string
  grounds: ChallengeGrounds
  title: string
  description: string
  status: ChallengeStatus
  support_count: number
  oppose_count: number
  created_at: string
  law_id: string
  law_statement: string
  law_category: string | null
  law_blue_pct: number | null
  law_total_votes: number | null
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  user_vote: 'support' | 'oppose' | null
}

export interface GlobalChallengesResponse {
  challenges: GlobalChallengeItem[]
  total: number
  by_grounds: Record<ChallengeGrounds, number>
  by_status: Record<ChallengeStatus, number>
}

// ─── GET /api/laws/challenges ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const url = req.nextUrl
  const grounds = url.searchParams.get('grounds') as ChallengeGrounds | null
  const status  = url.searchParams.get('status')  as ChallengeStatus  | null
  const sort    = url.searchParams.get('sort') ?? 'support'   // support | recent | contested
  const limit   = Math.min(parseInt(url.searchParams.get('limit') ?? '40', 10), 100)

  const { data: { user } } = await supabase.auth.getUser()

  // ── Base query: challenges joined with laws ───────────────────────────────
  let query = db
    .from('law_challenges')
    .select(`
      id, grounds, title, description, status,
      support_count, oppose_count, created_at, law_id, user_id,
      laws!inner (
        id, statement, category, blue_pct, total_votes
      )
    `)
    .limit(limit)

  if (grounds) query = query.eq('grounds', grounds)
  if (status)  query = query.eq('status', status)
  else         query = query.eq('status', 'open')   // default: open

  if (sort === 'support')   query = query.order('support_count',  { ascending: false })
  else if (sort === 'recent') query = query.order('created_at',   { ascending: false })
  else if (sort === 'contested') {
    // contested = highest (support + oppose) total
    query = query.order('support_count', { ascending: false }).order('oppose_count', { ascending: false })
  } else {
    query = query.order('support_count', { ascending: false })
  }

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const challengeRows: {
    id: string; grounds: string; title: string; description: string
    status: string; support_count: number; oppose_count: number
    created_at: string; law_id: string; user_id: string
    laws: { id: string; statement: string; category: string | null; blue_pct: number | null; total_votes: number | null }
  }[] = rows ?? []

  // ── Author profiles ───────────────────────────────────────────────────────
  const authorIds = Array.from(new Set(challengeRows.map((r) => r.user_id)))
  const profileMap = new Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }>()

  if (authorIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)

    for (const p of profiles ?? []) profileMap.set(p.id, p)
  }

  // ── User votes ────────────────────────────────────────────────────────────
  const voteMap = new Map<string, 'support' | 'oppose'>()
  if (user && challengeRows.length > 0) {
    const challengeIds = challengeRows.map((r) => r.id)
    const { data: votes } = await db
      .from('law_challenge_votes')
      .select('challenge_id, vote')
      .eq('user_id', user.id)
      .in('challenge_id', challengeIds)

    for (const v of votes ?? []) voteMap.set(v.challenge_id, v.vote as 'support' | 'oppose')
  }

  // ── Aggregates ────────────────────────────────────────────────────────────
  const { data: allRows } = await db
    .from('law_challenges')
    .select('grounds, status')

  const by_grounds: Record<ChallengeGrounds, number> = {
    constitutional: 0, procedural: 0, factual: 0, ethical: 0, practical: 0,
  }
  const by_status: Record<ChallengeStatus, number> = {
    open: 0, upheld: 0, dismissed: 0,
  }
  for (const r of (allRows ?? [])) {
    if (r.grounds in by_grounds) by_grounds[r.grounds as ChallengeGrounds]++
    if (r.status  in by_status)  by_status[r.status   as ChallengeStatus]++
  }

  const challenges: GlobalChallengeItem[] = challengeRows.map((r) => ({
    id: r.id,
    grounds: r.grounds as ChallengeGrounds,
    title: r.title,
    description: r.description,
    status: r.status as ChallengeStatus,
    support_count: r.support_count,
    oppose_count: r.oppose_count,
    created_at: r.created_at,
    law_id: r.law_id,
    law_statement: r.laws.statement,
    law_category: r.laws.category,
    law_blue_pct: r.laws.blue_pct,
    law_total_votes: r.laws.total_votes,
    author: profileMap.get(r.user_id) ?? null,
    user_vote: voteMap.get(r.id) ?? null,
  }))

  const response: GlobalChallengesResponse = {
    challenges,
    total: (allRows ?? []).length,
    by_grounds,
    by_status,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
