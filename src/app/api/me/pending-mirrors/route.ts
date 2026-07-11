import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface PendingMirrorTopic {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
  delegateUsername: string
  delegateDisplayName: string | null
  delegateAvatarUrl: string | null
  delegateSide: 'blue' | 'red'
  delegationScope: 'topic' | 'category' | 'global'
}

export interface PendingMirrorsResponse {
  topics: PendingMirrorTopic[]
  total: number
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Fetch all active delegations for this user
  const { data: delegations } = await supabase
    .from('vote_delegations')
    .select('delegate_id, topic_id, category')
    .eq('delegator_id', user.id)
    .is('revoked_at', null)

  if (!delegations || delegations.length === 0) {
    return NextResponse.json<PendingMirrorsResponse>({ topics: [], total: 0 })
  }

  // 2. Get distinct delegate IDs
  const delegateIds = Array.from(new Set(delegations.map((d) => d.delegate_id)))

  // 3. Fetch delegate profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', delegateIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  // 4. Fetch recent delegate votes on active/voting topics the user hasn't voted on
  // Get delegate votes on active topics
  const { data: delegateVotes } = await supabase
    .from('votes')
    .select(`
      user_id,
      topic_id,
      side,
      topics!inner (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .in('user_id', delegateIds)
    .in('topics.status', ['active', 'voting'])
    .order('created_at', { ascending: false })
    .limit(100)

  if (!delegateVotes || delegateVotes.length === 0) {
    return NextResponse.json<PendingMirrorsResponse>({ topics: [], total: 0 })
  }

  // 5. Get the user's own votes to exclude already-voted topics
  const topicIds = Array.from(new Set(delegateVotes.map((v) => v.topic_id)))
  const { data: myVotes } = await supabase
    .from('votes')
    .select('topic_id')
    .eq('user_id', user.id)
    .in('topic_id', topicIds)

  const myVotedTopicIds = new Set((myVotes ?? []).map((v) => v.topic_id))

  // 6. Filter to topics not yet voted by the user, keeping highest-specificity delegation
  const seenTopics = new Set<string>()
  const results: PendingMirrorTopic[] = []

  for (const vote of delegateVotes) {
    const topic = vote.topics as {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    }

    if (!topic || myVotedTopicIds.has(vote.topic_id)) continue
    if (seenTopics.has(vote.topic_id)) continue

    // Find the most specific delegation scope for this delegate+topic
    const topicDelegation = delegations.find(
      (d) => d.delegate_id === vote.user_id && d.topic_id === vote.topic_id
    )
    const categoryDelegation = delegations.find(
      (d) => d.delegate_id === vote.user_id && d.category === topic.category && !d.topic_id
    )
    const globalDelegation = delegations.find(
      (d) => d.delegate_id === vote.user_id && !d.topic_id && !d.category
    )

    const delegation = topicDelegation ?? categoryDelegation ?? globalDelegation
    if (!delegation) continue

    const scope: 'topic' | 'category' | 'global' = topicDelegation
      ? 'topic'
      : categoryDelegation
      ? 'category'
      : 'global'

    const profile = profileMap.get(vote.user_id)
    if (!profile) continue

    seenTopics.add(vote.topic_id)
    results.push({
      topicId: vote.topic_id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      bluePct: topic.blue_pct,
      totalVotes: topic.total_votes,
      delegateUsername: profile.username,
      delegateDisplayName: profile.display_name,
      delegateAvatarUrl: profile.avatar_url,
      delegateSide: vote.side as 'blue' | 'red',
      delegationScope: scope,
    })

    if (results.length >= 10) break
  }

  return NextResponse.json<PendingMirrorsResponse>({ topics: results, total: results.length })
}
