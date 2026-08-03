'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Gavel,
  Loader2,
  Search,
  X,
  Calendar,
  TrendingUp,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LawResult {
  id: string
  statement: string
  full_statement: string | null
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string
  is_active: boolean
}

interface SearchResponse {
  results: LawResult[]
}

// ─── Category color map ───────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  Politics:    'text-for-400 bg-for-500/10 border-for-500/30',
  Economics:   'text-gold bg-gold/10 border-gold/30',
  Technology:  'text-purple bg-purple/10 border-purple/30',
  Science:     'text-emerald bg-emerald/10 border-emerald/30',
  Ethics:      'text-against-300 bg-against-500/10 border-against-500/30',
  Philosophy:  'text-purple bg-purple/10 border-purple/30',
  Culture:     'text-gold bg-gold/10 border-gold/30',
  Health:      'text-emerald bg-emerald/10 border-emerald/30',
  Environment: 'text-emerald bg-emerald/10 border-emerald/30',
  Education:   'text-for-400 bg-for-500/10 border-for-500/30',
}

function categoryClass(cat: string | null): string {
  return cat ? (CAT_COLORS[cat] ?? 'text-surface-500 bg-surface-300/40 border-surface-400/30') : 'text-surface-500 bg-surface-300/40 border-surface-400/30'
}

// ─── Result card ──────────────────────────────────────────────────────────────

function LawCard({ law }: { law: LawResult }) {
  const forPct = Math.round(law.blue_pct ?? 67)
  const year = law.established_at ? new Date(law.established_at).getFullYear() : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/law/${law.id}`}
        className="group flex flex-col gap-2.5 p-4 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/80 hover:bg-surface-200/90 transition-all"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-tight line-clamp-2 group-hover:text-emerald transition-colors">
              {law.statement}
            </p>
            {law.full_statement && (
              <p className="text-[11px] text-surface-500 mt-1 line-clamp-2 leading-snug">
                {law.full_statement}
              </p>
            )}
          </div>
          <ArrowRight className="flex-shrink-0 h-4 w-4 text-surface-600 opacity-0 group-hover:opacity-100 mt-0.5 transition-opacity" />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {law.category && (
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', categoryClass(law.category))}>
              {law.category}
            </span>
          )}
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-emerald/10 border-emerald/25 text-emerald">
            LAW
          </span>
          {year && (
            <span className="flex items-center gap-1 text-[10px] text-surface-500">
              <Calendar className="h-2.5 w-2.5" />
              {year}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-surface-500 ml-auto">
            <TrendingUp className="h-2.5 w-2.5 text-for-400" />
            <span className="text-for-400 font-mono">{forPct}%</span>
            <span className="text-surface-600">For</span>
          </span>
          {law.total_votes ? (
            <span className="flex items-center gap-1 text-[10px] text-surface-500">
              <Vote className="h-2.5 w-2.5" />
              {law.total_votes.toLocaleString()}
            </span>
          ) : null}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Inner page (needs Suspense for useSearchParams) ─────────────────────────

function LawSearchInner() {
  const searchParams = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initialQ)
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ)
  const [results, setResults] = useState<LawResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 320)
    return () => clearTimeout(t)
  }, [query])

  // Fetch
  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/laws/search?q=${encodeURIComponent(q)}&limit=20`)
      if (res.ok) {
        const data = (await res.json()) as SearchResponse
        setResults(data.results)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchResults(debouncedQuery)
  }, [debouncedQuery, fetchResults])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Back nav */}
        <div className="mb-5">
          <Link
            href="/law/explore"
            className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Codex Explorer
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/30">
            <Gavel className="h-5 w-5 text-emerald" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Search Laws</h1>
            <p className="text-xs text-surface-500 mt-0.5">Full-text search across all established laws</p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search established laws…"
            className={cn(
              'w-full pl-10 pr-10 py-3 rounded-xl text-sm',
              'bg-surface-200 border border-surface-300',
              'text-white placeholder:text-surface-600',
              'focus:outline-none focus:border-emerald/50 focus:ring-1 focus:ring-emerald/30',
              'transition-all',
            )}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald animate-spin" />
          )}
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {loading && !results && (
            <div key="loading" className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          )}

          {!loading && results !== null && results.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <EmptyState
                icon={Gavel}
                title="No laws found"
                description={`No established laws match "${debouncedQuery}". Try different keywords.`}
              />
            </motion.div>
          )}

          {results && results.length > 0 && (
            <motion.div
              key="results"
              className="space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <p className="text-xs text-surface-500 mb-3">
                {results.length} law{results.length !== 1 ? 's' : ''} found
              </p>
              {results.map((law) => (
                <LawCard key={law.id} law={law} />
              ))}
            </motion.div>
          )}

          {!loading && query.length < 2 && (
            <motion.div
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Search className="h-10 w-10 text-surface-600 mx-auto mb-3" />
              <p className="text-sm text-surface-500">Type at least 2 characters to search</p>
              <p className="text-xs text-surface-600 mt-1">Searches law titles and full text</p>
              <div className="mt-6">
                <Link
                  href="/law"
                  className="inline-flex items-center gap-1.5 text-xs text-emerald hover:text-emerald/80 transition-colors"
                >
                  Browse all laws
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function LawSearchPage() {
  return (
    <Suspense>
      <LawSearchInner />
    </Suspense>
  )
}
