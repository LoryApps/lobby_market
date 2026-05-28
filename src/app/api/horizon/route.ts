import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NearLawTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  gap_to_law: number       // percentage points until 67% law threshold
  votes_needed: number     // estimated votes needed at current ratio
  created_at: string
  view_count: number
}

export interface ApproachingVoteTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  gap_to_majority: number  // percentage points until 51% majority
  momentum: number         // recent vote velocity indicator
  created_at: string
}

export interface EarlyMomentumTopic {
  id: string
  statement: string
  category: string | null
  status: string
  scope: string | null
  blue_pct: number
  total_votes: number
  hours_old: number
  votes_per_hour: number
  created_at: string
}

export interface UpcomingDebate {
  id: string
  title: string
  type: string
  scheduled_at: string
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  hours_until: number
  participant_count: number
}

export interface CategoryForecast {
  category: string
  near_law_count: number
  approaching_vote_count: number
  total_active: number
  readiness_score: number   // 0–100: how many topics are "close" to thresholds
}

export interface HorizonStats {
  total_near_law: number
  total_approaching_vote: number
  total_upcoming_debates: number
  total_early_momentum: number
  most_active_category: string | null
}

export interface HorizonResponse {
  near_law: NearLawTopic[]
  approaching_vote: ApproachingVoteTopic[]
  early_momentum: EarlyMomentumTopic[]
  upcoming_debates: UpcomingDebate[]
  category_forecast: CategoryForecast[]
  stats: HorizonStats
  generated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const now = new Date()

  // Run all queries in parallel
  const [topicsRes, debatesRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, scope, blue_pct, total_votes, view_count, created_at')
      .in('status', ['proposed', 'active', 'voting'])
      .order('total_votes', { ascending: false })
      .limit(500),
    supabase
      .from('debates')
      .select('id, title, type, scheduled_at, topic_id')
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10),
  ])

  const topics = topicsRes.data ?? []
  const debates = debatesRes.data ?? []

  // ── 1. Near-Law: voting/active topics at 60%+ FOR, within 7pts of law ──────
  const nearLaw: NearLawTopic[] = topics
    .filter((t) => t.blue_pct >= 60 && t.total_votes >= 20)
    .map((t) => {
      const gap = 67 - t.blue_pct
      const votesFor = Math.round(t.total_votes * (t.blue_pct / 100))
      // Minimum votes needed for 67% — solve: (votesFor + x) / (total + x) = 0.67
      const rawNeeded = gap <= 0 ? 0 : Math.ceil((0.67 * t.total_votes - votesFor) / 0.33)
      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        scope: t.scope,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        gap_to_law: Math.max(0, gap),
        votes_needed: Math.max(0, rawNeeded),
        created_at: t.created_at,
        view_count: t.view_count ?? 0,
      }
    })
    .sort((a, b) => a.gap_to_law - b.gap_to_law)
    .slice(0, 12)

  // ── 2. Approaching Vote: topics between 42–59% FOR, gaining momentum ────────
  const approachingVote: ApproachingVoteTopic[] = topics
    .filter((t) => t.blue_pct >= 42 && t.blue_pct < 60 && t.total_votes >= 10)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      scope: t.scope,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      gap_to_majority: Math.max(0, 51 - t.blue_pct),
      momentum: Math.min(100, Math.round((t.total_votes / 50) * 10)),
      created_at: t.created_at,
    }))
    .sort((a, b) => a.gap_to_majority - b.gap_to_majority)
    .slice(0, 10)

  // ── 3. Early Momentum: topics < 48h old with growing vote velocity ───────────
  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const earlyMomentum: EarlyMomentumTopic[] = topics
    .filter((t) => t.created_at >= cutoff48h && t.total_votes >= 5)
    .map((t) => {
      const hoursOld = Math.max(1, (now.getTime() - new Date(t.created_at).getTime()) / (60 * 60 * 1000))
      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        scope: t.scope,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        hours_old: Math.round(hoursOld),
        votes_per_hour: parseFloat((t.total_votes / hoursOld).toFixed(1)),
        created_at: t.created_at,
      }
    })
    .sort((a, b) => b.votes_per_hour - a.votes_per_hour)
    .slice(0, 8)

  // ── 4. Upcoming Debates ────────────────────────────────────────────────────
  // Fetch topic statements for debates
  const topicIds = debates.map((d) => d.topic_id).filter(Boolean) as string[]
  let topicMap: Record<string, { statement: string; category: string | null }> = {}
  if (topicIds.length > 0) {
    const { data: debateTopics } = await supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', topicIds)
    if (debateTopics) {
      topicMap = Object.fromEntries(debateTopics.map((t) => [t.id, { statement: t.statement, category: t.category }]))
    }
  }

  const upcomingDebates: UpcomingDebate[] = debates.map((d) => {
    const scheduledAt = new Date(d.scheduled_at)
    const hoursUntil = (scheduledAt.getTime() - now.getTime()) / (60 * 60 * 1000)
    const topicInfo = d.topic_id ? (topicMap[d.topic_id] ?? null) : null
    return {
      id: d.id,
      title: d.title,
      type: d.type,
      scheduled_at: d.scheduled_at,
      topic_id: d.topic_id ?? null,
      topic_statement: topicInfo?.statement ?? null,
      topic_category: topicInfo?.category ?? null,
      hours_until: Math.max(0, parseFloat(hoursUntil.toFixed(1))),
      participant_count: 0,
    }
  })

  // ── 5. Category Forecast ──────────────────────────────────────────────────
  const CATEGORIES = ['Economics', 'Politics', 'Technology', 'Science', 'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education']
  const categoryForecast: CategoryForecast[] = CATEGORIES.map((cat) => {
    const catTopics = topics.filter((t) => t.category === cat)
    const nearLawInCat = catTopics.filter((t) => t.blue_pct >= 60 && t.total_votes >= 20).length
    const approachingInCat = catTopics.filter((t) => t.blue_pct >= 42 && t.blue_pct < 60 && t.total_votes >= 10).length
    const totalActive = catTopics.length
    const readiness = totalActive === 0 ? 0 : Math.round(((nearLawInCat * 2 + approachingInCat) / Math.max(1, totalActive)) * 50)
    return {
      category: cat,
      near_law_count: nearLawInCat,
      approaching_vote_count: approachingInCat,
      total_active: totalActive,
      readiness_score: Math.min(100, readiness),
    }
  }).filter((c) => c.total_active > 0).sort((a, b) => b.readiness_score - a.readiness_score)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const mostActive = categoryForecast[0]?.category ?? null
  const stats: HorizonStats = {
    total_near_law: nearLaw.length,
    total_approaching_vote: approachingVote.length,
    total_upcoming_debates: upcomingDebates.length,
    total_early_momentum: earlyMomentum.length,
    most_active_category: mostActive,
  }

  const response: HorizonResponse = {
    near_law: nearLaw,
    approaching_vote: approachingVote,
    early_momentum: earlyMomentum,
    upcoming_debates: upcomingDebates,
    category_forecast: categoryForecast,
    stats,
    generated_at: now.toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=60' },
  })
}
