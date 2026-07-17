'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Clock,
  Gavel,
  Hash,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LibraryResponse, LibraryWikiEntry, LibraryArgument, LibraryLaw } from '@/app/api/library/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

type Section = 'all' | 'wikis' | 'arguments' | 'laws'

const SECTION_TABS: { id: Section; label: string; icon: typeof BookOpen }[] = [
  { id: 'all', label: 'All', icon: BookOpen },
  { id: 'wikis', label: 'Wikis', icon: BookOpen },
  { id: 'arguments', label: 'Arguments', icon: MessageSquare },
  { id: 'laws', label: 'Laws', icon: Gavel },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const wk = Math.floor(d / 7)
  const mo = Math.floor(d / 30)
  const yr = Math.floor(d / 365)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (wk < 4) return `${wk}w ago`
  if (mo < 12) return `${mo}mo ago`
  return `${yr}y ago`
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('en-US')
}

function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 200))
}

// ─── Wiki card ────────────────────────────────────────────────────────────────

function WikiCard({ entry }: { entry: LibraryWikiEntry }) {
  const mins = readingMinutes(entry.wordCount)
  const forPct = Math.round(entry.bluePct)
  const isLaw = entry.status === 'law'

  // Show a short excerpt from wiki (first 200 chars, strip markdown)
  const excerpt = entry.wiki
    .replace(/#+\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
    .slice(0, 200)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all duration-200 overflow-hidden"
    >
      <Link href={`/topic/${entry.topicId}`} className="block p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {entry.category && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500 px-2 py-0.5 rounded-full border border-surface-400/40">
                {entry.category}
              </span>
            )}
            {isLaw && (
              <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-gold px-2 py-0.5 rounded-full border border-gold/30 bg-gold/5">
                <Gavel className="h-2.5 w-2.5" aria-hidden />
                Law
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-600 flex-shrink-0">
            <Clock className="h-3 w-3" aria-hidden />
            {mins} min read
          </div>
        </div>

        {/* Statement */}
        <h3 className="text-white font-semibold text-sm leading-snug mb-2 group-hover:text-for-300 transition-colors line-clamp-2">
          {entry.statement}
        </h3>

        {/* Excerpt */}
        {excerpt && (
          <p className="text-surface-400 text-xs font-mono leading-relaxed line-clamp-3 mb-3">
            {excerpt}
            {entry.wiki.length > 200 ? '…' : ''}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-300/60">
          <div className="flex items-center gap-3">
            {/* Mini vote bar */}
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full overflow-hidden bg-surface-300">
                <div
                  className="h-full bg-for-500 rounded-full transition-all"
                  style={{ width: `${forPct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-surface-500 tabular-nums">{forPct}% for</span>
            </div>
            <span className="text-[10px] font-mono text-surface-600">
              {fmtNum(entry.totalVotes)} votes
            </span>
          </div>
          <span className="text-[10px] font-mono text-surface-600 flex items-center gap-1">
            <Hash className="h-2.5 w-2.5" aria-hidden />
            {fmtNum(entry.wordCount)} words
          </span>
        </div>
      </Link>

      {/* Read wiki CTA */}
      <div className="px-5 pb-4">
        <Link
          href={`/topic/${entry.topicId}`}
          className={cn(
            'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-mono font-medium',
            'bg-surface-200/60 border border-surface-300 text-surface-400',
            'hover:bg-surface-200 hover:text-white hover:border-surface-400 transition-all duration-150',
            'group/btn'
          )}
        >
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 group-hover/btn:text-for-400 transition-colors" aria-hidden />
            Read full wiki
          </span>
          <ArrowRight className="h-3 w-3 text-surface-600 group-hover/btn:text-white transition-colors" aria-hidden />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: LibraryArgument }) {
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 transition-all duration-200',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40'
      )}
    >
      {/* Side badge + vote count */}
      <div className="flex items-center justify-between mb-3">
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider',
            isFor
              ? 'bg-for-600/20 text-for-300 border border-for-500/30'
              : 'bg-against-600/20 text-against-300 border border-against-500/30'
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-2.5 w-2.5" aria-hidden />
          ) : (
            <ThumbsDown className="h-2.5 w-2.5" aria-hidden />
          )}
          {isFor ? 'For' : 'Against'}
        </div>
        <div className="flex items-center gap-1 text-xs font-mono text-surface-500">
          <ThumbsUp className="h-3 w-3 text-gold" aria-hidden />
          <span className="tabular-nums text-gold font-semibold">{fmtNum(arg.upvotes)}</span>
          <span className="text-surface-600">upvotes</span>
        </div>
      </div>

      {/* Content */}
      <p className="text-white text-sm font-mono leading-relaxed line-clamp-4 mb-4">
        &ldquo;{arg.content}&rdquo;
      </p>

      {/* Topic link */}
      <Link
        href={`/topic/${arg.topicId}`}
        className="block mb-3 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors line-clamp-1"
      >
        On: <span className="underline underline-offset-2">{arg.topicStatement}</span>
      </Link>

      {/* Author + time */}
      <div className="flex items-center justify-between pt-3 border-t border-surface-300/40">
        {arg.authorUsername ? (
          <Link
            href={`/profile/${arg.authorUsername}`}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={arg.authorAvatarUrl}
              fallback={arg.authorDisplayName || arg.authorUsername}
              size="xs"
            />
            <span className="text-[11px] font-mono text-surface-400">
              {arg.authorDisplayName || `@${arg.authorUsername}`}
            </span>
          </Link>
        ) : (
          <span className="text-[11px] font-mono text-surface-600">Anonymous</span>
        )}
        <span className="text-[11px] font-mono text-surface-600">{relTime(arg.createdAt)}</span>
      </div>
    </motion.div>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law }: { law: LibraryLaw }) {
  const forPct = Math.round(law.bluePct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-gold/5 border border-gold/20 hover:border-gold/40 transition-all duration-200 overflow-hidden"
    >
      <Link href={`/topic/${law.topicId}`} className="block p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-widest text-gold px-2 py-0.5 rounded-full border border-gold/40 bg-gold/10">
              <Gavel className="h-2.5 w-2.5" aria-hidden />
              Established Law
            </span>
            {law.lawCode && (
              <span className="text-[10px] font-mono text-surface-600">{law.lawCode}</span>
            )}
          </div>
          {law.scope && (
            <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">{law.scope}</span>
          )}
        </div>

        {/* Statement */}
        <h3 className="text-white font-semibold text-sm leading-snug mb-3 line-clamp-3">
          {law.statement}
        </h3>

        {/* Stats */}
        <div className="flex items-center gap-4 text-[11px] font-mono text-surface-500">
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1.5 rounded-full overflow-hidden bg-surface-300">
              <div
                className="h-full bg-for-500 rounded-full"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <span className="tabular-nums">{forPct}%</span>
          </div>
          <span>{fmtNum(law.totalVotes)} votes</span>
          {law.category && <span className="text-surface-600">{law.category}</span>}
        </div>

        {/* Established date */}
        <div className="flex items-center gap-1 mt-3 text-[10px] font-mono text-surface-600">
          <Scale className="h-2.5 w-2.5" aria-hidden />
          Established {relTime(law.establishedAt ?? '')}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function WikiSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex items-center justify-between pt-2 border-t border-surface-300/60">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

function ArgSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-16 rounded-lg" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-48" />
      <div className="flex items-center justify-between pt-3 border-t border-surface-300/40">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

function LawSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <div className="flex items-center gap-4 mt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LibraryClient() {
  const [data, setData] = useState<LibraryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [section, setSection] = useState<Section>('all')
  const [category, setCategory] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(query), 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ section })
      if (category) params.set('category', category)
      if (debouncedQ) params.set('q', debouncedQ)
      const res = await fetch(`/api/library?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [section, category, debouncedQ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const showWikis = section === 'all' || section === 'wikis'
  const showArgs = section === 'all' || section === 'arguments'
  const showLaws = section === 'all' || section === 'laws'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-600/20 border border-for-600/30">
              <BookOpen className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <h1 className="text-2xl font-bold text-white font-mono tracking-tight">
              Civic Library
            </h1>
          </div>
          <p className="text-surface-400 text-sm font-mono pl-12">
            The best wikis, arguments, and laws — curated for depth
          </p>

          {/* Platform stats */}
          {data?.stats && (
            <div className="flex items-center gap-4 mt-3 pl-12">
              {[
                { label: 'wiki articles', value: data.stats.totalWikis, icon: BookOpen, color: 'text-for-400' },
                { label: 'top arguments', value: data.stats.totalArguments, icon: MessageSquare, color: 'text-purple' },
                { label: 'established laws', value: data.stats.totalLaws, icon: Gavel, color: 'text-gold' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <Icon className={cn('h-3 w-3', color)} aria-hidden />
                  <span className={cn('text-xs font-mono font-bold', color)}>{fmtNum(value)}</span>
                  <span className="text-[11px] font-mono text-surface-600">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Search bar ──────────────────────────────────────────────────── */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search topics, arguments, or laws…"
            aria-label="Search library"
            className={cn(
              'w-full pl-10 pr-10 py-2.5 rounded-xl',
              'bg-surface-200 border border-surface-300',
              'text-white text-sm font-mono placeholder:text-surface-600',
              'focus:outline-none focus:ring-2 focus:ring-for-500/30 focus:border-for-500/40',
              'transition-colors'
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── Section tabs ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-4 bg-surface-200/80 border border-surface-300 rounded-xl p-1 w-fit">
          {SECTION_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              aria-pressed={section === id}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all duration-150',
                section === id
                  ? 'bg-for-600 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <Icon className="h-3 w-3" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {/* ── Category filter pills ─────────────────────────────────────────── */}
        <div
          className="flex items-center gap-1.5 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          aria-label="Filter by category"
        >
          <button
            onClick={() => setCategory(null)}
            aria-pressed={category === null}
            className={cn(
              'flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-all duration-150',
              category === null
                ? 'bg-surface-400 text-white border-surface-400'
                : 'text-surface-500 border-surface-500/40 hover:text-surface-300 hover:border-surface-400'
            )}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(category === cat ? null : cat)}
              aria-pressed={category === cat}
              className={cn(
                'flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border transition-all duration-150',
                category === cat
                  ? 'bg-for-600/80 text-white border-for-600'
                  : 'text-surface-500 border-surface-500/40 hover:text-surface-300 hover:border-surface-400'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Error state ───────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-6">
            <EmptyState
              icon={BookOpen}
              title="Couldn't load the library"
              description="Something went wrong. Try refreshing."
              action={{
                label: 'Retry',
                onClick: fetchData,
                icon: RefreshCw,
              }}
            />
          </div>
        )}

        {/* ── Content sections ──────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {!error && (
            <motion.div
              key={`${section}-${category}-${debouncedQ}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-10"
            >
              {/* ── Wiki articles ─────────────────────────────────────────── */}
              {showWikis && (
                <section aria-labelledby="wikis-heading">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-for-600/20 border border-for-600/30">
                        <BookOpen className="h-3.5 w-3.5 text-for-400" aria-hidden />
                      </div>
                      <h2 id="wikis-heading" className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                        Wiki Articles
                      </h2>
                    </div>
                    <Link
                      href="/topic/categories"
                      className="text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors flex items-center gap-1"
                    >
                      Browse all
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => <WikiSkeleton key={i} />)}
                    </div>
                  ) : data && data.wikis.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {data.wikis.map((entry) => (
                        <WikiCard key={entry.topicId} entry={entry} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={BookOpen}
                      title="No wiki articles found"
                      description={
                        debouncedQ
                          ? `No results for "${debouncedQ}"`
                          : 'No topics with rich wiki content yet.'
                      }
                    />
                  )}
                </section>
              )}

              {/* ── Top arguments ─────────────────────────────────────────── */}
              {showArgs && (
                <section aria-labelledby="args-heading">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-purple/20 border border-purple/30">
                        <MessageSquare className="h-3.5 w-3.5 text-purple" aria-hidden />
                      </div>
                      <h2 id="args-heading" className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                        Standout Arguments
                      </h2>
                    </div>
                    <Link
                      href="/top-arguments"
                      className="text-[11px] font-mono text-surface-500 hover:text-purple transition-colors flex items-center gap-1"
                    >
                      See more
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => <ArgSkeleton key={i} />)}
                    </div>
                  ) : data && data.arguments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {data.arguments.map((arg) => (
                        <ArgumentCard key={arg.id} arg={arg} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={MessageSquare}
                      title="No top arguments found"
                      description={
                        debouncedQ
                          ? `No arguments matching "${debouncedQ}"`
                          : 'No upvoted arguments yet.'
                      }
                    />
                  )}
                </section>
              )}

              {/* ── Established laws ──────────────────────────────────────── */}
              {showLaws && (
                <section aria-labelledby="laws-heading">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gold/20 border border-gold/30">
                        <Gavel className="h-3.5 w-3.5 text-gold" aria-hidden />
                      </div>
                      <h2 id="laws-heading" className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                        Established Laws
                      </h2>
                    </div>
                    <Link
                      href="/laws"
                      className="text-[11px] font-mono text-surface-500 hover:text-gold transition-colors flex items-center gap-1"
                    >
                      Full codex
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => <LawSkeleton key={i} />)}
                    </div>
                  ) : data && data.laws.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {data.laws.map((law) => (
                        <LawCard key={law.topicId} law={law} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Gavel}
                      title="No established laws found"
                      description={
                        debouncedQ
                          ? `No laws matching "${debouncedQ}"`
                          : 'No laws have been established yet.'
                      }
                    />
                  )}
                </section>
              )}

              {/* ── Explore more CTA ──────────────────────────────────────── */}
              {!loading && !error && (
                <div className="flex flex-col sm:flex-row items-center gap-3 rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-white font-semibold text-sm font-mono">
                      Want to contribute?
                    </p>
                    <p className="text-surface-400 text-xs font-mono mt-0.5">
                      Write a wiki, post a standout argument, or propose a new topic.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/topic/create"
                      className={cn(
                        'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-mono font-semibold',
                        'bg-for-600 text-white hover:bg-for-500 transition-colors'
                      )}
                    >
                      <Zap className="h-3.5 w-3.5" aria-hidden />
                      New Topic
                    </Link>
                    <Link
                      href="/workshop"
                      className={cn(
                        'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-mono font-semibold',
                        'bg-surface-200 border border-surface-300 text-surface-300 hover:bg-surface-300 hover:text-white transition-colors'
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                      Write Argument
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Refresh button ────────────────────────────────────────────────── */}
        <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40">
          <button
            onClick={fetchData}
            disabled={loading}
            aria-label="Refresh library"
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-xl',
              'bg-surface-200/90 border border-surface-300 backdrop-blur-sm',
              'text-surface-400 hover:text-white hover:border-surface-400',
              'transition-all duration-150 shadow-lg',
              loading && 'opacity-50 pointer-events-none'
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
