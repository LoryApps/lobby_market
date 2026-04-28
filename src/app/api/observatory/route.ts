import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CategoryHealth {
  category: string
  total_topics: number
  active_topics: number
  laws: number
  failed: number
  avg_blue_pct: number
  avg_votes: number
  avg_args: number
  conversion_rate: number // proposals → laws (%)
  contested_pct: number  // % of topics 40–60% split
}

export interface PolarizationBucket {
  label: string
  min: number
  max: number
  count: number
  pct: number
  color: string
}

export interface DailyActivity {
  date: string
  new_topics: number
  new_laws: number
}

export interface ObservatoryData {
  // Summary scores (0–100)
  vitality_score: number
  quality_score: number
  polarization_score: number // 0 = perfect consensus, 100 = maximally divided

  // Platform totals
  total_topics: number
  total_laws: number
  total_failed: number
  total_active: number
  total_votes: number
  total_arguments: number
  total_users: number

  // Resolution stats
  law_conversion_rate: number   // % proposed → law
  avg_vote_split: number        // avg blue_pct across all topics with votes
  median_votes_per_topic: number
  avg_args_per_topic: number

  // Topic distribution by split
  polarization_buckets: PolarizationBucket[]

  // Category breakdown
  category_health: CategoryHealth[]

  // 30-day trend (daily new topics + laws)
  daily_activity: DailyActivity[]

  // Extremes
  most_contested_topic: { id: string; statement: string; blue_pct: number; total_votes: number } | null
  most_unified_topic:   { id: string; statement: string; blue_pct: number; total_votes: number } | null
  highest_debate_topic: { id: string; statement: string; arg_count: number; total_votes: number } | null

  generated_at: string
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // ── Fetch all topics (with argument counts) ───────────────────────────────
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at, updated_at')
      .order('created_at', { ascending: false })

    const topics = (topicRows ?? []) as {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
      created_at: string
      updated_at: string
    }[]

    // ── Argument counts per topic ─────────────────────────────────────────────
    const { data: argCountRows } = await supabase
      .from('topic_arguments')
      .select('topic_id')

    const argCountMap = new Map<string, number>()
    for (const row of argCountRows ?? []) {
      const r = row as { topic_id: string }
      argCountMap.set(r.topic_id, (argCountMap.get(r.topic_id) ?? 0) + 1)
    }

    // Argument quality: upvote totals
    const { data: argQualityRows } = await supabase
      .from('topic_arguments')
      .select('topic_id, upvotes')

    let totalUpvotes = 0
    let totalArguments = 0
    const upvoteMap = new Map<string, number>()
    for (const row of argQualityRows ?? []) {
      const r = row as { topic_id: string; upvotes: number }
      upvoteMap.set(r.topic_id, (upvoteMap.get(r.topic_id) ?? 0) + (r.upvotes ?? 0))
      totalUpvotes += r.upvotes ?? 0
      totalArguments++
    }

    // ── Profile count ─────────────────────────────────────────────────────────
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })

    // ── Total votes ───────────────────────────────────────────────────────────
    const { count: totalVotes } = await supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })

    // ─── Derived stats ────────────────────────────────────────────────────────

    const total_topics = topics.length
    const total_laws   = topics.filter(t => t.status === 'law').length
    const total_failed = topics.filter(t => t.status === 'failed').length
    const total_active = topics.filter(t => ['active', 'voting'].includes(t.status)).length

    // Conversion rate: (laws / (laws + failed)) * 100
    const resolved = total_laws + total_failed
    const law_conversion_rate = resolved > 0 ? Math.round((total_laws / resolved) * 100) : 0

    // Topics with meaningful votes (≥ 5)
    const votedTopics = topics.filter(t => t.total_votes >= 5)
    const avg_vote_split = votedTopics.length > 0
      ? Math.round(votedTopics.reduce((s, t) => s + t.blue_pct, 0) / votedTopics.length)
      : 50

    // Median votes per topic
    const sortedVotes = [...topics].map(t => t.total_votes).sort((a, b) => a - b)
    const median_votes_per_topic = sortedVotes.length > 0
      ? sortedVotes[Math.floor(sortedVotes.length / 2)]
      : 0

    const avg_args_per_topic = total_topics > 0
      ? Math.round((totalArguments / total_topics) * 10) / 10
      : 0

    // ─── Polarization buckets ─────────────────────────────────────────────────
    const bucketDefs: { label: string; min: number; max: number; color: string }[] = [
      { label: 'Strong FOR (>70%)',    min: 70, max: 100, color: '#3b82f6' },
      { label: 'Leaning FOR (55–70%)', min: 55, max: 70,  color: '#60a5fa' },
      { label: 'Contested (45–55%)',   min: 45, max: 55,  color: '#f59e0b' },
      { label: 'Leaning AGN (30–45%)', min: 30, max: 45,  color: '#f87171' },
      { label: 'Strong AGN (<30%)',    min: 0,  max: 30,  color: '#ef4444' },
    ]

    const polarization_buckets: PolarizationBucket[] = bucketDefs.map(b => {
      const count = votedTopics.filter(t => t.blue_pct >= b.min && t.blue_pct < b.max).length
      return {
        label: b.label,
        min: b.min,
        max: b.max,
        count,
        pct: votedTopics.length > 0 ? Math.round((count / votedTopics.length) * 100) : 0,
        color: b.color,
      }
    })

    // Polarization score: 0 = everyone in the middle, 100 = all in extremes
    const extremeCount = polarization_buckets
      .filter(b => b.label.includes('Strong'))
      .reduce((s, b) => s + b.count, 0)
    const polarization_score = votedTopics.length > 0
      ? Math.round((extremeCount / votedTopics.length) * 100)
      : 0

    // ─── Category health ──────────────────────────────────────────────────────
    const CATEGORIES = [
      'Politics', 'Economics', 'Technology', 'Ethics', 'Science',
      'Philosophy', 'Culture', 'Health', 'Environment', 'Education', 'Other',
    ]

    const category_health: CategoryHealth[] = CATEGORIES
      .map(cat => {
        const catTopics = topics.filter(t => (t.category ?? 'Other') === cat)
        if (catTopics.length === 0) return null

        const catLaws   = catTopics.filter(t => t.status === 'law').length
        const catFailed = catTopics.filter(t => t.status === 'failed').length
        const catActive = catTopics.filter(t => ['active', 'voting', 'proposed'].includes(t.status)).length
        const catResolved = catLaws + catFailed
        const catVoted = catTopics.filter(t => t.total_votes >= 5)

        const avg_blue_pct = catVoted.length > 0
          ? Math.round(catVoted.reduce((s, t) => s + t.blue_pct, 0) / catVoted.length)
          : 50

        const avg_votes = catTopics.length > 0
          ? Math.round(catTopics.reduce((s, t) => s + t.total_votes, 0) / catTopics.length)
          : 0

        const avg_args = catTopics.length > 0
          ? Math.round((catTopics.reduce((s, t) => s + (argCountMap.get(t.id) ?? 0), 0) / catTopics.length) * 10) / 10
          : 0

        const contested = catVoted.filter(t => t.blue_pct >= 40 && t.blue_pct <= 60).length
        const contested_pct = catVoted.length > 0
          ? Math.round((contested / catVoted.length) * 100)
          : 0

        return {
          category: cat,
          total_topics: catTopics.length,
          active_topics: catActive,
          laws: catLaws,
          failed: catFailed,
          avg_blue_pct,
          avg_votes,
          avg_args,
          conversion_rate: catResolved > 0 ? Math.round((catLaws / catResolved) * 100) : 0,
          contested_pct,
        } satisfies CategoryHealth
      })
      .filter(Boolean) as CategoryHealth[]

    category_health.sort((a, b) => b.total_topics - a.total_topics)

    // ─── 30-day activity trend ────────────────────────────────────────────────
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentTopics = topics.filter(t => new Date(t.created_at) >= thirtyDaysAgo)
    const recentLaws   = topics.filter(t => t.status === 'law' && new Date(t.updated_at) >= thirtyDaysAgo)

    const activityMap = new Map<string, { new_topics: number; new_laws: number }>()
    for (let d = 0; d < 30; d++) {
      const date = new Date()
      date.setDate(date.getDate() - d)
      const key = date.toISOString().slice(0, 10)
      activityMap.set(key, { new_topics: 0, new_laws: 0 })
    }

    for (const t of recentTopics) {
      const key = t.created_at.slice(0, 10)
      const entry = activityMap.get(key)
      if (entry) entry.new_topics++
    }
    for (const t of recentLaws) {
      const key = t.updated_at.slice(0, 10)
      const entry = activityMap.get(key)
      if (entry) entry.new_laws++
    }

    const daily_activity: DailyActivity[] = Array.from(activityMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // ─── Extremes ─────────────────────────────────────────────────────────────
    // Most contested = closest to 50% split with meaningful votes
    const mostContested = votedTopics.length > 0
      ? votedTopics.reduce((best, t) =>
          Math.abs(t.blue_pct - 50) < Math.abs(best.blue_pct - 50) ? t : best
        )
      : null

    // Most unified = furthest from 50% with meaningful votes
    const mostUnified = votedTopics.length > 0
      ? votedTopics.reduce((best, t) =>
          Math.abs(t.blue_pct - 50) > Math.abs(best.blue_pct - 50) ? t : best
        )
      : null

    // Highest debate = most arguments
    const topicsByArgs = [...topics].sort((a, b) =>
      (argCountMap.get(b.id) ?? 0) - (argCountMap.get(a.id) ?? 0)
    )
    const highestDebate = topicsByArgs[0] ?? null

    // ─── Vitality score ───────────────────────────────────────────────────────
    // Based on: recent activity, active topic rate, user base
    const recentActivity = recentTopics.length + recentLaws.length
    const activity_component  = Math.min(100, recentActivity * 5)
    const active_rate_component = total_topics > 0
      ? Math.min(100, (total_active / total_topics) * 200)
      : 0
    const vitality_score = Math.round((activity_component + active_rate_component) / 2)

    // ─── Quality score ────────────────────────────────────────────────────────
    // Based on: arg density, upvote rate, conversion rate
    const arg_density_score    = Math.min(100, avg_args_per_topic * 20)
    const avg_upvote_rate      = totalArguments > 0 ? totalUpvotes / totalArguments : 0
    const upvote_score         = Math.min(100, avg_upvote_rate * 25)
    const conversion_score     = law_conversion_rate
    const quality_score        = Math.round((arg_density_score + upvote_score + conversion_score) / 3)

    const data: ObservatoryData = {
      vitality_score: Math.max(0, Math.min(100, vitality_score)),
      quality_score:  Math.max(0, Math.min(100, quality_score)),
      polarization_score,

      total_topics,
      total_laws,
      total_failed,
      total_active,
      total_votes: totalVotes ?? 0,
      total_arguments: totalArguments,
      total_users: totalUsers ?? 0,

      law_conversion_rate,
      avg_vote_split,
      median_votes_per_topic,
      avg_args_per_topic,

      polarization_buckets,
      category_health,
      daily_activity,

      most_contested_topic: mostContested
        ? { id: mostContested.id, statement: mostContested.statement, blue_pct: mostContested.blue_pct, total_votes: mostContested.total_votes }
        : null,
      most_unified_topic: mostUnified
        ? { id: mostUnified.id, statement: mostUnified.statement, blue_pct: mostUnified.blue_pct, total_votes: mostUnified.total_votes }
        : null,
      highest_debate_topic: highestDebate
        ? { id: highestDebate.id, statement: highestDebate.statement, arg_count: argCountMap.get(highestDebate.id) ?? 0, total_votes: highestDebate.total_votes }
        : null,

      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[observatory]', err)
    return NextResponse.json({ error: 'Failed to load observatory data' }, { status: 500 })
  }
}
