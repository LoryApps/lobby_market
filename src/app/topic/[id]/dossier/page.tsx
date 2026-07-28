import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DossierClient } from './DossierClient'

export const dynamic = 'force-dynamic'

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

  if (!topic) return { title: 'Civic Dossier · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Dossier: ${stmt.slice(0, 60)}${stmt.length > 60 ? '…' : ''} · Lobby Market`
  const description =
    `Civic intelligence dossier — complete record for: ${stmt.slice(0, 80)}. ` +
    `${forPct}% FOR · ${(topic.total_votes ?? 0).toLocaleString()} votes cast.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/topic/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: { index: false },
  }
}

interface RawArg {
  id: string
  content: string
  side: string
  upvotes: number
  created_at: string
}

export default async function DossierPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topic, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope, description, created_at, updated_at')
    .eq('id', params.id)
    .maybeSingle()

  if (error || !topic) notFound()

  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, created_at')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .limit(20)

  const args: RawArg[] = argsRaw ?? []
  const forArgs = args.filter((a) => a.side === 'blue').slice(0, 3)
  const againstArgs = args.filter((a) => a.side === 'red').slice(0, 3)

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: recentArgs } = await supabase
    .from('topic_arguments')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', params.id)
    .gte('created_at', sevenDaysAgo)

  return (
    <DossierClient
      topicId={params.id}
      statement={topic.statement ?? ''}
      category={topic.category ?? null}
      status={topic.status ?? 'proposed'}
      bluePct={topic.blue_pct ?? 50}
      totalVotes={topic.total_votes ?? 0}
      scope={topic.scope ?? null}
      description={topic.description ?? null}
      createdAt={topic.created_at ?? null}
      updatedAt={topic.updated_at ?? null}
      forArgs={forArgs.map((a) => ({
        id: a.id,
        content: a.content,
        upvotes: a.upvotes,
        createdAt: a.created_at,
      }))}
      againstArgs={againstArgs.map((a) => ({
        id: a.id,
        content: a.content,
        upvotes: a.upvotes,
        createdAt: a.created_at,
      }))}
      totalArgs={args.length}
      recentArgs={recentArgs ?? 0}
    />
  )
}
