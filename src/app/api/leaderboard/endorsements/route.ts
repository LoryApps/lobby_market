import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EndorserEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  endorsement_count: number
  latest_endorsement_at: string | null
  // top 3 laws endorsed by this user (for preview)
  sample_laws: Array<{
    id: string
    statement: string
    category: string | null
  }>
}

export interface MyEndorserStats {
  endorsement_count: number
  rank: number | null
  percentile: number | null
  latest_endorsement_at: string | null
}

export interface EndorsementLeaderboardResponse {
  entries: EndorserEntry[]
  total_endorsers: number
  total_endorsements: number
  my_stats: MyEndorserStats | null
  generated_at: string
}

// ─── GET /api/leaderboard/endorsements ────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10),
    100,
  )

  // Fetch all endorsements joined with profiles
  const { data: rawEndorsements, error } = await supabase
    .from('law_endorsements')
    .select(`
      user_id,
      created_at,
      laws!inner (
        id, statement, category
      ),
      profiles!inner (
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type RawRow = {
    user_id: string
    created_at: string
    laws: { id: string; statement: string; category: string | null }
    profiles: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
    }
  }

  const rows = (rawEndorsements ?? []) as unknown as RawRow[]

  // Group by user
  const userMap = new Map<
    string,
    {
      profile: RawRow['profiles']
      count: number
      latest: string
      laws: Array<{ id: string; statement: string; category: string | null }>
    }
  >()

  for (const row of rows) {
    const uid = row.user_id
    const existing = userMap.get(uid)
    if (existing) {
      existing.count += 1
      if (row.created_at > existing.latest) existing.latest = row.created_at
      if (existing.laws.length < 3) existing.laws.push(row.laws)
    } else {
      userMap.set(uid, {
        profile: row.profiles,
        count: 1,
        latest: row.created_at,
        laws: [row.laws],
      })
    }
  }

  // Sort by count desc, then latest desc
  const sorted = Array.from(userMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.latest.localeCompare(a.latest)
  })

  const totalEndorsers = sorted.length
  const totalEndorsements = rows.length

  const entries: EndorserEntry[] = sorted.slice(0, limit).map((entry, i) => ({
    rank: i + 1,
    user_id: entry.profile.id,
    username: entry.profile.username,
    display_name: entry.profile.display_name,
    avatar_url: entry.profile.avatar_url,
    role: entry.profile.role,
    clout: entry.profile.clout,
    endorsement_count: entry.count,
    latest_endorsement_at: entry.latest,
    sample_laws: entry.laws,
  }))

  // My stats
  let myStats: MyEndorserStats | null = null
  if (user) {
    const myEntry = sorted.findIndex((e) => e.profile.id === user.id)
    const myData = myEntry >= 0 ? sorted[myEntry] : null
    myStats = {
      endorsement_count: myData?.count ?? 0,
      rank: myData ? myEntry + 1 : null,
      percentile:
        myData && totalEndorsers > 0
          ? Math.round(((totalEndorsers - myEntry) / totalEndorsers) * 100)
          : null,
      latest_endorsement_at: myData?.latest ?? null,
    }
  }

  return NextResponse.json({
    entries,
    total_endorsers: totalEndorsers,
    total_endorsements: totalEndorsements,
    my_stats: myStats,
    generated_at: new Date().toISOString(),
  } satisfies EndorsementLeaderboardResponse)
}
