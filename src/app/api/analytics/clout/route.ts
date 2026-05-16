import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CloutMonthlyPoint {
  month: string       // "Jan 2026"
  month_key: string   // "2026-01"
  earned: number
  spent: number
  gifted: number
  net: number
}

export interface CloutReasonStat {
  reason: string
  count: number
  total: number
  type: 'earned' | 'spent' | 'gifted' | 'refunded'
}

export interface CloutRecentTx {
  id: string
  type: 'earned' | 'spent' | 'gifted' | 'refunded'
  amount: number
  reason: string
  created_at: string
}

export interface CloutAnalyticsData {
  balance: number
  total_earned: number
  total_spent: number
  total_gifted: number
  tx_count: number
  earning_streak: number          // consecutive months with >0 earned
  best_month: { month: string; earned: number } | null
  monthly: CloutMonthlyPoint[]    // last 12 months
  top_earn_reasons: CloutReasonStat[]
  top_spend_reasons: CloutReasonStat[]
  recent_tx: CloutRecentTx[]
  // Percentile among all users by clout
  clout_rank: number | null
  total_users: number | null
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id

  // Fetch in parallel
  const [txRes, profileRes, rankRes] = await Promise.all([
    supabase
      .from('clout_transactions')
      .select('id, type, amount, reason, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(500),

    supabase
      .from('profiles')
      .select('clout')
      .eq('id', uid)
      .maybeSingle(),

    // Count users with more clout than the current user to get rank
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
  ])

  const transactions = (txRes.data ?? []) as CloutRecentTx[]
  const balance = profileRes.data?.clout ?? 0
  const totalUsers = rankRes.count ?? null

  // ── Aggregate stats ────────────────────────────────────────────────────────

  let totalEarned = 0
  let totalSpent = 0
  let totalGifted = 0

  const earnReasonMap = new Map<string, { count: number; total: number }>()
  const spendReasonMap = new Map<string, { count: number; total: number }>()

  for (const tx of transactions) {
    if (tx.type === 'earned' || tx.type === 'refunded') {
      totalEarned += tx.amount
      const cur = earnReasonMap.get(tx.reason) ?? { count: 0, total: 0 }
      earnReasonMap.set(tx.reason, { count: cur.count + 1, total: cur.total + tx.amount })
    } else if (tx.type === 'spent') {
      totalSpent += Math.abs(tx.amount)
      const cur = spendReasonMap.get(tx.reason) ?? { count: 0, total: 0 }
      spendReasonMap.set(tx.reason, { count: cur.count + 1, total: cur.total + Math.abs(tx.amount) })
    } else if (tx.type === 'gifted') {
      totalGifted += Math.abs(tx.amount)
    }
  }

  // ── Monthly buckets (last 12 months) ──────────────────────────────────────

  const now = new Date()
  const monthBuckets: Map<string, CloutMonthlyPoint> = new Map()

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    monthBuckets.set(key, { month: label, month_key: key, earned: 0, spent: 0, gifted: 0, net: 0 })
  }

  for (const tx of transactions) {
    const d = new Date(tx.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const bucket = monthBuckets.get(key)
    if (!bucket) continue
    if (tx.type === 'earned' || tx.type === 'refunded') {
      bucket.earned += tx.amount
    } else if (tx.type === 'spent') {
      bucket.spent += Math.abs(tx.amount)
    } else if (tx.type === 'gifted') {
      bucket.gifted += Math.abs(tx.amount)
    }
    bucket.net = bucket.earned - bucket.spent - bucket.gifted
  }

  const monthly = Array.from(monthBuckets.values())

  // Best earning month
  const bestMonth = monthly.reduce<{ month: string; earned: number } | null>(
    (best, m) => (m.earned > (best?.earned ?? -1) ? { month: m.month, earned: m.earned } : best),
    null
  )

  // Earning streak (consecutive months ≥1 earned, from most recent)
  let earningStreak = 0
  for (let i = monthly.length - 1; i >= 0; i--) {
    if (monthly[i].earned > 0) earningStreak++
    else break
  }

  // ── Clout rank ─────────────────────────────────────────────────────────────

  let cloutRank: number | null = null
  if (totalUsers !== null) {
    const { count: ahead } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gt('clout', balance)
    cloutRank = (ahead ?? 0) + 1
  }

  // ── Sorted reason stats ─────────────────────────────────────────────────────

  const topEarnReasons: CloutReasonStat[] = Array.from(earnReasonMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([reason, { count, total }]) => ({ reason, count, total, type: 'earned' as const }))

  const topSpendReasons: CloutReasonStat[] = Array.from(spendReasonMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([reason, { count, total }]) => ({ reason, count, total, type: 'spent' as const }))

  const result: CloutAnalyticsData = {
    balance,
    total_earned: totalEarned,
    total_spent: totalSpent,
    total_gifted: totalGifted,
    tx_count: transactions.length,
    earning_streak: earningStreak,
    best_month: bestMonth?.earned ? bestMonth : null,
    monthly,
    top_earn_reasons: topEarnReasons,
    top_spend_reasons: topSpendReasons,
    recent_tx: transactions.slice(0, 20) as CloutRecentTx[],
    clout_rank: cloutRank,
    total_users: totalUsers,
  }

  return NextResponse.json(result)
}
