import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Tier logic (mirror of /api/league) ──────────────────────────────────────

interface TierDef { name: string; minLP: number; maxLP: number | null; color: string; rank: number }

const TIERS: TierDef[] = [
  { name: 'Bystander', minLP: 0,   maxLP: 49,   color: '#6b7280', rank: 0 },
  { name: 'Citizen',   minLP: 50,  maxLP: 199,  color: '#93c5fd', rank: 1 },
  { name: 'Delegate',  minLP: 200, maxLP: 499,  color: '#cd7f32', rank: 2 },
  { name: 'Lawmaker',  minLP: 500, maxLP: 999,  color: '#9ca3af', rank: 3 },
  { name: 'Senator',   minLP: 1000, maxLP: 2499, color: '#c9a84c', rank: 4 },
  { name: 'Champion',  minLP: 2500, maxLP: null, color: '#a855f7', rank: 5 },
]

function getTier(lp: number): TierDef {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (lp >= TIERS[i].minLP) return TIERS[i]
  }
  return TIERS[0]
}

function getTierProgress(lp: number) {
  const tier = getTier(lp)
  const nextTier = TIERS.find((t) => t.rank === tier.rank + 1) ?? null
  if (!nextTier) return { tier, nextTier: null, progressPct: 100, lpToNext: null }
  const range = nextTier.minLP - tier.minLP
  const earned = lp - tier.minLP
  return {
    tier,
    nextTier,
    progressPct: Math.min(100, Math.round((earned / range) * 100)),
    lpToNext: nextTier.minLP - lp,
  }
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface DashboardProfile {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  vote_streak: number
  total_votes: number
  total_arguments: number
  reputation_score: number
  civic_archetype: string | null
}

export interface DashboardLeague {
  monthly_lp: number
  tier_name: string
  tier_color: string
  tier_rank: number
  next_tier_name: string | null
  progress_pct: number
  lp_to_next: number | null
  season_name: string
  days_left: number
}

export interface DashboardPrediction {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  predicted_law: boolean
  confidence: number
  law_confidence: number | null
  resolved_at: string | null
  correct: boolean | null
}

export interface DashboardWatchedTopic {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  subscribed_at: string
}

export interface DashboardMissionSummary {
  completed: number
  total: number
  clout_earned_today: number
}

export interface DashboardRecentActivity {
  votes_today: number
  arguments_today: number
}

export interface DashboardResponse {
  profile: DashboardProfile
  league: DashboardLeague
  predictions: DashboardPrediction[]
  watched_topics: DashboardWatchedTopic[]
  mission_summary: DashboardMissionSummary
  recent_activity: DashboardRecentActivity
  last_law: { statement: string; topic_id: string; established_at: string } | null
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 1. Profile ───────────────────────────────────────────────────────────────
  const { data: profileRow } = await supabase
    .from('profiles')
    .select(
      'username, display_name, avatar_url, role, clout, vote_streak, total_votes, total_arguments, reputation_score, civic_archetype'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profileRow) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const profile: DashboardProfile = profileRow as DashboardProfile

  // ── 2. League standing ───────────────────────────────────────────────────────
  const now = new Date()
  const seasonStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const seasonEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const MONTH_NAMES = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ]
  const seasonName = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
  const daysLeft = Math.ceil((seasonEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  const { data: txRows } = await supabase
    .from('clout_transactions')
    .select('amount')
    .eq('user_id', user.id)
    .eq('type', 'earned')
    .gte('created_at', seasonStart.toISOString())
    .lte('created_at', seasonEnd.toISOString())

  const monthly_lp = (txRows ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const tierInfo = getTierProgress(monthly_lp)

  const league: DashboardLeague = {
    monthly_lp,
    tier_name: tierInfo.tier.name,
    tier_color: tierInfo.tier.color,
    tier_rank: tierInfo.tier.rank,
    next_tier_name: tierInfo.nextTier?.name ?? null,
    progress_pct: tierInfo.progressPct,
    lp_to_next: tierInfo.lpToNext,
    season_name: seasonName,
    days_left: daysLeft,
  }

  // ── 3. Active predictions (user's unresolved) ────────────────────────────────
  const { data: predRows } = await supabase
    .from('topic_predictions')
    .select('topic_id, predicted_law, confidence, resolved_at, correct')
    .eq('user_id', user.id)
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(5)

  const activePreds = predRows ?? []
  const predTopicIds = activePreds.map((p) => p.topic_id)

  let predictions: DashboardPrediction[] = []
  if (predTopicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct')
      .in('id', predTopicIds)

    const { data: statsRows } = await supabase
      .from('topic_prediction_stats')
      .select('topic_id, law_confidence')
      .in('topic_id', predTopicIds)

    const topicMap = new Map((topicRows ?? []).map((t) => [t.id, t]))
    const statsMap = new Map((statsRows ?? []).map((s) => [s.topic_id, s.law_confidence as number]))

    predictions = activePreds.map((p) => {
      const t = topicMap.get(p.topic_id)
      return {
        topic_id: p.topic_id,
        statement: t?.statement ?? '',
        category: t?.category ?? null,
        status: t?.status ?? 'active',
        blue_pct: t?.blue_pct ?? 50,
        predicted_law: p.predicted_law,
        confidence: p.confidence,
        law_confidence: statsMap.get(p.topic_id) ?? null,
        resolved_at: p.resolved_at,
        correct: p.correct,
      }
    }).filter((p) => p.statement)
  }

  // ── 4. Subscribed / watched topics ───────────────────────────────────────────
  const { data: subRows } = await supabase
    .from('topic_subscriptions')
    .select('topic_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(6)

  const subTopicIds = (subRows ?? []).map((s) => s.topic_id)
  let watched_topics: DashboardWatchedTopic[] = []
  if (subTopicIds.length > 0) {
    const { data: watchedTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', subTopicIds)

    const subMap = new Map((subRows ?? []).map((s) => [s.topic_id, s.created_at as string]))

    watched_topics = (watchedTopics ?? [])
      .map((t) => ({
        topic_id: t.id,
        statement: t.statement,
        category: t.category ?? null,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        subscribed_at: subMap.get(t.id) ?? '',
      }))
      .sort((a, b) => {
        // Sort: voting phase first, then active, then rest
        const order: Record<string, number> = { voting: 0, active: 1, proposed: 2, law: 3, failed: 4 }
        return (order[a.status] ?? 99) - (order[b.status] ?? 99)
      })
  }

  // ── 5. Mission summary ────────────────────────────────────────────────────────
  // Approximate: count today's clout earned from mission-related transactions
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { data: todayTxRows } = await supabase
    .from('clout_transactions')
    .select('amount, reason')
    .eq('user_id', user.id)
    .eq('type', 'earned')
    .gte('created_at', todayStart.toISOString())

  const todayTx = todayTxRows ?? []
  const clout_earned_today = todayTx.reduce((sum, t) => sum + (t.amount ?? 0), 0)
  // Estimate mission completions by unique reasons (each distinct transaction source)
  const uniqueReasons = new Set(todayTx.map((t) => t.reason).filter(Boolean))
  const mission_summary: DashboardMissionSummary = {
    completed: Math.min(uniqueReasons.size, 5),
    total: 5,
    clout_earned_today,
  }

  // ── 6. Activity today ─────────────────────────────────────────────────────────
  const { count: votes_today } = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', todayStart.toISOString())

  const { count: arguments_today } = await supabase
    .from('topic_arguments')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', user.id)
    .gte('created_at', todayStart.toISOString())

  const recent_activity: DashboardRecentActivity = {
    votes_today: votes_today ?? 0,
    arguments_today: arguments_today ?? 0,
  }

  // ── 7. Last established law ───────────────────────────────────────────────────
  const { data: lastLaw } = await supabase
    .from('laws')
    .select('topic_id, statement, established_at')
    .eq('is_active', true)
    .order('established_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    profile,
    league,
    predictions,
    watched_topics,
    mission_summary,
    recent_activity,
    last_law: lastLaw
      ? { topic_id: lastLaw.topic_id, statement: lastLaw.statement, established_at: lastLaw.established_at }
      : null,
  } satisfies DashboardResponse)
}
