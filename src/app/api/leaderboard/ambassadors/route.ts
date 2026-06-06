import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 min cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AmbassadorEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  code: string
  times_clicked: number
  times_signed_up: number
  times_converted: number
  clout_earned: number
  conversion_rate: number | null // converted / signed_up, null if 0 signups
  created_at: string
}

export interface AmbassadorLeaderboardResponse {
  topByConversions: AmbassadorEntry[]
  topBySignups: AmbassadorEntry[]
  topByClout: AmbassadorEntry[]
  platformStats: {
    total_ambassadors: number
    total_signups: number
    total_conversions: number
    total_clout_awarded: number
  }
}

// ─── GET /api/leaderboard/ambassadors ────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all referral codes joined with profiles
    // referral_codes has public_read RLS so this is accessible
    const { data: raw, error } = await supabase
      .from('referral_codes')
      .select(`
        user_id,
        code,
        times_clicked,
        times_signed_up,
        times_converted,
        clout_earned,
        created_at,
        profiles!referral_codes_user_id_fkey (
          username,
          display_name,
          avatar_url,
          role
        )
      `)
      .gt('times_signed_up', 0) // only ambassadors who brought at least one person
      .order('times_converted', { ascending: false })
      .limit(200)

    if (error) {
      console.error('[ambassadors leaderboard]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!raw || raw.length === 0) {
      return NextResponse.json({
        topByConversions: [],
        topBySignups: [],
        topByClout: [],
        platformStats: {
          total_ambassadors: 0,
          total_signups: 0,
          total_conversions: 0,
          total_clout_awarded: 0,
        },
      } satisfies AmbassadorLeaderboardResponse)
    }

    // Normalise rows
    const rows = raw
      .map((r) => {
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        if (!profile) return null
        return {
          user_id: r.user_id as string,
          username: (profile as { username: string }).username,
          display_name: (profile as { display_name: string | null }).display_name,
          avatar_url: (profile as { avatar_url: string | null }).avatar_url,
          role: (profile as { role: string }).role,
          code: r.code as string,
          times_clicked: r.times_clicked as number,
          times_signed_up: r.times_signed_up as number,
          times_converted: r.times_converted as number,
          clout_earned: r.clout_earned as number,
          conversion_rate:
            (r.times_signed_up as number) > 0
              ? Math.round(
                  ((r.times_converted as number) / (r.times_signed_up as number)) * 100
                )
              : null,
          created_at: r.created_at as string,
        }
      })
      .filter(Boolean) as Omit<AmbassadorEntry, 'rank'>[]

    // Sort by conversions → assign rank
    const byConversions: AmbassadorEntry[] = [...rows]
      .sort((a, b) => b.times_converted - a.times_converted || b.times_signed_up - a.times_signed_up)
      .slice(0, 50)
      .map((r, i) => ({ ...r, rank: i + 1 }))

    const bySignups: AmbassadorEntry[] = [...rows]
      .sort((a, b) => b.times_signed_up - a.times_signed_up || b.times_converted - a.times_converted)
      .slice(0, 50)
      .map((r, i) => ({ ...r, rank: i + 1 }))

    const byClout: AmbassadorEntry[] = [...rows]
      .sort((a, b) => b.clout_earned - a.clout_earned || b.times_converted - a.times_converted)
      .slice(0, 50)
      .map((r, i) => ({ ...r, rank: i + 1 }))

    // Platform-wide stats
    const { data: statsRaw } = await supabase
      .from('referral_codes')
      .select('times_signed_up, times_converted, clout_earned')

    const stats = (statsRaw ?? []).reduce(
      (acc, r) => {
        acc.total_ambassadors += (r.times_signed_up as number) > 0 ? 1 : 0
        acc.total_signups += r.times_signed_up as number
        acc.total_conversions += r.times_converted as number
        acc.total_clout_awarded += r.clout_earned as number
        return acc
      },
      { total_ambassadors: 0, total_signups: 0, total_conversions: 0, total_clout_awarded: 0 }
    )

    return NextResponse.json({
      topByConversions: byConversions,
      topBySignups: bySignups,
      topByClout: byClout,
      platformStats: stats,
    } satisfies AmbassadorLeaderboardResponse)
  } catch (err) {
    console.error('[ambassadors leaderboard]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
