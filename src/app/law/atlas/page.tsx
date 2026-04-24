import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Globe, Clock, Network } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { LawAtlasClient } from '@/components/law/LawAtlasClient'
import { cn } from '@/lib/utils/cn'
import type { AtlasMatrix } from '@/app/api/laws/atlas/route'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Law Atlas · Lobby Market',
  description:
    'Explore the Lobby Codex through a geographic and categorical lens — browse all established laws organised by scope and subject.',
  openGraph: {
    title: 'Law Atlas · Lobby Market',
    description:
      'A heat-map matrix of all consensus laws, organised by scope (Global/National/Regional/Local) and category.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Law Atlas · Lobby Market',
    description: 'Browse all consensus laws by scope and category.',
  },
}

async function fetchAtlasData(): Promise<AtlasMatrix | null> {
  const supabase = await createClient()

  // Join laws with their parent topic to get the scope field
  const { data, error } = await supabase
    .from('laws')
    .select(
      `
      id,
      statement,
      category,
      blue_pct,
      total_votes,
      established_at,
      topic_id,
      topics!inner ( scope )
    `
    )
    .eq('is_active', true)
    .order('established_at', { ascending: false })

  if (error || !data) return null

  function normaliseScope(raw: string | undefined | null): string {
    if (!raw) return 'Global'
    const map: Record<string, string> = {
      global: 'Global', national: 'National', regional: 'Regional', local: 'Local',
    }
    return map[raw.toLowerCase()] ?? 'Global'
  }

  function normaliseCategory(raw: string | null | undefined): string {
    if (!raw) return 'Other'
    const known = [
      'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
      'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
    ]
    return known.find((c) => c.toLowerCase() === raw.toLowerCase()) ?? 'Other'
  }

  const laws = data.map((r) => ({
    id: r.id as string,
    statement: r.statement as string,
    category: r.category as string | null,
    scope: normaliseScope((r.topics as unknown as { scope?: string })?.scope),
    blue_pct: r.blue_pct as number | null,
    total_votes: r.total_votes as number | null,
    established_at: r.established_at as string,
    topic_id: r.topic_id as string,
  }))

  const matrix: Record<string, Record<string, number>> = {}
  const byScope: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  let totalVotes = 0

  for (const law of laws) {
    const scope = law.scope
    const cat = normaliseCategory(law.category)

    if (!matrix[scope]) matrix[scope] = {}
    matrix[scope][cat] = (matrix[scope][cat] ?? 0) + 1

    byScope[scope] = (byScope[scope] ?? 0) + 1
    byCategory[cat] = (byCategory[cat] ?? 0) + 1

    totalVotes += law.total_votes ?? 0
  }

  return {
    matrix,
    byScope,
    byCategory,
    laws,
    totals: { laws: laws.length, votes: totalVotes },
  }
}

export default async function LawAtlasPage() {
  const data = await fetchAtlasData()

  const fallback: AtlasMatrix = {
    matrix: {},
    byScope: {},
    byCategory: {},
    laws: [],
    totals: { laws: 0, votes: 0 },
  }

  const atlasData = data ?? fallback

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <Link
            href="/law"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Codex
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30">
                <Globe className="h-5 w-5 text-emerald" />
              </div>
              <div>
                <h1 className="font-mono text-3xl font-bold text-white">
                  Law Atlas
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  {atlasData.totals.laws} law{atlasData.totals.laws !== 1 ? 's' : ''} across scope &amp; category
                </p>
              </div>
            </div>

            {/* Nav buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
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

          <p className="mt-4 text-sm font-mono text-surface-500 max-w-2xl leading-relaxed">
            Explore the Codex through a geographic lens. Filter laws by their scope — global
            principles, national policy, regional rules, or local ordinances — and see which
            categories drive the most democratic consensus.
          </p>
        </div>

        {/* ── Interactive atlas ──────────────────────────────────────── */}
        <LawAtlasClient data={atlasData} />
      </main>

      <BottomNav />
    </div>
  )
}
