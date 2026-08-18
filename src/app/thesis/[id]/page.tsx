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
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!data) notFound()

  return <ThesisDetailClient id={params.id} />
}
