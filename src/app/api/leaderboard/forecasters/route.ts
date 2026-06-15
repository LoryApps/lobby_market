import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForecasterEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_resolved: number
  correct_winners: number
  winner_accuracy_pct: number
  avg_sway_error: number | null
  clout_earned: number
  rank: number
}

export interface RecentDebateResolution {
  debate_id: string
  title: string
  type: string
  predicted_for_pct: number
  predicted_against_pct: number
  predicted_tie_pct: number
  total_predictors: number
  winner_accuracy_pct: number
  resolved_at: string
}

export interface ForecasterPlatformStats {
  total_predictions: number
  resolved_predictions: number
  correct_winner_predictions: number
  platform_winner_accuracy_pct: number
  total_forecasters: number
  avg_sway_error: number | null
  debates_with_predictions: number
}

export interface ForecastersLeaderboardResponse {
  topByAccuracy: ForecasterEntry[]
  topByPrecision: ForecasterEntry[]
  topByClout: ForecasterEntry[]
  recentResolutions: RecentDebateResolution[]
  platformStats: ForecasterPlatformStats
  myStats: {
    total_resolved: number
    correct_winners: number
    winner_accuracy_pct: number
    avg_sway_error: number | null
    clout_earned: number
    accuracyRank: number | null
    precisionRank: number | null
  } | null
}

// ─── Handler ──────────────────────────────────────────────────────────────────

const MIN_RESOLVED = 2

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Aggregate all resolved debate predictions per user ─────────────────────
  const { data: rawPreds } = await supabase
    .from('debate_predictions')
    .select('user_id, predicted_winner, correct_winner, sway_error, clout_earned')
    .not('resolved_at', 'is', null)

  type UserAgg = {
    total: number
    correct: number
    sway_error_sum: number
    sway_error_count: number
    clout: number
  }

  const userAgg = new Map<string, UserAgg>()

  for (const row of rawPreds ?? []) {
    const uid = row.user_id as string
    if (!userAgg.has(uid)) {
      userAgg.set(uid, { total: 0, correct: 0, sway_error_sum: 0, sway_error_count: 0, clout: 0 })
    }
    const agg = userAgg.get(uid)!
    agg.total += 1
    if (row.correct_winner === true) agg.correct += 1
    if (row.sway_error !== null) {
      agg.sway_error_sum += row.sway_error as number
      agg.sway_error_count += 1
    }
    agg.clout += (row.clout_earned as number) ?? 0
  }

  // ── Fetch profiles ─────────────────────────────────────────────────────────
  const forecasterIds = Array.from(userAgg.keys())
  const profileMap = new Map<string, {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }>()

  if (forecasterIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', forecasterIds)
    for (const p of profiles ?? []) {
      profileMap.set(
        p.id as string,
        p as { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number }
      )
    }
  }

  // ── Build scored list ──────────────────────────────────────────────────────
  type ScoredEntry = Omit<ForecasterEntry, 'rank'>

  const list: ScoredEntry[] = []

  for (const [uid, agg] of userAgg) {
    const profile = profileMap.get(uid)
    if (!profile) continue

    list.push({
      user_id: uid,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
      total_resolved: agg.total,
      correct_winners: agg.correct,
      winner_accuracy_pct:
        agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0,
      avg_sway_error:
        agg.sway_error_count > 0
          ? Math.round((agg.sway_error_sum / agg.sway_error_count) * 10) / 10
          : null,
      clout_earned: agg.clout,
    })
  }

  // Top by winner accuracy (min MIN_RESOLVED resolved)
  const topByAccuracy: ForecasterEntry[] = list
    .filter((e) => e.total_resolved >= MIN_RESOLVED)
    .sort((a, b) => {
      if (b.winner_accuracy_pct !== a.winner_accuracy_pct)
        return b.winner_accuracy_pct - a.winner_accuracy_pct
      return b.total_resolved - a.total_resolved
    })
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  // Top by sway precision — lowest avg_sway_error wins
  const topByPrecision: ForecasterEntry[] = list
    .filter((e) => e.total_resolved >= MIN_RESOLVED && e.avg_sway_error !== null)
    .sort((a, b) => {
      const aErr = a.avg_sway_error ?? Infinity
      const bErr = b.avg_sway_error ?? Infinity
      if (aErr !== bErr) return aErr - bErr
      return b.total_resolved - a.total_resolved
    })
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  // Top by clout earned from debate predictions
  const topByClout: ForecasterEntry[] = list
    .filter((e) => e.clout_earned > 0)
    .sort((a, b) => b.clout_earned - a.clout_earned)
    .slice(0, 50)
    .map((e, i) => ({ ...e, rank: i + 1 }))

  // ── Recent resolved debates that had predictions ───────────────────────────
  const { data: resolvedDebates } = await supabase
    .from('debates')
    .select('id, title, type, ended_at')
    .eq('status', 'ended')
    .order('ended_at', { ascending: false })
    .limit(20)

  const debateIds = (resolvedDebates ?? []).map((d) => d.id as string)

  type DebateAgg = {
    total: number
    for_count: number
    against_count: number
    tie_count: number
    correct: number
    resolved_at: string | null
  }

  const debateAgg = new Map<string, DebateAgg>()

  if (debateIds.length > 0) {
    const { data: debPreds } = await supabase
      .from('debate_predictions')
      .select('debate_id, predicted_winner, correct_winner, resolved_at')
      .in('debate_id', debateIds)
      .not('resolved_at', 'is', null)

    for (const p of debPreds ?? []) {
      const did = p.debate_id as string
      if (!debateAgg.has(did)) {
        debateAgg.set(did, {
          total: 0,
          for_count: 0,
          against_count: 0,
          tie_count: 0,
          correct: 0,
          resolved_at: null,
        })
      }
      const agg = debateAgg.get(did)!
      agg.total += 1
      if (p.predicted_winner === 'for') agg.for_count += 1
      else if (p.predicted_winner === 'against') agg.against_count += 1
      else agg.tie_count += 1
      if (p.correct_winner === true) agg.correct += 1
      if (!agg.resolved_at && p.resolved_at) agg.resolved_at = p.resolved_at as string
    }
  }

  const recentResolutions: RecentDebateResolution[] = (resolvedDebates ?? [])
    .filter((d) => debateAgg.has(d.id as string) && (debateAgg.get(d.id as string)!.total > 0))
    .slice(0, 8)
    .map((d) => {
      const agg = debateAgg.get(d.id as string)!
      return {
        debate_id: d.id as string,
        title: d.title as string,
        type: d.type as string,
        predicted_for_pct:
          agg.total > 0 ? Math.round((agg.for_count / agg.total) * 100) : 0,
        predicted_against_pct:
          agg.total > 0 ? Math.round((agg.against_count / agg.total) * 100) : 0,
        predicted_tie_pct:
          agg.total > 0 ? Math.round((agg.tie_count / agg.total) * 100) : 0,
        total_predictors: agg.total,
        winner_accuracy_pct:
          agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0,
        resolved_at: agg.resolved_at ?? d.ended_at as string ?? '',
      }
    })

  // ── Platform stats ─────────────────────────────────────────────────────────
  const allResolved = rawPreds ?? []
  const totalResolved = allResolved.length
  const totalCorrect = allResolved.filter((p) => p.correct_winner === true).length
  const allSwayErrors = allResolved
    .map((p) => p.sway_error as number | null)
    .filter((e): e is number => e !== null)
  const avgSwayError =
    allSwayErrors.length > 0
      ? Math.round((allSwayErrors.reduce((s, e) => s + e, 0) / allSwayErrors.length) * 10) / 10
      : null

  const { count: totalPreds } = await supabase
    .from('debate_predictions')
    .select('id', { count: 'exact', head: true })

  const debatesWithPreds = debateAgg.size

  const platformStats: ForecasterPlatformStats = {
    total_predictions: totalPreds ?? 0,
    resolved_predictions: totalResolved,
    correct_winner_predictions: totalCorrect,
    platform_winner_accuracy_pct:
      totalResolved > 0 ? Math.round((totalCorrect / totalResolved) * 100) : 0,
    total_forecasters: userAgg.size,
    avg_sway_error: avgSwayError,
    debates_with_predictions: debatesWithPreds,
  }

  // ── My stats ───────────────────────────────────────────────────────────────
  let myStats: ForecastersLeaderboardResponse['myStats'] = null
  if (user) {
    const myAgg = userAgg.get(user.id)
    if (myAgg) {
      const myAccuracyRank =
        topByAccuracy.find((e) => e.user_id === user.id)?.rank ?? null
      const myPrecisionRank =
        topByPrecision.find((e) => e.user_id === user.id)?.rank ?? null

      myStats = {
        total_resolved: myAgg.total,
        correct_winners: myAgg.correct,
        winner_accuracy_pct:
          myAgg.total > 0 ? Math.round((myAgg.correct / myAgg.total) * 100) : 0,
        avg_sway_error:
          myAgg.sway_error_count > 0
            ? Math.round((myAgg.sway_error_sum / myAgg.sway_error_count) * 10) / 10
            : null,
        clout_earned: myAgg.clout,
        accuracyRank: myAccuracyRank,
        precisionRank: myPrecisionRank,
      }
    }
  }

  return NextResponse.json(
    {
      topByAccuracy,
      topByPrecision,
      topByClout,
      recentResolutions,
      platformStats,
      myStats,
    } satisfies ForecastersLeaderboardResponse,
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
  )
}
