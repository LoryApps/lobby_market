'use client'

/**
 * /relay — Civic Relay
 *
 * A collaborative argument-chaining format. One user starts a relay with
 * an opening argument on a topic; up to 4 others each add one leg, building
 * a collective case FOR or AGAINST the motion. When all 5 legs are in, the
 * community votes on whether the chain is "Compelling" or "Not Compelling."
 *
 * Distinct from:
 *   /arguments       — solo arguments
 *   /spar/[topicId]  — adversarial AI opponent
 *   /debates         — structured timed live events
 *   /steelman        — AI counter-argument generator
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Link2,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RelayRow, RelaysResponse } from '@/app/api/relays/route'

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

const STATUS_CONFIG: Record<
  RelayRow['status'],
  { label: string; color: string; bg: string; border: string }
> = {
  open:        { label: 'Open',        color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  in_progress: { label: 'In Progress', color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  complete:    { label: 'Complete',    color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  voted:       { label: 'Voted',       color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
}

// ─── Leg Step indicator ───────────────────────────────────────────────────────

function LegSteps({ total, filled }: { total: number; filled: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-all duration-300',
            i < filled
              ? 'bg-for-500'
              : 'bg-surface-300'
          )}
        />
      ))}
    </div>
  )
}

// ─── Relay Card ───────────────────────────────────────────────────────────────

function RelayCard({
  relay,
  onJoin,
  onVote,
  expanded,
  onToggle,
}: {
  relay: RelayRow
  onJoin: (relay: RelayRow) => void
  onVote: (relayId: string, vote: 'compelling' | 'not_compelling') => void
  expanded: boolean
  onToggle: () => void
}) {
  const cfg = STATUS_CONFIG[relay.status]
  const totalVotes = relay.vote_compelling + relay.vote_not_compelling
  const compellingPct = totalVotes > 0 ? Math.round((relay.vote_compelling / totalVotes) * 100) : null
  const canJoin = ['open', 'in_progress'].includes(relay.status) && !relay.user_has_leg
  const canVote = relay.status === 'complete' && !relay.user_vote

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-surface-200/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <Avatar
            src={relay.starter_avatar_url}
            fallback={relay.starter_display_name || relay.starter_username}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Link
                href={`/profile/${relay.starter_username}`}
                className="text-xs font-mono text-surface-600 hover:text-white transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                @{relay.starter_username}
              </Link>
              <span className="text-surface-600 text-xs">·</span>
              <span className="text-surface-600 text-xs">{relativeTime(relay.created_at)}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  cfg.color, cfg.bg, cfg.border
                )}
              >
                {cfg.label}
              </span>
            </div>

            {relay.topic_statement && (
              <Link
                href={`/topic/${relay.topic_id}`}
                className="block text-xs text-surface-500 hover:text-white transition-colors truncate mb-2"
                onClick={(e) => e.stopPropagation()}
              >
                <span className={cn(
                  'mr-1 font-mono text-[10px] font-bold uppercase tracking-wide',
                  relay.side === 'for' ? 'text-for-400' : 'text-against-400'
                )}>
                  {relay.side === 'for' ? 'FOR' : 'AGAINST'}
                </span>
                {relay.topic_statement}
              </Link>
            )}

            {/* Opening leg preview */}
            {relay.legs[0] && (
              <p className="text-sm text-surface-700 line-clamp-2">
                &ldquo;{relay.legs[0].content}&rdquo;
              </p>
            )}
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <div className="flex items-center gap-1 text-xs text-surface-500">
              <Users className="h-3 w-3" />
              <span className="font-mono">{relay.legs.length}/{relay.max_legs}</span>
            </div>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-surface-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-surface-500" />
            )}
          </div>
        </div>

        {/* Leg progress bar */}
        <div className="mt-3">
          <LegSteps total={relay.max_legs} filled={relay.legs.length} />
        </div>
      </button>

      {/* Expanded: all legs + actions */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-surface-300 pt-4">
              {/* Chain of legs */}
              <div className="space-y-2">
                {relay.legs.map((leg, idx) => (
                  <div key={leg.id} className="flex gap-3">
                    {/* Connector */}
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold flex-shrink-0',
                        relay.side === 'for'
                          ? 'bg-for-500/20 text-for-400 border border-for-500/40'
                          : 'bg-against-500/20 text-against-400 border border-against-500/40'
                      )}>
                        {leg.leg_number}
                      </div>
                      {idx < relay.legs.length - 1 && (
                        <div className="w-px flex-1 bg-surface-300 my-1" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pb-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar
                          src={leg.author?.avatar_url ?? null}
                          fallback={leg.author?.display_name || leg.author?.username || '?'}
                          size="xs"
                        />
                        <Link
                          href={`/profile/${leg.author?.username ?? ''}`}
                          className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                        >
                          @{leg.author?.username ?? 'unknown'}
                        </Link>
                        <span className="text-[10px] text-surface-600">{relativeTime(leg.created_at)}</span>
                      </div>
                      <p className="text-sm text-surface-700 leading-relaxed">{leg.content}</p>
                    </div>
                  </div>
                ))}

                {/* Empty leg slots */}
                {Array.from({ length: relay.max_legs - relay.legs.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full bg-surface-300/30 border border-surface-400/30 flex items-center justify-center text-[10px] font-mono text-surface-600 flex-shrink-0">
                        {relay.legs.length + i + 1}
                      </div>
                      {i < relay.max_legs - relay.legs.length - 1 && (
                        <div className="w-px flex-1 bg-surface-300/40 my-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-2 flex items-center">
                      <span className="text-xs text-surface-600 italic">Waiting for next contributor…</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2 border-t border-surface-300/50 flex-wrap">
                {canJoin && (
                  <Button
                    size="sm"
                    onClick={() => onJoin(relay)}
                    className="flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Your Leg
                  </Button>
                )}

                {relay.status === 'complete' && canVote && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-surface-600">Was this compelling?</span>
                    <button
                      onClick={() => onVote(relay.id, 'compelling')}
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono',
                        'bg-emerald/10 text-emerald border border-emerald/30 hover:bg-emerald/20 transition-colors'
                      )}
                    >
                      <ThumbsUp className="h-3 w-3" /> Yes
                    </button>
                    <button
                      onClick={() => onVote(relay.id, 'not_compelling')}
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono',
                        'bg-against-500/10 text-against-400 border border-against-500/30 hover:bg-against-500/20 transition-colors'
                      )}
                    >
                      <ThumbsDown className="h-3 w-3" /> No
                    </button>
                  </div>
                )}

                {(relay.status === 'voted' || relay.user_vote) && totalVotes > 0 && compellingPct !== null && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="h-1.5 w-24 rounded-full bg-surface-300 overflow-hidden">
                      <div
                        className="h-full bg-emerald rounded-full transition-all"
                        style={{ width: `${compellingPct}%` }}
                      />
                    </div>
                    <span className="text-emerald font-mono font-semibold">{compellingPct}%</span>
                    <span className="text-surface-600">compelling · {totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {relay.user_vote && (
                  <span className="text-xs text-surface-600 flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald" />
                    You voted: <span className="font-mono">{relay.user_vote}</span>
                  </span>
                )}

                {relay.user_has_leg && !canVote && relay.status !== 'voted' && (
                  <span className="text-xs text-for-400 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Your leg is in
                  </span>
                )}

                <Link
                  href={`/relay/${relay.id}`}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors',
                    !relay.topic_id && 'ml-auto'
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link2 className="h-3 w-3" />
                  Permalink
                </Link>

                {relay.topic_id && (
                  <Link
                    href={`/topic/${relay.topic_id}`}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Topic
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── New Relay Modal ──────────────────────────────────────────────────────────

interface NewRelayModalProps {
  onClose: () => void
  onCreated: () => void
}

function NewRelayModal({ onClose, onCreated }: NewRelayModalProps) {
  const [side, setSide] = useState<'for' | 'against'>('for')
  const [topicQuery, setTopicQuery] = useState('')
  const [topicResults, setTopicResults] = useState<Array<{ id: string; statement: string; category: string | null }>>([])
  const [selectedTopic, setSelectedTopic] = useState<{ id: string; statement: string } | null>(null)
  const [content, setContent] = useState('')
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  const searchTopics = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setTopicResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=topics&limit=5`)
      if (!res.ok) return
      const data = (await res.json()) as { topics?: Array<{ id: string; statement: string; category: string | null }> }
      setTopicResults(data.topics ?? [])
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }, [])

  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => searchTopics(topicQuery), 300)
    return () => clearTimeout(searchTimer.current)
  }, [topicQuery, searchTopics])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (content.trim().length < 30) {
      setError('Opening leg must be at least 30 characters')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/relays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopic?.id ?? null,
          side,
          content: content.trim(),
        }),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        setError(d.error ?? 'Failed to start relay')
        return
      }
      onCreated()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const charCount = content.length
  const charOk = charCount >= 30 && charCount <= 300

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-surface-0/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <div>
            <h2 className="text-sm font-mono font-bold text-white">Start a Relay</h2>
            <p className="text-xs text-surface-600 mt-0.5">Open a 5-leg collaborative argument chain</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Side selection */}
          <div>
            <label className="block text-xs font-mono text-surface-600 mb-2">Your Position</label>
            <div className="flex gap-2">
              {(['for', 'against'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wide transition-all',
                    s === 'for'
                      ? side === 'for'
                        ? 'bg-for-600 text-white border border-for-400'
                        : 'bg-surface-200 text-surface-500 border border-surface-300 hover:border-for-500/40'
                      : side === 'against'
                        ? 'bg-against-600 text-white border border-against-400'
                        : 'bg-surface-200 text-surface-500 border border-surface-300 hover:border-against-500/40'
                  )}
                >
                  {s === 'for' ? '👍 For' : '👎 Against'}
                </button>
              ))}
            </div>
          </div>

          {/* Topic search (optional) */}
          <div className="relative">
            <label className="block text-xs font-mono text-surface-600 mb-2">
              Topic <span className="text-surface-700">(optional)</span>
            </label>
            {selectedTopic ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300">
                <Link2 className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                <span className="text-xs text-white flex-1 truncate">{selectedTopic.statement}</span>
                <button
                  type="button"
                  onClick={() => setSelectedTopic(null)}
                  className="text-surface-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
                  <input
                    type="text"
                    value={topicQuery}
                    onChange={(e) => setTopicQuery(e.target.value)}
                    placeholder="Search a topic…"
                    className="w-full pl-8 pr-3 py-2 bg-surface-200 border border-surface-300 rounded-lg text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/50"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 animate-spin" />
                  )}
                </div>
                {topicResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-surface-200 border border-surface-300 rounded-lg shadow-xl overflow-hidden">
                    {topicResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedTopic({ id: t.id, statement: t.statement })
                          setTopicQuery('')
                          setTopicResults([])
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-white hover:bg-surface-300 transition-colors border-b border-surface-300 last:border-0"
                      >
                        <span className="text-surface-600 text-[10px] font-mono mr-1">{t.category}</span>
                        {t.statement}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Opening argument */}
          <div>
            <label className="block text-xs font-mono text-surface-600 mb-2">
              Your Opening Leg
              <span className="ml-2 text-surface-700">30–300 characters</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 300))}
              rows={4}
              placeholder="Start the argument chain — make a clear, evidence-based opening statement for your position…"
              className={cn(
                'w-full px-3 py-2.5 rounded-lg bg-surface-200 border text-sm text-white',
                'placeholder:text-surface-500 font-mono leading-relaxed resize-none',
                'focus:outline-none focus:ring-1 transition-colors',
                charCount > 0 && !charOk
                  ? 'border-against-500/50 focus:border-against-500/70 focus:ring-against-500/30'
                  : 'border-surface-300 focus:border-for-500/50 focus:ring-for-500/30'
              )}
            />
            <div className="flex items-center justify-between mt-1">
              {error && <p className="text-xs text-against-400">{error}</p>}
              <span className={cn(
                'ml-auto text-xs font-mono',
                charCount > 300 ? 'text-against-400' : charCount >= 30 ? 'text-emerald' : 'text-surface-600'
              )}>
                {charCount}/300
              </span>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting || !charOk}
            className="w-full"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Start Relay
              </>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Add Leg Modal ────────────────────────────────────────────────────────────

function AddLegModal({
  relay,
  onClose,
  onAdded,
}: {
  relay: RelayRow
  onClose: () => void
  onAdded: () => void
}) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const prevLeg = relay.legs[relay.legs.length - 1]
  const nextLegNum = relay.legs.length + 1

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (content.trim().length < 30) {
      setError('Leg must be at least 30 characters')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/relays/${relay.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_leg', content: content.trim() }),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        setError(d.error ?? 'Failed to add leg')
        return
      }
      onAdded()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const charCount = content.length
  const charOk = charCount >= 30 && charCount <= 300

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-surface-0/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <div>
            <h2 className="text-sm font-mono font-bold text-white">
              Add Leg {nextLegNum}/{relay.max_legs}
            </h2>
            <p className="text-xs text-surface-600 mt-0.5">Continue the argument chain</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Show previous leg */}
          {prevLeg && (
            <div className="mb-4 p-3 rounded-lg bg-surface-200 border border-surface-300">
              <div className="flex items-center gap-2 mb-1">
                <div className={cn(
                  'w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-bold',
                  relay.side === 'for' ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400'
                )}>
                  {prevLeg.leg_number}
                </div>
                <span className="text-[10px] font-mono text-surface-600">@{prevLeg.author?.username}</span>
              </div>
              <p className="text-xs text-surface-600 line-clamp-3">&ldquo;{prevLeg.content}&rdquo;</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-mono text-surface-600 mb-2">
                Your contribution
                <span className="ml-2 text-surface-700">Build on the chain — don&apos;t repeat, advance</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value.slice(0, 300))}
                rows={4}
                autoFocus
                placeholder="Add the next link in the chain — introduce new evidence, extend the logic, or deepen the argument…"
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg bg-surface-200 border text-sm text-white',
                  'placeholder:text-surface-500 font-mono leading-relaxed resize-none',
                  'focus:outline-none focus:ring-1 transition-colors',
                  charCount > 0 && !charOk
                    ? 'border-against-500/50 focus:border-against-500/70 focus:ring-against-500/30'
                    : 'border-surface-300 focus:border-for-500/50 focus:ring-for-500/30'
                )}
              />
              <div className="flex items-center justify-between mt-1">
                {error && <p className="text-xs text-against-400">{error}</p>}
                <span className={cn(
                  'ml-auto text-xs font-mono',
                  charCount > 300 ? 'text-against-400' : charCount >= 30 ? 'text-emerald' : 'text-surface-600'
                )}>
                  {charCount}/300
                </span>
              </div>
            </div>

            <Button type="submit" disabled={submitting || !charOk} className="w-full">
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ChevronRight className="h-4 w-4" />
                  Add Leg {nextLegNum}
                </>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'open' | 'in_progress' | 'complete'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'open',        label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'complete',    label: 'Complete' },
]

export default function RelayPage() {
  const [relays, setRelays] = useState<RelayRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [joinTarget, setJoinTarget] = useState<RelayRow | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRelays = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch(
        `/api/relays?status=${statusFilter}&limit=20`
      )
      if (!res.ok) return
      const data = (await res.json()) as RelaysResponse
      setRelays(data.relays)
      setTotal(data.total)
    } catch { /* ignore */ }
    finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchRelays() }, [fetchRelays])

  function handleVote(relayId: string, vote: 'compelling' | 'not_compelling') {
    fetch(`/api/relays/${relayId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'vote', vote }),
    }).then(() => fetchRelays(true))
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-for-500/10 border border-for-500/20">
                <Link2 className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="text-xl font-mono font-bold text-white">Civic Relay</h1>
                <p className="text-xs text-surface-600">5-leg collaborative argument chains</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchRelays(true)}
                disabled={refreshing}
                className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </button>
              <Button size="sm" onClick={() => setShowNewModal(true)}>
                <Plus className="h-3.5 w-3.5" />
                Start Relay
              </Button>
            </div>
          </div>

          {/* How it works */}
          <div className="p-3 rounded-xl bg-surface-100 border border-surface-300 flex items-start gap-3 text-xs text-surface-600">
            <MessageSquare className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
            <span>
              One person starts. Four others each add one leg. Together, five voices build a
              collaborative case FOR or AGAINST a topic. Finished relays go to community vote —
              is the chain compelling?
            </span>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5 mb-5 overflow-x-auto scrollbar-hide">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all',
                statusFilter === tab.key
                  ? 'bg-for-600 text-white'
                  : 'bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300'
              )}
            >
              {tab.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-surface-600 whitespace-nowrap font-mono">{total} relays</span>
        </div>

        {/* Relay list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex gap-3 mb-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : relays.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="No relays yet"
            description={
              statusFilter === 'all'
                ? 'Be the first to start a civic relay — open a 5-leg collaborative argument chain.'
                : `No ${statusFilter.replace('_', ' ')} relays right now.`
            }
            action={{ label: 'Start the first relay', onClick: () => setShowNewModal(true) }}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {relays.map((relay) => (
                <RelayCard
                  key={relay.id}
                  relay={relay}
                  expanded={expandedId === relay.id}
                  onToggle={() => setExpandedId(expandedId === relay.id ? null : relay.id)}
                  onJoin={setJoinTarget}
                  onVote={handleVote}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
      <BottomNav />

      {/* Modals */}
      <AnimatePresence>
        {showNewModal && (
          <NewRelayModal
            onClose={() => setShowNewModal(false)}
            onCreated={() => {
              setShowNewModal(false)
              fetchRelays()
            }}
          />
        )}
        {joinTarget && (
          <AddLegModal
            relay={joinTarget}
            onClose={() => setJoinTarget(null)}
            onAdded={() => {
              setJoinTarget(null)
              fetchRelays()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
