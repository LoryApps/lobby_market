import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResolutionClient } from './ResolutionClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Market Resolution · Lobby Exchange' }

  const stmt = topic.statement ?? ''
  const shortStmt = stmt.length > 55 ? stmt.slice(0, 55) + '…' : stmt
  const isResolved = topic.status === 'law' || topic.status === 'failed'
  const outcome = topic.status === 'law' ? 'PASSED' : topic.status === 'failed' ? 'FAILED' : 'PENDING'

  const title = `Resolution: ${shortStmt} · Lobby Exchange`
  const description = isResolved
    ? `This market ${outcome.toLowerCase()}. See final consensus, crowd accuracy, top forecasters, and the full resolution story.`
    : `Track the live consensus for this unresolved market — ${Math.round(topic.blue_pct ?? 50)}¢ current probability — and prepare for resolution.`

  return {
    title,
    description,
    robots: { index: isResolved },
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

export default async function ResolutionPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <ResolutionClient id={params.id} />
}
