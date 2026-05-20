import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { endpoint } = (await req.json()) as { endpoint?: string }

    if (!endpoint) {
      // Remove ALL subscriptions for this user
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
    } else {
      // Remove a specific endpoint
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', endpoint)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('push unsubscribe:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
