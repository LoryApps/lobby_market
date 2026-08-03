'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Clock,
  Gavel,
  MessageSquare,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawBreakdownResponse, CohortSlice } from '@/app/api/laws/[id]/breakdown/route'

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'role' | 'clout' | 'engagement' | 'timing'

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'role',       label: 'Role',       icon: Shield       },
  { id: 'clout',      label: 'Clout',      icon: Star         },
  { id: 'engagement', label: 'Engagement', icon: MessageSquare },
  { id: 'timing',     label: 'Timing',     icon: Clock        },
]

// ─── Cohort colours ───────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  person:        'bg-for-600/20 text-for-300 border-for-600/30',
  debator:       'bg-purple/20 text-purple border-purple/30',
  troll_catcher: 'bg-emerald/20 text-emerald border-emerald/30',
  elder:         'bg-gold/20 text-gold border-gold/30',
}

const CLOUT_COLORS: Record<string, string> = {
  newcomer:     'bg-surface-300/60 text-surface-600 border-surface-500/40',
  rising:       'bg-for-600/20 text-for-300 border-for-600/30',
  established:  'bg-purple/20 text-purple border-purple/30',
  elite:        'bg-gold/20 text-gold border-gold/30',
}

const TIMING_COLORS: Record<string, string> = {
  early:  'bg-for-600/20 text-for-300 border-for-600/30',
  middle: 'bg-surface-300/60 text-surface-500 border-surface-500/40',
  late:   'bg-against-600/20 text-against-300 border-against-600/30',
}

const ENGAGEMENT_COLORS: Record<string, string> = {
  active: 'bg-purple/20 text-purple border-purple/30',
  silent: 'bg-surface-300/60 text-surface-500 border-surface-500/40',
}

function cohortColor(tab: Tab, key: string): string {
  if (tab === 'role')       return ROLE_COLORS[key]       ?? 'bg-surface-300/60 text-surface-500 border-surface-500/40'
  if (tab === 'clout')      return CLOUT_COLORS[key]      ?? 'bg-surface-300/60 text-surface-500 border-surface-500/40'
  if (tab === 'timing')     return TIMING_COLORS[key]     ?? 'bg-surface-300/60 text-surface-500 border-surface-500/40'
  return ENGAGEMENT_COLORS[key] ?? 'bg-surface-300/60 text-surface-500 border-surface-500/40'
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ forPct }: { forPct: number }) {
  return (
    <div className="relative h-3 rounded-full overflow-hidden bg-surface-300/40 w-full">
      <motion.div
        className="absolute inset-y-0 left-0 bg-for-500 rounded-l-full"
        initial={{ width: 0 }}
        animate={{ width: `${forPct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      <motion.div
        className="absolute inset-y-0 right-0 bg-against-500 rounded-r-full"
        initial={{ width: 0 }}
        animate={{ width: `${100 - forPct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
      />
    </div>
  )
}

// ─── Cohort card ──────────────────────────────────────────────────────────────

function CohortCard({ slice, tab, rank }: { slice: CohortSlice; tab: Tab; rank: number }) {
  const deltaSign  = slice.delta > 0 ? '+' : ''
  const deltaColor =
    slice.delta > 5
      ? 'text-for-400'
      : slice.delta < -5
        ? 'text-against-400'
        : 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.06 }}
      className="bg-surface-200/60 border border-surface-300/50 rounded-xl p-4 space-y-3 hover:border-surface-400/60 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
                cohortColor(tab, slice.key),
              )}
            >
              {slice.label}
            </span>
            <span className="text-[11px] text-surface-500">{slice.total.toLocaleString()} voters</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-sm font-bold text-white">{slice.forPct}%</span>
          <span className="text-[10px] text-surface-500 ml-1">FOR</span>
          <div className={cn('text-[10px] font-mono', deltaColor)}>
            {deltaSign}{slice.delta}pts
          </div>
        </div>
      </div>

      <VoteBar forPct={slice.forPct} />

      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span className="text-for-400">{slice.forVotes.toLocaleString()} FOR</span>
        <span className="text-against-400">{slice.againstVotes.toLocaleString()} AGAINST</span>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function BreakdownSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function LawBreakdownClient({ lawId }: { lawId: string }) {
  const [data, setData]         = useState<LawBreakdownResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('role')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/breakdown`)
      if (!res.ok) throw new Error('Failed to load breakdown')
      setData(await res.json())
    } catch {
      setError('Failed to load voter breakdown.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const slices: CohortSlice[] = !data ? [] :
    activeTab === 'role'       ? data.byRole :
    activeTab === 'clout'      ? data.byClout :
    activeTab === 'engagement' ? data.byEngagement :
    data.byTiming

  return (
    <div className="flex flex-col min-h-screen bg-surface-100 text-white">
      <TopBar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-24 space-y-5">

          {/* Back */}
          <Link
            href={`/law/${lawId}`}
            className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to law
          </Link>

          {/* Header */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Gavel className="w-4 h-4 text-emerald flex-shrink-0" />
              <h1 className="text-base font-bold text-white leading-snug">Voter Breakdown</h1>
              {data?.law.category && (
                <Badge variant="category" size="sm">{data.law.category}</Badge>
              )}
            </div>
            {data?.law.statement && (
              <p className="text-sm text-surface-500 leading-snug line-clamp-2">
                {data.law.statement}
              </p>
            )}
          </div>

          {/* Platform average banner */}
          {data && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-200/50 border border-surface-300/40">
              <Users className="w-3.5 h-3.5 text-surface-500 flex-shrink-0" />
              <span className="text-xs text-surface-500">
                Final vote:{' '}
                <span className="text-for-400 font-semibold">{Math.round(data.law.blue_pct)}%</span>
                {' '}FOR across{' '}
                <span className="text-white font-semibold">{data.law.total_votes.toLocaleString()}</span>
                {' '}votes
              </span>
            </div>
          )}

          {/* Insight strip */}
          <AnimatePresence>
            {data?.insight && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-purple/10 border border-purple/20"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple mt-0.5 flex-shrink-0" />
                <p className="text-xs text-purple/90 leading-relaxed">{data.insight}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap transition-all',
                  activeTab === id
                    ? 'bg-emerald/15 text-emerald border-emerald/30'
                    : 'bg-surface-200/50 text-surface-500 border-surface-300/40 hover:text-white',
                )}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}

            <div className="ml-auto flex-shrink-0">
              <button
                onClick={load}
                disabled={loading}
                className="p-1.5 rounded-lg text-surface-500 hover:text-white border border-surface-300/40 hover:border-surface-400/60 transition-all disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Tab description */}
          <div className="text-xs text-surface-500">
            {activeTab === 'role'       && 'How each user role tier voted on this law.'}
            {activeTab === 'clout'      && 'Vote split by Clout earned — did high-rep members lean differently?'}
            {activeTab === 'engagement' && 'Argument authors vs silent voters — did the debaters vote differently from the lurkers?'}
            {activeTab === 'timing'     && 'Early adopters (first 25%), majority wave (mid 50%), and late arrivals (last 25%).'}
          </div>

          {/* Content */}
          {loading ? (
            <BreakdownSkeleton />
          ) : error ? (
            <div className="text-center py-12 text-surface-500 text-sm">{error}</div>
          ) : slices.length === 0 ? (
            <div className="text-center py-12 text-surface-500 text-sm">
              Not enough vote data to show this breakdown.
            </div>
          ) : (
            <div className="space-y-3">
              {slices.map((slice, i) => (
                <CohortCard key={slice.key} slice={slice} tab={activeTab} rank={i} />
              ))}
            </div>
          )}

          {/* Reading guide */}
          {!loading && slices.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="px-4 py-3 rounded-xl bg-surface-200/40 border border-surface-300/30 space-y-2"
            >
              <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
                Reading this chart
              </p>
              <div className="flex items-center gap-4 text-[10px] text-surface-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-for-500 inline-block" />
                  FOR (blue)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-against-500 inline-block" />
                  AGAINST (red)
                </span>
                <span>+/- delta vs final vote average</span>
              </div>
            </motion.div>
          )}

          {/* Related pages */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: `/law/${lawId}/voters`,    label: 'Individual voters', icon: Users    },
              { href: `/law/${lawId}/blocs`,     label: 'Voting blocs',      icon: Zap      },
              { href: `/law/${lawId}/sentiment`, label: 'Sentiment',         icon: BarChart2 },
              { href: `/law/${lawId}/impact`,    label: 'Impact report',     icon: Gavel    },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 p-3 rounded-xl bg-surface-200/40 border border-surface-300/30 hover:border-surface-400/50 transition-colors text-xs text-surface-500 hover:text-white"
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {label}
              </Link>
            ))}
          </div>

        </div>
      </main>

      <BottomNav />
    </div>
  )
}
