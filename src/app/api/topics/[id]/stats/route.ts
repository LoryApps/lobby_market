import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Response types ───────────────────────────────────────────────────────────

export interface VelocityBucket {
  date: string    // YYYY-MM-DD
  forVotes: number
  againstVotes: number
  forPct: number
}

export interface RoleSplit {
  role: string
  forVotes: number
  againstVotes: number
  total: number
  forPct: number
}

export interface HotTake {
  id: string
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  side: 'blue' | 'red'
  reason: string
  created_at: string
}

export interface TopicStatsResponse {
  // Topic metadata
  topicId: string
  statement: string
  category: string | null
  status: string
  totalVotes: number
  forPct: number

  // Vote velocity (daily buckets, most recent 30 days)
  velocity: VelocityBucket[]

  // Velocity stats
  votesLast24h: number
  votesLast7d: number
  peakDay: string | null
  peakDayVotes: number

  // Role breakdown
  roleSplit: RoleSplit[]

  // Hot takes (votes with reasons)
  hotTakes: HotTake[]
  totalHotTakes: number

  // Prediction market summary
  lawConfidence: number | null
  totalPredictions: number
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

  // 1. Fetch topic
  const { data: topic, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, total_votes, blue_pct')
    .eq('id', topicId)
    .single()

  if (topicError || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // 2. Fetch all votes (limit 10k) for velocity + role breakdown
  const { data: votes } = await supabase
    .from('votes')
    .select('id, user_id, side, reason, created_at')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })
    .limit(10000)

  const allVotes = votes ?? []
  const now = Date.now()
  const ms24h = 86_400_000
  const ms7d = 7 * ms24h

  // Velocity buckets (daily, last 30 days worth of data)
  const byDay = new Map<string, { for: number; against: number }>()
  let votesLast24h = 0
  let votesLast7d = 0

  for (const v of allVotes) {
    const day = v.created_at.slice(0, 10)
    const bucket = byDay.get(day) ?? { for: 0, against: 0 }
    if (v.side === 'blue') bucket.for++
    else bucket.against++
    byDay.set(day, bucket)

    const age = now - new Date(v.created_at).getTime()
    if (age <= ms24h) votesLast24h++
    if (age <= ms7d) votesLast7d++
  }

  const sortedDays = Array.from(byDay.keys()).sort()
  let peakDay: string | null = null
  let peakDayVotes = 0

  const velocity: VelocityBucket[] = sortedDays.map((date) => {
    const b = byDay.get(date)!
    const total = b.for + b.against
    if (total > peakDayVotes) {
      peakDayVotes = total
      peakDay = date
    }
    return {
      date,
      forVotes: b.for,
      againstVotes: b.against,
      forPct: total > 0 ? Math.round((b.for / total) * 100) : 50,
    }
  })

  // 3. Role breakdown — fetch voter profiles
  const userIds = Array.from(new Set(allVotes.map((v) => v.user_id as string)))
  const roleByUser = new Map<string, string>()

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', userIds.slice(0, 500)) // cap at 500 profile lookups
    for (const p of profiles ?? []) {
      roleByUser.set(p.id, p.role as string)
    }
  }

  const roleMap = new Map<string, { for: number; against: number }>()
  for (const v of allVotes) {
    const role = roleByUser.get(v.user_id as string) ?? 'citizen'
    const bucket = roleMap.get(role) ?? { for: 0, against: 0 }
    if (v.side === 'blue') bucket.for++
    else bucket.against++
    roleMap.set(role, bucket)
  }

  const ROLE_ORDER = ['citizen', 'troll_catcher', 'elder']
  const roleSplit: RoleSplit[] = ROLE_ORDER.map((role) => {
    const b = roleMap.get(role) ?? { for: 0, against: 0 }
    const total = b.for + b.against
    return {
      role,
      forVotes: b.for,
      againstVotes: b.against,
      total,
      forPct: total > 0 ? Math.round((b.for / total) * 100) : 50,
    }
  }).filter((r) => r.total > 0)

  // 4. Hot takes (votes with non-null reasons)
  const { data: hotTakeRows, count: totalHotTakes } = await supabase
    .from('votes')
    .select('id, user_id, side, reason, created_at', { count: 'exact' })
    .eq('topic_id', topicId)
    .not('reason', 'is', null)
    .order('created_at', { ascending: false })
    .limit(12)

  // Fetch profiles for hot-take authors
  const htUserIds = Array.from(new Set((hotTakeRows ?? []).map((r) => r.user_id as string)))
  const htProfileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null; role: string }>()
  if (htUserIds.length > 0) {
    const { data: htProfiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', htUserIds)
    for (const p of htProfiles ?? []) {
      htProfileMap.set(p.id as string, {
        username: p.username as string,
        display_name: p.display_name as string | null,
        avatar_url: p.avatar_url as string | null,
        role: p.role as string,
      })
    }
  }

  const hotTakes: HotTake[] = (hotTakeRows ?? []).map((row) => {
    const p = htProfileMap.get(row.user_id as string)
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      username: p?.username ?? 'unknown',
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      role: p?.role ?? 'citizen',
      side: row.side as 'blue' | 'red',
      reason: row.reason as string,
      created_at: row.created_at as string,
    }
  })

  // 5. Prediction market summary
  const { data: predStats } = await supabase
    .from('topic_prediction_stats')
    .select('law_confidence, total_predictions')
    .eq('topic_id', topicId)
    .maybeSingle()

  return NextResponse.json({
    topicId,
    statement: topic.statement,
    category: topic.category,
    status: topic.status,
    totalVotes: topic.total_votes ?? 0,
    forPct: Math.round(topic.blue_pct ?? 50),

    velocity,
    votesLast24h,
    votesLast7d,
    peakDay,
    peakDayVotes,

    roleSplit,

    hotTakes,
    totalHotTakes: totalHotTakes ?? 0,

    lawConfidence: predStats?.law_confidence ?? null,
    totalPredictions: predStats?.total_predictions ?? 0,
  } satisfies TopicStatsResponse)
}
