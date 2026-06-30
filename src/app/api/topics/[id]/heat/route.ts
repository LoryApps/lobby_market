import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeatCell {
  day: number    // 0 = Sunday … 6 = Saturday
  hour: number   // 0 – 23 UTC
  total: number
  forCount: number
  againstCount: number
  forPct: number
}

export interface HourBucket {
  hour: number
  total: number
  forCount: number
  againstCount: number
  forPct: number
}

export interface DayBucket {
  day: number
  label: string
  total: number
  forCount: number
  againstCount: number
  forPct: number
}

export interface HeatResponse {
  topicId: string
  statement: string
  totalVotes: number
  sampleSize: number
  cells: HeatCell[]
  byHour: HourBucket[]
  byDay: DayBucket[]
  peakHour: number
  peakDay: number
  peakHourTotal: number
  peakDayTotal: number
  forPct: number
  topHours: number[]     // top-3 busiest hours
  topDays: number[]      // top-3 busiest days
  avgForPctByHour: number[]   // forPct indexed 0-23
  avgForPctByDay: number[]    // forPct indexed 0-6
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── GET /api/topics/[id]/heat ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = params.id
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch topic metadata
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, total_votes, blue_pct')
    .eq('id', topicId)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch up to 10k votes — only need side + timestamp
  const { data: votes } = await supabase
    .from('votes')
    .select('side, created_at')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })
    .limit(10000)

  const allVotes = votes ?? []

  // Build 7×24 grid
  const grid: Map<string, { for: number; against: number }> = new Map()
  const hourMap: Map<number, { for: number; against: number }> = new Map()
  const dayMap: Map<number, { for: number; against: number }> = new Map()

  for (const v of allVotes) {
    const d = new Date(v.created_at)
    const dow = d.getUTCDay()    // 0-6
    const hour = d.getUTCHours() // 0-23
    const key = `${dow}:${hour}`

    // Grid
    const cell = grid.get(key) ?? { for: 0, against: 0 }
    if (v.side === 'blue') cell.for++
    else cell.against++
    grid.set(key, cell)

    // Hour bucket
    const hb = hourMap.get(hour) ?? { for: 0, against: 0 }
    if (v.side === 'blue') hb.for++
    else hb.against++
    hourMap.set(hour, hb)

    // Day bucket
    const db = dayMap.get(dow) ?? { for: 0, against: 0 }
    if (v.side === 'blue') db.for++
    else db.against++
    dayMap.set(dow, db)
  }

  // Build cells array
  const cells: HeatCell[] = []
  for (const [key, bucket] of grid.entries()) {
    const [dayStr, hourStr] = key.split(':')
    const total = bucket.for + bucket.against
    cells.push({
      day: Number(dayStr),
      hour: Number(hourStr),
      total,
      forCount: bucket.for,
      againstCount: bucket.against,
      forPct: total > 0 ? Math.round((bucket.for / total) * 100) : 50,
    })
  }

  // By-hour array (0-23)
  const byHour: HourBucket[] = Array.from({ length: 24 }, (_, h) => {
    const b = hourMap.get(h) ?? { for: 0, against: 0 }
    const total = b.for + b.against
    return {
      hour: h,
      total,
      forCount: b.for,
      againstCount: b.against,
      forPct: total > 0 ? Math.round((b.for / total) * 100) : 50,
    }
  })

  // By-day array (0-6)
  const byDay: DayBucket[] = Array.from({ length: 7 }, (_, d) => {
    const b = dayMap.get(d) ?? { for: 0, against: 0 }
    const total = b.for + b.against
    return {
      day: d,
      label: DAY_LABELS[d],
      total,
      forCount: b.for,
      againstCount: b.against,
      forPct: total > 0 ? Math.round((b.for / total) * 100) : 50,
    }
  })

  // Peak hour/day
  let peakHour = 0
  let peakHourTotal = 0
  let peakDay = 0
  let peakDayTotal = 0

  for (const h of byHour) {
    if (h.total > peakHourTotal) { peakHourTotal = h.total; peakHour = h.hour }
  }
  for (const d of byDay) {
    if (d.total > peakDayTotal) { peakDayTotal = d.total; peakDay = d.day }
  }

  // Top-3 hours and days
  const sortedHours = [...byHour].sort((a, b) => b.total - a.total)
  const topHours = sortedHours.slice(0, 3).map((h) => h.hour)
  const sortedDays = [...byDay].sort((a, b) => b.total - a.total)
  const topDays = sortedDays.slice(0, 3).map((d) => d.day)

  const avgForPctByHour = byHour.map((h) => h.forPct)
  const avgForPctByDay = byDay.map((d) => d.forPct)

  const response: HeatResponse = {
    topicId: topic.id,
    statement: topic.statement,
    totalVotes: topic.total_votes ?? allVotes.length,
    sampleSize: allVotes.length,
    cells,
    byHour,
    byDay,
    peakHour,
    peakDay,
    peakHourTotal,
    peakDayTotal,
    forPct: Math.round(topic.blue_pct ?? 50),
    topHours,
    topDays,
    avgForPctByHour,
    avgForPctByDay,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' },
  })
}
