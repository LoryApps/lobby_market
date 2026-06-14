import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArenaChampion {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  wins: number
  bouts: number
  win_pct: number
  best_argument_id: string | null
  best_argument_content: string | null
  best_argument_wins: number
  best_topic_statement: string | null
  best_topic_category: string | null
  top_category: string | null
}

export interface ArenaStat {
  label: string
  value: string
  sub?: string
}

export interface ArenaLeaderboardResponse {
  champions: ArenaChampion[]
  stats: ArenaStat[]
  total_bouts: number
}

// ─── GET /api/leaderboard/arena ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 100)

  try {
    // 1. Aggregate wins per argument from faceoff votes
    const { data: winRows, error: winErr } = await supabase
      .from('argument_faceoff_votes')
      .select('winner_id')

    if (winErr) throw winErr

    const winCounts: Record<string, number> = {}
    for (const row of winRows ?? []) {
      winCounts[row.winner_id] = (winCounts[row.winner_id] ?? 0) + 1
    }

    // 2. Aggregate bouts per argument
    const { data: boutRows, error: boutErr } = await supabase
      .from('argument_faceoff_votes')
      .select('argument_a_id, argument_b_id')

    if (boutErr) throw boutErr

    const boutCounts: Record<string, number> = {}
    for (const row of boutRows ?? []) {
      boutCounts[row.argument_a_id] = (boutCounts[row.argument_a_id] ?? 0) + 1
      boutCounts[row.argument_b_id] = (boutCounts[row.argument_b_id] ?? 0) + 1
    }

    const totalBouts = Math.round((boutRows ?? []).length)

    // 3. Get argument authors to map argument → user
    const argIds = [
      ...new Set([
        ...Object.keys(winCounts),
        ...Object.keys(boutCounts),
      ])
    ]

    if (argIds.length === 0) {
      // No faceoff data yet — return empty
      return NextResponse.json({
        champions: [],
        stats: [
          { label: 'Total Bouts', value: '0' },
          { label: 'Champions Ranked', value: '0' },
          { label: 'Highest Win Rate', value: '—' },
        ],
        total_bouts: 0,
      } satisfies ArenaLeaderboardResponse)
    }

    const { data: arguments_, error: argErr } = await supabase
      .from('topic_arguments')
      .select(`
        id, user_id, content,
        topic:topics!topic_arguments_topic_id_fkey(id, statement, category)
      `)
      .in('id', argIds.slice(0, 1000))

    if (argErr) throw argErr

    // 4. Aggregate by user
    const userWins: Record<string, number> = {}
    const userBouts: Record<string, number> = {}
    const userBestArg: Record<string, { id: string; wins: number; content: string; topicStatement: string | null; topicCategory: string | null }> = {}
    const userCategories: Record<string, Record<string, number>> = {}

    for (const arg of arguments_ ?? []) {
      const uid = arg.user_id
      if (!uid) continue
      const wins = winCounts[arg.id] ?? 0
      const bouts = boutCounts[arg.id] ?? 0
      const topic = Array.isArray(arg.topic) ? arg.topic[0] : arg.topic

      userWins[uid] = (userWins[uid] ?? 0) + wins
      userBouts[uid] = (userBouts[uid] ?? 0) + bouts

      // Track best argument for this user
      if (!userBestArg[uid] || wins > userBestArg[uid].wins) {
        userBestArg[uid] = {
          id: arg.id,
          wins,
          content: arg.content,
          topicStatement: topic?.statement ?? null,
          topicCategory: topic?.category ?? null,
        }
      }

      // Track category distribution
      const cat = topic?.category
      if (cat) {
        if (!userCategories[uid]) userCategories[uid] = {}
        userCategories[uid][cat] = (userCategories[uid][cat] ?? 0) + wins
      }
    }

    // 5. Get profiles for users with at least 1 bout
    const userIds = Object.keys(userBouts).filter((uid) => userBouts[uid] >= 3)

    if (userIds.length === 0) {
      return NextResponse.json({
        champions: [],
        stats: [
          { label: 'Total Bouts', value: String(totalBouts) },
          { label: 'Champions Ranked', value: '0' },
          { label: 'Highest Win Rate', value: '—' },
        ],
        total_bouts: totalBouts,
      } satisfies ArenaLeaderboardResponse)
    }

    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds)

    if (profileErr) throw profileErr

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    // 6. Build champion rows
    const champions: ArenaChampion[] = userIds
      .map((uid) => {
        const profile = profileMap.get(uid)
        if (!profile) return null

        const wins = userWins[uid] ?? 0
        const bouts = userBouts[uid] ?? 0
        const winPct = bouts > 0 ? Math.round((wins / bouts) * 1000) / 10 : 0
        const best = userBestArg[uid] ?? null

        // Find dominant category by win count
        const cats = userCategories[uid] ?? {}
        const topCategory = Object.keys(cats).sort((a, b) => cats[b] - cats[a])[0] ?? null

        return {
          user_id: uid,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          role: profile.role,
          wins,
          bouts,
          win_pct: winPct,
          best_argument_id: best?.id ?? null,
          best_argument_content: best?.content ?? null,
          best_argument_wins: best?.wins ?? 0,
          best_topic_statement: best?.topicStatement ?? null,
          best_topic_category: best?.topicCategory ?? null,
          top_category: topCategory,
        } satisfies ArenaChampion
      })
      .filter((c): c is ArenaChampion => c !== null)
      // Rank by win_pct first (requires ≥5 bouts for stable rate), then wins
      .sort((a, b) => {
        const aStable = a.bouts >= 5
        const bStable = b.bouts >= 5
        if (aStable && bStable) return b.win_pct - a.win_pct
        if (aStable) return -1
        if (bStable) return 1
        return b.wins - a.wins
      })
      .slice(0, limit)

    // 7. Platform stats
    const topChamp = champions[0]
    const stats: ArenaStat[] = [
      {
        label: 'Total Bouts Judged',
        value: totalBouts >= 1000 ? `${(totalBouts / 1000).toFixed(1)}k` : String(totalBouts),
        sub: 'all-time matchups',
      },
      {
        label: 'Champions Ranked',
        value: String(champions.length),
        sub: '≥3 bouts to qualify',
      },
      {
        label: 'Top Win Rate',
        value: topChamp ? `${topChamp.win_pct}%` : '—',
        sub: topChamp ? topChamp.display_name ?? topChamp.username : 'no data yet',
      },
    ]

    return NextResponse.json({
      champions,
      stats,
      total_bouts: totalBouts,
    } satisfies ArenaLeaderboardResponse)
  } catch (err) {
    console.error('[leaderboard/arena GET]', err)
    return NextResponse.json({ error: 'Failed to load arena leaderboard' }, { status: 500 })
  }
}
