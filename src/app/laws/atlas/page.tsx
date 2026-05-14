'use client'

/**
 * /laws/atlas — The Civic Laws Atlas
 *
 * Public heatmap of all established laws broken down by scope
 * (Global / National / Regional / Local) × civic category.
 * Links to individual law topics.
 *
 * Distinct from:
 *   /analytics/laws        — personal analytics (how your votes shaped laws)
 *   /certificate/[lawId]   — single law certificate
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  ExternalLink,
  Filter,
  Gavel,
  Globe,
  MapPin,
  RefreshCw,
  Scale,
  Star,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AtlasMatrix, AtlasLaw } from '@/app/api/laws/atlas/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const SCOPES = ['Global', 'National', 'Regional', 'Local'] as const
const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education', 'Other',
] as const

const SCOPE_ICONS: Record<string, typeof Globe> = {
  Global: Globe,
  National: Scale,
  Regional: MapPin,
  Local: MapPin,
}

const SCOPE_COLORS: Record<string, { text: string; bg: string; border: string; bar: string }> = {
  Global:   { text: 'text-purple',     bg: 'bg-purple/10',    border: 'border-purple/30',    bar: 'bg-purple' },
  National: { text: 'text-for-400',    bg: 'bg-for-500/10',   border: 'border-for-500/30',   bar: 'bg-for-400' },
  Regional: { text: 'text-gold',       bg: 'bg-gold/10',      border: 'border-gold/30',      bar: 'bg-gold' },
  Local:    { text: 'text-emerald',    bg: 'bg-emerald/10',   border: 'border-emerald/30',   bar: 'bg-emerald' },
}

const CAT_COLORS: Record<string, string> = {
  Politics:    'bg-for-600',
  Economics:   'bg-gold',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-500',
  Philosophy:  'bg-for-400',
  Culture:     'bg-amber-500',
  Health:      'bg-teal-500',
  Environment: 'bg-green-600',
  Education:   'bg-sky-500',
  Other:       'bg-surface-400',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeatCell({ count, maxCount }: { count: number; maxCount: number }) {
  const intensity = maxCount > 0 ? count / maxCount : 0
  const opacity = count === 0 ? 0 : Math.max(0.12, intensity)
  return (
    <div
      className="flex items-center justify-center rounded-md text-xs font-mono font-semibold text-white transition-all"
      style={{
        backgroundColor: count === 0 ? 'transparent' : `rgba(59, 130, 246, ${opacity})`,
        border: count === 0 ? '1px solid transparent' : `1px solid rgba(59, 130, 246, ${opacity * 0.5})`,
        minHeight: '2.25rem',
      }}
      title={`${count} law${count !== 1 ? 's' : ''}`}
    >
      {count > 0 ? count : <span className="text-surface-600">·</span>}
    </div>
  )
}

function LawCard({ law }: { law: AtlasLaw }) {
  const scopeColor = SCOPE_COLORS[law.scope] ?? SCOPE_COLORS.Global
  const ScopeIcon = SCOPE_ICONS[law.scope] ?? Globe
  const established = new Date(law.established_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  const forPct = law.blue_pct != null ? Math.round(law.blue_pct) : null
  return (
    <Link
      href={`/topic/${law.topic_id}`}
      className="flex items-start gap-3 px-4 py-4 hover:bg-surface-200/50 transition-colors group"
    >
      <div className={cn('flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center mt-0.5', scopeColor.bg, `border ${scopeColor.border}`)}>
        <ScopeIcon className={cn('h-3.5 w-3.5', scopeColor.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-700 line-clamp-2 mb-1.5 group-hover:text-white transition-colors">
          {law.statement}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-surface-500">
          <span className={cn('font-semibold', scopeColor.text)}>{law.scope}</span>
          {law.category && <span>{law.category}</span>}
          {forPct !== null && (
            <span className="text-emerald">{forPct}% FOR</span>
          )}
          {law.total_votes != null && (
            <span>{law.total_votes.toLocaleString()} votes</span>
          )}
          <span>{established}</span>
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
    </Link>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LawsAtlasPage() {
  const [data, setData] = useState<AtlasMatrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scopeFilter, setScopeFilter] = useState<string>('All')
  const [catFilter, setCatFilter] = useState<string>('All')
  const [showAll, setShowAll] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/laws/atlas', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load: ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Filtered laws list
  const filteredLaws = data?.laws.filter((l) => {
    if (scopeFilter !== 'All' && l.scope !== scopeFilter) return false
    const cat = l.category ?? 'Other'
    if (catFilter !== 'All' && cat !== catFilter) return false
    return true
  }) ?? []

  const SHOW_INITIAL = 15
  const visibleLaws = showAll ? filteredLaws : filteredLaws.slice(0, SHOW_INITIAL)

  // Max cell value for heat intensity
  const maxCell = data
    ? Math.max(
        1,
        ...SCOPES.flatMap((s) =>
          CATEGORIES.map((c) => data.matrix[s]?.[c] ?? 0)
        ),
      )
    : 1

  const maxByScope = data ? Math.max(1, ...Object.values(data.byScope)) : 1
  const maxByCat = data ? Math.max(1, ...Object.values(data.byCategory)) : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono flex items-center gap-2">
              <Gavel className="h-5 w-5 text-gold" />
              Laws Atlas
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Every established consensus law — by scope and category
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-against-950 border border-against-800 p-4 text-sm text-against-400 mb-4">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <Skeleton className="h-3 w-16 mb-3" />
                  <Skeleton className="h-8 w-20 mb-1" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
              <Skeleton className="h-4 w-32 mb-5" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-2">
                    <Skeleton className="h-9 w-20 flex-shrink-0" />
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Skeleton key={j} className="h-9 flex-1 rounded-md" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-1.5 text-surface-500 text-xs font-mono uppercase tracking-wider">
                    <Gavel className="h-3.5 w-3.5 text-gold" />Laws
                  </div>
                  <div className="text-3xl font-bold font-mono text-gold">{data.totals.laws.toLocaleString()}</div>
                  <div className="text-xs text-surface-500">established</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-1.5 text-surface-500 text-xs font-mono uppercase tracking-wider">
                    <Vote className="h-3.5 w-3.5 text-for-400" />Votes
                  </div>
                  <div className="text-3xl font-bold font-mono text-for-400">{data.totals.votes.toLocaleString()}</div>
                  <div className="text-xs text-surface-500">cast on laws</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-1.5 text-surface-500 text-xs font-mono uppercase tracking-wider">
                    <Globe className="h-3.5 w-3.5 text-purple" />Scopes
                  </div>
                  <div className="text-3xl font-bold font-mono text-purple">
                    {Object.keys(data.byScope).length}
                  </div>
                  <div className="text-xs text-surface-500">jurisdictions</div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.15 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-1.5 text-surface-500 text-xs font-mono uppercase tracking-wider">
                    <BarChart2 className="h-3.5 w-3.5 text-emerald" />Categories
                  </div>
                  <div className="text-3xl font-bold font-mono text-emerald">
                    {Object.keys(data.byCategory).length}
                  </div>
                  <div className="text-xs text-surface-500">civic domains</div>
                </motion.div>
              </div>

              {/* Heatmap matrix */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-6 overflow-x-auto"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5">
                  <BarChart2 className="h-3.5 w-3.5 text-for-400" />
                  Scope × Category Matrix
                  <span className="text-surface-600 normal-case tracking-normal ml-1">
                    — cell = # laws
                  </span>
                </div>
                <div className="min-w-[600px]">
                  {/* Column headers */}
                  <div className="grid mb-2" style={{ gridTemplateColumns: `7rem repeat(${CATEGORIES.length}, 1fr)` }}>
                    <div />
                    {CATEGORIES.map((cat) => (
                      <div
                        key={cat}
                        className="text-[10px] font-mono text-surface-500 text-center px-1 truncate"
                        title={cat}
                      >
                        {cat.slice(0, 3).toUpperCase()}
                      </div>
                    ))}
                  </div>
                  {/* Rows */}
                  {SCOPES.map((scope) => {
                    const ScopeIcon = SCOPE_ICONS[scope]
                    const sColor = SCOPE_COLORS[scope]
                    return (
                      <div
                        key={scope}
                        className="grid gap-1 mb-1"
                        style={{ gridTemplateColumns: `7rem repeat(${CATEGORIES.length}, 1fr)` }}
                      >
                        <div className={cn('flex items-center gap-1.5 text-xs font-mono font-semibold pr-2', sColor.text)}>
                          <ScopeIcon className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{scope}</span>
                          <span className="text-surface-600 font-normal ml-auto">
                            {data.byScope[scope] ?? 0}
                          </span>
                        </div>
                        {CATEGORIES.map((cat) => (
                          <HeatCell
                            key={cat}
                            count={data.matrix[scope]?.[cat] ?? 0}
                            maxCount={maxCell}
                          />
                        ))}
                      </div>
                    )
                  })}
                  {/* Column totals */}
                  <div className="grid mt-2" style={{ gridTemplateColumns: `7rem repeat(${CATEGORIES.length}, 1fr)` }}>
                    <div className="text-[10px] font-mono text-surface-600 flex items-center">TOTAL</div>
                    {CATEGORIES.map((cat) => (
                      <div
                        key={cat}
                        className="text-[10px] font-mono text-surface-500 text-center"
                      >
                        {data.byCategory[cat] ?? 0}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Scope breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5">
                  <Globe className="h-3.5 w-3.5 text-purple" />Laws by Scope
                </div>
                <div className="space-y-3">
                  {SCOPES.filter((s) => (data.byScope[s] ?? 0) > 0).map((scope, i) => {
                    const count = data.byScope[scope] ?? 0
                    const barWidth = maxByScope > 0 ? (count / maxByScope) * 100 : 0
                    const sColor = SCOPE_COLORS[scope]
                    const ScopeIcon = SCOPE_ICONS[scope]
                    return (
                      <div key={scope}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={cn('flex items-center gap-1.5 text-sm font-medium', sColor.text)}>
                            <ScopeIcon className="h-3.5 w-3.5" />
                            {scope}
                          </span>
                          <span className="text-xs font-mono text-surface-500">{count} law{count !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ duration: 0.6, delay: 0.35 + i * 0.07, ease: 'easeOut' }}
                            className={cn('absolute inset-y-0 left-0 rounded-full', sColor.bar)}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>

              {/* Category breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.3 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5">
                  <BarChart2 className="h-3.5 w-3.5 text-emerald" />Laws by Category
                </div>
                <div className="space-y-3">
                  {CATEGORIES.filter((c) => (data.byCategory[c] ?? 0) > 0)
                    .sort((a, b) => (data.byCategory[b] ?? 0) - (data.byCategory[a] ?? 0))
                    .map((cat, i) => {
                      const count = data.byCategory[cat] ?? 0
                      const barWidth = maxByCat > 0 ? (count / maxByCat) * 100 : 0
                      const barColor = CAT_COLORS[cat] ?? 'bg-surface-400'
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-white font-medium">{cat}</span>
                            <span className="text-xs font-mono text-surface-500">{count}</span>
                          </div>
                          <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.6, delay: 0.4 + i * 0.05, ease: 'easeOut' }}
                              className={cn('absolute inset-y-0 left-0 rounded-full', barColor)}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </motion.div>

              {/* Law browser */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.35 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
              >
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-b border-surface-300">
                  <Filter className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => { setScopeFilter('All'); setShowAll(false) }}
                      className={cn('text-[11px] font-mono px-2 py-0.5 rounded-full transition-colors', scopeFilter === 'All' ? 'bg-surface-300 text-white' : 'text-surface-500 hover:text-white')}
                    >
                      All scopes
                    </button>
                    {SCOPES.filter((s) => (data.byScope[s] ?? 0) > 0).map((s) => {
                      const sColor = SCOPE_COLORS[s]
                      return (
                        <button
                          key={s}
                          onClick={() => { setScopeFilter(s); setShowAll(false) }}
                          className={cn(
                            'text-[11px] font-mono px-2 py-0.5 rounded-full border transition-colors',
                            scopeFilter === s ? `${sColor.text} ${sColor.bg} ${sColor.border}` : 'text-surface-500 border-transparent hover:text-white',
                          )}
                        >
                          {s}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => { setCatFilter('All'); setShowAll(false) }}
                      className={cn('text-[11px] font-mono px-2 py-0.5 rounded-full transition-colors', catFilter === 'All' ? 'bg-surface-300 text-white' : 'text-surface-500 hover:text-white')}
                    >
                      All topics
                    </button>
                    {CATEGORIES.filter((c) => (data.byCategory[c] ?? 0) > 0).map((c) => (
                      <button
                        key={c}
                        onClick={() => { setCatFilter(c); setShowAll(false) }}
                        className={cn('text-[11px] font-mono px-2 py-0.5 rounded-full transition-colors', catFilter === c ? 'bg-surface-300 text-white' : 'text-surface-500 hover:text-white')}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="ml-auto text-[11px] font-mono text-surface-500">
                    {filteredLaws.length} law{filteredLaws.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Law list */}
                {filteredLaws.length === 0 ? (
                  <div className="py-12">
                    <EmptyState
                      icon={Gavel}
                      title="No laws match"
                      description="Try changing your scope or category filter."
                    />
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-surface-300/60">
                      {visibleLaws.map((law) => (
                        <LawCard key={law.id} law={law} />
                      ))}
                    </div>
                    {filteredLaws.length > SHOW_INITIAL && (
                      <button
                        onClick={() => setShowAll((v) => !v)}
                        className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-mono text-surface-500 hover:text-white transition-colors border-t border-surface-300/60"
                      >
                        {showAll
                          ? 'Show fewer'
                          : `Show all ${filteredLaws.length} laws`}
                        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showAll && 'rotate-90')} />
                      </button>
                    )}
                  </>
                )}
              </motion.div>

              {/* Footer links */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.4 }}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-surface-500 pt-2"
              >
                <Link href="/analytics/laws" className="flex items-center gap-1 hover:text-gold transition-colors">
                  <Star className="h-3.5 w-3.5 text-gold" />
                  My Law Analytics
                </Link>
                <Link href="/verdicts" className="flex items-center gap-1 hover:text-white transition-colors">
                  <Scale className="h-3.5 w-3.5" />
                  Verdicts
                </Link>
                <Link href="/trending" className="flex items-center gap-1 hover:text-white transition-colors">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Trending Topics
                </Link>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* No data */}
        {!loading && !data && !error && (
          <EmptyState
            icon={Gavel}
            title="No laws found"
            description="No consensus laws have been established yet."
          />
        )}
      </main>
      <BottomNav />
    </div>
  )
}
