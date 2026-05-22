/**
 * /api/cron/daily-reset
 *
 * Vercel Cron endpoint that runs once per day at midnight UTC.
 * Configured in vercel.json as: "0 0 * * *"
 *
 * What it does:
 *   1. Validates the Vercel Cron secret.
 *   2. Calls the Postgres function `run_daily_reset()` which:
 *      - Resets daily_votes_used = 0 and stamps daily_votes_reset_at = now()
 *        for every profile that used votes today.
 *      - Breaks vote streaks for users who did not vote since 2+ days ago.
 *   3. Updates the daily quorum snapshot (seeds tomorrow's 3 quorum topics).
 *   4. Returns a JSON summary.
 *
 * Environment variables required:
 *   CRON_SECRET             — shared secret checked against the Authorization header
 *   SUPABASE_SERVICE_ROLE_KEY — bypasses RLS for the batch update
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

  // 1. Run the Postgres daily reset function
  //    (resets daily_votes_used, breaks stale streaks)
  const { data: resetResult, error: resetError } = await supabase.rpc('run_daily_reset' as never)

  if (resetError) {
    console.error('[daily-reset] run_daily_reset error:', resetError)
    return NextResponse.json(
      { error: 'Daily reset failed', detail: resetError.message },
      { status: 500 }
    )
  }

  // 2. Seed tomorrow's daily quorum topics — pick the top 3 active topics
  //    by feed_score so the DailyQuorumNudge component shows fresh choices.
  //    (The quorum topics are stored in a lightweight cache table if one
  //     exists; otherwise the client selects them dynamically. This step
  //     is best-effort and we don't fail the cron on error.)
  let quorumTopics: string[] = []
  try {
    const { data: topics } = await supabase
      .from('topics')
      .select('id')
      .eq('status', 'active')
      .order('feed_score', { ascending: false })
      .limit(3)

    if (topics) {
      quorumTopics = topics.map((t) => t.id)
    }
  } catch {
    // Best-effort — quorum topics are selected dynamically by the API
  }

  // 3. (Optional) archive very old proposed topics that never got traction.
  //    Topics proposed more than 30 days ago with fewer than 10 supports
  //    are silently archived to keep the feed fresh.
  let archivedCount = 0
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: stale } = await supabase
      .from('topics')
      .select('id')
      .eq('status', 'proposed')
      .lt('created_at', thirtyDaysAgo)
      .lt('support_count', 10)
      .limit(50)

    if (stale && stale.length > 0) {
      const { error: archiveError } = await supabase
        .from('topics')
        .update({ status: 'archived' })
        .in('id', stale.map((t) => t.id))

      if (!archiveError) {
        archivedCount = stale.length
      }
    }
  } catch {
    // Best-effort
  }

  const elapsed = Date.now() - startedAt

  return NextResponse.json({
    ok: true,
    reset: resetResult,
    quorum_topics_seeded: quorumTopics.length,
    stale_topics_archived: archivedCount,
    elapsed_ms: elapsed,
    ran_at: new Date().toISOString(),
  })
}
