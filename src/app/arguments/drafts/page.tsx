'use client'

/**
 * /arguments/drafts — My Argument Drafts
 *
 * Shows every argument draft the current user has saved across all topics.
 * Drafts are created automatically as the user types in the ArgumentThread —
 * saved both to localStorage (instant) and to the cloud DB (cross-device).
 *
 * Distinct from:
 *   /arguments/mine        — published arguments with quality grades
 *   /arguments/bookmarked  — arguments you've bookmarked from others
 *   /saved                 — general topic bookmarks
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Clock,
  Edit3,
  ExternalLink,
  FileEdit,
  Gavel,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Zap,
  FileText,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ArgumentDraftWithTopic } from '@/lib/supabase/types'

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

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
  archived: 'proposed',
}

const STATUS_ICON: Record<string, typeof FileText> = {
  law: Gavel,
  voting: Zap,
  active: Zap,
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DraftSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 flex-1 min-w-0">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
      </div>
      <div className="rounded-xl border border-surface-300 px-3 py-2.5 space-y-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/4" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  )
}

// ─── Delete button with confirm ───────────────────────────────────────────────

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function handleClick() {
    if (!confirming) {
      setConfirming(true)
      // Auto-cancel confirmation after 3 s
      setTimeout(() => setConfirming(false), 3000)
      return
    }
    setDeleting(true)
    onDelete()
  }

  return (
    <button
      onClick={handleClick}
      disabled={deleting}
      aria-label={confirming ? 'Confirm delete draft' : 'Delete draft'}
      className={cn(
        'flex items-center justify-center h-7 w-7 rounded-lg border transition-colors flex-shrink-0',
        confirming
          ? 'bg-against-500/20 border-against-500/50 text-against-300 hover:bg-against-500/30'
          : 'bg-surface-200 border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white',
        deleting && 'opacity-50 cursor-not-allowed'
      )}
    >
      {deleting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

// ─── Draft card ───────────────────────────────────────────────────────────────

function DraftCard({
  draft,
  index,
  onDelete,
}: {
  draft: ArgumentDraftWithTopic
  index: number
  onDelete: (id: string) => void
}) {
  const isFor = draft.side === 'blue'
  const SideIcon = isFor ? ThumbsUp : ThumbsDown
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'
  const sideBg = isFor
    ? 'bg-for-500/8 border-for-500/20'
    : 'bg-against-500/8 border-against-500/20'

  const topic = draft.topic
  const StatusIcon = STATUS_ICON[topic.status] ?? FileText
  const statusVariant = STATUS_BADGE[topic.status] ?? 'proposed'

  const wordCount = draft.content.trim().split(/\s+/).filter(Boolean).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3 hover:border-surface-400 transition-colors group"
    >
      {/* Header row: topic + delete */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <StatusIcon className="h-3 w-3 text-surface-600 flex-shrink-0" aria-hidden />
            <Badge variant={statusVariant} className="text-[9px] px-1.5 py-0.5">
              {STATUS_LABEL[topic.status] ?? topic.status}
            </Badge>
            {topic.category && (
              <span className="text-[10px] font-mono text-surface-600 truncate">
                {topic.category}
              </span>
            )}
          </div>

          <Link
            href={`/topic/${topic.id}`}
            className="text-sm font-mono font-semibold text-white hover:text-for-400 transition-colors leading-snug block line-clamp-2"
          >
            {topic.statement}
          </Link>
        </div>

        <DeleteButton onDelete={() => onDelete(draft.id)} />
      </div>

      {/* Draft content preview */}
      <div className={cn('rounded-xl border px-3 py-2.5 space-y-1.5', sideBg)}>
        <div className="flex items-center gap-1.5">
          <SideIcon className={cn('h-3 w-3 flex-shrink-0', sideColor)} aria-hidden />
          <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', sideColor)}>
            {sideLabel} draft
          </span>
        </div>
        <p className={cn('text-[12px] font-mono leading-relaxed line-clamp-3', sideColor, 'opacity-80')}>
          {draft.content}
        </p>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] font-mono text-surface-600">
            <Clock className="h-3 w-3" aria-hidden />
            Saved {relativeTime(draft.updated_at)}
          </span>
          <span className="text-[10px] font-mono text-surface-600 tabular-nums">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
        </div>

        <Link
          href={`/topic/${topic.id}`}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono font-semibold text-surface-400 hover:bg-surface-300 hover:text-white transition-colors"
        >
          <Edit3 className="h-3 w-3" aria-hidden />
          Continue
          <ExternalLink className="h-2.5 w-2.5 opacity-60" aria-hidden />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArgumentDraftsPage() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<ArgumentDraftWithTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDrafts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/arguments/drafts', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load drafts')
      const { drafts: data } = (await res.json()) as { drafts: ArgumentDraftWithTopic[] }
      setDrafts(data ?? [])
    } catch {
      setError('Could not load drafts. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchDrafts()
  }, [fetchDrafts])

  async function handleDelete(id: string) {
    // Optimistic removal
    setDrafts((prev) => prev.filter((d) => d.id !== id))
    try {
      await fetch(`/api/arguments/drafts/${id}`, { method: 'DELETE' })
    } catch {
      // Non-critical: re-fetch to sync
      fetchDrafts()
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-24 md:pb-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href="/arguments/mine"
              aria-label="Back to My Arguments"
              className="h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Link>
            <div className="h-8 w-8 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0">
              <FileEdit className="h-4 w-4 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-none">
                My Drafts
              </h1>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                Arguments saved but not yet posted
              </p>
            </div>
          </div>

          <div className="ml-[4.25rem] text-[11px] font-mono text-surface-600 leading-relaxed">
            Drafts are auto-saved as you type and synced across devices.
            Click{' '}
            <span className="text-white font-semibold">Continue</span> on any card to
            resume writing in the topic thread.
          </div>
        </div>

        {/* Stats bar */}
        {!loading && !error && drafts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-center gap-4 px-4 py-3 rounded-2xl bg-surface-100 border border-surface-300"
          >
            <div className="flex items-center gap-1.5">
              <FileEdit className="h-3.5 w-3.5 text-gold" aria-hidden />
              <span className="text-xs font-mono font-semibold text-white tabular-nums">
                {drafts.length}
              </span>
              <span className="text-xs font-mono text-surface-500">
                {drafts.length === 1 ? 'draft' : 'drafts'}
              </span>
            </div>
            <div className="h-3 w-px bg-surface-300" aria-hidden />
            <div className="flex items-center gap-1.5">
              <ThumbsUp className="h-3.5 w-3.5 text-for-400" aria-hidden />
              <span className="text-xs font-mono font-semibold text-white tabular-nums">
                {drafts.filter((d) => d.side === 'blue').length}
              </span>
              <span className="text-xs font-mono text-surface-500">FOR</span>
            </div>
            <div className="h-3 w-px bg-surface-300" aria-hidden />
            <div className="flex items-center gap-1.5">
              <ThumbsDown className="h-3.5 w-3.5 text-against-400" aria-hidden />
              <span className="text-xs font-mono font-semibold text-white tabular-nums">
                {drafts.filter((d) => d.side === 'red').length}
              </span>
              <span className="text-xs font-mono text-surface-500">AGAINST</span>
            </div>
            <div className="flex-1" />
            <button
              onClick={fetchDrafts}
              aria-label="Refresh drafts"
              className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Refresh
            </button>
          </motion.div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {Array.from({ length: 3 }, (_, i) => (
                <DraftSkeleton key={i} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-surface-100 border border-against-500/30 p-6 text-center"
            >
              <p className="text-sm font-mono text-against-300 mb-3">{error}</p>
              <button
                onClick={fetchDrafts}
                className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Try again
              </button>
            </motion.div>
          ) : drafts.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={FileEdit}
                title="No drafts yet"
                description="Start typing an argument on any topic — it'll be auto-saved here so you never lose your work."
                action={{ label: 'Browse topics', href: '/' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <AnimatePresence>
                {drafts.map((draft, i) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    index={i}
                    onDelete={handleDelete}
                  />
                ))}
              </AnimatePresence>

              <div className="pt-4 pb-2 text-center">
                <p className="text-[11px] font-mono text-surface-600">
                  {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'} — one per topic
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
