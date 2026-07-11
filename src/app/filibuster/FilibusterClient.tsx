'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Gavel,
  Loader2,
  Mic,
  MinusCircle,
  RefreshCw,
  Scale,
  ThumbsUp,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { FilibusterEntry, FilibusterStatus } from '@/app/api/filibuster/route'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  return `${d}d ago`
}

function timeRemaining(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m remaining`
  return `${m}m remaining`
}

function progressWidth(current: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((current / total) * 100))
}

// ─── Grounds labels ───────────────────────────────────────────────────────────

const GROUNDS_LABEL: Record<string, string> = {
  procedural: 'Procedural Objection',
  insufficient_debate: 'Insufficient Debate',
  missing_evidence: 'Missing Evidence',
  rights_concern: 'Rights Concern',
  constitutional: 'Constitutional Question',
}

const GROUNDS_COLOR: Record<string, string> = {
  procedural: 'text-gold border-gold/40 bg-gold/10',
  insufficient_debate: 'text-purple border-purple/40 bg-purple/10',
  missing_evidence: 'text-for-400 border-for-500/40 bg-for-500/10',
  rights_concern: 'text-against-400 border-against-500/40 bg-against-500/10',
  constitutional: 'text-emerald border-emerald/40 bg-emerald/10',
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FilibusterStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  active: { label: 'Active', color: 'text-gold border-gold/40 bg-gold/10', icon: Mic },
  overridden: { label: 'Overridden', color: 'text-against-400 border-against-500/40 bg-against-500/10', icon: Gavel },
  extended: { label: 'Debate Extended', color: 'text-emerald border-emerald/40 bg-emerald/10', icon: Check },
  lapsed: { label: 'Lapsed', color: 'text-surface-500 border-surface-400/40 bg-surface-300/10', icon: MinusCircle },
  withdrawn: { label: 'Withdrawn', color: 'text-surface-500 border-surface-400/40 bg-surface-300/10', icon: X },
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type StatusFilter = 'active' | 'overridden' | 'extended' | 'all'

const TABS: { key: StatusFilter; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'overridden', label: 'Overridden' },
  { key: 'extended', label: 'Extended' },
  { key: 'all', label: 'All' },
]

// ─── Filibuster card ──────────────────────────────────────────────────────────

interface FilibusterCardProps {
  filibuster: FilibusterEntry
  onVote: (id: string, vote: 'cloture' | 'second') => Promise<void>
  voting: string | null
}

function FilibusterCard({ filibuster: f, onVote, voting }: FilibusterCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isBusy = voting === f.id
  const statusCfg = STATUS_CONFIG[f.status]
  const StatusIcon = statusCfg.icon
  const isActive = f.status === 'active'

  const clotureProgress = progressWidth(f.cloture_count, f.cloture_threshold)
  const secondProgress = progressWidth(f.second_count, f.second_threshold)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-300/60 bg-surface-200/50 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {f.filibuster_user && (
            <Link href={`/profile/${f.filibuster_user.username}`} className="flex-shrink-0 mt-0.5">
              <Avatar
                src={f.filibuster_user.avatar_url}
                fallback={f.filibuster_user.display_name ?? f.filibuster_user.username}
                size="sm"
              />
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {f.filibuster_user && (
                <Link
                  href={`/profile/${f.filibuster_user.username}`}
                  className="text-xs font-semibold text-white hover:text-for-300 transition-colors"
                >
                  {f.filibuster_user.display_name ?? f.filibuster_user.username}
                </Link>
              )}
              <span className="text-[11px] text-surface-500">files a filibuster</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border',
                  GROUNDS_COLOR[f.grounds] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/10',
                )}
              >
                {GROUNDS_LABEL[f.grounds] ?? f.grounds}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white leading-snug">{f.title}</h3>
          </div>
          <span
            className={cn(
              'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border',
              statusCfg.color,
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {statusCfg.label}
          </span>
        </div>

        {/* Topic link */}
        {f.topic && (
          <Link
            href={`/topic/${f.topic.id}`}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-for-400 hover:text-for-300 transition-colors group"
          >
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{f.topic.statement}</span>
            <ArrowRight className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        )}
      </div>

      {/* Speech excerpt / expand */}
      <div className="px-4 pb-3">
        <div className={cn('text-sm text-surface-400 leading-relaxed', !expanded && 'line-clamp-3')}>
          {f.speech}
        </div>
        {f.speech.length > 200 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 flex items-center gap-1 text-[11px] text-for-400 hover:text-for-300 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3" /> Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" /> Read full speech
              </>
            )}
          </button>
        )}
      </div>

      {/* Vote bars */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-3">
        {/* Cloture bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-against-400 font-mono font-semibold">CLOTURE</span>
            <span className="text-[11px] text-surface-400 font-mono">
              {f.cloture_count}/{f.cloture_threshold}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-against-500 transition-all duration-500"
              style={{ width: `${clotureProgress}%` }}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-surface-500">End debate · proceed to vote</p>
        </div>

        {/* Second bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-emerald font-mono font-semibold">SECOND</span>
            <span className="text-[11px] text-surface-400 font-mono">
              {f.second_count}/{f.second_threshold}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald transition-all duration-500"
              style={{ width: `${secondProgress}%` }}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-surface-500">
            Extend debate +{f.extend_hours}h
          </p>
        </div>
      </div>

      {/* Action row */}
      <div className="px-4 pb-4 flex items-center gap-2 border-t border-surface-300/40 pt-3">
        {isActive && (
          <>
            <button
              onClick={() => onVote(f.id, 'cloture')}
              disabled={isBusy || f.user_vote === 'cloture'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                f.user_vote === 'cloture'
                  ? 'bg-against-500/20 border-against-500/50 text-against-300 cursor-default'
                  : 'bg-against-500/10 border-against-500/30 text-against-400 hover:bg-against-500/20 hover:border-against-500/50',
              )}
            >
              {isBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Gavel className="h-3 w-3" />
              )}
              {f.user_vote === 'cloture' ? 'Voted Cloture' : 'Force Vote'}
            </button>

            <button
              onClick={() => onVote(f.id, 'second')}
              disabled={isBusy || f.user_vote === 'second'}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                f.user_vote === 'second'
                  ? 'bg-emerald/20 border-emerald/50 text-emerald cursor-default'
                  : 'bg-emerald/10 border-emerald/30 text-emerald/70 hover:bg-emerald/20 hover:border-emerald/50',
              )}
            >
              {isBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ThumbsUp className="h-3 w-3" />
              )}
              {f.user_vote === 'second' ? 'Seconded' : 'Second It'}
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-3 text-[11px] text-surface-500">
          {isActive && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeRemaining(f.expires_at)}
            </span>
          )}
          <span>{relativeTime(f.created_at)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function FilibusterClient() {
  const [tab, setTab] = useState<StatusFilter>('active')
  const [filibusters, setFilibusters] = useState<FilibusterEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/filibuster?status=${tab}&limit=30`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setFilibusters(json.filibusters ?? [])
      setTotal(json.total ?? 0)
    } catch {
      setError('Could not load filibusters. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    load()
  }, [load])

  const handleVote = useCallback(async (id: string, vote: 'cloture' | 'second') => {
    setVoting(id)
    try {
      const res = await fetch(`/api/filibuster/${id}/cloture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed to vote')
      }
      const json = await res.json()
      setFilibusters((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                cloture_count: json.cloture_count ?? f.cloture_count,
                second_count: json.second_count ?? f.second_count,
                status: json.status ?? f.status,
                user_vote: vote,
              }
            : f,
        ),
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cast vote')
    } finally {
      setVoting(null)
    }
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-24">
        {/* Page header */}
        <div className="mb-5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
              <Mic className="h-4 w-4 text-gold" />
            </div>
            <h1 className="text-lg font-bold text-white">Civic Filibuster</h1>
          </div>
          <p className="text-sm text-surface-400 leading-relaxed">
            Citizens may file a filibuster on any topic in the voting phase to demand more debate time.
            Vote{' '}
            <span className="text-against-400 font-semibold">Cloture</span> to force the vote to proceed,
            or{' '}
            <span className="text-emerald font-semibold">Second</span> the filibuster to extend the debate window.
          </p>
        </div>

        {/* How it works strip */}
        <div className="mb-5 grid grid-cols-3 gap-2 text-center">
          {[
            { icon: Mic, color: 'text-gold', label: 'File', desc: 'Any citizen can filibuster a topic in the voting phase' },
            { icon: Users, color: 'text-for-400', label: 'Vote', desc: 'Cast cloture to end it or second to extend the debate' },
            { icon: Scale, color: 'text-emerald', label: 'Resolve', desc: 'Whichever threshold is met first determines the outcome' },
          ].map(({ icon: Icon, color, label, desc }) => (
            <div key={label} className="p-3 rounded-xl bg-surface-200/50 border border-surface-300/60">
              <Icon className={cn('h-5 w-5 mx-auto mb-1.5', color)} />
              <p className="text-xs font-semibold text-white mb-0.5">{label}</p>
              <p className="text-[10px] text-surface-500 leading-tight">{desc}</p>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200/50 border border-surface-300/40">
            <Mic className="h-3.5 w-3.5 text-gold" />
            <span className="text-xs text-surface-300">
              <span className="font-semibold text-white">{total}</span>{' '}
              {tab === 'active' ? 'active' : tab === 'all' ? 'total' : tab} filibuster{total !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={load}
            className="ml-auto p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200/50 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl bg-surface-200/50 border border-surface-300/40">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all',
                tab === t.key
                  ? 'bg-surface-100 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-300',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-surface-300/40 bg-surface-200/30 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                  <Skeleton className="h-12 w-full" />
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-8 rounded-lg" />
                    <Skeleton className="h-8 rounded-lg" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-16 text-center"
            >
              <AlertTriangle className="h-10 w-10 text-against-400" />
              <p className="text-sm text-surface-400">{error}</p>
              <button
                onClick={load}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300/60 text-sm text-white hover:bg-surface-300/50 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </button>
            </motion.div>
          ) : filibusters.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={Mic}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                iconBorder="border-gold/20"
                title={
                  tab === 'active'
                    ? 'No active filibusters'
                    : tab === 'extended'
                    ? 'No successful filibusters yet'
                    : tab === 'overridden'
                    ? 'No overridden filibusters'
                    : 'No filibusters on record'
                }
                description={
                  tab === 'active'
                    ? 'When a topic reaches the voting phase, any citizen can file a filibuster to demand more debate time. Check back soon.'
                    : 'Filibusters that have been resolved will appear here.'
                }
                action={{
                  label: 'Browse voting topics',
                  href: '/topics?status=voting',
                  icon: ArrowRight,
                  variant: 'primary',
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {filibusters.map((f) => (
                <FilibusterCard key={f.id} filibuster={f} onVote={handleVote} voting={voting} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom CTA */}
        <div className="mt-6 p-4 rounded-xl bg-surface-200/40 border border-surface-300/40 text-center">
          <p className="text-sm text-surface-400 mb-3">
            Got an argument for extending debate? Find a topic in the voting phase and file a filibuster from its page.
          </p>
          <Link
            href="/topics?status=voting"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/10 border border-gold/30 text-sm font-semibold text-gold hover:bg-gold/20 transition-colors"
          >
            <Mic className="h-4 w-4" />
            Browse voting topics
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
