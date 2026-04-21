import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock, Gavel, Globe, Network, Rss } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { LawCodexClient } from '@/components/law/LawCodexClient'
import type { Law } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'The Codex · Lobby Market',
  description:
    'Browse every Law established by community consensus — searchable, filterable by category, and sorted by votes or date.',
  openGraph: {
    title: 'The Codex · Lobby Market',
    description: 'Every Law established by community consensus.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

export default async function LawIndexPage() {
  const supabase = await createClient()

  const { data: lawRows } = await supabase
    .from('laws')
    .select('*')
    .eq('is_active', true)
    .order('established_at', { ascending: false })

  const laws = (lawRows as Law[] | null) ?? []

  // Aggregate total votes across all laws for the stats strip
  const totalVotes = laws.reduce((sum, l) => sum + (l.total_votes ?? 0), 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30">
                <Gavel className="h-5 w-5 text-emerald" />
              </div>
              <div>
                <h1 className="font-mono text-3xl font-bold text-white">
                  The Codex
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Community consensus ≥ 67% · All established Laws
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/api/rss"
                aria-label="RSS feed of laws and active topics"
                className={cn(
                  'inline-flex items-center justify-center h-9 w-9 rounded-lg',
                  'bg-gold/10 border border-gold/30 text-gold',
                  'hover:bg-gold/20 hover:border-gold/50 transition-colors'
                )}
              >
                <Rss className="h-4 w-4" />
              </Link>

              <Link
                href="/law/timeline"
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-surface-200 border border-surface-300 text-surface-500 text-xs font-mono font-medium',
                  'hover:bg-surface-300 hover:text-white transition-colors'
                )}
              >
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Timeline</span>
              </Link>

              <Link
                href="/law/atlas"
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-for-600/10 border border-for-500/30 text-for-400 text-xs font-mono font-medium',
                  'hover:bg-for-600/20 hover:border-for-500/50 transition-colors'
                )}
              >
                <Globe className="h-4 w-4" />
                <span className="hidden sm:inline">Atlas</span>
              </Link>

              <Link
                href="/law/graph"
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-emerald/10 border border-emerald/30 text-emerald text-xs font-mono font-medium',
                  'hover:bg-emerald/20 hover:border-emerald/50 transition-colors'
                )}
              >
                <Network className="h-4 w-4" />
                <span className="hidden sm:inline">Law Graph</span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Interactive Codex browser ─────────────────────────────────── */}
        <LawCodexClient laws={laws} totalVotes={totalVotes} />
      </main>

      <BottomNav />
    </div>
  )
}
