/**
 * /api/cron/push-deliver
 *
 * Vercel Cron endpoint that drains the push notification delivery queue.
 * Runs every minute (configured in vercel.json).
 *
 * Algorithm:
 *   1. Validate the Vercel Cron secret.
 *   2. Fetch up to MAX_BATCH notifications where push_sent_at IS NULL and
 *      created_at is within the last 60 minutes (older ones are no longer
 *      relevant — the user can see them in the bell when they open the app).
 *   3. Group by user_id, skip users with no push subscriptions.
 *   4. For each notification, call web-push for every active subscription.
 *   5. Stamp push_sent_at = NOW() (regardless of whether push succeeded,
 *      to prevent retry storms if VAPID is misconfigured).
 *   6. Delete stale subscriptions that returned 404/410.
 *
 * Environment variables required for actual delivery:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY   (also sent to the client for subscription)
 *   VAPID_PRIVATE_KEY
 *   VAPID_EMAIL                    (mailto: address)
 *   CRON_SECRET                    (protects this endpoint; also set in vercel.json)
 *   SUPABASE_SERVICE_ROLE_KEY      (needed to bypass RLS for the batch query)
 */

import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const VAPID_PUBLIC_KEY  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY  ?? ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY             ?? ''
const VAPID_EMAIL       = process.env.VAPID_EMAIL                   ?? 'mailto:push@lobby.market'
const CRON_SECRET       = process.env.CRON_SECRET                   ?? ''

const MAX_BATCH = 100
const MAX_AGE_MINUTES = 60

// Notification type → emoji prefix for push body
const TYPE_EMOJI: Record<string, string> = {
  achievement_earned:        '🏆',
  law_established:           '⚖️',
  debate_starting:           '🎙️',
  topic_activated:           '⚡',
  vote_threshold:            '📊',
  reply_received:            '💬',
  role_promoted:             '👑',
  coalition_invite:          '🤝',
  coalition_invite_accepted: '✅',
  new_follower:              '👤',
  argument_upvoted:          '👍',
  argument_cited:            '🔗',
  vote_started:              '🗳️',
  vote_phase_started:        '🗳️',
  bookmark_update:           '🔖',
  direct_message:            '💬',
  new_topic_in_tag:          '#️⃣',
  topic_subscribed_update:   '📌',
  lobby_update:              '🏛️',
  streak_at_risk:            '🔥',
  weekly_digest:             '📰',
  qa_question_answered:      '❓',
  qa_answer_accepted:        '✅',
}

// Map notification reference_type → app URL
function buildUrl(referenceType: string | null, referenceId: string | null): string {
  if (!referenceId) return '/'
  switch (referenceType) {
    case 'topic':     return `/topic/${referenceId}`
    case 'law':       return `/law/${referenceId}`
    case 'debate':    return `/debate/${referenceId}`
    case 'profile':   return `/profile/${referenceId}`
    case 'coalition': return `/coalitions/${referenceId}`
    case 'argument':  return `/arguments/${referenceId}`
    case 'question':  return `/questions/${referenceId}`
    case 'digest':    return '/analytics'
    default:          return '/notifications'
  }
}

export async function GET(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── VAPID config check ────────────────────────────────────────────────────
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ skipped: true, reason: 'VAPID keys not configured' })
  }

  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const supabase = await createClient()

  // ── 1. Fetch unsent notifications from the past MAX_AGE_MINUTES ───────────
  const cutoff = new Date(Date.now() - MAX_AGE_MINUTES * 60 * 1000).toISOString()

  const { data: notifications, error: fetchErr } = await supabase
    .from('notifications')
    .select('id, user_id, type, title, body, reference_id, reference_type')
    .is('push_sent_at', null)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(MAX_BATCH)

  if (fetchErr) {
    console.error('[push-deliver] fetch notifications error', fetchErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!notifications || notifications.length === 0) {
    return NextResponse.json({ sent: 0, processed: 0 })
  }

  // ── 2. Collect unique user IDs and fetch their push subscriptions ─────────
  const userIds = [...new Set(notifications.map((n) => n.user_id))]

  const { data: subscriptions, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (subErr) {
    console.error('[push-deliver] fetch subscriptions error', subErr)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Group subs by user_id for O(1) lookup
  const subsByUser = new Map<string, typeof subscriptions>()
  for (const sub of subscriptions ?? []) {
    const existing = subsByUser.get(sub.user_id) ?? []
    existing.push(sub)
    subsByUser.set(sub.user_id, existing)
  }

  // ── 3. Send pushes, collect stale sub IDs ────────────────────────────────
  let totalSent = 0
  const staleSubs: string[] = []
  const notifIdsToStamp: string[] = []

  for (const notif of notifications) {
    notifIdsToStamp.push(notif.id)

    const subs = subsByUser.get(notif.user_id)
    if (!subs || subs.length === 0) continue

    const emoji = TYPE_EMOJI[notif.type] ?? '🔔'
    const title = `${emoji} ${notif.title}`
    const body  = notif.body ?? 'You have a new notification in the Lobby.'
    // Streak reminders deep-link to the swipe voting screen
    const url   = notif.type === 'streak_at_risk'
      ? '/swipe'
      : buildUrl(
          notif.reference_type as string | null,
          notif.reference_id as string | null,
        )

    const payload = JSON.stringify({
      title,
      body,
      url,
      icon:  '/assets/logo-mark.png',
      badge: '/assets/logo-mark.png',
      tag:   notif.type,
    })

    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { TTL: 3600 }
          )
          totalSent++
          // Update last_used_at
          await supabase
            .from('push_subscriptions')
            .update({ last_used_at: new Date().toISOString() })
            .eq('id', sub.id)
        } catch (err: unknown) {
          const code = (err as { statusCode?: number })?.statusCode
          if (code === 404 || code === 410) {
            staleSubs.push(sub.id)
          }
        }
      })
    )
  }

  // ── 4. Stamp push_sent_at for all processed notifications ─────────────────
  // Do this regardless of whether individual pushes succeeded — prevents
  // retry storms when VAPID is misconfigured or subscriptions expired.
  if (notifIdsToStamp.length > 0) {
    await supabase
      .from('notifications')
      .update({ push_sent_at: new Date().toISOString() })
      .in('id', notifIdsToStamp)
  }

  // ── 5. Clean up stale subscriptions ──────────────────────────────────────
  if (staleSubs.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleSubs)
  }

  return NextResponse.json({
    processed: notifications.length,
    sent:      totalSent,
    stale:     staleSubs.length,
  })
}
