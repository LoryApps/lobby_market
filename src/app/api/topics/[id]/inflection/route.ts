import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InflectionPoint {
  date: string
  forPctBefore: number
  forPctAfter: number
  delta: number          // positive = FOR surged, negative = AGAINST surged
  direction: 'for' | 'against'
  votesInWindow: number
  windowLabel: string
  topArgument: {
    id: string
    body: string
    side: 'for' | 'against'
    upvotes: number
    username: string | null
    display_name: string | null
    avatar_url: string | null
    created_at: string
  } | null
}

export interface InflectionResponse {
  topicId: string
  statement: string
  category: string | null
  status: string
  currentForPct: number
  totalVotes: number
  inflections: InflectionPoint[]
  hasSufficientData: boolean
  /** Overall narrative: did FOR or AGAINST gain ground over the whole period? */
  overallTrend: 'for' | 'against' | 'stable'
  openingForPct: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateKey(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
}

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000
  )
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = params.id
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })
  }

  const supabase = await createClient()

  // ── Fetch topic metadata ──────────────────────────────────────────────────
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .maybeSingle()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // ── Fetch votes (up to 5000) ──────────────────────────────────────────────
  const { data: votes } = await supabase
    .from('votes')
    .select('side, created_at')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })
    .limit(5000)

  const allVotes = votes ?? []

  if (allVotes.length < 20) {
    return NextResponse.json({
      topicId,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      currentForPct: Math.round(topic.blue_pct ?? 50),
      totalVotes: topic.total_votes ?? 0,
      inflections: [],
      hasSufficientData: false,
      overallTrend: 'stable',
      openingForPct: null,
    } satisfies InflectionResponse)
  }

  // ── Build daily buckets ───────────────────────────────────────────────────
  type DayBucket = { date: string; forCount: number; totalCount: number }
  const bucketMap = new Map<string, DayBucket>()

  for (const vote of allVotes) {
    const key = dateKey(vote.created_at)
    const bucket = bucketMap.get(key) ?? { date: key, forCount: 0, totalCount: 0 }
    bucket.totalCount += 1
    if (vote.side === 'for') bucket.forCount += 1
    bucketMap.set(key, bucket)
  }

  const days = Array.from(bucketMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  )

  // ── Compute cumulative FOR% at end of each day ────────────────────────────
  interface CumulativeDay {
    date: string
    cumForPct: number
    totalVotes: number
    dayVotes: number
  }

  let cumFor = 0
  let cumTotal = 0
  const cumulative: CumulativeDay[] = []

  for (const day of days) {
    cumFor += day.forCount
    cumTotal += day.totalCount
    cumulative.push({
      date: day.date,
      cumForPct: cumTotal > 0 ? Math.round((cumFor / cumTotal) * 100) : 50,
      totalVotes: cumTotal,
      dayVotes: day.totalCount,
    })
  }

  // ── Detect inflection points using a sliding window ───────────────────────
  // Compare each day's cumulative FOR% against 3 days prior.
  // An inflection is a swing > threshold percentage points.
  const MIN_DELTA = 3 // pp — minimum shift to qualify

  const candidates: Array<{
    index: number
    date: string
    forPctBefore: number
    forPctAfter: number
    delta: number
    votesInWindow: number
  }> = []

  for (let i = 3; i < cumulative.length; i++) {
    const before = cumulative[i - 3]
    const after = cumulative[i]
    const delta = after.cumForPct - before.cumForPct
    const votesInWindow = after.totalVotes - before.totalVotes

    if (Math.abs(delta) >= MIN_DELTA && votesInWindow >= 5) {
      candidates.push({
        index: i,
        date: after.date,
        forPctBefore: before.cumForPct,
        forPctAfter: after.cumForPct,
        delta,
        votesInWindow,
      })
    }
  }

  // ── De-duplicate: keep only the largest shift in any 5-day window ─────────
  const deduped: typeof candidates = []
  for (const c of candidates) {
    const overlaps = deduped.some((d) => daysBetween(d.date, c.date) < 5)
    if (!overlaps) {
      deduped.push(c)
    } else {
      // Replace if this candidate has a larger absolute delta
      const idx = deduped.findIndex((d) => daysBetween(d.date, c.date) < 5)
      if (idx >= 0 && Math.abs(c.delta) > Math.abs(deduped[idx].delta)) {
        deduped[idx] = c
      }
    }
  }

  // Keep top 5 by absolute delta
  const top5 = deduped
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5)
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── Fetch top argument near each inflection date ──────────────────────────
  const inflections: InflectionPoint[] = []

  for (const inf of top5) {
    // Window: 2 days before to 1 day after the inflection date
    const windowStart = new Date(inf.date)
    windowStart.setDate(windowStart.getDate() - 2)
    const windowEnd = new Date(inf.date)
    windowEnd.setDate(windowEnd.getDate() + 1)
    windowEnd.setHours(23, 59, 59)

    const { data: args } = await supabase
      .from('topic_arguments')
      .select(`
        id,
        body,
        side,
        upvotes,
        created_at,
        author:profiles!topic_arguments_author_id_fkey(
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('topic_id', topicId)
      .gte('created_at', windowStart.toISOString())
      .lte('created_at', windowEnd.toISOString())
      .order('upvotes', { ascending: false })
      .limit(1)

    const topArg = args?.[0] ?? null

    // Days since platform start for a readable window label
    const d = new Date(inf.date)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    inflections.push({
      date: inf.date,
      forPctBefore: inf.forPctBefore,
      forPctAfter: inf.forPctAfter,
      delta: inf.delta,
      direction: inf.delta > 0 ? 'for' : 'against',
      votesInWindow: inf.votesInWindow,
      windowLabel: label,
      topArgument: topArg
        ? {
            id: topArg.id,
            body: topArg.body,
            side: topArg.side as 'for' | 'against',
            upvotes: topArg.upvotes ?? 0,
            username: (topArg.author as { username: string } | null)?.username ?? null,
            display_name: (topArg.author as { display_name: string | null } | null)?.display_name ?? null,
            avatar_url: (topArg.author as { avatar_url: string | null } | null)?.avatar_url ?? null,
            created_at: topArg.created_at,
          }
        : null,
    })
  }

  // ── Overall trend ─────────────────────────────────────────────────────────
  const openingForPct = cumulative[0]?.cumForPct ?? null
  const currentForPct = Math.round(topic.blue_pct ?? 50)
  let overallTrend: 'for' | 'against' | 'stable' = 'stable'
  if (openingForPct !== null) {
    const overallDelta = currentForPct - openingForPct
    if (overallDelta >= 3) overallTrend = 'for'
    else if (overallDelta <= -3) overallTrend = 'against'
  }

  return NextResponse.json({
    topicId,
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    currentForPct,
    totalVotes: topic.total_votes ?? 0,
    inflections,
    hasSufficientData: inflections.length > 0,
    overallTrend,
    openingForPct,
  } satisfies InflectionResponse)
}
