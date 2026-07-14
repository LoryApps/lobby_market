'use client'

/**
 * /divisions — The Division Bell
 *
 * The formal parliamentary division register. When a division is called, the
 * Division Bell rings and citizens walk through the Aye or No lobby to cast
 * their vote. All divisions are permanently recorded.
 *
 * The name "Lobby Market" itself derives from the parliamentary voting lobbies —
 * the Aye lobby and the No lobby where MPs walk to vote.
 *
 * Distinct from:
 *   /floor       — real-time consensus formation
 *   /supply-day  — opposition-tabled motions (can trigger a division)
 *   /pmqs        — question-and-answer session
 *   /westminster-hall — adjournment debates
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  Bell,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Crown,
  FileText,
  Info,
  Landmark,
  Loader2,
  Minus,
  Plus,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Timer,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { Division, DivisionsResponse, DivisionsStats, DivisionLobby } from '@/app/api/divisions/route'

// ─── Trigger badge config ──────────────────────────────────────────────────────

const TRIGGER_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  floor:       { label: 'Floor',       icon: <Landmark className="h-3 w-3" />,  color: 'text-for-400 bg-for-900/30 border-for-700/40' },
  supply_day:  { label: 'Supply Day',  icon: <Scale className="h-3 w-3" />,     color: 'text-against-400 bg-against-900/30 border-against-700/40' },
  lords:       { label: 'Lords',       icon: <Crown className="h-3 w-3" />,     color: 'text-gold bg-gold/10 border-gold/30' },
  motion:      { label: 'Motion',      icon: <FileText className="h-3 w-3" />,  color: 'text-purple-400 bg-purple-900/30 border-purple-700/40' },
}

// ─── Result config ─────────────────────────────────────────────────────────────

const RESULT_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ayes_win:      { label: 'Ayes Have It',     color: 'text-emerald-400 bg-emerald-900/20 border-emerald-700/30', icon: <ThumbsUp className="h-4 w-4" /> },
  noes_win:      { label: 'Noes Have It',     color: 'text-against-400 bg-against-900/20 border-against-700/30', icon: <ThumbsDown className="h-4 w-4" /> },
  tied:          { label: 'Tied — Noe',       color: 'text-gold bg-gold/10 border-gold/30',                      icon: <Scale className="h-4 w-4" /> },
  quorum_failed: { label: 'Quorum Failed',    color: 'text-surface-400 bg-surface-800/50 border-surface-700/30', icon: <AlertCircle className="h-4 w-4" /> },
  withdrawn:     { label: 'Withdrawn',        color: 'text-surface-400 bg-surface-800/50 border-surface-700/30', icon: <X className="h-4 w-4" /> },
}

// ─── Countdown timer ──────────────────────────────────────────────────────────

function useCountdown(closesAt: string) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    function tick() {
      const diff = new Date(closesAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Closed'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [closesAt])

  return remaining
}

// ─── Division card ─────────────────────────────────────────────────────────────

interface DivisionCardProps {
  division: Division
  onVote: (id: string, lobby: DivisionLobby) => void
  voting: string | null
}

function DivisionCountdown({ closesAt }: { closesAt: string }) {
  const rem = useCountdown(closesAt)
  return <span>{rem}</span>
}

function DivisionCard({ division, onVote, voting }: DivisionCardProps) {
  const trig = TRIGGER_CONFIG[division.trigger_type] ?? TRIGGER_CONFIG.floor
  const isOpen = division.status === 'open' && new Date(division.closes_at) > new Date()
  const res = division.result ? RESULT_CONFIG[division.result] : null
  const total = division.ayes + division.noes + division.abstentions
  const ayePct = total > 0 ? Math.round((division.ayes / total) * 100) : 0
  const noePct = total > 0 ? Math.round((division.noes / total) * 100) : 0
  const isVoting = voting === division.id

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border bg-surface-900 p-4 transition-colors',
        isOpen
          ? 'border-for-700/40 ring-1 ring-for-800/20'
          : 'border-surface-700/50'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {/* Trigger badge */}
            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', trig.color)}>
              {trig.icon}
              {trig.label}
            </span>
            {/* Open badge */}
            {isOpen && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-700/40">
                <BellRing className="h-3 w-3" />
                Open
              </span>
            )}
            {/* Result badge */}
            {res && (
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', res.color)}>
                {res.icon}
                {res.label}
              </span>
            )}
          </div>
          <Link href={`/divisions/${division.id}`} className="group">
            <h3 className="font-semibold text-surface-100 text-sm leading-snug group-hover:text-for-400 transition-colors line-clamp-2">
              {division.title}
            </h3>
          </Link>
          {division.topic && (
            <Link
              href={`/topic/${division.topic.id}`}
              className="text-xs text-surface-400 hover:text-for-400 transition-colors mt-0.5 line-clamp-1 block"
            >
              Re: {division.topic.statement}
            </Link>
          )}
        </div>
        <Link
          href={`/divisions/${division.id}`}
          className="shrink-0 p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Vote bar */}
      {total > 0 && (
        <div className="mb-3">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-800">
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${ayePct}%` }}
            />
            <div
              className="bg-against-500 transition-all duration-500"
              style={{ width: `${noePct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-surface-400">
            <span className="text-emerald-400 font-medium">{division.ayes} Aye</span>
            <span className="text-surface-500">{total} voting</span>
            <span className="text-against-400 font-medium">{division.noes} No</span>
          </div>
        </div>
      )}

      {/* Lobby buttons (open divisions) */}
      {isOpen && !division.user_lobby && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(['aye', 'no', 'abstain'] as DivisionLobby[]).map((lobby) => (
            <button
              key={lobby}
              onClick={() => onVote(division.id, lobby)}
              disabled={isVoting}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition-all',
                lobby === 'aye'
                  ? 'border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/30 hover:border-emerald-600'
                  : lobby === 'no'
                  ? 'border-against-700/50 text-against-400 hover:bg-against-900/30 hover:border-against-600'
                  : 'border-surface-700/50 text-surface-400 hover:bg-surface-800 hover:border-surface-600',
                isVoting && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isVoting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  {lobby === 'aye' ? <ThumbsUp className="h-3.5 w-3.5" /> : lobby === 'no' ? <ThumbsDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  {lobby === 'aye' ? 'Aye Lobby' : lobby === 'no' ? 'No Lobby' : 'Abstain'}
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Already voted */}
      {isOpen && division.user_lobby && (
        <div className={cn(
          'flex items-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium mb-3',
          division.user_lobby === 'aye'
            ? 'bg-emerald-900/20 border-emerald-700/40 text-emerald-400'
            : division.user_lobby === 'no'
            ? 'bg-against-900/20 border-against-700/40 text-against-400'
            : 'bg-surface-800 border-surface-700/40 text-surface-400'
        )}>
          <CheckCircle2 className="h-3.5 w-3.5" />
          You entered the {division.user_lobby === 'aye' ? 'Aye' : division.user_lobby === 'no' ? 'No' : 'Abstain'} lobby
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-surface-500">
        <div className="flex items-center gap-2">
          {division.caller && (
            <div className="flex items-center gap-1">
              <Avatar
                src={division.caller.avatar_url}
                username={division.caller.username}
                size={16}
                className="h-4 w-4 rounded-full"
              />
              <Link href={`/profile/${division.caller.username}`} className="hover:text-surface-300 transition-colors">
                {division.caller.display_name ?? division.caller.username}
              </Link>
            </div>
          )}
        </div>
        {isOpen ? (
          <div className="flex items-center gap-1 text-amber-400">
            <Timer className="h-3.5 w-3.5" />
            <DivisionCountdown closesAt={division.closes_at} />
          </div>
        ) : (
          <span className="text-surface-600">
            {new Date(division.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Call Division Modal ───────────────────────────────────────────────────────

interface CallDivisionModalProps {
  onClose: () => void
  onSuccess: () => void
}

function CallDivisionModal({ onClose, onSuccess }: CallDivisionModalProps) {
  const [title, setTitle] = useState('')
  const [motionText, setMotionText] = useState('')
  const [triggerType, setTriggerType] = useState<'floor' | 'supply_day' | 'lords' | 'motion'>('floor')
  const [durationHours, setDurationHours] = useState(24)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !motionText.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, motion_text: motionText, trigger_type: triggerType, duration_hours: durationHours }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to call division')
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="w-full max-w-lg rounded-2xl border border-surface-700/60 bg-surface-900 shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700/50">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-for-400" />
            <h2 className="font-semibold text-surface-100">Call a Division</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Division Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="That this House supports…"
              maxLength={300}
              className="w-full rounded-lg border border-surface-700/60 bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:border-for-600 focus:outline-none focus:ring-1 focus:ring-for-600/30"
              required
            />
          </div>

          {/* Motion text */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Motion Text</label>
            <textarea
              value={motionText}
              onChange={(e) => setMotionText(e.target.value)}
              placeholder="State the full motion being voted upon…"
              maxLength={5000}
              rows={4}
              className="w-full rounded-lg border border-surface-700/60 bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:border-for-600 focus:outline-none focus:ring-1 focus:ring-for-600/30 resize-none"
              required
            />
          </div>

          {/* Trigger type */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">Trigger</label>
            <div className="grid grid-cols-2 gap-2">
              {(['floor', 'supply_day', 'lords', 'motion'] as const).map((t) => {
                const cfg = TRIGGER_CONFIG[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTriggerType(t)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                      triggerType === t
                        ? 'border-for-600 bg-for-900/30 text-for-300'
                        : 'border-surface-700/50 text-surface-400 hover:border-surface-600 hover:text-surface-200'
                    )}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-medium text-surface-400 mb-1.5">
              Division open for <span className="text-for-400">{durationHours}h</span>
            </label>
            <input
              type="range"
              min={1}
              max={168}
              step={1}
              value={durationHours}
              onChange={(e) => setDurationHours(parseInt(e.target.value))}
              className="w-full accent-for-500"
            />
            <div className="flex justify-between text-xs text-surface-600 mt-0.5">
              <span>1h</span>
              <span>7 days</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-against-400 bg-against-900/20 border border-against-700/40 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-surface-700/60 text-sm text-surface-300 hover:bg-surface-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !motionText.trim()}
              className="flex-1 py-2.5 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              Ring the Bell
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'open' | 'closed'

export function DivisionsClient() {
  const [data, setData] = useState<{ divisions: Division[]; stats: DivisionsStats } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [showModal, setShowModal] = useState(false)
  const [voting, setVoting] = useState<string | null>(null)

  const fetchData = useCallback(async (f: FilterStatus = filter) => {
    try {
      setError(null)
      const res = await fetch(`/api/divisions?filter=${f}&limit=40`)
      if (!res.ok) throw new Error('Failed to load divisions')
      const json: DivisionsResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    fetchData(filter)
  }, [filter, fetchData])

  const handleVote = useCallback(async (divId: string, lobby: DivisionLobby) => {
    setVoting(divId)
    try {
      const res = await fetch(`/api/divisions/${divId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobby }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Vote failed')
      }
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          divisions: prev.divisions.map((d) => {
            if (d.id !== divId) return d
            const oldLobby = d.user_lobby
            const updated = { ...d, user_lobby: lobby }
            if (oldLobby === 'aye') updated.ayes = Math.max(0, d.ayes - 1)
            if (oldLobby === 'no') updated.noes = Math.max(0, d.noes - 1)
            if (oldLobby === 'abstain') updated.abstentions = Math.max(0, d.abstentions - 1)
            if (lobby === 'aye') updated.ayes = d.ayes + (oldLobby ? 0 : 1)
            if (lobby === 'no') updated.noes = d.noes + (oldLobby ? 0 : 1)
            if (lobby === 'abstain') updated.abstentions = d.abstentions + (oldLobby ? 0 : 1)
            return updated
          }),
        }
      })
    } catch {
      // ignore — card stays as-is
    } finally {
      setVoting(null)
    }
  }, [])

  const stats = data?.stats
  const divisions = data?.divisions ?? []
  const openCount = divisions.filter((d) => d.status === 'open' && new Date(d.closes_at) > new Date()).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-6 w-6 text-for-400" />
              <h1 className="text-2xl font-bold text-surface-100">The Division Bell</h1>
            </div>
            <p className="text-sm text-surface-400 max-w-lg">
              Formal parliamentary divisions — the recorded votes at the heart of Lobby Market. When the bell rings, you walk through the Aye or No lobby.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-for-700 hover:bg-for-600 text-white text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Call
          </button>
        </div>

        {/* ── Stats strip ── */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total',    value: stats.total,     color: 'text-surface-200' },
              { label: 'Open',     value: stats.open,      color: 'text-emerald-400' },
              { label: 'Ayes Won', value: stats.ayes_won,  color: 'text-for-400' },
              { label: 'Noes Won', value: stats.noes_won,  color: 'text-against-400' },
            ].map((s) => (
              <div key={s.label} className="bg-surface-900 rounded-xl border border-surface-700/50 p-3 text-center">
                <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
                <div className="text-xs text-surface-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Live bell alert ── */}
        {openCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-700/40 bg-emerald-900/20 mb-6"
          >
            <motion.div
              animate={{ rotate: [-10, 10, -10, 10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
            >
              <BellRing className="h-5 w-5 text-emerald-400 shrink-0" />
            </motion.div>
            <div>
              <p className="text-sm font-semibold text-emerald-300">
                Division Bell is ringing — {openCount} {openCount === 1 ? 'division' : 'divisions'} open
              </p>
              <p className="text-xs text-emerald-500">Walk through a lobby before the bell stops</p>
            </div>
          </motion.div>
        )}

        {/* ── Filter tabs ── */}
        <div className="flex gap-1 p-1 bg-surface-900 rounded-xl border border-surface-700/50 mb-5">
          {(['all', 'open', 'closed'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize',
                filter === f
                  ? 'bg-for-700 text-white shadow-sm'
                  : 'text-surface-400 hover:text-surface-200'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-against-400 bg-against-900/20 border border-against-700/40 rounded-xl px-4 py-3 mb-5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
            <button onClick={() => fetchData()} className="ml-auto text-xs underline">Retry</button>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-surface-700/50 bg-surface-900 p-4">
                <SkeletonText lines={2} className="mb-3" />
                <Skeleton className="h-2 rounded-full w-full mb-2" />
                <div className="grid grid-cols-3 gap-2">
                  {[0,1,2].map((j) => <Skeleton key={j} className="h-8 rounded-lg" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Divisions list ── */}
        {!loading && (
          <>
            {divisions.length === 0 ? (
              <div className="text-center py-16">
                <Bell className="h-12 w-12 text-surface-600 mx-auto mb-3" />
                <p className="text-surface-400 font-medium">No divisions yet</p>
                <p className="text-sm text-surface-500 mt-1">Call the first division when a formal vote is needed</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-4 px-4 py-2 rounded-lg bg-for-700 hover:bg-for-600 text-white text-sm font-medium transition-colors"
                >
                  Call a Division
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence>
                  {divisions.map((d) => (
                    <DivisionCard
                      key={d.id}
                      division={d}
                      onVote={handleVote}
                      voting={voting}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}

        {/* ── What is a division? ── */}
        <div className="mt-8 rounded-xl border border-surface-700/50 bg-surface-900 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-for-400" />
            <h3 className="text-sm font-semibold text-surface-200">What is a Division?</h3>
          </div>
          <p className="text-xs text-surface-400 leading-relaxed">
            In Westminster, a <strong className="text-surface-300">division</strong> is a formal recorded vote. When a division is called, the Division Bell rings throughout Parliament and members have 8 minutes to walk through either the <strong className="text-emerald-400">Aye lobby</strong> or the <strong className="text-against-400">No lobby</strong>. The result is permanently recorded in the Division Register and published in Hansard.
          </p>
          <p className="text-xs text-surface-500 mt-2 leading-relaxed">
            The name <strong className="text-surface-400">Lobby Market</strong> derives from these voting lobbies &mdash; where debate ends and decision begins.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link href="/supply-day" className="text-xs text-for-400 hover:text-for-300 transition-colors">→ Supply Day</Link>
            <Link href="/floor" className="text-xs text-for-400 hover:text-for-300 transition-colors">→ The Floor</Link>
            <Link href="/hansard" className="text-xs text-for-400 hover:text-for-300 transition-colors">→ Hansard</Link>
            <Link href="/kings-speech" className="text-xs text-for-400 hover:text-for-300 transition-colors">→ King&apos;s Speech</Link>
          </div>
        </div>

      </main>

      <BottomNav />

      {/* ── Call Division Modal ── */}
      <AnimatePresence>
        {showModal && (
          <CallDivisionModal
            onClose={() => setShowModal(false)}
            onSuccess={() => {
              setShowModal(false)
              fetchData(filter)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
