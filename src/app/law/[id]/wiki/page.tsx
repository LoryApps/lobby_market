import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawWikiClient } from './LawWikiClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, total_votes, established_at, wiki_content')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Wiki · Lobby Market' }

  const stmt = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Wiki: ${short} · Lobby Market`

  const hasContent = (law.wiki_content ?? '').trim().length > 0
  const estYear = law.established_at ? new Date(law.established_at).getFullYear() : null

  const description = hasContent
    ? `${(law.wiki_content ?? '').slice(0, 200).trim()}…`
    : `Community wiki for "${stmt}" — an established law${estYear ? ` passed in ${estYear}` : ''}` +
      (law.total_votes ? ` with ${law.total_votes.toLocaleString()} votes.` : '.') +
      ' Contribute context, history, and impact analysis.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      publishedTime: law.established_at,
      images: [
        {
          url: `/api/og/law/${params.id}`,
          width: 1200,
          height: 630,
          alt: stmt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/law/${params.id}`],
    },
    alternates: {
      canonical: `https://lobby.market/law/${params.id}/wiki`,
    },
  }
}

export default async function LawWikiPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return <LawWikiClient lawId={params.id} />
}
