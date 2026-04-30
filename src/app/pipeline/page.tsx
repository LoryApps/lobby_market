import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, GitBranch } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PipelineClient } from './PipelineClient'
import type { PipelineTopic } from './PipelineClient'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Legislation Pipeline · Lobby Market',
  description:
    'Track every civic topic through the democratic pipeline — from community proposals to established law. See what\'s pending, actively debated, in final vote, or already law.',
  openGraph: {
    title: 'Legislation Pipeline · Lobby Market',
    description:
      'A Kanban view of the full civic process: proposed topics, active debates, voting periods, and established laws.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Legislation Pipeline · Lobby Market',
    description: 'Watch democracy in motion — every topic at every stage of the civic process.',
  },
}

export default async function PipelinePage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('topics')
    .select(
      'id, statement, category, status, scope, blue_pct, total_votes, support_count, activation_threshold, voting_ends_at, feed_score, created_at'
    )
    .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
    .order('feed_score', { ascending: false })
    .limit(200)

  const topics = (data ?? []) as PipelineTopic[]

  const counts: Record<string, number> = {}
  for (const t of topics) {
    counts[t.status] = (counts[t.status] ?? 0) + 1
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-screen-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to feed
          </Link>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                <GitBranch className="h-5 w-5 text-for-400" aria-hidden />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Legislation Pipeline
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  {topics.length.toLocaleString()} topics · live democratic process view
                </p>
              </div>
            </div>

            {/* Quick nav */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/topic/categories"
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono',
                  'bg-surface-200 border border-surface-300 text-surface-500',
                  'hover:bg-surface-300 hover:text-white transition-colors'
                )}
              >
                Browse categories
              </Link>
              <Link
                href="/topic/create"
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold',
                  'bg-for-600 border border-for-500/40 text-white',
                  'hover:bg-for-500 transition-colors'
                )}
              >
                + Propose topic
              </Link>
            </div>
          </div>

          <p className="mt-4 text-sm font-mono text-surface-500 max-w-3xl leading-relaxed">
            Every civic topic moves through this pipeline — from community{' '}
            <span className="text-surface-400">proposals</span> that need support, to{' '}
            <span className="text-for-400">active debates</span> where votes are cast, through a{' '}
            <span className="text-purple">final voting window</span>, and ultimately becoming{' '}
            <span className="text-gold">established law</span> or being{' '}
            <span className="text-against-400">rejected</span> by the community.
          </p>
        </div>

        {/* ── Pipeline board ───────────────────────────────────────────── */}
        <PipelineClient initialTopics={topics} />

      </main>

      <BottomNav />
    </div>
  )
}
