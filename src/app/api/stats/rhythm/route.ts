import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 1800 // 30 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

/** 0 = Sunday … 6 = Saturday */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface RhythmCell {
  dow:   DayOfWeek   // 0–6
  hour:  number      // 0–23
  votes: number
  args:  number
  total: number
}

export interface RhythmPeak {
  label: string
  dow:   DayOfWeek
  hour:  number
  total: number
}

export interface RhythmResponse {
  cells:     RhythmCell[]
  max_total: number  // for normalising cell intensity
  max_votes: number
  max_args:  number
  peaks: {
    busiest:  RhythmPeak
    quietest: RhythmPeak
    best_for_args: RhythmPeak  // hour with highest arg-to-vote ratio
  }
  day_totals:  number[]   // indexed [0..6]
  hour_totals: number[]   // indexed [0..23]
  total_votes: number
  total_args:  number
  window_days: number
  generated_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const WINDOW_DAYS = 90

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dowHourKey(dow: number, hour: number): string {
  return `${dow}:${hour}`
}

function parseDowHour(iso: string): { dow: number; hour: number } {
  const d = new Date(iso)
  return {
    dow:  d.getUTCDay(),
    hour: d.getUTCHours(),
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

    // Fetch vote timestamps (just created_at — no side needed)
    const { data: votesRaw } = await supabase
      .from('votes')
      .select('created_at')
      .gte('created_at', since)
      .limit(50_000)

    // Fetch argument timestamps
    const { data: argsRaw } = await supabase
      .from('topic_arguments')
      .select('created_at')
      .gte('created_at', since)
      .limit(50_000)

    const votes = (votesRaw ?? []) as Array<{ created_at: string }>
    const args  = (argsRaw  ?? []) as Array<{ created_at: string }>

    // Build 7×24 matrices
    const voteMatrix = new Map<string, number>()
    const argMatrix  = new Map<string, number>()

    for (const v of votes) {
      const { dow, hour } = parseDowHour(v.created_at)
      const k = dowHourKey(dow, hour)
      voteMatrix.set(k, (voteMatrix.get(k) ?? 0) + 1)
    }

    for (const a of args) {
      const { dow, hour } = parseDowHour(a.created_at)
      const k = dowHourKey(dow, hour)
      argMatrix.set(k, (argMatrix.get(k) ?? 0) + 1)
    }

    // Flatten into cells
    const cells: RhythmCell[] = []
    const dayTotals  = new Array<number>(7).fill(0)
    const hourTotals = new Array<number>(24).fill(0)

    let maxTotal = 0
    let maxVotes = 0
    let maxArgs  = 0

    for (let dow = 0; dow < 7; dow++) {
      for (let hour = 0; hour < 24; hour++) {
        const k = dowHourKey(dow, hour)
        const vCount = voteMatrix.get(k) ?? 0
        const aCount = argMatrix.get(k)  ?? 0
        const total  = vCount + aCount

        cells.push({ dow: dow as DayOfWeek, hour, votes: vCount, args: aCount, total })

        dayTotals[dow]    += total
        hourTotals[hour]  += total

        if (total  > maxTotal) maxTotal = total
        if (vCount > maxVotes) maxVotes = vCount
        if (aCount > maxArgs)  maxArgs  = aCount
      }
    }

    // Find peaks
    const sorted      = [...cells].sort((a, b) => b.total - a.total)
    const busiestCell = sorted[0]
    const quietestCell = sorted.filter(c => c.total > 0).at(-1) ?? sorted.at(-1)!

    // Best for args: highest arg-to-total ratio (among cells with ≥5 total)
    const bestArgCell = [...cells]
      .filter(c => c.total >= 5)
      .sort((a, b) => (b.args / b.total) - (a.args / a.total))[0] ?? busiestCell

    function makePeak(cell: RhythmCell): RhythmPeak {
      const ampm = cell.hour < 12
        ? `${cell.hour === 0 ? 12 : cell.hour}am`
        : `${cell.hour === 12 ? 12 : cell.hour - 12}pm`
      return {
        label: `${DAY_LABELS[cell.dow]} ${ampm} UTC`,
        dow:   cell.dow,
        hour:  cell.hour,
        total: cell.total,
      }
    }

    const response: RhythmResponse = {
      cells,
      max_total: maxTotal,
      max_votes: maxVotes,
      max_args:  maxArgs,
      peaks: {
        busiest:       makePeak(busiestCell),
        quietest:      makePeak(quietestCell!),
        best_for_args: makePeak(bestArgCell),
      },
      day_totals:  dayTotals,
      hour_totals: hourTotals,
      total_votes: votes.length,
      total_args:  args.length,
      window_days: WINDOW_DAYS,
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    })
  } catch (err) {
    console.error('[/api/stats/rhythm]', err)
    return NextResponse.json({ error: 'Failed to compute rhythm' }, { status: 500 })
  }
}
