import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface DailyCount {
  date: string
  count: number
}

interface CategoryCount {
  category: string
  count: number
  blue: number
  red: number
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch core profile stats
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'total_votes, blue_vote_count, red_vote_count, vote_streak, clout, reputation_score, total_arguments, created_at'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Fetch all votes with topic info for deeper analysis
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('id, side, created_at, topic_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  const votes = votesRaw ?? []

  // Get topic details for voted topics
  const topicIds = Array.from(new Set(votes.map((v) => v.topic_id)))
  let topicMap: Map<string, { status: string; category: string | null; blue_pct: number }> =
    new Map()

  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, status, category, blue_pct')
      .in('id', topicIds)

    if (topics) {
      topicMap = new Map(
        topics.map((t) => [t.id, { status: t.status, category: t.category, blue_pct: t.blue_pct }])
      )
    }
  }

  // Vote accuracy: % of resolved votes where user was on winning side
  const resolvedVotes = votes.filter((v) => {
    const t = topicMap.get(v.topic_id)
    return t && (t.status === 'law' || t.status === 'failed')
  })

  const correctVotes = resolvedVotes.filter((v) => {
    const t = topicMap.get(v.topic_id)!
    if (t.status === 'law') return v.side === 'blue'
    if (t.status === 'failed') return v.side === 'red'
    return false
  })

  const accuracy =
    resolvedVotes.length > 0
      ? Math.round((correctVotes.length / resolvedVotes.length) * 100)
      : null

  // Category breakdown from votes
  const categoryMap = new Map<string, CategoryCount>()
  for (const v of votes) {
    const t = topicMap.get(v.topic_id)
    const cat = t?.category ?? 'Uncategorized'
    const existing = categoryMap.get(cat) ?? { category: cat, count: 0, blue: 0, red: 0 }
    existing.count++
    if (v.side === 'blue') existing.blue++
    else existing.red++
    categoryMap.set(cat, existing)
  }

  const topCategories = Array.from(categoryMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // Daily activity for last 28 days
  const now = new Date()
  const dailyMap = new Map<string, number>()

  // Initialize last 28 days
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dailyMap.set(d.toISOString().slice(0, 10), 0)
  }

  for (const v of votes) {
    const day = v.created_at.slice(0, 10)
    if (dailyMap.has(day)) {
      dailyMap.set(day, (dailyMap.get(day) ?? 0) + 1)
    }
  }

  const dailyActivity: DailyCount[] = Array.from(dailyMap.entries()).map(
    ([date, count]) => ({ date, count })
  )

  // Monthly totals for last 6 months
  const monthlyMap = new Map<string, number>()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthlyMap.set(key, 0)
  }
  for (const v of votes) {
    const month = v.created_at.slice(0, 7)
    if (monthlyMap.has(month)) {
      monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + 1)
    }
  }
  const monthlyActivity = Array.from(monthlyMap.entries()).map(([month, count]) => ({
    month,
    count,
  }))

  return NextResponse.json({
    profile: {
      total_votes: profile.total_votes,
      blue_vote_count: profile.blue_vote_count,
      red_vote_count: profile.red_vote_count,
      vote_streak: profile.vote_streak,
      clout: profile.clout,
      reputation_score: profile.reputation_score,
      total_arguments: profile.total_arguments,
      member_since: profile.created_at,
    },
    accuracy,
    resolved_votes: resolvedVotes.length,
    topCategories,
    dailyActivity,
    monthlyActivity,
  })
}
