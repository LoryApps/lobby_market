import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Notification } from '@/lib/supabase/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(
    Math.max(1, Number.parseInt(searchParams.get('limit') ?? '50', 10) || 50),
    100
  )
  const offset = Math.max(
    0,
    Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0
  )

  const { data, error, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load notifications' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    notifications: (data ?? []) as Notification[],
    total: count ?? 0,
    limit,
    offset,
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { ids?: string[]; all?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (body.all === true) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    if (error) {
      return NextResponse.json(
        { error: 'Failed to mark all as read' },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: true, scope: 'all' })
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    if (body.ids.some((id) => typeof id !== 'string')) {
      return NextResponse.json(
        { error: 'ids must be an array of strings' },
        { status: 400 }
      )
    }
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .in('id', body.ids)
    if (error) {
      return NextResponse.json(
        { error: 'Failed to mark notifications as read' },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: true, scope: 'ids', count: body.ids.length })
  }

  return NextResponse.json(
    { error: 'Provide either {all: true} or {ids: [...]}' },
    { status: 400 }
  )
}
