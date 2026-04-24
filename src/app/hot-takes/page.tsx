'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ChevronDown,
  Flame,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { HotTake, HotTakesResponse } from '@/app/api/hot-takes/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 10_000
const MAX_ITEMS = 120

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const SIDES = [
  { id: 'all',     label: 'All Stances' },
  { id: 'for',     label: 'FOR',         color: 'text-for-400' },
  { id: 'against', label: 'AGAINST',     color: 'text-against-400' },
] as const

type SideFilter = 'all' | 'for' | 'against'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

// ─── HotTakeCard ─────────────────────────────────────────────────────────────

function HotTakeCard({ take, isNew }: { take: HotTake; isNew: boolean }) {
  const isFor = take.side === 'blue'
  const Icon = isFor ? ThumbsUp : ThumbsDown

  return (
    <motion.article
      layout
      initial={isNew ? { opacity: 0, y: -12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'rounded-xl border transition-colors',
        isFor
          ? 'bg-for-900/30 border-for-700/30 hover:border-for-600/50'
          : 'bg-against-900/30 border-against-700/30 hover:border-against-600/50',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
        {/* Avatar */}
        {take.voter ? (
          <Link href={`/profile/${take.voter.username}`} className="flex-shrink-0 mt-0.5">
            <Avatar
              src={take.voter.avatar_url}
              fallback={take.voter.display_name || take.voter.username}
              size="sm"
            />
          </Link>
        ) : (
          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-surface-300" />
        )}

        {/* Name + stance + time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {take.voter ? (
              <Link
                href={`/profile/${take.voter.username}`}
                className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
              >
                {take.voter.display_name || take.voter.username}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-surface-500">Anonymous</span>
            )}
            {take.voter && (
              <span className="text-[11px] text-surface-500 font-mono truncate">
                @{take.voter.username}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11px] font-mono font-bold tracking-wide',
                isFor ? 'text-for-400' : 'text-against-400',
              )}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            <span className="text-surface-600 text-[11px]">·</span>
            <span className="text-surface-500 text-[11px]">{relativeTime(take.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Quote */}
      <div
        className={cn(
          'mx-4 mb-3 px-3 py-2 rounded-lg text-sm leading-relaxed font-mono',
          isFor
            ? 'bg-for-800/40 text-for-200 border border-for-700/20'
            : 'bg-against-800/40 text-against-200 border border-against-700/20',
        )}
      >
        <MessageSquare
          className={cn(
            'h-3 w-3 inline-block mr-1.5 mb-0.5 opacity-60',
            isFor ? 'text-for-400' : 'text-against-400',
          )}
          aria-hidden="true"
        />
        &ldquo;{take.reason}&rdquo;
      </div>

      {/* Topic link */}
      {take.topic && (
        <Link
          href={`/topic/${take.topic.id}`}
          className={cn(
            'mx-4 mb-3.5 flex items-start gap-2 rounded-lg px-3 py-2',
            'bg-surface-200/60 border border-surface-300/40 hover:border-surface-400/60 transition-colors',
          )}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-surface-500 font-mono mb-0.5">on</p>
            <p className="text-xs text-surface-700 line-clamp-2 leading-snug">
              {take.topic.statement}
            </p>
          </div>
          {take.topic.category && (
            <Badge variant="proposed" className="flex-shrink-0 self-start mt-0.5 text-[10px]">
              {take.topic.category}
            </Badge>
          )}
        </Link>
      )}
    </motion.article>
  )
}

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-surface-300/30 bg-surface-200/30 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28 rounded" />
          <Skeleton className="h-2.5 w-16 rounded" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HotTakesPage() {
  const [takes, setTakes] = useState<HotTake[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [side, setSide] = useState<SideFilter>('all')
  const [category, setCategory] = useState('All')
  const [paused, setPaused] = useState(false)
  const [showCatMenu, setShowCatMenu] = useState(false)
  const newestAtRef = useRef<string | null>(null)
  const catMenuRef = useRef<HTMLDivElement>(null)

  const fetchTakes = useCallback(
    async (isSince = false) => {
      try {
        const params = new URLSearchParams({ limit: '40', side })
        if (category !== 'All') params.set('category', category)
        if (isSince && newestAtRef.current) params.set('since', newestAtRef.current)

        const res = await fetch(`/api/hot-takes?${params}`)
        if (!res.ok) throw new Error(await res.text())
        const data: HotTakesResponse = await res.json()

        if (isSince && data.takes.length > 0) {
          setNewIds(new Set(data.takes.map((t) => t.id)))
          setTakes((prev) => {
            const combined = [...data.takes, ...prev]
            // deduplicate
            const seen = new Set<string>()
            return combined.filter((t) => {
              if (seen.has(t.id)) return false
              seen.add(t.id)
              return true
            }).slice(0, MAX_ITEMS)
          })
          if (data.newest_at) newestAtRef.current = data.newest_at
        } else if (!isSince) {
          setTakes(data.takes)
          if (data.newest_at) newestAtRef.current = data.newest_at
        }
      } catch (err) {
        if (!isSince) setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!isSince) setLoading(false)
      }
    },
    [side, category],
  )

  // Initial load and when filters change
  useEffect(() => {
    setLoading(true)
    setError(null)
    newestAtRef.current = null
    fetchTakes(false)
  }, [fetchTakes])

  // Poll for new takes
  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => fetchTakes(true), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [paused, fetchTakes])

  // Fade new-item highlights after 3s
  useEffect(() => {
    if (newIds.size === 0) return
    const t = setTimeout(() => setNewIds(new Set()), 3000)
    return () => clearTimeout(t)
  }, [newIds])

  // Close category dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (catMenuRef.current && !catMenuRef.current.contains(e.target as Node)) {
        setShowCatMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-2xl mx-auto px-4 pt-6">

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-5 w-5 text-against-400" aria-hidden="true" />
                <h1 className="text-xl font-bold text-white tracking-tight">Hot Takes</h1>
              </div>
              <p className="text-sm text-surface-500">
                What people actually think — in their own words
              </p>
            </div>

            {/* Live / Pause toggle */}
            <button
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Resume live feed' : 'Pause live feed'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                paused
                  ? 'bg-surface-200 border-surface-400 text-surface-700'
                  : 'bg-against-500/10 border-against-500/30 text-against-400 animate-pulse',
              )}
            >
              {paused ? (
                <>
                  <Play className="h-3 w-3" aria-hidden="true" />
                  PAUSED
                </>
              ) : (
                <>
                  <Activity className="h-3 w-3" aria-hidden="true" />
                  LIVE
                </>
              )}
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {/* Side filter */}
            <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-1">
              {SIDES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSide(s.id as SideFilter)}
                  aria-pressed={side === s.id}
                  className={cn(
                    'px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all',
                    side === s.id
                      ? 'bg-surface-300 text-white shadow-sm'
                      : 'text-surface-500 hover:text-surface-700',
                    side === s.id && 'color' in s && s.color,
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Category dropdown */}
            <div className="relative" ref={catMenuRef}>
              <button
                onClick={() => setShowCatMenu((v) => !v)}
                aria-expanded={showCatMenu}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300/60 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-all"
              >
                {category}
                <ChevronDown
                  className={cn('h-3 w-3 transition-transform', showCatMenu && 'rotate-180')}
                  aria-hidden="true"
                />
              </button>
              <AnimatePresence>
                {showCatMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full mt-1 z-40 bg-surface-200 border border-surface-300 rounded-xl shadow-xl overflow-hidden min-w-[140px]"
                  >
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setCategory(cat); setShowCatMenu(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                          cat === category
                            ? 'bg-surface-300 text-white'
                            : 'text-surface-500 hover:bg-surface-300 hover:text-white',
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Refresh */}
            <button
              onClick={() => { newestAtRef.current = null; setLoading(true); fetchTakes(false) }}
              aria-label="Refresh hot takes"
              className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <div className="text-center py-16 text-surface-500 text-sm">
              {error}
            </div>
          ) : takes.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No hot takes yet"
              description={
                side !== 'all' || category !== 'All'
                  ? 'Try changing the filters to see more takes.'
                  : 'Be the first — cast a vote and share your hot take.'
              }
              actions={[{ label: 'Back to feed', href: '/' }]}
            />
          ) : (
            <div className="space-y-3">
              {/* New items banner */}
              <AnimatePresence>
                {newIds.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center justify-center gap-2 py-2 text-xs font-mono text-for-400"
                  >
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    {newIds.size} new take{newIds.size !== 1 ? 's' : ''}
                  </motion.div>
                )}
              </AnimatePresence>

              {takes.map((take) => (
                <HotTakeCard
                  key={take.id}
                  take={take}
                  isNew={newIds.has(take.id)}
                />
              ))}

              {takes.length >= MAX_ITEMS && (
                <p className="text-center text-xs text-surface-600 py-4 font-mono">
                  Showing the {MAX_ITEMS} most recent hot takes
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
