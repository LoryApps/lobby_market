/**
 * /api/cron/debate-reminder
 *
 * Vercel Cron endpoint that fires every 30 minutes.
 * Configured in vercel.json as: every-30-min cron ("star /30 star star star star")
 *
 * What it does:
 *   1. Validates the Vercel Cron secret.
 *   2. Finds scheduled debates starting in the next 30–90 minutes
 *      (the 30-minute buffer prevents double-sending if the cron fires
 *      slightly early; the 90-minute cap ensures we catch all debates
 *      whose window overlaps this run).
 *   3. For each debate, finds all RSVPed users who have
 *      `debate_starting = true` (default) in their notification prefs.
 *   4. Skips users already sent a debate_starting notification for
 *      this debate in the past 4 hours to prevent duplicates.
 *   5. Inserts a `debate_starting` notification per eligible user.
 *      The existing /api/cron/push-deliver cron (every minute) picks
 *      these up and delivers them via Web Push.
 *   6. Returns a JSON summary.
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

// Notify users whose debate starts within this window (minutes from now).
const WINDOW_MIN_MINUTES = 30
const WINDOW_MAX_MINUTES = 90

// De-duplicate: skip if already notified within this many hours.
const DEDUP_HOURS = 4

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const startedAt = Date.now()

  const now = new Date()
  const windowStart = new Date(now.getTime() + WINDOW_MIN_MINUTES * 60_000).toISOString()
  const windowEnd   = new Date(now.getTime() + WINDOW_MAX_MINUTES * 60_000).toISOString()

  // ── 1. Find scheduled debates in the notification window ──────────────────
  const { data: debates, error: debatesErr } = await supabase
    .from('debates')
    .select('id, topic_id, title, scheduled_at')
    .eq('status', 'scheduled')
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)

  if (debatesErr) {
    console.error('[debate-reminder] fetch debates error:', debatesErr)
    return NextResponse.json({ error: 'DB fetch failed', detail: debatesErr.message }, { status: 500 })
  }

  if (!debates || debates.length === 0) {
    return NextResponse.json({
      ok: true,
      debates_found: 0,
      notified: 0,
      elapsed_ms: Date.now() - startedAt,
      ran_at: now.toISOString(),
    })
  }

  const debateIds = debates.map((d) => d.id)

  // ── 2. Find all RSVPed users for these debates ────────────────────────────
  const { data: rsvps, error: rsvpsErr } = await supabase
    .from('debate_rsvps')
    .select('debate_id, user_id')
    .in('debate_id', debateIds)

  if (rsvpsErr) {
    console.error('[debate-reminder] fetch rsvps error:', rsvpsErr)
    return NextResponse.json({ error: 'DB fetch failed', detail: rsvpsErr.message }, { status: 500 })
  }

  if (!rsvps || rsvps.length === 0) {
    return NextResponse.json({
      ok: true,
      debates_found: debates.length,
      notified: 0,
      elapsed_ms: Date.now() - startedAt,
      ran_at: now.toISOString(),
    })
  }

  const allUserIds = [...new Set(rsvps.map((r) => r.user_id))]

  // ── 3. Filter to users who have opted in (debate_starting = true/default) ─
  const { data: optedOut } = await supabase
    .from('user_notification_prefs')
    .select('user_id')
    .in('user_id', allUserIds)
    .eq('debate_starting', false)

  const optedOutSet = new Set((optedOut ?? []).map((r) => r.user_id))

  // ── 4. Deduplicate: skip users already notified for each debate ───────────
  const dedupCutoff = new Date(now.getTime() - DEDUP_HOURS * 60 * 60_000).toISOString()

  const { data: recentNotifs } = await supabase
    .from('notifications')
    .select('user_id, reference_id')
    .eq('type', 'debate_starting')
    .in('user_id', allUserIds)
    .in('reference_id', debateIds)
    .gte('created_at', dedupCutoff)

  // Build a Set of "userId:debateId" pairs already notified
  const notifiedKeys = new Set(
    (recentNotifs ?? []).map((n) => `${n.user_id}:${n.reference_id}`)
  )

  // ── 5. Build notification rows ────────────────────────────────────────────
  const debateMap = new Map(debates.map((d) => [d.id, d]))

  const rows: {
    user_id: string
    type: string
    title: string
    body: string
    reference_id: string
    reference_type: string
    is_read: boolean
  }[] = []

  for (const rsvp of rsvps) {
    if (optedOutSet.has(rsvp.user_id)) continue
    if (notifiedKeys.has(`${rsvp.user_id}:${rsvp.debate_id}`)) continue

    const debate = debateMap.get(rsvp.debate_id)
    if (!debate) continue

    const minutesUntil = Math.round(
      (new Date(debate.scheduled_at).getTime() - now.getTime()) / 60_000
    )
    const timeLabel =
      minutesUntil <= 30
        ? 'in under 30 minutes'
        : minutesUntil <= 60
          ? 'in about an hour'
          : `in ${Math.round(minutesUntil / 60)} hours`

    rows.push({
      user_id: rsvp.user_id,
      type: 'debate_starting',
      title: `Debate starting ${timeLabel}`,
      body: debate.title
        ? `"${debate.title.slice(0, 80)}" is about to begin. Your RSVP seat is waiting.`
        : 'A debate you RSVPed to is about to begin.',
      reference_id: rsvp.debate_id,
      reference_type: 'debate',
      is_read: false,
    })
  }

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      debates_found: debates.length,
      rsvps_found: rsvps.length,
      notified: 0,
      elapsed_ms: Date.now() - startedAt,
      ran_at: now.toISOString(),
    })
  }

  // ── 6. Insert in batches of 100 ───────────────────────────────────────────
  const BATCH = 100
  let insertedTotal = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error: insertErr, count } = await supabase
      .from('notifications')
      .insert(batch)
      .select('id', { count: 'exact', head: true })

    if (insertErr) {
      console.error('[debate-reminder] insert error:', insertErr)
    } else {
      insertedTotal += count ?? batch.length
    }
  }

  return NextResponse.json({
    ok: true,
    debates_found: debates.length,
    rsvps_found: rsvps.length,
    notified: insertedTotal,
    skipped: rows.length - insertedTotal,
    elapsed_ms: Date.now() - startedAt,
    ran_at: now.toISOString(),
  })
}
