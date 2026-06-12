/**
 * /api/cron/podium-snapshot
 *
 * Vercel Cron endpoint that fires every Sunday at 23:55 UTC.
 * Configured in vercel.json as: "55 23 * * 0"
 *
 * What it does:
 *   1. Validates the Vercel Cron secret.
 *   2. Computes the current week's top-3 per category using the same
 *      scoring algorithm as /api/podium (votes×1 + args×3 + upvotes×2).
 *   3. Upserts results to podium_snapshots (idempotent — safe to re-run).
 *   4. Sends achievement_earned notifications to the top-3 finishers
 *      in each category (skipping if already notified this week).
 *   5. Returns a JSON summary.
 *
 * Environment variables required:
 *   CRON_SECRET               — shared secret in the Authorization header
 *   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS for cross-user inserts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET ?? ''

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
] as const

type PodiumCategory = typeof CATEGORIES[number]

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return false
  return req.headers.get('authorization') === `Bearer ${CRON_SECRET}`
}

// Monday of the current week (UTC)
function getWeekStart(): Date {
  const now = new Date()
  const day = now.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

const RANK_LABEL: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const startedAt = Date.now()

  const weekStart = getWeekStart()
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
  const weekStartIso = weekStart.toISOString()
  const weekEndIso = weekEnd.toISOString()
  // Date-only string for the snapshot key
  const weekStartDate = weekStart.toISOString().split('T')[0]

  // ── 1. Fetch votes and arguments for this week ──────────────────────────────

  const [votesRes, argsRes] = await Promise.all([
    supabase
      .from('votes')
      .select('user_id, topic:topics!inner(category)')
      .gte('created_at', weekStartIso)
      .lt('created_at', weekEndIso),
    supabase
      .from('topic_arguments')
      .select('user_id, upvotes, topic:topics!inner(category)')
      .gte('created_at', weekStartIso)
      .lt('created_at', weekEndIso),
  ])

  if (votesRes.error || argsRes.error) {
    const err = votesRes.error ?? argsRes.error
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }

  // ── 2. Score: votes×1 + args×3 + upvotes×2 ──────────────────────────────────

  type UserCatStats = { votes: number; args: number; upvotes: number; score: number }
  const stats = new Map<string, Map<string, UserCatStats>>()

  function getStats(userId: string, cat: string): UserCatStats {
    if (!stats.has(userId)) stats.set(userId, new Map())
    const m = stats.get(userId)!
    if (!m.has(cat)) m.set(cat, { votes: 0, args: 0, upvotes: 0, score: 0 })
    return m.get(cat)!
  }

  for (const row of (votesRes.data ?? []) as { user_id: string; topic: { category: string | null } | null }[]) {
    const cat = row.topic?.category
    if (!cat || !CATEGORIES.includes(cat as PodiumCategory)) continue
    const s = getStats(row.user_id, cat)
    s.votes++; s.score += 1
  }

  for (const row of (argsRes.data ?? []) as { user_id: string; upvotes: number; topic: { category: string | null } | null }[]) {
    const cat = row.topic?.category
    if (!cat || !CATEGORIES.includes(cat as PodiumCategory)) continue
    const s = getStats(row.user_id, cat)
    s.args++; s.upvotes += row.upvotes ?? 0; s.score += 3 + (row.upvotes ?? 0) * 2
  }

  // ── 3. Collect top 3 per category ───────────────────────────────────────────

  type RawEntry = { userId: string; s: UserCatStats }
  const topByCat = new Map<string, RawEntry[]>()

  for (const [userId, catMap] of stats.entries()) {
    for (const [cat, s] of catMap.entries()) {
      if (s.score === 0) continue
      if (!topByCat.has(cat)) topByCat.set(cat, [])
      topByCat.get(cat)!.push({ userId, s })
    }
  }

  const ranked = new Map<string, RawEntry[]>()
  for (const [cat, entries] of topByCat.entries()) {
    ranked.set(cat, entries.sort((a, b) => b.s.score - a.s.score).slice(0, 3))
  }

  // ── 4. Check which entries have already been snapshotted this week ──────────

  const { data: existing } = await supabase
    .from('podium_snapshots')
    .select('category, rank')
    .eq('week_start', weekStartDate)

  const alreadySnapped = new Set<string>()
  for (const row of (existing ?? [])) {
    alreadySnapped.add(`${row.category}:${row.rank}`)
  }

  // ── 5. Upsert new snapshot rows ─────────────────────────────────────────────

  const snapshotRows: {
    week_start: string
    category: string
    rank: number
    user_id: string
    score: number
    weekly_votes: number
    weekly_arguments: number
    weekly_upvotes: number
  }[] = []

  const notificationRows: {
    user_id: string
    type: 'achievement_earned'
    title: string
    body: string
    reference_type: string
    reference_id: string | null
  }[] = []

  for (const cat of CATEGORIES) {
    const entries = ranked.get(cat) ?? []
    for (let i = 0; i < entries.length; i++) {
      const rank = (i + 1) as 1 | 2 | 3
      const { userId, s } = entries[i]
      const key = `${cat}:${rank}`
      const medal = RANK_LABEL[rank] ?? ''
      const isNew = !alreadySnapped.has(key)

      if (isNew) {
        snapshotRows.push({
          week_start: weekStartDate,
          category: cat,
          rank,
          user_id: userId,
          score: s.score,
          weekly_votes: s.votes,
          weekly_arguments: s.args,
          weekly_upvotes: s.upvotes,
        })

        notificationRows.push({
          user_id: userId,
          type: 'achievement_earned',
          title: `${medal} Podium — ${cat}`,
          body: `You finished #${rank} on this week's ${cat} Podium with ${s.score} pts (${s.votes}v · ${s.args}a · ${s.upvotes}↑)`,
          reference_type: 'podium',
          reference_id: null,
        })
      }
    }
  }

  let snapshotCount = 0
  let notifCount = 0

  if (snapshotRows.length > 0) {
    const { error: snapErr } = await supabase
      .from('podium_snapshots')
      .upsert(snapshotRows, { onConflict: 'week_start,category,rank' })

    if (snapErr) {
      console.error('[podium-snapshot] upsert error:', snapErr)
    } else {
      snapshotCount = snapshotRows.length
    }
  }

  if (notificationRows.length > 0) {
    const { error: notifErr } = await supabase
      .from('notifications')
      .insert(notificationRows)

    if (!notifErr) {
      notifCount = notificationRows.length
    }
  }

  return NextResponse.json({
    ok: true,
    week_start: weekStartDate,
    snapshots_written: snapshotCount,
    notifications_sent: notifCount,
    elapsed_ms: Date.now() - startedAt,
  })
}
