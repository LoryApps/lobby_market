import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PulseHourBucket {
  hour: string   // ISO timestamp truncated to hour
  total: number
  blue: number
  red: number
}

export type PulseMomentum = 'surging' | 'active' | 'cooling' | 'dormant'

export interface PulseData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  buckets: PulseHourBucket[]    // last 24h, one bucket per hour
  current_hour_votes: number    // votes in the current (partial) hour
  prev_hour_votes: number       // votes in the previous full hour
  votes_24h: number             // total votes in last 24 hours
  votes_1h: number              // votes in the last 60 minutes
  momentum: PulseMomentum
  velocity_change_pct: number | null  // % change vs prior hour (null if no prior data)
  peak_hour: string | null      // ISO hour string with most votes ever
  peak_count: number
  for_24h: number               // FOR votes in last 24h
  against_24h: number           // AGAINST votes in last 24h
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function classifyMomentum(votes1h: number, prevHour: number): PulseMomentum {
  if (votes1h === 0 && prevHour === 0) return 'dormant'
  if (votes1h === 0) return 'cooling'
  if (votes1h > prevHour * 1.5 || (prevHour === 0 && votes1h >= 3)) return 'surging'
  if (votes1h >= 1) return 'active'
  return 'cooling'
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    // Fetch topic metadata
    const { data: topic, error: topicErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', id)
      .maybeSingle()

    if (topicErr || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    const now = new Date()
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const since1h = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const since2h = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()

    // Fetch raw vote rows for the last 24h (created_at + side only for bucketing)
    const { data: rawVotes } = await supabase
      .from('votes')
      .select('created_at, side')
      .eq('topic_id', id)
      .gte('created_at', since24h)
      .order('created_at', { ascending: true })

    const votes = rawVotes ?? []

    // Build hourly buckets for last 24h
    const bucketMap = new Map<string, { total: number; blue: number; red: number }>()
    for (let i = 23; i >= 0; i--) {
      const bucketTime = new Date(now.getTime() - i * 60 * 60 * 1000)
      bucketTime.setMinutes(0, 0, 0)
      const key = bucketTime.toISOString()
      bucketMap.set(key, { total: 0, blue: 0, red: 0 })
    }

    for (const v of votes) {
      const d = new Date(v.created_at)
      d.setMinutes(0, 0, 0)
      const key = d.toISOString()
      const bucket = bucketMap.get(key) ?? { total: 0, blue: 0, red: 0 }
      bucket.total++
      if (v.side === 'blue') bucket.blue++
      else bucket.red++
      bucketMap.set(key, bucket)
    }

    const buckets: PulseHourBucket[] = Array.from(bucketMap.entries()).map(
      ([hour, counts]) => ({ hour, ...counts })
    )

    // Velocity metrics
    const votes1h = votes.filter((v) => v.created_at >= since1h).length
    const prevHourVotes = votes.filter(
      (v) => v.created_at >= since2h && v.created_at < since1h
    ).length

    const votes24h = votes.length
    const for24h = votes.filter((v) => v.side === 'blue').length
    const against24h = votes.filter((v) => v.side === 'red').length

    // Peak hour
    let peakHour: string | null = null
    let peakCount = 0
    for (const [hour, counts] of bucketMap.entries()) {
      if (counts.total > peakCount) {
        peakCount = counts.total
        peakHour = hour
      }
    }

    // Velocity change %
    let velocityChangePct: number | null = null
    if (prevHourVotes > 0) {
      velocityChangePct = Math.round(((votes1h - prevHourVotes) / prevHourVotes) * 100)
    } else if (votes1h > 0) {
      velocityChangePct = null // new activity after silence
    }

    // Current partial hour vs previous full hour for display
    const currentHourStart = new Date(now)
    currentHourStart.setMinutes(0, 0, 0)
    const currentHourVotes = votes.filter(
      (v) => v.created_at >= currentHourStart.toISOString()
    ).length

    const momentum = classifyMomentum(votes1h, prevHourVotes)

    const result: PulseData = {
      topic: {
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status,
        blue_pct: topic.blue_pct ?? 50,
        total_votes: topic.total_votes ?? 0,
      },
      buckets,
      current_hour_votes: currentHourVotes,
      prev_hour_votes: prevHourVotes,
      votes_24h: votes24h,
      votes_1h: votes1h,
      momentum,
      velocity_change_pct: velocityChangePct,
      peak_hour: peakHour,
      peak_count: peakCount,
      for_24h: for24h,
      against_24h: against24h,
    }

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[pulse] error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
