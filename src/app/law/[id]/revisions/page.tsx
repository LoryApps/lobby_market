'use client'

/**
 * /law/[id]/revisions — Law Revision History
 *
 * Wikipedia-style edit history for an established law. Shows every
 * community-proposed revision in reverse chronological order with
 * editor attribution, edit summary, and character delta. Clicking a
 * revision expands the full text so citizens can compare versions.
 *
 * Distinct from:
 *   /law/[id]/community  — amendment proposals + community notes
 *   /law/[id]/debate     — the original FOR/AGAINST debate record
 *   /law/[id]            — the current canonical law text
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Edit3,
  ExternalLink,
  Gavel,
  History,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  User,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RevisionsResponse, RevisionEntry } from '@/app/api/laws/[id]/revisions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function absDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Revision row ─────────────────────────────────────────────────────────────

function RevisionRow({
  revision,
  isLatest,
  isOriginal,
}: {
  revision: RevisionEntry
  isLatest: boolean
  isOriginal: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const delta = revision.char_delta ?? 0
  const deltaPositive = delta > 0
  const deltaZero = delta === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden transition-colors',
        isLatest
          ? 'border-emerald/30 bg-emerald/5'
          : 'border-surface-300/60'
      )}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-surface-200/40 transition-colors"
        aria-expanded={expanded}
      >
        {/* Revision number */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg',
            'font-mono text-xs font-bold',
            isLatest
              ? 'bg-emerald/15 border border-emerald/30 text-emerald'
              : 'bg-surface-200 border border-surface-300 text-surface-500'
          )}
        >
          #{revision.revision_num}
        </div>

        <div className="flex-1 min-w-0">
          {/* Summary / default label */}
          <p className="text-sm font-mono text-white font-medium truncate">
            {revision.summary ?? 'Wiki revision'}
          </p>

          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {/* Editor */}
            {revision.editor ? (
              <div className="flex items-center gap-1.5">
                <Avatar
                  src={revision.editor.avatar_url}
                  fallback={revision.editor.display_name ?? revision.editor.username}
                  size="xs"
                />
                <span className="text-xs font-mono text-surface-500">
                  {revision.editor.display_name ?? revision.editor.username}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-surface-600" />
                <span className="text-xs font-mono text-surface-600">Anonymous</span>
              </div>
            )}

            {/* Timestamp */}
            <div
              className="flex items-center gap-1 text-xs font-mono text-surface-500"
              title={absDate(revision.created_at)}
            >
              <Clock className="h-3 w-3" />
              {relTime(revision.created_at)}
            </div>

            {/* Char delta */}
            {!deltaZero && (
              <div
                className={cn(
                  'flex items-center gap-0.5 text-xs font-mono font-semibold',
                  deltaPositive ? 'text-emerald' : 'text-against-400'
                )}
              >
                {deltaPositive ? (
                  <PlusCircle className="h-3 w-3" />
                ) : (
                  <MinusCircle className="h-3 w-3" />
                )}
                {Math.abs(delta).toLocaleString()} chars
              </div>
            )}

            {/* Badges */}
            {isLatest && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald/15 text-emerald border border-emerald/30">
                CURRENT
              </span>
            )}
            {isOriginal && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-gold/15 text-gold border border-gold/30">
                ORIGINAL
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-surface-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-surface-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-300/50 px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="h-3.5 w-3.5 text-surface-500" />
                <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">
                  Revision text
                </span>
                <span className="ml-auto text-xs font-mono text-surface-600">
                  {revision.body_markdown.length.toLocaleString()} chars
                </span>
              </div>
              <div
                className={cn(
                  'bg-surface-200/60 rounded-xl border border-surface-300/50 p-4',
                  'font-mono text-xs text-surface-600 leading-relaxed',
                  'max-h-64 overflow-y-auto whitespace-pre-wrap break-words'
                )}
              >
                {revision.body_markdown}
              </div>
              {revision.editor && (
                <div className="mt-3 flex items-center justify-end">
                  <Link
                    href={`/profile/${revision.editor.username}`}
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                  >
                    View editor profile
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RevisionSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawRevisionsPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<RevisionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/revisions`)
      if (!res.ok) throw new Error('Failed to load')
      const json: RevisionsResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load revision history.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const law = data?.law ?? null
  const revisions = data?.revisions ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-3">
          <Link
            href={law ? `/law/${id}` : '/law'}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors'
            )}
            aria-label="Back to law"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 text-sm font-mono text-surface-500 min-w-0">
            <Link href="/law" className="hover:text-white transition-colors">Codex</Link>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            {law ? (
              <Link
                href={`/law/${id}`}
                className="hover:text-white transition-colors truncate"
              >
                {law.statement.slice(0, 50)}{law.statement.length > 50 ? '…' : ''}
              </Link>
            ) : (
              <Skeleton className="h-4 w-40" />
            )}
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-white">Revision History</span>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-surface-200 border border-surface-300 flex-shrink-0">
            <History className="h-6 w-6 text-surface-500" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Revision History</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              {loading
                ? 'Loading…'
                : revisions.length === 0
                  ? 'No community revisions yet'
                  : `${revisions.length} revision${revisions.length !== 1 ? 's' : ''} · most recent first`}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white text-xs font-mono transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Law card */}
        {law && (
          <Link
            href={`/law/${id}`}
            className="block bg-surface-100 border border-surface-300 rounded-2xl p-4 hover:border-emerald/40 hover:bg-emerald/5 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald/10 border border-emerald/30 flex-shrink-0">
                <Gavel className="h-4 w-4 text-emerald" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-white font-medium group-hover:text-emerald transition-colors line-clamp-2">
                  {law.statement}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  {law.category && (
                    <Badge variant="law" className="text-[10px]">{law.category}</Badge>
                  )}
                  <span className="text-xs font-mono text-surface-500">
                    Established {new Date(law.established_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <ExternalLink className="h-4 w-4 text-surface-600 group-hover:text-emerald flex-shrink-0 transition-colors" />
            </div>
          </Link>
        )}

        {/* What are revisions? */}
        <div className="bg-surface-100 border border-surface-300/50 rounded-xl px-4 py-3 flex items-start gap-3">
          <Edit3 className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Revisions are community-proposed updates to the law&apos;s body text —
            like Wikipedia edits for civic legislation. Each revision is numbered
            and attributed to its author. The most recent revision becomes the
            canonical text shown on the law&apos;s main page.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-against-500/10 border border-against-500/30 rounded-xl px-4 py-3 text-xs font-mono text-against-400">
            {error}
          </div>
        )}

        {/* Revision list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <RevisionSkeleton key={i} />)}
          </div>
        ) : revisions.length === 0 ? (
          <EmptyState
            icon={History}
            title="No revisions yet"
            description="This law hasn't received any community revisions. Be the first to propose an update on the law's main page."
            action={{ label: 'View law', href: `/law/${id}` }}
          />
        ) : (
          <div className="space-y-3">
            {revisions.map((rev, i) => (
              <RevisionRow
                key={rev.id}
                revision={rev}
                isLatest={i === 0}
                isOriginal={rev.revision_num === 1}
              />
            ))}
          </div>
        )}

        {/* Original law text note */}
        {!loading && revisions.length > 0 && law?.body_markdown && (
          <div className="rounded-2xl border border-surface-300/40 bg-surface-100/50 overflow-hidden">
            <button
              onClick={(e) => {
                const el = e.currentTarget.nextElementSibling as HTMLElement | null
                if (el) el.classList.toggle('hidden')
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-200/40 transition-colors"
            >
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
                <BookOpen className="h-4 w-4 text-gold" />
              </div>
              <div>
                <p className="text-xs font-mono font-semibold text-gold">Original Law Text</p>
                <p className="text-[10px] font-mono text-surface-500">
                  The canonical text at establishment · click to expand
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-surface-500 ml-auto" />
            </button>
            <div className="hidden border-t border-surface-300/50 px-4 py-4">
              <div
                className={cn(
                  'bg-surface-200/60 rounded-xl border border-surface-300/50 p-4',
                  'font-mono text-xs text-surface-600 leading-relaxed',
                  'max-h-64 overflow-y-auto whitespace-pre-wrap break-words'
                )}
              >
                {law.body_markdown}
              </div>
            </div>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
