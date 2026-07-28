import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawDossierClient } from './DossierClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, total_votes, established_at, is_active')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Dossier · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const title = `Dossier: ${stmt.slice(0, 60)}${stmt.length > 60 ? '…' : ''} · Lobby Market`
  const description =
    `Official intelligence dossier for established law: ${stmt.slice(0, 100)}. ` +
    `${(law.total_votes ?? 0).toLocaleString()} votes · ${law.is_active ? 'Active' : 'Inactive'} · Est. ${
      law.established_at
        ? new Date(law.established_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : 'unknown'
    }.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/law/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: { index: false },
  }
}

export default async function LawDossierPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law, error } = await supabase
    .from('laws')
    .select(
      'id, statement, category, body_markdown, is_active, established_at, topic_id, blue_pct, total_votes',
    )
    .eq('id', params.id)
    .maybeSingle()

  if (error || !law) notFound()

  // Source topic
  let topicStatement: string | null = null
  if (law.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('statement')
      .eq('id', law.topic_id)
      .maybeSingle()
    topicStatement = topic?.statement ?? null
  }

  // Amendment stats
  const { count: totalAmendments } = await supabase
    .from('law_amendments')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', params.id)

  const { count: ratifiedAmendments } = await supabase
    .from('law_amendments')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', params.id)
    .eq('status', 'ratified')

  // Revision count
  const { count: revisionCount } = await supabase
    .from('law_revisions')
    .select('id', { count: 'exact', head: true })
    .eq('law_id', params.id)

  // Review stats
  const { data: reviewStats } = await supabase
    .from('law_reviews')
    .select('stars')
    .eq('law_id', params.id)

  const reviewCount = reviewStats?.length ?? 0
  const avgStars =
    reviewCount > 0
      ? reviewStats!.reduce((sum, r) => sum + (r.stars ?? 0), 0) / reviewCount
      : null

  // Related laws
  const { count: outgoing } = await supabase
    .from('law_links')
    .select('id', { count: 'exact', head: true })
    .eq('source_law_id', params.id)

  const { count: incoming } = await supabase
    .from('law_links')
    .select('id', { count: 'exact', head: true })
    .eq('target_law_id', params.id)

  const relatedLawCount = (outgoing ?? 0) + (incoming ?? 0)

  return (
    <LawDossierClient
      lawId={law.id}
      statement={law.statement ?? ''}
      category={law.category ?? null}
      isActive={law.is_active ?? true}
      establishedAt={law.established_at ?? null}
      topicId={law.topic_id ?? null}
      topicStatement={topicStatement}
      bluePct={law.blue_pct ?? null}
      totalVotes={law.total_votes ?? null}
      bodyExcerpt={law.body_markdown ?? null}
      amendmentCount={totalAmendments ?? 0}
      revisionCount={revisionCount ?? 0}
      reviewCount={reviewCount}
      avgStars={avgStars}
      ratifiedAmendments={ratifiedAmendments ?? 0}
      relatedLawCount={relatedLawCount}
    />
  )
}
