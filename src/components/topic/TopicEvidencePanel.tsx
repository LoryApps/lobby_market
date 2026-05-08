'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import NextLink from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowUpRight,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { EvidenceItem, EvidenceResponse } from '@/app/api/topics/[id]/evidence/route'
import type { EvidenceAnalysisResponse } from '@/app/api/topics/[id]/evidence-analysis/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type SideFilter = 'all' | 'for' | 'against' | 'neutral'

interface TopicEvidencePanelProps {
  topicId: string
  className?: string
}

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const SIDE_CONFIG = {
  for: {
    label: 'FOR',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    pill: 'bg-for-500/20 text-for-400 border-for-500/40',
    icon: ThumbsUp,
  },
  against: {
    label: 'AGAINST',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    pill: 'bg-against-500/20 text-against-400 border-against-500/40',
    icon: ThumbsDown,
  },
  neutral: {
    label: 'NEUTRAL',
    color: 'text-surface-400',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/20',
    pill: 'bg-surface-300/20 text-surface-400 border-surface-300/40',
    icon: Shield,
  },
}

// ─── Favicon ──────────────────────────────────────────────────────────────────

function FaviconIcon({ domain }: { domain: string | null }) {
  const [errored, setErrored] = useState(false)

  if (!domain || errored) {
    return (
      <div className="flex items-center justify-center h-5 w-5 rounded bg-surface-300 shrink-0">
        <BookOpen className="h-2.5 w-2.5 text-surface-500" />
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      className="h-5 w-5 rounded shrink-0"
      onError={() => setErrored(true)}
    />
  )
}

// ─── Submit Form ──────────────────────────────────────────────────────────────

interface SubmitFormProps {
  topicId: string
  onSubmitted: (item: EvidenceItem) => void
  onClose: () => void
}

function SubmitForm({ topicId, onSubmitted, onClose }: SubmitFormProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [side, setSide] = useState<'for' | 'against' | 'neutral'>('neutral')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    urlRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), title: title.trim(), description: description.trim() || undefined, side }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to submit')
        return
      }
      onSubmitted(json.item as EvidenceItem)
      onClose()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl bg-surface-200 border border-surface-400 p-4 mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono font-semibold text-white">Submit Evidence</span>
        <button
          onClick={onClose}
          className="flex items-center justify-center h-6 w-6 rounded-md bg-surface-300 text-surface-500 hover:text-white transition-colors"
          aria-label="Close form"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* URL */}
        <div>
          <label className="block text-[11px] font-mono text-surface-500 mb-1" htmlFor="ev-url">
            Source URL *
          </label>
          <input
            id="ev-url"
            ref={urlRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            placeholder="https://example.com/article"
            className="w-full px-3 py-2 rounded-lg bg-surface-300 border border-surface-400 text-white text-xs font-mono placeholder-surface-500 focus:outline-none focus:border-for-500/50 focus:bg-surface-400/50 transition-colors"
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-[11px] font-mono text-surface-500 mb-1" htmlFor="ev-title">
            Title / Headline *
          </label>
          <input
            id="ev-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={5}
            maxLength={200}
            placeholder="Concise title for the source"
            className="w-full px-3 py-2 rounded-lg bg-surface-300 border border-surface-400 text-white text-xs font-mono placeholder-surface-500 focus:outline-none focus:border-for-500/50 focus:bg-surface-400/50 transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-[11px] font-mono text-surface-500 mb-1" htmlFor="ev-desc">
            Brief summary <span className="text-surface-600">(optional)</span>
          </label>
          <textarea
            id="ev-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="What does this source say? Why is it relevant?"
            className="w-full px-3 py-2 rounded-lg bg-surface-300 border border-surface-400 text-white text-xs font-mono placeholder-surface-500 focus:outline-none focus:border-for-500/50 focus:bg-surface-400/50 transition-colors resize-none"
          />
        </div>

        {/* Side */}
        <div>
          <span className="block text-[11px] font-mono text-surface-500 mb-1.5">
            This evidence supports…
          </span>
          <div className="flex gap-2">
            {(['for', 'against', 'neutral'] as const).map((s) => {
              const cfg = SIDE_CONFIG[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                    side === s
                      ? cn(cfg.bg, cfg.color, cfg.border)
                      : 'bg-surface-300 text-surface-500 border-surface-400 hover:text-white',
                  )}
                >
                  <cfg.icon className="h-3 w-3" />
                  {cfg.label}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <p className="text-xs font-mono text-against-400">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-surface-300 text-surface-400 text-xs font-mono hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || url.length < 8 || title.length < 5}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Submit
          </button>
        </div>
      </form>
    </motion.div>
  )
}

// ─── Evidence Card ────────────────────────────────────────────────────────────

interface EvidenceCardProps {
  item: EvidenceItem
  viewerId: string | null
  onVote: (id: string, voted: boolean, upvotes: number) => void
  onDelete: (id: string) => void
}

function EvidenceCard({ item, viewerId, onVote, onDelete }: EvidenceCardProps) {
  const [voting, setVoting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const cfg = SIDE_CONFIG[item.side]
  const isOwn = viewerId === item.user_id

  async function handleVote(e: React.MouseEvent) {
    e.preventDefault()
    if (voting || isOwn || !viewerId) return
    setVoting(true)
    try {
      const res = await fetch(`/api/topics/${item.topic_id}/evidence/${item.id}/vote`, {
        method: 'POST',
      })
      if (res.ok) {
        const { voted, upvotes } = await res.json()
        onVote(item.id, voted, upvotes)
      }
    } finally {
      setVoting(false)
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    if (!isOwn || deleting) return
    setDeleting(true)
    try {
      await fetch(`/api/topics/${item.topic_id}/evidence/${item.id}/vote`, {
        method: 'DELETE',
      })
      onDelete(item.id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={cn(
        'rounded-xl border bg-surface-100 overflow-hidden transition-colors hover:border-surface-400/60',
        'border-surface-300/60',
      )}
    >
      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start gap-3">
          <FaviconIcon domain={item.domain} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border', cfg.pill)}>
                {cfg.label}
              </span>
              {item.domain && (
                <span className="text-[10px] font-mono text-surface-600 truncate max-w-[120px]">
                  {item.domain}
                </span>
              )}
            </div>

            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-1 hover:text-for-300 transition-colors"
            >
              <span className="text-sm font-mono font-semibold text-white leading-snug group-hover:underline">
                {item.title}
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-surface-500 group-hover:text-for-400 mt-0.5" />
            </a>
          </div>
        </div>

        {/* Description */}
        {item.description && (
          <div className="mt-2 pl-8">
            <button
              onClick={() => setExpanded((p) => !p)}
              className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Less' : 'Summary'}
            </button>
            <AnimatePresence>
              {expanded && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-[11px] font-mono text-surface-400 leading-relaxed mt-1.5 overflow-hidden"
                >
                  {item.description}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pl-8">
          <div className="flex items-center gap-2">
            {item.author && (
              <div className="flex items-center gap-1.5">
                <Avatar
                  src={item.author.avatar_url}
                  fallback={item.author.display_name || item.author.username}
                  size="xs"
                />
                <span className="text-[11px] font-mono text-surface-500">
                  @{item.author.username}
                </span>
              </div>
            )}
            <span className="text-[10px] font-mono text-surface-600">
              {relativeTime(item.created_at)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isOwn && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Delete submission"
                className="flex items-center justify-center h-6 w-6 rounded-md text-surface-600 hover:text-against-400 hover:bg-against-500/10 transition-colors disabled:opacity-50"
              >
                {deleting
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Trash2 className="h-3 w-3" />
                }
              </button>
            )}
            <button
              onClick={handleVote}
              disabled={voting || isOwn || !viewerId}
              aria-label={item.viewer_voted ? 'Remove upvote' : 'Upvote this evidence'}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all disabled:opacity-50',
                item.viewer_voted
                  ? 'bg-for-500/20 text-for-400 border-for-500/40'
                  : 'bg-surface-200 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400',
                (isOwn || !viewerId) && 'cursor-default',
              )}
            >
              {voting
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <ArrowUpRight className="h-3 w-3" />
              }
              {item.upvotes}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function TopicEvidencePanel({ topicId, className }: TopicEvidencePanelProps) {
  const [data, setData] = useState<EvidenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<SideFilter>('all')
  const [showForm, setShowForm] = useState(false)

  const [analysis, setAnalysis] = useState<EvidenceAnalysisResponse | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysisGenerating, setAnalysisGenerating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/evidence`)
      if (res.ok) {
        const json = (await res.json()) as EvidenceResponse
        setData(json)
      }
    } finally {
      setLoading(false)
    }
  }, [topicId])

  const loadAnalysis = useCallback(async () => {
    setAnalysisLoading(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/evidence-analysis`)
      if (res.ok) {
        const json = (await res.json()) as EvidenceAnalysisResponse
        setAnalysis(json)
        if (json.quality_score !== null) setShowAnalysis(true)
      }
    } finally {
      setAnalysisLoading(false)
    }
  }, [topicId])

  const generateAnalysis = useCallback(async () => {
    setAnalysisGenerating(true)
    setShowAnalysis(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/evidence-analysis`, { method: 'POST' })
      if (res.ok) {
        const json = (await res.json()) as EvidenceAnalysisResponse
        setAnalysis(json)
      }
    } finally {
      setAnalysisGenerating(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadAnalysis() }, [loadAnalysis])

  function handleSubmitted(item: EvidenceItem) {
    setData((prev) => {
      if (!prev) return prev
      const items = [item, ...prev.items]
      return {
        ...prev,
        items,
        counts: {
          for:     items.filter((i) => i.side === 'for').length,
          against: items.filter((i) => i.side === 'against').length,
          neutral: items.filter((i) => i.side === 'neutral').length,
          total:   items.length,
        },
      }
    })
  }

  function handleVote(id: string, voted: boolean, upvotes: number) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((i) =>
              i.id === id ? { ...i, viewer_voted: voted, upvotes } : i,
            ),
          }
        : prev,
    )
  }

  function handleDelete(id: string) {
    setData((prev) => {
      if (!prev) return prev
      const items = prev.items.filter((i) => i.id !== id)
      return {
        ...prev,
        items,
        counts: {
          for:     items.filter((i) => i.side === 'for').length,
          against: items.filter((i) => i.side === 'against').length,
          neutral: items.filter((i) => i.side === 'neutral').length,
          total:   items.length,
        },
      }
    })
  }

  const visible = data
    ? filter === 'all'
      ? data.items
      : data.items.filter((i) => i.side === filter)
    : []

  const isLoggedIn = data?.viewer_id != null

  return (
    <section className={cn('space-y-4', className)} aria-label="Community Evidence Board">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-mono text-sm font-bold text-white flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-purple" aria-hidden />
            Evidence Board
          </h2>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">
            Community-submitted sources ranked by upvotes
          </p>
        </div>
        {isLoggedIn && (
          <button
            onClick={() => setShowForm((p) => !p)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
              showForm
                ? 'bg-surface-300 text-surface-400 border-surface-400'
                : 'bg-purple/80 hover:bg-purple text-white border-purple/50',
            )}
          >
            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showForm ? 'Cancel' : 'Add Evidence'}
          </button>
        )}
      </div>

      {/* Submit form */}
      <AnimatePresence>
        {showForm && (
          <SubmitForm
            topicId={topicId}
            onSubmitted={handleSubmitted}
            onClose={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>

      {/* Counts + filter pills */}
      {!loading && data && data.counts.total > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { id: 'all' as const, label: `All (${data.counts.total})` },
              { id: 'for' as const, label: `FOR (${data.counts.for})` },
              { id: 'against' as const, label: `AGAINST (${data.counts.against})` },
              { id: 'neutral' as const, label: `Neutral (${data.counts.neutral})` },
            ] as const
          ).map(({ id, label }) => {
            const cfg = id !== 'all' ? SIDE_CONFIG[id] : null
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  'flex-shrink-0 px-2.5 py-1 rounded-full font-mono text-[11px] font-semibold border transition-all',
                  filter === id
                    ? cfg
                      ? cn(cfg.bg, cfg.color, cfg.border)
                      : 'bg-surface-300 text-white border-surface-400'
                    : 'bg-surface-200 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-16 rounded-full" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                </div>
              </div>
              <div className="pl-8 flex justify-between">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-6 w-12 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={
            filter !== 'all'
              ? `No ${filter === 'for' ? 'FOR' : filter === 'against' ? 'AGAINST' : 'neutral'} evidence yet`
              : 'No evidence submitted yet'
          }
          description={
            isLoggedIn
              ? 'Be the first to add a credible source that informs this debate.'
              : 'Sign in to submit evidence for this topic.'
          }
          action={
            isLoggedIn && filter === 'all' ? (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple text-white text-xs font-mono font-semibold hover:bg-purple/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add the first source
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {visible.map((item) => (
              <EvidenceCard
                key={item.id}
                item={item}
                viewerId={data?.viewer_id ?? null}
                onVote={handleVote}
                onDelete={handleDelete}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── AI Evidence Analysis ───────────────────────────────────────── */}
      {!loading && data && data.counts.total >= 3 && !analysis?.unavailable && (
        <div className="rounded-xl border border-purple/20 bg-purple/5 overflow-hidden">
          {/* Trigger bar */}
          <button
            onClick={() => {
              if (showAnalysis && analysis?.quality_score !== null) {
                setShowAnalysis(false)
              } else if (!analysis?.quality_score) {
                generateAnalysis()
              } else {
                setShowAnalysis(true)
              }
            }}
            disabled={analysisGenerating}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-purple/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-purple shrink-0" />
              <span className="text-xs font-mono font-semibold text-purple">
                {analysis?.quality_score !== null && analysis?.quality_score !== undefined
                  ? 'AI Evidence Analysis'
                  : 'Analyze Evidence Quality'}
              </span>
              {analysis?.quality_score !== null && analysis?.quality_score !== undefined && (
                <span className="text-[10px] font-mono text-surface-500">
                  · Quality {analysis.quality_score}/10 · Balance {analysis.bias_score}/10
                </span>
              )}
            </div>
            {analysisGenerating || analysisLoading ? (
              <Loader2 className="h-3.5 w-3.5 text-purple animate-spin shrink-0" />
            ) : analysis?.quality_score !== null && analysis?.quality_score !== undefined ? (
              showAnalysis ? (
                <ChevronUp className="h-3.5 w-3.5 text-surface-500 shrink-0" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-surface-500 shrink-0" />
              )
            ) : (
              <BarChart2 className="h-3.5 w-3.5 text-purple/60 shrink-0" />
            )}
          </button>

          {/* Analysis panel */}
          <AnimatePresence>
            {showAnalysis && (analysisGenerating || (analysis?.quality_score !== null && analysis?.quality_score !== undefined)) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-purple/20"
              >
                {analysisGenerating ? (
                  <div className="px-4 py-5 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-mono text-purple">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Analyzing {data?.counts.total} evidence items…
                    </div>
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-4/5 rounded" />
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <Skeleton className="h-16 rounded-lg" />
                      <Skeleton className="h-16 rounded-lg" />
                    </div>
                  </div>
                ) : analysis ? (
                  <div className="px-4 py-4 space-y-4">
                    {/* Score bars */}
                    <div className="grid grid-cols-2 gap-3">
                      <EvidenceScoreBar
                        label="Quality"
                        score={analysis.quality_score ?? 0}
                        max={10}
                        colorClass="bg-emerald"
                        helpText="Source credibility & reliability"
                      />
                      <EvidenceScoreBar
                        label="Balance"
                        score={analysis.bias_score ?? 0}
                        max={10}
                        colorClass="bg-purple"
                        helpText="FOR vs AGAINST coverage"
                      />
                    </div>

                    {/* Summary */}
                    {analysis.summary && (
                      <p className="text-xs font-mono text-surface-400 leading-relaxed">
                        {analysis.summary}
                      </p>
                    )}

                    {/* Strongest items */}
                    {(analysis.strongest_for || analysis.strongest_against) && (
                      <div className="space-y-2">
                        {analysis.strongest_for && (
                          <div className="flex items-start gap-2 rounded-lg bg-for-500/10 border border-for-500/20 px-3 py-2">
                            <ThumbsUp className="h-3 w-3 text-for-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-mono text-for-400 font-semibold mb-0.5">Strongest FOR</p>
                              <p className="text-[11px] font-mono text-surface-300">{analysis.strongest_for}</p>
                            </div>
                          </div>
                        )}
                        {analysis.strongest_against && (
                          <div className="flex items-start gap-2 rounded-lg bg-against-500/10 border border-against-500/20 px-3 py-2">
                            <ThumbsDown className="h-3 w-3 text-against-400 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[10px] font-mono text-against-400 font-semibold mb-0.5">Strongest AGAINST</p>
                              <p className="text-[11px] font-mono text-surface-300">{analysis.strongest_against}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Key claim */}
                    {analysis.key_claim && (
                      <div className="flex items-start gap-2 rounded-lg bg-surface-300/30 border border-surface-400/30 px-3 py-2">
                        <BarChart2 className="h-3 w-3 text-gold shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-mono text-gold font-semibold mb-0.5">Key Claim</p>
                          <p className="text-[11px] font-mono text-surface-300">{analysis.key_claim}</p>
                        </div>
                      </div>
                    )}

                    {/* Missing perspective */}
                    {analysis.missing_perspective && (
                      <div className="flex items-start gap-2 rounded-lg bg-surface-300/20 border border-surface-400/20 px-3 py-2">
                        <AlertCircle className="h-3 w-3 text-surface-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-mono text-surface-500 font-semibold mb-0.5">Missing Perspective</p>
                          <p className="text-[11px] font-mono text-surface-400">{analysis.missing_perspective}</p>
                        </div>
                      </div>
                    )}

                    {/* Refresh + generated time */}
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-[10px] font-mono text-surface-600">
                        {analysis.generated_at
                          ? `Generated ${new Date(analysis.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : 'AI-generated analysis'}
                      </p>
                      <button
                        onClick={generateAnalysis}
                        disabled={analysisGenerating}
                        className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-purple transition-colors"
                        title="Refresh analysis"
                      >
                        <RefreshCw className="h-2.5 w-2.5" />
                        Refresh
                      </button>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Footer note */}
      {!loading && data && data.counts.total > 0 && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-mono text-surface-600">
            Sorted by community upvotes · {data.counts.total} source{data.counts.total !== 1 ? 's' : ''} submitted
          </p>
          <NextLink
            href="/evidence"
            className="text-[10px] font-mono text-surface-500 hover:text-emerald transition-colors flex items-center gap-1 shrink-0"
          >
            Browse library
            <ArrowUpRight className="h-2.5 w-2.5" />
          </NextLink>
        </div>
      )}
    </section>
  )
}

// ─── Score bar sub-component ──────────────────────────────────────────────────

function EvidenceScoreBar({
  label,
  score,
  max,
  colorClass,
  helpText,
}: {
  label: string
  score: number
  max: number
  colorClass: string
  helpText: string
}) {
  const pct = Math.round((score / max) * 100)
  return (
    <div className="rounded-lg bg-surface-300/30 border border-surface-400/20 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-semibold text-surface-400">{label}</span>
        <span className="text-sm font-mono font-bold text-white">{score}<span className="text-surface-600 text-[10px]">/{max}</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-400/40 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', colorClass)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <p className="text-[9px] font-mono text-surface-600">{helpText}</p>
    </div>
  )
}
