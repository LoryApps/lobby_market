import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SkillTreeStats {
  authenticated: boolean
  profile: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    total_votes: number
    total_arguments: number
    vote_streak: number
    reputation_score: number
    verification_tier: number
    followers_count: number
    member_days: number
  } | null
  training: {
    cases_attempted: number
    cases_correct: number
    accuracy_pct: number
    passed: boolean
  } | null
  laws_voted_for: number
  bookmarked_topics: number
  bookmarked_arguments: number
  coalitions_joined: number
  predictions_made: number
  debate_participations: number
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({
      authenticated: false,
      profile: null,
      training: null,
      laws_voted_for: 0,
      bookmarked_topics: 0,
      bookmarked_arguments: 0,
      coalitions_joined: 0,
      predictions_made: 0,
      debate_participations: 0,
    } satisfies SkillTreeStats)
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, avatar_url, role, clout, total_votes, total_arguments, vote_streak, reputation_score, verification_tier, followers_count, created_at'
    )
    .eq('id', user.id)
    .maybeSingle()

  // Fetch troll catcher training
  const { data: training } = await supabase
    .from('troll_catcher_training')
    .select('cases_attempted, cases_correct, accuracy_pct, passed')
    .eq('user_id', user.id)
    .maybeSingle()

  // Count laws that user voted FOR and that became law
  const { count: lawsVotedFor } = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('side', 'blue')

  // Count bookmarked topics
  const { count: bookmarkedTopics } = await supabase
    .from('topic_bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Count bookmarked arguments
  const { count: bookmarkedArgs } = await supabase
    .from('argument_bookmarks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Count coalition memberships
  const { count: coalitionsJoined } = await supabase
    .from('coalition_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Count predictions
  const { count: predictionsMade } = await supabase
    .from('predictions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Count debate participations
  const { count: debateParticipations } = await supabase
    .from('debate_participants')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const memberDays = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86_400_000)
    : 0

  return NextResponse.json({
    authenticated: true,
    profile: profile
      ? {
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          role: profile.role,
          clout: profile.clout,
          total_votes: profile.total_votes,
          total_arguments: profile.total_arguments,
          vote_streak: profile.vote_streak,
          reputation_score: profile.reputation_score,
          verification_tier: profile.verification_tier,
          followers_count: profile.followers_count,
          member_days: memberDays,
        }
      : null,
    training: training ?? null,
    laws_voted_for: lawsVotedFor ?? 0,
    bookmarked_topics: bookmarkedTopics ?? 0,
    bookmarked_arguments: bookmarkedArgs ?? 0,
    coalitions_joined: coalitionsJoined ?? 0,
    predictions_made: predictionsMade ?? 0,
    debate_participations: debateParticipations ?? 0,
  } satisfies SkillTreeStats)
}
