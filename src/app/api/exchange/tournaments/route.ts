import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Tournament {
  id: string
  title: string
  description: string | null
  category: string | null
  status: 'upcoming' | 'active' | 'finished'
  starts_at: string
  ends_at: string
  prize_description: string | null
  created_at: string
  entry_count: number
  user_entered: boolean
  user_score: number | null
  user_rank: number | null
}

export interface TournamentsResponse {
  active: Tournament[]
  upcoming: Tournament[]
  finished: Tournament[]
}

// ─── GET — list all tournaments ───────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch all tournaments
  const { data: rows, error } = await supabase
    .from('exchange_tournaments')
    .select('id, title, description, category, status, starts_at, ends_at, prize_description, created_at')
    .order('starts_at', { ascending: true })
    .limit(50)

  if (error || !rows) {
    return NextResponse.json<TournamentsResponse>({ active: [], upcoming: [], finished: [] })
  }

  // Fetch entry counts per tournament in one query
  const tournamentIds = rows.map((r) => r.id)

  const { data: entryCounts } = await supabase
    .from('exchange_tournament_entries')
    .select('tournament_id')
    .in('tournament_id', tournamentIds)

  const countMap: Record<string, number> = {}
  for (const e of entryCounts ?? []) {
    countMap[e.tournament_id] = (countMap[e.tournament_id] ?? 0) + 1
  }

  // Fetch current user's entries
  let userEntries: Array<{ tournament_id: string; score: number; rank: number | null }> = []
  if (user) {
    const { data } = await supabase
      .from('exchange_tournament_entries')
      .select('tournament_id, score, rank')
      .eq('user_id', user.id)
      .in('tournament_id', tournamentIds)

    userEntries = (data ?? []) as typeof userEntries
  }

  const userEntryMap: Record<string, { score: number; rank: number | null }> = {}
  for (const e of userEntries) {
    userEntryMap[e.tournament_id] = { score: e.score, rank: e.rank }
  }

  // Shape response
  const tournaments: Tournament[] = rows.map((r) => ({
    ...r,
    status: r.status as Tournament['status'],
    entry_count: countMap[r.id] ?? 0,
    user_entered: !!userEntryMap[r.id],
    user_score: userEntryMap[r.id]?.score ?? null,
    user_rank: userEntryMap[r.id]?.rank ?? null,
  }))

  const active   = tournaments.filter((t) => t.status === 'active')
  const upcoming = tournaments.filter((t) => t.status === 'upcoming')
  const finished = tournaments.filter((t) => t.status === 'finished')

  return NextResponse.json<TournamentsResponse>({ active, upcoming, finished })
}

// ─── POST — join a tournament ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as { tournament_id?: string }
  const { tournament_id } = body

  if (!tournament_id) {
    return NextResponse.json({ error: 'tournament_id required' }, { status: 400 })
  }

  // Verify tournament exists and is joinable (upcoming or active)
  const { data: tournament } = await supabase
    .from('exchange_tournaments')
    .select('id, status, ends_at')
    .eq('id', tournament_id)
    .maybeSingle()

  if (!tournament) {
    return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  }
  if (tournament.status === 'finished') {
    return NextResponse.json({ error: 'Tournament has ended' }, { status: 422 })
  }
  if (new Date(tournament.ends_at) < new Date()) {
    return NextResponse.json({ error: 'Tournament has ended' }, { status: 422 })
  }

  const { error } = await supabase
    .from('exchange_tournament_entries')
    .upsert({ tournament_id, user_id: user.id }, { onConflict: 'tournament_id,user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
