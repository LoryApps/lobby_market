import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 900

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimingRankEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  early_correct: number
  early_total: number
  early_pct: number
  avg_topic_age_hours: number
  grade: string
  grade_color: string
}

export interface TimingLeaderboardResponse {
  topByPct: TimingRankEntry[]
  topByVolume: TimingRankEntry[]
  topSpeed: TimingRankEntry[]
  platformStats: {
    total_early_votes: number
    total_early_voters: number
    platform_early_pct: number
    avg_vote_age_hours: number
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EARLY_THRESHOLD_HOURS = 48

function toGrade(pct: number, total: number): { grade: string; color: string } {
  if (total < 3) return { grade: '–', color: '#6b7280' }
  if (pct >= 80) return { grade: 'S', color: '#f59e0b' }
  if (pct >= 70) return { grade: 'A', color: '#34d399' }
  if (pct >= 60) return { grade: 'B', color: '#60a5fa' }
  if (pct >= 50) return { grade: 'C', color: '#a78bfa' }
  if (pct >= 40) return { grade: 'D', color: '#f87171' }
  return { grade: 'F', color: '#6b7280' }
}

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch all votes on resolved topics including timestamps for timing calc
  const { data: rows, error } = await supabase
    .from('votes')
    .select(`
      user_id,
      side,
      created_at,
      topics!inner (
        status,
        blue_pct,
        created_at
      ),
      profiles!inner (
        username,
        display_name,
        avatar_url,
        role,
        clout
      )
    `)
    .in('topics.status', ['law', 'failed', 'archived'])

  if (error || !rows || rows.length === 0) {
    const empty: TimingLeaderboardResponse = {
      topByPct: [],
      topByVolume: [],
      topSpeed: [],
      platformStats: {
        total_early_votes: 0,
        total_early_voters: 0,
        platform_early_pct: 0,
        avg_vote_age_hours: 0,
      },
    }
    return NextResponse.json(empty)
  }

  type UserAgg = {
    user_id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    early_total: number
    early_correct: number
    total_age_hours: number
    min_age_hours: number
  }

  const map = new Map<string, UserAgg>()
  let platformEarlyCorrect = 0
  let platformEarlyTotal = 0
  let platformTotalAgeHours = 0

  for (const row of rows) {
    const r = row as {
      user_id: string
      side: string
      created_at: string
      topics: { status: string; blue_pct: number; created_at: string }
      profiles: {
        username: string
        display_name: string | null
        avatar_url: string | null
        role: string
        clout: number
      }
    }

    const ageHours = hoursBetween(r.topics.created_at, r.created_at)
    if (ageHours < 0) continue // clock skew guard

    // Only count early votes
    if (ageHours > EARLY_THRESHOLD_HOURS) continue

    const uid = r.user_id
    if (!map.has(uid)) {
      map.set(uid, {
        user_id: uid,
        username: r.profiles.username,
        display_name: r.profiles.display_name,
        avatar_url: r.profiles.avatar_url,
        role: r.profiles.role,
        clout: r.profiles.clout,
        early_total: 0,
        early_correct: 0,
        total_age_hours: 0,
        min_age_hours: Infinity,
      })
    }

    const agg = map.get(uid)!
    agg.early_total++
    agg.total_age_hours += ageHours
    if (ageHours < agg.min_age_hours) agg.min_age_hours = ageHours

    const status = r.topics.status
    const isCorrect =
      (r.side === 'blue' && status === 'law') ||
      (r.side === 'red' && (status === 'failed' || status === 'archived'))

    if (isCorrect) agg.early_correct++

    platformEarlyTotal++
    platformTotalAgeHours += ageHours
    if (isCorrect) platformEarlyCorrect++
  }

  // Build ranked entries (minimum 3 early votes)
  const entries: TimingRankEntry[] = []

  for (const agg of map.values()) {
    if (agg.early_total < 3) continue

    const early_pct = Math.round((agg.early_correct / agg.early_total) * 100 * 10) / 10
    const avg_topic_age_hours =
      Math.round((agg.total_age_hours / agg.early_total) * 10) / 10

    const { grade, color: grade_color } = toGrade(early_pct, agg.early_total)

    entries.push({
      rank: 0,
      user_id: agg.user_id,
      username: agg.username,
      display_name: agg.display_name,
      avatar_url: agg.avatar_url,
      role: agg.role,
      clout: agg.clout,
      early_correct: agg.early_correct,
      early_total: agg.early_total,
      early_pct,
      avg_topic_age_hours,
      grade,
      grade_color,
    })
  }

  const topByPct = [...entries]
    .sort((a, b) => b.early_pct - a.early_pct || b.early_total - a.early_total)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  const topByVolume = [...entries]
    .sort((a, b) => b.early_total - a.early_total || b.early_pct - a.early_pct)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  // "Speedsters": smallest average vote age among those with ≥ 50% accuracy
  const topSpeed = [...entries]
    .filter((e) => e.early_pct >= 50)
    .sort((a, b) => a.avg_topic_age_hours - b.avg_topic_age_hours)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  const platform_early_pct =
    platformEarlyTotal > 0
      ? Math.round((platformEarlyCorrect / platformEarlyTotal) * 100 * 10) / 10
      : 0

  const avg_vote_age_hours =
    platformEarlyTotal > 0
      ? Math.round((platformTotalAgeHours / platformEarlyTotal) * 10) / 10
      : 0

  return NextResponse.json({
    topByPct,
    topByVolume,
    topSpeed,
    platformStats: {
      total_early_votes: platformEarlyTotal,
      total_early_voters: entries.length,
      platform_early_pct,
      avg_vote_age_hours,
    },
  } satisfies TimingLeaderboardResponse)
}
