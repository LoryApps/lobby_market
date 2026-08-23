import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetentionMonth {
  month_key: string   // "2025-08"
  month: string       // "Aug 2025"
  vote_count: number
  is_active: boolean
}

export interface RetentionData {
  monthly_grid: RetentionMonth[]
  joined_month: string          // "Aug 2025"
  joined_month_key: string      // "2025-08"
  total_months: number          // months since joining (inclusive)
  active_months: number
  retention_rate: number        // 0–100
  current_streak: number        // consecutive recent active months
  best_streak: number
  total_votes: number
  avg_votes_per_active_month: number
  most_active_month: RetentionMonth | null
  last_active_month: string | null  // display label
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id

  const [profileRes, votesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('created_at')
      .eq('id', uid)
      .maybeSingle(),
    supabase
      .from('votes')
      .select('created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: true }),
  ])

  const votes = votesRes.data ?? []

  // Determine join date — fall back to first vote if profile missing
  const joinDate = profileRes.data?.created_at
    ? new Date(profileRes.data.created_at)
    : votes[0]?.created_at
      ? new Date(votes[0].created_at)
      : new Date()

  const now = new Date()

  // Normalise to first day of each month for comparison
  const joinYear  = joinDate.getFullYear()
  const joinMonth = joinDate.getMonth()  // 0-indexed

  const nowYear  = now.getFullYear()
  const nowMonth = now.getMonth()

  // Build the full month grid from join month → current month (inclusive)
  const grid: RetentionMonth[] = []
  let y = joinYear, m = joinMonth
  while (y < nowYear || (y === nowYear && m <= nowMonth)) {
    const key   = `${y}-${String(m + 1).padStart(2, '0')}`
    const label = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    grid.push({ month_key: key, month: label, vote_count: 0, is_active: false })
    m++
    if (m > 11) { m = 0; y++ }
  }

  function toKey(iso: string): string {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  // Tally votes into months
  for (const v of votes) {
    const cell = grid.find(c => c.month_key === toKey(v.created_at))
    if (cell) { cell.vote_count++; cell.is_active = true }
  }

  const totalMonths  = grid.length
  const activeMonths = grid.filter(c => c.is_active).length
  const retentionRate = totalMonths > 0 ? Math.round((activeMonths / totalMonths) * 100) : 0

  // Current streak — count back from most recent month
  let currentStreak = 0
  for (let i = grid.length - 1; i >= 0; i--) {
    if (grid[i].is_active) currentStreak++
    else break
  }

  // Best streak
  let bestStreak = 0, runStreak = 0
  for (const cell of grid) {
    if (cell.is_active) {
      runStreak++
      if (runStreak > bestStreak) bestStreak = runStreak
    } else {
      runStreak = 0
    }
  }

  const totalVotes = votes.length
  const avgVotesPerActiveMonth = activeMonths > 0
    ? Math.round((totalVotes / activeMonths) * 10) / 10
    : 0

  const mostActiveMonth = [...grid].sort((a, b) => b.vote_count - a.vote_count)[0] ?? null
  const lastActive = [...grid].filter(c => c.is_active).pop() ?? null

  const joinCell = grid[0]

  const result: RetentionData = {
    monthly_grid: grid,
    joined_month: joinCell?.month ?? '',
    joined_month_key: joinCell?.month_key ?? '',
    total_months: totalMonths,
    active_months: activeMonths,
    retention_rate: retentionRate,
    current_streak: currentStreak,
    best_streak: bestStreak,
    total_votes: totalVotes,
    avg_votes_per_active_month: avgVotesPerActiveMonth,
    most_active_month: mostActiveMonth?.vote_count ?? 0 > 0 ? mostActiveMonth : null,
    last_active_month: lastActive?.month ?? null,
  }

  return NextResponse.json(result)
}
