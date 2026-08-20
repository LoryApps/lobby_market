import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ThesisDetailClient } from './ThesisDetailClient'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

interface Props {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('civic_theses')
    .select('statement, category, status, profiles!civic_theses_user_id_fkey(username, display_name)')
    .eq('id', params.id)
    .maybeSingle()

  if (!data) return { title: 'Civic Thesis · Lobby Market' }

  const author = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
  const authorName = (author as { display_name: string | null; username: string } | null)?.display_name
    || (author as { username: string } | null)?.username
    || 'A civic voice'

  const ogImageUrl = `${BASE_URL}/api/og/thesis/${params.id}`
  const canonicalUrl = `${BASE_URL}/thesis/${params.id}`

  return {
    title: `"${data.statement.slice(0, 60)}${data.statement.length > 60 ? '…' : ''}" · Lobby Market`,
    description: `${authorName}'s civic thesis — ${data.category}. See who agrees and who doesn't on Lobby Market.`,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `Civic Thesis: ${data.statement.slice(0, 80)}`,
      description: `${authorName} stakes a prediction. Do you agree or disagree?`,
      type: 'article',
      siteName: 'Lobby Market',
      url: canonicalUrl,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `Civic thesis by ${authorName}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Civic Thesis: ${data.statement.slice(0, 60)}`,
      description: `${authorName} stakes a civic prediction on Lobby Market.`,
      images: [ogImageUrl],
    },
  }
}

export default async function ThesisDetailPage({ params }: Props) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('civic_theses')
    .select('id, statement, category, status, created_at, agree_count, disagree_count, profiles!civic_theses_user_id_fkey(username, display_name)')
    .eq('id', params.id)
    .maybeSingle()

  if (!data) notFound()

  const authorProfile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
  const authorName = (authorProfile as { display_name: string | null; username: string } | null)?.display_name
    || (authorProfile as { username: string } | null)?.username
    || 'A civic voice'
  const authorUsername = (authorProfile as { username: string } | null)?.username

  const canonicalUrl = `${BASE_URL}/thesis/${params.id}`
  const totalEngagement = ((data as { agree_count?: number }).agree_count ?? 0) + ((data as { disagree_count?: number }).disagree_count ?? 0)

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.statement,
    url: canonicalUrl,
    datePublished: (data as { created_at: string }).created_at,
    author: {
      '@type': 'Person',
      name: authorName,
      ...(authorUsername ? { url: `${BASE_URL}/profile/${authorUsername}` } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: 'Lobby Market',
      url: BASE_URL,
    },
    about: {
      '@type': 'Thing',
      name: (data as { category: string }).category,
    },
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: { '@type': 'ReactAction' },
      userInteractionCount: totalEngagement,
    },
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'status', value: (data as { status: string }).status },
      { '@type': 'PropertyValue', name: 'agreeCount', value: (data as { agree_count?: number }).agree_count ?? 0 },
      { '@type': 'PropertyValue', name: 'disagreeCount', value: (data as { disagree_count?: number }).disagree_count ?? 0 },
    ],
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Lobby Market', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Civic Theses', item: `${BASE_URL}/thesis` },
        { '@type': 'ListItem', position: 3, name: data.statement.slice(0, 80), item: canonicalUrl },
      ],
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ThesisDetailClient id={params.id} />
    </>
  )
}
