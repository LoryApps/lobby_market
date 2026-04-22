import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SignalTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  updated_at: string
}

export interface MomentumTopic extends SignalTopic {
  votes_1h: number
  votes_6h: number
  velocity: number // votes/hour (6h window)
}

export interface PulseStat {
  active_topics: number
  voting_topics: number
  laws_this_week: number
  votes_today: number
  arguments_today: number
}

export interface CategoryStat {
  category: string
  proposed: number
  active: number
  voting: number
  law: number
  total: number
  law_rate: number // laws / (laws + failed + active + proposed) * 100
  avg_blue_pct: number
}

export interface SignalsResponse {
  pulse: PulseStat
  breaking_threshold: SignalTopic[]  // 62–79% FOR, active — about to pass
  contested: SignalTopic[]            // 44–56% split, ≥50 votes — tightest fights
  momentum: MomentumTopic[]          // fastest-gaining in last 6h
  categories: CategoryStat[]
  generated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const now = Date.now()

  // Parallel fetches
  const [
    topicsRes,
    lawsWeekRes,
    votesTodayRes,
    argsRes,
    recentVotesRes,
  ] = await Promise.all([
    // All live topics with status + vote data
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, updated_at')
      .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
      .order('total_votes', { ascending: false })
      .limit(500),

    // Laws established this week
    supabase
      .from('topics')
      .select('id, category', { count: 'exact', head: true })
      .eq('status', 'law')
      .gte('updated_at', new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()),

    // Votes cast today
    supabase
      .from('votes')
      .select('topic_id', { count: 'exact', head: true })
      .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString()),

    // Arguments posted today
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(now - 24 * 60 * 60 * 1000).toISOString()),

    // Recent votes for momentum calc (last 6h, capped)
    supabase
      .from('votes')
      .select('topic_id, created_at')
      .gte('created_at', new Date(now - 6 * 60 * 60 * 1000).toISOString())
      .limit(10000),
  ])

  const allTopics = (topicsRes.data ?? []) as SignalTopic[]
  const activeLiveTopics = allTopics.filter(
    (t) => t.status === 'active' || t.status === 'voting'
  )

  // ── Pulse stats ─────────────────────────────────────────────────────────────
  const pulse: PulseStat = {
    active_topics: allTopics.filter((t) => t.status === 'active').length,
    voting_topics: allTopics.filter((t) => t.status === 'voting').length,
    laws_this_week: lawsWeekRes.count ?? 0,
    votes_today: votesTodayRes.count ?? 0,
    arguments_today: argsRes.count ?? 0,
  }

  // ── Breaking threshold — active/voting topics 62-79% FOR ──────────────────
  const breaking_threshold = activeLiveTopics
    .filter((t) => t.blue_pct >= 62 && t.blue_pct < 80 && t.total_votes >= 20)
    .sort((a, b) => b.blue_pct - a.blue_pct)
    .slice(0, 8)

  // ── Contested — 44–56% split, ≥50 votes ──────────────────────────────────
  const contested = activeLiveTopics
    .filter(
      (t) =>
        t.blue_pct >= 44 &&
        t.blue_pct <= 56 &&
        t.total_votes >= 50
    )
    .sort((a, b) => b.total_votes - a.total_votes)
    .slice(0, 8)

  // ── Momentum — votes/hour in last 6h ────────────────────────────────────
  const recentVotes = recentVotesRes.data ?? []
  const votesByTopic: Record<string, number> = {}
  for (const v of recentVotes) {
    votesByTopic[v.topic_id] = (votesByTopic[v.topic_id] ?? 0) + 1
  }

  const topicMap = new Map(allTopics.map((t) => [t.id, t]))
  const momentum: MomentumTopic[] = Object.entries(votesByTopic)
    .map(([topicId, votes6h]) => {
      const t = topicMap.get(topicId)
      if (!t || t.status === 'law' || t.status === 'failed') return null
      return {
        ...t,
        votes_1h: 0,
        votes_6h: votes6h,
        velocity: votes6h / 6,
      } as MomentumTopic
    })
    .filter((x): x is MomentumTopic => x !== null)
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, 8)

  // ── Category stats ──────────────────────────────────────────────────────
  const CATEGORIES = [
    'Economics', 'Politics', 'Technology', 'Science',
    'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]

  const catMap: Record<string, { proposed: number; active: number; voting: number; law: number; failed: number; blue_sum: number; total: number }> = {}
  for (const cat of CATEGORIES) {
    catMap[cat] = { proposed: 0, active: 0, voting: 0, law: 0, failed: 0, blue_sum: 0, total: 0 }
  }

  for (const t of allTopics) {
    const cat = t.category ?? 'Other'
    if (!catMap[cat]) continue
    catMap[cat][t.status as keyof typeof catMap[string]] =
      (catMap[cat][t.status as keyof typeof catMap[string]] as number || 0) + 1
    catMap[cat].blue_sum += t.blue_pct
    catMap[cat].total += 1
  }

  const categories: CategoryStat[] = CATEGORIES.map((cat) => {
    const s = catMap[cat]
    const denominator = s.law + s.failed + s.active + s.proposed
    return {
      category: cat,
      proposed: s.proposed,
      active: s.active,
      voting: s.voting,
      law: s.law,
      total: s.total,
      law_rate: denominator > 0 ? Math.round((s.law / denominator) * 100) : 0,
      avg_blue_pct: s.total > 0 ? Math.round(s.blue_sum / s.total) : 50,
    }
  }).sort((a, b) => b.total - a.total)

  const response: SignalsResponse = {
    pulse,
    breaking_threshold,
    contested,
    momentum,
    categories,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
