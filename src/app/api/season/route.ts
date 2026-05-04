import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SeasonInfo {
  id: string
  name: string
  slug: string
  tagline: string | null
  starts_at: string
  ends_at: string
  is_active: boolean
  theme_color: string
  theme_icon: string
}

export interface SeasonEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  vote_pts: number
  argument_pts: number
  debate_pts: number
  law_pts: number
  upvote_pts: number
  prediction_pts: number
  total_pts: number
}

export interface SeasonResponse {
  season: SeasonInfo | null
  entries: SeasonEntry[]
  myEntry: SeasonEntry | null
  /** seconds remaining in the season (0 if ended/no season) */
  secondsLeft: number
  /** historical seasons (not active) */
  pastSeasons: Array<Pick<SeasonInfo, 'id' | 'name' | 'slug' | 'ends_at' | 'theme_color' | 'theme_icon'>>
}

// ─── Point scoring constants (kept in sync with migration comment) ─────────────

const POINT_SCHEMA = [
  { key: 'vote_pts',       label: 'Vote cast',             pts: 1  },
  { key: 'argument_pts',   label: 'Argument posted',       pts: 5  },
  { key: 'debate_pts',     label: 'Debate participated in',pts: 10 },
  { key: 'law_pts',        label: 'Topic became law (FOR)',pts: 25 },
  { key: 'upvote_pts',     label: 'Argument upvote earned',pts: 3  },
  { key: 'prediction_pts', label: 'Correct prediction',    pts: 15 },
] as const

export { POINT_SCHEMA }

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // ── Active season ──────────────────────────────────────────────────────────
  const { data: seasonRaw } = await supabase
    .from('civic_seasons')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()

  // ── Past seasons (for history tab) ────────────────────────────────────────
  const { data: pastRaw } = await supabase
    .from('civic_seasons')
    .select('id, name, slug, ends_at, theme_color, theme_icon')
    .eq('is_active', false)
    .order('ends_at', { ascending: false })
    .limit(12)

  const pastSeasons = (pastRaw ?? []) as Array<
    Pick<SeasonInfo, 'id' | 'name' | 'slug' | 'ends_at' | 'theme_color' | 'theme_icon'>
  >

  // No active season — return shell
  if (!seasonRaw) {
    return NextResponse.json({
      season: null,
      entries: [],
      myEntry: null,
      secondsLeft: 0,
      pastSeasons,
    } satisfies SeasonResponse)
  }

  const season = seasonRaw as SeasonInfo

  // ── Determine authenticated user (optional) ───────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const myUserId = user?.id ?? null

  // ── Leaderboard rows ──────────────────────────────────────────────────────
  // Join season_points → profiles in one shot
  const { data: pointRows } = await supabase
    .from('season_points')
    .select(
      `vote_pts, argument_pts, debate_pts, law_pts, upvote_pts, prediction_pts, user_id,
       profiles!inner(username, display_name, avatar_url, role)`
    )
    .eq('season_id', season.id)
    .limit(200)

  type RawRow = {
    vote_pts: number
    argument_pts: number
    debate_pts: number
    law_pts: number
    upvote_pts: number
    prediction_pts: number
    user_id: string
    profiles: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null
  }

  const rows = (pointRows ?? []) as RawRow[]

  // Sort by total descending
  const sorted = rows
    .filter((r) => r.profiles !== null)
    .map((r) => ({
      user_id: r.user_id,
      username: r.profiles!.username,
      display_name: r.profiles!.display_name,
      avatar_url: r.profiles!.avatar_url,
      role: r.profiles!.role,
      vote_pts: r.vote_pts,
      argument_pts: r.argument_pts,
      debate_pts: r.debate_pts,
      law_pts: r.law_pts,
      upvote_pts: r.upvote_pts,
      prediction_pts: r.prediction_pts,
      total_pts:
        r.vote_pts +
        r.argument_pts +
        r.debate_pts +
        r.law_pts +
        r.upvote_pts +
        r.prediction_pts,
    }))
    .sort((a, b) => b.total_pts - a.total_pts)

  const entries: SeasonEntry[] = sorted.map((r, idx) => ({ rank: idx + 1, ...r }))

  // ── My entry ──────────────────────────────────────────────────────────────
  let myEntry: SeasonEntry | null = null
  if (myUserId) {
    const found = entries.find((e) => e.user_id === myUserId) ?? null

    if (!found) {
      // User hasn't earned any points yet — synthesise a zero-point entry
      const { data: prof } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, role')
        .eq('id', myUserId)
        .maybeSingle()

      if (prof) {
        myEntry = {
          rank: entries.length + 1,
          user_id: myUserId,
          username: prof.username,
          display_name: prof.display_name,
          avatar_url: prof.avatar_url,
          role: prof.role,
          vote_pts: 0,
          argument_pts: 0,
          debate_pts: 0,
          law_pts: 0,
          upvote_pts: 0,
          prediction_pts: 0,
          total_pts: 0,
        }
      }
    } else {
      myEntry = found
    }
  }

  // ── Seconds remaining ─────────────────────────────────────────────────────
  const secondsLeft = Math.max(
    0,
    Math.floor((new Date(season.ends_at).getTime() - Date.now()) / 1000)
  )

  return NextResponse.json({
    season,
    entries: entries.slice(0, 100),
    myEntry,
    secondsLeft,
    pastSeasons,
  } satisfies SeasonResponse)
}
