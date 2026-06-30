import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForecastSignal {
  id: string
  label: string
  description: string
  raw_value: number
  score: number     // contribution to probability, positive or negative
  direction: 'positive' | 'negative' | 'neutral'
}

export interface SimilarResolved {
  id: string
  statement: string
  category: string | null
  final_status: 'law' | 'failed'
  blue_pct: number
  total_votes: number
}

export interface ForecastResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
    voting_ends_at: string | null
  }
  law_probability: number
  confidence: 'low' | 'medium' | 'high'
  signals: ForecastSignal[]
  category_base_rate: number | null
  category_law_count: number
  category_fail_count: number
  similar_resolved: SimilarResolved[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id } = params

  // 1. Fetch the topic
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at, voting_ends_at')
    .eq('id', id)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // 2. Already resolved — probability is certain
  if (topic.status === 'law') {
    const response: ForecastResponse = {
      topic,
      law_probability: 100,
      confidence: 'high',
      signals: [
        {
          id: 'resolved_law',
          label: 'Established as law',
          description: 'This topic reached the 67% threshold and was enshrined as law.',
          raw_value: 100,
          score: 100,
          direction: 'positive',
        },
      ],
      category_base_rate: null,
      category_law_count: 0,
      category_fail_count: 0,
      similar_resolved: [],
    }
    return NextResponse.json(response)
  }

  if (topic.status === 'failed') {
    const response: ForecastResponse = {
      topic,
      law_probability: 0,
      confidence: 'high',
      signals: [
        {
          id: 'resolved_failed',
          label: 'Vote failed',
          description: 'This topic did not reach the 67% consensus threshold.',
          raw_value: 0,
          score: -100,
          direction: 'negative',
        },
      ],
      category_base_rate: null,
      category_law_count: 0,
      category_fail_count: 0,
      similar_resolved: [],
    }
    return NextResponse.json(response)
  }

  // 3. Fetch category resolution stats (how many in this category became law vs failed)
  const categoryFilter = topic.category
  const [lawCountRes, failCountRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'law')
      .eq('category', categoryFilter ?? ''),
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .eq('category', categoryFilter ?? ''),
  ])

  const categoryLawCount = lawCountRes.count ?? 0
  const categoryFailCount = failCountRes.count ?? 0
  const categoryTotal = categoryLawCount + categoryFailCount
  const categoryBaseRate = categoryTotal > 0
    ? Math.round((categoryLawCount / categoryTotal) * 100)
    : null

  // 4. Fetch similar resolved topics (same category, close blue_pct)
  const pct = topic.blue_pct ?? 50
  const similarRes = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['law', 'failed'])
    .eq('category', categoryFilter ?? '')
    .gte('blue_pct', Math.max(0, pct - 12))
    .lte('blue_pct', Math.min(100, pct + 12))
    .order('total_votes', { ascending: false })
    .limit(6)

  const similarResolved: SimilarResolved[] = (similarRes.data ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category,
    final_status: t.status as 'law' | 'failed',
    blue_pct: t.blue_pct,
    total_votes: t.total_votes,
  }))

  // 5. Compute signals ────────────────────────────────────────────────────────

  const signals: ForecastSignal[] = []

  // Signal: Vote proximity to 67% threshold
  const LAW_THRESHOLD = 67
  const distanceToLaw = pct - LAW_THRESHOLD
  const voteProximityScore = Math.round(sigmoid(distanceToLaw / 6) * 40 - 20)
  signals.push({
    id: 'vote_proximity',
    label: `${pct}% FOR (threshold: ${LAW_THRESHOLD}%)`,
    description:
      pct >= LAW_THRESHOLD
        ? `Currently above the ${LAW_THRESHOLD}% consensus threshold needed to become law.`
        : pct >= 60
        ? `Close to the ${LAW_THRESHOLD}% threshold — a modest shift could push this over.`
        : pct >= 50
        ? `Majority support but ${LAW_THRESHOLD - pct}pp below the law threshold.`
        : `Currently in minority — needs ${LAW_THRESHOLD - pct}pp gain to reach consensus.`,
    raw_value: pct,
    score: voteProximityScore,
    direction: pct >= LAW_THRESHOLD ? 'positive' : pct >= 58 ? 'neutral' : 'negative',
  })

  // Signal: Category base rate
  if (categoryBaseRate !== null && categoryTotal >= 3) {
    const baseRateDeviation = categoryBaseRate - 30
    const baseRateScore = Math.round(baseRateDeviation * 0.3)
    signals.push({
      id: 'category_base_rate',
      label: `${categoryBaseRate}% of ${topic.category} topics become law`,
      description:
        categoryBaseRate >= 40
          ? `${topic.category} debates have a strong track record — ${categoryBaseRate}% historically become law.`
          : categoryBaseRate >= 25
          ? `${topic.category} has a moderate success rate — about 1 in ${Math.round(100 / categoryBaseRate)} debates become law.`
          : `${topic.category} debates rarely become law — only ${categoryBaseRate}% have so far.`,
      raw_value: categoryBaseRate,
      score: baseRateScore,
      direction: categoryBaseRate >= 35 ? 'positive' : categoryBaseRate >= 20 ? 'neutral' : 'negative',
    })
  }

  // Signal: Engagement depth
  const votes = topic.total_votes ?? 0
  let engagementScore: number
  let engagementLabel: string
  let engagementDesc: string
  let engagementDir: 'positive' | 'negative' | 'neutral'

  if (votes >= 500) {
    engagementScore = 8
    engagementLabel = `${votes.toLocaleString()} votes — high engagement`
    engagementDesc = 'High vote count signals broad citizen interest, making this debate more likely to reach voting phase.'
    engagementDir = 'positive'
  } else if (votes >= 100) {
    engagementScore = 4
    engagementLabel = `${votes.toLocaleString()} votes — growing`
    engagementDesc = 'Moderate engagement — enough traction to stay active.'
    engagementDir = 'neutral'
  } else if (votes >= 20) {
    engagementScore = 0
    engagementLabel = `${votes.toLocaleString()} votes — early stage`
    engagementDesc = 'Still early — vote counts are too low to establish a reliable trend.'
    engagementDir = 'neutral'
  } else {
    engagementScore = -5
    engagementLabel = `${votes.toLocaleString()} votes — minimal engagement`
    engagementDesc = 'Very few votes — the topic may not activate without a surge in support.'
    engagementDir = 'negative'
  }
  signals.push({
    id: 'engagement',
    label: engagementLabel,
    description: engagementDesc,
    raw_value: votes,
    score: engagementScore,
    direction: engagementDir,
  })

  // Signal: Current status
  let statusScore: number
  let statusLabel: string
  let statusDesc: string
  let statusDir: 'positive' | 'negative' | 'neutral'

  switch (topic.status) {
    case 'voting':
      statusScore = 12
      statusLabel = 'In voting phase'
      statusDesc = 'This debate has already reached the voting phase — a significant milestone that most topics never achieve.'
      statusDir = 'positive'
      break
    case 'active':
      statusScore = 3
      statusLabel = 'Active debate'
      statusDesc = 'This topic is actively gathering votes and could enter the voting phase with sustained support.'
      statusDir = 'neutral'
      break
    default:
      statusScore = -8
      statusLabel = 'Proposed — awaiting activation'
      statusDesc = 'Most proposed topics never reach active status — activation requires community support surpassing the threshold.'
      statusDir = 'negative'
  }
  signals.push({
    id: 'status',
    label: statusLabel,
    description: statusDesc,
    raw_value: 0,
    score: statusScore,
    direction: statusDir,
  })

  // Signal: Time in system
  const ageMs = Date.now() - new Date(topic.created_at).getTime()
  const ageDays = Math.floor(ageMs / 86_400_000)
  let ageScore: number
  let ageLabel: string
  let ageDesc: string
  let ageDir: 'positive' | 'negative' | 'neutral'

  if (topic.status === 'voting' && topic.voting_ends_at) {
    const remaining = new Date(topic.voting_ends_at).getTime() - Date.now()
    const remainHours = Math.max(0, Math.floor(remaining / 3_600_000))
    ageScore = remainHours < 24 ? 10 : 5
    ageLabel = remainHours > 0 ? `${remainHours}h left in voting` : 'Voting window closing'
    ageDesc = 'The voting window is open — the outcome will be determined soon.'
    ageDir = 'positive'
  } else if (ageDays < 3) {
    ageScore = 2
    ageLabel = `${ageDays}d old — new topic`
    ageDesc = 'Very recent topic — most votes are still to come.'
    ageDir = 'neutral'
  } else if (ageDays < 14) {
    ageScore = 1
    ageLabel = `${ageDays}d old — gaining traction`
    ageDesc = 'Still relatively fresh — community awareness is still building.'
    ageDir = 'neutral'
  } else {
    ageScore = -3
    ageLabel = `${ageDays}d old — established debate`
    ageDesc = 'Older debates rarely see dramatic vote shifts without a triggering event.'
    ageDir = 'neutral'
  }
  signals.push({
    id: 'age',
    label: ageLabel,
    description: ageDesc,
    raw_value: ageDays,
    score: ageScore,
    direction: ageDir,
  })

  // 6. Compute final probability ──────────────────────────────────────────────

  const priorPct = categoryBaseRate ?? 25
  const signalDelta = signals.reduce((acc, s) => acc + s.score, 0)
  const rawProbability = priorPct + signalDelta

  const law_probability = clamp(Math.round(rawProbability), 2, 97)

  // 7. Confidence level ───────────────────────────────────────────────────────

  let confidence: 'low' | 'medium' | 'high'
  if (topic.status === 'voting') {
    confidence = 'high'
  } else if (votes >= 100 && categoryTotal >= 5) {
    confidence = 'medium'
  } else {
    confidence = 'low'
  }

  const response: ForecastResponse = {
    topic,
    law_probability,
    confidence,
    signals,
    category_base_rate: categoryBaseRate,
    category_law_count: categoryLawCount,
    category_fail_count: categoryFailCount,
    similar_resolved: similarResolved,
  }

  return NextResponse.json(response)
}
