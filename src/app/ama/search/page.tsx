'use client'

/**
 * /ama/search — Search across AMA sessions and expert Q&A pairs.
 * Lets users find past expert answers by keyword, category, or topic.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Mic,
  Music2,
  Radio,
  Scale,
  Search,
  ThumbsUp,
  TrendingUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AMASearchQA, AMASearchResponse, AMASearchSession } from '@/app/api/ama/search/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Law',
  'Education', 'Health', 'Environment', 'Culture', 'International',
]

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics: TrendingUp,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Law: Scale,
  Education: GraduationCap,
  Health: Heart,
  Environment: Leaf,
  Culture: Music2,
  International: TrendingUp,
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-for-400',
  Politics: 'text-against-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Law: 'text-gold',
  Education: 'text-for-300',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Culture: 'text-purple',
  International: 'text-for-400',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-for-500/30 text-for-200 rounded px-0.5">{part}</mark>
    ) : (
      part
    )
  )
}

function statusLabel(status: string): { label: string; icon: React.ComponentType<{ className?: string }>; color: string } {
  switch (status) {
    case 'live': return { label: 'Live', icon: Radio, color: 'text-for-400' }
    case 'upcoming': return { label: 'Upcoming', icon: Calendar, color: 'text-gold' }
    default: return { label: 'Ended', icon: Clock, color: 'text-surface-500' }
  }
}

// ─── Session result card ──────────────────────────────────────────────────────

function SessionResultCard({ session, query }: { session: AMASearchSession; query: string }) {
  const CategoryIcon = session.category ? (CATEGORY_ICONS[session.category] ?? Mic) : Mic
  const catColor = session.category ? (CATEGORY_COLORS[session.category] ?? 'text-surface-400') : 'text-surface-400'
  const { label: statusLbl, icon: StatusIcon, color: statusColor } = statusLabel(session.status)

  return (
    <Link
      href={`/ama/${session.id}`}
      className={cn(
        'group block rounded-2xl border bg-surface-100 border-surface-300',
        'hover:border-surface-400/60 transition-colors p-4'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {session.category && (
          <>
            <CategoryIcon className={cn('h-3.5 w-3.5 flex-shrink-0', catColor)} />
            <span className={cn('text-xs font-mono font-semibold', catColor)}>{session.category}</span>
          </>
        )}
        <span className={cn('flex items-center gap-1 text-xs font-mono ml-auto', statusColor)}>
          <StatusIcon className="h-3 w-3" />
          {statusLbl}
        </span>
      </div>

      <h3 className="font-mono text-sm font-semibold text-white leading-snug mb-2 group-hover:text-for-200 transition-colors">
        {highlight(session.title, query)}
      </h3>

      {session.description && (
        <p className="text-xs text-surface-500 leading-relaxed mb-3 line-clamp-2">
          {highlight(session.description, query)}
        </p>
      )}

      <div className="flex items-center gap-3">
        {session.host && (
          <div className="flex items-center gap-1.5">
            <Avatar src={session.host.avatar_url} fallback={session.host.display_name || session.host.username} size="xs" />
            <span className="text-xs font-mono text-surface-400">{session.host.display_name || session.host.username}</span>
          </div>
        )}
        <span className="flex items-center gap-1 text-xs font-mono text-surface-600 ml-auto">
          <MessageSquare className="h-3 w-3" />
          {session.question_count} q
        </span>
        <span className="flex items-center gap-1 text-xs font-mono text-surface-600">
          <ThumbsUp className="h-3 w-3" />
          {session.answer_count} answered
        </span>
      </div>
    </Link>
  )
}

// ─── Q&A result card ──────────────────────────────────────────────────────────

function QAResultCard({ qa, query }: { qa: AMASearchQA; query: string }) {
  const [expanded, setExpanded] = useState(false)
  const CategoryIcon = qa.session_category ? (CATEGORY_ICONS[qa.session_category] ?? Mic) : Mic
  const catColor = qa.session_category ? (CATEGORY_COLORS[qa.session_category] ?? 'text-surface-400') : 'text-surface-400'
  const isLongAnswer = qa.answer_content.length > 280

  return (
    <div className="rounded-2xl border bg-surface-100 border-surface-300 overflow-hidden">
      {/* Session context */}
      <Link
        href={`/ama/${qa.session_id}`}
        className="flex items-center gap-2 px-4 py-2 bg-surface-200/50 border-b border-surface-300 hover:bg-surface-200 transition-colors"
      >
        <CategoryIcon className={cn('h-3 w-3 flex-shrink-0', catColor)} />
        <span className={cn('text-[11px] font-mono font-semibold truncate', catColor)}>
          {qa.session_category}
        </span>
        <span className="text-[11px] font-mono text-surface-500 truncate">
          · {qa.session_title}
        </span>
        {qa.host && (
          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            <Avatar src={qa.host.avatar_url} fallback={qa.host.display_name || qa.host.username} size="xs" />
            <span className="text-[11px] font-mono text-surface-400">{qa.host.display_name || qa.host.username}</span>
          </div>
        )}
      </Link>

      <div className="p-4 space-y-3">
        {/* Question */}
        <div className="flex items-start gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-surface-500 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-surface-300 leading-relaxed">
              {highlight(qa.question_content, query)}
            </p>
            {qa.question_upvotes > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-for-400 mt-1">
                <ThumbsUp className="h-3 w-3" />
                {qa.question_upvotes}
              </span>
            )}
          </div>
        </div>

        {/* Answer */}
        <div className="flex items-start gap-2">
          <Mic className="h-3.5 w-3.5 text-for-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm text-white leading-relaxed', !expanded && isLongAnswer && 'line-clamp-4')}>
              {highlight(qa.answer_content, query)}
            </p>
            {isLongAnswer && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="text-xs font-mono text-for-400 hover:text-for-200 transition-colors mt-1"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ResultSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AMASearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialQuery = searchParams.get('q') ?? ''
  const initialCategory = searchParams.get('category') ?? ''

  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState(initialCategory)
  const [results, setResults] = useState<AMASearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string, cat: string) => {
    if (q.trim().length < 2) {
      setResults(null)
      setSearched(false)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: q.trim(), limit: '20' })
      if (cat) params.set('category', cat)
      const res = await fetch(`/api/ama/search?${params}`)
      if (res.ok) {
        const data = await res.json() as AMASearchResponse
        setResults(data)
        setSearched(true)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced search on input change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void doSearch(query, category)
      // Update URL without navigation
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (category) params.set('category', category)
      router.replace(`/ama/search?${params}`, { scroll: false })
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, category, doSearch, router])

  // Initial search if URL has query
  useEffect(() => {
    if (initialQuery.length >= 2) {
      void doSearch(initialQuery, initialCategory)
    }
    inputRef.current?.focus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const hasResults = results && (results.sessions.length > 0 || results.qas.length > 0)
  const isEmpty = searched && !loading && !hasResults

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/ama"
            className="p-2 rounded-xl text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Back to AMA sessions"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
              <Search className="h-4 w-4 text-for-400" />
              Search AMA Archive
            </h1>
            <p className="text-xs text-surface-500 font-mono">Find expert answers across all sessions</p>
          </div>
        </div>

        {/* Search input */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions, answers, sessions…"
            className={cn(
              'w-full bg-surface-100 border border-surface-300 rounded-xl',
              'pl-10 pr-10 py-3 text-sm text-white placeholder:text-surface-500',
              'focus:outline-none focus:border-for-500/60 transition-colors font-mono'
            )}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-6 scrollbar-none">
          <button
            onClick={() => setCategory('')}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
              !category
                ? 'bg-surface-200 text-white'
                : 'text-surface-500 hover:text-surface-300 hover:bg-surface-100'
            )}
          >
            All
          </button>
          {CATEGORIES.map((cat) => {
            const CatIcon = CATEGORY_ICONS[cat] ?? Mic
            const catColor = CATEGORY_COLORS[cat] ?? 'text-surface-500'
            return (
              <button
                key={cat}
                onClick={() => setCategory(category === cat ? '' : cat)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                  category === cat
                    ? 'bg-surface-200 text-white'
                    : 'text-surface-500 hover:text-surface-300 hover:bg-surface-100'
                )}
              >
                <CatIcon className={cn('h-3 w-3', category === cat ? 'text-white' : catColor)} />
                {cat}
              </button>
            )
          })}
        </div>

        {/* Results */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {[0, 1, 2].map((i) => <ResultSkeleton key={i} />)}
            </motion.div>

          ) : isEmpty ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={Search}
                iconColor="text-surface-500"
                iconBg="bg-surface-200"
                iconBorder="border-surface-300"
                title={`No results for "${query}"`}
                description={
                  category
                    ? `No expert answers found in ${category} matching that query. Try a broader search or remove the category filter.`
                    : 'No sessions or expert answers matched your search. Try different keywords.'
                }
              />
            </motion.div>

          ) : !searched && !loading ? (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center py-16 space-y-3">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-100 border border-surface-300 mb-2">
                  <Search className="h-6 w-6 text-surface-500" />
                </div>
                <p className="font-mono text-surface-400 text-sm">Search expert AMA answers</p>
                <p className="font-mono text-surface-600 text-xs max-w-xs mx-auto">
                  Find what civic experts have said about economics, law, technology, and more.
                </p>
              </div>
            </motion.div>

          ) : hasResults ? (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">

              {/* Sessions section */}
              {results!.sessions.length > 0 && (
                <section>
                  <h2 className="font-mono text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                    Sessions · {results!.sessions.length}
                  </h2>
                  <div className="space-y-2">
                    {results!.sessions.map((s) => (
                      <SessionResultCard key={s.id} session={s} query={query} />
                    ))}
                  </div>
                </section>
              )}

              {/* Q&A section */}
              {results!.qas.length > 0 && (
                <section>
                  <h2 className="font-mono text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                    Expert Answers · {results!.qas.length}
                  </h2>
                  <div className="space-y-3">
                    {results!.qas.map((qa) => (
                      <QAResultCard key={qa.answer_id} qa={qa} query={query} />
                    ))}
                  </div>
                </section>
              )}

              {/* Total */}
              <p className="text-center text-xs font-mono text-surface-600 pt-2">
                {results!.total} result{results!.total === 1 ? '' : 's'} for &ldquo;{query}&rdquo;
                {category ? ` in ${category}` : ''}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

      </main>

      <BottomNav />
    </div>
  )
}
