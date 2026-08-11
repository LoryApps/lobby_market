'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Scale,
  TrendingUp,
  Users,
  Flame,
  CheckCircle2,
  Layers,
  RefreshCw,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { StancesResponse, StancesTopic, CategoryStance } from '@/app/api/stances/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function leanLabel(pct: number): { label: string; className: string } {
  const dist = Math.abs(pct - 50)
  if (dist >= 30) return { label: pct > 50 ? 'Strong FOR' : 'Strong AGAINST', className: pct > 50 ? 'text-for-400' : 'text-against-400' }
  if (dist >= 15) return { label: pct > 50 ? 'Leans FOR' : 'Leans AGAINST', className: pct > 50 ? 'text-for-500' : 'text-against-500' }
  return { label: 'Contested', className: 'text-gold' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  className,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-surface-200/30 bg-surface-100/60 p-4', className)}>
      <div className="flex items-center gap-2 text-surface-500 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-surface-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function ConsensusBar({ pct, votes }: { pct: number; votes: number }) {
  const forPct = Math.round(pct)
  const againstPct = 100 - forPct
  return (
    <div className="space-y-1">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-200/30">
        <motion.div
          className="bg-for-500 h-full"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className="bg-against-500 h-full"
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-surface-500">
        <span className="text-for-400">{forPct}% FOR</span>
        <span className="text-surface-600">{formatNum(votes)} votes</span>
        <span className="text-against-400">{againstPct}% AGAINST</span>
      </div>
    </div>
  )
}

function CategoryRow({ cat, index }: { cat: CategoryStance; index: number }) {
  const lean = leanLabel(cat.weightedBluePct)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border border-surface-200/20 bg-surface-100/40 p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-white text-sm">{cat.category}</div>
          <div className="text-xs text-surface-500 mt-0.5">
            {cat.topicCount} topic{cat.topicCount !== 1 ? 's' : ''} · {formatNum(cat.totalVotes)} votes
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={cn('text-xs font-semibold', lean.className)}>{lean.label}</span>
          <span className="text-[10px] text-surface-600">
            {cat.polarization > 20 ? 'High polarization' : cat.polarization > 10 ? 'Mixed' : 'Consensus'}
          </span>
        </div>
      </div>
      <ConsensusBar pct={cat.weightedBluePct} votes={cat.totalVotes} />
      <div className="flex flex-wrap gap-1.5">
        {cat.statusBreakdown.law > 0 && (
          <Badge variant="law" size="xs">{cat.statusBreakdown.law} law{cat.statusBreakdown.law !== 1 ? 's' : ''}</Badge>
        )}
        {cat.statusBreakdown.voting > 0 && (
          <Badge variant="active" size="xs">{cat.statusBreakdown.voting} voting</Badge>
        )}
        {cat.statusBreakdown.active > 0 && (
          <Badge variant="active" size="xs">{cat.statusBreakdown.active} active</Badge>
        )}
        {cat.statusBreakdown.proposed > 0 && (
          <Badge variant="proposed" size="xs">{cat.statusBreakdown.proposed} proposed</Badge>
        )}
        {cat.statusBreakdown.failed > 0 && (
          <Badge variant="failed" size="xs">{cat.statusBreakdown.failed} failed</Badge>
        )}
      </div>
    </motion.div>
  )
}

function TopicRow({ topic, index, variant }: { topic: StancesTopic; index: number; variant: 'polarized' | 'unanimous' }) {
  const forPct = Math.round(topic.blue_pct)
  const dist = Math.abs(topic.blue_pct - 50)
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="flex items-start gap-3 py-3 border-b border-surface-200/10 last:border-0 hover:bg-surface-100/30 rounded-lg px-2 -mx-2 transition-colors"
      >
        <div
          className={cn(
            'mt-0.5 text-xs font-bold w-10 text-center shrink-0 py-0.5 rounded',
            variant === 'polarized'
              ? 'bg-gold/10 text-gold'
              : forPct > 50
                ? 'bg-for-500/10 text-for-400'
                : 'bg-against-500/10 text-against-400'
          )}
        >
          {variant === 'polarized'
            ? `${Math.round(dist * 10) / 10}%`
            : `${Math.round(dist)}%`}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-surface-600 line-clamp-2 leading-snug">{topic.statement}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-[10px] font-semibold', forPct > 50 ? 'text-for-400' : 'text-against-400')}>
              {forPct}% FOR
            </span>
            {topic.category && (
              <Badge variant="category" size="xs">{topic.category}</Badge>
            )}
            <Badge variant={topic.status as 'proposed' | 'active' | 'law' | 'failed'} size="xs">{topic.status}</Badge>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function StancesSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-4">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-6 w-36 rounded" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'categories' | 'polarized' | 'unanimous'

export function StancesClient() {
  const [data, setData] = useState<StancesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('categories')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stances')
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load stances data. Try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const platform = data?.platform
  const sb = platform?.statusBreakdown

  return (
    <div className="min-h-screen bg-surface-50 pb-28">
      <TopBar />

      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-for-400" />
              Civic Stances
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">Platform-wide consensus snapshot</p>
          </div>
          {!loading && (
            <button
              onClick={load}
              className="p-2 rounded-lg hover:bg-surface-200/30 transition-colors text-surface-500"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading && <StancesSkeleton />}

      {error && (
        <div className="mx-4 mt-4 rounded-xl border border-against-500/30 bg-against-500/10 p-4 text-center">
          <p className="text-sm text-against-400">{error}</p>
          <button onClick={load} className="mt-2 text-xs text-surface-500 underline">Retry</button>
        </div>
      )}

      {data && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-5 px-4 pt-3"
        >
          {/* Platform overview */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Scale}
              label="Platform lean"
              value={`${platform!.weightedBluePct}% FOR`}
              sub={`${100 - platform!.weightedBluePct}% AGAINST`}
              className={platform!.weightedBluePct > 50 ? 'border-for-500/30' : 'border-against-500/30'}
            />
            <StatCard
              icon={Users}
              label="Total votes"
              value={formatNum(platform!.totalVotes)}
              sub={`${platform!.totalTopics} topics`}
            />
            <StatCard
              icon={Flame}
              label="Active / Voting"
              value={`${(sb!.active + sb!.voting).toLocaleString()}`}
              sub={`${sb!.voting} going to vote`}
            />
            <StatCard
              icon={CheckCircle2}
              label="Laws passed"
              value={sb!.law.toLocaleString()}
              sub={`${sb!.failed} failed`}
            />
          </div>

          {/* Platform consensus bar */}
          <div className="rounded-xl border border-surface-200/20 bg-surface-100/40 p-4">
            <div className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-3">
              Platform consensus
            </div>
            <ConsensusBar pct={platform!.weightedBluePct} votes={platform!.totalVotes} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-xl bg-surface-100/40 p-1 border border-surface-200/20">
            {(['categories', 'polarized', 'unanimous'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 rounded-lg py-2 text-xs font-semibold transition-colors',
                  tab === t
                    ? 'bg-surface-200/60 text-white'
                    : 'text-surface-500 hover:text-surface-400'
                )}
              >
                {t === 'categories' ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    Categories
                  </span>
                ) : t === 'polarized' ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <Flame className="w-3.5 h-3.5" />
                    Polarized
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Unanimous
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'categories' && (
            <div className="space-y-3">
              <div className="text-xs text-surface-500 font-medium uppercase tracking-wide">
                {data.categories.length} categories · weighted by vote volume
              </div>
              {data.categories.map((cat, i) => (
                <CategoryRow key={cat.category} cat={cat} index={i} />
              ))}
            </div>
          )}

          {tab === 'polarized' && (
            <div className="rounded-xl border border-surface-200/20 bg-surface-100/40 p-4">
              <div className="text-xs text-surface-500 font-medium uppercase tracking-wide mb-2">
                Closest to 50/50 split · min 50 votes
              </div>
              {data.polarized.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-6">No contested topics yet</p>
              ) : (
                data.polarized.map((t, i) => (
                  <TopicRow key={t.id} topic={t} index={i} variant="polarized" />
                ))
              )}
            </div>
          )}

          {tab === 'unanimous' && (
            <div className="rounded-xl border border-surface-200/20 bg-surface-100/40 p-4">
              <div className="text-xs text-surface-500 font-medium uppercase tracking-wide mb-2">
                Strongest consensus · min 50 votes
              </div>
              {data.unanimous.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-6">No unanimous topics yet</p>
              ) : (
                data.unanimous.map((t, i) => (
                  <TopicRow key={t.id} topic={t} index={i} variant="unanimous" />
                ))
              )}
            </div>
          )}
        </motion.div>
      )}

      <BottomNav />
    </div>
  )
}
