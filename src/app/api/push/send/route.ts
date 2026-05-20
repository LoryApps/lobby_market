import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const VAPID_PUBLIC_KEY  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY  ?? ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY             ?? ''
const VAPID_EMAIL       = process.env.VAPID_EMAIL                   ?? 'mailto:admin@lobby.market'

function getWebPush() {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return null
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  return webpush
}

interface SendPushBody {
  user_id: string
  title: string
  body: string
  url?: string
  icon?: string
  tag?: string
}

export async function POST(req: Request) {
  // Only allow service-role calls (internal)
  const authHeader = req.headers.get('authorization')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const wp = getWebPush()
  if (!wp) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 503 })
  }

  const body = (await req.json()) as SendPushBody

  if (!body.user_id || !body.title || !body.body) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, id')
    .eq('user_id', body.user_id)

  if (error) {
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  const payload = JSON.stringify({
    title:   body.title,
    body:    body.body,
    url:     body.url  ?? '/',
    icon:    body.icon ?? '/assets/logo-mark.png',
    badge:   '/assets/logo-mark.png',
    tag:     body.tag  ?? 'lobby-market',
  })

  const staleIds: string[] = []
  let sent = 0

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
        sent++
        // Update last_used_at
        await supabase
          .from('push_subscriptions')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', sub.id)
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is gone — mark for cleanup
          staleIds.push(sub.id)
        }
      }
    })
  )

  // Clean up stale subscriptions
  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds)
  }

  return NextResponse.json({ sent, stale: staleIds.length })
}
