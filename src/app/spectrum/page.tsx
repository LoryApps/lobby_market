import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { SpectrumClient } from './SpectrumClient'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'Civic Spectrum · Lobby Market',
  description:
    'A 2D map of every debate in the Lobby — plotted by consensus direction and engagement volume. See which topics are contested, which have found majority, and where the debates are fiercest.',
  openGraph: {
    title: 'Civic Spectrum · Lobby Market',
    description:
      'Every debate mapped: where does community consensus fall, and how intensely are people engaged?',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Spectrum · Lobby Market',
    description: 'A live map of where civic consensus stands on every debate topic.',
  },
}

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpectrumTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  created_at: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SpectrumPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .gt('total_votes', 0)
    .order('total_votes', { ascending: false })
    .limit(500)

  const topics = (data ?? []) as SpectrumTopic[]

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 pt-5 pb-24 md:pb-8 gap-5">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">
              Civic Spectrum
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              {topics.length} topics mapped by consensus &amp; engagement
            </p>
          </div>
        </div>

        {/* ── Chart ───────────────────────────────────────────────────── */}
        <SpectrumClient topics={topics} />

      </main>

      <BottomNav />
    </div>
  )
}
