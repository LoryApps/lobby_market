import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface VoteTrendPoint {
  /** ISO date string, e.g. "2024-03-15" */
  date: string
  forPct: number
  totalVotes: number
}

export interface VoteTrendResponse {
  points: VoteTrendPoint[]
  totalVotes: number
  /** True when there are fewer than 2 data points (no trend to show) */
  hasEnoughData: boolean
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = params.id
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch all votes for this topic, ordered by creation time.
  // We intentionally avoid a GROUP BY aggregate here because Supabase
  // client doesn't expose date_trunc; instead we group client-side.
  // Limit to 5000 votes (plenty for trend purposes).
  const { data: votes, error } = await supabase
    .from('votes')
    .select('side, created_at')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })
    .limit(5000)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch votes' }, { status: 500 })
  }

  if (!votes || votes.length === 0) {
    return NextResponse.json({
      points: [],
      totalVotes: 0,
      hasEnoughData: false,
    } satisfies VoteTrendResponse)
  }

  // Group votes by calendar day (UTC date string YYYY-MM-DD)
  const byDay = new Map<string, { for: number; against: number }>()
  for (const vote of votes) {
    const day = vote.created_at.slice(0, 10) // "YYYY-MM-DD"
    const bucket = byDay.get(day) ?? { for: 0, against: 0 }
    if (vote.side === 'blue') {
      bucket.for++
    } else {
      bucket.against++
    }
    byDay.set(day, bucket)
  }

  // Build cumulative trend points
  const sortedDays = Array.from(byDay.keys()).sort()
  let runningFor = 0
  let runningTotal = 0

  const points: VoteTrendPoint[] = sortedDays.map((date) => {
    const day = byDay.get(date)!
    runningFor += day.for
    runningTotal += day.for + day.against
    return {
      date,
      forPct: runningTotal > 0 ? (runningFor / runningTotal) * 100 : 50,
      totalVotes: runningTotal,
    }
  })

  return NextResponse.json({
    points,
    totalVotes: runningTotal,
    hasEnoughData: points.length >= 2,
  } satisfies VoteTrendResponse, {
    headers: {
      // Cache for 5 minutes; revalidate up to 10 minutes stale
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
