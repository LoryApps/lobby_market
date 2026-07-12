'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  Globe,
  Loader2,
  RefreshCw,
  Scale,
  SplitSquareHorizontal,
  Sun,
  Tag,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { haptics } from '@/lib/hooks/useHaptics'
import { cn } from '@/lib/utils/cn'
import type { DailyBriefResponse } from '@/app/api/delegation/daily-brief/route'
import type { DelegateVoteEntry } from '@/app/api/delegation/history/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return 'earlier today'
}

function scopeLabel(entry: DelegateVoteEntry): string {
  if (entry.scope === 'topic') return 'topic'
  if (entry.scope === 'category') return entry.category ?? 'category'
  return 'global'
}

const CATEGORY_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-for-300',     bg: 'bg-for-300/10',     border: 'border-for-300/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
}

function catStyle(category: string | null) {
  return category
    ? (CATEGORY_STYLE[category] ?? { text: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' })
    : { text: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' }
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  colorClass,
  icon,
}: {
  label: string
  value: string | number
  colorClass?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-surface-200 bg-surface-100 p-3 flex flex-col gap-1">
      {icon && <div className={cn('', colorClass ?? 'text-surface-400')}>{icon}</div>}
      <div className={cn('text-xl font-bold font-mono', colorClass ?? 'text-white')}>{value}</div>
      <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wide leading-tight">{label}</div>
    </div>
  )
}

// ─── Pending card (needs your attention) ─────────────────────────────────────

interface PendingCardProps {
  entry: DelegateVoteEntry
  onVoted: (topicId: string, side: 'for' | 'against') => void
  onTrust: (topicId: string) => void
}

function PendingCard({ entry, onVoted, onTrust }: PendingCardProps) {
  const [voting, setVoting] = useState<'for' | 'against' | null>(null)
  const [done, setDone] = useState<'for' | 'against' | 'trusted' | null>(null)
  const isFor = entry.delegate_side === 'for'
  const delegateSideColor = isFor ? 'text-for-400' : 'text-against-400'
  const cs = catStyle(entry.topic_category)

  async function castVote(side: 'for' | 'against') {
    if (voting || done) return
    setVoting(side)
    if (side === 'for') haptics.voteFor()
    else haptics.voteAgainst()
    try {
      const apiSide = side === 'for' ? 'blue' : 'red'
      const res = await fetch(`/api/topics/${entry.topic_id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side: apiSide }),
      })
      if (res.ok) {
        setDone(side)
        setTimeout(() => onVoted(entry.topic_id, side), 700)
      }
    } catch {
      // retry possible
    } finally {
      setVoting(null)
    }
  }

  function trust() {
    if (done) return
    haptics.dismiss()
    setDone('trusted')
    setTimeout(() => onTrust(entry.topic_id), 400)
  }

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key={entry.topic_id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0, paddingBottom: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-surface-200 bg-surface-100 overflow-hidden"
        >
          {/* Delegate header */}
          <div className="flex items-center gap-3 px-4 pt-3.5 pb-3 border-b border-surface-200">
            <Avatar
              src={entry.delegate_avatar_url}
              name={entry.delegate_display_name ?? entry.delegate_username}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Link
                  href={`/profile/${entry.delegate_username}`}
                  className="text-sm font-semibold text-white hover:text-for-300 transition-colors"
                >
                  {entry.delegate_display_name ?? `@${entry.delegate_username}`}
                </Link>
                <span className="text-xs text-surface-500">voted</span>
                <span className={cn('text-xs font-bold font-mono uppercase tracking-wide', delegateSideColor)}>
                  {entry.delegate_side}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
                  {entry.scope === 'global' && <Globe className="h-3 w-3" />}
                  {entry.scope === 'category' && <Tag className="h-3 w-3" />}
                  {entry.scope === 'topic' && <Scale className="h-3 w-3" />}
                  {scopeLabel(entry)} delegation
                </span>
                <span className="text-[10px] text-surface-600">·</span>
                <span className="text-[10px] text-surface-500">{relativeTime(entry.delegate_voted_at)}</span>
              </div>
            </div>
          </div>

          {/* Topic */}
          <div className="px-4 py-3">
            <Link
              href={`/topic/${entry.topic_id}`}
              className="group flex items-start gap-1.5"
            >
              <p className="text-sm text-surface-700 group-hover:text-white transition-colors line-clamp-2 flex-1">
                {entry.topic_statement}
              </p>
              <ArrowRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-white flex-shrink-0 mt-0.5 transition-colors" />
            </Link>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {entry.topic_category && (
                <span className={cn(
                  'text-[10px] font-mono font-semibold px-2 py-0.5 rounded border',
                  cs.text, cs.bg, cs.border,
                )}>
                  {entry.topic_category}
                </span>
              )}
              <span className="text-[10px] text-surface-500 font-mono ml-auto">
                {Math.round(entry.topic_blue_pct)}% FOR · {entry.topic_total_votes.toLocaleString()} votes
              </span>
            </div>

            {/* Vote bar */}
            <div className="mt-2 h-1 rounded-full overflow-hidden bg-surface-200 flex">
              <div className="h-full bg-for-500 rounded-l-full" style={{ width: `${entry.topic_blue_pct}%` }} />
              <div className="h-full bg-against-500 rounded-r-full" style={{ width: `${100 - entry.topic_blue_pct}%` }} />
            </div>
          </div>

          {/* Action row */}
          <div className="px-4 pb-3.5 flex items-center gap-2">
            <button
              onClick={() => castVote('for')}
              disabled={!!voting}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-mono font-semibold transition-all',
                'bg-for-500/10 border-for-500/30 text-for-400',
                'hover:bg-for-500/20 hover:border-for-500/50 active:scale-95',
                'disabled:opacity-50',
              )}
            >
              {voting === 'for' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ThumbsUp className="h-3.5 w-3.5" />
              )}
              FOR
            </button>
            <button
              onClick={() => castVote('against')}
              disabled={!!voting}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-mono font-semibold transition-all',
                'bg-against-500/10 border-against-500/30 text-against-400',
                'hover:bg-against-500/20 hover:border-against-500/50 active:scale-95',
                'disabled:opacity-50',
              )}
            >
              {voting === 'against' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ThumbsDown className="h-3.5 w-3.5" />
              )}
              AGAINST
            </button>
            <button
              onClick={trust}
              disabled={!!voting}
              className={cn(
                'flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-mono transition-all',
                'bg-surface-200/50 border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white active:scale-95',
                'disabled:opacity-50',
              )}
              title="Trust delegate — let their vote stand"
            >
              <UserCheck className="h-3.5 w-3.5" />
              Trust
            </button>
          </div>
        </motion.div>
      )}

      {done && (
        <motion.div
          key={`${entry.topic_id}-done`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            'rounded-2xl border px-4 py-3 flex items-center gap-3',
            done === 'trusted'
              ? 'border-surface-200 bg-surface-100/50'
              : done === entry.delegate_side
              ? 'border-emerald/20 bg-emerald/5'
              : 'border-against-500/20 bg-against-500/5',
          )}
        >
          {done === 'trusted' ? (
            <UserCheck className="h-4 w-4 text-surface-500 flex-shrink-0" />
          ) : done === entry.delegate_side ? (
            <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
          ) : (
            <SplitSquareHorizontal className="h-4 w-4 text-against-400 flex-shrink-0" />
          )}
          <p className="text-xs text-surface-500 font-mono line-clamp-1 flex-1">
            {entry.topic_statement}
          </p>
          <span className={cn(
            'text-xs font-mono font-bold uppercase',
            done === 'trusted' ? 'text-surface-500'
            : done === entry.delegate_side ? 'text-emerald'
            : 'text-against-400',
          )}>
            {done === 'trusted' ? 'trusted' : done === entry.delegate_side ? 'aligned' : 'overrode'}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Handled card (already voted) ────────────────────────────────────────────

function HandledCard({ entry }: { entry: DelegateVoteEntry }) {
  const aligned = entry.is_aligned === true
  const overrode = entry.is_aligned === false

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 flex items-start gap-3',
      aligned ? 'border-emerald/20 bg-emerald/5'
      : overrode ? 'border-against-500/20 bg-against-500/5'
      : 'border-surface-200 bg-surface-100/50',
    )}>
      <Avatar
        src={entry.delegate_avatar_url}
        name={entry.delegate_display_name ?? entry.delegate_username}
        size="xs"
        className="flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-700 line-clamp-1">{entry.topic_statement}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-[10px] text-surface-500 font-mono">
            {entry.delegate_display_name ?? `@${entry.delegate_username}`} voted{' '}
            <span className={entry.delegate_side === 'for' ? 'text-for-400' : 'text-against-400'}>
              {entry.delegate_side.toUpperCase()}
            </span>
          </span>
          {entry.user_side && (
            <>
              <span className="text-[10px] text-surface-600">·</span>
              <span className="text-[10px] text-surface-500 font-mono">
                You voted{' '}
                <span className={entry.user_side === 'for' ? 'text-for-400' : 'text-against-400'}>
                  {entry.user_side.toUpperCase()}
                </span>
              </span>
            </>
          )}
        </div>
      </div>
      <span className={cn(
        'text-[10px] font-mono font-bold uppercase flex-shrink-0 mt-0.5',
        aligned ? 'text-emerald' : overrode ? 'text-against-400' : 'text-surface-500',
      )}>
        {aligned ? 'aligned' : overrode ? 'overrode' : '—'}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DailyBriefClient() {
  const [data, setData] = useState<DailyBriefResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showHandled, setShowHandled] = useState(false)
  // track locally dismissed "trust" items so they vanish from pending
  const [trustedIds, setTrustedIds] = useState<Set<string>>(new Set())
  // track locally cast votes so card transitions happen optimistically
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())

  const loadBrief = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/delegation/daily-brief', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as DailyBriefResponse
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadBrief() }, [loadBrief])

  function handleVoted(topicId: string) {
    setVotedIds(prev => new Set(prev).add(topicId))
  }

  function handleTrust(topicId: string) {
    setTrustedIds(prev => new Set(prev).add(topicId))
  }

  const pending = (data?.votes ?? []).filter(v => !v.is_override && !trustedIds.has(v.topic_id) && !votedIds.has(v.topic_id))
  const handled = (data?.votes ?? []).filter(v => v.is_override || trustedIds.has(v.topic_id) || votedIds.has(v.topic_id))

  const todayLabel = data?.date ? formatDate(data.date) : 'Today'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/delegate"
              className="text-surface-500 hover:text-white transition-colors"
              aria-label="Back to Delegate hub"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gold/10 border border-gold/30">
                <Sun className="h-4.5 w-4.5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white leading-none">
                  Daily Brief
                </h1>
                <p className="text-[11px] text-surface-500 font-mono mt-0.5">{todayLabel}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-surface-500 font-mono ml-[52px]">
            What your delegates voted on today
          </p>
        </div>

        {/* Stats row */}
        {loading ? (
          <div className="grid grid-cols-4 gap-2.5 mb-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : data && (
          <div className="grid grid-cols-4 gap-2.5 mb-6">
            <StatTile
              label="Today"
              value={data.todayTotal}
              colorClass="text-white"
              icon={<Sun className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Pending"
              value={pending.length}
              colorClass={pending.length > 0 ? 'text-gold' : 'text-surface-500'}
              icon={<Bell className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Aligned"
              value={data.todayAligned}
              colorClass="text-emerald"
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Overrode"
              value={data.todayMisaligned}
              colorClass={data.todayMisaligned > 0 ? 'text-against-400' : 'text-surface-500'}
              icon={<SplitSquareHorizontal className="h-3.5 w-3.5" />}
            />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : !data || data.todayTotal === 0 ? (
          <EmptyState
            icon={<Sun className="h-10 w-10 text-surface-500" />}
            title="All quiet today"
            description="None of your delegates have voted yet today. Check back later or browse the feed yourself."
            action={
              <Link
                href="/delegate"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono font-medium',
                  'bg-gold/10 border border-gold/30 text-gold',
                  'hover:bg-gold/20 transition-colors',
                )}
              >
                <UserCheck className="h-4 w-4" />
                Manage delegations
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {/* Pending section */}
            {pending.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Bell className="h-3.5 w-3.5 text-gold" />
                  <h2 className="text-xs font-mono font-semibold text-gold uppercase tracking-wider">
                    Needs your attention ({pending.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {pending.map(entry => (
                    <PendingCard
                      key={entry.topic_id}
                      entry={entry}
                      onVoted={handleVoted}
                      onTrust={handleTrust}
                    />
                  ))}
                </div>
              </section>
            )}

            {pending.length === 0 && handled.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald/20 bg-emerald/5">
                <CheckCircle2 className="h-5 w-5 text-emerald flex-shrink-0" />
                <div>
                  <p className="text-sm font-mono font-semibold text-emerald">All caught up!</p>
                  <p className="text-xs text-surface-500 font-mono mt-0.5">
                    You&apos;ve handled all of today&apos;s delegation activity.
                  </p>
                </div>
              </div>
            )}

            {/* Handled section */}
            {handled.length > 0 && (
              <section>
                <button
                  onClick={() => setShowHandled(v => !v)}
                  className="flex items-center gap-2 mb-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showHandled && 'rotate-180')} />
                  <span className="uppercase tracking-wider">
                    Already handled ({handled.length})
                  </span>
                </button>
                <AnimatePresence>
                  {showHandled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      {handled.map(entry => (
                        <HandledCard key={entry.topic_id} entry={entry} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>
            )}
          </div>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between mt-8 pt-4 border-t border-surface-200">
          <Link
            href="/delegate"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors font-mono"
          >
            <ArrowLeft className="h-4 w-4" />
            Manage delegations
          </Link>
          <div className="flex items-center gap-4">
            <button
              onClick={loadBrief}
              disabled={loading}
              className="text-surface-500 hover:text-white transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            <Link
              href="/delegate/history"
              className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors font-mono"
            >
              Full history
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
