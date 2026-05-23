import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MomentumTier =
  | 'surging'      // +40%+ improvement across dimensions
  | 'building'     // +10–39% improvement
  | 'steady'       // ±10% stable
  | 'easing'       // -10–39% decline
  | 'fading'       // -40%+ decline

export interface WeeklyBucket {
  week: string   // "Week 1", "Week 2", … "Week 8"
  votes: number
  arguments: number
  upvotes_received: number
}

export interface DimensionMomentum {
  label: string
  recent: number   // sum of last 4 weeks
  prior: number    // sum of prior 4 weeks
  pct_change: number | null
  tier: MomentumTier
  weekly: WeeklyBucket[]
}

export interface MomentumResponse {
  overall_tier: MomentumTier
  overall_score: number      // -100 to +100
  voting: DimensionMomentum
  arguing: DimensionMomentum
  reputation: DimensionMomentum
  clout_now: number
  clout_8w_ago: number
  total_votes: number
  total_arguments: number
  has_data: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pctChange(recent: number, prior: number): number | null {
  if (prior === 0 && recent === 0) return null
  if (prior === 0) return 100
  return Math.round(((recent - prior) / prior) * 100)
}

function toTier(pct: number | null): MomentumTier {
  if (pct === null) return 'steady'
  if (pct >= 40) return 'surging'
  if (pct >= 10) return 'building'
  if (pct >= -10) return 'steady'
  if (pct >= -40) return 'easing'
  return 'fading'
}

function weightedScore(pct: number | null): number {
  if (pct === null) return 0
  return Math.max(-100, Math.min(100, pct))
}

function isoToWeekIndex(iso: string, anchorMs: number): number {
  const diff = anchorMs - new Date(iso).getTime()
  return Math.floor(diff / (7 * 24 * 3600 * 1000))
}

function buildWeeklyBuckets(
  voteIsos: string[],
  argIsos: string[],
  upvoteIsos: string[],
  nowMs: number,
): WeeklyBucket[] {
  const buckets: WeeklyBucket[] = Array.from({ length: 8 }, (_, i) => ({
    week: `W${8 - i}`,
    votes: 0,
    arguments: 0,
    upvotes_received: 0,
  }))

  for (const iso of voteIsos) {
    const idx = isoToWeekIndex(iso, nowMs)
    if (idx >= 0 && idx < 8) buckets[7 - idx].votes += 1
  }
  for (const iso of argIsos) {
    const idx = isoToWeekIndex(iso, nowMs)
    if (idx >= 0 && idx < 8) buckets[7 - idx].arguments += 1
  }
  for (const iso of upvoteIsos) {
    const idx = isoToWeekIndex(iso, nowMs)
    if (idx >= 0 && idx < 8) buckets[7 - idx].upvotes_received += 1
  }

  return buckets
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid = user.id
  const nowMs = Date.now()
  const cutoff8w = new Date(nowMs - 56 * 24 * 3600 * 1000).toISOString()

  // ── Fetch raw data in parallel ────────────────────────────────────────────

  const [votesRes, argsRes, profileRes, upvotesRes] =
    await Promise.all([
      supabase
        .from('votes')
        .select('created_at')
        .eq('user_id', uid)
        .gte('created_at', cutoff8w)
        .order('created_at', { ascending: true }),

      supabase
        .from('topic_arguments')
        .select('created_at')
        .eq('user_id', uid)
        .gte('created_at', cutoff8w)
        .order('created_at', { ascending: true }),

      supabase
        .from('profiles')
        .select('total_votes, total_arguments, clout')
        .eq('id', uid)
        .single(),

      // upvotes received: argument_upvotes where argument author = uid
      supabase
        .from('argument_upvotes')
        .select('created_at')
        .eq('argument_user_id', uid)
        .gte('created_at', cutoff8w)
        .order('created_at', { ascending: true }),
    ])

  const voteIsos: string[] = (votesRes.data ?? []).map((r) => r.created_at)
  const argIsos: string[]  = (argsRes.data  ?? []).map((r) => r.created_at)
  const upvoteIsos: string[] = (upvotesRes.data ?? []).map((r) => r.created_at)

  const profile = profileRes.data
  const cloutNow = profile?.clout ?? 0
  const totalVotes = profile?.total_votes ?? 0
  const totalArgs  = profile?.total_arguments ?? 0

  const has_data = voteIsos.length > 0 || argIsos.length > 0

  // ── Build weekly buckets ─────────────────────────────────────────────────

  const buckets = buildWeeklyBuckets(voteIsos, argIsos, upvoteIsos, nowMs)

  const recent4 = buckets.slice(4) // W5–W8
  const prior4  = buckets.slice(0, 4) // W1–W4

  const recentVotes = recent4.reduce((s, b) => s + b.votes, 0)
  const priorVotes  = prior4.reduce((s, b) => s + b.votes, 0)

  const recentArgs  = recent4.reduce((s, b) => s + b.arguments, 0)
  const priorArgs   = prior4.reduce((s, b) => s + b.arguments, 0)

  const recentUpvotes = recent4.reduce((s, b) => s + b.upvotes_received, 0)
  const priorUpvotes  = prior4.reduce((s, b) => s + b.upvotes_received, 0)

  // ── Dimension calculations ───────────────────────────────────────────────

  const votePct  = pctChange(recentVotes, priorVotes)
  const argPct   = pctChange(recentArgs, priorArgs)
  const repPct   = pctChange(recentUpvotes, priorUpvotes)

  const voting: DimensionMomentum = {
    label: 'Voting',
    recent: recentVotes,
    prior: priorVotes,
    pct_change: votePct,
    tier: toTier(votePct),
    weekly: buckets.map((b) => ({ ...b })),
  }

  const arguing: DimensionMomentum = {
    label: 'Arguing',
    recent: recentArgs,
    prior: priorArgs,
    pct_change: argPct,
    tier: toTier(argPct),
    weekly: buckets.map((b) => ({ ...b })),
  }

  const reputation: DimensionMomentum = {
    label: 'Reputation',
    recent: recentUpvotes,
    prior: priorUpvotes,
    pct_change: repPct,
    tier: toTier(repPct),
    weekly: buckets.map((b) => ({ ...b })),
  }

  // ── Overall score (weighted: 40% voting, 30% arguing, 30% reputation) ───

  const score = Math.round(
    0.4 * weightedScore(votePct) +
    0.3 * weightedScore(argPct) +
    0.3 * weightedScore(repPct),
  )

  const overall_tier = toTier(
    has_data
      ? score
      : null,
  )

  // Rough clout 8 weeks ago — subtract recent gains as proxy
  const recentCloutGain = (recentVotes + recentArgs * 5 + recentUpvotes * 2)
  const clout8wAgo = Math.max(0, cloutNow - recentCloutGain)

  return NextResponse.json({
    overall_tier,
    overall_score: score,
    voting,
    arguing,
    reputation,
    clout_now: cloutNow,
    clout_8w_ago: clout8wAgo,
    total_votes: totalVotes,
    total_arguments: totalArgs,
    has_data,
  } satisfies MomentumResponse)
}
