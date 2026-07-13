'use client'

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  FlaskConical,
  GraduationCap,
  Globe,
  GripVertical,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  Music2,
  Plus,
  Scale,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { RCPoll, RCPollListResponse } from '@/app/api/ranked-choice/route'
import type { RCPollDetail, IRVRound } from '@/app/api/ranked-choice/[id]/route'

// ── Category config ─────────────────────────────────────────────────────────────

const CAT_CONFIG: Record<string, { icon: typeof Globe; color: string }> = {
  Politics:    { icon: Landmark, color: 'text-for-400' },
  Economics:   { icon: BarChart3, color: 'text-gold' },
  Technology:  { icon: Cpu, color: 'text-purple-400' },
  Science:     { icon: FlaskConical, color: 'text-emerald-400' },
  Ethics:      { icon: Scale, color: 'text-against-400' },
  Philosophy:  { icon: BookOpen, color: 'text-surface-400' },
  Culture:     { icon: Music2, color: 'text-pink-400' },
  Health:      { icon: Heart, color: 'text-red-400' },
  Education:   { icon: GraduationCap, color: 'text-amber-400' },
  Environment: { icon: Leaf, color: 'text-emerald-500' },
  Other:       { icon: Globe, color: 'text-surface-500' },
}

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health',
  'Education', 'Environment', 'Other',
]

function daysUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  if (diff <= 0) return 'Closed'
  if (d > 1) return `${d}d left`
  if (d === 1) return `1d ${h}h left`
  return `${h}h left`
}

// ── Poll card ──────────────────────────────────────────────────────────────────

function PollCard({ poll, onClick }: { poll: RCPoll; onClick: () => void }) {
  const cat = CAT_CONFIG[poll.category] ?? CAT_CONFIG.Other
  const CatIcon = cat.icon
  const expires = daysUntil(poll.closes_at)

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="w-full text-left bg-surface-200 border border-surface-300 rounded-xl p-4 hover:border-surface-400 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <CatIcon className={cn('w-4 h-4 shrink-0', cat.color)} />
          <span className="text-xs text-surface-500">{poll.category}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {poll.user_voted && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Voted
            </span>
          )}
          <span className={cn(
            'text-xs',
            expires === 'Closed' ? 'text-against-400' : 'text-surface-500'
          )}>
            {expires}
          </span>
        </div>
      </div>

      <p className="text-sm font-medium text-white leading-snug mb-3">{poll.title}</p>

      <div className="flex items-center justify-between">
        <div className="flex -space-x-1">
          {poll.options.slice(0, 3).map((opt, i) => (
            <div
              key={opt.id}
              className="w-5 h-5 rounded-full bg-surface-400 border border-surface-200 flex items-center justify-center text-[9px] font-bold text-white"
              style={{ zIndex: 3 - i }}
            >
              {i + 1}
            </div>
          ))}
          {poll.options.length > 3 && (
            <div className="w-5 h-5 rounded-full bg-surface-400 border border-surface-200 flex items-center justify-center text-[9px] text-surface-400">
              +{poll.options.length - 3}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-surface-500">
          <Users className="w-3 h-3" />
          <span>{poll.voter_count} {poll.voter_count === 1 ? 'vote' : 'votes'}</span>
        </div>
      </div>
    </motion.button>
  )
}

// ── Draggable ranking row ──────────────────────────────────────────────────────

function RankItem({
  opt,
  rank,
}: {
  opt: { id: string; text: string }
  rank: number
}) {
  return (
    <motion.div
      layout
      className="flex items-center gap-3 bg-surface-300 border border-surface-400 rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing select-none"
    >
      <GripVertical className="w-4 h-4 text-surface-500 shrink-0" />
      <span className="w-6 h-6 rounded-full bg-for-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
        {rank}
      </span>
      <span className="text-sm text-white flex-1 leading-snug">{opt.text}</span>
    </motion.div>
  )
}

// ── IRV results ────────────────────────────────────────────────────────────────

function IRVResults({
  rounds,
  winner,
}: {
  rounds: IRVRound[]
  winner: { option_id: string; text: string } | null
}) {
  const [expanded, setExpanded] = useState(false)
  const lastRound = rounds[rounds.length - 1]

  if (!lastRound) return null

  return (
    <div className="space-y-3">
      {winner && (
        <div className="flex items-center gap-2 bg-gold/10 border border-gold/30 rounded-lg px-3 py-2.5">
          <Trophy className="w-4 h-4 text-gold shrink-0" />
          <div>
            <p className="text-xs text-gold font-medium">IRV Winner</p>
            <p className="text-sm text-white">{winner.text}</p>
          </div>
        </div>
      )}

      <div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-white transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Hide' : 'Show'} IRV rounds ({rounds.length})
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-2 space-y-3"
            >
              {rounds.map((round) => (
                <div key={round.round}>
                  <p className="text-xs text-surface-500 mb-1.5">Round {round.round}</p>
                  <div className="space-y-1.5">
                    {round.tallies
                      .sort((a, b) => b.votes - a.votes)
                      .map((t) => (
                        <div key={t.option_id}>
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className={cn(
                              'truncate',
                              t.option_id === round.eliminated
                                ? 'text-against-400 line-through'
                                : t.option_id === winner?.option_id
                                ? 'text-gold'
                                : 'text-surface-300'
                            )}>
                              {t.text}
                            </span>
                            <span className="text-surface-500 shrink-0 ml-2">{t.pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface-400 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${t.pct}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                              className={cn(
                                'h-full rounded-full',
                                t.option_id === winner?.option_id
                                  ? 'bg-gold'
                                  : t.option_id === round.eliminated
                                  ? 'bg-against-600'
                                  : 'bg-for-600'
                              )}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Poll detail modal ──────────────────────────────────────────────────────────

function PollModal({
  pollId,
  onClose,
}: {
  pollId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<RCPollDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [ranked, setRanked] = useState<{ id: string; text: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/ranked-choice/${pollId}`)
      if (!res.ok) throw new Error('Failed to load')
      const data: RCPollDetail = await res.json()
      setDetail(data)

      // If user already voted, show their ranking; else show default order
      if (data.user_ranking && data.user_ranking.length > 0) {
        const sorted = [...data.user_ranking].sort((a, b) => a.rank - b.rank)
        const mapped = sorted
          .map((r) => data.options.find((o) => o.id === r.option_id))
          .filter(Boolean) as { id: string; text: string }[]
        setRanked(mapped)
        setSubmitted(true)
      } else {
        setRanked(data.options)
      }
    } catch {
      setError('Could not load poll')
    } finally {
      setLoading(false)
    }
  }, [pollId])

  useEffect(() => { load() }, [load])

  const handleVote = async () => {
    if (ranked.length < 2) {
      setError('Rank at least 2 options')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const rankings = ranked.map((opt, i) => ({ option_id: opt.id, rank: i + 1 }))
      const res = await fetch(`/api/ranked-choice/${pollId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rankings }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Vote failed')
      }
      await load()
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Vote failed')
    } finally {
      setSubmitting(false)
    }
  }

  const isClosed = detail ? (detail.status !== 'open' || new Date(detail.closes_at) < new Date()) : false
  const cat = detail ? (CAT_CONFIG[detail.category] ?? CAT_CONFIG.Other) : CAT_CONFIG.Other
  const CatIcon = cat.icon

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-surface-300">
            <div className="flex items-center gap-2">
              {detail && <CatIcon className={cn('w-4 h-4', cat.color)} />}
              <span className="text-xs text-surface-400">{detail?.category ?? 'Loading…'}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-300 transition-colors"
            >
              <X className="w-4 h-4 text-surface-400" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-4 space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full" />
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : !detail ? (
              <p className="text-sm text-against-400 text-center py-8">{error ?? 'Not found'}</p>
            ) : (
              <>
                <div>
                  <h2 className="text-base font-semibold text-white leading-snug mb-1">
                    {detail.title}
                  </h2>
                  {detail.description && (
                    <p className="text-xs text-surface-400 leading-relaxed">
                      {detail.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-surface-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {detail.voter_count} {detail.voter_count === 1 ? 'vote' : 'votes'}
                  </span>
                  {detail.author && (
                    <span>by @{detail.author.username}</span>
                  )}
                  <span className={isClosed ? 'text-against-400' : ''}>
                    {isClosed ? 'Closed' : daysUntil(detail.closes_at)}
                  </span>
                </div>

                {/* Ranking or results */}
                {submitted || isClosed ? (
                  <div className="space-y-3">
                    <p className="text-xs text-surface-400">
                      {submitted && !isClosed
                        ? 'Your ranking has been recorded. Drag to update, or see results below.'
                        : 'This poll is closed.'}
                    </p>
                    {/* Show the user's ranking read-only */}
                    {ranked.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-surface-500 font-medium">Your ranking</p>
                        {ranked.map((opt, i) => (
                          <div
                            key={opt.id}
                            className="flex items-center gap-3 bg-surface-300/50 border border-surface-400/50 rounded-lg px-3 py-2"
                          >
                            <span className="w-5 h-5 rounded-full bg-for-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-sm text-surface-300">{opt.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* IRV results if voters exist */}
                    {detail.irv_rounds.length > 0 && (
                      <IRVResults rounds={detail.irv_rounds} winner={detail.winner} />
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-surface-400">
                      Drag to reorder from most to least preferred. Rank as many as you like.
                    </p>
                    <Reorder.Group
                      axis="y"
                      values={ranked}
                      onReorder={setRanked}
                      className="space-y-2"
                    >
                      {ranked.map((opt, i) => (
                        <Reorder.Item key={opt.id} value={opt}>
                          <RankItem opt={opt} rank={i + 1} />
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-xs text-against-400 bg-against-500/10 border border-against-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {error}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!loading && detail && !isClosed && (
            <div className="p-4 border-t border-surface-300">
              {submitted ? (
                <Button
                  onClick={() => { setSubmitted(false); setError(null) }}
                  variant="secondary"
                  className="w-full"
                  size="sm"
                >
                  Update my ranking
                </Button>
              ) : (
                <Button
                  onClick={handleVote}
                  disabled={submitting || ranked.length < 2}
                  className="w-full"
                  size="sm"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Submit ranking'
                  )}
                </Button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Create poll modal ──────────────────────────────────────────────────────────

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('Politics')
  const [options, setOptions] = useState(['', '', ''])
  const [closeDays, setCloseDays] = useState(7)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addOption = () => {
    if (options.length < 8) setOptions([...options, ''])
  }
  const removeOption = (i: number) => {
    if (options.length > 3) setOptions(options.filter((_, j) => j !== i))
  }
  const updateOption = (i: number, val: string) => {
    const next = [...options]
    next[i] = val
    setOptions(next)
  }

  const handleSubmit = async () => {
    const trimmedOpts = options.map((o) => o.trim()).filter(Boolean)
    if (trimmedOpts.length < 3) {
      setError('Fill in at least 3 options')
      return
    }
    if (title.trim().length < 10) {
      setError('Title must be at least 10 characters')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/ranked-choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          options: trimmedOpts,
          closes_in_days: closeDays,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to create poll')
      }
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        >
          <div className="flex items-center justify-between p-4 border-b border-surface-300">
            <h2 className="text-sm font-semibold text-white">New Ranked Choice Poll</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-300 transition-colors"
            >
              <X className="w-4 h-4 text-surface-400" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs text-surface-400 block mb-1.5">Question *</label>
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What should citizens prioritise for…"
                rows={2}
                maxLength={160}
                className="w-full bg-surface-200 border border-surface-400 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-500 resize-none focus:outline-none focus:border-for-500"
              />
              <p className="text-right text-[10px] text-surface-500 mt-0.5">{title.length}/160</p>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-surface-400 block mb-1.5">Context (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Why does this matter? Give voters context."
                rows={2}
                maxLength={500}
                className="w-full bg-surface-200 border border-surface-400 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-500 resize-none focus:outline-none focus:border-for-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-xs text-surface-400 block mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-200 border border-surface-400 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-for-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Options */}
            <div>
              <label className="text-xs text-surface-400 block mb-1.5">
                Options ({options.length}/8) — at least 3 required
              </label>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-surface-400 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {i + 1}
                    </span>
                    <input
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      maxLength={120}
                      className="flex-1 bg-surface-200 border border-surface-400 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500"
                    />
                    {options.length > 3 && (
                      <button
                        onClick={() => removeOption(i)}
                        className="p-1 rounded hover:bg-surface-300 transition-colors"
                      >
                        <X className="w-3 h-3 text-surface-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < 8 && (
                <button
                  onClick={addOption}
                  className="mt-2 flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add option
                </button>
              )}
            </div>

            {/* Duration */}
            <div>
              <label className="text-xs text-surface-400 block mb-1.5">
                Closes in {closeDays} {closeDays === 1 ? 'day' : 'days'}
              </label>
              <input
                type="range"
                min={1}
                max={30}
                value={closeDays}
                onChange={(e) => setCloseDays(Number(e.target.value))}
                className="w-full accent-for-500"
              />
              <div className="flex justify-between text-[10px] text-surface-500 mt-0.5">
                <span>1 day</span>
                <span>30 days</span>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-against-400 bg-against-500/10 border border-against-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-surface-300">
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full"
              size="sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create poll'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function RankedChoiceClient() {
  const [polls, setPolls] = useState<RCPoll[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string | null>(null)
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: 'open', limit: '20' })
      if (category) params.set('category', category)
      const res = await fetch(`/api/ranked-choice?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data: RCPollListResponse = await res.json()
      setPolls(data.polls)
      setTotal(data.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setIsAuthed(!!data.user))
  }, [])

  return (
    <>
      <div className="min-h-screen bg-surface-100 pb-20">
        <TopBar />

        <div className="max-w-2xl mx-auto px-4 pt-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-lg font-bold text-white">Ranked Choice</h1>
              <p className="text-xs text-surface-400 mt-0.5">
                Rank policy options 1–N. Instant Runoff Voting finds the majority choice.
              </p>
            </div>
            {isAuthed && (
              <Button
                onClick={() => setShowCreate(true)}
                size="sm"
                className="shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                New poll
              </Button>
            )}
          </div>

          {/* Category filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
            <button
              onClick={() => setCategory(null)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                category === null
                  ? 'bg-for-600 text-white'
                  : 'bg-surface-300 text-surface-400 hover:text-white'
              )}
            >
              All
            </button>
            {CATEGORIES.map((c) => {
              const Icon = CAT_CONFIG[c]?.icon
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c === category ? null : c)}
                  className={cn(
                    'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    category === c
                      ? 'bg-for-600 text-white'
                      : 'bg-surface-300 text-surface-400 hover:text-white'
                  )}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  {c}
                </button>
              )
            })}
          </div>

          {/* Poll list */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : polls.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="No polls yet"
              description={
                category
                  ? `No open ${category} polls. Be the first to create one.`
                  : 'No ranked choice polls are open. Create the first one.'
              }
              action={
                isAuthed
                  ? { label: 'Create poll', onClick: () => setShowCreate(true) }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {polls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  onClick={() => setSelectedPollId(poll.id)}
                />
              ))}
              {total > polls.length && (
                <p className="text-center text-xs text-surface-500 pt-2">
                  {total - polls.length} more polls available
                </p>
              )}
            </div>
          )}

          {/* Explainer */}
          <div className="mt-8 bg-surface-200 border border-surface-300 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-surface-300 mb-2 uppercase tracking-wide">
              How it works
            </h3>
            <div className="space-y-2 text-xs text-surface-400 leading-relaxed">
              <p>
                Ranked Choice Voting lets you express your full preferences — not just a single
                pick. Rank as many options as you like, from 1 (most preferred) to N (least).
              </p>
              <p>
                Results are counted using <span className="text-white">Instant Runoff Voting (IRV)</span>:
                the option with fewest first-choice votes is eliminated each round, with those
                ballots transferring to their next preference, until one option holds a majority.
              </p>
              <p>
                No spoiler effect. No strategic voting. Just your honest order.
              </p>
            </div>
          </div>
        </div>

        <BottomNav />
      </div>

      {selectedPollId && (
        <PollModal
          pollId={selectedPollId}
          onClose={() => {
            setSelectedPollId(null)
            load()
          }}
        />
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </>
  )
}
