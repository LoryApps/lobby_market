import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SeasonChampion {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  total_pts: number
}

export interface SeasonRecord {
  id: string
  name: string
  slug: string
  tagline: string | null
  starts_at: string
  ends_at: string
  is_active: boolean
  theme_color: string
  theme_icon: string
  participant_count: number
  champion: SeasonChampion | null
  podium: SeasonChampion[]
}

export interface SeasonsResponse {
  active: SeasonRecord | null
  past: SeasonRecord[]
}

// ─── Helper: load champion + podium for a season ──────────────────────────────

async function loadPodium(
  supabase: Awaited<ReturnType<typeof createClient>>,
  seasonId: string,
  limit = 3
): Promise<{ podium: SeasonChampion[]; participantCount: number }> {
  const { data: rows } = await supabase
    .from('season_points')
    .select(
      `vote_pts, argument_pts, debate_pts, law_pts, upvote_pts, prediction_pts, user_id,
       profiles!inner(username, display_name, avatar_url, role)`
    )
    .eq('season_id', seasonId)
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

  const valid = ((rows ?? []) as RawRow[]).filter((r) => r.profiles !== null)

  const sorted = valid
    .map((r) => ({
      user_id: r.user_id,
      username: r.profiles!.username,
      display_name: r.profiles!.display_name,
      avatar_url: r.profiles!.avatar_url,
      role: r.profiles!.role,
      total_pts:
        r.vote_pts +
        r.argument_pts +
        r.debate_pts +
        r.law_pts +
        r.upvote_pts +
        r.prediction_pts,
    }))
    .sort((a, b) => b.total_pts - a.total_pts)

  return {
    podium: sorted.slice(0, limit),
    participantCount: sorted.length,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all seasons
    const { data: allSeasons } = await supabase
      .from('civic_seasons')
      .select('*')
      .order('starts_at', { ascending: false })

    if (!allSeasons || allSeasons.length === 0) {
      return NextResponse.json({ active: null, past: [] } satisfies SeasonsResponse)
    }

    // Load podium data for each season in parallel (limit to 8 seasons to keep fast)
    const seasonsToLoad = allSeasons.slice(0, 8)
    const podiumResults = await Promise.all(
      seasonsToLoad.map((s) => loadPodium(supabase, s.id))
    )

    const records: SeasonRecord[] = seasonsToLoad.map((s, i) => {
      const { podium, participantCount } = podiumResults[i]
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        tagline: s.tagline ?? null,
        starts_at: s.starts_at,
        ends_at: s.ends_at,
        is_active: s.is_active,
        theme_color: s.theme_color,
        theme_icon: s.theme_icon,
        participant_count: participantCount,
        champion: podium[0] ?? null,
        podium,
      }
    })

    const active = records.find((r) => r.is_active) ?? null
    const past = records.filter((r) => !r.is_active)

    return NextResponse.json({ active, past } satisfies SeasonsResponse)
  } catch (err) {
    console.error('[/api/seasons]', err)
    return NextResponse.json({ active: null, past: [] } satisfies SeasonsResponse)
  }
}
