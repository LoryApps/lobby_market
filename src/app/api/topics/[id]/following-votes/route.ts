import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface FollowingVoter {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  side: 'blue' | 'red'
}

export interface FollowingVotesResponse {
  voters: FollowingVoter[]
  for_count: number
  against_count: number
  total: number
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { voters: [], for_count: 0, against_count: 0, total: 0 } satisfies FollowingVotesResponse
    )
  }

  // Fetch IDs of users the current user follows
  const { data: followRows } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', user.id)

  if (!followRows || followRows.length === 0) {
    return NextResponse.json(
      { voters: [], for_count: 0, against_count: 0, total: 0 } satisfies FollowingVotesResponse
    )
  }

  const followingIds = followRows.map((r) => r.following_id)

  // Fetch votes on this topic from followed users
  const { data: voteRows } = await supabase
    .from('votes')
    .select('user_id, side, profiles!votes_user_id_fkey(id, username, display_name, avatar_url)')
    .eq('topic_id', params.id)
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(50)

  const voters: FollowingVoter[] = (voteRows ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      id: profile?.id ?? row.user_id,
      username: profile?.username ?? 'unknown',
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      side: row.side as 'blue' | 'red',
    }
  })

  const for_count = voters.filter((v) => v.side === 'blue').length
  const against_count = voters.filter((v) => v.side === 'red').length

  return NextResponse.json({
    voters,
    for_count,
    against_count,
    total: voters.length,
  } satisfies FollowingVotesResponse)
}
