import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: { id: string }
}

/**
 * GET /api/topics/[id]/subscribe
 * Returns { subscribed: boolean, count: number } for the current user.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [countResult, subscribedResult] = await Promise.all([
    supabase
      .from('topic_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', params.id),
    user
      ? supabase
          .from('topic_subscriptions')
          .select('id')
          .eq('topic_id', params.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return NextResponse.json({
    subscribed: !!subscribedResult.data,
    count: countResult.count ?? 0,
  })
}

/**
 * POST /api/topics/[id]/subscribe
 * Subscribes the current user to this topic.
 * Returns { subscribed: true, count: number }
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('topic_subscriptions')
    .upsert({ user_id: user.id, topic_id: params.id }, { onConflict: 'user_id,topic_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { count } = await supabase
    .from('topic_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', params.id)

  return NextResponse.json({ subscribed: true, count: count ?? 0 })
}

/**
 * DELETE /api/topics/[id]/subscribe
 * Unsubscribes the current user from this topic.
 * Returns { subscribed: false, count: number }
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await supabase
    .from('topic_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('topic_id', params.id)

  const { count } = await supabase
    .from('topic_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', params.id)

  return NextResponse.json({ subscribed: false, count: count ?? 0 })
}
