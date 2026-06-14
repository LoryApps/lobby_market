import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BountyHunter {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout_earned: number
  bounties_won: number
  biggest_win: number
  last_won_at: string
  top_topic_statement: string | null
  top_topic_category: string | null
}

export interface BountyPatron {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout_posted: number
  bounties_created: number
  bounties_awarded: number
  award_rate: number
  last_posted_at: string
}

export interface BountyStat {
  label: string
  value: string
  sub?: string
}

export interface BountiesLeaderboardResponse {
  hunters: BountyHunter[]
  patrons: BountyPatron[]
  stats: BountyStat[]
}

// ─── GET /api/leaderboard/bounties ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 100)

  try {
    // 1. Fetch all awarded bounties with topic context
    const { data: awardedBounties, error: awardedErr } = await supabase
      .from('topic_bounties')
      .select(`
        id,
        amount,
        winner_id,
        creator_id,
        created_at,
        winner_argument_id,
        topics!inner(statement, category)
      `)
      .eq('status', 'awarded')
      .order('created_at', { ascending: false })

    if (awardedErr) throw awardedErr

    // 2. Fetch all bounties for patron stats
    const { data: allBounties, error: allErr } = await supabase
      .from('topic_bounties')
      .select('id, amount, creator_id, status, created_at')
      .order('created_at', { ascending: false })

    if (allErr) throw allErr

    // 3. Aggregate hunter stats per winner
    const hunterMap = new Map<string, {
      clout_earned: number
      bounties_won: number
      biggest_win: number
      last_won_at: string
      top_topic_statement: string | null
      top_topic_category: string | null
    }>()

    for (const b of awardedBounties ?? []) {
      if (!b.winner_id) continue
      const topic = b.topics as { statement: string; category: string | null } | null
      const existing = hunterMap.get(b.winner_id)
      if (!existing) {
        hunterMap.set(b.winner_id, {
          clout_earned: b.amount,
          bounties_won: 1,
          biggest_win: b.amount,
          last_won_at: b.created_at,
          top_topic_statement: topic?.statement ?? null,
          top_topic_category: topic?.category ?? null,
        })
      } else {
        existing.clout_earned += b.amount
        existing.bounties_won += 1
        if (b.amount > existing.biggest_win) {
          existing.biggest_win = b.amount
          existing.top_topic_statement = topic?.statement ?? null
          existing.top_topic_category = topic?.category ?? null
        }
      }
    }

    // 4. Aggregate patron stats per creator
    const patronMap = new Map<string, {
      clout_posted: number
      bounties_created: number
      bounties_awarded: number
      last_posted_at: string
    }>()

    for (const b of allBounties ?? []) {
      if (!b.creator_id) continue
      const existing = patronMap.get(b.creator_id)
      const isAwarded = b.status === 'awarded'
      if (!existing) {
        patronMap.set(b.creator_id, {
          clout_posted: b.amount,
          bounties_created: 1,
          bounties_awarded: isAwarded ? 1 : 0,
          last_posted_at: b.created_at,
        })
      } else {
        existing.clout_posted += b.amount
        existing.bounties_created += 1
        if (isAwarded) existing.bounties_awarded += 1
      }
    }

    // 5. Fetch profiles for all relevant users
    const allUserIds = [
      ...new Set([
        ...Array.from(hunterMap.keys()),
        ...Array.from(patronMap.keys()),
      ])
    ]

    if (allUserIds.length === 0) {
      return NextResponse.json<BountiesLeaderboardResponse>({
        hunters: [],
        patrons: [],
        stats: [
          { label: 'Total Bounties', value: '0', sub: 'none posted yet' },
          { label: 'Clout Pooled', value: '0', sub: 'in open bounties' },
          { label: 'Hunters', value: '0', sub: 'have won bounties' },
        ],
      })
    }

    const { data: profiles, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', allUserIds)

    if (profileErr) throw profileErr

    const profileById = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    )

    // 6. Build hunter list, sorted by clout_earned desc
    const hunters: BountyHunter[] = Array.from(hunterMap.entries())
      .map(([userId, stats]) => {
        const p = profileById.get(userId)
        if (!p) return null
        return {
          user_id: userId,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          role: p.role,
          ...stats,
        }
      })
      .filter((h): h is BountyHunter => h !== null)
      .sort((a, b) => b.clout_earned - a.clout_earned || b.bounties_won - a.bounties_won)
      .slice(0, limit)

    // 7. Build patron list, sorted by clout_posted desc
    const patrons: BountyPatron[] = Array.from(patronMap.entries())
      .map(([userId, stats]) => {
        const p = profileById.get(userId)
        if (!p) return null
        return {
          user_id: userId,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          role: p.role,
          award_rate: stats.bounties_created > 0
            ? Math.round((stats.bounties_awarded / stats.bounties_created) * 100)
            : 0,
          ...stats,
        }
      })
      .filter((p): p is BountyPatron => p !== null)
      .sort((a, b) => b.clout_posted - a.clout_posted || b.bounties_created - a.bounties_created)
      .slice(0, limit)

    // 8. Platform stats
    const totalBounties = (allBounties ?? []).length
    const totalCloutPooled = (allBounties ?? [])
      .filter((b) => b.status === 'open')
      .reduce((sum, b) => sum + b.amount, 0)
    const totalHunters = hunterMap.size

    const stats: BountyStat[] = [
      {
        label: 'Total Bounties',
        value: totalBounties.toLocaleString(),
        sub: `${(allBounties ?? []).filter((b) => b.status === 'open').length} open`,
      },
      {
        label: 'Clout in Play',
        value: totalCloutPooled.toLocaleString(),
        sub: 'clout in open bounties',
      },
      {
        label: 'Bounty Hunters',
        value: totalHunters.toLocaleString(),
        sub: 'have claimed rewards',
      },
    ]

    return NextResponse.json<BountiesLeaderboardResponse>({ hunters, patrons, stats })
  } catch (err) {
    console.error('[leaderboard/bounties]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
