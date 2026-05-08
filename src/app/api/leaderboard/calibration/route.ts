import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalibrationRankEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_resolved: number
  correct_votes: number
  accuracy_pct: number
  contrarian_correct: number
  contrarian_total: number
  contrarian_pct: number | null
  grade: string
  grade_color: string
}

export interface CalibrationLeaderboardResponse {
  topByAccuracy: CalibrationRankEntry[]
  topByVolume: CalibrationRankEntry[]
  topContrarians: CalibrationRankEntry[]
  platformStats: {
    total_resolved_votes: number
    total_unique_voters: number
    platform_accuracy_pct: number
    avg_grade: string
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toGrade(accuracy: number, total: number): { grade: string; color: string } {
  if (total < 5) return { grade: '–', color: '#6b7280' }
  if (accuracy >= 75) return { grade: 'S', color: '#f59e0b' }
  if (accuracy >= 65) return { grade: 'A', color: '#34d399' }
  if (accuracy >= 55) return { grade: 'B', color: '#60a5fa' }
  if (accuracy >= 45) return { grade: 'C', color: '#a78bfa' }
  if (accuracy >= 35) return { grade: 'D', color: '#f87171' }
  return { grade: 'F', color: '#6b7280' }
}

function avgGradeLabel(accuracy: number): string {
  if (accuracy >= 75) return 'S'
  if (accuracy >= 65) return 'A'
  if (accuracy >= 55) return 'B'
  if (accuracy >= 45) return 'C'
  if (accuracy >= 35) return 'D'
  return 'F'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch all votes on resolved topics in one join.
  // "correct" = voted blue on a law, or red on failed/archived.
  // "contrarian" = voted against majority (blue_pct guides majority direction).
  const { data: rows, error } = await supabase
    .from('votes')
    .select(`
      user_id,
      side,
      topics!inner (
        status,
        blue_pct
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
    const empty: CalibrationLeaderboardResponse = {
      topByAccuracy: [],
      topByVolume: [],
      topContrarians: [],
      platformStats: {
        total_resolved_votes: 0,
        total_unique_voters: 0,
        platform_accuracy_pct: 0,
        avg_grade: 'F',
      },
    }
    return NextResponse.json(empty)
  }

  // Aggregate per user
  type UserAgg = {
    user_id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    total: number
    correct: number
    contrarian_total: number
    contrarian_correct: number
  }

  const map = new Map<string, UserAgg>()

  for (const row of rows) {
    const r = row as {
      user_id: string
      side: string
      topics: { status: string; blue_pct: number }
      profiles: {
        username: string
        display_name: string | null
        avatar_url: string | null
        role: string
        clout: number
      }
    }

    const uid = r.user_id
    if (!map.has(uid)) {
      map.set(uid, {
        user_id: uid,
        username: r.profiles.username,
        display_name: r.profiles.display_name,
        avatar_url: r.profiles.avatar_url,
        role: r.profiles.role,
        clout: r.profiles.clout,
        total: 0,
        correct: 0,
        contrarian_total: 0,
        contrarian_correct: 0,
      })
    }

    const agg = map.get(uid)!
    agg.total++

    const status = r.topics.status
    const bluePct = r.topics.blue_pct ?? 50

    const isCorrect =
      (r.side === 'blue' && status === 'law') ||
      (r.side === 'red' && (status === 'failed' || status === 'archived'))

    if (isCorrect) agg.correct++

    // Contrarian: voted against the current majority at resolution
    // Majority = side with > 60% of votes
    const majorityWasBlue = bluePct >= 60
    const majorityWasRed = bluePct <= 40
    const votedAgainstMajority =
      (r.side === 'red' && majorityWasBlue) || (r.side === 'blue' && majorityWasRed)

    if (votedAgainstMajority) {
      agg.contrarian_total++
      if (isCorrect) agg.contrarian_correct++
    }
  }

  // Build ranked entries (minimum 5 resolved votes)
  const entries: CalibrationRankEntry[] = []
  let platformCorrect = 0
  let platformTotal = 0

  for (const agg of map.values()) {
    if (agg.total < 5) continue

    const accuracy_pct = Math.round((agg.correct / agg.total) * 100 * 10) / 10
    const contrarian_pct =
      agg.contrarian_total >= 3
        ? Math.round((agg.contrarian_correct / agg.contrarian_total) * 100 * 10) / 10
        : null

    const { grade, color: grade_color } = toGrade(accuracy_pct, agg.total)

    platformCorrect += agg.correct
    platformTotal += agg.total

    entries.push({
      rank: 0,
      user_id: agg.user_id,
      username: agg.username,
      display_name: agg.display_name,
      avatar_url: agg.avatar_url,
      role: agg.role,
      clout: agg.clout,
      total_resolved: agg.total,
      correct_votes: agg.correct,
      accuracy_pct,
      contrarian_correct: agg.contrarian_correct,
      contrarian_total: agg.contrarian_total,
      contrarian_pct,
      grade,
      grade_color,
    })
  }

  // Sort and rank by accuracy
  const byAccuracy = [...entries]
    .sort((a, b) => b.accuracy_pct - a.accuracy_pct || b.total_resolved - a.total_resolved)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  // Sort by volume
  const byVolume = [...entries]
    .sort((a, b) => b.total_resolved - a.total_resolved || b.accuracy_pct - a.accuracy_pct)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  // Top contrarians (at least 5 contrarian votes, sorted by contrarian accuracy)
  const contrarians = [...entries]
    .filter((e) => e.contrarian_total >= 5 && e.contrarian_pct !== null)
    .sort((a, b) => (b.contrarian_pct ?? 0) - (a.contrarian_pct ?? 0))
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  const platform_accuracy_pct =
    platformTotal > 0
      ? Math.round((platformCorrect / platformTotal) * 100 * 10) / 10
      : 0

  return NextResponse.json({
    topByAccuracy: byAccuracy,
    topByVolume: byVolume,
    topContrarians: contrarians,
    platformStats: {
      total_resolved_votes: platformTotal,
      total_unique_voters: entries.length,
      platform_accuracy_pct,
      avg_grade: avgGradeLabel(platform_accuracy_pct),
    },
  } satisfies CalibrationLeaderboardResponse)
}
