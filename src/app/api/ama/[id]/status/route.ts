import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type NewStatus = 'live' | 'ended' | 'cancelled'

const VALID_TRANSITIONS: Record<string, NewStatus[]> = {
  upcoming: ['live', 'cancelled'],
  live: ['ended'],
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { status?: NewStatus }
    const newStatus = body.status

    if (!newStatus || !['live', 'ended', 'cancelled'].includes(newStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Fetch the session to verify ownership
    const { data: session, error: fetchErr } = await supabase
      .from('ama_sessions')
      .select('id, host_id, status')
      .eq('id', params.id)
      .maybeSingle()

    if (fetchErr) throw fetchErr
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    if (session.host_id !== user.id) {
      return NextResponse.json({ error: 'Only the host can change session status' }, { status: 403 })
    }

    const allowed = VALID_TRANSITIONS[session.status] ?? []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from "${session.status}" to "${newStatus}"` },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'live') updates.started_at = new Date().toISOString()
    if (newStatus === 'ended') updates.ended_at = new Date().toISOString()

    const { data: updated, error: updateErr } = await supabase
      .from('ama_sessions')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (updateErr) throw updateErr

    return NextResponse.json({ session: updated })
  } catch (err) {
    console.error('AMA status update error:', err)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
}
