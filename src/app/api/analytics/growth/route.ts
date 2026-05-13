import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyActivityPoint {
  month: string      // "Jan 2026" display label
  month_key: string  // "2026-01" for sorting
  votes: number
  arguments: number
  debates: number
  achievements: number
  total: number
}

export interface GrowthMilestone {
  label: string
  date: string       // ISO string
  category: 'vote' | 'argument' | 'law' | 'streak' | 'achievement' | 'debate'
  value?: number
}

export interface GrowthData {
  monthly_activity: MonthlyActivityPoint[]
  // Summary stats
  total_active_months: number
  best_month: { month: string; total: number } | null
  best_month_votes: { month: string; count: number } | null
  best_month_arguments: { month: string; count: number } | null
  // Momentum (recent 30d vs prior 30d)
  recent_30_total: number
  prior_30_total: number
  momentum_pct: number | null   // null = no prior activity
  is_surging: boolean
  // All-time milestones
  milestones: GrowthMilestone[]
  // Raw counts for header stats
  total_votes: number
  total_arguments: number
  first_activity_date: string | null
  days_since_first: number | null
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id

  // Run all fetches in parallel
  const [votesRes, argumentsRes, debatesRes, achievementsRes, profileRes] =
    await Promise.all([
      // votes with created_at
      supabase
        .from('votes')
        .select('created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: true }),

      // arguments with created_at
      supabase
        .from('topic_arguments')
        .select('created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: true }),

      // debate participations — check debate_messages or debate_sessions
      supabase
        .from('debate_messages')
        .select('created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: true }),

      // user_achievements with earned_at
      supabase
        .from('user_achievements')
        .select('earned_at')
        .eq('user_id', uid)
        .order('earned_at', { ascending: true }),

      // profile for total_votes, vote_streak, best_vote_streak
      supabase
        .from('profiles')
        .select('total_votes, vote_streak, clout, reputation_score, member_since')
        .eq('id', uid)
        .maybeSingle(),
    ])

  const votes      = votesRes.data      ?? []
  const args       = argumentsRes.data  ?? []
  const debates    = debatesRes.data    ?? []
  const achievements = achievementsRes.data ?? []
  const profile    = profileRes.data

  // ─── Build month buckets (last 14 months) ─────────────────────────────────

  const now = new Date()
  const months: MonthlyActivityPoint[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    months.push({ month: label, month_key: key, votes: 0, arguments: 0, debates: 0, achievements: 0, total: 0 })
  }

  function toKey(iso: string): string {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  for (const v of votes) {
    const m = months.find(x => x.month_key === toKey(v.created_at))
    if (m) { m.votes++; m.total++ }
  }
  for (const a of args) {
    const m = months.find(x => x.month_key === toKey(a.created_at))
    if (m) { m.arguments++; m.total++ }
  }
  for (const d of debates) {
    const m = months.find(x => x.month_key === toKey(d.created_at))
    if (m) { m.debates++; m.total++ }
  }
  for (const ac of achievements) {
    if (!ac.earned_at) continue
    const m = months.find(x => x.month_key === toKey(ac.earned_at))
    if (m) { m.achievements++; m.total++ }
  }

  // ─── Best months ──────────────────────────────────────────────────────────

  const totalActive = months.filter(m => m.total > 0).length
  const sorted = [...months].sort((a, b) => b.total - a.total)
  const bestMonth = sorted[0]?.total > 0
    ? { month: sorted[0].month, total: sorted[0].total }
    : null

  const sortedVotes = [...months].sort((a, b) => b.votes - a.votes)
  const bestMonthVotes = sortedVotes[0]?.votes > 0
    ? { month: sortedVotes[0].month, count: sortedVotes[0].votes }
    : null

  const sortedArgs = [...months].sort((a, b) => b.arguments - a.arguments)
  const bestMonthArgs = sortedArgs[0]?.arguments > 0
    ? { month: sortedArgs[0].month, count: sortedArgs[0].arguments }
    : null

  // ─── Momentum (recent 30d vs prior 30d) ──────────────────────────────────

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000).toISOString()
  const sixtyDaysAgo  = new Date(now.getTime() - 60 * 86400_000).toISOString()

  const recent30 =
    votes.filter(v => v.created_at >= thirtyDaysAgo).length +
    args.filter(a => a.created_at >= thirtyDaysAgo).length +
    debates.filter(d => d.created_at >= thirtyDaysAgo).length

  const prior30 =
    votes.filter(v => v.created_at >= sixtyDaysAgo && v.created_at < thirtyDaysAgo).length +
    args.filter(a => a.created_at >= sixtyDaysAgo && a.created_at < thirtyDaysAgo).length +
    debates.filter(d => d.created_at >= sixtyDaysAgo && d.created_at < thirtyDaysAgo).length

  const momentumPct =
    prior30 === 0 ? null : Math.round(((recent30 - prior30) / prior30) * 100)
  const isSurging = momentumPct !== null ? momentumPct >= 10 : recent30 > 0

  // ─── First activity ────────────────────────────────────────────────────────

  const allDates = [
    ...votes.map(v => v.created_at),
    ...args.map(a => a.created_at),
  ].filter(Boolean).sort()
  const firstDate = allDates[0] ?? profile?.member_since ?? null
  const daysSinceFirst = firstDate
    ? Math.floor((now.getTime() - new Date(firstDate).getTime()) / 86400_000)
    : null

  // ─── Milestones ────────────────────────────────────────────────────────────

  const milestones: GrowthMilestone[] = []

  // First vote milestone
  if (votes[0]) {
    milestones.push({ label: 'First vote cast', date: votes[0].created_at, category: 'vote' })
  }
  // Vote count milestones
  for (const n of [10, 50, 100, 250, 500, 1000]) {
    if (votes.length >= n && votes[n - 1]) {
      milestones.push({ label: `${n} votes cast`, date: votes[n - 1].created_at, category: 'vote', value: n })
    }
  }
  // First argument
  if (args[0]) {
    milestones.push({ label: 'First argument posted', date: args[0].created_at, category: 'argument' })
  }
  // Argument count milestones
  for (const n of [5, 25, 50, 100]) {
    if (args.length >= n && args[n - 1]) {
      milestones.push({ label: `${n} arguments written`, date: args[n - 1].created_at, category: 'argument', value: n })
    }
  }
  // First achievement
  if (achievements[0]?.earned_at) {
    milestones.push({ label: 'First achievement earned', date: achievements[0].earned_at, category: 'achievement' })
  }
  // Achievement count milestones
  for (const n of [5, 10, 25]) {
    if (achievements.length >= n && achievements[n - 1]?.earned_at) {
      milestones.push({ label: `${n} achievements earned`, date: achievements[n - 1].earned_at, category: 'achievement', value: n })
    }
  }

  // Sort milestones chronologically
  milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  // Take most recent 12 milestones
  const recentMilestones = milestones.slice(-12)

  const result: GrowthData = {
    monthly_activity: months,
    total_active_months: totalActive,
    best_month: bestMonth,
    best_month_votes: bestMonthVotes,
    best_month_arguments: bestMonthArgs,
    recent_30_total: recent30,
    prior_30_total: prior30,
    momentum_pct: momentumPct,
    is_surging: isSurging,
    milestones: recentMilestones,
    total_votes: votes.length,
    total_arguments: args.length,
    first_activity_date: firstDate,
    days_since_first: daysSinceFirst,
  }

  return NextResponse.json(result)
}
