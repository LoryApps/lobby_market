import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TippingPointTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  /** Percentage points away from the FOR consensus threshold */
  distance_to_for_threshold: number
  /** Percentage points away from the AGAINST rejection threshold */
  distance_to_against_threshold: number
  /** Estimated additional FOR votes needed to cross consensus */
  for_votes_needed: number
  /** Estimated additional AGAINST votes needed to cross rejection */
  against_votes_needed: number
  /** 'breaking_through' | 'about_to_fall' */
  zone: 'breaking_through' | 'about_to_fall'
  voting_ends_at: string | null
  created_at: string
}

export interface TippingPointResponse {
  breaking_through: TippingPointTopic[]
  about_to_fall: TippingPointTopic[]
  threshold_pct: number
  generated_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** FOR% ≥ this to be considered consensus / law. */
const FOR_CONSENSUS_THRESHOLD = 75
/** FOR% ≤ this to be considered rejected. */
const AGAINST_REJECTION_THRESHOLD = 25
/** "Breaking through" window: FOR% in [LOW, HIGH) means close to crossing FOR threshold. */
const BREAKING_THROUGH_LOW = 58
const BREAKING_THROUGH_HIGH = FOR_CONSENSUS_THRESHOLD
/** "About to fall" window: FOR% in (LOW, HIGH] means close to being rejected. */
const ABOUT_TO_FALL_LOW = AGAINST_REJECTION_THRESHOLD
const ABOUT_TO_FALL_HIGH = 42
/** Minimum votes to qualify */
const MIN_TOTAL_VOTES = 50
/** Max results per zone */
const MAX_PER_ZONE = 20

function votesNeededForPct(
  currentVotes: number,
  targetPct: number,
  currentForVotes: number,
): number {
  // We need (currentForVotes + x) / (currentVotes + x) = targetPct / 100
  // Solving: x = (targetPct * currentVotes - 100 * currentForVotes) / (100 - targetPct)
  const pct = targetPct / 100
  const numerator = pct * currentVotes - currentForVotes
  const denominator = 1 - pct
  if (denominator <= 0) return 0
  return Math.max(0, Math.ceil(numerator / denominator))
}

function votesNeededForAgainstPct(
  currentVotes: number,
  targetPct: number,
  currentAgainstVotes: number,
): number {
  // We need (currentAgainstVotes + x) / (currentVotes + x) ≥ (100 - targetPct) / 100
  // i.e. FOR% drops to targetPct when enough AGAINST votes arrive
  const againstTarget = (100 - targetPct) / 100
  const numerator = againstTarget * currentVotes - currentAgainstVotes
  const denominator = 1 - againstTarget
  if (denominator <= 0) return 0
  return Math.max(0, Math.ceil(numerator / denominator))
}

export async function GET() {
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, scope, blue_pct, total_votes, blue_votes, red_votes, voting_ends_at, created_at')
    .in('status', ['active', 'voting'])
    .gte('total_votes', MIN_TOTAL_VOTES)
    .order('total_votes', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: 'topics_fetch' }, { status: 500 })
  }

  const topics = rows ?? []

  const breakingThrough: TippingPointTopic[] = []
  const aboutToFall: TippingPointTopic[] = []

  for (const t of topics) {
    const forPct = t.blue_pct ?? 50
    const totalVotes = t.total_votes ?? 0
    const forVotes = t.blue_votes ?? Math.round((forPct / 100) * totalVotes)
    const againstVotes = t.red_votes ?? (totalVotes - forVotes)

    if (forPct >= BREAKING_THROUGH_LOW && forPct < BREAKING_THROUGH_HIGH) {
      const distFor = FOR_CONSENSUS_THRESHOLD - forPct
      const forNeeded = votesNeededForPct(totalVotes, FOR_CONSENSUS_THRESHOLD, forVotes)
      breakingThrough.push({
        id: t.id,
        statement: t.statement,
        category: t.category ?? null,
        status: t.status,
        scope: t.scope ?? null,
        blue_pct: forPct,
        total_votes: totalVotes,
        distance_to_for_threshold: Math.round(distFor * 10) / 10,
        distance_to_against_threshold: Math.round((forPct - AGAINST_REJECTION_THRESHOLD) * 10) / 10,
        for_votes_needed: forNeeded,
        against_votes_needed: 0,
        zone: 'breaking_through',
        voting_ends_at: t.voting_ends_at ?? null,
        created_at: t.created_at,
      })
    } else if (forPct > ABOUT_TO_FALL_LOW && forPct <= ABOUT_TO_FALL_HIGH) {
      const distAgainst = forPct - AGAINST_REJECTION_THRESHOLD
      const againstNeeded = votesNeededForAgainstPct(totalVotes, AGAINST_REJECTION_THRESHOLD, againstVotes)
      aboutToFall.push({
        id: t.id,
        statement: t.statement,
        category: t.category ?? null,
        status: t.status,
        scope: t.scope ?? null,
        blue_pct: forPct,
        total_votes: totalVotes,
        distance_to_for_threshold: Math.round((FOR_CONSENSUS_THRESHOLD - forPct) * 10) / 10,
        distance_to_against_threshold: Math.round(distAgainst * 10) / 10,
        for_votes_needed: 0,
        against_votes_needed: againstNeeded,
        zone: 'about_to_fall',
        voting_ends_at: t.voting_ends_at ?? null,
        created_at: t.created_at,
      })
    }
  }

  // Sort each zone by distance to threshold (closest first)
  breakingThrough.sort((a, b) => a.distance_to_for_threshold - b.distance_to_for_threshold)
  aboutToFall.sort((a, b) => a.distance_to_against_threshold - b.distance_to_against_threshold)

  return NextResponse.json({
    breaking_through: breakingThrough.slice(0, MAX_PER_ZONE),
    about_to_fall: aboutToFall.slice(0, MAX_PER_ZONE),
    threshold_pct: FOR_CONSENSUS_THRESHOLD,
    generated_at: new Date().toISOString(),
  } satisfies TippingPointResponse)
}
