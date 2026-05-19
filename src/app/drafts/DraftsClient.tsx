'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Cloud,
  Edit3,
  FileText,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
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
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Draft Card ───────────────────────────────────────────────────────────────

function DraftCard({
  draft,
  onDelete,
}: {
  draft: ArgumentDraftWithTopic
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const isFor = draft.side === 'blue'

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/arguments/drafts/${draft.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        onDelete(draft.id)
      }
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }, [confirmDelete, draft.id, onDelete])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Side accent stripe */}
      <div
        className={cn(
          'h-1 w-full',
          isFor ? 'bg-gradient-to-r from-for-700 to-for-500' : 'bg-gradient-to-r from-against-700 to-against-500'
        )}
      />

      <div className="p-5 space-y-3">
        {/* Topic info */}
        <div className="space-y-1.5">
          <div className="flex items-center flex-wrap gap-2">
            {/* Side badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
                isFor
                  ? 'text-for-300 bg-for-500/10 border-for-500/30'
                  : 'text-against-300 bg-against-500/10 border-against-500/30'
              )}
            >
              {isFor ? (
                <ThumbsUp className="h-3 w-3" />
              ) : (
                <ThumbsDown className="h-3 w-3" />
              )}
              {isFor ? 'FOR' : 'AGAINST'}
            </span>

            {/* Topic status */}
            <Badge variant={STATUS_BADGE[draft.topic.status] ?? 'proposed'}>
              {draft.topic.status === 'law' ? 'LAW' : draft.topic.status}
            </Badge>

            {/* Category */}
            {draft.topic.category && (
              <span className="text-[11px] font-mono text-surface-500 px-2 py-0.5 rounded-full bg-surface-300/50 border border-surface-300">
                {draft.topic.category}
              </span>
            )}
          </div>

          {/* Topic statement */}
          <Link
            href={`/topic/${draft.topic.id}`}
            className="block font-mono text-sm font-semibold text-white hover:text-for-300 transition-colors leading-snug line-clamp-2"
          >
            {draft.topic.statement}
          </Link>
        </div>

        {/* Draft content */}
        <div
          className={cn(
            'rounded-xl border px-4 py-3',
            isFor
              ? 'bg-for-500/5 border-for-500/20'
              : 'bg-against-500/5 border-against-500/20'
          )}
        >
          <p className="text-sm text-surface-300 leading-relaxed line-clamp-4 font-mono">
            {draft.content}
          </p>
        </div>

        {/* Character count */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                draft.content.length >= 400
                  ? 'bg-against-500'
                  : draft.content.length >= 200
                    ? 'bg-gold'
                    : 'bg-for-500'
              )}
              style={{ width: `${Math.min((draft.content.length / 500) * 100, 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-surface-500 tabular-nums flex-shrink-0">
            {draft.content.length}/500 chars
          </span>
        </div>

        {/* Footer: time + actions */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] font-mono text-surface-600">
            Saved {relativeTime(draft.updated_at)}
          </span>

          <div className="flex items-center gap-2">
            {/* Delete */}
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              title={confirmDelete ? 'Click again to confirm delete' : 'Delete draft'}
              aria-label={confirmDelete ? 'Confirm delete draft' : 'Delete draft'}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all',
                confirmDelete
                  ? 'border-against-500/50 bg-against-500/10 text-against-300'
                  : 'border-surface-400 bg-surface-200 text-surface-500 hover:border-against-500/40 hover:text-against-300'
              )}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {confirmDelete ? 'Confirm' : 'Delete'}
            </button>

            {/* Edit in context */}
            <Link
              href={`/topic/${draft.topic.id}#argue`}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all',
                isFor
                  ? 'border-for-500/40 bg-for-600/80 text-white hover:bg-for-500'
                  : 'border-against-500/40 bg-against-600/80 text-white hover:bg-against-500'
              )}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit &amp; Post
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DraftsClient({ drafts: initialDrafts }: { drafts: ArgumentDraftWithTopic[] }) {
  const [drafts, setDrafts] = useState<ArgumentDraftWithTopic[]>(initialDrafts)

  const handleDelete = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex-shrink-0">
              <Cloud className="h-5 w-5 text-surface-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white">Draft Box</h1>
              <p className="text-xs font-mono text-surface-500">
                {drafts.length === 0
                  ? 'No saved drafts'
                  : `${drafts.length} saved draft${drafts.length === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>

          <p className="text-sm text-surface-500 font-mono mt-3 leading-relaxed">
            Save arguments as drafts before posting — refine your thinking, then publish when ready.
            Each topic can hold one draft per side.
          </p>
        </div>

        {/* How-to tip */}
        {drafts.length > 0 && (
          <div className="rounded-xl bg-surface-200/50 border border-surface-300 px-4 py-3 mb-5 flex items-start gap-3">
            <FileText className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden />
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              Click <span className="text-white font-semibold">Edit &amp; Post</span> to open the topic and resume your draft.
              Your saved text will be loaded into the argument composer automatically.
            </p>
          </div>
        )}

        {/* Draft list */}
        <AnimatePresence mode="popLayout">
          {drafts.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <EmptyState
                icon={Cloud}
                title="No drafts saved"
                description="When writing an argument, click the Save button to keep a draft here. Come back, refine, and post when you're ready."
                actions={[
                  { label: 'Browse topics', href: '/' },
                ]}
              />
            </motion.div>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <DraftCard key={draft.id} draft={draft} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Tips footer */}
        {drafts.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { icon: ThumbsUp, label: 'Draft any side', desc: 'FOR or AGAINST' },
                { icon: Cloud, label: 'Cloud-synced', desc: 'Across devices' },
                { icon: Check, label: 'One per topic', desc: 'Keeps it focused' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300">
                    <Icon className="h-4 w-4 text-surface-400" aria-hidden />
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-surface-400">{label}</span>
                  <span className="text-[10px] font-mono text-surface-600">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
