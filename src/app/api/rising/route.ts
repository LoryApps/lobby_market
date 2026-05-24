import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
// Revalidate every 30 minutes — rising stars change slowly but we want freshness
export const revalidate = 1800

export interface RisingCitizen {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  total_arguments: number
  vote_streak: number
  followers_count: number
  // Days since joined (0 = today, 29 = last allowed)
  days_old: number
  joined_at: string
  // Rise score: composite metric combining clout earned, votes cast, and arguments
  rise_score: number
  // Badges earned so far
  has_first_vote: boolean
  has_first_argument: boolean
  is_on_streak: boolean
  highlight: 'top_argumenter' | 'top_voter' | 'top_clout' | 'rising_star' | 'streak_hero' | 'new_voice'
  highlight_label: string
}

export interface RisingResponse {
  citizens: RisingCitizen[]
  window_days: number
  generated_at: string
}

const WINDOW_DAYS = 30

export async function GET() {
  try {
    const supabase = await createClient()

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - WINDOW_DAYS)
    const cutoffISO = cutoff.toISOString()

    // Fetch new citizens joined in the last 30 days
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, username, display_name, avatar_url, bio, role,
        clout, reputation_score, total_votes, total_arguments,
        vote_streak, followers_count, created_at
      `)
      .gte('created_at', cutoffISO)
      .order('reputation_score', { ascending: false })
      .limit(120)

    if (error) {
      return NextResponse.json({ citizens: [], window_days: WINDOW_DAYS, generated_at: new Date().toISOString() })
    }

    const rows = (data ?? []) as Array<{
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      bio: string | null
      role: string
      clout: number
      reputation_score: number
      total_votes: number
      total_arguments: number
      vote_streak: number
      followers_count: number
      created_at: string
    }>

    // Score and tag each citizen
    const now = Date.now()

    const citizens: RisingCitizen[] = rows
      .map((r) => {
        const joinedMs = new Date(r.created_at).getTime()
        const daysOld = Math.floor((now - joinedMs) / 86_400_000)

        // Rise score: clout/day × argument quality bonus × vote consistency
        const daysActive = Math.max(daysOld, 1)
        const cloutPerDay = (r.clout ?? 0) / daysActive
        const argBonus = Math.min((r.total_arguments ?? 0) * 15, 300)
        const streakBonus = (r.vote_streak ?? 0) * 5
        const riseScore = cloutPerDay * 2 + argBonus + streakBonus + (r.reputation_score ?? 0) * 0.3

        // Determine highlight category
        let highlight: RisingCitizen['highlight'] = 'new_voice'
        let highlight_label = 'New Voice'

        if ((r.vote_streak ?? 0) >= 7) {
          highlight = 'streak_hero'
          highlight_label = `${r.vote_streak}-day streak`
        } else if ((r.total_arguments ?? 0) >= 5) {
          highlight = 'top_argumenter'
          highlight_label = `${r.total_arguments} arguments`
        } else if ((r.total_votes ?? 0) >= 20) {
          highlight = 'top_voter'
          highlight_label = `${r.total_votes} votes cast`
        } else if ((r.clout ?? 0) >= 200) {
          highlight = 'top_clout'
          highlight_label = `${r.clout} Clout earned`
        } else if (riseScore > 50) {
          highlight = 'rising_star'
          highlight_label = 'Rising Fast'
        }

        return {
          id: r.id,
          username: r.username,
          display_name: r.display_name,
          avatar_url: r.avatar_url,
          bio: r.bio,
          role: r.role,
          clout: r.clout ?? 0,
          reputation_score: r.reputation_score ?? 0,
          total_votes: r.total_votes ?? 0,
          total_arguments: r.total_arguments ?? 0,
          vote_streak: r.vote_streak ?? 0,
          followers_count: r.followers_count ?? 0,
          days_old: daysOld,
          joined_at: r.created_at,
          rise_score: Math.round(riseScore),
          has_first_vote: (r.total_votes ?? 0) >= 1,
          has_first_argument: (r.total_arguments ?? 0) >= 1,
          is_on_streak: (r.vote_streak ?? 0) >= 3,
          highlight,
          highlight_label,
        } satisfies RisingCitizen
      })
      // Sort by rise score
      .sort((a, b) => b.rise_score - a.rise_score)
      // Take top 30
      .slice(0, 30)

    return NextResponse.json({
      citizens,
      window_days: WINDOW_DAYS,
      generated_at: new Date().toISOString(),
    } satisfies RisingResponse)
  } catch (err) {
    console.error('[/api/rising]', err)
    return NextResponse.json(
      { citizens: [], window_days: WINDOW_DAYS, generated_at: new Date().toISOString() },
      { status: 200 }
    )
  }
}
