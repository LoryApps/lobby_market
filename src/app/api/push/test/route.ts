/**
 * POST /api/push/test
 *
 * Sends a test Web Push notification to the calling user's subscribed devices.
 * Useful for verifying the VAPID configuration and service worker are working.
 */

import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VAPID_PUBLIC_KEY  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY  ?? ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY             ?? ''
const VAPID_EMAIL       = process.env.VAPID_EMAIL                   ?? 'mailto:push@lobby.market'

export async function POST() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user.id)

  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'No push subscriptions found for this device' }, { status: 404 })
  }

  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

  const payload = JSON.stringify({
    title: '🔔 Lobby Market',
    body:  'Push notifications are working! You\'ll get alerts even when the app is closed.',
    url:   '/notifications',
    icon:  '/assets/logo-mark.png',
    badge: '/assets/logo-mark.png',
    tag:   'test-push',
  })

  const staleIds: string[] = []
  let sent = 0

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) {
          staleIds.push(sub.id)
        }
      }
    })
  )

  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds)
  }

  if (sent === 0) {
    return NextResponse.json({ error: 'All subscriptions are stale or delivery failed' }, { status: 500 })
  }

  return NextResponse.json({ sent })
}
