import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { LawSynthesisClient } from './LawSynthesisClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Synthesis · Lobby Market' }

  const stmt = law.statement
  const title = `Synthesis: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description = `AI-identified common ground, core tensions, and a nuanced synthesis of the debate that established this law.`

  return {
    title,
    description,
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

export default async function LawSynthesisPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, topic_id, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <LawSynthesisClient
        lawId={law.id}
        topicId={law.topic_id}
        statement={law.statement}
        category={law.category ?? null}
        bluePct={law.blue_pct ?? 50}
        totalVotes={law.total_votes ?? 0}
        establishedAt={law.established_at}
      />
      <BottomNav />
    </div>
  )
}
