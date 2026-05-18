import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: { id: string }
}

// POST /api/polls/[id]/vote
// Body: { option_id: string }
export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { option_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const optionId = typeof body.option_id === 'string' ? body.option_id.trim() : ''
  if (!optionId) {
    return NextResponse.json({ error: 'option_id required' }, { status: 422 })
  }

  // Verify poll exists and is still open
  const { data: poll, error: pollErr } = await supabase
    .from('civic_polls')
    .select('id, options, is_closed, expires_at')
    .eq('id', params.id)
    .single()

  if (pollErr || !poll) {
    return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
  }

  if (poll.is_closed || new Date(poll.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Poll is closed' }, { status: 422 })
  }

  const options = (poll.options as { id: string; label: string }[]) ?? []
  if (!options.some((o) => o.id === optionId)) {
    return NextResponse.json({ error: 'Invalid option' }, { status: 422 })
  }

  const { error } = await supabase
    .from('civic_poll_votes')
    .insert({ poll_id: params.id, user_id: user.id, option_id: optionId })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already voted' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/polls/[id]/vote — retract vote
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('civic_poll_votes')
    .delete()
    .eq('poll_id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to retract vote' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
