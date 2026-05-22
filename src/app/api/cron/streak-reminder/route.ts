/**
 * /api/cron/streak-reminder
 *
 * Vercel Cron endpoint that fires at 20:00 UTC every day.
 * Configured in vercel.json as: "0 20 * * *"
 *
 * What it does:
 *   1. Validates the Vercel Cron secret.
 *   2. Finds all users whose vote streak is > 0 but who have NOT yet voted
 *      today (UTC) — their streak will break at midnight if they don't act.
 *   3. Skips anyone who already received a streak_at_risk notification
 *      in the past 22 hours (prevents double-delivery if cron runs late).
 *   4. Inserts a `streak_at_risk` notification for each at-risk user.
 *      The existing /api/cron/push-deliver job (runs every minute) will
 *      deliver these to subscribed devices automatically.
 *   5. Returns a JSON summary.
 *
 * Environment variables required:
 *   CRON_SECRET               — shared secret in the Authorization header
 *   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS for cross-user queries
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const CRON_SECRET = process.env.CRON_SECRET ?? ''

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${CRON_SECRET}`
}

// Minutes before midnight UTC where we fire the reminder.
// 240 = 4 hours (8 PM UTC → midnight UTC).
const MINUTES_BEFORE_MIDNIGHT = 240

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const startedAt = Date.now()

  // ── 1. Identify at-risk users who have opted in to streak reminders ────────
  // Users who have an active streak AND have not yet voted today.
  // "today" in UTC = current date at midnight UTC.
  const todayUTC = new Date()
  todayUTC.setUTCHours(0, 0, 0, 0)
  const todayStr = todayUTC.toISOString().slice(0, 10) // YYYY-MM-DD

  const { data: atRisk, error: fetchErr } = await supabase
    .from('profiles')
    .select('id, vote_streak, display_name, username')
    .gt('vote_streak', 0)
    .or(`last_vote_date.is.null,last_vote_date.lt.${todayStr}`)
    .limit(500)

  if (fetchErr) {
    console.error('[streak-reminder] fetch error:', fetchErr)
    return NextResponse.json({ error: 'DB fetch failed', detail: fetchErr.message }, { status: 500 })
  }

  if (!atRisk || atRisk.length === 0) {
    return NextResponse.json({
      ok: true,
      reminded: 0,
      skipped_already_notified: 0,
      elapsed_ms: Date.now() - startedAt,
      ran_at: new Date().toISOString(),
    })
  }

  // ── 2. Filter to users who have opted in (streak_reminder = true / default) ─
  const candidateIds = atRisk.map((p) => p.id)

  const { data: optedOut } = await supabase
    .from('user_notification_prefs')
    .select('user_id')
    .in('user_id', candidateIds)
    .eq('streak_reminder', false)

  const optedOutSet = new Set((optedOut ?? []).map((r) => r.user_id))
  const eligible = atRisk.filter((p) => !optedOutSet.has(p.id))

  // ── 3. Skip users already notified in the past 22 h ─────────────────────
  const twentyTwoHoursAgo = new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString()
  const userIds = eligible.map((p) => p.id)

  const { data: alreadyNotified } = await supabase
    .from('notifications')
    .select('user_id')
    .eq('type', 'streak_at_risk')
    .in('user_id', userIds)
    .gte('created_at', twentyTwoHoursAgo)

  const notifiedSet = new Set((alreadyNotified ?? []).map((n) => n.user_id))

  const toNotify = eligible.filter((p) => !notifiedSet.has(p.id))
  const skipped = atRisk.length - toNotify.length

  if (toNotify.length === 0) {
    return NextResponse.json({
      ok: true,
      reminded: 0,
      skipped_already_notified: skipped,
      elapsed_ms: Date.now() - startedAt,
      ran_at: new Date().toISOString(),
    })
  }

  // ── 4. Insert notifications ───────────────────────────────────────────────
  const hoursLeft = Math.round(MINUTES_BEFORE_MIDNIGHT / 60)

  const rows = toNotify.map((p) => {
    const streakLabel = p.vote_streak === 1 ? '1-day' : `${p.vote_streak}-day`
    return {
      user_id: p.id,
      type: 'streak_at_risk',
      title: `Your ${streakLabel} streak expires in ${hoursLeft}h`,
      body: `Vote on any active topic before midnight UTC to keep your streak alive.`,
      reference_id: null as string | null,
      reference_type: null as string | null,
      is_read: false,
    }
  })

  const BATCH = 100
  let insertedTotal = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error: insertErr, count } = await supabase
      .from('notifications')
      .insert(batch)
      .select('id', { count: 'exact', head: true })

    if (insertErr) {
      console.error('[streak-reminder] insert error:', insertErr)
    } else {
      insertedTotal += count ?? batch.length
    }
  }

  return NextResponse.json({
    ok: true,
    reminded: insertedTotal,
    skipped_already_notified: skipped,
    at_risk_found: atRisk.length,
    elapsed_ms: Date.now() - startedAt,
    ran_at: new Date().toISOString(),
  })
}
