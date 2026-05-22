'use client'

/**
 * /annual — The Civic Annual Report
 *
 * A comprehensive all-time record of Lobby Market's civic activity:
 * total topics debated, votes cast, laws established, debates held,
 * citizens who contributed, and the records that define the platform.
 *
 * Distinct from:
 *   /weekly   — community week in review (last 7 days)
 *   /digest   — curated editorial digest
 *   /insights — weekly data analytics
 *   /stats    — personal stats
 *
 * This is the permanent, accumulative civic ledger.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Award,
  BarChart2,
  BookOpen,
  ChevronRight,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  Globe,
  MessageSquare,
  RefreshCw,
  Scale,
  Scroll,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Users,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  AnnualData,
  AnnualTopLaw,
  AnnualContributor,
  AnnualRecord,
} from '@/app/api/annual/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBig(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    person: 'Citizen',
    debator: 'Debator',
    troll_catcher: 'Troll Catcher',
    elder: 'Elder',
    lawmaker: 'Lawmaker',
    senator: 'Senator',
  }
  return map[role] ?? role
}

function roleBadgeClass(role: string): string {
  const map: Record<string, string> = {
    elder: 'border-gold/40 text-gold bg-gold/10',
    senator: 'border-purple/40 text-purple bg-purple/10',
    lawmaker: 'border-gold/60 text-gold bg-gold/20',
    debator: 'border-for-500/40 text-for-300 bg-for-500/10',
    troll_catcher: 'border-emerald/40 text-emerald bg-emerald/10',
    person: 'border-surface-400 text-surface-500 bg-surface-300/20',
  }
  return map[role] ?? 'border-surface-400 text-surface-500'
}

const CATEGORY_COLORS: Record<string, { text: string; bar: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',    bar: 'bg-for-500',    bg: 'bg-for-500/10',    border: 'border-for-500/30' },
  Economics:   { text: 'text-gold',        bar: 'bg-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Technology:  { text: 'text-purple',      bar: 'bg-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bar: 'bg-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-for-300',     bar: 'bg-for-400',     bg: 'bg-for-400/10',     border: 'border-for-400/30' },
  Philosophy:  { text: 'text-purple',      bar: 'bg-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-against-400', bar: 'bg-against-500', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Health:      { text: 'text-emerald',     bar: 'bg-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-gold',        bar: 'bg-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Environment: { text: 'text-emerald',     bar: 'bg-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
}

function getCatColor(cat: string) {
  return (
    CATEGORY_COLORS[cat] ?? {
      text: 'text-surface-500',
      bar: 'bg-surface-400',
      bg: 'bg-surface-300/20',
      border: 'border-surface-400/30',
    }
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'blue',
  delay = 0,
}: {
  icon: typeof Flame
  label: string
  value: number | string
  sub?: string
  color?: 'blue' | 'gold' | 'emerald' | 'purple' | 'red'
  delay?: number
}) {
  const colorMap = {
    blue:   { icon: 'text-for-400',    bg: 'bg-for-500/10',    border: 'border-for-500/30' },
    gold:   { icon: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
    emerald:{ icon: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
    purple: { icon: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
    red:    { icon: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  }
  const c = colorMap[color]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn(
        'rounded-2xl border p-5 flex flex-col gap-2',
        'bg-surface-100',
        c.border,
      )}
    >
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl', c.bg, 'border', c.border)}>
        <Icon className={cn('h-4 w-4', c.icon)} />
      </div>
      <div className="mt-1">
        <div className="font-mono text-2xl font-bold text-white leading-none">
          {typeof value === 'number' ? formatBig(value) : value}
        </div>
        <div className="font-mono text-xs text-surface-500 mt-1">{label}</div>
        {sub && <div className="font-mono text-xs text-surface-600 mt-0.5">{sub}</div>}
      </div>
    </motion.div>
  )
}

function LawCard({ law, rank }: { law: AnnualTopLaw; rank: number }) {
  const forPct = Math.round(law.blue_pct ?? 50)
  const againstPct = 100 - forPct
  return (
    <Link href={`/topic/${law.id}`}>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: rank * 0.06, duration: 0.35 }}
        className={cn(
          'group flex items-start gap-4 rounded-xl border border-surface-300',
          'bg-surface-100 hover:bg-surface-200 p-4 transition-colors cursor-pointer',
        )}
      >
        <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-gold/10 border border-gold/30 font-mono text-sm font-bold text-gold">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {law.statement}
          </p>
          <div className="flex items-center gap-3 mt-2">
            {law.category && (
              <span className={cn('font-mono text-xs', getCatColor(law.category).text)}>
                {law.category}
              </span>
            )}
            <span className="font-mono text-xs text-surface-500">
              {law.total_votes?.toLocaleString()} votes
            </span>
          </div>
          {/* Vote bar */}
          <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
            <div
              className="bg-for-500 transition-all"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="bg-against-500 flex-1 transition-all"
              style={{ width: `${againstPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[10px] text-for-400">{forPct}% FOR</span>
            <span className="font-mono text-[10px] text-against-400">{againstPct}% AGAINST</span>
          </div>
        </div>
        <ChevronRight className="flex-shrink-0 h-4 w-4 text-surface-500 group-hover:text-white mt-1 transition-colors" />
      </motion.div>
    </Link>
  )
}

function ContributorCard({
  contributor,
  rank,
}: {
  contributor: AnnualContributor
  rank: number
}) {
  const rankColors = [
    'text-gold border-gold/40 bg-gold/10',
    'text-surface-300 border-surface-400/40 bg-surface-300/10',
    'text-amber-600 border-amber-600/40 bg-amber-600/10',
  ]
  return (
    <Link href={`/profile/${contributor.username}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: rank * 0.07, duration: 0.35 }}
        className="group flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 p-4 transition-colors cursor-pointer"
      >
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full border font-mono text-xs font-bold',
            rank <= 3 ? rankColors[rank - 1] : 'text-surface-500 border-surface-400/40 bg-surface-300/10',
          )}
        >
          {rank}
        </div>
        <Avatar
          src={contributor.avatar_url}
          username={contributor.username}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm text-white truncate group-hover:text-for-300 transition-colors">
            {contributor.display_name ?? contributor.username}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('font-mono text-[10px] px-1.5 py-0.5 rounded border', roleBadgeClass(contributor.role))}>
              {roleLabel(contributor.role)}
            </span>
            <span className="font-mono text-xs text-surface-500">
              {contributor.argument_count} args
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-mono text-sm font-bold text-gold">{(contributor.clout ?? 0).toLocaleString()}</div>
          <div className="font-mono text-[10px] text-surface-500">clout</div>
        </div>
      </motion.div>
    </Link>
  )
}

function RecordCard({ record, index }: { record: AnnualRecord; index: number }) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className={cn(
        'rounded-xl border border-surface-300 bg-surface-100 p-4',
        record.href ? 'hover:bg-surface-200 cursor-pointer transition-colors group' : '',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-xs text-surface-500 mb-1">{record.label}</div>
          <div className="font-mono text-lg font-bold text-white">{record.value}</div>
          <p className="font-mono text-xs text-surface-400 mt-1 line-clamp-2">{record.sublabel}</p>
        </div>
        {record.href && (
          <ExternalLink className="flex-shrink-0 h-4 w-4 text-surface-600 group-hover:text-white mt-1 transition-colors" />
        )}
      </div>
    </motion.div>
  )

  if (record.href) {
    return <Link href={record.href}>{content}</Link>
  }
  return content
}

// ─── Monthly Activity Bar Chart ────────────────────────────────────────────────

function MonthlyChart({ data }: { data: AnnualData['monthlyActivity'] }) {
  if (data.length === 0) return null
  const maxTopics = Math.max(...data.map((d) => d.topics), 1)

  return (
    <div>
      <div className="flex items-end gap-1.5 h-28">
        {data.map((point, i) => {
          const topicH = Math.round((point.topics / maxTopics) * 100)
          return (
            <div key={point.month} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                <div className="bg-surface-200 border border-surface-300 rounded-lg px-2 py-1 whitespace-nowrap font-mono text-[10px] text-white shadow-lg">
                  {point.label}
                  <br />
                  <span className="text-for-400">{point.topics} topics</span>
                  {point.laws > 0 && (
                    <span className="text-gold"> · {point.laws} laws</span>
                  )}
                </div>
              </div>
              {/* Bar */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${topicH}%` }}
                transition={{ delay: i * 0.04, duration: 0.5, ease: 'easeOut' }}
                className="w-full rounded-t-sm relative overflow-hidden"
                style={{ minHeight: 4 }}
              >
                <div
                  className="absolute inset-0 bg-for-500/30 group-hover:bg-for-500/50 transition-colors"
                />
                {point.laws > 0 && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-gold/60 group-hover:bg-gold/80 transition-colors"
                    style={{ height: `${Math.round((point.laws / Math.max(point.topics, 1)) * 100)}%` }}
                  />
                )}
              </motion.div>
            </div>
          )
        })}
      </div>
      {/* Month labels */}
      <div className="flex items-center gap-1.5 mt-1">
        {data.map((point) => (
          <div key={point.month} className="flex-1 text-center font-mono text-[9px] text-surface-600 truncate">
            {point.label.split(' ')[0]}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-for-500/30" />
          <span className="font-mono text-xs text-surface-500">Topics proposed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-gold/60" />
          <span className="font-mono text-xs text-surface-500">Laws established</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AnnualClient() {
  const [data, setData] = useState<AnnualData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/annual')
      if (!res.ok) throw new Error('Failed to load annual data')
      const json = (await res.json()) as AnnualData
      setData(json)
    } catch {
      setError('Could not load the annual report. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">
          <Skeleton className="h-8 w-52 mb-2" />
          <Skeleton className="h-5 w-72 mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl mb-6" />
          <Skeleton className="h-48 rounded-2xl" />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12 flex flex-col items-center justify-center gap-4 min-h-[50vh]">
          <Scale className="h-10 w-10 text-surface-600" />
          <p className="font-mono text-surface-400">{error ?? 'No data available.'}</p>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-500/10 border border-for-500/30 font-mono text-sm text-for-400 hover:bg-for-500/20 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { platform, topLaws, topArgument, topContributors, categoryStats, records, monthlyActivity } = data

  const sinceYear = platform.oldestTopicDate
    ? new Date(platform.oldestTopicDate).getFullYear()
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
              <Scroll className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                The Civic Annual
              </h1>
              <p className="font-mono text-sm text-surface-500 mt-0.5">
                All-time platform record{sinceYear ? ` · since ${sinceYear}` : ''}
              </p>
            </div>
          </div>
          <p className="font-mono text-sm text-surface-400 max-w-2xl">
            Every vote cast, every argument forged, every law the community turned from debate into
            consensus — the complete civic ledger of Lobby Market.
          </p>
        </motion.div>

        {/* ── Platform stats grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          <StatCard icon={BookOpen}     label="Topics Debated"  value={platform.totalTopics}    color="blue"   delay={0.05} />
          <StatCard icon={Gavel}        label="Laws Established" value={platform.totalLaws}     color="gold"   delay={0.10} />
          <StatCard icon={Vote}         label="Votes Cast"       value={platform.totalVotes}    color="blue"   delay={0.15} />
          <StatCard icon={MessageSquare} label="Arguments Written" value={platform.totalArguments} color="purple" delay={0.20} />
          <StatCard icon={Users}        label="Citizens"         value={platform.totalUsers}    color="emerald" delay={0.25} />
          <StatCard icon={Flame}        label="Debates Held"     value={platform.totalDebates}  color="red"    delay={0.30} />
          <StatCard icon={TrendingUp}   label="Avg Votes / Topic" value={platform.avgVotesPerTopic} color="gold" delay={0.35} />
          <StatCard icon={Scale}        label="Law Pass Rate"    value={`${platform.lawPassRate}%`} color="emerald" delay={0.40} sub="of concluded debates" />
        </div>

        {/* ── Monthly activity chart ─────────────────────────────────────── */}
        {monthlyActivity.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="rounded-2xl border border-surface-300 bg-surface-100 p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="h-4 w-4 text-for-400" />
              <h2 className="font-mono text-sm font-bold text-white">Activity over time</h2>
              <span className="font-mono text-xs text-surface-500 ml-1">— last 12 months</span>
            </div>
            <MonthlyChart data={monthlyActivity} />
          </motion.div>
        )}

        {/* ── Records ─────────────────────────────────────────────────────── */}
        {records.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="font-mono text-sm font-bold text-white">All-time records</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {records.map((record, i) => (
                <RecordCard key={record.label} record={record} index={i} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Two-column: Laws + Contributors ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* Top laws */}
          {topLaws.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-gold" />
                  <h2 className="font-mono text-sm font-bold text-white">Laws Hall of Fame</h2>
                </div>
                <Link
                  href="/laws"
                  className="font-mono text-xs text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                >
                  All laws <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {topLaws.map((law, i) => (
                  <LawCard key={law.id} law={law} rank={i + 1} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Top contributors */}
          {topContributors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-gold" />
                  <h2 className="font-mono text-sm font-bold text-white">Top Contributors</h2>
                </div>
                <Link
                  href="/leaderboard"
                  className="font-mono text-xs text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                >
                  Leaderboard <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {topContributors.map((c, i) => (
                  <ContributorCard key={c.id} contributor={c} rank={i + 1} />
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Top argument ─────────────────────────────────────────────────── */}
        {topArgument && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-purple" />
              <h2 className="font-mono text-sm font-bold text-white">Most Upvoted Argument</h2>
            </div>
            <Link href={`/topic/${topArgument.topic_id}`}>
              <div className="rounded-2xl border border-purple/30 bg-purple/5 hover:bg-purple/10 transition-colors p-5 cursor-pointer group">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar
                    src={topArgument.avatar_url}
                    username={topArgument.username}
                    size="sm"
                  />
                  <div>
                    <span className="font-mono text-sm font-semibold text-white">
                      {topArgument.display_name ?? topArgument.username}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={cn(
                          'font-mono text-xs px-1.5 py-0.5 rounded border',
                          topArgument.stance === 'for'
                            ? 'border-for-500/40 text-for-400 bg-for-500/10'
                            : 'border-against-500/40 text-against-400 bg-against-500/10',
                        )}
                      >
                        {topArgument.stance === 'for' ? (
                          <span className="flex items-center gap-1"><ThumbsUp className="h-2.5 w-2.5" /> FOR</span>
                        ) : (
                          <span className="flex items-center gap-1"><ThumbsDown className="h-2.5 w-2.5" /> AGAINST</span>
                        )}
                      </span>
                      <span className="font-mono text-xs text-surface-500">
                        {topArgument.upvotes.toLocaleString()} upvotes
                      </span>
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-1 font-mono text-xs text-surface-500 group-hover:text-white transition-colors">
                    View <ExternalLink className="h-3 w-3" />
                  </div>
                </div>
                <p className="font-mono text-sm text-white leading-relaxed line-clamp-4">
                  &ldquo;{topArgument.content}&rdquo;
                </p>
                <div className="mt-3 font-mono text-xs text-surface-500 truncate">
                  On: {topArgument.topic_statement}
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {/* ── Category breakdown ───────────────────────────────────────────── */}
        {categoryStats.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-4 w-4 text-emerald" />
              <h2 className="font-mono text-sm font-bold text-white">Civic categories</h2>
            </div>
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
              <div className="space-y-3">
                {categoryStats.map((cat, i) => {
                  const maxVotes = categoryStats[0].votes || 1
                  const barWidth = Math.round((cat.votes / maxVotes) * 100)
                  const cc = getCatColor(cat.category)
                  return (
                    <motion.div
                      key={cat.category}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.7 + i * 0.05 }}
                      className="group"
                    >
                      <Link href={`/categories/${encodeURIComponent(cat.category)}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={cn('font-mono text-sm font-semibold', cc.text)}>
                              {cat.category}
                            </span>
                            <span className="font-mono text-xs text-surface-500">
                              {cat.laws} law{cat.laws !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-xs text-surface-500">
                            <span>{cat.topics} topics</span>
                            <span>{(cat.votes / 1000).toFixed(1)}K votes</span>
                            <span className={cc.text}>{cat.law_pct}% pass</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden bg-surface-300">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ delay: 0.75 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                            className={cn('h-full rounded-full', cc.bar)}
                          />
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Footer nav ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-wrap gap-3 pt-4 border-t border-surface-300"
        >
          {[
            { href: '/laws',       label: 'Law Archive',       icon: Gavel },
            { href: '/leaderboard', label: 'Leaderboard',      icon: Crown },
            { href: '/weekly',     label: 'Weekly Roundup',    icon: BarChart2 },
            { href: '/wrapped',    label: 'Your Wrapped',      icon: Award },
            { href: '/insights',   label: 'Platform Insights', icon: Sparkles },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-300 bg-surface-100 hover:bg-surface-200 font-mono text-xs text-surface-400 hover:text-white transition-colors"
            >
              <Icon className="h-3 w-3" />
              {label}
            </Link>
          ))}
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-300 bg-surface-100 hover:bg-surface-200 font-mono text-xs text-surface-400 hover:text-white transition-colors ml-auto"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </motion.div>

        {/* Generated at */}
        <p className="font-mono text-[10px] text-surface-600 mt-4 text-right">
          Generated {new Date(data.generatedAt).toLocaleString()} · cached hourly
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
