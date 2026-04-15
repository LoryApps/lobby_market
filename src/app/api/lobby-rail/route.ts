import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 30

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RailBattle {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  /** 0–100: how close to 50/50 (100 = perfect tie) */
  tension: number
}

export interface RailLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number | null
  established_at: string
}

export interface RailDebate {
  id: string
  title: string | null
  status: string
  scheduled_at: string | null
  type: string | null
}

export interface LobbyRailData {
  battles: RailBattle[]
  laws: RailLaw[]
  debates: RailDebate[]
  /** Votes cast in the last 60 minutes (approximate, from feed_score changes) */
  hourlyVotes: number
  lawsToday: number
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const todayStart = startOfDay.toISOString()

    const [battlesRes, lawsRes, debatesRes, hourlyRes, lawsTodayRes] = await Promise.all([
      // Active/voting topics with the most total votes — we'll compute tension client-side
      supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes')
        .in('status', ['active', 'voting'])
        .gt('total_votes', 0)
        .order('total_votes', { ascending: false })
        .limit(20),

      // Latest 4 established laws
      supabase
        .from('laws')
        .select('id, statement, category, total_votes, established_at')
        .eq('is_active', true)
        .order('established_at', { ascending: false })
        .limit(4),

      // Live or upcoming debates (next 48 h)
      supabase
        .from('debates')
        .select('id, title, status, scheduled_at, type')
        .in('status', ['live', 'scheduled'])
        .order('scheduled_at', { ascending: true })
        .limit(4),

      // Votes cast in the last hour — count topics updated in that window
      supabase
        .from('topics')
        .select('total_votes', { count: 'exact', head: false })
        .gte('updated_at', oneHourAgo),

      // Laws established today
      supabase
        .from('laws')
        .select('id', { count: 'exact', head: true })
        .gte('established_at', todayStart),
    ])

    // Sort battles by tension (how close to 50/50)
    const battles: RailBattle[] = (battlesRes.data ?? [])
      .map((t) => {
        const pct = t.blue_pct ?? 50
        const tension = Math.round(100 - Math.abs(50 - pct) * 2)
        return { ...(t as Omit<RailBattle, 'tension'>), tension }
      })
      .sort((a, b) => b.tension - a.tension)
      .slice(0, 4)

    // Approximate hourly votes: sum of total_votes for recently updated topics
    const hourlyVotes = (hourlyRes.data ?? []).reduce(
      (sum, t) => sum + (t.total_votes ?? 0),
      0,
    )

    return NextResponse.json({
      battles,
      laws: (lawsRes.data ?? []) as RailLaw[],
      debates: (debatesRes.data ?? []) as RailDebate[],
      hourlyVotes,
      lawsToday: lawsTodayRes.count ?? 0,
    } satisfies LobbyRailData)
  } catch {
    return NextResponse.json(
      { battles: [], laws: [], debates: [], hourlyVotes: 0, lawsToday: 0 },
      { status: 200 },
    )
  }
}
