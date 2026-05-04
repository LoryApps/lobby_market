import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { id: string }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    title?: string
    description?: string
    category?: string
    target_count?: number | null
    current_count?: number
    deadline?: string | null
    status?: string
    is_public?: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Ensure the user owns this pledge
  const { data: existing } = await supabase
    .from('civic_pledges')
    .select('user_id, status')
    .eq('id', params.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Pledge not found' }, { status: 404 })
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (body.title !== undefined) {
    if (body.title.trim().length === 0) return NextResponse.json({ error: 'Title required' }, { status: 400 })
    if (body.title.length > 200) return NextResponse.json({ error: 'Title too long' }, { status: 400 })
    updates.title = body.title.trim()
  }
  if (body.description !== undefined) {
    updates.description = body.description?.trim() || null
  }
  if (body.category !== undefined) {
    const VALID = ['participation','advocacy','debate','research','community','accountability']
    if (!VALID.includes(body.category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    updates.category = body.category
  }
  if (body.target_count !== undefined) updates.target_count = body.target_count
  if (body.current_count !== undefined) {
    updates.current_count = Math.max(0, body.current_count)
  }
  if (body.deadline !== undefined) updates.deadline = body.deadline
  if (body.status !== undefined) {
    const VALID_STATUSES = ['active', 'completed', 'abandoned']
    if (!VALID_STATUSES.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    updates.status = body.status
    if (body.status === 'completed') updates.completed_at = new Date().toISOString()
  }
  if (body.is_public !== undefined) updates.is_public = body.is_public

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('civic_pledges')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ pledge: data })
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('civic_pledges')
    .select('user_id')
    .eq('id', params.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('civic_pledges')
    .delete()
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
