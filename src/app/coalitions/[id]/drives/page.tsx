'use client'

/**
 * /coalitions/[id]/drives — Coalition Voting Drives
 *
 * Leaders and officers can launch coordinated voting drives on specific topics,
 * rallying members to vote together and tracking participation progress.
 *
 * Features:
 *   - Browse active drives with progress bars and deadlines
 *   - "I'm In" pledge button (any member can participate)
 *   - Create new drive modal (leaders/officers only)
 *   - Topic search to pin to a drive
 *   - Cancel drive (creator/leaders)
 *   - Completed drives archive tab
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flag,
  Loader2,
  Plus,
  Search,
  ThumbsDown,
  ThumbsUp,
  Target,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DrivesResponse, DriveWithDetails } from '@/app/api/coalitions/[id]/drives/route'

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

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d >= 1) return `${d}d left`
  if (h >= 1) return `${h}h left`
  const m = Math.floor((diff % 3_600_000) / 60_000)
  return `${m}m left`
}

function progressPct(current: number, target: number): number {
  return Math.min(100, Math.round((current / Math.max(1, target)) * 100))
}

// ─── Drive card ───────────────────────────────────────────────────────────────

function DriveCard({
  drive,
  coalitionId,
  currentUserId,
  currentUserRole,
  onJoinToggle,
  onCancel,
}: {
  drive: DriveWithDetails
  coalitionId: string
  currentUserId: string | null
  currentUserRole: string | null
  onJoinToggle: (driveId: string, participating: boolean) => void
  onCancel: (driveId: string) => void
}) {
  const [joining, setJoining] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const isFor = drive.target_vote === 'for'
  const pct = progressPct(drive.participant_count, drive.target_count)
  const isActive = drive.status === 'active'
  const canManage =
    currentUserRole === 'leader' ||
    currentUserRole === 'officer' ||
    drive.created_by === currentUserId

  async function handleJoin() {
    if (!currentUserId || joining) return
    setJoining(true)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/drives/${drive.id}/join`, {
        method: 'POST',
      })
      if (res.ok) {
        const { participating } = await res.json()
        onJoinToggle(drive.id, participating)
      }
    } finally {
      setJoining(false)
    }
  }

  async function handleCancel() {
    if (cancelling) return
    setCancelling(true)
    try {
      await fetch(`/api/coalitions/${coalitionId}/drives`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drive_id: drive.id, status: 'cancelled' }),
      })
      onCancel(drive.id)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'rounded-xl border bg-surface-100 overflow-hidden',
        isActive ? 'border-surface-300' : 'border-surface-300/50 opacity-70',
      )}
    >
      {/* Stance header stripe */}
      <div
        className={cn(
          'h-1 w-full',
          isFor
            ? 'bg-gradient-to-r from-for-700 to-for-400'
            : 'bg-gradient-to-r from-against-700 to-against-400',
        )}
      />

      <div className="p-4 space-y-3">
        {/* Title + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider',
                  isFor
                    ? 'bg-for-500/15 text-for-400 border border-for-500/25'
                    : 'bg-against-500/15 text-against-400 border border-against-500/25',
                )}
              >
                {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
                Rally {isFor ? 'FOR' : 'AGAINST'}
              </span>
              {!isActive && (
                <span className="inline-flex rounded-md px-2 py-0.5 font-mono text-[10px] text-surface-500 bg-surface-200 border border-surface-300">
                  {drive.status}
                </span>
              )}
              {drive.ends_at && isActive && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-surface-500">
                  <Clock className="h-2.5 w-2.5" />
                  {timeUntil(drive.ends_at)}
                </span>
              )}
            </div>
            <h3 className="font-mono text-sm font-semibold text-white leading-snug">
              {drive.title}
            </h3>
          </div>
          {canManage && isActive && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-shrink-0 p-1.5 rounded-lg text-surface-500 hover:text-against-400 hover:bg-against-500/10 transition-colors"
              title="Cancel drive"
            >
              {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {/* Topic link */}
        <Link
          href={`/topic/${drive.topic.id}`}
          className="block rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 hover:border-surface-400 transition-colors group"
        >
          <div className="font-mono text-[10px] text-surface-500 uppercase tracking-wider mb-0.5">
            Topic
          </div>
          <p className="font-mono text-xs text-surface-400 group-hover:text-white transition-colors line-clamp-2 leading-relaxed">
            {drive.topic.statement}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full overflow-hidden bg-surface-300">
              <div
                className="h-full bg-for-500 rounded-full"
                style={{ width: `${Math.round(drive.topic.blue_pct)}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-for-400">{Math.round(drive.topic.blue_pct)}% FOR</span>
            <span className="font-mono text-[10px] text-surface-500">
              {drive.topic.total_votes.toLocaleString()} votes
            </span>
          </div>
        </Link>

        {/* Description */}
        {drive.description && (
          <p className="font-mono text-xs text-surface-400 leading-relaxed">
            {drive.description}
          </p>
        )}

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-surface-500 flex items-center gap-1">
              <Users className="h-3 w-3" />
              {drive.participant_count} / {drive.target_count} pledged
            </span>
            <span
              className={cn(
                'font-mono text-[11px] font-semibold',
                pct >= 100 ? 'text-emerald' : pct >= 50 ? 'text-gold' : 'text-surface-400',
              )}
            >
              {pct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden bg-surface-300">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                pct >= 100
                  ? 'bg-emerald'
                  : isFor
                    ? 'bg-for-500'
                    : 'bg-against-500',
              )}
            />
          </div>
        </div>

        {/* Footer: creator + action */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 min-w-0">
            {drive.creator && (
              <Avatar
                src={drive.creator.avatar_url}
                username={drive.creator.username ?? '?'}
                size={20}
              />
            )}
            <span className="font-mono text-[10px] text-surface-500 truncate">
              {drive.creator?.display_name ?? drive.creator?.username ?? 'Unknown'} · {relativeTime(drive.created_at)}
            </span>
          </div>

          {isActive && currentUserId && (
            <button
              onClick={handleJoin}
              disabled={joining}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold transition-all',
                drive.is_participating
                  ? 'bg-emerald/15 border border-emerald/30 text-emerald hover:bg-emerald/25'
                  : isFor
                    ? 'bg-for-500/15 border border-for-500/30 text-for-400 hover:bg-for-500/25'
                    : 'bg-against-500/15 border border-against-500/30 text-against-400 hover:bg-against-500/25',
              )}
            >
              {joining ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : drive.is_participating ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Pledged
                </>
              ) : (
                <>
                  <Flag className="h-3 w-3" />
                  I&apos;m In
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Create Drive Modal ───────────────────────────────────────────────────────

interface TopicSearchResult {
  id: string
  statement: string
  category: string | null
  status: string
}

function CreateDriveModal({
  coalitionId,
  onClose,
  onCreate,
}: {
  coalitionId: string
  onClose: () => void
  onCreate: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetVote, setTargetVote] = useState<'for' | 'against'>('for')
  const [targetCount, setTargetCount] = useState(10)
  const [endsAt, setEndsAt] = useState('')
  const [topicQuery, setTopicQuery] = useState('')
  const [topicResults, setTopicResults] = useState<TopicSearchResult[]>([])
  const [selectedTopic, setSelectedTopic] = useState<TopicSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!topicQuery.trim() || selectedTopic) return
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(topicQuery)}&type=topic&limit=8`)
        if (res.ok) {
          const data = await res.json()
          setTopicResults(data.topics ?? [])
        }
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [topicQuery, selectedTopic])

  async function handleSubmit() {
    if (!selectedTopic || !title.trim()) {
      setError('Please select a topic and enter a drive title.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/drives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selectedTopic.id,
          title: title.trim(),
          description: description.trim() || null,
          target_vote: targetVote,
          target_count: targetCount,
          ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to create drive')
        return
      }
      onCreate()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        className="w-full max-w-lg rounded-2xl border border-surface-300 bg-surface-100 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-purple" />
            <h2 className="font-mono text-sm font-bold text-white">New Voting Drive</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Topic search */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-surface-500 mb-1.5">
              Topic *
            </label>
            {selectedTopic ? (
              <div className="flex items-start gap-2 rounded-xl border border-for-500/30 bg-for-500/5 p-3">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-white leading-snug line-clamp-2">
                    {selectedTopic.statement}
                  </p>
                  {selectedTopic.category && (
                    <span className="font-mono text-[10px] text-surface-500">{selectedTopic.category}</span>
                  )}
                </div>
                <button
                  onClick={() => { setSelectedTopic(null); setTopicQuery('') }}
                  className="flex-shrink-0 p-1 text-surface-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
                <input
                  type="text"
                  value={topicQuery}
                  onChange={(e) => setTopicQuery(e.target.value)}
                  placeholder="Search for a topic…"
                  className="w-full rounded-xl border border-surface-300 bg-surface-50 pl-9 pr-3 py-2.5 font-mono text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/50 transition-colors"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 animate-spin" />
                )}
              </div>
            )}
            {!selectedTopic && topicResults.length > 0 && (
              <div className="mt-1 rounded-xl border border-surface-300 bg-surface-100 divide-y divide-surface-300 overflow-hidden">
                {topicResults.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setSelectedTopic(t); setTopicResults([]) }}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-200 transition-colors"
                  >
                    <p className="font-mono text-xs text-white line-clamp-1">{t.statement}</p>
                    {t.category && (
                      <span className="font-mono text-[10px] text-surface-500">{t.category}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-surface-500 mb-1.5">
              Drive Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Rally FOR the Climate Bill"
              maxLength={80}
              className="w-full rounded-xl border border-surface-300 bg-surface-50 px-3 py-2.5 font-mono text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/50 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-surface-500 mb-1.5">
              Description <span className="normal-case text-surface-600">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why should members participate?"
              rows={3}
              maxLength={400}
              className="w-full rounded-xl border border-surface-300 bg-surface-50 px-3 py-2.5 font-mono text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/50 transition-colors resize-none"
            />
          </div>

          {/* Target vote */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-surface-500 mb-1.5">
              Target Stance *
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setTargetVote('for')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 font-mono text-xs font-semibold transition-all',
                  targetVote === 'for'
                    ? 'bg-for-500/15 border-for-500/40 text-for-400'
                    : 'bg-surface-50 border-surface-300 text-surface-500 hover:border-for-500/30',
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                Vote FOR
              </button>
              <button
                onClick={() => setTargetVote('against')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 font-mono text-xs font-semibold transition-all',
                  targetVote === 'against'
                    ? 'bg-against-500/15 border-against-500/40 text-against-400'
                    : 'bg-surface-50 border-surface-300 text-surface-500 hover:border-against-500/30',
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                Vote AGAINST
              </button>
            </div>
          </div>

          {/* Target count + deadline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-surface-500 mb-1.5">
                Participation Goal
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
                <input
                  type="number"
                  value={targetCount}
                  onChange={(e) => setTargetCount(Math.max(1, Math.min(500, Number(e.target.value))))}
                  min={1}
                  max={500}
                  className="w-full rounded-xl border border-surface-300 bg-surface-50 pl-9 pr-3 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-purple/50 transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-surface-500 mb-1.5">
                Deadline <span className="normal-case text-surface-600">(optional)</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full rounded-xl border border-surface-300 bg-surface-50 pl-9 pr-3 py-2.5 font-mono text-sm text-white focus:outline-none focus:border-purple/50 transition-colors"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="font-mono text-xs text-against-400 bg-against-500/10 border border-against-500/25 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-300">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-mono text-xs text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedTopic || !title.trim()}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xs font-semibold transition-all',
              'bg-purple/15 border border-purple/40 text-purple hover:bg-purple/25',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
            Launch Drive
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoalitionDrivesPage() {
  const { id: coalitionId } = useParams<{ id: string }>()
  const [data, setData] = useState<DrivesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'completed'>('active')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/drives`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [coalitionId])

  useEffect(() => { load() }, [load])

  function handleJoinToggle(driveId: string, participating: boolean) {
    setData((prev) => {
      if (!prev) return prev
      const updateDrive = (d: DriveWithDetails) =>
        d.id === driveId
          ? {
              ...d,
              is_participating: participating,
              participant_count: participating ? d.participant_count + 1 : Math.max(0, d.participant_count - 1),
            }
          : d
      return {
        ...prev,
        active: prev.active.map(updateDrive),
      }
    })
  }

  function handleCancel(driveId: string) {
    setData((prev) => {
      if (!prev) return prev
      const drive = prev.active.find((d) => d.id === driveId)
      if (!drive) return prev
      return {
        ...prev,
        active: prev.active.filter((d) => d.id !== driveId),
        completed: [{ ...drive, status: 'cancelled' as const }, ...prev.completed],
      }
    })
  }

  const isLeaderOrOfficer =
    data?.currentUserRole === 'leader' || data?.currentUserRole === 'officer'

  const displayed = tab === 'active' ? (data?.active ?? []) : (data?.completed ?? [])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      {/* Sticky coalition nav */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-3xl mx-auto flex items-center h-14 px-4 gap-3">
          <Link
            href={`/coalitions/${coalitionId}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Target className="h-4 w-4 text-purple flex-shrink-0" />
            <span className="font-mono text-sm font-semibold text-white truncate">
              {data?.coalition.name ?? 'Coalition'} · Voting Drives
            </span>
          </div>
          {isLeaderOrOfficer && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs font-semibold bg-purple/15 border border-purple/40 text-purple hover:bg-purple/25 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              New Drive
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-5">
        {/* Hero */}
        <div className="rounded-xl border border-purple/20 bg-purple/5 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/15 border border-purple/30">
              <Target className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-lg font-bold text-white">Voting Drives</h1>
              <p className="font-mono text-[11px] text-surface-500">
                Coordinated stances on civic topics
              </p>
            </div>
          </div>
          <p className="font-mono text-xs text-surface-400 leading-relaxed">
            Leaders pin topics they want the coalition to vote on together. Members pledge participation
            and the drive tracks collective momentum. Unite the vote.
          </p>
          {data && (
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-gold" />
                <span className="font-mono text-[11px] text-surface-400">
                  <span className="text-gold font-semibold">{data.active.length}</span> active
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald" />
                <span className="font-mono text-[11px] text-surface-400">
                  <span className="text-emerald font-semibold">{data.completed.length}</span> completed
                </span>
              </div>
              {data.currentUserRole && (
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3 text-purple" />
                  <span className="font-mono text-[11px] text-surface-400">
                    Role: <span className="text-purple font-semibold capitalize">{data.currentUserRole}</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-surface-300 bg-surface-100 p-1">
          {(['active', 'completed'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 rounded-lg py-2 font-mono text-xs font-semibold transition-all',
                tab === t
                  ? 'bg-surface-300 text-white'
                  : 'text-surface-500 hover:text-white',
              )}
            >
              {t === 'active' ? (
                <>Active {data && `(${data.active.length})`}</>
              ) : (
                <>Archive {data && `(${data.completed.length})`}</>
              )}
            </button>
          ))}
        </div>

        {/* Drive list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-7 w-1/4 ml-auto" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={tab === 'active' ? Zap : CheckCircle2}
            title={tab === 'active' ? 'No active drives' : 'No completed drives yet'}
            description={
              tab === 'active'
                ? isLeaderOrOfficer
                  ? 'Launch a voting drive to rally members around a topic.'
                  : 'Your leaders haven\'t launched any drives yet.'
                : 'Completed and cancelled drives will appear here.'
            }
            action={
              isLeaderOrOfficer && tab === 'active'
                ? { label: 'Launch First Drive', onClick: () => setShowCreate(true) }
                : undefined
            }
          />
        ) : (
          <AnimatePresence initial={false}>
            <div className="space-y-3">
              {displayed.map((drive) => (
                <DriveCard
                  key={drive.id}
                  drive={drive}
                  coalitionId={coalitionId}
                  currentUserId={data?.currentUserId ?? null}
                  currentUserRole={data?.currentUserRole ?? null}
                  onJoinToggle={handleJoinToggle}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* CTA for members to go vote */}
        {data && data.active.length > 0 && (
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-xs font-semibold text-white">Ready to vote?</div>
              <div className="font-mono text-[11px] text-surface-500 mt-0.5">
                Head to each topic and cast your vote to back these drives.
              </div>
            </div>
            <Link
              href={`/coalitions/${coalitionId}/topics`}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono text-xs font-semibold bg-for-500/15 border border-for-500/30 text-for-400 hover:bg-for-500/25 transition-all flex-shrink-0"
            >
              Policy Positions
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateDriveModal
            coalitionId={coalitionId}
            onClose={() => setShowCreate(false)}
            onCreate={load}
          />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  )
}
