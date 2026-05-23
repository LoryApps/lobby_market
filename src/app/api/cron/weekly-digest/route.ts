/**
 * /api/cron/weekly-digest
 *
 * Vercel Cron endpoint that fires every Monday at 06:00 UTC.
 * Configured in vercel.json as: "0 6 * * 1"
 *
 * What it does:
 *   1. Validates the Vercel Cron secret.
 *   2. Finds all active users who have opted into the weekly_digest
 *      notification and have not yet received one this week.
 *   3. For each user, computes their last-7-day highlights:
 *        - Topics voted on
 *        - Arguments written
 *        - Laws established from their voted topics
 *        - Clout earned
 *        - Current streak status
 *   4. Inserts a `weekly_digest` notification with the summary.
 *      The existing /api/cron/push-deliver job delivers it to devices.
 *   5. Stamps last_weekly_digest_sent_at on the profile.
 *   6. Returns a JSON summary.
 *
 * Environment variables required:
 *   CRON_SECRET               — shared secret in the Authorization header
 *   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS for cross-user queries
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CRON_SECRET = process.env.CRON_SECRET ?? ''
const MAX_BATCH   = 500

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${CRON_SECRET}`
}

// Earliest timestamp we consider "last week"
function oneWeekAgo(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
}

// ─── Pluralise helper ─────────────────────────────────────────────────────────

function pl(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// ─── Build human-readable notification body ───────────────────────────────────

interface DigestStats {
  votes:     number
  arguments: number
  laws:      number
  clout:     number
  streak:    number
}

function buildBody(stats: DigestStats, displayName: string | null): { title: string; body: string } {
  const name = displayName ? displayName.split(' ')[0] : 'Citizen'

  const parts: string[] = []
  if (stats.votes     > 0) parts.push(pl(stats.votes,     'vote'))
  if (stats.arguments > 0) parts.push(pl(stats.arguments, 'argument'))
  if (stats.laws      > 0) parts.push(`${stats.laws} law${stats.laws === 1 ? '' : 's'} from your positions`)

  const activity = parts.length > 0
    ? parts.join(' · ')
    : 'No activity last week — the Lobby awaits'

  const streakLine = stats.streak > 0
    ? ` Your streak: ${stats.streak} day${stats.streak === 1 ? '' : 's'}.`
    : ''

  const cloutLine = stats.clout > 0
    ? ` +${stats.clout} ¢ clout earned.`
    : ''

  return {
    title: `Your week in the Lobby, ${name}`,
    body:  `${activity}.${streakLine}${cloutLine}`,
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase  = await createClient()
  const startedAt = Date.now()
  const since     = oneWeekAgo()

  // ── 1. Fetch eligible users ──────────────────────────────────────────────
  // Users who:
  //   • have at least 1 vote or argument (recently active)
  //   • have opted in to weekly_digest (default true)
  //   • haven't received a digest in the past 6 days (avoid double-send)
  const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()

  const { data: candidates, error: candidatesErr } = await supabase
    .from('profiles')
    .select('id, display_name, username, vote_streak, clout')
    .or(`last_weekly_digest_sent_at.is.null,last_weekly_digest_sent_at.lt.${sixDaysAgo}`)
    .gt('total_votes', 0)
    .limit(MAX_BATCH)

  if (candidatesErr) {
    console.error('[weekly-digest] candidates fetch error:', candidatesErr)
    return NextResponse.json({ error: 'DB fetch failed', detail: candidatesErr.message }, { status: 500 })
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      skipped: 0,
      elapsed_ms: Date.now() - startedAt,
      ran_at: new Date().toISOString(),
    })
  }

  const candidateIds = candidates.map((p: { id: string }) => p.id)

  // ── 2. Filter to users who have opted in ─────────────────────────────────
  const { data: prefs, error: prefsErr } = await supabase
    .from('user_notification_prefs')
    .select('user_id, weekly_digest')
    .in('user_id', candidateIds)

  if (prefsErr) {
    console.error('[weekly-digest] prefs fetch error:', prefsErr)
    return NextResponse.json({ error: 'Prefs fetch failed' }, { status: 500 })
  }

  const optedOut = new Set<string>()
  for (const pref of (prefs ?? [])) {
    if (pref.weekly_digest === false) optedOut.add(pref.user_id)
  }

  const eligible = candidates.filter((p: { id: string }) => !optedOut.has(p.id))

  if (eligible.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      skipped: candidates.length,
      elapsed_ms: Date.now() - startedAt,
      ran_at: new Date().toISOString(),
    })
  }

  const eligibleIds = eligible.map((p: { id: string }) => p.id)

  // ── 3. Fetch per-user week stats in parallel ──────────────────────────────

  const [votesRes, argumentsRes, lawsRes, cloutRes] = await Promise.all([
    // votes cast in the last week
    supabase
      .from('votes')
      .select('user_id')
      .in('user_id', eligibleIds)
      .gte('created_at', since),

    // arguments written in the last week
    supabase
      .from('topic_arguments')
      .select('user_id')
      .in('user_id', eligibleIds)
      .gte('created_at', since),

    // laws established from topics the user voted on in the last week
    supabase
      .from('votes')
      .select('user_id, topics!inner(status)')
      .in('user_id', eligibleIds)
      .eq('topics.status', 'law')
      .gte('created_at', since),

    // clout earned (transactions) in the last week
    supabase
      .from('clout_transactions')
      .select('user_id, amount')
      .in('user_id', eligibleIds)
      .gt('amount', 0)
      .gte('created_at', since),
  ])

  // Aggregate per user
  const voteCount:    Record<string, number> = {}
  const argCount:     Record<string, number> = {}
  const lawCount:     Record<string, number> = {}
  const cloutEarned:  Record<string, number> = {}

  for (const row of (votesRes.data ?? [])) {
    voteCount[row.user_id] = (voteCount[row.user_id] ?? 0) + 1
  }
  for (const row of (argumentsRes.data ?? [])) {
    argCount[row.user_id] = (argCount[row.user_id] ?? 0) + 1
  }
  for (const row of (lawsRes.data ?? [])) {
    lawCount[row.user_id] = (lawCount[row.user_id] ?? 0) + 1
  }
  for (const row of (cloutRes.data ?? [])) {
    cloutEarned[row.user_id] = (cloutEarned[row.user_id] ?? 0) + (row.amount ?? 0)
  }

  // ── 4. Insert notifications + stamp last_weekly_digest_sent_at ───────────

  const now         = new Date().toISOString()
  let   sent        = 0
  let   skipped     = 0

  for (const profile of eligible) {
    const stats: DigestStats = {
      votes:     voteCount[profile.id]   ?? 0,
      arguments: argCount[profile.id]    ?? 0,
      laws:      lawCount[profile.id]    ?? 0,
      clout:     cloutEarned[profile.id] ?? 0,
      streak:    profile.vote_streak     ?? 0,
    }

    // Skip users with no activity at all this week — no point notifying
    if (stats.votes === 0 && stats.arguments === 0) {
      skipped++
      continue
    }

    const { title, body } = buildBody(stats, profile.display_name)

    const { error: insertErr } = await supabase
      .from('notifications')
      .insert({
        user_id:          profile.id,
        type:             'weekly_digest',
        title,
        body,
        reference_id:     null,
        reference_type:   'digest',
        is_read:          false,
        created_at:       now,
      })

    if (insertErr) {
      console.error('[weekly-digest] insert error for', profile.id, insertErr)
      skipped++
      continue
    }

    // Stamp the profile so we don't send twice this week
    await supabase
      .from('profiles')
      .update({ last_weekly_digest_sent_at: now })
      .eq('id', profile.id)

    sent++
  }

  return NextResponse.json({
    ok:          true,
    sent,
    skipped,
    candidates:  candidates.length,
    opted_out:   optedOut.size,
    elapsed_ms:  Date.now() - startedAt,
    ran_at:      now,
  })
}
