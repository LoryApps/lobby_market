'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  Loader2,
  Plus,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { Amendment, AmendmentsResponse } from '@/app/api/laws/[id]/amendments/route'

const RATIFY_PCT   = 60
const RATIFY_MIN   = 20

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Mini amendment row ───────────────────────────────────────────────────────

function MiniAmendment({
  amendment: a,
  onVote,
}: {
  amendment: Amendment
  onVote: (id: string, vote: boolean | null) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [localVote, setLocalVote] = useState<boolean | null>(a.user_vote)
  const [forCount, setFor]   = useState(a.for_count)
  const [against, setAgainst] = useState(a.against_count)
  const [busy, setBusy]       = useState(false)

  const total = forCount + against
  const pct   = total > 0 ? Math.round((forCount / total) * 100) : 0
  const isPending = a.status === 'pending'

  async function handleVote(vote: boolean) {
    if (busy || !isPending) return
    setBusy(true)
    const nextVote = localVote === vote ? null : vote
    const prev = { vote: localVote, for: forCount, against }

    setLocalVote(nextVote)
    if (nextVote === true) {
      setFor((c) => c + 1)
      if (prev.vote === false) setAgainst((c) => c - 1)
    } else if (nextVote === false) {
      setAgainst((c) => c + 1)
      if (prev.vote === true) setFor((c) => c - 1)
    } else {
      if (prev.vote === true)  setFor((c) => c - 1)
      if (prev.vote === false) setAgainst((c) => c - 1)
    }

    try {
      await onVote(a.id, nextVote)
    } catch {
      setLocalVote(prev.vote)
      setFor(prev.for)
      setAgainst(prev.against)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-3.5 space-y-2.5"
    >
      {/* Title row */}
      <div className="flex items-start gap-2">
        <Edit3 className="h-3 w-3 text-gold flex-shrink-0 mt-0.5" />
        <p className="text-xs font-semibold text-white leading-snug flex-1 min-w-0">
          {a.title}
        </p>
        {a.status === 'ratified' && (
          <CheckCircle2 className="h-3 w-3 text-emerald flex-shrink-0" />
        )}
      </div>

      {/* Body (expandable) */}
      <div>
        <p className={cn('text-[11px] text-surface-400 leading-relaxed', !expanded && 'line-clamp-2')}>
          {a.body}
        </p>
        {a.body.length > 100 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-[10px] font-mono text-surface-600 hover:text-surface-400 flex items-center gap-0.5 mt-0.5"
          >
            {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
            {expanded ? 'Less' : 'More'}
          </button>
        )}
      </div>

      {/* Vote bar */}
      {total > 0 && (
        <div className="h-1 rounded-full bg-surface-300 overflow-hidden flex">
          <div
            className={cn('h-full transition-all duration-500', pct >= RATIFY_PCT ? 'bg-emerald' : 'bg-for-500')}
            style={{ width: `${pct}%` }}
          />
          <div
            className="h-full bg-against-500 ml-auto"
            style={{ width: `${100 - pct}%` }}
          />
        </div>
      )}

      {/* Metadata + vote buttons */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {a.proposer && (
            <Avatar src={a.proposer.avatar_url} fallback={a.proposer.username} size="xs" />
          )}
          <span className="text-[10px] font-mono text-surface-600 truncate">
            {a.proposer ? `@${a.proposer.username}` : 'Unknown'} · {relativeTime(a.created_at)}
          </span>
          {isPending && (
            <span className="text-[10px] font-mono text-surface-700 flex-shrink-0">
              · {total}/{RATIFY_MIN}
            </span>
          )}
        </div>

        {isPending && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => handleVote(true)}
              disabled={busy}
              aria-label="Support amendment"
              className={cn(
                'inline-flex items-center gap-0.5 h-6 px-2 rounded-lg text-[10px] font-mono font-semibold border transition-all disabled:opacity-50',
                localVote === true
                  ? 'bg-emerald/20 border-emerald/50 text-emerald'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-emerald hover:border-emerald/50',
              )}
            >
              {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <ThumbsUp className="h-2.5 w-2.5" />}
              {forCount}
            </button>
            <button
              onClick={() => handleVote(false)}
              disabled={busy}
              aria-label="Oppose amendment"
              className={cn(
                'inline-flex items-center gap-0.5 h-6 px-2 rounded-lg text-[10px] font-mono font-semibold border transition-all disabled:opacity-50',
                localVote === false
                  ? 'bg-against-500/20 border-against-500/50 text-against-400'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-against-400 hover:border-against-500/50',
              )}
            >
              {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <ThumbsDown className="h-2.5 w-2.5" />}
              {against}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Propose form ─────────────────────────────────────────────────────────────

function ProposeForm({ lawId, onSuccess }: { lawId: string; onSuccess: () => void }) {
  const [title, setTitle]   = useState('')
  const [body, setBody]     = useState('')
  const [submitting, setSub] = useState(false)
  const [err, setErr]        = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSub(true)
    setErr(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/amendments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setTitle('')
      setBody('')
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to submit')
    } finally {
      setSub(false)
    }
  }

  const titleLen = title.trim().length
  const bodyLen  = body.trim().length
  const valid    = titleLen >= 5 && titleLen <= 120 && bodyLen >= 20 && bodyLen <= 1000

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Amendment title (5–120 chars)"
          className={cn(
            'w-full px-3 py-2 rounded-xl bg-surface-200 border text-sm text-white placeholder:text-surface-600',
            'focus:outline-none focus:ring-1 transition-colors',
            titleLen > 0 && (titleLen < 5 || titleLen > 120)
              ? 'border-against-500/50 focus:ring-against-500/40'
              : 'border-surface-300 focus:border-gold/50 focus:ring-gold/20',
          )}
        />
        <div className="flex justify-end mt-0.5">
          <span className={cn('text-[10px] font-mono', titleLen > 120 ? 'text-against-400' : 'text-surface-600')}>
            {titleLen}/120
          </span>
        </div>
      </div>

      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Describe the proposed change and why it improves the law (20–1000 chars)"
          className={cn(
            'w-full px-3 py-2 rounded-xl bg-surface-200 border text-sm text-white placeholder:text-surface-600',
            'focus:outline-none focus:ring-1 transition-colors resize-none',
            bodyLen > 0 && (bodyLen < 20 || bodyLen > 1000)
              ? 'border-against-500/50 focus:ring-against-500/40'
              : 'border-surface-300 focus:border-gold/50 focus:ring-gold/20',
          )}
        />
        <div className="flex justify-end mt-0.5">
          <span className={cn('text-[10px] font-mono', bodyLen > 1000 ? 'text-against-400' : 'text-surface-600')}>
            {bodyLen}/1000
          </span>
        </div>
      </div>

      {err && (
        <p className="text-[11px] font-mono text-against-400">{err}</p>
      )}

      <button
        type="submit"
        disabled={!valid || submitting}
        className={cn(
          'w-full h-9 rounded-xl text-xs font-mono font-semibold border transition-all',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          valid
            ? 'bg-gold/20 border-gold/50 text-gold hover:bg-gold/30'
            : 'bg-surface-200 border-surface-300 text-surface-500',
        )}
      >
        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Submit Amendment Proposal'}
      </button>
    </form>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function LawAmendmentsPanel({ lawId }: { lawId: string }) {
  const [amendments, setAmendments] = useState<Amendment[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laws/${lawId}/amendments`)
      if (!res.ok) return
      const data: AmendmentsResponse = await res.json()
      setAmendments(data.amendments)
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  async function handleVote(amendmentId: string, vote: boolean | null) {
    const res = await fetch(`/api/amendments/${amendmentId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote }),
    })
    if (!res.ok) throw new Error('Vote failed')
    const data = await res.json()
    setAmendments((prev) =>
      prev.map((a) =>
        a.id === amendmentId
          ? { ...a, for_count: data.for_count, against_count: data.against_count, user_vote: data.user_vote }
          : a
      )
    )
  }

  const pending  = amendments.filter((a) => a.status === 'pending')
  const ratified = amendments.filter((a) => a.status === 'ratified')

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300">
        <div className="flex items-center gap-2">
          <Edit3 className="h-3.5 w-3.5 text-gold" />
          <span className="text-xs font-mono font-semibold text-white">Amendments</span>
          {amendments.length > 0 && (
            <span className="text-[10px] font-mono text-surface-600 bg-surface-200 rounded-full px-1.5 py-0.5">
              {amendments.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/amendments"
            className="text-[10px] font-mono text-surface-500 hover:text-gold transition-colors flex items-center gap-0.5"
          >
            All <ArrowRight className="h-2.5 w-2.5" />
          </Link>
          <button
            onClick={() => setShowForm((s) => !s)}
            aria-label={showForm ? 'Cancel' : 'Propose amendment'}
            className={cn(
              'h-6 w-6 rounded-lg border flex items-center justify-center transition-colors',
              showForm
                ? 'bg-surface-300 border-surface-400 text-surface-400'
                : 'bg-gold/10 border-gold/30 text-gold hover:bg-gold/20',
            )}
          >
            {showForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Propose form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <ProposeForm
                lawId={lawId}
                onSuccess={() => { setShowForm(false); load() }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-surface-500" />
          </div>
        )}

        {/* Pending amendments */}
        {!loading && pending.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              Open for voting
            </p>
            {pending.map((a) => (
              <MiniAmendment key={a.id} amendment={a} onVote={handleVote} />
            ))}
          </div>
        )}

        {/* Ratified amendments */}
        {!loading && ratified.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald" />
              Ratified
            </p>
            {ratified.map((a) => (
              <MiniAmendment key={a.id} amendment={a} onVote={handleVote} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && amendments.length === 0 && !showForm && (
          <div className="text-center py-4">
            <p className="text-xs font-mono text-surface-600">No amendments proposed yet.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 text-[11px] font-mono text-gold hover:text-gold/80 transition-colors"
            >
              Be the first to propose one
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
