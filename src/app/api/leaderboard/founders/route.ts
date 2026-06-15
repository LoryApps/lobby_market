import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type FoundingEra =
  | 'patriarch'
  | 'pioneer'
  | 'vanguard'
  | 'early'
  | 'citizen'

export interface FounderEntry {
  founding_rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  joined_at: string
  days_on_platform: number
  era: FoundingEra
  total_votes: number
  reputation_score: number
  clout: number
  total_arguments: number
  vote_streak: number
}

export interface FoundersLeaderboardResponse {
  entries: FounderEntry[]
  total_citizens: number
  my_rank: number | null
  my_era: FoundingEra | null
  generated_at: string
}

// ─── Era assignment (by founding rank) ────────────────────────────────────────

function getEra(rank: number): FoundingEra {
  if (rank <= 10)  return 'patriarch'
  if (rank <= 50)  return 'pioneer'
  if (rank <= 200) return 'vanguard'
  if (rank <= 500) return 'early'
  return 'citizen'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100', 10), 200)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10), 0)

  // Fetch profiles ordered by join date ascending
  const { data: allProfiles, error } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, role, created_at, total_votes, reputation_score, clout, total_arguments, vote_streak'
    )
    .not('username', 'is', null)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const profiles = allProfiles ?? []

  // Total citizen count
  const { count: totalCitizens } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .not('username', 'is', null)

  const now = Date.now()

  const entries: FounderEntry[] = profiles.map((p, i) => {
    const globalRank = offset + i + 1
    const joinedMs = new Date(p.created_at).getTime()
    const daysOnPlatform = Math.floor((now - joinedMs) / 86_400_000)

    return {
      founding_rank: globalRank,
      user_id: p.id,
      username: p.username,
      display_name: p.display_name ?? null,
      avatar_url: p.avatar_url ?? null,
      role: p.role ?? 'person',
      joined_at: p.created_at,
      days_on_platform: daysOnPlatform,
      era: getEra(globalRank),
      total_votes: p.total_votes ?? 0,
      reputation_score: p.reputation_score ?? 0,
      clout: p.clout ?? 0,
      total_arguments: p.total_arguments ?? 0,
      vote_streak: p.vote_streak ?? 0,
    }
  })

  // My founding rank
  let myRank: number | null = null
  let myEra: FoundingEra | null = null

  if (user) {
    const { count: myOffset } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('username', 'is', null)
      .lt('created_at', (await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single()
      ).data?.created_at ?? new Date().toISOString())

    if (myOffset !== null) {
      myRank = myOffset + 1
      myEra = getEra(myRank)
    }
  }

  return NextResponse.json({
    entries,
    total_citizens: totalCitizens ?? 0,
    my_rank: myRank,
    my_era: myEra,
    generated_at: new Date().toISOString(),
  } satisfies FoundersLeaderboardResponse)
}
