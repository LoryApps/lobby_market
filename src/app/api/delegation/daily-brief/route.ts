import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DelegateVoteEntry } from '@/app/api/delegation/history/route'

export const dynamic = 'force-dynamic'

export interface DailyBriefResponse {
  votes: DelegateVoteEntry[]
  todayTotal: number
  todayAligned: number
  todayMisaligned: number
  todayPending: number
  date: string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Today's window: midnight UTC to now
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayStartISO = todayStart.toISOString()

  // 1. Active delegations
  const { data: delegations } = await supabase
    .from('vote_delegations')
    .select(`
      id,
      delegate_id,
      topic_id,
      category,
      created_at,
      delegate:profiles!vote_delegations_delegate_id_fkey (
        username, display_name, avatar_url, role
      )
    `)
    .eq('delegator_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!delegations || delegations.length === 0) {
    return NextResponse.json({
      votes: [],
      todayTotal: 0,
      todayAligned: 0,
      todayMisaligned: 0,
      todayPending: 0,
      date: todayStartISO,
    } satisfies DailyBriefResponse)
  }

  // 2. Fetch delegate votes cast TODAY within each delegation's scope
  const delegateVotePromises = (delegations as Record<string, unknown>[]).map(async (del) => {
    const delegateProfile = del.delegate as Record<string, unknown> | null
    const delegateId = del.delegate_id as string
    const topicId = del.topic_id as string | null
    const category = del.category as string | null

    let query = supabase
      .from('votes')
      .select(`
        side,
        created_at,
        topic_id,
        topic:topics!votes_topic_id_fkey (
          statement, category, status, blue_pct, total_votes
        )
      `)
      .eq('user_id', delegateId)
      .gte('created_at', todayStartISO)
      .order('created_at', { ascending: false })
      .limit(50)

    if (topicId) {
      query = query.eq('topic_id', topicId)
    }

    const { data: votes } = await query

    return {
      delegation: del,
      delegateId,
      delegateUsername: (delegateProfile?.username as string) ?? '',
      delegateDisplayName: (delegateProfile?.display_name as string | null) ?? null,
      delegateAvatarUrl: (delegateProfile?.avatar_url as string | null) ?? null,
      delegateRole: (delegateProfile?.role as string) ?? 'person',
      scope: (topicId ? 'topic' : category ? 'category' : 'global') as 'global' | 'category' | 'topic',
      category: category ?? null,
      topicId: topicId ?? null,
      votes: (votes ?? []) as Record<string, unknown>[],
    }
  })

  const delegateResults = await Promise.all(delegateVotePromises)

  // 3. Collect all unique topic IDs
  const allTopicIds = new Set<string>()
  for (const result of delegateResults) {
    for (const vote of result.votes) {
      if (result.scope === 'category' && result.category) {
        const topic = vote.topic as Record<string, unknown> | null
        if (topic?.category !== result.category) continue
      }
      allTopicIds.add(vote.topic_id as string)
    }
  }

  // 4. Fetch user's own votes for these topics
  const userVotesMap = new Map<string, { side: string; created_at: string }>()
  if (allTopicIds.size > 0) {
    const { data: userVotes } = await supabase
      .from('votes')
      .select('topic_id, side, created_at')
      .eq('user_id', user.id)
      .in('topic_id', Array.from(allTopicIds))

    for (const uv of (userVotes ?? [])) {
      userVotesMap.set(uv.topic_id, { side: uv.side, created_at: uv.created_at })
    }
  }

  // 5. Assemble entries
  const entries: DelegateVoteEntry[] = []
  const seenKeys = new Set<string>()

  for (const result of delegateResults) {
    for (const vote of result.votes) {
      const topic = vote.topic as Record<string, unknown> | null
      if (!topic) continue

      if (result.scope === 'category' && result.category) {
        if (topic.category !== result.category) continue
      }

      const topicId = vote.topic_id as string
      const key = `${result.delegateId}:${topicId}`
      if (seenKeys.has(key)) continue
      seenKeys.add(key)

      const delegateSide = (vote.side as string) as 'for' | 'against'
      const userVote = userVotesMap.get(topicId) ?? null
      const userSide = userVote ? ((userVote.side as string) as 'for' | 'against') : null
      const isOverride = userSide !== null
      const isAligned = userSide !== null ? userSide === delegateSide : null

      entries.push({
        delegation_id: result.delegation.id as string,
        delegate_id: result.delegateId,
        delegate_username: result.delegateUsername,
        delegate_display_name: result.delegateDisplayName,
        delegate_avatar_url: result.delegateAvatarUrl,
        delegate_role: result.delegateRole,
        scope: result.scope,
        category: result.category,
        topic_id: topicId,
        topic_statement: (topic.statement as string) ?? '',
        topic_category: (topic.category as string | null) ?? null,
        topic_status: (topic.status as string) ?? 'active',
        topic_blue_pct: (topic.blue_pct as number) ?? 50,
        topic_total_votes: (topic.total_votes as number) ?? 0,
        delegate_side: delegateSide,
        delegate_voted_at: vote.created_at as string,
        user_side: userSide,
        user_voted_at: userVote?.created_at ?? null,
        is_override: isOverride,
        is_aligned: isAligned,
      })
    }
  }

  entries.sort((a, b) => new Date(b.delegate_voted_at).getTime() - new Date(a.delegate_voted_at).getTime())

  const todayTotal = entries.length
  const todayAligned = entries.filter(e => e.is_aligned === true).length
  const todayMisaligned = entries.filter(e => e.is_aligned === false).length
  const todayPending = entries.filter(e => !e.is_override).length

  return NextResponse.json({
    votes: entries,
    todayTotal,
    todayAligned,
    todayMisaligned,
    todayPending,
    date: todayStartISO,
  } satisfies DailyBriefResponse)
}
