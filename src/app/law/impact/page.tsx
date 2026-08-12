'use client'

/**
 * /law/impact — The Civic Impact Dashboard
 *
 * Aggregates the collective impact of every established law:
 *   - Total votes cast across all laws
 *   - Endorsement counts
 *   - Argument and debate activity
 *   - Category breakdown by democratic mandate
 *   - Top laws by votes, endorsements, and debate depth
 *
 * Distinct from:
 *   /law             — codex browse (alphabetical / by category)
 *   /law/quality     — democratic mandate score per law
 *   /law/endorsements — endorsement leaderboard
 *   /leaderboard/laws — top law-making citizens
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  Calendar,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  HandshakeIcon,
  Heart,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { LawImpactResponse, ImpactLaw, CategoryImpact } from '@/app/api/laws/impact/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function relTime(iso: string | null): string {
  if (!iso) return 'Unknown'
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

// ─── Category styles ──────────────────────────────────────────────────────────

const CAT_STYLE: Record<string, { text: string; bg: string; border: string; bar: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        bar: 'bg-gold' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     bar: 'bg-for-500' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      bar: 'bg-purple' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     bar: 'bg-emerald' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', bar: 'bg-against-500' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      bar: 'bg-purple' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/20',        bar: 'bg-gold' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     bar: 'bg-emerald' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     bar: 'bg-emerald' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     bar: 'bg-for-500' },
}

function getCatStyle(cat: string | null) {
  return (cat && CAT_STYLE[cat]) ?? { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40', bar: 'bg-surface-500' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-white',
  iconColor = 'text-for-300',
  iconBg = 'bg-for-500/10',
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color?: string
  iconColor?: string
  iconBg?: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-2">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} aria-hidden="true" />
      </div>
      <div>
        <p className={cn('text-xl font-bold font-mono tabular-nums', color)}>
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </p>
        <p className="text-xs font-mono text-surface-500 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] font-mono text-surface-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function LawRow({ law, rank, metric }: { law: ImpactLaw; rank: number; metric: 'votes' | 'endorsements' | 'arguments' | 'debates' }) {
  const catStyle = getCatStyle(law.category)
  const forPct = Math.round(law.blue_pct)
  const rankColor = rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-400' : rank === 3 ? 'text-amber-600' : 'text-surface-600'
  const rankBg   = rank === 1 ? 'bg-gold/10 border-gold/30' : rank === 2 ? 'bg-surface-300/40 border-surface-400/40' : rank === 3 ? 'bg-amber-900/20 border-amber-700/30' : 'bg-surface-200 border-surface-300/60'

  const metricValue =
    metric === 'votes'        ? fmtNum(law.total_votes)       :
    metric === 'endorsements' ? fmtNum(law.endorsement_count) :
    metric === 'arguments'    ? fmtNum(law.argument_count)    :
                                fmtNum(law.debate_count)

  const metricIcon =
    metric === 'votes'        ? <Vote className="h-3.5 w-3.5" />    :
    metric === 'endorsements' ? <Heart className="h-3.5 w-3.5" />   :
    metric === 'arguments'    ? <MessageSquare className="h-3.5 w-3.5" /> :
                                <Mic className="h-3.5 w-3.5" />

  const metricColor =
    metric === 'votes'        ? 'text-for-400'     :
    metric === 'endorsements' ? 'text-emerald'      :
    metric === 'arguments'    ? 'text-purple'       :
                                'text-against-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.03, 0.3) }}
    >
      <Link href={`/law/${law.id}`} className="block group">
        <div className="flex items-start gap-3 py-3 border-b border-surface-200/40 last:border-0 hover:bg-surface-100/20 rounded-lg px-2 -mx-2 transition-colors">
          {/* Rank */}
          <div className={cn('flex-shrink-0 h-7 w-7 rounded-md border flex items-center justify-center text-[11px] font-bold font-mono mt-0.5', rankBg, rankColor)}>
            {rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : `#${rank}`}
          </div>

          {/* Law info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-surface-200 group-hover:text-white line-clamp-1 transition-colors">
              {law.statement}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {law.category && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', catStyle.text, catStyle.bg, catStyle.border)}>
                  {law.category}
                </span>
              )}
              <span className="text-[10px] text-gold px-1.5 py-0.5 rounded-full bg-gold/10 border border-gold/25">LAW</span>
              <span className="text-[10px] text-surface-500">{forPct}% For</span>
              {law.established_at && (
                <span className="text-[10px] text-surface-600">{relTime(law.established_at)}</span>
              )}
            </div>
          </div>

          {/* Metric */}
          <div className={cn('flex-shrink-0 flex items-center gap-1 font-bold font-mono text-sm', metricColor)}>
            {metricIcon}
            {metricValue}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function CategoryBar({ cat, maxVotes }: { cat: CategoryImpact; maxVotes: number }) {
  const style = getCatStyle(cat.category)
  const pct = maxVotes > 0 ? Math.max(4, Math.round((cat.total_votes / maxVotes) * 100)) : 4
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-24 flex-shrink-0">
        <span className={cn('text-[11px] font-mono font-semibold', style.text)}>{cat.category}</span>
      </div>
      <div className="flex-1 h-2 bg-surface-300/40 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', style.bar)} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-20 flex-shrink-0 text-right">
        <span className="text-[11px] font-mono text-surface-400">{fmtNum(cat.total_votes)} votes</span>
      </div>
      <div className="w-8 flex-shrink-0 text-right">
        <span className="text-[11px] font-mono text-surface-600">{cat.law_count}L</span>
      </div>
    </div>
  )
}

type Tab = 'votes' | 'endorsements' | 'arguments' | 'debates' | 'recent'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'votes',        label: 'Most Voted',     icon: Vote },
  { id: 'endorsements', label: 'Most Endorsed',  icon: Heart },
  { id: 'arguments',    label: 'Most Argued',    icon: MessageSquare },
  { id: 'debates',      label: 'Most Debated',   icon: Mic },
  { id: 'recent',       label: 'Recent',         icon: Calendar },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawImpactPage() {
  const [data, setData] = useState<LawImpactResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('votes')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/laws/impact', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load impact data')
      setData(await res.json() as LawImpactResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const tabLaws: ImpactLaw[] = data
    ? tab === 'votes'        ? data.top_by_votes
    : tab === 'endorsements' ? data.top_by_endorsements
    : tab === 'arguments'    ? data.top_by_arguments
    : tab === 'recent'       ? data.recent
    :                          data.top_by_arguments.filter(l => l.debate_count > 0).sort((a,b) => b.debate_count - a.debate_count)
    : []

  const maxCatVotes = data ? Math.max(...data.categories.map(c => c.total_votes), 1) : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back */}
        <Link href="/law" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-5">
          <ArrowLeft className="h-4 w-4" />
          Law Codex
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Civic Impact</h1>
              <p className="text-sm text-surface-500">Collective reach of all established laws</p>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-against-900/30 border border-against-700/40 p-6 text-center mb-6">
            <p className="text-against-400 text-sm">{error}</p>
            <button onClick={load} className="mt-3 inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-white">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <StatCard
                icon={Gavel}
                label="Laws established"
                value={data.summary.total_laws}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                color="text-gold"
              />
              <StatCard
                icon={Vote}
                label="Total votes cast"
                value={data.summary.total_votes}
                sub="across all laws"
                iconColor="text-for-300"
                iconBg="bg-for-500/10"
                color="text-for-300"
              />
              <StatCard
                icon={Heart}
                label="Endorsements given"
                value={data.summary.total_endorsements}
                iconColor="text-emerald"
                iconBg="bg-emerald/10"
                color="text-emerald"
              />
              <StatCard
                icon={Scale}
                label="Avg. support"
                value={`${data.summary.avg_blue_pct}%`}
                sub="mean FOR percentage"
                iconColor="text-purple"
                iconBg="bg-purple/10"
                color="text-purple"
              />
            </div>

            {/* Featured laws row */}
            {data.summary.most_voted_law && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6"
              >
                {[
                  { law: data.summary.most_voted_law, label: 'Most voted', icon: Trophy, color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
                  ...(data.summary.most_endorsed_law ? [{ law: data.summary.most_endorsed_law, label: 'Most endorsed', icon: HandshakeIcon, color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' }] : []),
                  ...(data.summary.most_debated_law ? [{ law: data.summary.most_debated_law, label: 'Most debated', icon: Mic, color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' }] : []),
                  ...(data.summary.newest_law ? [{ law: data.summary.newest_law, label: 'Most recent', icon: Zap, color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' }] : []),
                ].map(({ law, label, icon: Icon, color, bg, border }) => (
                  <Link key={`${label}-${law.id}`} href={`/law/${law.id}`} className="block group">
                    <div className={cn('rounded-xl border p-3 transition-colors hover:bg-surface-200/50', border, 'bg-surface-100')}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={cn('h-5 w-5 rounded-md flex items-center justify-center', bg)}>
                          <Icon className={cn('h-3 w-3', color)} />
                        </div>
                        <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', color)}>{label}</span>
                      </div>
                      <p className="text-xs font-medium text-surface-200 group-hover:text-white line-clamp-2 transition-colors leading-relaxed">
                        {law.statement}
                      </p>
                    </div>
                  </Link>
                ))}
              </motion.div>
            )}

            {/* Category breakdown */}
            {data.categories.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="h-4 w-4 text-surface-400" />
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-surface-500">Vote distribution by category</span>
                </div>
                <div className="space-y-0.5">
                  {data.categories.map((cat) => (
                    <CategoryBar key={cat.category} cat={cat} maxVotes={maxCatVotes} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Tab navigation */}
            <div className="flex gap-1.5 flex-wrap mb-4">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors',
                    tab === id
                      ? 'bg-for-500/20 border-for-500/40 text-for-300'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {tabLaws.length === 0 ? (
                  <p className="text-sm font-mono text-surface-500 py-6 text-center">No data for this view yet.</p>
                ) : (
                  <div>
                    {tabLaws.map((law, i) => (
                      <LawRow
                        key={law.id}
                        law={law}
                        rank={i + 1}
                        metric={tab === 'recent' ? 'votes' : tab === 'debates' ? 'debates' : tab}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* CTA row */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { href: '/law', label: 'Browse all laws', icon: Gavel },
                { href: '/law/endorsements', label: 'Law endorsements', icon: HandshakeIcon },
                { href: '/law/quality', label: 'Quality index', icon: Award },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 hover:bg-surface-200 hover:border-surface-400 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                    <span className="text-xs font-mono text-surface-500 group-hover:text-white transition-colors">{label}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
