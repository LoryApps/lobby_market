import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FoundingArgument {
  id: string
  content: string
  side: 'for' | 'against'
  upvotes: number
  reply_count: number
  created_at: string
  author_id: string | null
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
  author_clout: number
  is_first_for: boolean
  is_first_against: boolean
}

export interface EarlyVoter {
  user_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  clout: number
  side: 'for' | 'against'
  voted_at: string
  rank: number
}

export interface VoteSnapshot {
  day: number        // days since topic creation
  for_count: number
  against_count: number
  total: number
}

export interface OriginsResponse {
  topic: {
    id: string
    statement: string
    description: string | null
    category: string | null
    scope: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
    age_days: number
  }
  founder: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    clout: number
    role: string
    total_topics_proposed: number
  } | null
  founding_arguments: FoundingArgument[]
  pioneer_voters: EarlyVoter[]
  first_week_stats: {
    arguments_in_week: number
    votes_in_week: number
    for_in_week: number
    against_in_week: number
    top_early_argument: string | null
  }
  vote_snapshots: VoteSnapshot[]
  total_pioneers: number
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const topicId = params.id

  // ── 1. Topic metadata ──────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select(`
      id, statement, description, category, scope, status,
      blue_pct, total_votes, created_at, user_id
    `)
    .eq('id', topicId)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const createdAt = new Date(topic.created_at)
  const now = new Date()
  const ageDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))

  // ── 2. Founder profile ─────────────────────────────────────────────────────
  let founder: OriginsResponse['founder'] = null
  if (topic.user_id) {
    const { data: fp } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, clout, role')
      .eq('id', topic.user_id)
      .maybeSingle()

    if (fp) {
      // Count how many topics this user has proposed
      const { count: topicCount } = await supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', topic.user_id)

      founder = {
        id: fp.id,
        username: fp.username,
        display_name: fp.display_name,
        avatar_url: fp.avatar_url,
        clout: fp.clout ?? 0,
        role: fp.role ?? 'person',
        total_topics_proposed: topicCount ?? 1,
      }
    }
  }

  // ── 3. Founding arguments (first 12, ordered by creation time) ────────────
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select(`
      id, content, side, upvotes, reply_count, created_at,
      author:profiles!user_id(id, username, display_name, avatar_url, clout)
    `)
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })
    .limit(12)

  let firstForSeen = false
  let firstAgainstSeen = false

  const foundingArguments: FoundingArgument[] = (rawArgs ?? []).map(a => {
    const argSide: 'for' | 'against' = a.side === 'blue' ? 'for' : 'against'
    const isFirstFor = argSide === 'for' && !firstForSeen
    const isFirstAgainst = argSide === 'against' && !firstAgainstSeen
    if (isFirstFor) firstForSeen = true
    if (isFirstAgainst) firstAgainstSeen = true

    const author = Array.isArray(a.author) ? a.author[0] : a.author
    return {
      id: a.id,
      content: a.content,
      side: argSide,
      upvotes: a.upvotes ?? 0,
      reply_count: a.reply_count ?? 0,
      created_at: a.created_at,
      author_id: author?.id ?? null,
      author_username: author?.username ?? null,
      author_display_name: author?.display_name ?? null,
      author_avatar_url: author?.avatar_url ?? null,
      author_clout: author?.clout ?? 0,
      is_first_for: isFirstFor,
      is_first_against: isFirstAgainst,
    }
  })

  // ── 4. Pioneer voters (first 20 votes, ordered by created_at) ────────────
  const { data: earlyVotes } = await supabase
    .from('votes')
    .select('user_id, side, created_at')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })
    .limit(20)

  let pioneerVoters: EarlyVoter[] = []
  if (earlyVotes && earlyVotes.length > 0) {
    const voteUserIds = earlyVotes.map(v => v.user_id)
    const { data: pioneerProfiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, clout')
      .in('id', voteUserIds)

    const profileMap = new Map<string, { username: string | null; display_name: string | null; avatar_url: string | null; clout: number }>()
    for (const p of pioneerProfiles ?? []) {
      profileMap.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, clout: p.clout ?? 0 })
    }

    pioneerVoters = earlyVotes.map((v, i) => {
      const p = profileMap.get(v.user_id) ?? { username: null, display_name: null, avatar_url: null, clout: 0 }
      return {
        user_id: v.user_id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        clout: p.clout,
        side: v.side === 'blue' ? 'for' : 'against',
        voted_at: v.created_at,
        rank: i + 1,
      }
    })
  }

  // ── 5. First-week stats ───────────────────────────────────────────────────
  const oneWeekAfter = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)

  const { data: weekArgs } = await supabase
    .from('topic_arguments')
    .select('id, content, upvotes, side')
    .eq('topic_id', topicId)
    .lte('created_at', oneWeekAfter.toISOString())

  const { data: weekVotes } = await supabase
    .from('votes')
    .select('side')
    .eq('topic_id', topicId)
    .lte('created_at', oneWeekAfter.toISOString())

  const weekArgCount = weekArgs?.length ?? 0
  const weekVoteCount = weekVotes?.length ?? 0
  const weekForCount = weekVotes?.filter(v => v.side === 'blue').length ?? 0
  const weekAgainstCount = weekVoteCount - weekForCount

  // Best early argument by upvotes within first week
  const topEarlyArg = (weekArgs ?? []).sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))[0]
  const topEarlyArgContent = topEarlyArg ? topEarlyArg.content.slice(0, 200) : null

  // ── 6. Vote snapshots (day-by-day breakdown for first 14 days) ────────────
  const { data: allVotes } = await supabase
    .from('votes')
    .select('side, created_at')
    .eq('topic_id', topicId)
    .order('created_at', { ascending: true })

  const snapshotMap = new Map<number, { for_count: number; against_count: number }>()
  const maxDays = Math.min(ageDays + 1, 14)

  for (const v of allVotes ?? []) {
    const voteDate = new Date(v.created_at)
    const dayIdx = Math.floor((voteDate.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    if (dayIdx < 0 || dayIdx >= maxDays) continue
    const existing = snapshotMap.get(dayIdx) ?? { for_count: 0, against_count: 0 }
    if (v.side === 'blue') existing.for_count++
    else existing.against_count++
    snapshotMap.set(dayIdx, existing)
  }

  // Build cumulative snapshots
  let cumulativeFor = 0
  let cumulativeAgainst = 0
  const voteSnapshots: VoteSnapshot[] = []
  for (let d = 0; d < maxDays; d++) {
    const day = snapshotMap.get(d) ?? { for_count: 0, against_count: 0 }
    cumulativeFor += day.for_count
    cumulativeAgainst += day.against_count
    voteSnapshots.push({
      day: d,
      for_count: cumulativeFor,
      against_count: cumulativeAgainst,
      total: cumulativeFor + cumulativeAgainst,
    })
  }

  const response: OriginsResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      description: topic.description,
      category: topic.category,
      scope: topic.scope,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
      created_at: topic.created_at,
      age_days: ageDays,
    },
    founder,
    founding_arguments: foundingArguments,
    pioneer_voters: pioneerVoters,
    first_week_stats: {
      arguments_in_week: weekArgCount,
      votes_in_week: weekVoteCount,
      for_in_week: weekForCount,
      against_in_week: weekAgainstCount,
      top_early_argument: topEarlyArgContent,
    },
    vote_snapshots: voteSnapshots,
    total_pioneers: earlyVotes?.length ?? 0,
  }

  return NextResponse.json(response)
}
