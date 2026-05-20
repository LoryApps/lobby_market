import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface PushSubscriptionBody {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  userAgent?: string
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as PushSubscriptionBody

    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    const userAgent = req.headers.get('user-agent') ?? body.userAgent ?? null

    // Upsert: if endpoint already exists, refresh last_used_at
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id:      user.id,
          endpoint:     body.endpoint,
          p256dh:       body.keys.p256dh,
          auth:         body.keys.auth,
          user_agent:   userAgent,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      )

    if (error) {
      console.error('push subscribe error:', error)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('push subscribe:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
