import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplayVotePoint {
  date: string      // YYYY-MM-DD
  forPct: number    // cumulative FOR %
  totalVotes: number
  deltaVotes: number // votes added on this day
}

export interface ReplayArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_grade: string | null
  created_at: string
  author_name: string | null
  author_avatar: string | null
}

export interface ReplayMilestone {
  date: string
  kind: 'first_argument' | 'turning_point' | 'debate_started' | 'vote_spike' | 'topic_created'
  label: string
}

export interface ReplayResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
  }
  voteTrend: ReplayVotePoint[]
  arguments: ReplayArgument[]
  milestones: ReplayMilestone[]
}

// ─── GET /api/topics/[id]/replay ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // 1. Topic details
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 2. All votes (ordered chronologically, max 5000)
  const { data: votes } = await supabase
    .from('votes')
    .select('side, created_at')
    .eq('topic_id', params.id)
    .order('created_at', { ascending: true })
    .limit(5000)

  // 3. All arguments with author profiles
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, ai_grade, created_at, user_id')
    .eq('topic_id', params.id)
    .order('created_at', { ascending: true })
    .limit(200)

  // Batch-fetch author profiles
  const authorIds = [...new Set((rawArgs ?? []).map((a) => a.user_id))]
  const { data: profiles } = authorIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', authorIds)
    : { data: [] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  const replayArgs: ReplayArgument[] = (rawArgs ?? []).map((a) => {
    const prof = profileMap.get(a.user_id)
    return {
      id: a.id,
      content: a.content,
      side: a.side,
      upvotes: a.upvotes,
      ai_grade: a.ai_grade,
      created_at: a.created_at,
      author_name: prof?.display_name ?? prof?.username ?? null,
      author_avatar: prof?.avatar_url ?? null,
    }
  })

  // 4. Build vote trend (cumulative, by day)
  const byDay = new Map<string, { for: number; against: number }>()
  for (const vote of votes ?? []) {
    const day = vote.created_at.slice(0, 10)
    const bucket = byDay.get(day) ?? { for: 0, against: 0 }
    if (vote.side === 'blue') bucket.for++
    else bucket.against++
    byDay.set(day, bucket)
  }

  const sortedDays = Array.from(byDay.keys()).sort()
  let runningFor = 0
  let runningTotal = 0
  const voteTrend: ReplayVotePoint[] = sortedDays.map((date) => {
    const day = byDay.get(date)!
    const delta = day.for + day.against
    runningFor += day.for
    runningTotal += delta
    return {
      date,
      forPct: runningTotal > 0 ? (runningFor / runningTotal) * 100 : 50,
      totalVotes: runningTotal,
      deltaVotes: delta,
    }
  })

  // 5. Build milestones
  const milestones: ReplayMilestone[] = []

  // Topic creation day
  const createdDay = topic.created_at.slice(0, 10)
  milestones.push({
    date: createdDay,
    kind: 'topic_created',
    label: 'Topic created',
  })

  // First argument
  if (replayArgs.length > 0) {
    milestones.push({
      date: replayArgs[0].created_at.slice(0, 10),
      kind: 'first_argument',
      label: 'First argument posted',
    })
  }

  // Turning point: day the majority side flipped (FOR% crossed 50%)
  let prevForPct = 50
  for (const point of voteTrend) {
    const flippedToFor = prevForPct < 50 && point.forPct >= 50
    const flippedToAgainst = prevForPct >= 50 && point.forPct < 50
    if ((flippedToFor || flippedToAgainst) && point.totalVotes > 5) {
      milestones.push({
        date: point.date,
        kind: 'turning_point',
        label: flippedToFor ? 'FOR side takes the lead' : 'AGAINST side takes the lead',
      })
    }
    prevForPct = point.forPct
  }

  // Vote spike: a day with unusually high vote activity (3× average)
  const avgDailyVotes = runningTotal / Math.max(sortedDays.length, 1)
  for (const point of voteTrend) {
    if (point.deltaVotes > avgDailyVotes * 3 && point.deltaVotes >= 10) {
      milestones.push({
        date: point.date,
        kind: 'vote_spike',
        label: `+${point.deltaVotes} votes in one day`,
      })
      break // Only mark the biggest spike
    }
  }

  // Deduplicate milestones on same date (keep first per date)
  const seenDates = new Set<string>()
  const dedupedMilestones = milestones.filter((m) => {
    if (seenDates.has(m.date)) return false
    seenDates.add(m.date)
    return true
  })

  return NextResponse.json(
    {
      topic,
      voteTrend,
      arguments: replayArgs,
      milestones: dedupedMilestones,
    } satisfies ReplayResponse,
    {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    }
  )
}
