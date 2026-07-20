import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DepthVoterProfile {
  count: number
  avg_clout: number
  avg_reputation: number
  high_clout_count: number
  top_voters: Array<{
    username: string
    display_name: string | null
    avatar_url: string | null
    clout: number
    voted_at: string
  }>
}

export interface DepthTimelineBucket {
  date: string
  blue_votes: number
  red_votes: number
  cumulative_blue: number
  cumulative_red: number
}

export interface DepthSensitivity {
  to_33: number | null
  to_45: number | null
  to_50: number | null
  to_55: number | null
  to_60: number | null
  to_67: number | null
  to_75: number | null
}

export interface DepthVelocity {
  recent_blue: number
  recent_red: number
  prior_blue: number
  prior_red: number
  momentum: 'bullish' | 'bearish' | 'neutral'
  change_pct: number
}

export interface DepthResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    blue_votes: number
    red_votes: number
    created_at: string
  }
  timeline: DepthTimelineBucket[]
  for_profile: DepthVoterProfile
  against_profile: DepthVoterProfile
  velocity: DepthVelocity
  sensitivity: DepthSensitivity
  concentration: {
    top5_pct: number
    top10_pct: number
    gini: number
  }
}

// ─── Gini coefficient helper ──────────────────────────────────────────────────

function giniCoefficient(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const sum = sorted.reduce((acc, v) => acc + v, 0)
  if (sum === 0) return 0
  let numerator = 0
  for (let i = 0; i < n; i++) numerator += (2 * (i + 1) - n - 1) * sorted[i]
  return numerator / (n * sum)
}

// ─── Price sensitivity helper ─────────────────────────────────────────────────

function votesToReach(
  currentBlue: number,
  currentRed: number,
  targetPct: number,
): number | null {
  const total = currentBlue + currentRed
  if (total === 0) return null
  const currentPct = currentBlue / total
  if (currentPct >= targetPct / 100) return null  // already there
  // We want (currentBlue + x) / (total + x) = targetPct / 100
  // => currentBlue + x = (total + x) * targetPct / 100
  // => currentBlue + x = total * t + x * t  where t = targetPct/100
  // => x(1 - t) = total * t - currentBlue
  // => x = (total * t - currentBlue) / (1 - t)
  const t = targetPct / 100
  if (t >= 1) return null
  const x = (total * t - currentBlue) / (1 - t)
  return x < 0 ? null : Math.ceil(x)
}

function votesToFall(
  currentBlue: number,
  currentRed: number,
  targetPct: number,
): number | null {
  const total = currentBlue + currentRed
  if (total === 0) return null
  const currentPct = currentBlue / total
  if (currentPct <= targetPct / 100) return null
  // We want (currentBlue) / (total + x) = targetPct / 100  (adding x AGAINST votes)
  // => currentBlue = (total + x) * t
  // => currentBlue / t - total = x
  const t = targetPct / 100
  if (t <= 0) return null
  const x = currentBlue / t - total
  return x < 0 ? null : Math.ceil(x)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // ── 1. Topic ───────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const blueVotes = topic.blue_votes ?? 0
  const redVotes = topic.red_votes ?? 0
  const bluePct = topic.blue_pct ?? 50

  // ── 2. All votes with timestamps ───────────────────────────────────────────
  const { data: allVotes } = await supabase
    .from('votes')
    .select('side, created_at, user_id')
    .eq('topic_id', id)
    .order('created_at', { ascending: true })

  const votes = allVotes ?? []

  // ── 3. Timeline — daily buckets ────────────────────────────────────────────
  const buckets: Record<string, { blue: number; red: number }> = {}
  for (const v of votes) {
    const day = v.created_at.slice(0, 10)
    if (!buckets[day]) buckets[day] = { blue: 0, red: 0 }
    if (v.side === 'blue') buckets[day].blue++
    else buckets[day].red++
  }

  let cumBlue = 0
  let cumRed = 0
  const timeline: DepthTimelineBucket[] = Object.keys(buckets)
    .sort()
    .map(date => {
      cumBlue += buckets[date].blue
      cumRed += buckets[date].red
      return {
        date,
        blue_votes: buckets[date].blue,
        red_votes: buckets[date].red,
        cumulative_blue: cumBlue,
        cumulative_red: cumRed,
      }
    })

  // ── 4. Voter profiles ──────────────────────────────────────────────────────
  const forUserIds = votes.filter(v => v.side === 'blue').map(v => v.user_id)
  const againstUserIds = votes.filter(v => v.side === 'red').map(v => v.user_id)

  async function buildProfile(
    userIds: string[],
    side: 'blue' | 'red',
  ): Promise<DepthVoterProfile> {
    if (userIds.length === 0) {
      return { count: 0, avg_clout: 0, avg_reputation: 0, high_clout_count: 0, top_voters: [] }
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, clout, reputation_score')
      .in('id', userIds.slice(0, 500))

    const ps = profiles ?? []
    const totalClout = ps.reduce((sum, p) => sum + (p.clout ?? 0), 0)
    const totalRep = ps.reduce((sum, p) => sum + (p.reputation_score ?? 0), 0)
    const highCloutCount = ps.filter(p => (p.clout ?? 0) >= 500).length

    const voteMap = new Map(
      votes
        .filter(v => v.side === side)
        .map(v => [v.user_id, v.created_at])
    )

    const top = ps
      .sort((a, b) => (b.clout ?? 0) - (a.clout ?? 0))
      .slice(0, 8)
      .map(p => ({
        username: p.username ?? 'unknown',
        display_name: p.display_name ?? null,
        avatar_url: p.avatar_url ?? null,
        clout: p.clout ?? 0,
        voted_at: voteMap.get(p.id) ?? '',
      }))

    return {
      count: userIds.length,
      avg_clout: ps.length ? Math.round(totalClout / ps.length) : 0,
      avg_reputation: ps.length ? Math.round((totalRep / ps.length) * 10) / 10 : 0,
      high_clout_count: highCloutCount,
      top_voters: top,
    }
  }

  const [forProfile, againstProfile] = await Promise.all([
    buildProfile(forUserIds, 'blue'),
    buildProfile(againstUserIds, 'red'),
  ])

  // ── 5. Velocity — last 7d vs prior 7d ─────────────────────────────────────
  const now = Date.now()
  const WEEK = 7 * 24 * 60 * 60 * 1000
  const recentBlue = votes.filter(
    v => v.side === 'blue' && now - new Date(v.created_at).getTime() < WEEK,
  ).length
  const recentRed = votes.filter(
    v => v.side === 'red' && now - new Date(v.created_at).getTime() < WEEK,
  ).length
  const priorBlue = votes.filter(v => {
    const age = now - new Date(v.created_at).getTime()
    return v.side === 'blue' && age >= WEEK && age < 2 * WEEK
  }).length
  const priorRed = votes.filter(v => {
    const age = now - new Date(v.created_at).getTime()
    return v.side === 'red' && age >= WEEK && age < 2 * WEEK
  }).length

  const recentBias = recentBlue - recentRed
  const priorBias = priorBlue - priorRed
  const changePct = priorBias !== 0 ? Math.round(((recentBias - priorBias) / Math.abs(priorBias)) * 100) : 0
  const momentum: 'bullish' | 'bearish' | 'neutral' =
    recentBlue > recentRed * 1.15 ? 'bullish'
    : recentRed > recentBlue * 1.15 ? 'bearish'
    : 'neutral'

  const velocity: DepthVelocity = {
    recent_blue: recentBlue,
    recent_red: recentRed,
    prior_blue: priorBlue,
    prior_red: priorRed,
    momentum,
    change_pct: changePct,
  }

  // ── 6. Price sensitivity ───────────────────────────────────────────────────
  const sensitivity: DepthSensitivity = {
    to_33: bluePct > 33 ? votesToFall(blueVotes, redVotes, 33) : null,
    to_45: bluePct > 45 ? votesToFall(blueVotes, redVotes, 45) : null,
    to_50: bluePct !== 50 ? (bluePct < 50
      ? votesToReach(blueVotes, redVotes, 50)
      : votesToFall(blueVotes, redVotes, 50)) : null,
    to_55: bluePct < 55 ? votesToReach(blueVotes, redVotes, 55) : null,
    to_60: bluePct < 60 ? votesToReach(blueVotes, redVotes, 60) : null,
    to_67: bluePct < 67 ? votesToReach(blueVotes, redVotes, 67) : null,
    to_75: bluePct < 75 ? votesToReach(blueVotes, redVotes, 75) : null,
  }

  // ── 7. Concentration ──────────────────────────────────────────────────────
  // Use clout as proxy for "position size"
  const { data: topCloutsRaw } = await supabase
    .from('profiles')
    .select('clout')
    .in('id', [...forUserIds, ...againstUserIds].slice(0, 500))
    .order('clout', { ascending: false })

  const clouts = (topCloutsRaw ?? []).map(p => p.clout ?? 0)
  const total = votes.length
  const top5 = clouts.slice(0, 5).reduce((a, b) => a + b, 0)
  const top10 = clouts.slice(0, 10).reduce((a, b) => a + b, 0)
  const totalClout = clouts.reduce((a, b) => a + b, 0)

  const concentration = {
    top5_pct: totalClout > 0 ? Math.round((top5 / totalClout) * 100) : 0,
    top10_pct: totalClout > 0 ? Math.round((top10 / totalClout) * 100) : 0,
    gini: Math.round(giniCoefficient(clouts) * 100) / 100,
  }

  const response: DepthResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category ?? null,
      status: topic.status,
      blue_pct: Math.round(bluePct),
      total_votes: total,
      blue_votes: blueVotes,
      red_votes: redVotes,
      created_at: topic.created_at,
    },
    timeline,
    for_profile: forProfile,
    against_profile: againstProfile,
    velocity,
    sensitivity,
    concentration,
  }

  return NextResponse.json(response)
}
