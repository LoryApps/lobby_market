import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface V1UserProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: string
  clout: number
  total_votes: number
  total_arguments: number
  vote_streak: number
  civic_archetype: string | null
  followers_count: number
  following_count: number
  member_since: string
  url: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
}

const BASE_URL = 'https://lobby.market'

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(
  _req: Request,
  { params }: { params: { username: string } },
) {
  const username = params.username?.toLowerCase().trim()

  if (!username || !/^[a-z0-9_-]{2,32}$/.test(username)) {
    return NextResponse.json(
      {
        error: 'Invalid username format',
        docs: `${BASE_URL}/developers#rest-api`,
      },
      { status: 400, headers: CORS },
    )
  }

  try {
    const supabase = await createClient()

    const { data: user, error } = await supabase
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, bio, role, clout, total_votes, total_arguments, vote_streak, civic_archetype, followers_count, following_count, created_at',
      )
      .eq('username', username)
      .neq('role', 'admin')
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'User not found', docs: `${BASE_URL}/developers#rest-api` },
        { status: 404, headers: CORS },
      )
    }

    const profile: V1UserProfile = {
      id: user.id,
      username: user.username,
      display_name: user.display_name ?? null,
      avatar_url: user.avatar_url ?? null,
      bio: user.bio ?? null,
      role: user.role ?? 'person',
      clout: user.clout ?? 0,
      total_votes: user.total_votes ?? 0,
      total_arguments: user.total_arguments ?? 0,
      vote_streak: user.vote_streak ?? 0,
      civic_archetype: user.civic_archetype ?? null,
      followers_count: user.followers_count ?? 0,
      following_count: user.following_count ?? 0,
      member_since: user.created_at,
      url: `${BASE_URL}/profile/${user.username}`,
    }

    return NextResponse.json(profile, { headers: CORS })
  } catch (err) {
    console.error('[/api/v1/users/[username]]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: CORS },
    )
  }
}
