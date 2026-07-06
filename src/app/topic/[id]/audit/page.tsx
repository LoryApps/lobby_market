import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AuditClient } from './AuditClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Integrity Audit · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const title = `Audit: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description =
    `Debate integrity audit for this topic — voter account age distribution, ` +
    `role breakdown, daily vote patterns, argument citation rate, and automated ` +
    `integrity flags. ${(topic.total_votes ?? 0).toLocaleString()} votes cast.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: 'Lobby Market' },
    twitter: { card: 'summary', title, description },
    robots: { index: false },
  }
}

export default async function AuditPage({ params }: Props) {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) notFound()

  return <AuditClient topicId={params.id} />
}
