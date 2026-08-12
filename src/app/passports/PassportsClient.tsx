'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookKey,
  ChevronDown,
  Coins,
  Flame,
  Loader2,
  MessageSquare,
  RefreshCw,
  Star,
  ThumbsUp,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import { ARCHETYPE_CONFIG, ARCHETYPE_IDS, type ArchetypeId } from '@/lib/config/archetypes'
import type { PassportListItem, PassportSortKey, PassportsResponse } from '@/app/api/passports/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: PassportSortKey; label: string; icon: typeof Coins }[] = [
  { key: 'clout',           label: 'Clout',       icon: Coins },
  { key: 'reputation',      label: 'Reputation',  icon: Star },
  { key: 'total_votes',     label: 'Votes',       icon: ThumbsUp },
  { key: 'total_arguments', label: 'Arguments',   icon: MessageSquare },
  { key: 'vote_streak',     label: 'Streak',      icon: Flame },
]

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function archetypeConfig(id: string | null) {
  if (id && id in ARCHETYPE_CONFIG) return ARCHETYPE_CONFIG[id as ArchetypeId]
  return null
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <div className="h-7 bg-surface-300" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

// ─── Passport Mini-Card ───────────────────────────────────────────────────────

function PassportCard({ p, index }: { p: PassportListItem; index: number }) {
  const arch  = archetypeConfig(p.civic_archetype)
  const color = arch?.color       ?? 'text-surface-400'
  const bgTop = arch?.bgColor     ?? 'bg-surface-300/40'
  const bdTop = arch?.borderColor ?? 'border-surface-400/30'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
    >
      <Link href={`/passport/${p.username}`} className="group block">
        <div className={cn(
          'rounded-2xl border overflow-hidden transition-all duration-200',
          'bg-surface-100 border-surface-300',
          'hover:border-surface-400 hover:shadow-lg hover:shadow-black/20',
        )}>
          {/* Archetype colour strip with passport number */}
          <div className={cn(
            'h-8 flex items-center justify-between px-3 border-b',
            bgTop, bdTop,
          )}>
            <span className={cn('text-[10px] font-mono font-bold tracking-[0.2em]', color)}>
              {arch?.name.toUpperCase() ?? 'CITIZEN'}
            </span>
            <span className="text-[10px] font-mono text-surface-600 tracking-wider">
              #{p.passport_number}
            </span>
          </div>

          {/* Body */}
          <div className="p-3.5 space-y-3">
            {/* Identity row */}
            <div className="flex items-center gap-2.5">
              <Avatar
                src={p.avatar_url}
                fallback={p.display_name ?? p.username}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white leading-tight truncate group-hover:text-for-300 transition-colors">
                  {p.display_name ?? p.username}
                </p>
                <p className="text-xs font-mono text-surface-500 truncate">
                  @{p.username}
                </p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-1.5">
              <div className="rounded-lg bg-surface-200/70 border border-surface-300/60 px-2 py-1.5 text-center">
                <p className="text-xs font-mono font-bold text-gold leading-none">
                  {formatNum(p.clout)}
                </p>
                <p className="text-[9px] font-mono text-surface-600 uppercase tracking-wide mt-0.5">
                  Clout
                </p>
              </div>
              <div className="rounded-lg bg-surface-200/70 border border-surface-300/60 px-2 py-1.5 text-center">
                <p className="text-xs font-mono font-bold text-for-300 leading-none">
                  {formatNum(p.total_votes)}
                </p>
                <p className="text-[9px] font-mono text-surface-600 uppercase tracking-wide mt-0.5">
                  Votes
                </p>
              </div>
              <div className="rounded-lg bg-surface-200/70 border border-surface-300/60 px-2 py-1.5 text-center">
                <p className={cn(
                  'text-xs font-mono font-bold leading-none',
                  p.vote_streak >= 7 ? 'text-against-300' : 'text-purple',
                )}>
                  {p.vote_streak}
                </p>
                <p className="text-[9px] font-mono text-surface-600 uppercase tracking-wide mt-0.5">
                  Streak
                </p>
              </div>
            </div>

            {/* View link */}
            <div className="flex items-center justify-end">
              <span className="text-[10px] font-mono text-surface-600 group-hover:text-surface-400 transition-colors flex items-center gap-1">
                View Passport
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 24

export function PassportsClient() {
  const [passports, setPassports] = useState<PassportListItem[]>([])
  const [total, setTotal]         = useState(0)
  const [hasMore, setHasMore]     = useState(false)
  const [loading, setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const [sort, setSort]       = useState<PassportSortKey>('clout')
  const [archetype, setArchetype] = useState<string>('')
  const [showSort, setShowSort]   = useState(false)

  const fetchPage = useCallback(async (
    newSort: PassportSortKey,
    newArchetype: string,
    offset: number,
    append: boolean,
  ) => {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        sort: newSort,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      if (newArchetype) params.set('archetype', newArchetype)

      const res = await fetch(`/api/passports?${params}`)
      if (!res.ok) throw new Error('Failed to load passports')
      const json = (await res.json()) as PassportsResponse

      setPassports(prev => append ? [...prev, ...json.passports] : json.passports)
      setTotal(json.total)
      setHasMore(json.has_more)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchPage(sort, archetype, 0, false)
  }, [sort, archetype, fetchPage])

  function handleSort(key: PassportSortKey) {
    setSort(key)
    setShowSort(false)
  }

  function handleArchetype(id: string) {
    setArchetype(prev => prev === id ? '' : id)
  }

  const activeSortLabel = SORT_OPTIONS.find(o => o.key === sort)?.label ?? 'Clout'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <BookKey className="h-5.5 w-5.5 text-for-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">Civic Passports</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {total > 0 ? `${total.toLocaleString()} registered citizens` : 'Browse registered citizens'}
              </p>
            </div>
          </div>

          {/* Sort dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowSort(s => !s)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-mono font-medium transition-colors',
                showSort
                  ? 'bg-for-500/20 border-for-500/40 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              Sort: {activeSortLabel}
              <ChevronDown className={cn('h-3 w-3 transition-transform', showSort && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showSort && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1.5 z-20 w-44 rounded-xl bg-surface-200 border border-surface-300 shadow-xl overflow-hidden"
                >
                  {SORT_OPTIONS.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => handleSort(key)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-mono transition-colors text-left',
                        sort === key
                          ? 'bg-for-500/20 text-for-300'
                          : 'text-surface-400 hover:bg-surface-300 hover:text-white',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Archetype filter chips */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          <button
            onClick={() => setArchetype('')}
            className={cn(
              'text-xs px-3 py-1 rounded-full border font-mono font-medium transition-colors',
              archetype === ''
                ? 'bg-surface-300 border-surface-400 text-white'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
            )}
          >
            All
          </button>
          {ARCHETYPE_IDS.map(id => {
            const cfg = ARCHETYPE_CONFIG[id]
            const active = archetype === id
            return (
              <button
                key={id}
                onClick={() => handleArchetype(id)}
                className={cn(
                  'text-xs px-3 py-1 rounded-full border font-mono font-medium transition-colors',
                  active
                    ? cn(cfg.bgColor, cfg.borderColor, cfg.color)
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
                )}
              >
                {cfg.name.replace('The ', '')}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-against-900/30 border border-against-700/40 p-8 text-center">
            <p className="text-against-400 text-sm font-mono mb-4">{error}</p>
            <button
              onClick={() => fetchPage(sort, archetype, 0, false)}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : passports.length === 0 ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-12 text-center">
            <BookKey className="h-8 w-8 text-surface-500 mx-auto mb-3" />
            <p className="text-surface-400 text-sm font-mono">
              {archetype
                ? `No ${ARCHETYPE_CONFIG[archetype as ArchetypeId]?.name ?? archetype} citizens yet.`
                : 'No citizens found.'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {passports.map((p, i) => (
                <PassportCard key={p.id} p={p} index={i} />
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => fetchPage(sort, archetype, passports.length, true)}
                  disabled={loadingMore}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-mono font-medium transition-all',
                    'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                    loadingMore && 'opacity-60 pointer-events-none',
                  )}
                >
                  {loadingMore
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
                    : <>Load more · {total - passports.length} remaining</>
                  }
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
