'use client'

/**
 * /topic/[id]/hindsight — Civic Hindsight
 *
 * After a topic resolves (law or failed), citizens re-evaluate:
 * was the community's decision the right one?
 *
 * Distinct from:
 *   /topic/[id]/autopsy  — forensic analysis of the debate itself
 *   /topic/[id]/legacy   — long-term impact of the decision
 *   /topic/[id]/recap    — chronological recap of events
 *   /topic/[id]/reasons  — why people voted the way they did
 *
 * This is forward-looking in hindsight: now that we know the outcome,
 * was the majority right?
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Send,
  ThumbsDown,
  ThumbsUp,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  HindsightResponse,
  HindsightEntry,
  HindsightVerdict,
} from '@/app/api/topics/[id]/hindsight/route'

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

const ROLE_COLOR: Record<string, string> = {
  elder: 'text-gold',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  senator: 'text-purple',
  lawmaker: 'text-gold',
  person: 'text-surface-500',
}

function wisdomLabel(score: number): { label: string; color: string; description: string } {
  if (score >= 80) return {
    label: 'Strong Wisdom',
    color: 'text-emerald',
    description: 'The community overwhelmingly agrees this was the right call.',
  }
  if (score >= 60) return {
    label: 'Moderate Wisdom',
    color: 'text-for-400',
    description: 'Most citizens looking back believe the decision was correct.',
  }
  if (score >= 40) return {
    label: 'Contested',
    color: 'text-gold',
    description: 'Opinion is divided on whether this was the right outcome.',
  }
  if (score >= 20) return {
    label: 'Questioned',
    color: 'text-against-300',
    description: 'Many citizens now doubt the original decision.',
  }
  return {
    label: 'Regretted',
    color: 'text-against-400',
    description: 'In hindsight, most citizens believe the community got this wrong.',
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HindsightClient() {
  const { id } = useParams<{ id: string }>()

  const [data, setData] = useState<HindsightResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [selectedVerdict, setSelectedVerdict] = useState<HindsightVerdict | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/topics/${id}/hindsight`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to load')
      }
      const json: HindsightResponse = await res.json()
      setData(json)
      if (json.viewer_vote) {
        setSelectedVerdict(json.viewer_vote.verdict)
        setNote(json.viewer_vote.note ?? '')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSubmit = async () => {
    if (!selectedVerdict) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/topics/${id}/hindsight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: selectedVerdict, note: note.trim() || null }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to submit')
      }
      setShowForm(false)
      await fetchData()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await fetch(`/api/topics/${id}/hindsight`, { method: 'DELETE' })
      setSelectedVerdict(null)
      setNote('')
      setShowForm(false)
      await fetchData()
    } finally {
      setDeleting(false)
    }
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto w-full px-4 py-6 pb-24 space-y-6">
          <Skeleton className="h-5 w-24" />
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-4 pt-2">
              <Skeleton className="h-20 flex-1 rounded-xl" />
              <Skeleton className="h-20 flex-1 rounded-xl" />
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <div className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </div>
          ))}
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto w-full px-4 py-6 pb-24">
          <div className="text-center py-20 space-y-4">
            <p className="text-surface-500 text-sm">{error ?? 'Failed to load'}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 text-xs text-for-400 hover:text-for-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { topic, stats, entries, viewer_vote } = data
  const isLaw = topic.status === 'law'
  const originalForPct = Math.round(topic.blue_pct)
  const { label: wisLabel, color: wisColor, description: wisDesc } = wisdomLabel(stats.wisdom_score)
  const hasVoted = viewer_vote !== null

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto w-full px-4 py-6 pb-24 space-y-5">

        {/* Back link */}
        <Link
          href={`/topic/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to topic
        </Link>

        {/* Header card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                'text-[11px] font-mono px-2 py-0.5 rounded-full border',
                isLaw
                  ? 'text-emerald border-emerald/30 bg-emerald/10'
                  : 'text-against-400 border-against-400/30 bg-against-400/10'
              )}>
                {isLaw ? 'Law' : 'Failed'}
              </span>
              {topic.category && (
                <span className="text-[11px] font-mono text-surface-500">{topic.category}</span>
              )}
            </div>
            <h1 className="text-base font-semibold text-white leading-snug">
              {topic.statement}
            </h1>
          </div>

          {/* Original vote split */}
          <div className="text-[11px] font-mono text-surface-500 flex items-center gap-3 flex-wrap">
            <span className="text-for-400">{originalForPct}% voted FOR</span>
            <span>·</span>
            <span className="text-against-400">{100 - originalForPct}% voted AGAINST</span>
            <span>·</span>
            <span>{topic.total_votes.toLocaleString()} total votes</span>
          </div>

          {/* Vote bars — original */}
          <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
            <div
              className="bg-for-500 rounded-l-full transition-all duration-500"
              style={{ width: `${originalForPct}%` }}
            />
            <div
              className="bg-against-500 rounded-r-full transition-all duration-500"
              style={{ width: `${100 - originalForPct}%` }}
            />
          </div>

          {/* Wisdom score */}
          {stats.total > 0 && (
            <div className="pt-2 border-t border-surface-300 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-surface-500" />
                  <span className="text-xs font-mono text-surface-400">Hindsight Wisdom</span>
                </div>
                <span className={cn('text-xs font-mono font-semibold', wisColor)}>
                  {wisLabel}
                </span>
              </div>

              {/* Right vs wrong bars */}
              <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
                <div
                  className="bg-emerald rounded-l-full transition-all duration-700"
                  style={{ width: `${stats.right_pct}%` }}
                />
                <div
                  className="bg-against-500 rounded-r-full transition-all duration-700"
                  style={{ width: `${100 - stats.right_pct}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] font-mono text-surface-500">
                <span className="text-emerald">{stats.right_pct}% say the community was right</span>
                <span className="text-against-400">{100 - stats.right_pct}% say wrong</span>
              </div>

              <p className="text-xs text-surface-500 italic">{wisDesc}</p>

              <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
                <span>{stats.total.toLocaleString()} hindsight {stats.total === 1 ? 'vote' : 'votes'}</span>
                {stats.total > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-emerald">{stats.right_count} right</span>
                    <span>·</span>
                    <span className="text-against-400">{stats.wrong_count} wrong</span>
                  </>
                )}
              </div>
            </div>
          )}

          {stats.total === 0 && (
            <div className="pt-2 border-t border-surface-300">
              <p className="text-xs text-surface-500 italic">
                No hindsight votes yet. Be the first to re-evaluate this outcome.
              </p>
            </div>
          )}
        </div>

        {/* CTA — cast or update your hindsight vote */}
        <AnimatePresence mode="wait">
          {!showForm ? (
            <motion.div
              key="cta"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              {hasVoted ? (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-surface-400">Your hindsight verdict</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowForm(true)}
                        className="text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="text-[11px] font-mono text-surface-500 hover:text-against-300 transition-colors disabled:opacity-50"
                      >
                        {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Remove'}
                      </button>
                    </div>
                  </div>
                  <div className={cn(
                    'flex items-center gap-2.5 p-3 rounded-xl border',
                    viewer_vote!.verdict === 'right'
                      ? 'bg-emerald/10 border-emerald/30'
                      : 'bg-against-500/10 border-against-500/30'
                  )}>
                    {viewer_vote!.verdict === 'right' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-against-400 shrink-0" />
                    )}
                    <span className={cn(
                      'text-sm font-semibold',
                      viewer_vote!.verdict === 'right' ? 'text-emerald' : 'text-against-300'
                    )}>
                      {viewer_vote!.verdict === 'right'
                        ? 'The community got this right'
                        : 'The community got this wrong'}
                    </span>
                  </div>
                  {viewer_vote!.note && (
                    <p className="text-xs text-surface-400 italic">&ldquo;{viewer_vote!.note}&rdquo;</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  className={cn(
                    'w-full rounded-2xl border border-surface-300 bg-surface-100',
                    'p-5 text-left space-y-1',
                    'hover:border-for-500/40 hover:bg-surface-200 transition-colors group'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
                    <span className="text-sm font-semibold text-surface-400 group-hover:text-white transition-colors">
                      Share your hindsight
                    </span>
                  </div>
                  <p className="text-xs text-surface-500 pl-6">
                    Now that you know the outcome — was the community right or wrong?
                  </p>
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Your hindsight verdict</span>
                <button
                  onClick={() => { setShowForm(false); setSubmitError(null) }}
                  className="text-surface-500 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Verdict buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedVerdict('right')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                    selectedVerdict === 'right'
                      ? 'bg-emerald/15 border-emerald/50 ring-1 ring-emerald/30'
                      : 'bg-surface-200 border-surface-300 hover:border-emerald/30 hover:bg-emerald/5'
                  )}
                >
                  <ThumbsUp className={cn(
                    'h-5 w-5 transition-colors',
                    selectedVerdict === 'right' ? 'text-emerald' : 'text-surface-500'
                  )} />
                  <span className={cn(
                    'text-xs font-mono font-semibold transition-colors',
                    selectedVerdict === 'right' ? 'text-emerald' : 'text-surface-400'
                  )}>
                    Right call
                  </span>
                  <span className="text-[11px] text-surface-500 text-center leading-snug">
                    The community made the correct decision
                  </span>
                </button>

                <button
                  onClick={() => setSelectedVerdict('wrong')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border transition-all',
                    selectedVerdict === 'wrong'
                      ? 'bg-against-500/15 border-against-500/50 ring-1 ring-against-500/30'
                      : 'bg-surface-200 border-surface-300 hover:border-against-500/30 hover:bg-against-500/5'
                  )}
                >
                  <ThumbsDown className={cn(
                    'h-5 w-5 transition-colors',
                    selectedVerdict === 'wrong' ? 'text-against-400' : 'text-surface-500'
                  )} />
                  <span className={cn(
                    'text-xs font-mono font-semibold transition-colors',
                    selectedVerdict === 'wrong' ? 'text-against-300' : 'text-surface-400'
                  )}>
                    Wrong call
                  </span>
                  <span className="text-[11px] text-surface-500 text-center leading-snug">
                    The community got this one wrong
                  </span>
                </button>
              </div>

              {/* Optional note */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-surface-500">
                  Explain your view (optional)
                </label>
                <textarea
                  ref={noteRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 200))}
                  placeholder="What changed, what you learned, or why you think the community was right/wrong…"
                  rows={3}
                  className={cn(
                    'w-full rounded-xl bg-surface-200 border border-surface-300 resize-none',
                    'text-sm text-white placeholder:text-surface-600',
                    'px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-for-500/40 focus:border-for-500/50',
                    'transition-colors'
                  )}
                />
                <div className="flex justify-end">
                  <span className={cn(
                    'text-[10px] font-mono transition-colors',
                    note.length > 180 ? 'text-against-400' : 'text-surface-600'
                  )}>
                    {note.length}/200
                  </span>
                </div>
              </div>

              {submitError && (
                <p className="text-xs text-against-400">{submitError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowForm(false); setSubmitError(null) }}
                  className="flex-1 py-2.5 rounded-xl border border-surface-300 text-sm text-surface-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedVerdict || submitting}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl',
                    'text-sm font-semibold transition-all',
                    selectedVerdict
                      ? 'bg-for-600 hover:bg-for-500 text-white'
                      : 'bg-surface-300 text-surface-500 cursor-not-allowed'
                  )}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      Submit
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Entries list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-surface-500" />
              Hindsight verdicts
              {stats.total > 0 && (
                <span className="text-[11px] font-mono text-surface-500">({stats.total})</span>
              )}
            </h2>
            {stats.total > 0 && (
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            )}
          </div>

          {entries.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No verdicts yet"
              description="Be the first to share your hindsight perspective on this outcome."
            />
          ) : (
            <div className="space-y-3">
              {entries.map((entry, i) => (
                <HindsightEntryCard key={entry.id} entry={entry} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Quiet footer links */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
          <Link
            href={`/topic/${id}/autopsy`}
            className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            → Debate Autopsy
          </Link>
          <Link
            href={`/topic/${id}/legacy`}
            className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            → Civic Legacy
          </Link>
          <Link
            href={`/topic/${id}/recap`}
            className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            → Full Recap
          </Link>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function HindsightEntryCard({ entry, index }: { entry: HindsightEntry; index: number }) {
  const isRight = entry.verdict === 'right'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3',
        isRight
          ? 'bg-emerald/5 border-emerald/20'
          : 'bg-against-500/5 border-against-500/20'
      )}
    >
      {/* User row */}
      <div className="flex items-center gap-2.5">
        <Link href={`/profile/${entry.username}`}>
          <Avatar
            src={entry.avatar_url}
            username={entry.username}
            size="sm"
            className="ring-1 ring-surface-300"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/profile/${entry.username}`}
              className="text-xs font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {entry.display_name ?? entry.username}
            </Link>
            <span className={cn('text-[10px] font-mono', ROLE_COLOR[entry.role] ?? 'text-surface-500')}>
              {entry.role}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-surface-500">
            <Clock className="h-2.5 w-2.5" />
            {relativeTime(entry.created_at)}
          </div>
        </div>

        {/* Verdict badge */}
        <div className={cn(
          'shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-mono font-semibold',
          isRight
            ? 'text-emerald border-emerald/30 bg-emerald/10'
            : 'text-against-300 border-against-300/30 bg-against-300/10'
        )}>
          {isRight ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {isRight ? 'Right' : 'Wrong'}
        </div>
      </div>

      {/* Note */}
      {entry.note && (
        <p className="text-sm text-surface-300 leading-relaxed pl-0.5 italic">
          &ldquo;{entry.note}&rdquo;
        </p>
      )}
    </motion.div>
  )
}
