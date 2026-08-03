import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PressureCohort {
  label: string
  key: string
  forVotes: number
  againstVotes: number
  total: number
  forPct: number
  deltaFromLaw: number  // difference vs law's official blue_pct
}

export interface PressureSignal {
  id: string
  type: 'challenge' | 'veto' | 'reopen' | 'amendment'
  title: string
  status: string
  signature_pct: number   // how far along (0–100)
  created_at: string
}

export interface LawPressureResponse {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
    topic_id: string
  }
  stabilityIndex: number       // 0–100, higher = more stable
  stabilityLabel: 'Stable' | 'Under Watch' | 'Under Pressure' | 'Critical'
  stabilityDescription: string
  eliteVsGrassroots: {
    eliteForPct: number
    eliteTotal: number
    grassrootsForPct: number
    grassrootsTotal: number
    eliteInfluenceDelta: number   // elite FOR% − grassroots FOR%
    cloutThreshold: number
  }
  temporalPressure: {
    recentForPct: number           // last 30 days of votes
    historicalForPct: number       // votes before last 30 days
    recentTotal: number
    historicalTotal: number
    momentumShift: number          // recentForPct − historicalForPct
    hasRecentActivity: boolean
  }
  byRole: PressureCohort[]
  activeSignals: PressureSignal[]
  signalCounts: {
    challenges: number
    vetoes: number
    reopenRequests: number
    amendments: number
    total: number
  }
}

// ─── Stability Calculation ─────────────────────────────────────────────────────

function computeStability(
  forPct: number,
  signalCount: number,
  momentumShift: number,
  eliteDelta: number,
): { index: number; label: LawPressureResponse['stabilityLabel']; description: string } {
  // Base: how decisively it passed (above 75% threshold)
  const passMargin = Math.max(0, forPct - 75)          // 0–25 extra points
  const baseScore = 40 + passMargin * 2                 // 40–90

  // Signal pressure (each active challenge/veto reduces stability)
  const signalPenalty = Math.min(30, signalCount * 8)

  // Momentum penalty (recent AGAINST drift)
  const momentumPenalty = Math.min(20, Math.max(0, -momentumShift * 0.5))

  // Elite divergence (if elite strongly diverges against, adds pressure)
  const elitePenalty = Math.min(10, Math.max(0, -eliteDelta * 0.2))

  const index = Math.max(0, Math.min(100, Math.round(baseScore - signalPenalty - momentumPenalty - elitePenalty)))

  let label: LawPressureResponse['stabilityLabel']
  let description: string

  if (index >= 75) {
    label = 'Stable'
    description = 'This law has broad civic support and faces little meaningful challenge pressure.'
  } else if (index >= 50) {
    label = 'Under Watch'
    description = 'Some reform activity is present, but the law remains in good standing overall.'
  } else if (index >= 25) {
    label = 'Under Pressure'
    description = 'Significant challenges or growing opposition signal this law may face reform or repeal.'
  } else {
    label = 'Critical'
    description = 'This law faces sustained, organised resistance and is at real risk of being overturned.'
  }

  return { index, label, description }
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const lawId = params.id

  // 1. Fetch the law
  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const topicId = law.topic_id
  const lawForPct = law.blue_pct ?? 75

  // 2. Fetch votes with profile data
  const { data: rawVotes } = await supabase
    .from('votes')
    .select('side, created_at, user_id, profiles(role, clout)')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })

  const votes = (rawVotes ?? []) as Array<{
    side: string
    created_at: string
    user_id: string
    profiles: { role: string; clout: number | null } | null
  }>

  // 3. Elite vs grassroots split
  // Sort votes by clout to find the 80th percentile threshold
  const cloutValues = votes
    .map((v) => v.profiles?.clout ?? 0)
    .sort((a, b) => a - b)
  const p80idx = Math.floor(cloutValues.length * 0.8)
  const cloutThreshold = cloutValues[p80idx] ?? 100

  const eliteVotes = votes.filter((v) => (v.profiles?.clout ?? 0) >= cloutThreshold)
  const grassrootsVotes = votes.filter((v) => (v.profiles?.clout ?? 0) < cloutThreshold)

  function forPctOf(subset: typeof votes) {
    if (subset.length === 0) return lawForPct
    return Math.round((subset.filter((v) => v.side === 'blue').length / subset.length) * 100)
  }

  const eliteForPct = forPctOf(eliteVotes)
  const grassrootsForPct = forPctOf(grassrootsVotes)
  const eliteInfluenceDelta = eliteForPct - grassrootsForPct

  // 4. Temporal pressure — recent 30 days vs historical
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const recentVotes = votes.filter((v) => v.created_at >= thirtyDaysAgo)
  const historicalVotes = votes.filter((v) => v.created_at < thirtyDaysAgo)

  const recentForPct = forPctOf(recentVotes)
  const historicalForPct = forPctOf(historicalVotes)
  const momentumShift = recentVotes.length > 0 ? recentForPct - historicalForPct : 0

  // 5. Role breakdown
  const roleGroups = new Map<string, { for: number; against: number }>()
  for (const v of votes) {
    const role = v.profiles?.role ?? 'person'
    const entry = roleGroups.get(role) ?? { for: 0, against: 0 }
    if (v.side === 'blue') entry.for++
    else entry.against++
    roleGroups.set(role, entry)
  }

  const ROLE_LABELS: Record<string, string> = {
    person: 'Citizen',
    debator: 'Debater',
    troll_catcher: 'Moderator',
    elder: 'Elder',
  }

  const byRole: PressureCohort[] = Array.from(roleGroups.entries())
    .map(([role, counts]) => {
      const total = counts.for + counts.against
      const fp = total > 0 ? Math.round((counts.for / total) * 100) : 0
      return {
        label: ROLE_LABELS[role] ?? role,
        key: role,
        forVotes: counts.for,
        againstVotes: counts.against,
        total,
        forPct: fp,
        deltaFromLaw: fp - Math.round(lawForPct),
      }
    })
    .sort((a, b) => b.total - a.total)

  // 6. Active pressure signals
  const [challengesRes, amendmentsRes] = await Promise.all([
    supabase
      .from('law_challenges')
      .select('id, title, status, created_at')
      .eq('law_id', lawId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('law_amendments')
      .select('id, title, status, for_count, against_count, created_at')
      .eq('law_id', lawId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const challenges = (challengesRes.data ?? []) as Array<{
    id: string; title: string; status: string; created_at: string
  }>
  const amendments = (amendmentsRes.data ?? []) as Array<{
    id: string; title: string; status: string; for_count: number | null; against_count: number | null; created_at: string
  }>

  // Civic vetoes (linked to the original topic)
  const { data: vetoes } = await supabase
    .from('civic_vetoes')
    .select('id, title, status, signature_count, target_signatures, created_at')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false })
    .limit(5)

  const rawVetoes = (vetoes ?? []) as Array<{
    id: string; title: string; status: string; signature_count: number | null; target_signatures: number | null; created_at: string
  }>

  // Reopen requests
  const { data: reopens } = await supabase
    .from('law_reopen_requests')
    .select('id, status, current_signatures, target_signatures, created_at')
    .eq('law_id', lawId)
    .order('created_at', { ascending: false })
    .limit(5)

  const rawReopens = (reopens ?? []) as Array<{
    id: string; status: string; current_signatures: number | null; target_signatures: number | null; created_at: string
  }>

  const activeSignals: PressureSignal[] = [
    ...challenges
      .filter((c) => c.status === 'open' || c.status === 'active')
      .map((c) => ({
        id: c.id,
        type: 'challenge' as const,
        title: c.title ?? 'Law Challenge',
        status: c.status,
        signature_pct: 0,
        created_at: c.created_at,
      })),
    ...rawVetoes
      .filter((v) => v.status === 'open')
      .map((v) => ({
        id: v.id,
        type: 'veto' as const,
        title: v.title ?? 'Civic Veto',
        status: v.status,
        signature_pct: Math.min(
          100,
          Math.round(((v.signature_count ?? 0) / Math.max(1, v.target_signatures ?? 50)) * 100),
        ),
        created_at: v.created_at,
      })),
    ...rawReopens
      .filter((r) => r.status === 'active')
      .map((r) => ({
        id: r.id,
        type: 'reopen' as const,
        title: 'Reopen Petition',
        status: r.status,
        signature_pct: Math.min(
          100,
          Math.round(
            ((r.current_signatures ?? 0) / Math.max(1, r.target_signatures ?? 100)) * 100,
          ),
        ),
        created_at: r.created_at,
      })),
    ...amendments
      .filter((a) => a.status === 'voting' || a.status === 'proposed')
      .map((a) => ({
        id: a.id,
        type: 'amendment' as const,
        title: a.title ?? 'Proposed Amendment',
        status: a.status,
        signature_pct: 0,
        created_at: a.created_at,
      })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const signalCounts = {
    challenges: challenges.length,
    vetoes: rawVetoes.length,
    reopenRequests: rawReopens.length,
    amendments: amendments.length,
    total: challenges.length + rawVetoes.length + rawReopens.length + amendments.length,
  }

  // 7. Stability index
  const { index: stabilityIndex, label: stabilityLabel, description: stabilityDescription } =
    computeStability(lawForPct, activeSignals.length, momentumShift, eliteInfluenceDelta)

  const response: LawPressureResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: lawForPct,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
      topic_id: topicId,
    },
    stabilityIndex,
    stabilityLabel,
    stabilityDescription,
    eliteVsGrassroots: {
      eliteForPct,
      eliteTotal: eliteVotes.length,
      grassrootsForPct,
      grassrootsTotal: grassrootsVotes.length,
      eliteInfluenceDelta,
      cloutThreshold,
    },
    temporalPressure: {
      recentForPct,
      historicalForPct,
      recentTotal: recentVotes.length,
      historicalTotal: historicalVotes.length,
      momentumShift,
      hasRecentActivity: recentVotes.length > 0,
    },
    byRole,
    activeSignals: activeSignals.slice(0, 8),
    signalCounts,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
  })
}
