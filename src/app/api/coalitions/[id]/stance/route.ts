import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/coalitions/[id]/stance?topic_id=<uuid>
 * Returns the coalition's current stance on a topic (or null).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = req.nextUrl.searchParams.get('topic_id')
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topic_id' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data } = await supabase
    .from('coalition_stances')
    .select('*')
    .eq('coalition_id', params.id)
    .eq('topic_id', topicId)
    .maybeSingle()

  return NextResponse.json({ stance: data ?? null })
}

/**
 * POST /api/coalitions/[id]/stance
 * Body: { topic_id, stance, statement? }
 * Upserts (creates or updates) the coalition's official stance on a topic.
 * Requires the caller to be a leader or officer of the coalition.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify caller is a leader or officer
  const { data: membership } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['leader', 'officer'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'Only coalition leaders and officers can declare stances.' },
      { status: 403 }
    )
  }

  const body = (await req.json().catch(() => null)) as {
    topic_id?: string
    stance?: string
    statement?: string | null
  } | null

  if (!body?.topic_id || !body?.stance) {
    return NextResponse.json({ error: 'Missing topic_id or stance' }, { status: 400 })
  }

  const VALID_STANCES = ['for', 'against', 'neutral']
  if (!VALID_STANCES.includes(body.stance)) {
    return NextResponse.json(
      { error: 'stance must be one of: for, against, neutral' },
      { status: 400 }
    )
  }

  // Validate statement length
  if (body.statement && body.statement.length > 500) {
    return NextResponse.json({ error: 'Statement too long (max 500 chars)' }, { status: 400 })
  }

  // Upsert the stance (cast validated stance to the literal union)
  const typedStance = body.stance as 'for' | 'against' | 'neutral'

  const { data, error } = await supabase
    .from('coalition_stances')
    .upsert(
      {
        coalition_id: params.id,
        topic_id: body.topic_id as string,
        stance: typedStance,
        statement: body.statement?.trim() || null,
        declared_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'coalition_id,topic_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('[stance POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ stance: data })
}

/**
 * DELETE /api/coalitions/[id]/stance?topic_id=<uuid>
 * Removes the coalition's stance on a topic.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = req.nextUrl.searchParams.get('topic_id')
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topic_id' }, { status: 400 })
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: membership } = await supabase
    .from('coalition_members')
    .select('role')
    .eq('coalition_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['leader', 'officer'].includes(membership.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { error } = await supabase
    .from('coalition_stances')
    .delete()
    .eq('coalition_id', params.id)
    .eq('topic_id', topicId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
