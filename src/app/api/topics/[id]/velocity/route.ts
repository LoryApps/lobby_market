import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type LifecyclePhase =
  | 'ignition'
  | 'surge'
  | 'plateau'
  | 'fade'
  | 'dormant'
  | 'resolved'

export interface VelocityBucket {
  label: string           // e.g. "Day 1", "Day 3", "Week 2"
  votes: number
  arguments: number
  forVotes: number
  againstVotes: number
  netForPct: number       // running blue_pct at this point
  velocity: number        // votes in this bucket
  acceleration: number    // change from previous bucket (positive = speeding up)
}

export interface VelocityResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
  }
  buckets: VelocityBucket[]
  peakBucket: number | null     // index of highest-velocity bucket
  currentVelocity: number       // votes in most recent bucket
  peakVelocity: number          // highest vote count in any bucket
  velocityScore: number         // 0-100 (how fast the debate is moving now vs. its peak)
  accelerationScore: number     // -100 to +100 (negative = slowing, positive = speeding up)
  phase: LifecyclePhase
  phaseLabel: string
  phaseDescription: string
  daysActive: number
  avgVotesPerDay: number
  peakVotesPerDay: number
  totalArguments: number
  argToVoteRatio: number        // arguments per 100 votes
  engagementScore: number       // 0-100 composite of velocity + argument rate
  prediction: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectPhase(
  buckets: VelocityBucket[],
  status: string,
  daysActive: number,
): { phase: LifecyclePhase; label: string; description: string } {
  if (status === 'law' || status === 'failed') {
    return {
      phase: 'resolved',
      label: 'Resolved',
      description: 'This debate has concluded. The momentum has settled into history.',
    }
  }

  if (buckets.length < 2) {
    return {
      phase: 'ignition',
      label: 'Ignition',
      description: 'The debate has just sparked. Momentum is building from zero.',
    }
  }

  const recentBuckets = buckets.slice(-3)
  const olderBuckets = buckets.slice(0, -3)

  const recentAvg = recentBuckets.reduce((s, b) => s + b.votes, 0) / recentBuckets.length
  const olderAvg = olderBuckets.length
    ? olderBuckets.reduce((s, b) => s + b.votes, 0) / olderBuckets.length
    : 0

  const peakVotes = Math.max(...buckets.map((b) => b.votes))
  const recentToPeak = peakVotes > 0 ? recentAvg / peakVotes : 0

  if (recentAvg === 0 && daysActive > 7) {
    return {
      phase: 'dormant',
      label: 'Dormant',
      description: 'Activity has stalled. The debate needs a spark to reignite.',
    }
  }

  if (recentToPeak < 0.15 && daysActive > 3) {
    return {
      phase: 'fade',
      label: 'Fading',
      description: 'The debate is winding down. Peak engagement is behind it.',
    }
  }

  if (recentToPeak > 0.85) {
    return {
      phase: 'surge',
      label: 'Surging',
      description: 'This debate is at or near its peak velocity. High intensity now.',
    }
  }

  if (recentAvg > olderAvg * 1.3) {
    return {
      phase: 'surge',
      label: 'Accelerating',
      description: 'Momentum is building. Engagement is climbing toward its peak.',
    }
  }

  if (Math.abs(recentAvg - olderAvg) / Math.max(olderAvg, 1) < 0.2) {
    return {
      phase: 'plateau',
      label: 'Plateau',
      description: 'The debate has found a steady rhythm. Engagement is stable.',
    }
  }

  return {
    phase: 'ignition',
    label: 'Early Stage',
    description: 'The debate is still warming up. Momentum has not yet peaked.',
  }
}

function buildPrediction(
  phase: LifecyclePhase,
  accelerationScore: number,
  avgVotesPerDay: number,
  status: string,
): string {
  if (status === 'law') return 'This debate passed into law. Its velocity is now part of the historical record.'
  if (status === 'failed') return 'This debate failed to reach consensus. The final velocity was insufficient.'

  if (phase === 'dormant') return 'With near-zero activity, this debate needs a catalyst — a viral argument, a news event, or a coalition push — to restart.'
  if (phase === 'fade') {
    if (avgVotesPerDay < 5) return 'At the current rate, this debate will go dormant within days unless new arguments ignite fresh interest.'
    return 'Momentum is declining. Without a significant new argument or event, expect gradual slowdown.'
  }
  if (phase === 'surge') {
    return accelerationScore > 20
      ? 'This debate is in full surge. If momentum holds, it could reach its consensus threshold within days.'
      : 'Near peak velocity. Expect a plateau followed by gradual decline unless a catalyst sustains it.'
  }
  if (phase === 'plateau') return 'Steady engagement — the debate has found its cruising altitude. Likely to hold until a new argument or event shifts the balance.'
  if (phase === 'ignition') return 'Still in early ignition. Peak velocity typically arrives within the first week of a debate. Watch for it to surge.'

  return 'Trajectory is uncertain. Monitor for acceleration signals over the next 24–48 hours.'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()

    // 1. Topic metadata
    const { data: topic } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at')
      .eq('id', params.id)
      .maybeSingle()

    if (!topic) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const createdAt = new Date(topic.created_at)
    const now = new Date()
    const daysActive = Math.max((now.getTime() - createdAt.getTime()) / 86_400_000, 0.1)

    // 2. Votes bucketed by day
    const { data: voteRows } = await supabase
      .from('votes')
      .select('created_at, side')
      .eq('topic_id', params.id)
      .order('created_at', { ascending: true })

    // 3. Arguments bucketed by day
    const { data: argRows } = await supabase
      .from('arguments')
      .select('created_at')
      .eq('topic_id', params.id)
      .order('created_at', { ascending: true })

    const votes = voteRows ?? []
    const args = argRows ?? []

    // 4. Build time buckets (1 bucket per day for short debates, per week for long)
    const useWeekBuckets = daysActive > 28
    const totalBuckets = Math.ceil(daysActive / (useWeekBuckets ? 7 : 1))
    const maxBuckets = 30

    const bucketCount = Math.min(totalBuckets, maxBuckets)

    // Recompute bucket size based on capped count
    const actualBucketMs = (now.getTime() - createdAt.getTime()) / Math.max(bucketCount, 1)

    type BucketAcc = { votes: number; forVotes: number; againstVotes: number; arguments: number }
    const rawBuckets: BucketAcc[] = Array.from({ length: bucketCount }, () => ({
      votes: 0,
      forVotes: 0,
      againstVotes: 0,
      arguments: 0,
    }))

    for (const v of votes) {
      const t = new Date(v.created_at).getTime()
      const idx = Math.min(
        Math.floor((t - createdAt.getTime()) / actualBucketMs),
        bucketCount - 1,
      )
      if (idx >= 0) {
        rawBuckets[idx].votes++
        if (v.side === 'blue') rawBuckets[idx].forVotes++
        else rawBuckets[idx].againstVotes++
      }
    }

    for (const a of args) {
      const t = new Date(a.created_at).getTime()
      const idx = Math.min(
        Math.floor((t - createdAt.getTime()) / actualBucketMs),
        bucketCount - 1,
      )
      if (idx >= 0) rawBuckets[idx].arguments++
    }

    // 5. Build VelocityBuckets with running pct + acceleration
    let runningFor = 0
    let runningTotal = 0
    const buckets: VelocityBucket[] = rawBuckets.map((b, i) => {
      runningFor += b.forVotes
      runningTotal += b.votes

      const netForPct = runningTotal > 0 ? Math.round((runningFor / runningTotal) * 100) : 50

      const prevVelocity = i > 0 ? rawBuckets[i - 1].votes : 0
      const acceleration = prevVelocity > 0
        ? Math.round(((b.votes - prevVelocity) / prevVelocity) * 100)
        : b.votes > 0 ? 100 : 0

      const useWeeks = daysActive > 28
      const label = useWeeks
        ? `Wk ${i + 1}`
        : bucketCount <= 7
        ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
            new Date(createdAt.getTime() + i * actualBucketMs).getDay()
          ] ?? `D${i + 1}`
        : `D${i + 1}`

      return {
        label,
        votes: b.votes,
        arguments: b.arguments,
        forVotes: b.forVotes,
        againstVotes: b.againstVotes,
        netForPct,
        velocity: b.votes,
        acceleration,
      }
    })

    // 6. Derived metrics
    const peakVelocity = Math.max(...buckets.map((b) => b.velocity), 1)
    const peakBucketIdx = buckets.findIndex((b) => b.velocity === peakVelocity)
    const currentVelocity = buckets.at(-1)?.velocity ?? 0
    const velocityScore = Math.round((currentVelocity / peakVelocity) * 100)

    const lastAcc = buckets.at(-1)?.acceleration ?? 0
    const accelerationScore = Math.max(-100, Math.min(100, lastAcc))

    const avgVotesPerDay = votes.length / daysActive
    const peakVotesPerDay = (peakVelocity / actualBucketMs) * 86_400_000

    const { phase, label: phaseLabel, description: phaseDescription } = detectPhase(
      buckets,
      topic.status,
      daysActive,
    )

    const argToVoteRatio = votes.length > 0 ? Math.round((args.length / votes.length) * 100) : 0

    const engagementScore = Math.round(
      velocityScore * 0.5 + Math.min(argToVoteRatio, 50) * 1 + Math.min(daysActive * 2, 30),
    )

    const prediction = buildPrediction(phase, accelerationScore, avgVotesPerDay, topic.status)

    const response: VelocityResponse = {
      topic: {
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        blue_pct: topic.blue_pct ?? 50,
        total_votes: topic.total_votes ?? 0,
        created_at: topic.created_at,
      },
      buckets,
      peakBucket: peakBucketIdx >= 0 ? peakBucketIdx : null,
      currentVelocity,
      peakVelocity,
      velocityScore,
      accelerationScore,
      phase,
      phaseLabel,
      phaseDescription,
      daysActive: Math.round(daysActive),
      avgVotesPerDay: Math.round(avgVotesPerDay),
      peakVotesPerDay: Math.round(peakVotesPerDay),
      totalArguments: args.length,
      argToVoteRatio,
      engagementScore: Math.min(engagementScore, 100),
      prediction,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[/api/topics/[id]/velocity]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
