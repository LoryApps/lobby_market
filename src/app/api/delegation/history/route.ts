import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DelegateVoteEntry {
  delegation_id: string
  delegate_id: string
  delegate_username: string
  delegate_display_name: string | null
  delegate_avatar_url: string | null
  delegate_role: string
  scope: 'global' | 'category' | 'topic'
  category: string | null
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  topic_blue_pct: number
  topic_total_votes: number
  delegate_side: 'for' | 'against'
  delegate_voted_at: string
  user_side: 'for' | 'against' | null
  user_voted_at: string | null
  is_override: boolean
  is_aligned: boolean | null
}

export interface DelegationHistoryResponse {
  votes: DelegateVoteEntry[]
  totalDelegated: number
  totalOverrides: number
  alignmentPct: number | null
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10) || 50)
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

  // 1. Fetch active delegations with delegate profiles
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
      totalDelegated: 0,
      totalOverrides: 0,
      alignmentPct: null,
    } satisfies DelegationHistoryResponse)
  }

  // 2. For each delegation, fetch recent votes the delegate cast within that scope
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
      .gte('created_at', (del.created_at as string))
      .order('created_at', { ascending: false })
      .limit(50)

    // Apply scope filter
    if (topicId) {
      query = query.eq('topic_id', topicId)
    } else if (category) {
      // Filter by category via the joined topic
      // We filter client-side after fetch since Supabase doesn't support
      // filtering on joined column in this query shape easily
    }
    // Global: no additional filter — all topics qualify

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

  // 3. Collect all unique topic IDs to fetch user's own votes in one query
  const allTopicIds = new Set<string>()
  for (const result of delegateResults) {
    for (const vote of result.votes) {
      // Apply category filter if applicable
      if (result.scope === 'category' && result.category) {
        const topic = vote.topic as Record<string, unknown> | null
        if (topic?.category !== result.category) continue
      }
      allTopicIds.add(vote.topic_id as string)
    }
  }

  // 4. Fetch user's own votes for all relevant topics
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

  // 5. Assemble the history entries
  const entries: DelegateVoteEntry[] = []
  const seenKeys = new Set<string>() // de-dup: one entry per (topic_id × delegate_id)

  for (const result of delegateResults) {
    for (const vote of result.votes) {
      const topic = vote.topic as Record<string, unknown> | null
      if (!topic) continue

      // Apply category scope filter
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

  // Sort by delegate vote time descending
  entries.sort((a, b) => new Date(b.delegate_voted_at).getTime() - new Date(a.delegate_voted_at).getTime())

  const paginated = entries.slice(offset, offset + limit)
  const totalDelegated = entries.length
  const totalOverrides = entries.filter(e => e.is_override).length
  const alignedEntries = entries.filter(e => e.is_aligned !== null)
  const alignmentPct =
    alignedEntries.length > 0
      ? Math.round((alignedEntries.filter(e => e.is_aligned).length / alignedEntries.length) * 100)
      : null

  return NextResponse.json({
    votes: paginated,
    totalDelegated,
    totalOverrides,
    alignmentPct,
  } satisfies DelegationHistoryResponse)
}
