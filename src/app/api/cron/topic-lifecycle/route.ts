/**
 * /api/cron/topic-lifecycle
 *
 * Vercel Cron endpoint that advances topics through their lifecycle states.
 * Runs every 5 minutes (configured in vercel.json).
 *
 * What it does:
 *   1. Validates the Vercel Cron secret.
 *   2. Calls the Postgres function `evaluate_topic_thresholds()` which:
 *      - Closes expired voting phases → law (≥67% supermajority) or failed
 *      - Advances "continued" topics → voting phase (when authoring window ends)
 *   3. Fires law-established notifications for topics that just became law
 *      (checks for laws created in the last 6 minutes).
 *   4. Returns a JSON summary of what happened.
 *
 * Environment variables required:
 *   CRON_SECRET             — shared secret checked against the Authorization header
 *   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS for notification inserts
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

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const startedAt = Date.now()

  // 1. Run the topic lifecycle evaluator (Postgres function)
  const { error: lifecycleError } = await supabase.rpc('evaluate_topic_thresholds' as never)

  if (lifecycleError) {
    console.error('[topic-lifecycle] evaluate_topic_thresholds error:', lifecycleError)
    return NextResponse.json(
      { error: 'Lifecycle evaluation failed', detail: lifecycleError.message },
      { status: 500 }
    )
  }

  // 2. Find topics that became law in the last 6 minutes (to fire notifications)
  const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString()

  const { data: newLaws } = await supabase
    .from('laws')
    .select('id, topic_id, statement, established_at')
    .gte('established_at', sixMinutesAgo)
    .order('established_at', { ascending: false })

  // 3. For each fresh law, notify users who voted on that topic
  let notificationsQueued = 0

  if (newLaws && newLaws.length > 0) {
    for (const law of newLaws) {
      // Fetch users who voted on this topic
      const { data: voters } = await supabase
        .from('votes')
        .select('user_id')
        .eq('topic_id', law.topic_id)
        .limit(500)

      if (!voters?.length) continue

      const shortStatement =
        law.statement.length > 80
          ? law.statement.slice(0, 79) + '…'
          : law.statement

      const rows = voters.map((v) => ({
        user_id: v.user_id,
        type: 'law_established' as const,
        title: 'A law was established',
        body: shortStatement,
        href: `/topic/${law.topic_id}`,
        metadata: { law_id: law.id, topic_id: law.topic_id },
      }))

      // Insert notifications in batches of 100 to avoid request size limits
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100)
        const { error: notifError } = await supabase
          .from('notifications')
          .insert(batch)
          .select('id')

        if (!notifError) {
          notificationsQueued += batch.length
        }
      }
    }
  }

  const elapsed = Date.now() - startedAt

  return NextResponse.json({
    ok: true,
    new_laws: newLaws?.length ?? 0,
    notifications_queued: notificationsQueued,
    elapsed_ms: elapsed,
    ran_at: new Date().toISOString(),
  })
}
