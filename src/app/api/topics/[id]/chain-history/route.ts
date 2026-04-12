import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Topic, ChainNode } from '@/lib/supabase/types'

const MAX_CHAIN_WALK = 16 // hard safety cap on loops

function toNode(topic: Topic, isCurrent: boolean, winningPath: boolean): ChainNode {
  return {
    id: topic.id,
    statement: topic.statement,
    connector: topic.connector,
    chain_depth: topic.chain_depth,
    status: topic.status,
    blue_pct: topic.blue_pct,
    total_votes: topic.total_votes,
    parent_id: topic.parent_id,
    is_current: isCurrent,
    winning_path: winningPath,
  }
}

// GET /api/topics/[id]/chain-history
// Walk parent_id links upwards to the root, and follow winning child topics
// downwards to the terminal leaf. Also surface losing continuation siblings.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: current, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !current) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Walk upwards: current -> parent -> parent -> root
  const ancestors: Topic[] = []
  let cursor = current as Topic
  let steps = 0
  while (cursor.parent_id && steps < MAX_CHAIN_WALK) {
    const { data: parent } = await supabase
      .from('topics')
      .select('*')
      .eq('id', cursor.parent_id)
      .single()
    if (!parent) break
    ancestors.unshift(parent as Topic)
    cursor = parent as Topic
    steps += 1
  }

  // Walk downwards: current -> winning child -> winning child -> leaf
  // "Winning child" = any child topic where this topic is the parent_id.
  // If there are multiple children (shouldn't happen post-chain-vote but be
  // defensive), pick the one with the highest total_votes.
  const descendants: Topic[] = []
  let down: Topic = current as Topic
  let downSteps = 0
  while (downSteps < MAX_CHAIN_WALK) {
    const { data: children } = await supabase
      .from('topics')
      .select('*')
      .eq('parent_id', down.id)
      .order('total_votes', { ascending: false })
      .limit(1)

    if (!children || children.length === 0) break
    const next = children[0] as Topic
    descendants.push(next)
    down = next
    downSteps += 1
  }

  // Build the winning-path list in root -> leaf order
  const chainTopics: Topic[] = [...ancestors, current as Topic, ...descendants]

  const nodes: ChainNode[] = chainTopics.map((t) =>
    toNode(t, t.id === current.id, true)
  )

  // Losing alternatives: continuations submitted against the current topic
  // that were NOT selected as the winner. Only include once the winner has
  // been resolved (i.e. the topic has any descendant or a law_status).
  const alternatives: ChainNode[] = []
  if (descendants.length > 0) {
    const { data: losers } = await supabase
      .from('continuations')
      .select('id, text, connector, status, boost_count')
      .eq('topic_id', current.id)
      .neq('status', 'winner')
      .in('status', ['finalist', 'rejected'])
      .order('boost_count', { ascending: false })
      .limit(6)

    for (const loser of losers ?? []) {
      alternatives.push({
        id: loser.id,
        statement: loser.text,
        connector: loser.connector,
        chain_depth: current.chain_depth + 1,
        status: 'failed',
        blue_pct: 0,
        total_votes: 0,
        parent_id: current.id,
        is_current: false,
        winning_path: false,
      })
    }
  }

  return NextResponse.json({ nodes, alternatives })
}
