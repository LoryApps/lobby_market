'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Filter,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { GlobalDrive, GlobalDrivesResponse } from '@/app/api/coalitions/drives/route'

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

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 60) return `${m}m left`
  if (h < 24) return `${h}h left`
  return `${d}d left`
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-surface-400',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        {label}
      </div>
      <p className={cn('font-mono text-2xl font-bold', color)}>{value}</p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DriveSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-1.5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full shrink-0" />
          </div>
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-4/5 mb-3" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Drive card ───────────────────────────────────────────────────────────────

function DriveCard({ drive }: { drive: GlobalDrive }) {
  const progress = Math.min(100, Math.round((drive.participant_count / drive.target_count) * 100))
  const isCompleted = drive.status === 'completed'
  const catColor = CATEGORY_COLOR[drive.topic.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'bg-surface-100 border rounded-2xl p-5 transition-colors group',
        isCompleted
          ? 'border-surface-300 opacity-80'
          : 'border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Header: coalition + vote direction */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <Link
          href={`/coalitions/${drive.coalition_id}`}
          className="flex items-center gap-2 min-w-0 group/coalition"
        >
          <div className="h-8 w-8 rounded-lg bg-purple/10 border border-purple/30 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-purple" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-mono font-bold text-purple group-hover/coalition:text-purple/80 transition-colors truncate">
              {drive.coalition.name}
            </p>
            <p className="text-[10px] font-mono text-surface-600">
              {drive.coalition.member_count.toLocaleString()} members
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 shrink-0">
          {isCompleted && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald font-semibold">
              <CheckCircle className="h-3.5 w-3.5" />
              Done
            </span>
          )}
          <span className={cn(
            'flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full',
            drive.target_vote === 'for'
              ? 'bg-for-600/15 text-for-400'
              : 'bg-against-600/15 text-against-400'
          )}>
            {drive.target_vote === 'for'
              ? <ThumbsUp className="h-3 w-3" />
              : <ThumbsDown className="h-3 w-3" />}
            Vote {drive.target_vote.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Drive title */}
      <p className="font-mono text-sm font-semibold text-white mb-1.5 line-clamp-2 group-hover:text-white/90 transition-colors">
        {drive.title}
      </p>

      {/* Topic */}
      <Link
        href={`/topic/${drive.topic.id}`}
        className="flex items-start gap-1.5 mb-3 group/topic"
      >
        <ArrowRight className="h-3 w-3 text-surface-600 mt-0.5 shrink-0" />
        <p className="text-[11px] font-mono text-surface-500 group-hover/topic:text-surface-300 transition-colors line-clamp-2 leading-relaxed">
          {drive.topic.statement}
        </p>
      </Link>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-surface-500">
            <span className="text-white font-semibold">{drive.participant_count}</span>
            /{drive.target_count} participants
          </span>
          <span className={cn(
            'font-semibold',
            progress >= 100 ? 'text-emerald' : 'text-surface-500'
          )}>
            {progress}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              drive.target_vote === 'for'
                ? 'bg-gradient-to-r from-for-600 to-for-400'
                : 'bg-gradient-to-r from-against-600 to-against-400'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center gap-3 text-[11px] font-mono text-surface-600">
        {drive.topic.category && (
          <span className={cn('font-semibold', catColor)}>{drive.topic.category}</span>
        )}
        {drive.ends_at && !isCompleted && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeUntil(drive.ends_at)}
          </span>
        )}
        <span>{relativeTime(drive.created_at)}</span>
        <Link
          href={`/coalitions/${drive.coalition_id}/drives`}
          className="ml-auto flex items-center gap-1 text-purple hover:text-purple/70 transition-colors"
        >
          View drive <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type VoteFilter = 'all' | 'for' | 'against'
type StatusFilter = 'active' | 'completed'

export function DrivesClient() {
  const [data, setData] = useState<GlobalDrivesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [voteFilter, setVoteFilter] = useState<VoteFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: statusFilter })
      if (voteFilter !== 'all') params.set('target_vote', voteFilter)
      const res = await fetch(`/api/coalitions/drives?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [voteFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const stats = data?.platform_stats

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* Hero */}
        <div className="flex items-start gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 shrink-0">
            <Target className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Coalition Drives</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Coordinated voting campaigns across the Lobby
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Active Drives"
            value={stats?.total_active ?? '—'}
            icon={Zap}
            color="text-purple"
          />
          <StatCard
            label="Total Participants"
            value={stats?.total_participants != null
              ? stats.total_participants >= 1000
                ? `${(stats.total_participants / 1000).toFixed(1)}K`
                : stats.total_participants
              : '—'}
            icon={Users}
            color="text-for-400"
          />
          <StatCard
            label="Coalitions Active"
            value={stats?.coalitions_with_active_drives ?? '—'}
            icon={TrendingUp}
            color="text-emerald"
          />
          <StatCard
            label="Completed"
            value={stats?.total_completed ?? '—'}
            icon={CheckCircle}
            color="text-surface-400"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <Filter className="h-3.5 w-3.5 text-surface-600 shrink-0" />

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1">
            {(['active', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all',
                  statusFilter === s
                    ? 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Vote filter */}
          <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1">
            {([
              { key: 'all', label: 'All' },
              { key: 'for', label: 'FOR' },
              { key: 'against', label: 'AGAINST' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setVoteFilter(key)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all',
                  voteFilter === key
                    ? key === 'for'
                      ? 'bg-for-600/20 text-for-300'
                      : key === 'against'
                        ? 'bg-against-600/20 text-against-300'
                        : 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {data && !loading && (
            <span className="text-[11px] font-mono text-surface-600 ml-auto">
              {data.total} drive{data.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Drive list */}
        {loading ? (
          <DriveSkeleton />
        ) : data?.drives.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No drives found"
            description={
              statusFilter === 'active'
                ? 'No coalition voting drives are active right now. Check back soon.'
                : 'No completed drives match your filters.'
            }
            actions={[{
              label: 'Browse coalitions',
              onClick: () => { window.location.href = '/coalitions' },
            }]}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {(data?.drives ?? []).map((drive) => (
                <DriveCard key={drive.id} drive={drive} />
              ))}
            </div>
          </AnimatePresence>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
