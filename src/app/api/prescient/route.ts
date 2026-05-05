import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryAlignment {
  category: string
  totalVotes: number
  alignedVotes: number
  alignmentPct: number
  correctOutcomes: number
  totalOutcomes: number
  outcomePct: number | null
  contrarian: boolean
}

export interface PrescientVote {
  topicId: string
  statement: string
  category: string | null
  side: 'blue' | 'red'
  finalStatus: string
  bluePct: number
  isAligned: boolean
  isCorrectOutcome: boolean | null
  votedAt: string
}

export interface PrescientData {
  overallAlignment: number
  contraryIndex: number
  outcomeAccuracy: number | null
  totalVotesCast: number
  completedTopics: number
  correctOutcomes: number
  prescientVotes: PrescientVote[]
  categoryBreakdown: CategoryAlignment[]
  tier: string
  tierColor: string
  tierLabel: string
  insight: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function alignmentTier(alignmentPct: number, contraryIndex: number): {
  tier: string
  color: string
  label: string
} {
  if (contraryIndex >= 70) return { tier: 'Maverick', color: 'text-against-400', label: 'You consistently take minority positions' }
  if (contraryIndex >= 50) return { tier: 'Dissenter', color: 'text-against-300', label: 'You lean contrarian' }
  if (alignmentPct >= 85) return { tier: 'Consensus Builder', color: 'text-emerald', label: 'You strongly align with community consensus' }
  if (alignmentPct >= 70) return { tier: 'Community Voice', color: 'text-for-400', label: 'You reliably track with consensus' }
  if (alignmentPct >= 55) return { tier: 'Independent', color: 'text-surface-300', label: 'Balanced between consensus and contrarianism' }
  return { tier: 'Free Thinker', color: 'text-purple', label: 'You often diverge from the crowd' }
}

function buildInsight(data: {
  alignmentPct: number
  contraryIndex: number
  outcomeAccuracy: number | null
  categories: CategoryAlignment[]
}): string {
  const { alignmentPct, contraryIndex, outcomeAccuracy, categories } = data

  const bestCat = categories.sort((a, b) => b.alignmentPct - a.alignmentPct)[0]
  const worstCat = categories.sort((a, b) => a.alignmentPct - b.alignmentPct)[0]

  const parts: string[] = []

  if (contraryIndex >= 60) {
    parts.push(`You vote against the majority ${contraryIndex}% of the time — a true civic contrarian.`)
  } else if (alignmentPct >= 80) {
    parts.push(`You align with community consensus on ${alignmentPct}% of topics.`)
  } else {
    parts.push(`You vote with the majority ${alignmentPct}% of the time.`)
  }

  if (bestCat && categories.length > 1) {
    parts.push(`Your strongest alignment is in ${bestCat.category} (${bestCat.alignmentPct}%).`)
  }

  if (worstCat && worstCat.category !== bestCat?.category && categories.length > 1) {
    parts.push(`You're most contrarian in ${worstCat.category} (${worstCat.alignmentPct}% aligned).`)
  }

  if (outcomeAccuracy !== null) {
    if (outcomeAccuracy >= 70) {
      parts.push(`Impressively, you correctly called ${outcomeAccuracy}% of concluded debates.`)
    } else if (outcomeAccuracy <= 40) {
      parts.push(`On concluded debates, you were on the minority side ${100 - outcomeAccuracy}% of the time.`)
    }
  }

  return parts.join(' ')
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all user votes with topic data
  const { data: votes, error } = await supabase
    .from('votes')
    .select(`
      side,
      created_at,
      topics (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!votes || votes.length === 0) {
    return NextResponse.json({ error: 'No votes found' }, { status: 404 })
  }

  // Process vote alignment
  const prescientVotes: PrescientVote[] = []
  const categoryMap = new Map<string, { total: number; aligned: number; correct: number; outcomes: number }>()

  let totalAligned = 0
  let totalCorrect = 0
  let totalOutcomes = 0

  for (const v of votes) {
    const topic = v.topics as {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    } | null

    if (!topic) continue

    const side = v.side as 'blue' | 'red'
    const bluePct = topic.blue_pct ?? 50
    const currentMajority = bluePct >= 50 ? 'blue' : 'red'
    const isAligned = side === currentMajority

    // Outcome accuracy: for concluded topics (law = blue won, failed = red won by convention)
    let isCorrectOutcome: boolean | null = null
    if (topic.status === 'law') {
      isCorrectOutcome = side === 'blue'
      totalCorrect += isCorrectOutcome ? 1 : 0
      totalOutcomes++
    } else if (topic.status === 'failed') {
      isCorrectOutcome = side === 'red'
      totalCorrect += isCorrectOutcome ? 1 : 0
      totalOutcomes++
    }

    if (isAligned) totalAligned++

    const cat = topic.category ?? 'Uncategorized'
    const existing = categoryMap.get(cat) ?? { total: 0, aligned: 0, correct: 0, outcomes: 0 }
    existing.total++
    if (isAligned) existing.aligned++
    if (isCorrectOutcome !== null) {
      existing.outcomes++
      if (isCorrectOutcome) existing.correct++
    }
    categoryMap.set(cat, existing)

    prescientVotes.push({
      topicId: topic.id,
      statement: topic.statement,
      category: topic.category,
      side,
      finalStatus: topic.status,
      bluePct,
      isAligned,
      isCorrectOutcome,
      votedAt: v.created_at,
    })
  }

  const totalVotes = votes.length
  const overallAlignment = totalVotes > 0 ? Math.round((totalAligned / totalVotes) * 100) : 50
  const contraryIndex = 100 - overallAlignment
  const outcomeAccuracy = totalOutcomes > 0 ? Math.round((totalCorrect / totalOutcomes) * 100) : null

  const categoryBreakdown: CategoryAlignment[] = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      totalVotes: stats.total,
      alignedVotes: stats.aligned,
      alignmentPct: Math.round((stats.aligned / stats.total) * 100),
      correctOutcomes: stats.correct,
      totalOutcomes: stats.outcomes,
      outcomePct: stats.outcomes > 0 ? Math.round((stats.correct / stats.outcomes) * 100) : null,
      contrarian: Math.round((stats.aligned / stats.total) * 100) < 40,
    }))
    .filter((c) => c.totalVotes >= 2)
    .sort((a, b) => b.totalVotes - a.totalVotes)

  const { tier, color, label } = alignmentTier(overallAlignment, contraryIndex)

  const insight = buildInsight({
    alignmentPct: overallAlignment,
    contraryIndex,
    outcomeAccuracy,
    categories: [...categoryBreakdown],
  })

  const result: PrescientData = {
    overallAlignment,
    contraryIndex,
    outcomeAccuracy,
    totalVotesCast: totalVotes,
    completedTopics: totalOutcomes,
    correctOutcomes: totalCorrect,
    prescientVotes: prescientVotes.slice(0, 50),
    categoryBreakdown,
    tier,
    tierColor: color,
    tierLabel: label,
    insight,
  }

  return NextResponse.json(result)
}
