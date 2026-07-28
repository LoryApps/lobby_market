import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PrimerClient } from './PrimerClient'
import type { Topic } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Topic Primer · Lobby Market' }

  const stmt = topic.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Primer: ${short} · Lobby Market`
  const description = `New to this debate? Get a plain-language explainer — what it means, why it matters, and the strongest case on each side. ${(topic.total_votes ?? 0).toLocaleString()} votes cast.`

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
      images: [`/api/og/topic/${params.id}`],
    },
  }
}

export default async function TopicPrimerPage({ params }: Props) {
  const supabase = await createClient()

  const { data: topicRaw } = await supabase
    .from('topics')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!topicRaw) notFound()
  const topic = topicRaw as Topic

  // Top FOR argument
  const { data: forArgs } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes')
    .eq('topic_id', params.id)
    .eq('side', 'blue')
    .order('upvotes', { ascending: false })
    .limit(1)

  // Top AGAINST argument
  const { data: againstArgs } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes')
    .eq('topic_id', params.id)
    .eq('side', 'red')
    .order('upvotes', { ascending: false })
    .limit(1)

  // Pinned sources
  const { data: sources } = await supabase
    .from('topic_sources')
    .select('id, url, title, description, domain')
    .eq('topic_id', params.id)
    .order('display_order', { ascending: true })
    .limit(3)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14">
        {/* Back navigation */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href={`/topic/${params.id}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-for-400" aria-hidden />
              <span className="text-xs font-mono text-for-400 uppercase tracking-wider font-semibold">
                Topic Primer
              </span>
            </div>
            <p className="text-[10px] font-mono text-surface-600 mt-0.5">
              Plain-language guide for first-time voters
            </p>
          </div>
        </div>

        <PrimerClient
          topicId={params.id}
          statement={topic.statement}
          description={topic.description ?? null}
          category={topic.category ?? null}
          scope={topic.scope ?? 'Global'}
          status={topic.status}
          bluePct={topic.blue_pct ?? 50}
          totalVotes={topic.total_votes ?? 0}
          createdAt={topic.created_at}
          topForArg={(forArgs ?? [])[0] ?? null}
          topAgainstArg={(againstArgs ?? [])[0] ?? null}
          sources={(sources ?? []).map((s) => ({
            id: s.id,
            url: s.url,
            title: s.title,
            description: s.description ?? null,
            domain: s.domain ?? null,
          }))}
        />
      </main>
      <BottomNav />
    </div>
  )
}
