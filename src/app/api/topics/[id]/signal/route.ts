import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type SignalStrength = 'strong' | 'moderate' | 'weak' | 'neutral'
export type SignalDirection = 'bullish' | 'bearish' | 'mixed' | 'neutral'

export interface Signal {
  id: string
  label: string
  value: number        // 0-100 normalized score
  raw: string          // Human-readable raw value
  direction: SignalDirection
  strength: SignalStrength
  description: string
}

export interface CoalitionStance {
  coalition_id: string
  coalition_name: string
  stance: 'for' | 'against' | 'neutral'
  member_count: number
  statement: string | null
}

export interface SignalResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
  }
  signals: Signal[]
  coalition_stances: CoalitionStance[]
  overall_score: number
  overall_direction: SignalDirection
  summary: string
  refreshed_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeSignalStrength(value: number): SignalStrength {
  if (value >= 75) return 'strong'
  if (value >= 50) return 'moderate'
  if (value >= 25) return 'weak'
  return 'neutral'
}

function consensusSignal(bluePct: number, totalVotes: number): Signal {
  const lean = Math.abs(bluePct - 50) * 2  // 0-100
  const direction: SignalDirection =
    bluePct > 55 ? 'bullish' :
    bluePct < 45 ? 'bearish' :
    'neutral'

  const voteWeight = Math.min(totalVotes / 1000, 1)
  const value = Math.round(lean * 0.7 + voteWeight * 30)

  return {
    id: 'consensus',
    label: 'Consensus Strength',
    value,
    raw: `${Math.round(bluePct)}% For · ${Math.round(100 - bluePct)}% Against`,
    direction,
    strength: gradeSignalStrength(value),
    description:
      direction === 'bullish'
        ? `Strong FOR majority (${Math.round(bluePct)}%) across ${totalVotes.toLocaleString()} votes`
        : direction === 'bearish'
        ? `Strong AGAINST majority (${Math.round(100 - bluePct)}%) across ${totalVotes.toLocaleString()} votes`
        : `Contested — debate is near 50/50 split`,
  }
}

function velocitySignal(totalVotes: number, createdAt: string): Signal {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageDays = Math.max(ageMs / 86_400_000, 1)
  const votesPerDay = totalVotes / ageDays

  let value = 0
  let raw = ''
  let direction: SignalDirection = 'neutral'

  if (votesPerDay >= 100) {
    value = 100; raw = `${Math.round(votesPerDay)}/day`; direction = 'bullish'
  } else if (votesPerDay >= 50) {
    value = 80; raw = `${Math.round(votesPerDay)}/day`; direction = 'bullish'
  } else if (votesPerDay >= 20) {
    value = 60; raw = `${Math.round(votesPerDay)}/day`; direction = 'mixed'
  } else if (votesPerDay >= 5) {
    value = 40; raw = `${Math.round(votesPerDay)}/day`; direction = 'mixed'
  } else {
    value = 15; raw = `${votesPerDay.toFixed(1)}/day`; direction = 'neutral'
  }

  return {
    id: 'velocity',
    label: 'Vote Velocity',
    value,
    raw,
    direction,
    strength: gradeSignalStrength(value),
    description:
      value >= 70
        ? `High engagement — ${raw} votes flowing in`
        : value >= 40
        ? `Steady engagement — ${raw} votes cast`
        : `Low engagement — debate activity is slow`,
  }
}

function qualitySignal(avgScore: number | null, totalArgs: number): Signal {
  if (avgScore === null || totalArgs === 0) {
    return {
      id: 'quality',
      label: 'Argument Quality',
      value: 0,
      raw: 'No data',
      direction: 'neutral',
      strength: 'neutral',
      description: 'No arguments have been scored yet',
    }
  }

  const value = Math.round(avgScore)
  const direction: SignalDirection =
    value >= 70 ? 'bullish' :
    value >= 45 ? 'mixed' :
    'bearish'

  return {
    id: 'quality',
    label: 'Argument Quality',
    value,
    raw: `${value}/100 avg · ${totalArgs} args`,
    direction,
    strength: gradeSignalStrength(value),
    description:
      value >= 70
        ? `High-quality discourse — avg AI score ${value}/100`
        : value >= 45
        ? `Mixed quality discourse — avg AI score ${value}/100`
        : `Low-quality discourse — arguments lack depth (avg ${value}/100)`,
  }
}

function participationSignal(totalVotes: number, totalArgs: number): Signal {
  const argRatio = totalVotes > 0 ? (totalArgs / totalVotes) * 100 : 0
  const value = Math.min(Math.round(argRatio * 5), 100)
  const direction: SignalDirection =
    argRatio >= 5 ? 'bullish' :
    argRatio >= 2 ? 'mixed' :
    'neutral'

  return {
    id: 'participation',
    label: 'Debate Participation',
    value,
    raw: `${totalArgs} args / ${totalVotes.toLocaleString()} votes`,
    direction,
    strength: gradeSignalStrength(value),
    description:
      argRatio >= 5
        ? `Rich debate — ${totalArgs} arguments across ${totalVotes.toLocaleString()} votes`
        : argRatio >= 2
        ? `Active debate — some good discussion alongside the votes`
        : totalArgs === 0
        ? `Silent vote — no arguments posted yet`
        : `Thin debate — more voters than arguers`,
  }
}

function predictionSignal(lawConfidence: number | null, totalPredictions: number): Signal {
  if (lawConfidence === null || totalPredictions === 0) {
    return {
      id: 'prediction',
      label: 'Market Confidence',
      value: 50,
      raw: 'No predictions',
      direction: 'neutral',
      strength: 'neutral',
      description: 'No predictions placed yet — market is uncommitted',
    }
  }

  const value = Math.round(Math.abs(lawConfidence - 50) * 2)
  const direction: SignalDirection =
    lawConfidence >= 60 ? 'bullish' :
    lawConfidence <= 40 ? 'bearish' :
    'neutral'

  return {
    id: 'prediction',
    label: 'Market Confidence',
    value,
    raw: `${Math.round(lawConfidence)}% law · ${totalPredictions} predictors`,
    direction,
    strength: gradeSignalStrength(value),
    description:
      direction === 'bullish'
        ? `Predictors give ${Math.round(lawConfidence)}% chance of becoming law`
        : direction === 'bearish'
        ? `Predictors give only ${Math.round(lawConfidence)}% chance of becoming law`
        : `Prediction market is split — outcome uncertain`,
  }
}

function coalitionSignal(stances: CoalitionStance[]): Signal {
  if (stances.length === 0) {
    return {
      id: 'coalition',
      label: 'Coalition Alignment',
      value: 0,
      raw: 'No stances',
      direction: 'neutral',
      strength: 'neutral',
      description: 'No coalitions have declared a stance on this topic',
    }
  }

  const forCount = stances.filter((s) => s.stance === 'for').length
  const againstCount = stances.filter((s) => s.stance === 'against').length
  const total = stances.length

  const forPct = Math.round((forCount / total) * 100)
  const direction: SignalDirection =
    forPct >= 60 ? 'bullish' :
    forPct <= 40 ? 'bearish' :
    'mixed'

  const value = Math.round(Math.abs(forPct - 50) * 2)

  return {
    id: 'coalition',
    label: 'Coalition Alignment',
    value,
    raw: `${forCount} FOR · ${againstCount} AGAINST · ${total - forCount - againstCount} Neutral`,
    direction,
    strength: gradeSignalStrength(value),
    description:
      direction === 'bullish'
        ? `${forCount}/${total} coalitions back the FOR position`
        : direction === 'bearish'
        ? `${againstCount}/${total} coalitions oppose this topic`
        : `Coalitions are split — ${forCount} FOR, ${againstCount} AGAINST`,
  }
}

function buildSummary(
  overall: number,
  direction: SignalDirection,
  status: string,
  forPct: number,
): string {
  const statusLabel: Record<string, string> = {
    proposed: 'a newly proposed debate',
    active: 'an active debate',
    voting: 'a debate in the voting phase',
    law: 'an established law',
    failed: 'a rejected proposal',
  }
  const label = statusLabel[status] ?? 'this debate'

  if (status === 'law') return `This topic has passed into law with ${Math.round(forPct)}% civic support.`
  if (status === 'failed') return `This topic failed to reach consensus — ${Math.round(100 - forPct)}% voted against.`

  if (overall >= 70) {
    return direction === 'bullish'
      ? `Strong signals point to a FOR outcome — high consensus, active engagement, and quality debate.`
      : direction === 'bearish'
      ? `Strong signals favour rejection — a decisive AGAINST majority with engaged opposition.`
      : `${label.charAt(0).toUpperCase() + label.slice(1)} with strong but mixed signals.`
  }
  if (overall >= 40) {
    return `${label.charAt(0).toUpperCase() + label.slice(1)} showing moderate activity — outcome is genuinely uncertain.`
  }
  return `Low signal strength — ${label} with limited engagement so far. Early days.`
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // Topic
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (topicErr || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Argument stats
  const { data: argStats } = await supabase
    .from('topic_arguments')
    .select('id, side, ai_score')
    .eq('topic_id', params.id)

  const totalArgs = argStats?.length ?? 0
  const scoredArgs = argStats?.filter((a) => a.ai_score !== null) ?? []
  const avgScore =
    scoredArgs.length > 0
      ? scoredArgs.reduce((sum, a) => sum + (a.ai_score ?? 0), 0) / scoredArgs.length
      : null

  // Prediction stats
  const { data: predStats } = await supabase
    .from('topic_prediction_stats')
    .select('law_confidence, total_predictions')
    .eq('topic_id', params.id)
    .maybeSingle()

  // Coalition stances
  const { data: rawStances } = await supabase
    .from('coalition_stances')
    .select(`
      coalition_id,
      stance,
      statement,
      coalitions!inner(
        name,
        member_count
      )
    `)
    .eq('topic_id', params.id)
    .limit(20)

  const coalitionStances: CoalitionStance[] = (rawStances ?? []).map((s) => {
    const coal = Array.isArray(s.coalitions) ? s.coalitions[0] : s.coalitions
    return {
      coalition_id: s.coalition_id,
      coalition_name: (coal as { name?: string })?.name ?? 'Unknown Coalition',
      stance: s.stance as 'for' | 'against' | 'neutral',
      member_count: (coal as { member_count?: number })?.member_count ?? 0,
      statement: s.statement ?? null,
    }
  })

  // Build signals
  const bluePct = topic.blue_pct ?? 50
  const signals: Signal[] = [
    consensusSignal(bluePct, topic.total_votes ?? 0),
    velocitySignal(topic.total_votes ?? 0, topic.created_at),
    qualitySignal(avgScore, totalArgs),
    participationSignal(topic.total_votes ?? 0, totalArgs),
    predictionSignal(
      predStats?.law_confidence ? Number(predStats.law_confidence) : null,
      predStats?.total_predictions ?? 0,
    ),
    coalitionSignal(coalitionStances),
  ]

  // Overall score (weighted average)
  const weights = [0.3, 0.2, 0.2, 0.1, 0.1, 0.1]
  const overallScore = Math.round(
    signals.reduce((sum, sig, i) => sum + sig.value * (weights[i] ?? 0.1), 0),
  )

  const bullish = signals.filter((s) => s.direction === 'bullish').length
  const bearish = signals.filter((s) => s.direction === 'bearish').length
  const overallDirection: SignalDirection =
    bullish > bearish + 1 ? 'bullish' :
    bearish > bullish + 1 ? 'bearish' :
    bullish === bearish ? 'mixed' :
    bullish > bearish ? 'bullish' : 'bearish'

  const summary = buildSummary(overallScore, overallDirection, topic.status, bluePct)

  const response: SignalResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category ?? null,
      status: topic.status,
      blue_pct: bluePct,
      total_votes: topic.total_votes ?? 0,
      created_at: topic.created_at,
    },
    signals,
    coalition_stances: coalitionStances,
    overall_score: overallScore,
    overall_direction: overallDirection,
    summary,
    refreshed_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
