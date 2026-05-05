import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me
 *
 * Returns the current user's id and key profile fields.
 * Used by client components to check auth status without fetching
 * the full profile. Returns 200 with null id when unauthenticated.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ id: null, authenticated: false })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, vote_streak, total_votes')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ id: user.id, authenticated: true })
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
    })
  } catch {
    return NextResponse.json({ id: null, authenticated: false })
  }
}
