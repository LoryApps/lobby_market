import Link from 'next/link'
import { Gavel, Network } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LawCard } from '@/components/law/LawCard'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import type { Law } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface LawIndexPageProps {
  searchParams: { search?: string }
}

export default async function LawIndexPage({
  searchParams,
}: LawIndexPageProps) {
  const supabase = await createClient()
  const search = searchParams.search?.trim()

  let query = supabase
    .from('laws')
    .select('*')
    .eq('is_active', true)
    .order('established_at', { ascending: false })

  if (search) {
    query = query.or(
      `statement.ilike.%${search}%,full_statement.ilike.%${search}%`
    )
  }

  const { data: lawRows } = await query
  const laws = (lawRows as Law[] | null) ?? []

  // Group by category
  const grouped = new Map<string, Law[]>()
  for (const law of laws) {
    const cat = law.category ?? 'Uncategorized'
    const list = grouped.get(cat) ?? []
    list.push(law)
    grouped.set(cat, list)
  }

  // Sort categories alphabetically, Uncategorized last
  const sortedCategories = Array.from(grouped.keys()).sort((a, b) => {
    if (a === 'Uncategorized') return 1
    if (b === 'Uncategorized') return -1
    return a.localeCompare(b)
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald/10 border border-emerald/30">
              <Gavel className="h-5 w-5 text-emerald" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white">
                The Codex
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {laws.length} established Law
                {laws.length === 1 ? '' : 's'} · Community consensus ≥ 67%
              </p>
            </div>
            <div className="ml-auto">
              <Link
                href="/law/graph"
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-emerald/10 border border-emerald/30 text-emerald',
                  'hover:bg-emerald/20 hover:border-emerald/50',
                  'text-xs font-mono font-medium transition-colors'
                )}
              >
                <Network className="h-4 w-4" />
                <span className="hidden sm:inline">Full Graph</span>
              </Link>
            </div>
          </div>

          {search && (
            <div className="mt-4 text-sm font-mono text-surface-500">
              Showing results for{' '}
              <span className="text-emerald">&ldquo;{search}&rdquo;</span>
              {' · '}
              <Link href="/law" className="underline hover:text-white">
                clear
              </Link>
            </div>
          )}
        </div>

        {/* Empty state */}
        {laws.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Gavel className="h-12 w-12 text-surface-500 mb-4" />
            <h2 className="font-mono text-lg text-white mb-2">
              {search ? 'No matching Laws' : 'No Laws yet'}
            </h2>
            <p className="text-sm font-mono text-surface-500 max-w-md">
              {search
                ? 'Try a different search term or clear the filter.'
                : 'Once a topic reaches 67% consensus, it becomes a Law and appears in the Codex.'}
            </p>
          </div>
        )}

        {/* Grouped by category */}
        <div className="space-y-12">
          {sortedCategories.map((category) => {
            const categoryLaws = grouped.get(category)!
            return (
              <section key={category}>
                <div className="flex items-baseline justify-between mb-4 pb-2 border-b border-surface-300">
                  <h2 className="font-mono text-lg font-semibold text-white uppercase tracking-wider">
                    {category}
                  </h2>
                  <span className="text-[11px] font-mono text-surface-500">
                    {categoryLaws.length}{' '}
                    {categoryLaws.length === 1 ? 'Law' : 'Laws'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryLaws.map((law) => (
                    <LawCard key={law.id} law={law} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
