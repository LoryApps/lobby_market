import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type PersuasionTier =
  | 'elite'
  | 'strong'
  | 'effective'
  | 'developing'
  | 'emerging'

export interface PersuasionLeaderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  avg_score: number
  total_upvotes: number
  argument_count: number
  top_argument_snippet: string | null
  top_argument_topic: string | null
  tier: PersuasionTier
}

export interface PersuasionMyStats {
  avg_score: number
  total_upvotes: number
  argument_count: number
  tier: PersuasionTier
  rank: number | null
  percentile: number | null
}

export interface PersuasionLeaderboardResponse {
  entries: PersuasionLeaderEntry[]
  total_arguers: number
  my_stats: PersuasionMyStats | null
  platform_avg: number
  generated_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function persuasionScore(upvotes: number, totalVotes: number): number {
  if (totalVotes <= 0) return 0
  const raw = upvotes / Math.sqrt(Math.max(totalVotes, 1))
  return Math.min(100, Math.round(raw * 10))
}

function getTier(avgScore: number): PersuasionTier {
  if (avgScore >= 70) return 'elite'
  if (avgScore >= 50) return 'strong'
  if (avgScore >= 30) return 'effective'
  if (avgScore >= 15) return 'developing'
  return 'emerging'
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const period = req.nextUrl.searchParams.get('period') ?? 'all'

  // Build date filter
  let sinceDate: string | null = null
  if (period === '30d') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    sinceDate = d.toISOString()
  } else if (period === '90d') {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    sinceDate = d.toISOString()
  }

  // ── 1. Fetch arguments with topic data ────────────────────────────────────
  let query = supabase
    .from('topic_arguments')
    .select(`
      id,
      content,
      user_id,
      upvotes,
      topics (
        statement,
        total_votes
      )
    `)
    .gt('upvotes', 0)
    .order('upvotes', { ascending: false })
    .limit(3000)

  if (sinceDate) {
    query = query.gte('created_at', sinceDate)
  }

  const { data: rawArgs, error: argsError } = await query

  if (argsError) {
    return NextResponse.json({ error: argsError.message }, { status: 500 })
  }

  const args = (rawArgs ?? []) as Array<{
    id: string
    content: string
    user_id: string
    upvotes: number
    topics: { statement: string; total_votes: number } | null
  }>

  // ── 2. Group by user ──────────────────────────────────────────────────────
  type UserBucket = {
    total_upvotes: number
    scores: number[]
    top_argument: { snippet: string; topic: string; upvotes: number } | null
  }

  const userMap = new Map<string, UserBucket>()

  for (const arg of args) {
    const score = persuasionScore(arg.upvotes, arg.topics?.total_votes ?? 0)
    const existing = userMap.get(arg.user_id)
    if (!existing) {
      userMap.set(arg.user_id, {
        total_upvotes: arg.upvotes,
        scores: [score],
        top_argument: {
          snippet: arg.content.slice(0, 120),
          topic: arg.topics?.statement ?? '',
          upvotes: arg.upvotes,
        },
      })
    } else {
      existing.total_upvotes += arg.upvotes
      existing.scores.push(score)
      if (arg.upvotes > (existing.top_argument?.upvotes ?? 0)) {
        existing.top_argument = {
          snippet: arg.content.slice(0, 120),
          topic: arg.topics?.statement ?? '',
          upvotes: arg.upvotes,
        }
      }
    }
  }

  // ── 3. Filter: minimum 3 arguments ───────────────────────────────────────
  const eligibleUsers = Array.from(userMap.entries())
    .filter(([, bucket]) => bucket.scores.length >= 3)
    .map(([uid, bucket]) => {
      const avg = Math.round(bucket.scores.reduce((s, v) => s + v, 0) / bucket.scores.length)
      return {
        user_id: uid,
        avg_score: avg,
        total_upvotes: bucket.total_upvotes,
        argument_count: bucket.scores.length,
        top_argument_snippet: bucket.top_argument?.snippet ?? null,
        top_argument_topic: bucket.top_argument?.topic ?? null,
        tier: getTier(avg),
      }
    })
    .sort((a, b) => b.avg_score - a.avg_score || b.total_upvotes - a.total_upvotes)

  const totalArgumenters = eligibleUsers.length

  // ── 4. Platform average ────────────────────────────────────────────────────
  const platform_avg = eligibleUsers.length > 0
    ? Math.round(eligibleUsers.reduce((s, u) => s + u.avg_score, 0) / eligibleUsers.length)
    : 0

  // ── 5. Fetch profiles for top 50 ─────────────────────────────────────────
  const top50 = eligibleUsers.slice(0, 50)
  const topIds = top50.map((u) => u.user_id)

  let profiles: Array<{
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }> = []

  if (topIds.length > 0) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', topIds)
    profiles = (profileData ?? []) as typeof profiles
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const entries: PersuasionLeaderEntry[] = top50
    .map((u, i) => {
      const p = profileMap.get(u.user_id)
      if (!p) return null
      return {
        rank: i + 1,
        user_id: u.user_id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role ?? 'person',
        clout: p.clout ?? 0,
        avg_score: u.avg_score,
        total_upvotes: u.total_upvotes,
        argument_count: u.argument_count,
        top_argument_snippet: u.top_argument_snippet,
        top_argument_topic: u.top_argument_topic,
        tier: u.tier,
      } satisfies PersuasionLeaderEntry
    })
    .filter((e): e is PersuasionLeaderEntry => e !== null)

  // ── 6. Personal stats ─────────────────────────────────────────────────────
  let my_stats: PersuasionMyStats | null = null

  if (user) {
    const myEntry = eligibleUsers.find((u) => u.user_id === user.id)
    if (myEntry) {
      const myRank = eligibleUsers.findIndex((u) => u.user_id === user.id) + 1
      const percentile =
        totalArgumenters > 1
          ? Math.round(((totalArgumenters - myRank) / (totalArgumenters - 1)) * 100)
          : 100
      my_stats = {
        avg_score: myEntry.avg_score,
        total_upvotes: myEntry.total_upvotes,
        argument_count: myEntry.argument_count,
        tier: myEntry.tier,
        rank: myRank,
        percentile,
      }
    } else {
      // User has <3 arguments or none in the period — show their raw stats
      let userQuery = supabase
        .from('topic_arguments')
        .select(`id, upvotes, topics ( total_votes )`)
        .eq('user_id', user.id)
        .gt('upvotes', 0)

      if (sinceDate) userQuery = userQuery.gte('created_at', sinceDate)

      const { data: myArgs } = await userQuery
      const myArgsList = (myArgs ?? []) as Array<{
        id: string
        upvotes: number
        topics: { total_votes: number } | null
      }>

      if (myArgsList.length > 0) {
        const scores = myArgsList.map((a) => persuasionScore(a.upvotes, a.topics?.total_votes ?? 0))
        const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
        my_stats = {
          avg_score: avg,
          total_upvotes: myArgsList.reduce((s, a) => s + a.upvotes, 0),
          argument_count: myArgsList.length,
          tier: getTier(avg),
          rank: null,
          percentile: null,
        }
      }
    }
  }

  return NextResponse.json({
    entries,
    total_arguers: totalArgumenters,
    my_stats,
    platform_avg,
    generated_at: new Date().toISOString(),
  } satisfies PersuasionLeaderboardResponse)
}
