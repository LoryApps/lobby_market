import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawSnapshotClient } from './SnapshotClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, blue_pct, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Snapshot · Lobby Market' }

  const forPct = Math.round((law.blue_pct ?? 0) * 10) / 10
  const stmt = law.statement ?? ''
  const estDate = law.established_at
    ? new Date(law.established_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null
  const title = `Snapshot: ${stmt.slice(0, 60)}${stmt.length > 60 ? '…' : ''} · Lobby Market`
  const description =
    `Established law — ${forPct}% consensus across ${(law.total_votes ?? 0).toLocaleString()} votes` +
    (estDate ? ` · Passed ${estDate}` : '') +
    `. Top arguments, contributors, and shareable summary.`

  const ogImage = `/api/og/law/${params.id}`

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

export default async function LawSnapshotPage({ params }: Props) {
  const supabase = await createClient()

  const [lawRes, amendmentsRes] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, full_statement, category, blue_pct, total_votes, established_at, is_active, topic_id, body_markdown')
      .eq('id', params.id)
      .maybeSingle(),

    supabase
      .from('law_amendments')
      .select('id', { count: 'exact', head: true })
      .eq('law_id', params.id),
  ])

  if (!lawRes.data) notFound()
  const law = lawRes.data

  // Fetch top arguments and contributor count from the source topic
  let topForArg: { id: string; content: string; upvotes: number; author_username: string | null } | null = null
  let topAgainstArg: { id: string; content: string; upvotes: number; author_username: string | null } | null = null
  let totalArguments = 0
  let totalContributors = 0

  if (law.topic_id) {
    const [argsRes, contribRes] = await Promise.all([
      supabase
        .from('topic_arguments')
        .select('id, content, side, upvotes, user_id, profiles:user_id(username)')
        .eq('topic_id', law.topic_id)
        .order('upvotes', { ascending: false })
        .limit(20),

      supabase
        .from('votes')
        .select('user_id', { count: 'exact', head: true })
        .eq('topic_id', law.topic_id),
    ])

    const args = argsRes.data ?? []
    totalArguments = args.length
    totalContributors = contribRes.count ?? 0

    function toArg(raw: typeof args[0] | undefined) {
      if (!raw) return null
      const profile = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles
      return {
        id: raw.id,
        content: raw.content,
        upvotes: raw.upvotes ?? 0,
        author_username: (profile as { username?: string } | null)?.username ?? null,
      }
    }

    topForArg = toArg(args.find((a) => a.side === 'blue'))
    topAgainstArg = toArg(args.find((a) => a.side === 'red'))
  }

  const forPct = Math.round((law.blue_pct ?? 0) * 10) / 10

  return (
    <LawSnapshotClient
      lawId={law.id}
      statement={law.statement ?? ''}
      fullStatement={law.full_statement ?? law.statement ?? ''}
      category={law.category ?? null}
      forPct={forPct}
      totalVotes={law.total_votes ?? 0}
      establishedAt={law.established_at ?? new Date().toISOString()}
      isActive={law.is_active ?? true}
      topicId={law.topic_id ?? null}
      totalArguments={totalArguments}
      totalAmendments={amendmentsRes.count ?? 0}
      totalContributors={totalContributors}
      topForArg={topForArg}
      topAgainstArg={topAgainstArg}
    />
  )
}
