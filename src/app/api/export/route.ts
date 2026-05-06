import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch all user data in parallel ────────────────────────────────────────

  const [
    profileRes,
    votesRes,
    argumentsRes,
    achievementsRes,
    debateParticipationsRes,
    coalitionMembershipsRes,
    predictionsRes,
    bookmarksRes,
    followingRes,
    followersRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select(`
        username, display_name, bio, role, clout, reputation_score,
        total_votes, total_arguments, blue_vote_count, red_vote_count,
        vote_streak, followers_count, following_count, civic_archetype,
        category_preferences, is_influencer, verification_tier, created_at
      `)
      .eq('id', user.id)
      .maybeSingle(),

    supabase
      .from('votes')
      .select('topic_id, side, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2000),

    supabase
      .from('topic_arguments')
      .select('id, topic_id, side, content, upvotes, source_url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500),

    supabase
      .from('user_achievements')
      .select('achievement_id, earned_at')
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false }),

    supabase
      .from('debate_participants')
      .select('debate_id, side, joined_at')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(100),

    supabase
      .from('coalition_members')
      .select('coalition_id, role, joined_at')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false }),

    supabase
      .from('topic_predictions')
      .select('topic_id, predicted_law, confidence, reasoning, resolved_at, correct, clout_earned, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500),

    supabase
      .from('topic_bookmarks')
      .select('topic_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500),

    supabase
      .from('user_follows')
      .select('following_id, created_at')
      .eq('follower_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1000),

    supabase
      .from('user_follows')
      .select('follower_id, created_at')
      .eq('following_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1000),
  ])

  // ── Assemble export payload ─────────────────────────────────────────────────

  const payload = {
    _meta: {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      platform: 'Lobby Market',
      version: '1.0',
    },
    profile: profileRes.data ?? null,
    stats: {
      total_votes: profileRes.data?.total_votes ?? 0,
      total_arguments: profileRes.data?.total_arguments ?? 0,
      achievements_earned: (achievementsRes.data ?? []).length,
      debates_participated: (debateParticipationsRes.data ?? []).length,
      coalitions_joined: (coalitionMembershipsRes.data ?? []).length,
      predictions_made: (predictionsRes.data ?? []).length,
    },
    votes: votesRes.data ?? [],
    arguments: argumentsRes.data ?? [],
    achievements: achievementsRes.data ?? [],
    debate_participations: debateParticipationsRes.data ?? [],
    coalition_memberships: coalitionMembershipsRes.data ?? [],
    predictions: predictionsRes.data ?? [],
    bookmarks: bookmarksRes.data ?? [],
    following: followingRes.data ?? [],
    followers: followersRes.data ?? [],
  }

  const filename = `lobby-market-export-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
