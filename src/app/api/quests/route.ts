import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestTrack = 'voter' | 'debater' | 'scholar' | 'builder'

export type QuestTier = 'bronze' | 'silver' | 'gold' | 'legendary'

export interface Quest {
  id: string
  track: QuestTrack
  tier: QuestTier
  title: string
  description: string
  reward_clout: number
  progress: number
  target: number
  completed: boolean
  unlocked: boolean
  prerequisite_id: string | null
}

export interface QuestTrackSummary {
  track: QuestTrack
  label: string
  description: string
  completed: number
  total: number
  clout_earned: number
  clout_total: number
  level: number
}

export interface QuestsResponse {
  quests: Quest[]
  tracks: QuestTrackSummary[]
  total_clout_earned: number
  total_completed: number
  overall_level: number
  is_authenticated: boolean
}

// ─── Quest definitions ────────────────────────────────────────────────────────

interface QuestTemplate {
  id: string
  track: QuestTrack
  tier: QuestTier
  title: string
  description: string
  reward_clout: number
  target: number
  prerequisite_id: string | null
}

const QUEST_DEFINITIONS: QuestTemplate[] = [
  // ── Voter track ────────────────────────────────────────────────────────────
  {
    id: 'vote_first',
    track: 'voter',
    tier: 'bronze',
    title: 'First Vote',
    description: 'Cast your very first vote on any topic',
    reward_clout: 5,
    target: 1,
    prerequisite_id: null,
  },
  {
    id: 'vote_25',
    track: 'voter',
    tier: 'bronze',
    title: 'Getting Civic',
    description: 'Cast 25 votes across any topics',
    reward_clout: 20,
    target: 25,
    prerequisite_id: 'vote_first',
  },
  {
    id: 'vote_100',
    track: 'voter',
    tier: 'silver',
    title: 'Active Citizen',
    description: 'Cast 100 votes across all topics',
    reward_clout: 50,
    target: 100,
    prerequisite_id: 'vote_25',
  },
  {
    id: 'vote_500',
    track: 'voter',
    tier: 'gold',
    title: 'Civic Pillar',
    description: 'Cast 500 votes — a true voice in the Lobby',
    reward_clout: 150,
    target: 500,
    prerequisite_id: 'vote_100',
  },
  {
    id: 'vote_1000',
    track: 'voter',
    tier: 'legendary',
    title: 'People\'s Champion',
    description: 'Cast 1,000 votes and become a cornerstone of the Lobby',
    reward_clout: 400,
    target: 1000,
    prerequisite_id: 'vote_500',
  },
  {
    id: 'vote_streak_3',
    track: 'voter',
    tier: 'bronze',
    title: 'Daily Habit',
    description: 'Vote on 3 consecutive days',
    reward_clout: 15,
    target: 3,
    prerequisite_id: 'vote_first',
  },
  {
    id: 'vote_streak_7',
    track: 'voter',
    tier: 'silver',
    title: 'Weekly Voter',
    description: 'Vote every day for a full week',
    reward_clout: 40,
    target: 7,
    prerequisite_id: 'vote_streak_3',
  },
  {
    id: 'vote_streak_30',
    track: 'voter',
    tier: 'gold',
    title: 'Unbroken Conviction',
    description: 'Maintain a 30-day voting streak',
    reward_clout: 200,
    target: 30,
    prerequisite_id: 'vote_streak_7',
  },
  // ── Debater track ──────────────────────────────────────────────────────────
  {
    id: 'argue_first',
    track: 'debater',
    tier: 'bronze',
    title: 'First Argument',
    description: 'Write your first argument on any topic',
    reward_clout: 10,
    target: 1,
    prerequisite_id: null,
  },
  {
    id: 'argue_5',
    track: 'debater',
    tier: 'bronze',
    title: 'Making Your Case',
    description: 'Write 5 arguments across different topics',
    reward_clout: 30,
    target: 5,
    prerequisite_id: 'argue_first',
  },
  {
    id: 'argue_25',
    track: 'debater',
    tier: 'silver',
    title: 'Prolific Debater',
    description: 'Write 25 arguments — your voice carries weight',
    reward_clout: 80,
    target: 25,
    prerequisite_id: 'argue_5',
  },
  {
    id: 'argue_100',
    track: 'debater',
    tier: 'gold',
    title: 'Master Orator',
    description: 'Write 100 arguments across the Lobby',
    reward_clout: 250,
    target: 100,
    prerequisite_id: 'argue_25',
  },
  {
    id: 'debate_join',
    track: 'debater',
    tier: 'bronze',
    title: 'Into the Arena',
    description: 'Participate in your first live debate',
    reward_clout: 20,
    target: 1,
    prerequisite_id: 'argue_first',
  },
  {
    id: 'debate_5',
    track: 'debater',
    tier: 'silver',
    title: 'Battle-Tested',
    description: 'Participate in 5 live debates',
    reward_clout: 75,
    target: 5,
    prerequisite_id: 'debate_join',
  },
  {
    id: 'debate_25',
    track: 'debater',
    tier: 'gold',
    title: 'Debate Veteran',
    description: 'Participate in 25 live debates',
    reward_clout: 200,
    target: 25,
    prerequisite_id: 'debate_5',
  },
  // ── Scholar track ──────────────────────────────────────────────────────────
  {
    id: 'wiki_first',
    track: 'scholar',
    tier: 'bronze',
    title: 'First Edit',
    description: 'Make your first wiki contribution on any topic',
    reward_clout: 10,
    target: 1,
    prerequisite_id: null,
  },
  {
    id: 'wiki_5',
    track: 'scholar',
    tier: 'bronze',
    title: 'Wiki Contributor',
    description: 'Contribute to 5 topic wikis',
    reward_clout: 35,
    target: 5,
    prerequisite_id: 'wiki_first',
  },
  {
    id: 'wiki_20',
    track: 'scholar',
    tier: 'silver',
    title: 'Research Specialist',
    description: 'Contribute to 20 topic wikis',
    reward_clout: 100,
    target: 20,
    prerequisite_id: 'wiki_5',
  },
  {
    id: 'source_argument',
    track: 'scholar',
    tier: 'bronze',
    title: 'Cite Your Sources',
    description: 'Write an argument with a source URL attached',
    reward_clout: 15,
    target: 1,
    prerequisite_id: 'argue_first',
  },
  {
    id: 'source_10',
    track: 'scholar',
    tier: 'silver',
    title: 'Evidence-Based',
    description: 'Write 10 arguments with sources',
    reward_clout: 60,
    target: 10,
    prerequisite_id: 'source_argument',
  },
  {
    id: 'vote_categories_5',
    track: 'scholar',
    tier: 'silver',
    title: 'Renaissance Citizen',
    description: 'Vote on topics in 5 different categories',
    reward_clout: 50,
    target: 5,
    prerequisite_id: null,
  },
  {
    id: 'vote_categories_all',
    track: 'scholar',
    tier: 'gold',
    title: 'Polymathic Voter',
    description: 'Vote in all 10 civic categories',
    reward_clout: 150,
    target: 10,
    prerequisite_id: 'vote_categories_5',
  },
  // ── Builder track ──────────────────────────────────────────────────────────
  {
    id: 'follow_first',
    track: 'builder',
    tier: 'bronze',
    title: 'First Connection',
    description: 'Follow your first fellow citizen',
    reward_clout: 5,
    target: 1,
    prerequisite_id: null,
  },
  {
    id: 'follow_10',
    track: 'builder',
    tier: 'bronze',
    title: 'Building a Network',
    description: 'Follow 10 fellow citizens',
    reward_clout: 20,
    target: 10,
    prerequisite_id: 'follow_first',
  },
  {
    id: 'followers_5',
    track: 'builder',
    tier: 'silver',
    title: 'Rising Voice',
    description: 'Earn 5 followers',
    reward_clout: 40,
    target: 5,
    prerequisite_id: 'follow_first',
  },
  {
    id: 'followers_50',
    track: 'builder',
    tier: 'gold',
    title: 'Civic Influencer',
    description: 'Earn 50 followers',
    reward_clout: 150,
    target: 50,
    prerequisite_id: 'followers_5',
  },
  {
    id: 'coalition_join',
    track: 'builder',
    tier: 'bronze',
    title: 'Strength in Unity',
    description: 'Join or create your first coalition',
    reward_clout: 15,
    target: 1,
    prerequisite_id: 'follow_first',
  },
  {
    id: 'upvote_10',
    track: 'builder',
    tier: 'bronze',
    title: 'Show Support',
    description: 'Upvote 10 arguments from other citizens',
    reward_clout: 10,
    target: 10,
    prerequisite_id: null,
  },
  {
    id: 'upvote_50',
    track: 'builder',
    tier: 'silver',
    title: 'Community Champion',
    description: 'Upvote 50 arguments — lift the discourse',
    reward_clout: 40,
    target: 50,
    prerequisite_id: 'upvote_10',
  },
]

// ─── Progress calculators ─────────────────────────────────────────────────────

async function getQuestProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Map<string, number>> {
  const progress = new Map<string, number>()

  const [
    { data: profile },
    { count: wikiCount },
    { count: sourceArgCount },
    { count: debateCount },
    { count: coalitionCount },
    { count: upvoteCount },
    { data: categoryData },
    { count: followingCount },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('total_votes, total_arguments, vote_streak, followers_count')
      .eq('id', userId)
      .maybeSingle(),

    // Wiki edits — topic descriptions edited by this user
    supabase
      .from('topics')
      .select('*', { count: 'exact', head: true })
      .eq('description_updated_by', userId),

    // Arguments with sources
    supabase
      .from('arguments')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)
      .not('source_url', 'is', null),

    // Debate participations
    supabase
      .from('debate_participants')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),

    // Coalition memberships
    supabase
      .from('coalition_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),

    // Argument upvotes given
    supabase
      .from('argument_upvotes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),

    // Categories voted in
    supabase
      .from('votes')
      .select('topics(category)')
      .eq('user_id', userId),

    // Following count
    supabase
      .from('user_follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId),
  ])

  const totalVotes = profile?.total_votes ?? 0
  const totalArgs = profile?.total_arguments ?? 0
  const streak = profile?.vote_streak ?? 0
  const followersCount = profile?.followers_count ?? 0

  // Voter track
  progress.set('vote_first', Math.min(totalVotes, 1))
  progress.set('vote_25', Math.min(totalVotes, 25))
  progress.set('vote_100', Math.min(totalVotes, 100))
  progress.set('vote_500', Math.min(totalVotes, 500))
  progress.set('vote_1000', Math.min(totalVotes, 1000))
  progress.set('vote_streak_3', Math.min(streak, 3))
  progress.set('vote_streak_7', Math.min(streak, 7))
  progress.set('vote_streak_30', Math.min(streak, 30))

  // Debater track
  progress.set('argue_first', Math.min(totalArgs, 1))
  progress.set('argue_5', Math.min(totalArgs, 5))
  progress.set('argue_25', Math.min(totalArgs, 25))
  progress.set('argue_100', Math.min(totalArgs, 100))
  progress.set('debate_join', Math.min(debateCount ?? 0, 1))
  progress.set('debate_5', Math.min(debateCount ?? 0, 5))
  progress.set('debate_25', Math.min(debateCount ?? 0, 25))

  // Scholar track
  progress.set('wiki_first', Math.min(wikiCount ?? 0, 1))
  progress.set('wiki_5', Math.min(wikiCount ?? 0, 5))
  progress.set('wiki_20', Math.min(wikiCount ?? 0, 20))
  progress.set('source_argument', Math.min(sourceArgCount ?? 0, 1))
  progress.set('source_10', Math.min(sourceArgCount ?? 0, 10))

  const distinctCategories = new Set(
    (categoryData ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r.topics?.category as string | null | undefined)
      .filter(Boolean),
  ).size
  progress.set('vote_categories_5', Math.min(distinctCategories, 5))
  progress.set('vote_categories_all', Math.min(distinctCategories, 10))

  // Builder track
  progress.set('follow_first', Math.min(followingCount ?? 0, 1))
  progress.set('follow_10', Math.min(followingCount ?? 0, 10))
  progress.set('followers_5', Math.min(followersCount, 5))
  progress.set('followers_50', Math.min(followersCount, 50))
  progress.set('coalition_join', Math.min(coalitionCount ?? 0, 1))
  progress.set('upvote_10', Math.min(upvoteCount ?? 0, 10))
  progress.set('upvote_50', Math.min(upvoteCount ?? 0, 50))

  return progress
}

// ─── Level calculator ─────────────────────────────────────────────────────────

function calcLevel(completedCount: number): number {
  if (completedCount === 0) return 1
  if (completedCount < 3) return 2
  if (completedCount < 6) return 3
  if (completedCount < 10) return 4
  if (completedCount < 15) return 5
  if (completedCount < 20) return 6
  if (completedCount < 25) return 7
  return 8
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const empty: QuestsResponse = {
      quests: QUEST_DEFINITIONS.map((q) => ({
        ...q,
        progress: 0,
        completed: false,
        unlocked: q.prerequisite_id === null,
      })),
      tracks: buildTrackSummaries([], QUEST_DEFINITIONS),
      total_clout_earned: 0,
      total_completed: 0,
      overall_level: 1,
      is_authenticated: false,
    }
    return NextResponse.json(empty)
  }

  const progressMap = await getQuestProgress(supabase, user.id)

  // Build resolved quests
  const resolvedQuests: Quest[] = QUEST_DEFINITIONS.map((def) => {
    const prog = progressMap.get(def.id) ?? 0
    const completed = prog >= def.target

    // A quest is unlocked if it has no prerequisite or the prerequisite is completed
    let unlocked = def.prerequisite_id === null
    if (def.prerequisite_id) {
      const prereqProg = progressMap.get(def.prerequisite_id) ?? 0
      const prereqDef = QUEST_DEFINITIONS.find((d) => d.id === def.prerequisite_id)
      unlocked = prereqDef ? prereqProg >= prereqDef.target : false
    }

    return {
      ...def,
      progress: prog,
      completed,
      unlocked,
    }
  })

  const completed = resolvedQuests.filter((q) => q.completed)
  const totalClout = completed.reduce((sum, q) => sum + q.reward_clout, 0)

  return NextResponse.json({
    quests: resolvedQuests,
    tracks: buildTrackSummaries(resolvedQuests, QUEST_DEFINITIONS),
    total_clout_earned: totalClout,
    total_completed: completed.length,
    overall_level: calcLevel(completed.length),
    is_authenticated: true,
  } satisfies QuestsResponse)
}

function buildTrackSummaries(
  resolved: Quest[],
  definitions: QuestTemplate[],
): QuestTrackSummary[] {
  const TRACK_META: Record<QuestTrack, { label: string; description: string }> = {
    voter: { label: 'Voter', description: 'Cast your ballot and shape the Lobby' },
    debater: { label: 'Debater', description: 'Argue your case in live debates' },
    scholar: { label: 'Scholar', description: 'Research, cite, and educate the Lobby' },
    builder: { label: 'Builder', description: 'Grow the community and lift others' },
  }

  return (['voter', 'debater', 'scholar', 'builder'] as QuestTrack[]).map((track) => {
    const trackResolved = resolved.filter((q) => q.track === track)
    const trackDefs = definitions.filter((q) => q.track === track)
    const done = trackResolved.filter((q) => q.completed)
    const cloutEarned = done.reduce((s, q) => s + q.reward_clout, 0)
    const cloutTotal = trackDefs.reduce((s, q) => s + q.reward_clout, 0)

    return {
      track,
      ...TRACK_META[track],
      completed: done.length,
      total: trackDefs.length,
      clout_earned: cloutEarned,
      clout_total: cloutTotal,
      level: calcLevel(done.length),
    }
  })
}
