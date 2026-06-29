import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PressureRoleBreakdown {
  role: string
  label: string
  total: number
  forVotes: number
  againstVotes: number
  forPct: number
}

export interface PressureEliteBreakdown {
  // "Elite" = top 20% by clout
  eliteTotal: number
  eliteForVotes: number
  eliteAgainstVotes: number
  eliteForPct: number
  // "Grassroots" = bottom 80% by clout
  grassrootsTotal: number
  grassrootsForVotes: number
  grassrootsAgainstVotes: number
  grassrootsForPct: number
  // Platform-wide clout threshold used (20th percentile)
  eliteCloutThreshold: number
}

export interface PressureCloutWeighted {
  // Standard (unweighted) FOR%
  rawForPct: number
  // Clout-weighted FOR% — each vote counts proportionally to the voter's clout
  weightedForPct: number
  // Positive = elite pulls FOR, negative = elite pulls AGAINST
  eliteInfluenceDelta: number
}

export interface PressureMomentum {
  // Recent 7 days
  recentTotal: number
  recentForVotes: number
  recentAgainstVotes: number
  recentForPct: number
  // Older than 7 days
  historicalForPct: number
  // Direction: positive = momentum shifting FOR, negative = shifting AGAINST
  momentumShift: number
}

export interface PressureTopInfluencer {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  side: 'for' | 'against'
  // Contribution to overall consensus shift (their clout / total clout * side direction)
  influenceScore: number
}

export interface PressureResponse {
  topicId: string
  statement: string
  category: string | null
  status: string
  totalVotes: number
  rawForPct: number

  roleBreakdown: PressureRoleBreakdown[]
  elite: PressureEliteBreakdown
  cloutWeighted: PressureCloutWeighted
  momentum: PressureMomentum
  topInfluencers: PressureTopInfluencer[]

  // Summary signals
  divergenceLevel: 'none' | 'mild' | 'moderate' | 'strong'
  eliteAlignment: 'with_masses' | 'against_masses' | 'neutral'
}

const ROLE_LABELS: Record<string, string> = {
  elder: 'Elders',
  troll_catcher: 'Troll Catchers',
  debator: 'Debators',
  person: 'Citizens',
  senator: 'Senators',
  lawmaker: 'Lawmakers',
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const topicId = params.id

  // Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch all votes for this topic with voter profile data
  const { data: voteRows } = await supabase
    .from('votes')
    .select('user_id, side, created_at')
    .eq('topic_id', topicId)
    .limit(5000)

  const votes = voteRows ?? []

  if (votes.length === 0) {
    const empty: PressureResponse = {
      topicId: topic.id,
      statement: topic.statement,
      category: topic.category ?? null,
      status: topic.status,
      totalVotes: 0,
      rawForPct: topic.blue_pct ?? 50,
      roleBreakdown: [],
      elite: {
        eliteTotal: 0, eliteForVotes: 0, eliteAgainstVotes: 0, eliteForPct: 50,
        grassrootsTotal: 0, grassrootsForVotes: 0, grassrootsAgainstVotes: 0, grassrootsForPct: 50,
        eliteCloutThreshold: 0,
      },
      cloutWeighted: { rawForPct: 50, weightedForPct: 50, eliteInfluenceDelta: 0 },
      momentum: { recentTotal: 0, recentForVotes: 0, recentAgainstVotes: 0, recentForPct: 50, historicalForPct: 50, momentumShift: 0 },
      topInfluencers: [],
      divergenceLevel: 'none',
      eliteAlignment: 'neutral',
    }
    return NextResponse.json(empty)
  }

  // Fetch profiles for all voters
  const userIds = [...new Set(votes.map((v) => v.user_id as string))]

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score')
    .in('id', userIds)

  const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number; reputation_score: number }>(
    (profileRows ?? []).map((p) => [p.id, {
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role,
      clout: p.clout ?? 0,
      reputation_score: p.reputation_score ?? 0,
    }])
  )

  const totalVotes = votes.length
  const rawForVotes = votes.filter((v) => v.side === 'blue').length
  const rawForPct = totalVotes > 0 ? Math.round((rawForVotes / totalVotes) * 100) : 50

  // ── Role breakdown ────────────────────────────────────────────────────────

  const roleMap = new Map<string, { forVotes: number; againstVotes: number }>()
  for (const v of votes) {
    const profile = profileMap.get(v.user_id as string)
    const role = profile?.role ?? 'person'
    const existing = roleMap.get(role) ?? { forVotes: 0, againstVotes: 0 }
    if (v.side === 'blue') existing.forVotes += 1
    else existing.againstVotes += 1
    roleMap.set(role, existing)
  }

  const roleBreakdown: PressureRoleBreakdown[] = Array.from(roleMap.entries())
    .map(([role, stats]) => {
      const total = stats.forVotes + stats.againstVotes
      return {
        role,
        label: ROLE_LABELS[role] ?? role,
        total,
        forVotes: stats.forVotes,
        againstVotes: stats.againstVotes,
        forPct: total > 0 ? Math.round((stats.forVotes / total) * 100) : 50,
      }
    })
    .sort((a, b) => b.total - a.total)

  // ── Elite vs Grassroots ───────────────────────────────────────────────────

  const allClouts = [...profileMap.values()].map((p) => p.clout).sort((a, b) => a - b)
  const eliteThresholdIdx = Math.floor(allClouts.length * 0.8)
  const eliteCloutThreshold = allClouts[eliteThresholdIdx] ?? 0

  let eliteFor = 0, eliteAgainst = 0
  let grassrootsFor = 0, grassrootsAgainst = 0

  for (const v of votes) {
    const profile = profileMap.get(v.user_id as string)
    const clout = profile?.clout ?? 0
    const isFor = v.side === 'blue'

    if (clout >= eliteCloutThreshold) {
      if (isFor) eliteFor++; else eliteAgainst++
    } else {
      if (isFor) grassrootsFor++; else grassrootsAgainst++
    }
  }

  const eliteTotal = eliteFor + eliteAgainst
  const grassrootsTotal = grassrootsFor + grassrootsAgainst
  const eliteForPct = eliteTotal > 0 ? Math.round((eliteFor / eliteTotal) * 100) : 50
  const grassrootsForPct = grassrootsTotal > 0 ? Math.round((grassrootsFor / grassrootsTotal) * 100) : 50

  const elite: PressureEliteBreakdown = {
    eliteTotal,
    eliteForVotes: eliteFor,
    eliteAgainstVotes: eliteAgainst,
    eliteForPct,
    grassrootsTotal,
    grassrootsForVotes: grassrootsFor,
    grassrootsAgainstVotes: grassrootsAgainst,
    grassrootsForPct,
    eliteCloutThreshold,
  }

  // ── Clout-weighted consensus ──────────────────────────────────────────────

  let weightedForSum = 0
  let weightedTotalSum = 0

  for (const v of votes) {
    const profile = profileMap.get(v.user_id as string)
    const clout = Math.max(1, profile?.clout ?? 1)
    weightedTotalSum += clout
    if (v.side === 'blue') weightedForSum += clout
  }

  const weightedForPct = weightedTotalSum > 0
    ? Math.round((weightedForSum / weightedTotalSum) * 100)
    : 50

  const cloutWeighted: PressureCloutWeighted = {
    rawForPct,
    weightedForPct,
    eliteInfluenceDelta: weightedForPct - rawForPct,
  }

  // ── Momentum (recent 7 days vs historical) ────────────────────────────────

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const recentVotes = votes.filter((v) => (v.created_at as string) >= sevenDaysAgo)
  const historicalVotes = votes.filter((v) => (v.created_at as string) < sevenDaysAgo)

  const recentFor = recentVotes.filter((v) => v.side === 'blue').length
  const recentTotal = recentVotes.length
  const recentForPct = recentTotal > 0 ? Math.round((recentFor / recentTotal) * 100) : rawForPct

  const historicalFor = historicalVotes.filter((v) => v.side === 'blue').length
  const historicalTotal = historicalVotes.length
  const historicalForPct = historicalTotal > 0 ? Math.round((historicalFor / historicalTotal) * 100) : rawForPct

  const momentum: PressureMomentum = {
    recentTotal,
    recentForVotes: recentFor,
    recentAgainstVotes: recentTotal - recentFor,
    recentForPct,
    historicalForPct,
    momentumShift: recentForPct - historicalForPct,
  }

  // ── Top influencers ───────────────────────────────────────────────────────

  const totalClout = votes.reduce((acc, v) => {
    const clout = profileMap.get(v.user_id as string)?.clout ?? 1
    return acc + clout
  }, 0)

  const influencerMap = new Map<string, { side: 'for' | 'against'; clout: number }>()
  for (const v of votes) {
    const uid = v.user_id as string
    const profile = profileMap.get(uid)
    if (!profile) continue
    if (!influencerMap.has(uid)) {
      influencerMap.set(uid, {
        side: v.side === 'blue' ? 'for' : 'against',
        clout: profile.clout,
      })
    }
  }

  const topInfluencers: PressureTopInfluencer[] = Array.from(influencerMap.entries())
    .map(([uid, info]) => {
      const profile = profileMap.get(uid)!
      const influenceScore = (info.clout / Math.max(1, totalClout)) * 100
      return {
        user_id: uid,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        clout: info.clout,
        side: info.side,
        influenceScore,
      }
    })
    .sort((a, b) => b.clout - a.clout)
    .slice(0, 10)

  // ── Summary signals ───────────────────────────────────────────────────────

  const divergencePct = Math.abs(eliteForPct - grassrootsForPct)
  const divergenceLevel: PressureResponse['divergenceLevel'] =
    divergencePct < 3 ? 'none' :
    divergencePct < 8 ? 'mild' :
    divergencePct < 15 ? 'moderate' : 'strong'

  const eliteAlignment: PressureResponse['eliteAlignment'] =
    Math.abs(eliteForPct - rawForPct) < 3 ? 'neutral' :
    eliteForPct > rawForPct ? 'with_masses' : 'against_masses'

  const response: PressureResponse = {
    topicId: topic.id,
    statement: topic.statement,
    category: topic.category ?? null,
    status: topic.status,
    totalVotes,
    rawForPct,
    roleBreakdown,
    elite,
    cloutWeighted,
    momentum,
    topInfluencers,
    divergenceLevel,
    eliteAlignment,
  }

  return NextResponse.json(response)
}
