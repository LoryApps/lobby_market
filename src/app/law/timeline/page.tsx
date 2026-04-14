import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Clock, LayoutGrid, Network } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { LawTimeline } from '@/components/law/LawTimeline'
import type { Law } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Codex Timeline · Lobby Market',
  description:
    'A chronological history of every Law established by community consensus — grouped by month, filterable by category.',
  openGraph: {
    title: 'Codex Timeline · Lobby Market',
    description: 'Every law, in the order they were written into history.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default async function LawTimelinePage() {
  const supabase = await createClient()

  const { data: lawRows } = await supabase
    .from('laws')
    .select('*')
    .eq('is_active', true)
    .order('established_at', { ascending: false })

  const laws = (lawRows as Law[] | null) ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12" id="main-content">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/law"
                aria-label="Back to Codex"
                className={cn(
                  'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                  'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                  'transition-colors'
                )}
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Clock className="h-5 w-5 text-emerald" aria-hidden="true" />
                  <h1 className="font-mono text-2xl font-bold text-white">
                    Codex Timeline
                  </h1>
                </div>
                <p className="text-sm font-mono text-surface-500">
                  Every law, in the order it was written into history
                </p>
              </div>
            </div>

            {/* Nav to other Codex views */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/law"
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg',
                  'bg-surface-200 border border-surface-300 text-surface-500 text-xs font-mono',
                  'hover:bg-surface-300 hover:text-white transition-colors'
                )}
                aria-label="Codex list view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">List</span>
              </Link>
              <Link
                href="/law/graph"
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg',
                  'bg-surface-200 border border-surface-300 text-surface-500 text-xs font-mono',
                  'hover:bg-surface-300 hover:text-white transition-colors'
                )}
                aria-label="Codex knowledge graph"
              >
                <Network className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Graph</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Timeline ─────────────────────────────────────────────────── */}
        <LawTimeline laws={laws} />
      </main>

      <BottomNav />
    </div>
  )
}
