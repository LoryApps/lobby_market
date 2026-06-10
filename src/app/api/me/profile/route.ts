import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/profile
 *
 * Returns the authenticated user's profile. Used by client components that
 * need to verify auth status and load basic profile data.
 * Returns 401 when unauthenticated.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, role, clout, vote_streak, total_votes, bio'
      )
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json(
        { id: user.id, username: null, authenticated: true },
        { status: 200 }
      )
    }

    return NextResponse.json({
      id: profile.id,
      authenticated: true,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
      vote_streak: profile.vote_streak,
      total_votes: profile.total_votes,
      bio: profile.bio,
    })
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
