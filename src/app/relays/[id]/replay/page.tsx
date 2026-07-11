import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RelayReplayClient } from './RelayReplayClient'
import type { RelayLeg } from '@/app/api/relays/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: relay } = await supabase
    .from('civic_relays')
    .select('id, side, max_legs, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!relay) return { title: 'Relay Replay · Lobby Market' }

  let statement = 'Civic Relay'
  if (relay.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('statement')
      .eq('id', relay.topic_id)
      .maybeSingle()
    if (topic) statement = topic.statement
  }

  const side = relay.side === 'for' ? 'FOR' : 'AGAINST'
  const title = `Replay — ${side}: ${statement.slice(0, 55)}${statement.length > 55 ? '…' : ''} · Lobby Market`
  const description = `Watch this ${relay.max_legs}-leg ${side} relay chain unfold argument by argument — relive how the community built a collective case for "${statement.slice(0, 80)}".`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function RelayReplayPage({ params }: Props) {
  const supabase = await createClient()

  const { data: relay } = await supabase
    .from('civic_relays')
    .select('id, side, status, max_legs, topic_id, vote_compelling, vote_not_compelling, created_at, completed_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!relay) notFound()

  let topicStatement: string | null = null
  let topicCategory: string | null = null
  if (relay.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('statement, category')
      .eq('id', relay.topic_id)
      .maybeSingle()
    if (topic) {
      topicStatement = topic.statement
      topicCategory = topic.category
    }
  }

  // Fetch legs with author profiles
  const { data: legsRaw } = await supabase
    .from('relay_legs')
    .select('*, profiles:author_id(id, username, display_name, avatar_url, role)')
    .eq('relay_id', params.id)
    .order('leg_number', { ascending: true })

  // Fetch upvote counts per leg
  const legIds = (legsRaw ?? []).map((l) => l.id)
  const upvoteMap: Record<string, number> = {}
  if (legIds.length > 0) {
    const { data: upvoteCounts } = await supabase
      .from('relay_leg_upvotes')
      .select('leg_id')
      .in('leg_id', legIds)
    for (const row of upvoteCounts ?? []) {
      upvoteMap[row.leg_id] = (upvoteMap[row.leg_id] ?? 0) + 1
    }
  }

  const legs: RelayLeg[] = (legsRaw ?? []).map((leg) => ({
    id: leg.id,
    relay_id: leg.relay_id,
    author_id: leg.author_id,
    leg_number: leg.leg_number,
    content: leg.content,
    created_at: leg.created_at,
    upvote_count: upvoteMap[leg.id] ?? 0,
    user_upvoted: false,
    author: (leg as { profiles?: RelayLeg['author'] }).profiles ?? null,
  }))

  return (
    <RelayReplayClient
      relayId={relay.id}
      side={relay.side as 'for' | 'against'}
      status={relay.status as 'open' | 'in_progress' | 'complete' | 'voted'}
      maxLegs={relay.max_legs}
      voteCompelling={relay.vote_compelling ?? 0}
      voteNotCompelling={relay.vote_not_compelling ?? 0}
      relayCreatedAt={relay.created_at}
      relayCompletedAt={relay.completed_at ?? null}
      topicId={relay.topic_id ?? null}
      topicStatement={topicStatement}
      topicCategory={topicCategory}
      legs={legs}
    />
  )
}
