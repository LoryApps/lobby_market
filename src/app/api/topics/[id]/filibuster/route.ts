import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { FilibusterEntry } from '@/app/api/filibuster/route'

export const dynamic = 'force-dynamic'

/**
 * GET /api/topics/[id]/filibuster
 * Returns the active (or most recent) filibuster for a topic.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: row } = await supabase
    .from('civic_filibusters')
    .select('*')
    .eq('topic_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) {
    return NextResponse.json({ filibuster: null })
  }

  const [profileRes, myVoteRes] = await Promise.all([
    row.filibuster_id
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .eq('id', row.filibuster_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from('civic_filibuster_votes')
          .select('vote')
          .eq('filibuster_id', row.id)
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
    topic: null,
    filibuster_user: profileRes.data ?? null,
    user_vote: myVoteRes.data
      ? (myVoteRes.data.vote as 'cloture' | 'second')
      : null,
  }

  return NextResponse.json({ filibuster: entry })
}
