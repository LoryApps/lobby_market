import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MandateClass =
  | 'decisive'    // ≥ 85% FOR — overwhelming consensus
  | 'strong'      // 75–84% FOR — law threshold met
  | 'building'    // 60–74% FOR — moving toward mandate
  | 'contested'   // 40–59% FOR — genuinely split
  | 'opposition'  // 25–39% FOR — lean against
  | 'rejection'   // < 25% FOR — strong rejection

export interface ComparableTopic {
  id: string
  statement: string
  status: string
  blue_pct: number
  total_votes: number
  mandate_class: MandateClass
}

export interface DailyBucket {
  date: string        // YYYY-MM-DD
  for_votes: number
  against_votes: number
  running_for_pct: number
}

export interface MandateResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
    voting_ends_at: string | null
    age_days: number
  }
  mandate: {
    class: MandateClass
    label: string
    description: string
    // Votes needed to reach 75% threshold (positive = need more FOR, negative = already there)
    for_votes_needed: number
    // How far from the law threshold in percentage points
    distance_to_law: number
    // How far from rejection threshold in percentage points
    distance_to_rejection: number
    // Estimated total votes needed at current trajectory if below threshold
    projected_total_needed: number | null
  }
  momentum: {
    votes_last_7d: number
    votes_last_30d: number
    for_pct_last_7d: number | null   // FOR% among recent votes only
    direction: 'gaining' | 'losing' | 'stable' | 'insufficient_data'
    daily_vote_rate: number          // avg votes/day (all-time)
    recent_daily_rate: number        // avg votes/day (last 30 days)
    // Estimated days to reach 75% threshold (null if already there or trending wrong way)
    days_to_threshold: number | null
  }
  trend: DailyBucket[]              // last 30 days of daily vote buckets
  comparable_topics: ComparableTopic[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMandateClass(forPct: number): MandateClass {
  if (forPct >= 85) return 'decisive'
  if (forPct >= 75) return 'strong'
  if (forPct >= 60) return 'building'
  if (forPct >= 40) return 'contested'
  if (forPct >= 25) return 'opposition'
  return 'rejection'
}

function getMandateLabel(cls: MandateClass): string {
  switch (cls) {
    case 'decisive': return 'Decisive Mandate'
    case 'strong': return 'Strong Mandate'
    case 'building': return 'Building Mandate'
    case 'contested': return 'Contested'
    case 'opposition': return 'Opposition Majority'
    case 'rejection': return 'Strong Rejection'
  }
}

function getMandateDescription(cls: MandateClass, forPct: number): string {
  switch (cls) {
    case 'decisive':
      return `${Math.round(forPct)}% of the community supports this — an overwhelming, near-unanimous mandate that leaves little room for doubt.`
    case 'strong':
      return `${Math.round(forPct)}% FOR has crossed the law threshold. The community has spoken with a clear majority. This topic is on the path to becoming law.`
    case 'building':
      return `${Math.round(forPct)}% FOR shows growing support but hasn't yet cleared the 75% law threshold. The mandate is building — more voices needed.`
    case 'contested':
      return `${Math.round(forPct)}% FOR — the community is genuinely divided. Neither side has established a clear mandate. This debate is still very much alive.`
    case 'opposition':
      return `${Math.round(forPct)}% FOR means the community leans against this proposal. The opposition holds the current majority.`
    case 'rejection':
      return `Only ${Math.round(forPct)}% FOR — the community has delivered a strong rejection. This proposal faces overwhelming opposition.`
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const topicId = params.id
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })
  }

  const supabase = await createClient()

  // ── Topic basics ──────────────────────────────────────────────────────────
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at, voting_ends_at')
    .eq('id', topicId)
    .maybeSingle()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const forPct = topic.blue_pct ?? 50
  const totalVotes = topic.total_votes ?? 0
  const ageDays = Math.max(
    1,
    Math.floor((Date.now() - new Date(topic.created_at).getTime()) / 86_400_000)
  )

  // ── Vote time-series (last 30 days) ───────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()

  const { data: recentVotes } = await supabase
    .from('votes')
    .select('side, created_at')
    .eq('topic_id', topicId)
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: true })
    .limit(2000)

  const votes30 = recentVotes ?? []
  const votes7 = votes30.filter((v) => v.created_at >= sevenDaysAgo)

  // Build daily buckets for last 30 days
  const dayMap = new Map<string, { for: number; against: number }>()
  for (const v of votes30) {
    const day = v.created_at.slice(0, 10)
    const bucket = dayMap.get(day) ?? { for: 0, against: 0 }
    if (v.side === 'blue') bucket.for++
    else bucket.against++
    dayMap.set(day, bucket)
  }

  // Compute running FOR% across the 30-day window
  // We need the cumulative state BEFORE the 30-day window to anchor the running %
  const forVotesBefore = Math.round((forPct / 100) * totalVotes) - votes30.filter(v => v.side === 'blue').length
  const againstVotesBefore = totalVotes - Math.round((forPct / 100) * totalVotes) - votes30.filter(v => v.side !== 'blue').length
  let runningFor = Math.max(0, forVotesBefore)
  let runningTotal = Math.max(0, forVotesBefore + againstVotesBefore)

  const sortedDays = Array.from(dayMap.keys()).sort()
  const trend: DailyBucket[] = sortedDays.map((date) => {
    const b = dayMap.get(date)!
    runningFor += b.for
    runningTotal += b.for + b.against
    return {
      date,
      for_votes: b.for,
      against_votes: b.against,
      running_for_pct: runningTotal > 0 ? (runningFor / runningTotal) * 100 : 50,
    }
  })

  // ── Momentum calculations ─────────────────────────────────────────────────
  const recentForPct =
    votes7.length >= 5
      ? (votes7.filter((v) => v.side === 'blue').length / votes7.length) * 100
      : null

  let direction: MandateResponse['momentum']['direction'] = 'insufficient_data'
  if (recentForPct !== null) {
    const diff = recentForPct - forPct
    if (diff > 3) direction = 'gaining'
    else if (diff < -3) direction = 'losing'
    else direction = 'stable'
  }

  const dailyVoteRate = totalVotes / ageDays
  const recentDailyRate = votes30.length / 30

  // Project days to 75% threshold
  const LAW_THRESHOLD = 75
  let daysToThreshold: number | null = null
  if (forPct < LAW_THRESHOLD && recentForPct !== null && recentForPct > forPct) {
    // Current: forVotesTotal = round(forPct/100 * totalVotes)
    // Need: forVotesNeeded such that forVotesNeeded/(totalVotes + X) = 0.75
    // At current recentForPct, each new vote adds recentForPct/100 to FOR
    // forVotesTotal + recentForPct/100 * X = 0.75 * (totalVotes + X)
    // X * (recentForPct/100 - 0.75) = 0.75 * totalVotes - forVotesTotal
    const forVotesTotal = Math.round((forPct / 100) * totalVotes)
    const numerator = 0.75 * totalVotes - forVotesTotal
    const denominator = recentForPct / 100 - 0.75
    if (denominator > 0 && recentDailyRate > 0) {
      const additionalVotesNeeded = numerator / denominator
      daysToThreshold = Math.ceil(additionalVotesNeeded / recentDailyRate)
    }
  }

  // ── Mandate calculations ──────────────────────────────────────────────────
  const mandateClass = getMandateClass(forPct)
  const forVotesTotal = Math.round((forPct / 100) * totalVotes)
  // Votes needed: if we have T total votes and F for-votes, to reach 75%:
  // (F + X) / (T + X) = 0.75 → X = (0.75T - F) / (1 - 0.75) = (0.75T - F) / 0.25
  // But this assumes all new votes are FOR. More useful: net FOR votes still needed
  // assuming balanced incoming votes:
  const forVotesNeeded = forPct >= LAW_THRESHOLD
    ? 0
    : Math.max(0, Math.ceil((LAW_THRESHOLD * totalVotes / 100) - forVotesTotal))

  // Projected total votes needed at current rate to reach 75%
  let projectedTotalNeeded: number | null = null
  if (forPct < LAW_THRESHOLD && recentForPct !== null && recentForPct > 0) {
    const f = recentForPct / 100
    const T = totalVotes
    const F = forVotesTotal
    // X additional votes where forRate=f: F + f*X = 0.75*(T + X)
    // X(f - 0.75) = 0.75T - F → only valid if f > 0.75
    if (f > 0.75) {
      projectedTotalNeeded = Math.ceil(T + (0.75 * T - F) / (f - 0.75))
    }
  }

  // ── Comparable topics ─────────────────────────────────────────────────────
  const { data: rawComparables } = await supabase
    .from('topics')
    .select('id, statement, status, blue_pct, total_votes')
    .eq('category', topic.category ?? 'Politics')
    .neq('id', topicId)
    .gte('total_votes', 5)
    .order('total_votes', { ascending: false })
    .limit(5)

  const comparable_topics: ComparableTopic[] = (rawComparables ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    status: t.status,
    blue_pct: t.blue_pct ?? 50,
    total_votes: t.total_votes ?? 0,
    mandate_class: getMandateClass(t.blue_pct ?? 50),
  }))

  // ── Response ──────────────────────────────────────────────────────────────
  const response: MandateResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: forPct,
      total_votes: totalVotes,
      created_at: topic.created_at,
      voting_ends_at: topic.voting_ends_at,
      age_days: ageDays,
    },
    mandate: {
      class: mandateClass,
      label: getMandateLabel(mandateClass),
      description: getMandateDescription(mandateClass, forPct),
      for_votes_needed: forVotesNeeded,
      distance_to_law: Math.max(0, LAW_THRESHOLD - forPct),
      distance_to_rejection: Math.max(0, forPct - 25),
      projected_total_needed: projectedTotalNeeded,
    },
    momentum: {
      votes_last_7d: votes7.length,
      votes_last_30d: votes30.length,
      for_pct_last_7d: recentForPct !== null ? Math.round(recentForPct * 10) / 10 : null,
      direction,
      daily_vote_rate: Math.round(dailyVoteRate * 10) / 10,
      recent_daily_rate: Math.round(recentDailyRate * 10) / 10,
      days_to_threshold: daysToThreshold,
    },
    trend,
    comparable_topics,
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
    },
  })
}
