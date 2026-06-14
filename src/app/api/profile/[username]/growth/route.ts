import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GrowthMonth {
  month: string      // YYYY-MM
  votes: number
  arguments: number
  clout_earned: number
  debates: number
}

export interface GrowthMilestone {
  label: string
  occurred_at: string
  type: 'first_vote' | 'first_argument' | 'first_debate' | 'achievement' | 'role_upgrade' | 'law_passed' | 'streak'
  detail?: string
}

export interface GrowthResponse {
  profile: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
    total_votes: number
    total_arguments: number
    vote_streak: number
    created_at: string
  }
  monthly: GrowthMonth[]
  milestones: GrowthMilestone[]
  totals: {
    votes: number
    arguments: number
    clout_earned: number
    debates: number
    laws_contributed: number
    achievements_earned: number
    days_active: number
  }
  isOwnProfile: boolean
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  // Fetch the target profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, total_arguments, vote_streak, created_at')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Determine if viewer is the profile owner
  const { data: { user } } = await supabase.auth.getUser()
  const isOwnProfile = user?.id === profile.id

  const userId = profile.id
  const memberSince = new Date(profile.created_at)
  const now = new Date()

  // ── Fetch all votes (up to 2 years of history) ──────────────────────────────
  const twoYearsAgo = new Date(now)
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

  const [votesRes, argsRes, debatesRes, achievementsRes, cloutRes] = await Promise.all([
    supabase
      .from('votes')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', twoYearsAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(5000),

    supabase
      .from('arguments')
      .select('id, created_at, upvotes')
      .eq('author_id', userId)
      .gte('created_at', twoYearsAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(2000),

    supabase
      .from('debate_participants')
      .select('id, created_at, debate_id')
      .eq('user_id', userId)
      .gte('created_at', twoYearsAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(500),

    supabase
      .from('user_achievements')
      .select('achievement_id, earned_at, achievements(name, tier, icon, description)')
      .eq('user_id', userId)
      .order('earned_at', { ascending: true })
      .limit(200),

    supabase
      .from('clout_transactions')
      .select('id, amount, type, created_at, reason')
      .eq('user_id', userId)
      .eq('type', 'earned')
      .gte('created_at', twoYearsAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(2000),
  ])

  const votes = votesRes.data ?? []
  const args = argsRes.data ?? []
  const debates = debatesRes.data ?? []
  const achievements = achievementsRes.data ?? []
  const cloutTxns = cloutRes.data ?? []

  // ── Count laws where user voted FOR ─────────────────────────────────────────
  const { count: lawsContributed } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('side', 'blue')

  // ── Build monthly buckets ────────────────────────────────────────────────────
  const monthMap = new Map<string, GrowthMonth>()

  function getMonth(iso: string) {
    return iso.slice(0, 7) // YYYY-MM
  }

  function ensureMonth(month: string) {
    if (!monthMap.has(month)) {
      monthMap.set(month, { month, votes: 0, arguments: 0, clout_earned: 0, debates: 0 })
    }
    return monthMap.get(month)!
  }

  for (const v of votes) {
    ensureMonth(getMonth(v.created_at)).votes++
  }
  for (const a of args) {
    ensureMonth(getMonth(a.created_at)).arguments++
  }
  for (const d of debates) {
    ensureMonth(getMonth(d.created_at)).debates++
  }
  for (const t of cloutTxns) {
    if (t.amount > 0) {
      ensureMonth(getMonth(t.created_at)).clout_earned += t.amount
    }
  }

  // Fill all months from member join to now
  const cursor = new Date(memberSince.getFullYear(), memberSince.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    ensureMonth(key)
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const monthly = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month))

  // ── Build milestones ─────────────────────────────────────────────────────────
  const milestones: GrowthMilestone[] = []

  if (votes.length > 0) {
    milestones.push({
      label: 'Cast first vote',
      occurred_at: votes[0].created_at,
      type: 'first_vote',
    })
  }

  if (args.length > 0) {
    milestones.push({
      label: 'Posted first argument',
      occurred_at: args[0].created_at,
      type: 'first_argument',
    })
  }

  if (debates.length > 0) {
    milestones.push({
      label: 'Entered first debate',
      occurred_at: debates[0].created_at,
      type: 'first_debate',
    })
  }

  // Streak milestones
  const STREAK_MILESTONES = [7, 30, 100, 365]
  for (const days of STREAK_MILESTONES) {
    if ((profile.vote_streak ?? 0) >= days) {
      milestones.push({
        label: `${days}-day voting streak`,
        occurred_at: now.toISOString(),
        type: 'streak',
        detail: `${days} consecutive days`,
      })
    }
  }

  // Achievement milestones (up to 10 most notable)
  const tierOrder: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 }
  const topAchievements = [...achievements]
    .sort((a, b) => {
      const aT = (a.achievements as unknown as { tier?: string } | null)?.tier ?? 'common'
      const bT = (b.achievements as unknown as { tier?: string } | null)?.tier ?? 'common'
      return (tierOrder[bT] ?? 0) - (tierOrder[aT] ?? 0)
    })
    .slice(0, 8)

  for (const ua of topAchievements) {
    const ach = ua.achievements as unknown as { name: string; tier: string; icon: string | null; description: string } | null
    if (ach) {
      milestones.push({
        label: ach.name,
        occurred_at: ua.earned_at,
        type: 'achievement',
        detail: ach.tier,
      })
    }
  }

  // Sort milestones chronologically
  milestones.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())

  // ── Totals ───────────────────────────────────────────────────────────────────
  const totalCloutEarned = cloutTxns.reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0)

  // Days active = distinct calendar days with any action
  const activeDays = new Set([
    ...votes.map((v) => v.created_at.slice(0, 10)),
    ...args.map((a) => a.created_at.slice(0, 10)),
    ...debates.map((d) => d.created_at.slice(0, 10)),
  ])

  return NextResponse.json({
    profile,
    monthly,
    milestones,
    totals: {
      votes: votes.length,
      arguments: args.length,
      clout_earned: totalCloutEarned,
      debates: debates.length,
      laws_contributed: lawsContributed ?? 0,
      achievements_earned: achievements.length,
      days_active: activeDays.size,
    },
    isOwnProfile,
  } satisfies GrowthResponse)
}
