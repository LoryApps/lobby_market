import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { LawPrimerClient } from './LawPrimerClient'

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

  if (!law) return { title: 'Law Primer · Lobby Market' }

  const stmt: string = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const forPct = Math.round(law.blue_pct ?? 50)
  const title = `Primer: ${short} · Lobby Market`
  const description =
    `New to this law? Get a plain-language breakdown — what it means, why it passed, ` +
    `and the strongest arguments on each side. Established with ${forPct}% FOR ` +
    `across ${(law.total_votes ?? 0).toLocaleString()} votes.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      publishedTime: law.established_at,
      images: [{ url: `/api/og/law/${params.id}`, width: 1200, height: 630, alt: stmt }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/law/${params.id}`],
    },
    alternates: { canonical: `https://lobby.market/law/${params.id}/primer` },
  }
}

export default async function LawPrimerPage({ params }: Props) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, full_statement, body_markdown, category, established_at, blue_pct, total_votes, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) notFound()

  let topForArg: { id: string; content: string; upvotes: number } | null = null
  let topAgainstArg: { id: string; content: string; upvotes: number } | null = null
  let sources: Array<{ id: string; url: string; title: string; description: string | null; domain: string | null }> = []
  let originalTopic: { id: string; statement: string; status: string } | null = null

  if (law.topic_id) {
    const [forRes, againstRes, sourcesRes, topicRes] = await Promise.all([
      supabase
        .from('topic_arguments')
        .select('id, content, upvotes')
        .eq('topic_id', law.topic_id)
        .eq('side', 'blue')
        .order('upvotes', { ascending: false })
        .limit(1),
      supabase
        .from('topic_arguments')
        .select('id, content, upvotes')
        .eq('topic_id', law.topic_id)
        .eq('side', 'red')
        .order('upvotes', { ascending: false })
        .limit(1),
      supabase
        .from('topic_sources')
        .select('id, url, title, description, domain')
        .eq('topic_id', law.topic_id)
        .order('display_order', { ascending: true })
        .limit(4),
      supabase
        .from('topics')
        .select('id, statement, status')
        .eq('id', law.topic_id)
        .maybeSingle(),
    ])

    topForArg = (forRes.data ?? [])[0] ?? null
    topAgainstArg = (againstRes.data ?? [])[0] ?? null
    sources = sourcesRes.data ?? []
    originalTopic = topicRes.data ?? null
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14">
        <div className="flex items-center gap-3 mb-8">
          <Link
            href={`/law/${params.id}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to law"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-gold" aria-hidden />
              <span className="text-xs font-mono text-gold uppercase tracking-wider font-semibold">
                Law Primer
              </span>
            </div>
            <p className="text-[10px] font-mono text-surface-600 mt-0.5">
              Plain-language guide to this established law
            </p>
          </div>
        </div>

        <LawPrimerClient
          lawId={params.id}
          statement={law.statement}
          fullStatement={law.full_statement ?? null}
          bodyMarkdown={law.body_markdown ?? null}
          category={law.category ?? null}
          establishedAt={law.established_at}
          bluePct={law.blue_pct ?? 50}
          totalVotes={law.total_votes ?? 0}
          topForArg={topForArg}
          topAgainstArg={topAgainstArg}
          sources={sources}
          originalTopic={originalTopic}
        />
      </main>
      <BottomNav />
    </div>
  )
}
