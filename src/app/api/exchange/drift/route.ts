import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriftMarket {
  id: string
  statement: string
  category: string | null
  status: string
  current_price: number       // latest blue_pct
  start_price: number         // price at start of window
  drift_total: number         // total price change over window (current - start)
  drift_per_day: number       // average daily drift (slope of linear regression)
  consistency: number         // R² of linear regression (0–1, higher = steadier)
  drift_score: number         // |drift_per_day| × consistency (composite ranking)
  direction: 'up' | 'down'
  window_days: number
  volume: number
  snapshot_count: number
  sparkline: number[]         // price points oldest→newest for mini chart
}

export type DriftTab = 'all' | 'toward_law' | 'away_from_law'

export interface DriftResponse {
  toward_law: DriftMarket[]   // drifting toward 100 (FOR consensus building)
  away_from_law: DriftMarket[] // drifting toward 0 (AGAINST consensus building)
  as_of: string
  window_days: number
}

// ─── Linear regression helpers ────────────────────────────────────────────────

interface Snapshot {
  price: number
  recorded_at: string
}

function linearRegression(points: Snapshot[]): {
  slope: number
  rSquared: number
  startPrice: number
  endPrice: number
} {
  const n = points.length
  if (n < 3) return { slope: 0, rSquared: 0, startPrice: points[0]?.price ?? 50, endPrice: points[n - 1]?.price ?? 50 }

  // Use hours since first snapshot as x-axis (avoids large absolute timestamps)
  const t0 = new Date(points[0].recorded_at).getTime()
  const xs = points.map((p) => (new Date(p.recorded_at).getTime() - t0) / 3_600_000) // hours
  const ys = points.map((p) => p.price)

  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const sumX2 = xs.reduce((a, x) => a + x * x, 0)

  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { slope: 0, rSquared: 0, startPrice: ys[0], endPrice: ys[n - 1] }

  const slope = (n * sumXY - sumX * sumY) / denom       // price change per hour
  const intercept = (sumY - slope * sumX) / n

  // R² calculation
  const yMean = sumY / n
  const ssTot = ys.reduce((a, y) => a + (y - yMean) ** 2, 0)
  const ssRes = ys.reduce((a, y, i) => {
    const yHat = slope * xs[i] + intercept
    return a + (y - yHat) ** 2
  }, 0)
  const rSquared = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot)

  return {
    slope,                              // price change per hour
    rSquared,
    startPrice: Math.round(ys[0] * 10) / 10,
    endPrice: Math.round(ys[n - 1] * 10) / 10,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const windowDays = Math.min(30, Math.max(7, parseInt(searchParams.get('days') ?? '14', 10)))
    const minConsistency = parseFloat(searchParams.get('consistency') ?? '0.45')
    const minDriftPerDay = parseFloat(searchParams.get('min_drift') ?? '0.3')
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') ?? '30', 10)))

    const supabase = await createClient()
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()

    // Fetch price history for the window — only active/voting topics (settled don't drift)
    const { data: history, error: hErr } = await supabase
      .from('topic_price_history')
      .select('topic_id, price, volume, recorded_at')
      .gte('recorded_at', since)
      .order('topic_id', { ascending: true })
      .order('recorded_at', { ascending: true })
      .limit(10_000)

    if (hErr) throw hErr

    // Group snapshots by topic_id
    const grouped: Record<string, Snapshot[]> = {}
    const latestVolume: Record<string, number> = {}
    for (const row of history ?? []) {
      const id = row.topic_id as string
      if (!grouped[id]) grouped[id] = []
      grouped[id].push({ price: row.price as number, recorded_at: row.recorded_at as string })
      latestVolume[id] = row.volume as number
    }

    // Get topic metadata for topics we have history for
    const topicIds = Object.keys(grouped)
    if (topicIds.length === 0) {
      return NextResponse.json({
        toward_law: [],
        away_from_law: [],
        as_of: new Date().toISOString(),
        window_days: windowDays,
      } satisfies DriftResponse)
    }

    const { data: topics, error: tErr } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topicIds)
      .in('status', ['active', 'voting'])

    if (tErr) throw tErr

    const topicMap: Record<string, { statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }> = {}
    for (const t of topics ?? []) {
      topicMap[t.id as string] = {
        statement: t.statement as string,
        category: t.category as string | null,
        status: t.status as string,
        blue_pct: (t.blue_pct as number) ?? 50,
        total_votes: (t.total_votes as number) ?? 0,
      }
    }

    // Run regression on each topic
    const driftMarkets: DriftMarket[] = []

    for (const [topicId, snaps] of Object.entries(grouped)) {
      if (snaps.length < 3) continue
      const meta = topicMap[topicId]
      if (!meta) continue

      const { slope, rSquared, startPrice, endPrice } = linearRegression(snaps)

      const driftPerDay = slope * 24          // convert from per-hour → per-day
      const driftTotal = endPrice - startPrice
      const consistency = Math.round(rSquared * 100) / 100

      if (Math.abs(driftPerDay) < minDriftPerDay) continue
      if (consistency < minConsistency) continue

      const driftScore = Math.round(Math.abs(driftPerDay) * consistency * 100) / 100

      // Sparkline: downsample to at most 20 points
      const step = Math.max(1, Math.floor(snaps.length / 20))
      const sparkline: number[] = []
      for (let i = 0; i < snaps.length; i += step) {
        sparkline.push(Math.round(snaps[i].price * 10) / 10)
      }
      if (sparkline[sparkline.length - 1] !== meta.blue_pct) {
        sparkline.push(Math.round(meta.blue_pct * 10) / 10)
      }

      driftMarkets.push({
        id: topicId,
        statement: meta.statement,
        category: meta.category,
        status: meta.status,
        current_price: Math.round(meta.blue_pct * 10) / 10,
        start_price: startPrice,
        drift_total: Math.round(driftTotal * 10) / 10,
        drift_per_day: Math.round(driftPerDay * 100) / 100,
        consistency,
        drift_score: driftScore,
        direction: driftPerDay > 0 ? 'up' : 'down',
        window_days: windowDays,
        volume: meta.total_votes,
        snapshot_count: snaps.length,
        sparkline,
      })
    }

    // Sort by drift_score descending, split into tabs
    driftMarkets.sort((a, b) => b.drift_score - a.drift_score)

    const toward_law = driftMarkets.filter((m) => m.direction === 'up').slice(0, limit)
    const away_from_law = driftMarkets.filter((m) => m.direction === 'down').slice(0, limit)

    return NextResponse.json({
      toward_law,
      away_from_law,
      as_of: new Date().toISOString(),
      window_days: windowDays,
    } satisfies DriftResponse)
  } catch (err) {
    console.error('[exchange/drift]', err)
    return NextResponse.json(
      { toward_law: [], away_from_law: [], as_of: new Date().toISOString(), window_days: 14 },
      { status: 500 },
    )
  }
}
