import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawPage } from '@/components/law/LawPage'
import type {
  Law,
  LawLink,
  LawReopenRequest,
  LawRevision,
  Profile,
  Topic,
} from '@/lib/supabase/types'

interface LawDetailPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: LawDetailPageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, total_votes, established_at')
    .eq('id', params.id)
    .single()

  if (!law) {
    return { title: 'Law · Lobby Market' }
  }

  const votes = law.total_votes ? `${law.total_votes.toLocaleString()} votes` : null
  const description = [
    'Established Consensus Law',
    votes,
    law.category ?? null,
  ]
    .filter(Boolean)
    .join(' · ')

  const title = `${law.statement} · Lobby Market`
  const ogImageUrl = `/api/og/law/${params.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      publishedTime: law.established_at,
      tags: law.category ? [law.category] : undefined,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: law.statement,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

export default async function LawDetailPage({ params }: LawDetailPageProps) {
  const supabase = await createClient()

  // 1. Fetch the law
  const { data: law, error } = await supabase
    .from('laws')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !law) {
    notFound()
  }

  const typedLaw = law as Law

  // 2. Fetch source topic
  const { data: topic } = await supabase
    .from('topics')
    .select('*')
    .eq('id', typedLaw.topic_id)
    .single()

  const typedTopic = (topic as Topic) ?? null

  // 3. Fetch author profile (from the source topic)
  let author: Profile | null = null
  if (typedTopic) {
    const { data: authorData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', typedTopic.author_id)
      .single()
    author = (authorData as Profile) ?? null
  }

  // 4. Fetch outgoing links (source = this law)
  const { data: outgoingLinkRows } = await supabase
    .from('law_links')
    .select('*')
    .eq('source_law_id', typedLaw.id)

  const outgoingTargetIds =
    (outgoingLinkRows as LawLink[] | null)?.map((l) => l.target_law_id) ?? []

  const { data: outgoingLaws } = outgoingTargetIds.length
    ? await supabase.from('laws').select('*').in('id', outgoingTargetIds)
    : { data: [] as Law[] }

  // 5. Fetch incoming links (target = this law)
  const { data: incomingLinkRows } = await supabase
    .from('law_links')
    .select('*')
    .eq('target_law_id', typedLaw.id)

  const incomingSourceIds =
    (incomingLinkRows as LawLink[] | null)?.map((l) => l.source_law_id) ?? []

  const { data: incomingLaws } = incomingSourceIds.length
    ? await supabase.from('laws').select('*').in('id', incomingSourceIds)
    : { data: [] as Law[] }

  // 6. Fetch related laws (same category, excluding this one and already-linked ones)
  const excludeIds = new Set<string>([
    typedLaw.id,
    ...outgoingTargetIds,
    ...incomingSourceIds,
  ])

  let relatedLaws: Law[] = []
  if (typedLaw.category) {
    const { data: relatedData } = await supabase
      .from('laws')
      .select('*')
      .eq('category', typedLaw.category)
      .order('established_at', { ascending: false })
      .limit(10)
    relatedLaws = ((relatedData as Law[] | null) ?? []).filter(
      (l) => !excludeIds.has(l.id)
    )
  }

  // 7. Fetch revisions
  const { data: revisionRows } = await supabase
    .from('law_revisions')
    .select('*')
    .eq('law_id', typedLaw.id)
    .order('revision_num', { ascending: false })

  const revisions = (revisionRows as LawRevision[] | null) ?? []

  // 8. Fetch pending reopen request
  const { data: reopenRow } = await supabase
    .from('law_reopen_requests')
    .select('*')
    .eq('law_id', typedLaw.id)
    .eq('status', 'pending')
    .maybeSingle()

  const reopenRequest = (reopenRow as LawReopenRequest | null) ?? null

  // 9. Count total original voters for this law's topic
  const { count: totalOriginalVoters } = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', typedLaw.topic_id)

  return (
    <LawPage
      law={typedLaw}
      topic={typedTopic}
      author={author}
      revisions={revisions}
      outgoingLinks={(outgoingLaws as Law[] | null) ?? []}
      incomingLinks={(incomingLaws as Law[] | null) ?? []}
      relatedLaws={relatedLaws.slice(0, 8)}
      reopenRequest={reopenRequest}
      totalOriginalVoters={totalOriginalVoters ?? 0}
    />
  )
}
