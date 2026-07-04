import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentDilemma } from '@/lib/data/crossroads-dilemmas'

export const dynamic = 'force-dynamic'

export type { CrossroadsDilemma } from '@/lib/data/crossroads-dilemmas'

// ─── Response types ────────────────────────────────────────────────────────────

export interface CrossroadsStats {
  totalVotes: number
  countA: number
  countB: number
  pctA: number
  pctB: number
}

export interface CrossroadsResponse {
  dilemma: CrossroadsDilemma
  stats: CrossroadsStats
  userVote: 'A' | 'B' | null
  history: { dilemmaId: string; choice: 'A' | 'B' }[]
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const dilemma = getCurrentDilemma()

  const { data: { user } } = await supabase.auth.getUser()

  // Aggregate counts for this dilemma
  const { data: rows } = await supabase
    .from('crossroads_votes')
    .select('choice')
    .eq('dilemma_id', dilemma.id)

  const countA = (rows ?? []).filter((r) => r.choice === 'A').length
  const countB = (rows ?? []).filter((r) => r.choice === 'B').length
  const total = countA + countB

  const stats: CrossroadsStats = {
    totalVotes: total,
    countA,
    countB,
    pctA: total > 0 ? Math.round((countA / total) * 100) : 50,
    pctB: total > 0 ? Math.round((countB / total) * 100) : 50,
  }

  // User's vote on current dilemma
  let userVote: 'A' | 'B' | null = null
  let history: { dilemmaId: string; choice: 'A' | 'B' }[] = []

  if (user) {
    const { data: voteRow } = await supabase
      .from('crossroads_votes')
      .select('choice')
      .eq('user_id', user.id)
      .eq('dilemma_id', dilemma.id)
      .maybeSingle()

    if (voteRow) userVote = voteRow.choice as 'A' | 'B'

    // Past choices for profile
    const { data: histRows } = await supabase
      .from('crossroads_votes')
      .select('dilemma_id, choice')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    history = (histRows ?? []).map((r) => ({
      dilemmaId: r.dilemma_id,
      choice: r.choice as 'A' | 'B',
    }))
  }

  return NextResponse.json({ dilemma, stats, userVote, history } satisfies CrossroadsResponse)
}

// ─── POST — Cast a vote ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { choice } = body as { choice?: string }

  if (choice !== 'A' && choice !== 'B') {
    return NextResponse.json({ error: 'choice must be A or B' }, { status: 400 })
  }

  const dilemma = getCurrentDilemma()

  const { error } = await supabase
    .from('crossroads_votes')
    .insert({ user_id: user.id, dilemma_id: dilemma.id, choice })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already voted on this dilemma' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return fresh stats
  const { data: rows } = await supabase
    .from('crossroads_votes')
    .select('choice')
    .eq('dilemma_id', dilemma.id)

  const countA = (rows ?? []).filter((r) => r.choice === 'A').length
  const countB = (rows ?? []).filter((r) => r.choice === 'B').length
  const total = countA + countB

  return NextResponse.json({
    ok: true,
    stats: {
      totalVotes: total,
      countA,
      countB,
      pctA: total > 0 ? Math.round((countA / total) * 100) : 50,
      pctB: total > 0 ? Math.round((countB / total) * 100) : 50,
    } satisfies CrossroadsStats,
  })
}
