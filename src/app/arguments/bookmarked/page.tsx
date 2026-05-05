'use client'

/**
 * /arguments/bookmarked — Saved Arguments Library
 *
 * A personal reading list of arguments the current user has bookmarked
 * across all topics. Ordered by most-recently-saved, with filter options
 * by side (FOR/AGAINST), category, and status of the parent topic.
 *
 * Acts as the user's civic research library — saved evidence, strong
 * cases they want to revisit or reference when writing their own arguments.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bookmark,
  BookmarkX,
  ChevronRight,
  ExternalLink,
  Gavel,
  Link2,
  Loader2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Zap,
  FileText,
  Tag,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { renderWithMentions } from '@/lib/utils/mentions'
import type {
  BookmarkedArgument,
  BookmarkedArgumentsResponse,
} from '@/app/api/arguments/bookmarked/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

function StatusIcon({ status }: { status: string }) {
  const cls = 'h-3 w-3 flex-shrink-0'
  switch (status) {
    case 'active': return <Zap className={cn(cls, 'text-for-400')} />
    case 'voting': return <Scale className={cn(cls, 'text-purple')} />
    case 'law': return <Gavel className={cn(cls, 'text-emerald')} />
    default: return <FileText className={cn(cls, 'text-surface-500')} />
  }
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  onUnbookmark,
}: {
  arg: BookmarkedArgument
  onUnbookmark: (id: string) => void
}) {
  const isFor = arg.side === 'blue'
  const [removing, setRemoving] = useState(false)

  async function handleUnbookmark(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setRemoving(true)
    try {
      await fetch(`/api/arguments/${arg.id}/bookmark`, { method: 'DELETE' })
      onUnbookmark(arg.id)
    } catch {
      setRemoving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative rounded-2xl border bg-surface-100 p-5 group',
        'transition-colors hover:border-surface-400/60',
        isFor
          ? 'border-for-500/20 hover:border-for-500/35'
          : 'border-against-500/20 hover:border-against-500/35'
      )}
    >
      {/* Side accent bar */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-0.5 rounded-l-2xl',
          isFor ? 'bg-for-500' : 'bg-against-500'
        )}
        aria-hidden
      />

      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        {/* Side pill */}
        <span
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full',
            'text-[10px] font-mono font-bold uppercase tracking-wider border',
            isFor
              ? 'bg-for-500/10 border-for-500/30 text-for-400'
              : 'bg-against-500/10 border-against-500/30 text-against-400'
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-2.5 w-2.5" />
          ) : (
            <ThumbsDown className="h-2.5 w-2.5" />
          )}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>

        {/* Upvotes */}
        <span className="flex items-center gap-1 text-xs font-mono text-surface-500 ml-auto">
          <ThumbsUp className="h-3 w-3" />
          {arg.upvotes}
        </span>

        {/* Remove bookmark button */}
        <button
          onClick={handleUnbookmark}
          disabled={removing}
          aria-label="Remove bookmark"
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-lg',
            'text-surface-500 hover:text-against-400 hover:bg-against-500/10',
            'opacity-0 group-hover:opacity-100 transition-all focus:opacity-100',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-against-400/50',
            removing && 'opacity-50 cursor-not-allowed'
          )}
        >
          {removing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <BookmarkX className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Argument content */}
      <p className="text-sm text-surface-200 leading-relaxed mb-3">
        {renderWithMentions(truncate(arg.content, 300))}
      </p>

      {/* Source link */}
      {arg.source_url && (
        <a
          href={arg.source_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-mono',
            'text-for-400 hover:text-for-300 transition-colors mb-3',
            'underline underline-offset-2 decoration-for-500/40'
          )}
        >
          <Link2 className="h-3 w-3" />
          {new URL(arg.source_url).hostname}
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}

      {/* Footer: author + topic + saved date */}
      <div className="flex items-center gap-2 flex-wrap">
        {arg.author && (
          <Link
            href={`/profile/${arg.author.username}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 group/author"
          >
            <Avatar
              src={arg.author.avatar_url}
              fallback={arg.author.display_name || arg.author.username}
              size="xs"
            />
            <span className="text-xs text-surface-500 group-hover/author:text-white transition-colors">
              {arg.author.display_name || arg.author.username}
            </span>
          </Link>
        )}

        <span className="text-surface-600 text-xs">·</span>

        {/* Saved time */}
        <span className="text-xs text-surface-600 font-mono">
          saved {relativeTime(arg.bookmarked_at)}
        </span>
      </div>

      {/* Topic chip */}
      {arg.topic && (
        <Link
          href={`/topic/${arg.topic_id}`}
          className={cn(
            'flex items-start gap-2 mt-3 p-2.5 rounded-xl',
            'bg-surface-200/60 border border-surface-300/60',
            'hover:bg-surface-200 hover:border-surface-400/60 transition-colors group/topic'
          )}
        >
          <StatusIcon status={arg.topic.status} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-surface-400 leading-snug truncate group-hover/topic:text-surface-300 transition-colors">
              {arg.topic.statement}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              {arg.topic.category && (
                <span className="text-[10px] font-mono text-surface-600">
                  {arg.topic.category}
                </span>
              )}
              <Badge variant={STATUS_BADGE[arg.topic.status] ?? 'proposed'} size="xs">
                {STATUS_LABEL[arg.topic.status] ?? arg.topic.status}
              </Badge>
            </div>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 group-hover/topic:text-surface-400 transition-colors" />
        </Link>
      )}
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-10 ml-auto" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-14 rounded-xl mt-2" />
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type SideFilter = 'all' | 'for' | 'against'

function FilterPill({
  active,
  onClick,
  children,
  activeClass,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  activeClass?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium border transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400/50',
        active
          ? activeClass ?? 'bg-surface-300 border-surface-400 text-white'
          : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
      )}
    >
      {children}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookmarkedArgumentsPage() {
  const router = useRouter()
  const [allArgs, setAllArgs] = useState<BookmarkedArgument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showCatPicker, setShowCatPicker] = useState(false)

  const fetchBookmarks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/arguments/bookmarked', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load bookmarks')
      const data = (await res.json()) as BookmarkedArgumentsResponse
      setAllArgs(data.arguments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchBookmarks()
  }, [fetchBookmarks])

  function handleUnbookmark(id: string) {
    setAllArgs((prev) => prev.filter((a) => a.id !== id))
  }

  // Apply filters
  const filtered = allArgs.filter((a) => {
    if (sideFilter === 'for' && a.side !== 'blue') return false
    if (sideFilter === 'against' && a.side !== 'red') return false
    if (categoryFilter && a.topic?.category !== categoryFilter) return false
    return true
  })

  const hasFilters = sideFilter !== 'all' || categoryFilter !== null

  function clearFilters() {
    setSideFilter('all')
    setCategoryFilter(null)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Link
              href="/arguments"
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                'transition-colors'
              )}
              aria-label="Back to Arguments"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
                <Bookmark className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Saved Arguments
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Your personal civic research library
                </p>
              </div>
            </div>

            {/* Count badge */}
            {!loading && allArgs.length > 0 && (
              <div className="flex-shrink-0 px-2.5 py-1 rounded-full bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400">
                {allArgs.length} saved
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        {!loading && allArgs.length > 0 && (
          <div className="mb-5 space-y-2">
            {/* Side filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <FilterPill
                active={sideFilter === 'all'}
                onClick={() => setSideFilter('all')}
              >
                All Sides
              </FilterPill>
              <FilterPill
                active={sideFilter === 'for'}
                onClick={() => setSideFilter('for')}
                activeClass="bg-for-500/20 border-for-500/40 text-for-400"
              >
                <ThumbsUp className="h-3 w-3" />
                FOR
              </FilterPill>
              <FilterPill
                active={sideFilter === 'against'}
                onClick={() => setSideFilter('against')}
                activeClass="bg-against-500/20 border-against-500/40 text-against-400"
              >
                <ThumbsDown className="h-3 w-3" />
                AGAINST
              </FilterPill>

              <div className="relative">
                <FilterPill
                  active={categoryFilter !== null}
                  onClick={() => setShowCatPicker((v) => !v)}
                  activeClass="bg-gold/20 border-gold/40 text-gold"
                >
                  <Tag className="h-3 w-3" />
                  {categoryFilter ?? 'Category'}
                </FilterPill>

                <AnimatePresence>
                  {showCatPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.12 }}
                      className={cn(
                        'absolute top-full left-0 mt-1 z-30 w-48',
                        'bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden'
                      )}
                    >
                      <button
                        onClick={() => { setCategoryFilter(null); setShowCatPicker(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs font-mono',
                          'hover:bg-surface-200 transition-colors',
                          categoryFilter === null ? 'text-white' : 'text-surface-500'
                        )}
                      >
                        All Categories
                      </button>
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => { setCategoryFilter(cat); setShowCatPicker(false) }}
                          className={cn(
                            'w-full text-left px-3 py-2 text-xs font-mono',
                            'hover:bg-surface-200 transition-colors',
                            categoryFilter === cat ? 'text-white' : 'text-surface-500'
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className={cn(
                    'flex items-center gap-1 text-xs font-mono text-surface-500',
                    'hover:text-white transition-colors'
                  )}
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}

              {/* Refresh */}
              <button
                onClick={fetchBookmarks}
                disabled={loading}
                aria-label="Refresh bookmarks"
                className={cn(
                  'ml-auto flex items-center justify-center h-7 w-7 rounded-lg',
                  'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                  'transition-colors disabled:opacity-40'
                )}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
            </div>

            {/* Filtered count */}
            {hasFilters && (
              <p className="text-xs font-mono text-surface-600">
                Showing {filtered.length} of {allArgs.length} saved arguments
              </p>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <p className="text-sm text-against-400 font-mono mb-3">{error}</p>
            <button
              onClick={fetchBookmarks}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : allArgs.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="No saved arguments yet"
            description="Bookmark arguments you find compelling while reading debates. They'll appear here as your civic research library."
            action={
              <Link
                href="/arguments"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-xl',
                  'bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold',
                  'transition-colors'
                )}
              >
                Browse Top Arguments
                <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No arguments match this filter"
            description={
              categoryFilter
                ? `You haven't saved any ${categoryFilter} arguments from the ${sideFilter === 'for' ? 'FOR' : sideFilter === 'against' ? 'AGAINST' : ''} side yet.`
                : `You haven't saved any arguments from the ${sideFilter === 'for' ? 'FOR' : 'AGAINST'} side yet.`
            }
            action={
              <button
                onClick={clearFilters}
                className="text-sm font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-4">
              {filtered.map((arg) => (
                <ArgumentCard
                  key={arg.id}
                  arg={arg}
                  onUnbookmark={handleUnbookmark}
                />
              ))}
            </div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
