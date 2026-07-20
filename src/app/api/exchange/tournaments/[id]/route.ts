import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TournamentEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  score: number
  predictions_correct: number
  predictions_total: number
  rank: number | null
  joined_at: string
}

export interface TournamentDetail {
  id: string
  title: string
  description: string | null
  category: string | null
  status: 'upcoming' | 'active' | 'finished'
  starts_at: string
  ends_at: string
  prize_description: string | null
  entry_count: number
  leaderboard: TournamentEntry[]
  user_entry: TournamentEntry | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: tournament, error } = await supabase
    .from('exchange_tournaments')
    .select('id, title, description, category, status, starts_at, ends_at, prize_description')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !tournament) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Fetch leaderboard entries with profile data
  const { data: entries } = await supabase
    .from('exchange_tournament_entries')
    .select(`
      user_id, score, predictions_correct, predictions_total, rank, joined_at,
      profiles:user_id ( username, display_name, avatar_url )
    `)
    .eq('tournament_id', params.id)
    .order('score', { ascending: false })
    .limit(50)

  const leaderboard: TournamentEntry[] = (entries ?? []).map((e) => {
    const profile = (e as Record<string, unknown>).profiles as {
      username: string
      display_name: string | null
      avatar_url: string | null
    } | null
    return {
      user_id: e.user_id,
      username: profile?.username ?? 'unknown',
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      score: e.score,
      predictions_correct: e.predictions_correct,
      predictions_total: e.predictions_total,
      rank: e.rank,
      joined_at: e.joined_at,
    }
  })

  const userEntry = user
    ? leaderboard.find((e) => e.user_id === user.id) ?? null
    : null

  const detail: TournamentDetail = {
    ...tournament,
    status: tournament.status as TournamentDetail['status'],
    entry_count: leaderboard.length,
    leaderboard,
    user_entry: userEntry,
  }

  return NextResponse.json(detail)
}
