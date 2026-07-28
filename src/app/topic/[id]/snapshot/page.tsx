import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SnapshotClient } from './SnapshotClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Debate Snapshot · Lobby Market' }

  const forPct = Math.round((topic.blue_pct ?? 50) * 10) / 10
  const againstPct = (100 - forPct).toFixed(1)
  const stmt = topic.statement ?? ''
  const title = `Snapshot: ${stmt.slice(0, 60)}${stmt.length > 60 ? '…' : ''} · Lobby Market`
  const description =
    `State of the debate — ${forPct}% FOR / ${againstPct}% AGAINST across ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes. ` +
    `Top arguments, live consensus, and shareable summary.`

  const ogImage = `/api/og/topic-snapshot/${params.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: ogImage, width: 1200, height: 630, alt: stmt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default async function TopicSnapshotPage({ params }: Props) {
  const supabase = await createClient()

  const [topicRes, argsRes, sourcesRes, contributorsRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at, updated_at')
      .eq('id', params.id)
      .maybeSingle(),

    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, user_id, profiles:user_id(username)')
      .eq('topic_id', params.id)
      .order('upvotes', { ascending: false })
      .limit(20),

    supabase
      .from('topic_sources')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', params.id),

    supabase
      .from('votes')
      .select('user_id', { count: 'exact', head: true })
      .eq('topic_id', params.id),
  ])

  if (!topicRes.data) notFound()

  const topic = topicRes.data
  const args = argsRes.data ?? []

  const rawTopFor = args.find((a) => a.side === 'blue') ?? null
  const rawTopAgainst = args.find((a) => a.side === 'red') ?? null

  function toArg(raw: typeof rawTopFor) {
    if (!raw) return null
    const profile = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles
    return {
      id: raw.id,
      content: raw.content,
      side: raw.side as 'blue' | 'red',
      upvotes: raw.upvotes ?? 0,
      author_username: (profile as { username?: string } | null)?.username ?? null,
    }
  }


  const forPct = Math.round((topic.blue_pct ?? 50) * 10) / 10

  return (
    <SnapshotClient
      topicId={topic.id}
      statement={topic.statement ?? ''}
      category={topic.category ?? null}
      status={topic.status ?? 'proposed'}
      forPct={forPct}
      totalVotes={topic.total_votes ?? 0}
      topForArg={toArg(rawTopFor)}
      topAgainstArg={toArg(rawTopAgainst)}
      stats={{
        totalArguments: args.length,
        totalSources: sourcesRes.count ?? 0,
        totalContributors: contributorsRes.count ?? 0,
        totalPredictions: 0,
      }}
      createdAt={topic.created_at ?? new Date().toISOString()}
      updatedAt={topic.updated_at ?? topic.created_at ?? new Date().toISOString()}
    />
  )
}
