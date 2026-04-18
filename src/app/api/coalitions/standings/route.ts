import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CoalitionStanding {
  id: string
  name: string
  description: string | null
  member_count: number
  max_members: number
  coalition_influence: number
  wins: number
  losses: number
  win_rate: number | null
  total_matches: number
  is_public: boolean
  created_at: string
  rank: number
  creator_username: string | null
  creator_display_name: string | null
  creator_avatar_url: string | null
}

export interface StandingsResponse {
  standings: CoalitionStanding[]
  total: number
  top_win_rate: number | null
  top_wins: number
  total_coalitions: number
}

export type SortBy = 'win_rate' | 'wins' | 'influence' | 'members' | 'matches'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const sortBy = (searchParams.get('sort') ?? 'win_rate') as SortBy
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

  try {
    const supabase = await createClient()

    const { data: rows, error } = await supabase
      .from('coalitions')
      .select(`
        id,
        name,
        description,
        member_count,
        max_members,
        coalition_influence,
        wins,
        losses,
        is_public,
        created_at,
        creator_id
      `)
      .eq('is_public', true)
      .limit(200)

    if (error) throw error

    const coalitions = rows ?? []

    // Enrich with creator profiles
    const creatorIds = Array.from(new Set(coalitions.map((c) => c.creator_id).filter(Boolean)))
    const { data: profileRows } = creatorIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', creatorIds)
      : { data: [] }

    const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))

    // Compute standings
    const standings: CoalitionStanding[] = coalitions.map((c) => {
      const total = c.wins + c.losses
      const winRate = total > 0 ? Math.round((c.wins / total) * 100) : null
      const creator = profileMap.get(c.creator_id)
      return {
        id: c.id,
        name: c.name,
        description: c.description,
        member_count: c.member_count,
        max_members: c.max_members,
        coalition_influence: c.coalition_influence,
        wins: c.wins,
        losses: c.losses,
        win_rate: winRate,
        total_matches: total,
        is_public: c.is_public,
        created_at: c.created_at,
        rank: 0,
        creator_username: creator?.username ?? null,
        creator_display_name: creator?.display_name ?? null,
        creator_avatar_url: creator?.avatar_url ?? null,
      }
    })

    // Sort
    standings.sort((a, b) => {
      switch (sortBy) {
        case 'win_rate':
          if (a.total_matches === 0 && b.total_matches === 0) return b.coalition_influence - a.coalition_influence
          if (a.total_matches === 0) return 1
          if (b.total_matches === 0) return -1
          if ((b.win_rate ?? 0) !== (a.win_rate ?? 0)) return (b.win_rate ?? 0) - (a.win_rate ?? 0)
          return b.wins - a.wins
        case 'wins':
          return b.wins !== a.wins ? b.wins - a.wins : (b.win_rate ?? 0) - (a.win_rate ?? 0)
        case 'influence':
          return b.coalition_influence - a.coalition_influence
        case 'members':
          return b.member_count - a.member_count
        case 'matches':
          return b.total_matches - a.total_matches
        default:
          return b.coalition_influence - a.coalition_influence
      }
    })

    // Assign ranks
    standings.forEach((s, i) => {
      s.rank = i + 1
    })

    const sliced = standings.slice(0, limit)

    const activeCampaigners = standings.filter((s) => s.total_matches > 0)
    const topWinRate = activeCampaigners.length > 0
      ? Math.max(...activeCampaigners.map((s) => s.win_rate ?? 0))
      : null
    const topWins = standings.length > 0 ? Math.max(...standings.map((s) => s.wins)) : 0

    return NextResponse.json({
      standings: sliced,
      total: standings.length,
      top_win_rate: topWinRate,
      top_wins: topWins,
      total_coalitions: coalitions.length,
    } satisfies StandingsResponse)
  } catch (err) {
    console.error('[/api/coalitions/standings]', err)
    return NextResponse.json({ error: 'Failed to fetch standings' }, { status: 500 })
  }
}
