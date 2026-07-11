import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface DelegateVoteResponse {
  delegateUsername: string
  delegateDisplayName: string | null
  delegateAvatarUrl: string | null
  delegateSide: 'blue' | 'red' | null
  delegationScope: 'topic' | 'category' | 'global'
  delegateId: string
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const topicId = params.id

  // Fetch the topic's category so we can match category-scoped delegations
  const { data: topic } = await supabase
    .from('topics')
    .select('category')
    .eq('id', topicId)
    .single()

  const category = topic?.category ?? null

  // Find the most specific active delegation (topic > category > global)
  const { data: delegations } = await supabase
    .from('vote_delegations')
    .select('id, delegate_id, topic_id, category')
    .eq('delegator_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (!delegations || delegations.length === 0) {
    return NextResponse.json({ delegation: null })
  }

  // Pick the most specific delegation
  let best: { id: string; delegate_id: string; topic_id: string | null; category: string | null } | null = null
  let scope: 'topic' | 'category' | 'global' = 'global'

  for (const d of delegations) {
    if (d.topic_id === topicId) {
      best = d
      scope = 'topic'
      break
    }
  }
  if (!best && category) {
    for (const d of delegations) {
      if (d.category === category && d.topic_id === null) {
        best = d
        scope = 'category'
        break
      }
    }
  }
  if (!best) {
    for (const d of delegations) {
      if (d.topic_id === null && d.category === null) {
        best = d
        scope = 'global'
        break
      }
    }
  }

  if (!best) {
    return NextResponse.json({ delegation: null })
  }

  // Fetch the delegate's profile
  const { data: delegate } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', best.delegate_id)
    .single()

  if (!delegate) {
    return NextResponse.json({ delegation: null })
  }

  // Look up the delegate's vote on this topic
  const { data: delegateVote } = await supabase
    .from('votes')
    .select('side')
    .eq('user_id', best.delegate_id)
    .eq('topic_id', topicId)
    .maybeSingle()

  const result: DelegateVoteResponse = {
    delegateUsername: delegate.username,
    delegateDisplayName: delegate.display_name,
    delegateAvatarUrl: delegate.avatar_url,
    delegateSide: (delegateVote?.side as 'blue' | 'red' | null) ?? null,
    delegationScope: scope,
    delegateId: best.delegate_id,
  }

  return NextResponse.json({ delegation: result })
}
