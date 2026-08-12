import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  // ── Profile ──────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, bio, role, clout, reputation_score, ' +
      'total_votes, total_arguments, blue_vote_count, red_vote_count, vote_streak, ' +
      'civic_archetype, created_at'
    )
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ── Topics that became law ────────────────────────────────────────────────
  const { data: laws } = await supabase
    .from('topics')
    .select('id, statement, category, total_votes, blue_pct, created_at')
    .eq('author_id', profile.id)
    .eq('status', 'law')
    .order('total_votes', { ascending: false })
    .limit(5)

  // ── Topics authored total ────────────────────────────────────────────────
  const { count: topicsAuthored } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', profile.id)

  // ── Top arguments ─────────────────────────────────────────────────────────
  const { data: topArgs } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, created_at, topics(id, statement, category, status)')
    .eq('user_id', profile.id)
    .order('upvotes', { ascending: false })
    .limit(3)

  // ── Achievements ─────────────────────────────────────────────────────────
  const { data: earnedAchievements } = await supabase
    .from('user_achievements')
    .select('earned_at, achievements(slug, name, description, icon, tier)')
    .eq('user_id', profile.id)
    .order('earned_at', { ascending: false })
    .limit(9)

  return NextResponse.json({
    profile,
    laws: laws ?? [],
    topicsAuthored: topicsAuthored ?? 0,
    topArguments: topArgs ?? [],
    achievements: earnedAchievements ?? [],
  })
}
