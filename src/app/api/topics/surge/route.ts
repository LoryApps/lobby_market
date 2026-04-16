import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SurgeTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  support_count: number
  activation_threshold: number
  voting_ends_at: string | null
  feed_score: number
  scope: string | null
  created_at: string
}

export interface SurgeResponse {
  nearActivation: SurgeTopic[]
  finalCountdown: SurgeTopic[]
  highVelocity: SurgeTopic[]
}

const TOPIC_COLS =
  'id, statement, category, status, blue_pct, total_votes, support_count, activation_threshold, voting_ends_at, feed_score, scope, created_at'

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const nowIso = now.toISOString()

  const [nearRes, countdownRes, velocityRes] = await Promise.all([
    // 1. Near-activation: proposed topics that have reached ≥60% of their support threshold
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .eq('status', 'proposed')
      .gt('support_count', 0)
      // activation_threshold is typically 500; filter client-side for ratio
      .order('support_count', { ascending: false })
      .limit(50),

    // 2. Final countdown: voting topics whose deadline is within the next 24 hours
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .eq('status', 'voting')
      .gt('voting_ends_at', nowIso)
      .lte('voting_ends_at', in24h)
      .order('voting_ends_at', { ascending: true })
      .limit(12),

    // 3. High velocity: active/voting topics ranked by feed_score (recency × votes)
    supabase
      .from('topics')
      .select(TOPIC_COLS)
      .in('status', ['active', 'voting'])
      .gt('total_votes', 0)
      .order('feed_score', { ascending: false })
      .limit(20),
  ])

  // Filter near-activation to those ≥60% of threshold
  const nearActivation: SurgeTopic[] = (
    (nearRes.data as SurgeTopic[] | null) ?? []
  )
    .filter(
      (t) =>
        t.activation_threshold > 0 &&
        t.support_count / t.activation_threshold >= 0.6
    )
    .sort(
      (a, b) =>
        b.support_count / b.activation_threshold -
        a.support_count / a.activation_threshold
    )
    .slice(0, 8)

  const finalCountdown: SurgeTopic[] =
    (countdownRes.data as SurgeTopic[] | null) ?? []

  // For high-velocity, exclude anything already in finalCountdown
  const countdownIds = new Set(finalCountdown.map((t) => t.id))
  const highVelocity: SurgeTopic[] = (
    (velocityRes.data as SurgeTopic[] | null) ?? []
  )
    .filter((t) => !countdownIds.has(t.id))
    .slice(0, 8)

  return NextResponse.json({
    nearActivation,
    finalCountdown,
    highVelocity,
  } satisfies SurgeResponse)
}
