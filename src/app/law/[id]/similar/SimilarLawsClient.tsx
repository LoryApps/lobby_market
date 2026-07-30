'use client'

/**
 * /law/[id]/similar — Similar Laws Discovery
 *
 * Surfaces laws from the Codex related to the current law through two lenses:
 *   1. Category Peers   — other laws in the same civic category
 *   2. Keyword Matches  — laws whose statements share significant words
 *
 * Uses /api/laws/[id]/similar
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Gavel,
  Layers,
  RefreshCw,
  Search,
  Tag,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SimilarLaw, SimilarLawsResponse } from '@/app/api/laws/[id]/similar/route'
import type { SourceLaw } from './page'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

function getCategoryStyle(cat: string | null) {
  return cat && CATEGORY_COLOR[cat]
    ? CATEGORY_COLOR[cat]
    : { text: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/30' }
}

// ─── Law Card ─────────────────────────────────────────────────────────────────

function LawCard({ law, index }: { law: SimilarLaw; index: number }) {
  const catStyle = getCategoryStyle(law.category)
  const forPct = Math.round(law.blue_pct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Link
        href={`/law/${law.id}`}
        className={cn(
          'group block rounded-2xl bg-surface-100 border border-surface-300 p-4',
          'hover:border-gold/30 hover:bg-surface-100/90 transition-all duration-200'
        )}
      >
        {/* Category + date row */}
        <div className="flex items-center gap-2 mb-3">
          {law.category && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                catStyle.bg, catStyle.text, catStyle.border
              )}
            >
              {law.category}
            </span>
          )}
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
              law.is_active
                ? 'bg-gold/10 text-gold border-gold/25'
                : 'bg-surface-400/10 text-surface-400 border-surface-400/20'
            )}
          >
            <Gavel className="h-2.5 w-2.5" />
            {law.is_active ? 'Active Law' : 'Inactive'}
          </span>
        </div>

        {/* Statement */}
        <p className="text-sm font-semibold text-white leading-snug line-clamp-3 mb-3 group-hover:text-gold/90 transition-colors">
          {law.statement}
        </p>

        {/* Keyword tags (only for keyword-match results) */}
        {law.match_reason === 'keyword' && law.shared_keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {law.shared_keywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple/10 border border-purple/20 text-[10px] font-mono text-purple"
              >
                <Tag className="h-2 w-2" />
                {kw}
              </span>
            ))}
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-for-500" />
            <span className="text-for-400">{forPct}%</span>
            <span>FOR</span>
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {formatVotes(law.total_votes)} votes
          </span>
          <span className="ml-auto text-surface-600">{formatDate(law.established_at)}</span>
          <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-gold/60 transition-colors flex-shrink-0" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full ml-auto" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  count,
  subtitle,
}: {
  icon: typeof Layers
  iconColor: string
  title: string
  count?: number
  subtitle: string
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={cn('p-2 rounded-xl border', iconColor, 'flex-shrink-0')}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          {title}
          {typeof count === 'number' && (
            <span className="text-[10px] font-mono text-surface-500 bg-surface-300/40 border border-surface-400/30 rounded-full px-2 py-px">
              {count}
            </span>
          )}
        </h2>
        <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  lawId: string
  sourceLaw: SourceLaw
}

export function SimilarLawsClient({ lawId, sourceLaw }: Props) {
  const [data, setData] = useState<SimilarLawsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/laws/${lawId}/similar`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const catStyle = getCategoryStyle(sourceLaw.category)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back button */}
        <Link
          href={`/law/${lawId}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5 group"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to law
        </Link>

        {/* Header */}
        <div className="rounded-3xl bg-surface-100 border border-gold/20 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Gavel className="h-4 w-4 text-gold" />
            {sourceLaw.category && (
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  catStyle.bg, catStyle.text, catStyle.border
                )}
              >
                {sourceLaw.category}
              </span>
            )}
          </div>
          <h1 className="text-base font-bold text-white leading-snug line-clamp-3 mb-1">
            {sourceLaw.statement}
          </h1>
          <p className="text-[11px] font-mono text-surface-500">
            Established {formatDate(sourceLaw.established_at)} ·{' '}
            {formatVotes(sourceLaw.total_votes)} votes
          </p>
        </div>

        {/* Page title */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white">Related Laws</h2>
          <p className="text-sm text-surface-500 mt-0.5">
            Other consensus laws in the Codex that share category or key themes with this one.
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-2xl bg-against-900/30 border border-against-700/40 p-6 text-center">
            <p className="text-sm text-against-400 mb-3">Failed to load similar laws.</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Try again
            </button>
          </div>
        )}

        {/* Loading */}
        {!error && loading && (
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-8 w-8 rounded-xl" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
              <SectionSkeleton />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="h-8 w-8 rounded-xl" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-52" />
                </div>
              </div>
              <SectionSkeleton />
            </div>
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {!loading && !error && data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Category peers */}
              {data.categoryPeers.length > 0 && (
                <section>
                  <SectionHeader
                    icon={Layers}
                    iconColor="bg-gold/10 border-gold/25 text-gold"
                    title="Same Category"
                    count={data.categoryPeers.length}
                    subtitle={`Other established laws classified as ${sourceLaw.category ?? 'this category'}`}
                  />
                  <div className="space-y-3">
                    {data.categoryPeers.map((law, i) => (
                      <LawCard key={law.id} law={law} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* Keyword matches */}
              {data.keywordMatches.length > 0 && (
                <section>
                  <SectionHeader
                    icon={Search}
                    iconColor="bg-purple/10 border-purple/25 text-purple"
                    title="Thematically Related"
                    count={data.keywordMatches.length}
                    subtitle="Laws that share significant words and concepts with this one"
                  />
                  <div className="space-y-3">
                    {data.keywordMatches.map((law, i) => (
                      <LawCard key={law.id} law={law} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* Empty state */}
              {data.totalDistinct === 0 && (
                <EmptyState
                  icon={Gavel}
                  title="No similar laws found"
                  description="The Codex is still growing. As more laws are established, related ones will appear here."
                  action={
                    <Link
                      href="/law"
                      className="inline-flex items-center gap-1.5 text-sm font-mono text-gold hover:text-gold/80 transition-colors"
                    >
                      Browse the Codex
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  }
                />
              )}

              {/* Footer CTA */}
              {data.totalDistinct > 0 && (
                <div className="pt-2 text-center">
                  <Link
                    href="/law"
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-gold transition-colors"
                  >
                    <Gavel className="h-3.5 w-3.5" />
                    Browse the full Codex
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
