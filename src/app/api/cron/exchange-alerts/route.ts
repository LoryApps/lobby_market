/**
 * /api/cron/exchange-alerts
 *
 * Vercel Cron endpoint that fires every 5 minutes.
 * Schedule (vercel.json): every-5-min cron
 *
 * What it does:
 *   1. Validates the Vercel Cron secret.
 *   2. Reads all non-triggered exchange_price_alerts, joined with the
 *      current topic consensus price (blue_pct).
 *   3. For each alert, checks whether the current price satisfies
 *      the threshold condition (above / below).
 *   4. For triggered alerts:
 *      a) Inserts an `exchange_alert` in-app notification.
 *      b) Marks the alert as triggered (is_triggered = true, triggered_at = now).
 *   5. Returns a JSON summary.
 *
 * De-duplication: is_triggered = true is permanent — a triggered alert is
 * never re-fired. Users can delete and recreate an alert to reset it.
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

// ─── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  if (!CRON_SECRET) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${CRON_SECRET}`
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AlertRow {
  id: string
  user_id: string
  topic_id: string
  threshold: number
  direction: 'above' | 'below'
  topic_statement: string
  topic_blue_pct: number
  topic_status: string
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const startedAt = Date.now()

  // ── 1. Load all non-triggered alerts with current topic prices ─────────────
  // We join exchange_price_alerts → topics to get current blue_pct in one shot.
  const { data: rawAlerts, error: alertsError } = await supabase
    .from('exchange_price_alerts')
    .select(`
      id,
      user_id,
      topic_id,
      threshold,
      direction,
      topics!inner (
        statement,
        blue_pct,
        status
      )
    `)
    .eq('is_triggered', false)

  if (alertsError) {
    console.error('[exchange-alerts] fetch error:', alertsError)
    return NextResponse.json(
      { error: 'Failed to fetch alerts', detail: alertsError.message },
      { status: 500 }
    )
  }

  if (!rawAlerts || rawAlerts.length === 0) {
    return NextResponse.json({
      ok: true,
      checked: 0,
      triggered: 0,
      elapsed_ms: Date.now() - startedAt,
      ran_at: new Date().toISOString(),
    })
  }

  // Normalise the nested join into flat objects.
  const alerts: AlertRow[] = (rawAlerts as unknown as Array<{
    id: string
    user_id: string
    topic_id: string
    threshold: number
    direction: 'above' | 'below'
    topics: { statement: string; blue_pct: number | null; status: string }
  }>)
    .map((row) => ({
      id: row.id,
      user_id: row.user_id,
      topic_id: row.topic_id,
      threshold: row.threshold,
      direction: row.direction,
      topic_statement: row.topics.statement,
      topic_blue_pct: row.topics.blue_pct ?? 50,
      topic_status: row.topics.status,
    }))
    // Ignore resolved topics (law / failed) — they won't move further.
    .filter((a) => a.topic_status !== 'law' && a.topic_status !== 'failed')

  // ── 2. Evaluate each alert ─────────────────────────────────────────────────

  const triggered: AlertRow[] = []

  for (const alert of alerts) {
    const currentPrice = Math.round(alert.topic_blue_pct)
    const crosses =
      alert.direction === 'above'
        ? currentPrice >= alert.threshold
        : currentPrice <= alert.threshold

    if (crosses) {
      triggered.push(alert)
    }
  }

  if (triggered.length === 0) {
    return NextResponse.json({
      ok: true,
      checked: alerts.length,
      triggered: 0,
      elapsed_ms: Date.now() - startedAt,
      ran_at: new Date().toISOString(),
    })
  }

  // ── 3. Insert notifications & mark alerts as triggered ────────────────────

  let notificationsQueued = 0
  let alertsMarked = 0

  // Process in batches of 50 to stay within Supabase row limits.
  const BATCH = 50
  for (let i = 0; i < triggered.length; i += BATCH) {
    const batch = triggered.slice(i, i + BATCH)

    // Build notification rows.
    const notifRows = batch.map((alert) => {
      const dir = alert.direction === 'above' ? 'above' : 'below'
      const label = alert.direction === 'above' ? '↑' : '↓'
      const truncated =
        alert.topic_statement.length > 80
          ? `${alert.topic_statement.slice(0, 77)}…`
          : alert.topic_statement
      const currentPrice = Math.round(alert.topic_blue_pct)

      return {
        user_id: alert.user_id,
        type: 'exchange_alert',
        title: `Price alert: ${label} ${alert.threshold}¢`,
        body: `${truncated} — now at ${currentPrice}¢ (${dir} your ${alert.threshold}¢ threshold)`,
        reference_id: alert.topic_id,
        reference_type: 'topic',
        is_read: false,
      }
    })

    const { error: notifError } = await supabase
      .from('notifications')
      .insert(notifRows)

    if (notifError) {
      console.error('[exchange-alerts] notification insert error:', notifError)
    } else {
      notificationsQueued += notifRows.length
    }

    // Mark alerts as triggered.
    const alertIds = batch.map((a) => a.id)
    const { error: markError } = await supabase
      .from('exchange_price_alerts')
      .update({ is_triggered: true, triggered_at: new Date().toISOString() })
      .in('id', alertIds)

    if (markError) {
      console.error('[exchange-alerts] mark-triggered error:', markError)
    } else {
      alertsMarked += alertIds.length
    }
  }

  return NextResponse.json({
    ok: true,
    checked: alerts.length,
    triggered: triggered.length,
    notifications_queued: notificationsQueued,
    alerts_marked: alertsMarked,
    elapsed_ms: Date.now() - startedAt,
    ran_at: new Date().toISOString(),
  })
}
