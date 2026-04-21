'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bookmark,
  BookmarkX,
  ChevronRight,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Zap,
  Scale,
  FileText,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { renderWithMentions } from '@/lib/utils/mentions'
import type { BookmarkedArgument, BookmarkedArgumentsResponse } from '@/app/api/arguments/bookmarked/route'

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

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  law: Gavel,
  voting: Scale,
  active: Zap,
  proposed: FileText,
  failed: Scale,
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ArgumentSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-5/6" />
      <Skeleton className="h-3 w-32 mt-1" />
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function SavedArgumentCard({
  arg,
  onRemove,
}: {
  arg: BookmarkedArgument
  onRemove: (id: string) => void
}) {
  const [removing, setRemoving] = useState(false)
  const isFor = arg.side === 'blue'
  const StatusIcon = STATUS_ICON[arg.topic?.status ?? 'proposed'] ?? FileText

  const handleRemove = async () => {
    if (removing) return
    setRemoving(true)
    try {
      await fetch(`/api/arguments/${arg.id}/bookmark`, { method: 'POST' })
      onRemove(arg.id)
    } catch {
      setRemoving(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className={cn(
        'group rounded-2xl border bg-surface-100 p-5 transition-colors',
        isFor
          ? 'border-for-500/30 hover:border-for-500/50'
          : 'border-against-500/30 hover:border-against-500/50'
      )}
    >
      {/* Side pill + author */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wide border',
            isFor
              ? 'bg-for-500/10 border-for-500/30 text-for-400'
              : 'bg-against-500/10 border-against-500/30 text-against-400'
          )}
        >
          {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          {isFor ? 'For' : 'Against'}
        </span>

        <Avatar
          src={arg.author?.avatar_url ?? null}
          fallback={arg.author?.display_name || arg.author?.username || '?'}
          size="xs"
        />
        <span className="text-xs text-white truncate max-w-[120px]">
          {arg.author?.display_name || arg.author?.username || 'Anonymous'}
        </span>

        <span className="text-[10px] text-surface-600 ml-auto">
          {relativeTime(arg.created_at)}
        </span>
      </div>

      {/* Argument content */}
      <p className="text-sm text-surface-300 leading-relaxed mb-3 line-clamp-4">
        {renderWithMentions(arg.content)}
      </p>

      {/* Footer: topic link + actions */}
      <div className="flex items-end justify-between gap-2 pt-2 border-t border-surface-300/50">
        {/* Topic */}
        {arg.topic ? (
          <Link
            href={`/topic/${arg.topic.id}`}
            className="flex items-start gap-1.5 min-w-0 group/link"
          >
            <StatusIcon
              className={cn(
                'h-3.5 w-3.5 mt-0.5 flex-shrink-0 transition-colors',
                arg.topic.status === 'law' ? 'text-emerald' : 'text-surface-500 group-hover/link:text-surface-400'
              )}
            />
            <span className="text-[11px] font-mono text-surface-500 group-hover/link:text-white transition-colors line-clamp-2 leading-tight">
              {arg.topic.statement}
            </span>
          </Link>
        ) : (
          <span className="text-[11px] text-surface-600 font-mono">Topic unavailable</span>
        )}

        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {/* Upvote count indicator */}
          <span className="flex items-center gap-0.5 text-[10px] text-surface-500 font-mono">
            <ChevronRight className="h-3 w-3 rotate-[-90deg]" />
            {arg.upvotes}
          </span>

          {/* Status badge */}
          {arg.topic && (
            <Badge variant={STATUS_BADGE[arg.topic.status] ?? 'proposed'} className="text-[9px]">
              {arg.topic.status === 'law' ? 'LAW' : arg.topic.status}
            </Badge>
          )}

          {/* Remove bookmark */}
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            aria-label="Remove bookmark"
            title="Remove from saved arguments"
            className="p-1 rounded-lg text-gold hover:text-gold/60 hover:bg-gold/10 transition-all"
          >
            {removing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookmarkX className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Saved at */}
      <p className="text-[10px] text-surface-700 font-mono mt-2">
        Saved {relativeTime(arg.bookmarked_at)}
      </p>
    </motion.div>
  )
}

// ─── Filter strip ─────────────────────────────────────────────────────────────

type SideFilter = 'all' | 'for' | 'against'

const SIDE_FILTERS: { id: SideFilter; label: string; activeClass: string }[] = [
  { id: 'all', label: 'Both', activeClass: 'bg-surface-300 text-white border-surface-400' },
  { id: 'for', label: 'FOR', activeClass: 'bg-for-500/20 text-for-300 border-for-500/50' },
  { id: 'against', label: 'AGAINST', activeClass: 'bg-against-500/20 text-against-300 border-against-500/50' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SavedArgumentsPage() {
  const [args, setArgs] = useState<BookmarkedArgument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sideFilter, setSideFilter] = useState<SideFilter>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/arguments/bookmarked')
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login'
          return
        }
        throw new Error('Failed to load')
      }
      const data: BookmarkedArgumentsResponse = await res.json()
      setArgs(data.arguments)
    } catch {
      setError('Could not load saved arguments.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleRemove = (id: string) => {
    setArgs((prev) => prev.filter((a) => a.id !== id))
  }

  const filtered = args.filter((a) => {
    if (sideFilter === 'for') return a.side === 'blue'
    if (sideFilter === 'against') return a.side === 'red'
    return true
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/20">
              <Bookmark className="h-5 w-5 text-gold" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Saved Arguments
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {loading
                  ? 'Loading…'
                  : args.length > 0
                  ? `${args.length} argument${args.length === 1 ? '' : 's'} bookmarked`
                  : 'Bookmark arguments to read them later'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/saved"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Topics
            </Link>
            <button
              type="button"
              onClick={load}
              aria-label="Refresh"
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Side filter — only shown when there are arguments */}
        {!loading && args.length > 0 && (
          <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-none pb-1">
            {SIDE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSideFilter(f.id)}
                className={cn(
                  'flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-mono border transition-all',
                  sideFilter === f.id
                    ? f.activeClass
                    : 'bg-surface-200/50 text-surface-500 border-surface-300 hover:border-surface-400'
                )}
              >
                {f.label}
              </button>
            ))}
            <span className="text-[11px] text-surface-600 font-mono ml-auto flex-shrink-0">
              {filtered.length} showing
            </span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <ArgumentSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              type="button"
              onClick={load}
              className="px-4 py-2 rounded-lg bg-surface-200 text-xs font-mono text-white hover:bg-surface-300 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 && args.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No saved arguments"
            description="Tap the bookmark icon on any argument to save it here for later reference."
            actions={[
              { label: 'Browse Topics', href: '/', icon: Zap },
              { label: 'Saved Topics', href: '/saved', icon: Bookmark, variant: 'secondary' },
            ]}
            size="lg"
          />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
            <p className="text-sm font-mono text-surface-500">
              No {sideFilter === 'for' ? 'FOR' : 'AGAINST'} arguments saved.
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {filtered.map((arg) => (
                <SavedArgumentCard key={arg.id} arg={arg} onRemove={handleRemove} />
              ))}
            </div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
