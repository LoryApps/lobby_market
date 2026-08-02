import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type JourneyPattern =
  | 'blitz'        // reached consensus very fast (< 3 days)
  | 'surge'        // rapid climb then resolution
  | 'grind'        // slow steady accumulation
  | 'controversy'  // high back-and-forth before settling
  | 'landslide'    // overwhelming support from the start

export interface LawVelocityBucket {
  label: string
  votes: number
  arguments: number
  forVotes: number
  againstVotes: number
  netForPct: number
  velocity: number
  acceleration: number
}

export interface LawVelocityResponse {
  law: {
    id: string
    statement: string
    category: string | null
    topic_id: string
    blue_pct: number
    total_votes: number
    established_at: string | null
  }
  buckets: LawVelocityBucket[]
  peakBucket: number | null
  currentVelocity: number
  peakVelocity: number
  velocityScore: number
  accelerationScore: number
  journeyPattern: JourneyPattern
  journeyLabel: string
  journeyDescription: string
  daysToResolve: number
  avgVotesPerDay: number
  peakVotesPerDay: number
  totalArguments: number
  argToVoteRatio: number
  engagementScore: number
  insight: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectJourneyPattern(
  buckets: LawVelocityBucket[],
  daysToResolve: number,
  bluePct: number,
): { pattern: JourneyPattern; label: string; description: string } {
  if (daysToResolve <= 3) {
    return {
      pattern: 'blitz',
      label: 'Blitz Consensus',
      description: 'This law was forged at lightning speed — the community converged in under 72 hours. A rare, high-conviction outcome.',
    }
  }

  if (bluePct >= 80) {
    return {
      pattern: 'landslide',
      label: 'Landslide March',
      description: 'Overwhelming consensus drove this law from the start. Opposition was minimal — the debate felt more like a referendum.',
    }
  }

  if (buckets.length < 2) {
    return {
      pattern: 'grind',
      label: 'Steady Grind',
      description: 'This law accumulated votes gradually, building consensus through sustained engagement rather than a dramatic surge.',
    }
  }

  const peakVotes = Math.max(...buckets.map((b) => b.votes))
  const peakIdx = buckets.findIndex((b) => b.votes === peakVotes)
  const peakPosition = peakIdx / Math.max(buckets.length - 1, 1)

  // Check for controversy: high argument-to-vote ratio
  const totalArgs = buckets.reduce((s, b) => s + b.arguments, 0)
  const totalVotes = buckets.reduce((s, b) => s + b.votes, 0)
  const argRatio = totalVotes > 0 ? totalArgs / totalVotes : 0

  if (argRatio > 0.15 && bluePct < 70) {
    return {
      pattern: 'controversy',
      label: 'Contested Path',
      description: 'This law faced significant debate before passing. High argument activity relative to votes signals genuine deliberation.',
    }
  }

  if (peakPosition < 0.33) {
    return {
      pattern: 'surge',
      label: 'Early Surge',
      description: 'The debate peaked early and carried momentum all the way to resolution — a surge-driven consensus that never looked back.',
    }
  }

  return {
    pattern: 'grind',
    label: 'Steady Grind',
    description: 'This law accumulated votes gradually, building consensus through sustained engagement rather than a dramatic spike.',
  }
}

function buildInsight(
  pattern: JourneyPattern,
  daysToResolve: number,
  peakVotesPerDay: number,
  argToVoteRatio: number,
): string {
  const pace = peakVotesPerDay > 50
    ? 'a high-intensity peak'
    : peakVotesPerDay > 10
    ? 'a moderate engagement peak'
    : 'a quiet, low-key peak'

  if (pattern === 'blitz') {
    return `Blitz laws like this one tend to reflect strong pre-existing consensus rather than debate-driven persuasion. The community arrived at the table already aligned.`
  }
  if (pattern === 'landslide') {
    return `With ${argToVoteRatio}% argument-to-vote ratio and overwhelming support, this law benefited from clear framing and minimal credible opposition.`
  }
  if (pattern === 'controversy') {
    return `The debate generated ${argToVoteRatio}% arguments-per-vote — unusually high — suggesting this law was genuinely contested before the community reached its verdict across ${daysToResolve} days.`
  }
  if (pattern === 'surge') {
    return `An early surge carried this law to resolution. The debate hit ${pace} in its opening phase and coasted to consensus from there.`
  }
  return `Over ${daysToResolve} days, this law accumulated its mandate through ${pace} and steady argument engagement at a ${argToVoteRatio}% argument-to-vote ratio.`
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()

    // 1. Law metadata
    const { data: law } = await supabase
      .from('laws')
      .select('id, statement, category, topic_id, blue_pct, total_votes, established_at, created_at')
      .eq('id', params.id)
      .maybeSingle()

    if (!law) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const topicId = law.topic_id

    // Use topic created_at as debate start, established_at as end
    const { data: topic } = await supabase
      .from('topics')
      .select('created_at')
      .eq('id', topicId)
      .maybeSingle()

    const debateStart = topic?.created_at ? new Date(topic.created_at) : new Date(law.created_at ?? Date.now())
    const debateEnd = law.established_at ? new Date(law.established_at) : new Date()
    const daysToResolve = Math.max((debateEnd.getTime() - debateStart.getTime()) / 86_400_000, 0.1)

    // 2. Votes by topic_id
    const { data: voteRows } = await supabase
      .from('votes')
      .select('created_at, side')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })

    // 3. Arguments by topic_id
    const { data: argRows } = await supabase
      .from('arguments')
      .select('created_at')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })

    const votes = voteRows ?? []
    const args = argRows ?? []

    // 4. Build time buckets
    const useWeekBuckets = daysToResolve > 28
    const totalBuckets = Math.ceil(daysToResolve / (useWeekBuckets ? 7 : 1))
    const bucketCount = Math.min(Math.max(totalBuckets, 1), 30)
    const actualBucketMs = (debateEnd.getTime() - debateStart.getTime()) / bucketCount

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
        Math.floor((t - debateStart.getTime()) / actualBucketMs),
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
        Math.floor((t - debateStart.getTime()) / actualBucketMs),
        bucketCount - 1,
      )
      if (idx >= 0) rawBuckets[idx].arguments++
    }

    // 5. Build VelocityBuckets with running pct + acceleration
    let runningFor = 0
    let runningTotal = 0
    const buckets: LawVelocityBucket[] = rawBuckets.map((b, i) => {
      runningFor += b.forVotes
      runningTotal += b.votes

      const netForPct = runningTotal > 0 ? Math.round((runningFor / runningTotal) * 100) : 50

      const prevVelocity = i > 0 ? rawBuckets[i - 1].votes : 0
      const acceleration = prevVelocity > 0
        ? Math.round(((b.votes - prevVelocity) / prevVelocity) * 100)
        : b.votes > 0 ? 100 : 0

      const label = useWeekBuckets
        ? `Wk ${i + 1}`
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

    const avgVotesPerDay = votes.length / daysToResolve
    const peakVotesPerDay = actualBucketMs > 0
      ? Math.round((peakVelocity / actualBucketMs) * 86_400_000)
      : peakVelocity

    const argToVoteRatio = votes.length > 0 ? Math.round((args.length / votes.length) * 100) : 0

    const engagementScore = Math.min(
      Math.round(
        velocityScore * 0.5 +
        Math.min(argToVoteRatio, 50) * 1 +
        Math.min(daysToResolve * 2, 30),
      ),
      100,
    )

    const { pattern: journeyPattern, label: journeyLabel, description: journeyDescription } =
      detectJourneyPattern(buckets, daysToResolve, law.blue_pct ?? 50)

    const insight = buildInsight(journeyPattern, Math.round(daysToResolve), peakVotesPerDay, argToVoteRatio)

    const response: LawVelocityResponse = {
      law: {
        id: law.id,
        statement: law.statement,
        category: law.category,
        topic_id: law.topic_id,
        blue_pct: law.blue_pct ?? 50,
        total_votes: law.total_votes ?? 0,
        established_at: law.established_at,
      },
      buckets,
      peakBucket: peakBucketIdx >= 0 ? peakBucketIdx : null,
      currentVelocity,
      peakVelocity,
      velocityScore,
      accelerationScore,
      journeyPattern,
      journeyLabel,
      journeyDescription,
      daysToResolve: Math.round(daysToResolve),
      avgVotesPerDay: Math.round(avgVotesPerDay),
      peakVotesPerDay,
      totalArguments: args.length,
      argToVoteRatio,
      engagementScore,
      insight,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[/api/laws/[id]/velocity]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
