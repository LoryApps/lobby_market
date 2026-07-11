'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Clock,
  Crown,
  Globe,
  RefreshCw,
  Shield,
  Tag,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DelegationImpactResponse } from '@/app/api/delegation/impact/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  person:        { label: 'Citizen',      color: 'text-surface-500' },
  debator:       { label: 'Debater',      color: 'text-for-400' },
  troll_catcher: { label: 'Troll Catcher',color: 'text-emerald' },
  elder:         { label: 'Elder',         color: 'text-gold' },
  lawmaker:      { label: 'Lawmaker',      color: 'text-gold' },
  senator:       { label: 'Senator',       color: 'text-purple' },
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'bg-for-500/20 text-for-300 border-for-500/40',
  Economics:   'bg-gold/20 text-gold border-gold/40',
  Technology:  'bg-purple/20 text-purple border-purple/40',
  Science:     'bg-emerald/20 text-emerald border-emerald/40',
  Ethics:      'bg-against-500/20 text-against-300 border-against-500/40',
  Philosophy:  'bg-surface-400/20 text-surface-500 border-surface-400/40',
  Culture:     'bg-pink-500/20 text-pink-300 border-pink-500/40',
  Health:      'bg-green-500/20 text-green-300 border-green-500/40',
  Environment: 'bg-emerald/20 text-emerald border-emerald/40',
  Education:   'bg-blue-500/20 text-blue-300 border-blue-500/40',
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  sub?: string
  icon: typeof Shield
  color: string
}) {
  return (
    <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-4">
      <div className={cn('flex items-center gap-1.5 mb-2', color)}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-mono font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white font-mono">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {sub && <p className="text-[11px] text-surface-500 font-mono mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({
  category,
  count,
  max,
}: {
  category: string
  count: number
  max: number
}) {
  const pct = max > 0 ? (count / max) * 100 : 0
  const colorClass = CATEGORY_COLORS[category] ?? 'bg-surface-400/20 text-surface-500 border-surface-400/40'
  const barColorClass = colorClass.split(' ')[0].replace('/20', '/50')

  return (
    <div className="flex items-center gap-3">
      <span className={cn('text-xs font-mono w-24 flex-shrink-0', colorClass.split(' ')[1])}>
        {category}
      </span>
      <div className="flex-1 h-2 rounded-full bg-surface-300/50 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColorClass)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono text-surface-500 w-8 text-right">{count}</span>
    </div>
  )
}

// ─── Delegate card ────────────────────────────────────────────────────────────

function DelegateCard({
  entry,
  rank,
}: {
  entry: DelegationImpactResponse['top_delegates'][number]
  rank: number
}) {
  const roleInfo = ROLE_LABELS[entry.role] ?? { label: 'Citizen', color: 'text-surface-500' }

  return (
    <Link
      href={`/profile/${entry.username}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400 transition-colors group"
    >
      <div className="flex-shrink-0 flex items-center gap-2">
        <span className="text-xs font-mono text-surface-500 w-4 text-center">
          {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
        </span>
        <Avatar src={entry.avatar_url} fallback={entry.display_name || entry.username} size="sm" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white truncate group-hover:text-for-400 transition-colors">
            {entry.display_name || entry.username}
          </span>
          <span className={cn('text-[10px] font-mono hidden sm:block', roleInfo.color)}>
            {roleInfo.label}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {entry.top_categories.slice(0, 2).map(cat => (
            <span
              key={cat}
              className={cn(
                'text-[9px] font-mono px-1.5 py-0.5 rounded border',
                CATEGORY_COLORS[cat] ?? 'bg-surface-300/30 text-surface-500 border-surface-400/40',
              )}
            >
              {cat}
            </span>
          ))}
          {entry.global_count > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-surface-500">
              <Globe className="h-2.5 w-2.5" />
              Global
            </span>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-bold font-mono text-white">{entry.total_count}</p>
        <p className="text-[10px] font-mono text-surface-500">trusted by</p>
      </div>
    </Link>
  )
}

// ─── Recent delegation row ────────────────────────────────────────────────────

function RecentRow({
  row,
}: {
  row: DelegationImpactResponse['recent_delegations'][number]
}) {
  const scopeColor =
    row.scope === 'Global' ? 'text-gold'
    : row.scope === 'Topic' ? 'text-for-400'
    : CATEGORY_COLORS[row.scope]?.split(' ')[1] ?? 'text-surface-500'

  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-surface-300/40 last:border-0">
      <Link href={`/profile/${row.delegator_username}`} className="flex-shrink-0">
        <Avatar src={row.delegator_avatar} fallback={row.delegator_username} size="xs" />
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-500 truncate">
          <Link href={`/profile/${row.delegator_username}`} className="text-surface-700 hover:text-white font-medium transition-colors">
            @{row.delegator_username}
          </Link>
          {' → '}
          <Link href={`/profile/${row.delegate_username}`} className="text-white font-medium hover:text-for-400 transition-colors">
            @{row.delegate_username}
          </Link>
        </p>
        <p className={cn('text-[10px] font-mono', scopeColor)}>
          {row.scope === 'Global' ? '🌐 Global trust' : row.scope === 'Topic' ? '📌 Topic-scoped' : `🏷 ${row.scope}`}
        </p>
      </div>
      <span className="text-[10px] font-mono text-surface-600 flex-shrink-0">{timeAgo(row.created_at)}</span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DelegationImpactClient() {
  const [data, setData] = useState<DelegationImpactResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/delegation/impact')
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load delegation stats')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const maxCat = data ? Math.max(...data.by_category.map(c => c.count), 1) : 1

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/delegate"
            className="p-2 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors"
            aria-label="Back to Delegation Hub"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald" aria-hidden="true" />
              Delegation Impact
            </h1>
            <p className="text-xs text-surface-500 font-mono mt-0.5">
              How Liquid Democracy flows across the Lobby
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh delegation stats"
            className="ml-auto p-2 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && !data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {error && (
          <EmptyState
            icon={BarChart2}
            title="Stats unavailable"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        <AnimatePresence>
          {data && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >

              {/* Personal stats (if logged in) */}
              {data.my_stats && (
                <div className="rounded-xl bg-surface-200/40 border border-surface-300/60 p-4">
                  <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald mb-3 flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Your Delegation Stats
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="text-center">
                      <p className="text-2xl font-bold font-mono text-white">{data.my_stats.given}</p>
                      <p className="text-[11px] font-mono text-surface-500">delegated out</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold font-mono text-white">{data.my_stats.received}</p>
                      <p className="text-[11px] font-mono text-surface-500">trusted you</p>
                    </div>
                    {data.my_stats.top_category_trusted_in ? (
                      <div className="text-center col-span-2 sm:col-span-1">
                        <p className="text-sm font-bold font-mono text-for-400">{data.my_stats.top_category_trusted_in}</p>
                        <p className="text-[11px] font-mono text-surface-500">top trust category</p>
                      </div>
                    ) : null}
                  </div>
                  {data.my_stats.given > 0 && (
                    <div className="mt-3 pt-3 border-t border-surface-300/40 flex gap-4 text-[11px] font-mono text-surface-500">
                      <span>🌐 {data.my_stats.given_global} global</span>
                      <span>🏷 {data.my_stats.given_category} category</span>
                      <span>📌 {data.my_stats.given_topic} topic</span>
                    </div>
                  )}
                  <Link
                    href="/delegate"
                    className="mt-3 flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    Manage delegations <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Platform totals */}
              <div>
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-surface-500 mb-3">
                  Platform Trust Network
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard
                    label="Active"
                    value={data.platform.total_active}
                    sub="total delegations"
                    icon={Shield}
                    color="text-emerald"
                  />
                  <StatCard
                    label="New This Week"
                    value={data.platform.new_this_week}
                    sub="delegations added"
                    icon={TrendingUp}
                    color="text-for-400"
                  />
                  <StatCard
                    label="Delegators"
                    value={data.platform.unique_delegators}
                    sub="citizens delegating"
                    icon={Users}
                    color="text-purple"
                  />
                  <StatCard
                    label="Trusted Voices"
                    value={data.platform.unique_delegates}
                    sub="delegates active"
                    icon={Crown}
                    color="text-gold"
                  />
                </div>
              </div>

              {/* Scope breakdown */}
              <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-4">
                <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-surface-500 mb-4">
                  Delegation Scope
                </h2>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-surface-300/30 p-3">
                    <Globe className="h-5 w-5 text-gold mx-auto mb-1" />
                    <p className="text-lg font-bold font-mono text-white">{data.platform.global_count}</p>
                    <p className="text-[10px] font-mono text-surface-500">Global</p>
                  </div>
                  <div className="rounded-lg bg-surface-300/30 p-3">
                    <Tag className="h-5 w-5 text-emerald mx-auto mb-1" />
                    <p className="text-lg font-bold font-mono text-white">{data.platform.category_count}</p>
                    <p className="text-[10px] font-mono text-surface-500">Category</p>
                  </div>
                  <div className="rounded-lg bg-surface-300/30 p-3">
                    <Zap className="h-5 w-5 text-for-400 mx-auto mb-1" />
                    <p className="text-lg font-bold font-mono text-white">{data.platform.topic_count}</p>
                    <p className="text-[10px] font-mono text-surface-500">Topic</p>
                  </div>
                </div>
              </div>

              {/* Category distribution */}
              {data.by_category.length > 0 && (
                <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-4">
                  <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-surface-500 mb-4 flex items-center gap-1.5">
                    <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Category Trust Distribution
                  </h2>
                  <div className="space-y-3">
                    {data.by_category.map(c => (
                      <CategoryBar key={c.category} category={c.category} count={c.count} max={maxCat} />
                    ))}
                  </div>
                </div>
              )}

              {/* Top delegates */}
              {data.top_delegates.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-surface-500 flex items-center gap-1.5">
                      <Crown className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                      Most Trusted Voices
                    </h2>
                    <Link
                      href="/leaderboard/delegates"
                      className="text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                    >
                      Full leaderboard <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {data.top_delegates.map((entry, i) => (
                      <DelegateCard key={entry.user_id} entry={entry} rank={i + 1} />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent activity */}
              {data.recent_delegations.length > 0 && (
                <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-4">
                  <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-surface-500 mb-3 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Recent Delegations
                  </h2>
                  <div>
                    {data.recent_delegations.map((row, i) => (
                      <RecentRow key={i} row={row} />
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="rounded-xl bg-surface-200/40 border border-surface-300/50 p-5 text-center">
                <p className="text-sm text-surface-500 mb-3">
                  Ready to join the trust network?
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Link
                    href="/delegate"
                    className="px-4 py-2 rounded-xl bg-emerald/20 border border-emerald/40 text-emerald text-sm font-mono font-semibold hover:bg-emerald/30 transition-colors"
                  >
                    Manage Delegations
                  </Link>
                  <Link
                    href="/leaderboard/delegates"
                    className="px-4 py-2 rounded-xl bg-surface-300/40 border border-surface-400/40 text-surface-600 hover:text-white text-sm font-mono font-semibold transition-colors"
                  >
                    Delegate Leaderboard
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
