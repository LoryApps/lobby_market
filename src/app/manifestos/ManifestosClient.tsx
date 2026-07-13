'use client'

/**
 * /manifestos — The Civic Manifesto Gallery
 *
 * A social gallery of published civic manifestos — AI-generated political
 * declarations built from each citizen's real voting history on Lobby Market.
 *
 * Features:
 *  - Browse by archetype (Progressive, Centrist, Conservative, etc.)
 *  - See each citizen's declaration, top category, and voting stats
 *  - Link to their profile
 *  - Quick-link to generate your own at /manifesto
 *
 * Distinct from:
 *   /manifesto  — the personal generator (unpublished, on-demand)
 *   /analytics  — your personal stats dashboard
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  ChevronRight,
  Gavel,
  Loader2,
  RefreshCw,
  Scroll,
  Search,
  Sparkles,
  ThumbsUp,
  Vote,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PublicManifestoRow, ManifestosResponse } from '@/app/api/manifestos/route'

// ─── Archetype palette ────────────────────────────────────────────────────────

const ARCHETYPE_PALETTE: Array<{
  match: RegExp
  badge: string
  glow: string
  border: string
}> = [
  {
    match: /progressive|reform|change|forward|social/i,
    badge: 'bg-for-500/15 text-for-300 border-for-500/40',
    glow: 'shadow-for-900/20',
    border: 'hover:border-for-500/40',
  },
  {
    match: /conserv|tradition|liberty|hawk|right/i,
    badge: 'bg-against-500/15 text-against-300 border-against-500/40',
    glow: 'shadow-against-900/20',
    border: 'hover:border-against-500/40',
  },
  {
    match: /pragmat|centrist|balance|moderate/i,
    badge: 'bg-gold/15 text-gold border-gold/40',
    glow: 'shadow-yellow-900/20',
    border: 'hover:border-gold/40',
  },
  {
    match: /democrat|communal|people|civic/i,
    badge: 'bg-emerald/15 text-emerald border-emerald/40',
    glow: 'shadow-emerald-900/20',
    border: 'hover:border-emerald/40',
  },
  {
    match: /tech|innov|digital|future|accelerat/i,
    badge: 'bg-purple/15 text-purple border-purple/40',
    glow: 'shadow-purple-900/20',
    border: 'hover:border-purple/40',
  },
]

function archetypeStyle(archetype: string) {
  for (const p of ARCHETYPE_PALETTE) {
    if (p.match.test(archetype)) return p
  }
  return {
    badge: 'bg-for-500/15 text-for-300 border-for-500/40',
    glow: 'shadow-for-900/20',
    border: 'hover:border-for-500/40',
  }
}

// ─── Manifesto card ───────────────────────────────────────────────────────────

function ManifestoCard({ m }: { m: PublicManifestoRow }) {
  const style = archetypeStyle(m.archetype)

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'group relative flex flex-col gap-4 p-5 rounded-2xl',
        'bg-surface-100 border border-surface-300',
        'transition-all duration-200',
        style.border,
        'hover:shadow-lg',
        style.glow
      )}
    >
      {/* Archetype badge */}
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-bold uppercase tracking-widest flex-shrink-0',
            style.badge
          )}
        >
          <Sparkles className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {m.archetype}
        </span>

        <Link
          href={`/profile/${m.username}`}
          className="flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
          aria-label={`View ${m.display_name ?? m.username}'s profile`}
        >
          <Avatar
            src={null}
            fallback={m.display_name ?? m.username}
            size="xs"
          />
        </Link>
      </div>

      {/* Title */}
      <div>
        <h2 className="font-mono text-sm font-bold text-white leading-snug mb-1 line-clamp-2">
          {m.title}
        </h2>
        <p className="text-xs font-mono text-surface-500 italic line-clamp-1">
          {m.archetype_description}
        </p>
      </div>

      {/* Declaration excerpt */}
      <blockquote className="border-l-2 border-surface-400/60 pl-3">
        <p className="text-xs font-mono text-surface-600 leading-relaxed line-clamp-3 italic">
          &ldquo;{m.declaration}&rdquo;
        </p>
      </blockquote>

      {/* Stats row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
          <Vote className="h-3 w-3 text-for-500/70" aria-hidden="true" />
          {m.total_votes.toLocaleString()} votes
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
          <ThumbsUp className="h-3 w-3 text-for-500/70" aria-hidden="true" />
          {m.for_pct}% FOR
        </span>
        {m.laws_supported > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Gavel className="h-3 w-3 text-gold/70" aria-hidden="true" />
            {m.laws_supported} laws
          </span>
        )}
        {m.top_category && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <BarChart2 className="h-3 w-3 text-purple/70" aria-hidden="true" />
            {m.top_category}
          </span>
        )}
      </div>

      {/* Author footer */}
      <div className="flex items-center justify-between pt-2 border-t border-surface-300/60">
        <Link
          href={`/profile/${m.username}`}
          className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          @{m.username}
        </Link>
        <span className="text-[11px] font-mono text-surface-600">
          {new Date(m.published_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      </div>
    </motion.article>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function ManifestoCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-5 rounded-2xl bg-surface-100 border border-surface-300 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="h-6 w-32 rounded-full bg-surface-300/60" />
        <div className="h-7 w-7 rounded-full bg-surface-300/50" />
      </div>
      <div className="space-y-1.5">
        <div className="h-4 w-5/6 rounded bg-surface-300/50" />
        <div className="h-3 w-3/4 rounded bg-surface-300/40" />
      </div>
      <div className="pl-3 border-l-2 border-surface-400/30 space-y-1.5">
        <div className="h-3 w-full rounded bg-surface-300/30" />
        <div className="h-3 w-4/5 rounded bg-surface-300/30" />
        <div className="h-3 w-2/3 rounded bg-surface-300/30" />
      </div>
      <div className="flex gap-3">
        <div className="h-3 w-16 rounded bg-surface-300/30" />
        <div className="h-3 w-12 rounded bg-surface-300/30" />
        <div className="h-3 w-14 rounded bg-surface-300/30" />
      </div>
      <div className="pt-2 border-t border-surface-300/40 flex justify-between">
        <div className="h-3 w-20 rounded bg-surface-300/30" />
        <div className="h-3 w-16 rounded bg-surface-300/30" />
      </div>
    </div>
  )
}

// ─── Archetype filter chip ────────────────────────────────────────────────────

const ARCHETYPE_FILTERS = [
  { label: 'All', value: null },
  { label: 'Progressive', value: 'progressive' },
  { label: 'Centrist', value: 'centrist' },
  { label: 'Conservative', value: 'conserv' },
  { label: 'Democratic', value: 'democrat' },
  { label: 'Tech-Forward', value: 'tech' },
  { label: 'Pragmatic', value: 'pragmat' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ManifestosClient() {
  const [manifestos, setManifestos] = useState<PublicManifestoRow[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [myManifestoId, setMyManifestoId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [archetypeFilter, setArchetypeFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchManifestos = useCallback(
    async (opts: { reset?: boolean; archetype?: string | null; q?: string } = {}) => {
      const { reset = false, archetype = archetypeFilter, q = search } = opts
      const offset = reset ? 0 : manifestos.length

      if (reset) {
        setLoading(true)
        setManifestos([])
      } else {
        setLoadingMore(true)
      }
      setError(false)

      try {
        const params = new URLSearchParams({ limit: '24', offset: String(offset) })
        if (archetype) params.set('archetype', archetype)
        if (q) params.set('q', q)

        const res = await fetch(`/api/manifestos?${params}`)
        if (!res.ok) throw new Error('fetch failed')
        const data: ManifestosResponse = await res.json()

        setManifestos((prev) => (reset ? data.manifestos : [...prev, ...data.manifestos]))
        setTotal(data.total)
        setHasMore(data.hasMore)
        setMyManifestoId(data.myManifestoId)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [archetypeFilter, manifestos.length, search]
  )

  useEffect(() => {
    fetchManifestos({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archetypeFilter, search])

  function handleArchetypeChange(value: string | null) {
    setArchetypeFilter(value)
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  function clearSearch() {
    setSearchInput('')
    setSearch('')
  }

  return (
    <div className="min-h-screen bg-surface-50 pb-20">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 pt-6 pb-10">
        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Scroll className="h-5 w-5 text-for-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white leading-tight">
                Civic Manifestos
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {total > 0
                  ? `${total.toLocaleString()} published civic declarations`
                  : 'Published civic declarations from the Lobby'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {myManifestoId ? (
              <Link
                href="/manifesto"
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold',
                  'bg-for-500/15 border border-for-500/40 text-for-300',
                  'hover:bg-for-500/25 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
                )}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Update mine
              </Link>
            ) : (
              <Link
                href="/manifesto"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-semibold',
                  'bg-for-600 hover:bg-for-500 text-white',
                  'border border-for-500/50',
                  'transition-colors shadow-lg shadow-for-900/30',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
                )}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Create yours
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>

        {/* ── Search ───────────────────────────────────────── */}
        <form onSubmit={handleSearchSubmit} className="relative mb-5" role="search">
          <label htmlFor="manifesto-search" className="sr-only">
            Search manifestos by username or archetype
          </label>
          <div className="relative flex items-center">
            <Search
              className="absolute left-3 h-4 w-4 text-surface-500 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="manifesto-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by username or archetype…"
              className={cn(
                'w-full pl-9 pr-24 py-2.5 rounded-xl',
                'bg-surface-100 border border-surface-300 text-sm font-mono text-white',
                'placeholder:text-surface-500',
                'focus:outline-none focus:border-for-500/60 focus:ring-2 focus:ring-for-500/20',
                'transition-colors'
              )}
            />
            <div className="absolute right-2 flex items-center gap-1">
              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="flex items-center justify-center h-7 w-7 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
              <button
                type="submit"
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                  'bg-for-600 text-white hover:bg-for-500 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
                )}
              >
                Search
              </button>
            </div>
          </div>
        </form>

        {/* ── Archetype filters ─────────────────────────────── */}
        <div
          className="flex items-center gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide"
          role="group"
          aria-label="Filter by archetype"
        >
          {ARCHETYPE_FILTERS.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => handleArchetypeChange(value)}
              aria-pressed={archetypeFilter === value}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-semibold',
                'border transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
                archetypeFilter === value
                  ? 'bg-for-500/20 border-for-500/50 text-for-300'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Content ───────────────────────────────────────── */}
        {loading ? (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            aria-busy="true"
            aria-label="Loading manifestos"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <ManifestoCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-sm font-mono text-surface-500">Failed to load manifestos.</p>
            <button
              onClick={() => fetchManifestos({ reset: true })}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors focus:outline-none"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : manifestos.length === 0 ? (
          <EmptyState
            icon={Scroll}
            title="No manifestos published yet"
            description={
              archetypeFilter || search
                ? 'Try a different filter or search term.'
                : 'Be the first to publish your civic declaration.'
            }
            action={
              <Link
                href="/manifesto"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-mono font-semibold',
                  'bg-for-600 hover:bg-for-500 text-white border border-for-500/50',
                  'transition-colors shadow-lg shadow-for-900/30',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
                )}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Generate &amp; Publish Yours
              </Link>
            }
          />
        ) : (
          <>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              role="list"
              aria-label="Published civic manifestos"
            >
              <AnimatePresence>
                {manifestos.map((m) => (
                  <div key={m.id} role="listitem">
                    <ManifestoCard m={m} />
                  </div>
                ))}
              </AnimatePresence>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => fetchManifestos()}
                  disabled={loadingMore}
                  className={cn(
                    'inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-mono font-semibold',
                    'bg-surface-100 border border-surface-300 text-surface-500',
                    'hover:bg-surface-200 hover:text-white transition-colors',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
                  )}
                  aria-label={loadingMore ? 'Loading more manifestos' : 'Load more manifestos'}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Loading…
                    </>
                  ) : (
                    <>
                      Load more
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* CTA if user hasn't published */}
            {!myManifestoId && (
              <div className="mt-8 rounded-2xl border border-for-500/20 bg-for-500/5 p-6 text-center">
                <Scroll className="h-8 w-8 text-for-400 mx-auto mb-3" aria-hidden="true" />
                <h3 className="font-mono font-bold text-white mb-1">
                  Add your voice to the gallery
                </h3>
                <p className="text-sm font-mono text-surface-500 mb-4 max-w-sm mx-auto">
                  Generate your civic manifesto from your voting history and publish it for others to discover.
                </p>
                <Link
                  href="/manifesto"
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold',
                    'bg-for-600 hover:bg-for-500 text-white border border-for-500/50',
                    'transition-colors shadow-lg shadow-for-900/30',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
                  )}
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Create My Manifesto
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
