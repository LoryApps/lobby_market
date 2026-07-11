import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { FilibusterEntry } from '../route'

export const dynamic = 'force-dynamic'

/**
 * GET /api/filibuster/[id]
 * Returns a single filibuster with full details.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: row, error } = await supabase
    .from('civic_filibusters')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [topicRes, profileRes, votesRes, myVoteRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', row.topic_id)
      .maybeSingle(),
    row.filibuster_id
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .eq('id', row.filibuster_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('civic_filibuster_votes')
      .select('user_id, vote, created_at, profiles(id, username, display_name, avatar_url, role)')
      .eq('filibuster_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
    user
      ? supabase
          .from('civic_filibuster_votes')
          .select('vote')
          .eq('filibuster_id', params.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const entry: FilibusterEntry = {
    id: row.id,
    topic_id: row.topic_id,
    filibuster_id: row.filibuster_id,
    title: row.title,
    speech: row.speech,
    grounds: row.grounds,
    cloture_count: row.cloture_count ?? 0,
    cloture_threshold: row.cloture_threshold ?? 10,
    second_count: row.second_count ?? 0,
    second_threshold: row.second_threshold ?? 5,
    extend_hours: row.extend_hours ?? 48,
    status: row.status,
    expires_at: row.expires_at,
    created_at: row.created_at,
    resolved_at: row.resolved_at ?? null,
    topic: topicRes.data ?? null,
    filibuster_user: profileRes.data ?? null,
    user_vote: myVoteRes.data
      ? (myVoteRes.data.vote as 'cloture' | 'second')
      : null,
  }

  return NextResponse.json({ filibuster: entry, votes: votesRes.data ?? [] })
}

/**
 * DELETE /api/filibuster/[id]
 * Withdraw an active filibuster (only the filibusterer can do this).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: row } = await supabase
    .from('civic_filibusters')
    .select('id, filibuster_id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (row.filibuster_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (row.status !== 'active') {
    return NextResponse.json({ error: 'Can only withdraw an active filibuster' }, { status: 400 })
  }

  await supabase
    .from('civic_filibusters')
    .update({ status: 'withdrawn', resolved_at: new Date().toISOString() })
    .eq('id', params.id)

  return NextResponse.json({ ok: true })
}
