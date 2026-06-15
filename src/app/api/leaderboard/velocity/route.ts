import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VelocityEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  // 7-day activity window
  votes_7d: number
  arguments_7d: number
  upvotes_7d: number
  achievements_7d: number
  // Velocity = weighted recent contributions normalised by account age (days)
  // Higher velocity = fast-growing citizen, regardless of seniority
  velocity_score: number
  // Raw growth signals
  clout_7d_est: number
  account_age_days: number
}

export interface VelocityMyStats {
  velocity_score: number
  votes_7d: number
  arguments_7d: number
  upvotes_7d: number
  achievements_7d: number
  clout_7d_est: number
  account_age_days: number
  overallRank: number | null
}

export interface VelocityLeaderboardResponse {
  weekStart: string
  overall: VelocityEntry[]
  byCloutGain: VelocityEntry[]
  byArguerVelocity: VelocityEntry[]
  myStats: VelocityMyStats | null
}

// ─── Weights ──────────────────────────────────────────────────────────────────
// Velocity = (votes * 1 + upvotes * 3 + args * 8 + achievements * 20 + clout * 0.5)
// then normalised by sqrt(account_age_days + 1) so newer active users get a boost.

const W_VOTE = 1
const W_UPVOTE = 3
const W_ARG = 8
const W_ACHIEVEMENT = 20
const W_CLOUT = 0.5

const FETCH_CAP = 15_000

function velocityScore(
  votes: number,
  upvotes: number,
  args: number,
  achievements: number,
  clout7d: number,
  ageDays: number
): number {
  const raw =
    votes * W_VOTE +
    upvotes * W_UPVOTE +
    args * W_ARG +
    achievements * W_ACHIEVEMENT +
    clout7d * W_CLOUT
  // Dampen score for veteran accounts so newcomers can compete
  const ageFactor = Math.sqrt(ageDays + 1)
  return Math.round((raw / ageFactor) * 10) / 10
}

function getWeekStart(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const weekStart = getWeekStart()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── 1. Votes in last 7 days ─────────────────────────────────────────────────
  const { data: voteRows } = await supabase
    .from('votes')
    .select('user_id')
    .gte('created_at', weekStart)
    .limit(FETCH_CAP)

  const voteCounts: Record<string, number> = {}
  for (const row of voteRows ?? []) {
    if (row.user_id) voteCounts[row.user_id] = (voteCounts[row.user_id] ?? 0) + 1
  }

  // ── 2. Arguments & upvotes in last 7 days ──────────────────────────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('user_id, upvotes')
    .gte('created_at', weekStart)
    .limit(FETCH_CAP)

  const argCounts: Record<string, number> = {}
  const upvoteCounts: Record<string, number> = {}
  for (const row of argRows ?? []) {
    if (row.user_id) {
      argCounts[row.user_id] = (argCounts[row.user_id] ?? 0) + 1
      upvoteCounts[row.user_id] = (upvoteCounts[row.user_id] ?? 0) + (row.upvotes ?? 0)
    }
  }

  // ── 3. Achievements earned in last 7 days ───────────────────────────────────
  const { data: achRows } = await supabase
    .from('user_achievements')
    .select('user_id')
    .gte('earned_at', weekStart)
    .limit(FETCH_CAP)

  const achCounts: Record<string, number> = {}
  for (const row of achRows ?? []) {
    if (row.user_id) achCounts[row.user_id] = (achCounts[row.user_id] ?? 0) + 1
  }

  // ── 4. Clout changes: estimate from upvotes on recent arguments ─────────────
  // Approximate clout delta = upvotes * 2 (based on typical clout grant per upvote)
  const clout7dEst: Record<string, number> = {}
  for (const [uid, up] of Object.entries(upvoteCounts)) {
    clout7dEst[uid] = up * 2
  }

  // ── 5. Identify all active users ───────────────────────────────────────────
  const allIds = Array.from(
    new Set([
      ...Object.keys(voteCounts),
      ...Object.keys(argCounts),
      ...Object.keys(achCounts),
    ])
  )

  if (allIds.length === 0) {
    return NextResponse.json({
      weekStart,
      overall: [],
      byCloutGain: [],
      byArguerVelocity: [],
      myStats: null,
    } satisfies VelocityLeaderboardResponse)
  }

  // ── 6. Fetch profiles + account age ────────────────────────────────────────
  const fetchIds = Array.from(new Set([...allIds, ...(user ? [user.id] : [])]))

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, created_at')
    .in('id', fetchIds)

  type ProfileRow = {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
    created_at: string
  }

  const profileMap = new Map<string, ProfileRow>(
    (profileRows as ProfileRow[] ?? []).map((p) => [p.id, p])
  )

  // ── 7. Compute velocity for each active user ────────────────────────────────
  function toEntry(id: string): VelocityEntry | null {
    const p = profileMap.get(id)
    if (!p) return null

    const ageDays = Math.max(
      1,
      Math.floor((Date.now() - new Date(p.created_at).getTime()) / 86_400_000)
    )

    const votes = voteCounts[id] ?? 0
    const args = argCounts[id] ?? 0
    const upvotes = upvoteCounts[id] ?? 0
    const achievements = achCounts[id] ?? 0
    const clout7d = clout7dEst[id] ?? 0

    const vScore = velocityScore(votes, upvotes, args, achievements, clout7d, ageDays)
    if (vScore <= 0) return null

    return {
      user_id: id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role,
      clout: p.clout,
      reputation_score: p.reputation_score,
      votes_7d: votes,
      arguments_7d: args,
      upvotes_7d: upvotes,
      achievements_7d: achievements,
      velocity_score: vScore,
      clout_7d_est: clout7d,
      account_age_days: ageDays,
    }
  }

  const allEntries = allIds
    .map(toEntry)
    .filter((e): e is VelocityEntry => e !== null)

  const LIMIT = 30

  const overall = [...allEntries]
    .sort((a, b) => b.velocity_score - a.velocity_score)
    .slice(0, LIMIT)

  const byCloutGain = [...allEntries]
    .sort((a, b) => b.clout_7d_est - a.clout_7d_est || b.velocity_score - a.velocity_score)
    .slice(0, LIMIT)

  const byArguerVelocity = [...allEntries]
    .filter((e) => e.arguments_7d > 0)
    .sort((a, b) => b.upvotes_7d - a.upvotes_7d || b.arguments_7d - a.arguments_7d)
    .slice(0, LIMIT)

  // ── 8. My stats ────────────────────────────────────────────────────────────
  let myStats: VelocityMyStats | null = null
  if (user) {
    const myEntry = toEntry(user.id)
    if (myEntry) {
      const overallRank =
        overall.findIndex((e) => e.user_id === user.id) + 1 || null
      myStats = {
        velocity_score: myEntry.velocity_score,
        votes_7d: myEntry.votes_7d,
        arguments_7d: myEntry.arguments_7d,
        upvotes_7d: myEntry.upvotes_7d,
        achievements_7d: myEntry.achievements_7d,
        clout_7d_est: myEntry.clout_7d_est,
        account_age_days: myEntry.account_age_days,
        overallRank: overallRank && overallRank <= LIMIT ? overallRank : null,
      }
    }
  }

  return NextResponse.json(
    {
      weekStart,
      overall,
      byCloutGain,
      byArguerVelocity,
      myStats,
    } satisfies VelocityLeaderboardResponse,
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
  )
}
