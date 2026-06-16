import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RivalryCoalition {
  id: string
  name: string
  description: string | null
  member_count: number
  max_members: number
  coalition_influence: number
  wins: number
  losses: number
  is_public: boolean
  created_at: string
  creator_username: string | null
  creator_display_name: string | null
  creator_avatar_url: string | null
}

export interface HeadToHeadChallenge {
  id: string
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicStatus: string
  aStance: 'for' | 'against' | 'neutral' | null
  bStance: 'for' | 'against' | 'neutral' | null
  status: string
  winnerId: string | null
  message: string | null
  stakeClout: number
  createdAt: string
  resolvedAt: string | null
}

export interface SharedStance {
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicStatus: string
  blue_pct: number
  total_votes: number
  aStance: 'for' | 'against' | 'neutral'
  bStance: 'for' | 'against' | 'neutral'
  agree: boolean
}

export interface RivalryResponse {
  coalitionA: RivalryCoalition
  coalitionB: RivalryCoalition
  headToHead: {
    aWins: number
    bWins: number
    draws: number
    total: number
    challenges: HeadToHeadChallenge[]
  }
  sharedStances: SharedStance[]
  memberOverlap: number
  similarityScore: number
}

// ─── GET /api/coalitions/rivalry?a=<id>&b=<id> ────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const idA = searchParams.get('a')
  const idB = searchParams.get('b')

  if (!idA || !idB || idA === idB) {
    return NextResponse.json({ error: 'Two distinct coalition IDs required' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    // 1. Fetch both coalitions with their creator profiles
    const [resA, resB] = await Promise.all([
      supabase
        .from('coalitions')
        .select('id, name, description, member_count, max_members, coalition_influence, wins, losses, is_public, created_at, creator_id')
        .eq('id', idA)
        .single(),
      supabase
        .from('coalitions')
        .select('id, name, description, member_count, max_members, coalition_influence, wins, losses, is_public, created_at, creator_id')
        .eq('id', idB)
        .single(),
    ])

    if (!resA.data || !resB.data) {
      return NextResponse.json({ error: 'One or both coalitions not found' }, { status: 404 })
    }

    const rawA = resA.data as {
      id: string; name: string; description: string | null
      member_count: number; max_members: number; coalition_influence: number
      wins: number; losses: number; is_public: boolean; created_at: string; creator_id: string | null
    }
    const rawB = resB.data as typeof rawA

    // 2. Fetch creators
    const creatorIds = Array.from(new Set([rawA.creator_id, rawB.creator_id].filter(Boolean) as string[]))
    const creatorsRes = creatorIds.length
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', creatorIds)
      : { data: [] as { id: string; username: string; display_name: string | null; avatar_url: string | null }[] }

    const creatorsMap = new Map((creatorsRes.data ?? []).map((p) => [p.id, p]))

    function enrichCoalition(raw: typeof rawA): RivalryCoalition {
      const c = raw.creator_id ? creatorsMap.get(raw.creator_id) : null
      return {
        id: raw.id,
        name: raw.name,
        description: raw.description,
        member_count: raw.member_count,
        max_members: raw.max_members,
        coalition_influence: raw.coalition_influence,
        wins: raw.wins,
        losses: raw.losses,
        is_public: raw.is_public,
        created_at: raw.created_at,
        creator_username: c?.username ?? null,
        creator_display_name: c?.display_name ?? null,
        creator_avatar_url: c?.avatar_url ?? null,
      }
    }

    const coalitionA = enrichCoalition(rawA)
    const coalitionB = enrichCoalition(rawB)

    // 3. Head-to-head challenges between these two coalitions
    const challengesRes = await supabase
      .from('coalition_challenges')
      .select(`
        id,
        topic_id,
        challenger_id,
        challenged_id,
        challenger_stance,
        challenged_stance,
        status,
        winner_id,
        message,
        stake_clout,
        created_at,
        resolved_at,
        topics!coalition_challenges_topic_id_fkey (
          id, statement, category, status
        )
      `)
      .or(
        `and(challenger_id.eq.${idA},challenged_id.eq.${idB}),and(challenger_id.eq.${idB},challenged_id.eq.${idA})`
      )
      .order('created_at', { ascending: false })
      .limit(50)

    type RawChallenge = {
      id: string
      topic_id: string
      challenger_id: string
      challenged_id: string
      challenger_stance: string | null
      challenged_stance: string | null
      status: string
      winner_id: string | null
      message: string | null
      stake_clout: number
      created_at: string
      resolved_at: string | null
      topics: { id: string; statement: string; category: string | null; status: string } | null
    }

    const rawChallenges = (challengesRes.data ?? []) as RawChallenge[]

    let aWins = 0
    let bWins = 0
    let draws = 0

    const challenges: HeadToHeadChallenge[] = rawChallenges.map((ch) => {
      const aIsChallenger = ch.challenger_id === idA
      const aStance = aIsChallenger ? ch.challenger_stance : ch.challenged_stance
      const bStance = aIsChallenger ? ch.challenged_stance : ch.challenger_stance

      if (ch.winner_id === idA) aWins++
      else if (ch.winner_id === idB) bWins++
      else if (ch.status === 'resolved') draws++

      return {
        id: ch.id,
        topicId: ch.topic_id,
        topicStatement: ch.topics?.statement ?? '(Unknown topic)',
        topicCategory: ch.topics?.category ?? null,
        topicStatus: ch.topics?.status ?? 'unknown',
        aStance: aStance as 'for' | 'against' | 'neutral' | null,
        bStance: bStance as 'for' | 'against' | 'neutral' | null,
        status: ch.status,
        winnerId: ch.winner_id,
        message: ch.message,
        stakeClout: ch.stake_clout,
        createdAt: ch.created_at,
        resolvedAt: ch.resolved_at,
      }
    })

    // 4. Shared stances — topics where BOTH coalitions have declared stances
    const [stancesA, stancesB] = await Promise.all([
      supabase
        .from('coalition_stances')
        .select('topic_id, stance')
        .eq('coalition_id', idA),
      supabase
        .from('coalition_stances')
        .select('topic_id, stance')
        .eq('coalition_id', idB),
    ])

    type StanceRow = { topic_id: string; stance: string }
    const stanceMapA = new Map((stancesA.data ?? []).map((s: StanceRow) => [s.topic_id, s.stance as 'for' | 'against' | 'neutral']))
    const stanceMapB = new Map((stancesB.data ?? []).map((s: StanceRow) => [s.topic_id, s.stance as 'for' | 'against' | 'neutral']))

    const sharedTopicIds = [...stanceMapA.keys()].filter((tid) => stanceMapB.has(tid))

    let sharedStances: SharedStance[] = []
    if (sharedTopicIds.length > 0) {
      const topicsRes = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes')
        .in('id', sharedTopicIds.slice(0, 50))

      type TopicRow = { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }
      sharedStances = (topicsRes.data ?? []).map((t: TopicRow) => {
        const aS = stanceMapA.get(t.id)!
        const bS = stanceMapB.get(t.id)!
        return {
          topicId: t.id,
          topicStatement: t.statement,
          topicCategory: t.category,
          topicStatus: t.status,
          blue_pct: t.blue_pct,
          total_votes: t.total_votes,
          aStance: aS,
          bStance: bS,
          agree: aS === bS,
        }
      })

      // Sort: disagreements first (more interesting), then agreements
      sharedStances.sort((a, b) => (a.agree ? 1 : 0) - (b.agree ? 1 : 0))
    }

    // 5. Member overlap — shared member user IDs
    const [membersA, membersB] = await Promise.all([
      supabase.from('coalition_members').select('user_id').eq('coalition_id', idA),
      supabase.from('coalition_members').select('user_id').eq('coalition_id', idB),
    ])

    const setA = new Set((membersA.data ?? []).map((m: { user_id: string }) => m.user_id))
    const overlapCount = (membersB.data ?? []).filter((m: { user_id: string }) => setA.has(m.user_id)).length

    // 6. Similarity score (0-100): % stances that agree out of shared + member overlap bonus
    let similarityScore = 50 // neutral baseline
    if (sharedStances.length > 0) {
      const agreeCount = sharedStances.filter((s) => s.agree).length
      similarityScore = Math.round((agreeCount / sharedStances.length) * 100)
    }

    const response: RivalryResponse = {
      coalitionA,
      coalitionB,
      headToHead: {
        aWins,
        bWins,
        draws,
        total: rawChallenges.length,
        challenges,
      },
      sharedStances: sharedStances.slice(0, 30),
      memberOverlap: overlapCount,
      similarityScore,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('Coalition rivalry error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
