import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThreadArgument {
  id: string
  content: string
  topic_id: string
  topic_statement: string
  side: 'blue' | 'red'
  upvotes: number
  reply_count: number
  created_at: string
}

export interface TopReplier {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  reply_count: number
}

export interface ThreadAnalyticsData {
  totalArguments: number
  totalRepliesReceived: number
  avgRepliesPerArgument: number
  replyRate: number               // % of arguments with ≥1 reply
  maxRepliesOnOneArgument: number
  platformAvgReplyRate: number    // rough platform average
  topThreadedArguments: ThreadArgument[]
  topRepliers: TopReplier[]
  recentActivity: Array<{
    week: string
    arguments_posted: number
    replies_received: number
  }>
  threadDepthDistribution: Array<{
    bucket: string  // '0', '1-2', '3-5', '6-10', '10+'
    count: number
  }>
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Fetch the user's arguments ────────────────────────────────────────────
  const { data: myArgs } = await supabase
    .from('topic_arguments')
    .select('id, content, topic_id, side, upvotes, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (!myArgs || myArgs.length === 0) {
    return NextResponse.json(emptyData())
  }

  const argIds = myArgs.map((a) => a.id)

  // ── 2. Count replies per argument ─────────────────────────────────────────────
  const { data: replyRows } = await supabase
    .from('argument_replies')
    .select('argument_id, user_id, created_at')
    .in('argument_id', argIds)

  const replysByArg = new Map<string, { count: number; userIds: string[]; timestamps: string[] }>()
  for (const r of replyRows ?? []) {
    const existing = replysByArg.get(r.argument_id) ?? { count: 0, userIds: [], timestamps: [] }
    existing.count++
    existing.userIds.push(r.user_id)
    existing.timestamps.push(r.created_at)
    replysByArg.set(r.argument_id, existing)
  }

  // ── 3. Fetch topic names for top threaded args ────────────────────────────────
  const topArgsByReplies = [...myArgs]
    .map((a) => ({ ...a, reply_count: replysByArg.get(a.id)?.count ?? 0 }))
    .sort((a, b) => b.reply_count - a.reply_count)
    .slice(0, 10)

  const topicIds = [...new Set(topArgsByReplies.map((a) => a.topic_id))]
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement')
    .in('id', topicIds)

  const topicMap = new Map((topicRows ?? []).map((t) => [t.id, t.statement]))

  const topThreadedArguments: ThreadArgument[] = topArgsByReplies
    .filter((a) => a.reply_count > 0)
    .map((a) => ({
      id: a.id,
      content: a.content,
      topic_id: a.topic_id,
      topic_statement: topicMap.get(a.topic_id) ?? 'Unknown topic',
      side: a.side as 'blue' | 'red',
      upvotes: a.upvotes ?? 0,
      reply_count: a.reply_count,
      created_at: a.created_at,
    }))

  // ── 4. Top repliers (who replied to you most) ────────────────────────────────
  const replierCount = new Map<string, number>()
  for (const r of replyRows ?? []) {
    if (r.user_id !== user.id) {
      replierCount.set(r.user_id, (replierCount.get(r.user_id) ?? 0) + 1)
    }
  }

  const topReplierIds = [...replierCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([uid]) => uid)

  let topRepliers: TopReplier[] = []
  if (topReplierIds.length > 0) {
    const { data: replierProfiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', topReplierIds)

    topRepliers = topReplierIds
      .map((uid) => {
        const p = (replierProfiles ?? []).find((r) => r.id === uid)
        if (!p) return null
        return {
          user_id: uid,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          reply_count: replierCount.get(uid) ?? 0,
        }
      })
      .filter((r): r is TopReplier => r !== null)
  }

  // ── 5. Aggregate stats ────────────────────────────────────────────────────────
  const totalArguments = myArgs.length
  const totalRepliesReceived = replyRows?.length ?? 0
  const avgRepliesPerArgument = totalArguments > 0 ? totalRepliesReceived / totalArguments : 0
  const argsWithReplies = myArgs.filter((a) => (replysByArg.get(a.id)?.count ?? 0) > 0).length
  const replyRate = totalArguments > 0 ? (argsWithReplies / totalArguments) * 100 : 0
  const maxRepliesOnOneArgument = Math.max(
    0,
    ...[...replysByArg.values()].map((v) => v.count)
  )

  // ── 6. Thread depth distribution ────────────────────────────────────────────
  const bucketMap = new Map([
    ['0', 0], ['1–2', 0], ['3–5', 0], ['6–10', 0], ['10+', 0],
  ])
  for (const a of myArgs) {
    const c = replysByArg.get(a.id)?.count ?? 0
    if (c === 0) bucketMap.set('0', (bucketMap.get('0') ?? 0) + 1)
    else if (c <= 2) bucketMap.set('1–2', (bucketMap.get('1–2') ?? 0) + 1)
    else if (c <= 5) bucketMap.set('3–5', (bucketMap.get('3–5') ?? 0) + 1)
    else if (c <= 10) bucketMap.set('6–10', (bucketMap.get('6–10') ?? 0) + 1)
    else bucketMap.set('10+', (bucketMap.get('10+') ?? 0) + 1)
  }
  const threadDepthDistribution = [...bucketMap.entries()].map(([bucket, count]) => ({
    bucket,
    count,
  }))

  // ── 7. Weekly activity (arguments posted + replies received) ─────────────────
  type WeekBucket = { arguments_posted: number; replies_received: number }
  const weekMap = new Map<string, WeekBucket>()

  for (const a of myArgs) {
    const week = getWeekLabel(a.created_at)
    const b = weekMap.get(week) ?? { arguments_posted: 0, replies_received: 0 }
    b.arguments_posted++
    weekMap.set(week, b)
  }

  for (const r of replyRows ?? []) {
    // Attribute reply to the week the ARGUMENT was posted
    const arg = myArgs.find((a) => a.id === r.argument_id)
    if (!arg) continue
    const week = getWeekLabel(arg.created_at)
    const b = weekMap.get(week) ?? { arguments_posted: 0, replies_received: 0 }
    b.replies_received++
    weekMap.set(week, b)
  }

  const recentActivity = [...weekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([week, data]) => ({ week, ...data }))

  return NextResponse.json({
    totalArguments,
    totalRepliesReceived,
    avgRepliesPerArgument: Math.round(avgRepliesPerArgument * 10) / 10,
    replyRate: Math.round(replyRate),
    maxRepliesOnOneArgument,
    platformAvgReplyRate: 22,
    topThreadedArguments,
    topRepliers,
    recentActivity,
    threadDepthDistribution,
  } satisfies ThreadAnalyticsData)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyData(): ThreadAnalyticsData {
  return {
    totalArguments: 0,
    totalRepliesReceived: 0,
    avgRepliesPerArgument: 0,
    replyRate: 0,
    maxRepliesOnOneArgument: 0,
    platformAvgReplyRate: 22,
    topThreadedArguments: [],
    topRepliers: [],
    recentActivity: [],
    threadDepthDistribution: [
      { bucket: '0', count: 0 },
      { bucket: '1–2', count: 0 },
      { bucket: '3–5', count: 0 },
      { bucket: '6–10', count: 0 },
      { bucket: '10+', count: 0 },
    ],
  }
}

function getWeekLabel(iso: string): string {
  const d = new Date(iso)
  // ISO week start (Monday)
  const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - dayOfWeek)
  return d.toISOString().slice(0, 10)
}
