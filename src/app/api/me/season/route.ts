import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeSeasonData {
  season: {
    id: string
    name: string
    tagline: string | null
    ends_at: string
    theme_color: string
    theme_icon: string
  } | null
  myEntry: {
    rank: number
    total_pts: number
    vote_pts: number
    argument_pts: number
    debate_pts: number
    law_pts: number
    upvote_pts: number
    prediction_pts: number
  } | null
  secondsLeft: number
  totalParticipants: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Active season
  const { data: seasonRaw } = await supabase
    .from('civic_seasons')
    .select('id, name, tagline, ends_at, theme_color, theme_icon')
    .eq('is_active', true)
    .maybeSingle()

  if (!seasonRaw) {
    return NextResponse.json({
      season: null,
      myEntry: null,
      secondsLeft: 0,
      totalParticipants: 0,
    } satisfies MeSeasonData)
  }

  const secondsLeft = Math.max(
    0,
    Math.floor((new Date(seasonRaw.ends_at).getTime() - Date.now()) / 1000),
  )

  // User's season points
  const { data: entryRaw } = await supabase
    .from('season_points')
    .select(
      'vote_pts, argument_pts, debate_pts, law_pts, upvote_pts, prediction_pts',
    )
    .eq('season_id', seasonRaw.id)
    .eq('user_id', user.id)
    .maybeSingle()

  // Total participants count
  const { count: participantCount } = await supabase
    .from('season_points')
    .select('user_id', { count: 'exact', head: true })
    .eq('season_id', seasonRaw.id)

  const totalParticipants = participantCount ?? 0

  let myEntry: MeSeasonData['myEntry'] = null

  if (entryRaw) {
    const total =
      entryRaw.vote_pts +
      entryRaw.argument_pts +
      entryRaw.debate_pts +
      entryRaw.law_pts +
      entryRaw.upvote_pts +
      entryRaw.prediction_pts

    // Fetch top scores to compute rank
    const { data: topRows } = await supabase
      .from('season_points')
      .select(
        'vote_pts, argument_pts, debate_pts, law_pts, upvote_pts, prediction_pts',
      )
      .eq('season_id', seasonRaw.id)
      .order('vote_pts', { ascending: false })
      .limit(2000)

    const ranked = (topRows ?? [])
      .map(
        (r) =>
          r.vote_pts +
          r.argument_pts +
          r.debate_pts +
          r.law_pts +
          r.upvote_pts +
          r.prediction_pts,
      )
      .sort((a, b) => b - a)

    const rank = ranked.findIndex((pts) => pts <= total) + 1

    myEntry = {
      rank: rank > 0 ? rank : totalParticipants + 1,
      total_pts: total,
      vote_pts: entryRaw.vote_pts,
      argument_pts: entryRaw.argument_pts,
      debate_pts: entryRaw.debate_pts,
      law_pts: entryRaw.law_pts,
      upvote_pts: entryRaw.upvote_pts,
      prediction_pts: entryRaw.prediction_pts,
    }
  }

  return NextResponse.json({
    season: seasonRaw,
    myEntry,
    secondsLeft,
    totalParticipants,
  } satisfies MeSeasonData)
}
