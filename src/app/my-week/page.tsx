'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  CheckCircle2,
  Coins,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { MyWeekData } from '@/app/api/my-week/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

const CAT_BAR: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-500',
  Philosophy:  'bg-for-400',
  Culture:     'bg-gold',
  Health:      'bg-against-400',
  Environment: 'bg-emerald',
  Education:   'bg-purple',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WeekSkeleton() {
  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0,1,2,3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="flex items-end gap-2 h-20">
          {[40, 70, 30, 90, 50, 60, 45].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm animate-pulse bg-surface-300/50"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0,1].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-40">
            <Skeleton className="h-4 w-28 mb-4" />
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Day chart ────────────────────────────────────────────────────────────────

function DayChart({ byDay }: { byDay: MyWeekData['votes']['byDay'] }) {
  const maxCount = Math.max(...byDay.map((d) => d.count), 1)
  return (
    <div className="flex items-end gap-1.5 sm:gap-2 h-24">
      {byDay.map((d) => {
        const pct = Math.max((d.count / maxCount) * 100, d.count > 0 ? 8 : 2)
        const isToday = d.date === new Date().toISOString().slice(0, 10)
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: byDay.indexOf(d) * 0.05 }}
                className={cn(
                  'w-full rounded-t-sm min-h-[2px]',
                  d.count > 0
                    ? isToday ? 'bg-for-500' : 'bg-for-700'
                    : 'bg-surface-300'
                )}
              />
            </div>
            <span className={cn(
              'text-[10px] font-mono',
              isToday ? 'text-for-400 font-bold' : 'text-surface-600'
            )}>
              {dayLabel(d.date)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string
  value: number | string
  sub?: string
  accent?: 'for' | 'against' | 'gold' | 'emerald' | 'purple'
  icon?: typeof Zap
}) {
  const colorMap = {
    for:     'text-for-400',
    against: 'text-against-400',
    gold:    'text-gold',
    emerald: 'text-emerald',
    purple:  'text-purple',
  } as const

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-surface-500" />}
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{label}</span>
      </div>
      <div className={cn(
        'font-mono text-2xl font-bold',
        accent ? colorMap[accent] : 'text-white'
      )}>
        {typeof value === 'number'
          ? <AnimatedNumber value={value} />
          : value}
      </div>
      {sub && <p className="text-[11px] text-surface-600 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, sub }: {
  icon: typeof Zap
  title: string
  sub?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
        <Icon className="h-3.5 w-3.5 text-surface-500" />
      </div>
      <div>
        <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest">{title}</h2>
        {sub && <p className="text-[10px] text-surface-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Empty week ───────────────────────────────────────────────────────────────

function EmptyWeek() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-10 text-center">
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 mx-auto mb-4">
        <BarChart2 className="h-6 w-6 text-surface-500" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">No activity this week</h3>
      <p className="text-sm text-surface-500 mb-6 max-w-xs mx-auto">
        Cast your first vote this week to see your personal civic summary here.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
      >
        Browse topics
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyWeekPage() {
  const router = useRouter()
  const [data, setData] = useState<MyWeekData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/my-week')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load your weekly summary.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const cardClass = 'rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono">My Week</h1>
            {data && !loading && (
              <p className="text-xs text-surface-500 mt-0.5">
                {formatDate(data.weekStart)} – {formatDate(data.weekEnd)}
              </p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-against-950/40 border border-against-600/30 p-5 text-center mb-4">
            <p className="text-sm text-against-300">{error}</p>
            <button onClick={load} className="mt-3 text-xs font-mono text-against-400 hover:text-against-300 underline">
              Try again
            </button>
          </div>
        )}

        {loading && <WeekSkeleton />}

        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {data.votes.total === 0 ? (
                <EmptyWeek />
              ) : (
                <>
                  {/* ── Hero stats ─────────────────────────────────────────── */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <StatCard
                      label="Votes cast"
                      value={data.votes.total}
                      sub={data.prevWeekVotes > 0
                        ? `${data.votes.total >= data.prevWeekVotes ? '+' : ''}${data.votes.total - data.prevWeekVotes} vs last week`
                        : 'this week'}
                      accent={data.votes.total > data.prevWeekVotes ? 'for' : undefined}
                      icon={Flame}
                    />
                    <StatCard
                      label="Accuracy"
                      value={data.accuracy.pct != null ? `${data.accuracy.pct}%` : '—'}
                      sub={data.accuracy.resolved > 0
                        ? `${data.accuracy.correct}/${data.accuracy.resolved} resolved`
                        : 'no resolved topics yet'}
                      accent={data.accuracy.pct != null
                        ? data.accuracy.pct >= 60 ? 'emerald' : data.accuracy.pct >= 40 ? 'gold' : 'against'
                        : undefined}
                      icon={Target}
                    />
                    <StatCard
                      label="Clout earned"
                      value={data.clout.change >= 0 ? `+${data.clout.change}` : String(data.clout.change)}
                      sub={`Balance: ${fmt(data.clout.current)}`}
                      accent={data.clout.change > 0 ? 'gold' : undefined}
                      icon={Coins}
                    />
                    <StatCard
                      label="Active days"
                      value={data.streak.active_days}
                      sub={`${data.streak.current}-day streak`}
                      accent={data.streak.active_days >= 5 ? 'emerald' : data.streak.active_days >= 3 ? 'for' : undefined}
                      icon={Zap}
                    />
                  </div>

                  {/* ── Vote activity chart ─────────────────────────────────── */}
                  <div className={cardClass}>
                    <SectionHeader icon={BarChart2} title="Daily Activity" sub="votes per day this week" />
                    <DayChart byDay={data.votes.byDay} />

                    {/* FOR / AGAINST split */}
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex-1 flex items-center gap-2">
                        <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                        <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                          <div
                            className="h-full bg-for-500 rounded-full transition-all"
                            style={{ width: data.votes.total > 0 ? `${(data.votes.blue / data.votes.total) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="text-xs font-mono text-for-400 w-8 text-right">{data.votes.total > 0 ? Math.round((data.votes.blue / data.votes.total) * 100) : 0}%</span>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                        <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                          <div
                            className="h-full bg-against-500 rounded-full transition-all"
                            style={{ width: data.votes.total > 0 ? `${(data.votes.red / data.votes.total) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className="text-xs font-mono text-against-400 w-8 text-right">{data.votes.total > 0 ? Math.round((data.votes.red / data.votes.total) * 100) : 0}%</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Category breakdown ──────────────────────────────────── */}
                  {data.categories.length > 0 && (
                    <div className={cardClass}>
                      <SectionHeader icon={Scale} title="Top Categories" sub="where you voted most this week" />
                      <div className="space-y-3">
                        {data.categories.map((cat, i) => {
                          const maxCat = data.categories[0].count
                          const pct = Math.round((cat.count / maxCat) * 100)
                          const color = CAT_COLOR[cat.category] ?? 'text-surface-400'
                          const bar = CAT_BAR[cat.category] ?? 'bg-surface-400'
                          return (
                            <div key={cat.category} className="flex items-center gap-3">
                              <span className="text-[11px] font-mono text-surface-500 w-4 text-right flex-shrink-0">{i + 1}</span>
                              <span className={cn('text-sm font-medium w-24 truncate flex-shrink-0', color)}>{cat.category}</span>
                              <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.5, delay: i * 0.08 }}
                                  className={cn('h-full rounded-full', bar)}
                                />
                              </div>
                              <span className="text-[11px] font-mono text-surface-500 w-8 text-right flex-shrink-0">
                                {cat.count}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Laws you helped pass ────────────────────────────────── */}
                  {data.laws.length > 0 && (
                    <div className={cardClass}>
                      <SectionHeader
                        icon={Gavel}
                        title="Laws Established"
                        sub="topics you voted on that became law this week"
                      />
                      <div className="space-y-3">
                        {data.laws.map((law) => (
                          <Link
                            key={law.id}
                            href={`/law/${law.id}`}
                            className="group flex items-start gap-3 p-3 rounded-xl border border-surface-300 bg-surface-200/40 hover:border-emerald/30 hover:bg-surface-200 transition-colors"
                          >
                            <div className="flex items-center justify-center h-7 w-7 rounded-full bg-emerald/10 border border-emerald/30 flex-shrink-0 mt-0.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white group-hover:text-emerald transition-colors line-clamp-2">
                                {law.statement}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                {law.category && (
                                  <span className={cn('text-[10px] font-mono', CAT_COLOR[law.category] ?? 'text-surface-500')}>
                                    {law.category}
                                  </span>
                                )}
                                {law.your_vote && (
                                  <span className={cn(
                                    'inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border',
                                    law.your_vote === 'blue'
                                      ? 'text-for-400 bg-for-500/10 border-for-500/30'
                                      : 'text-against-400 bg-against-500/10 border-against-500/30'
                                  )}>
                                    {law.your_vote === 'blue' ? 'You voted FOR' : 'You voted AGAINST'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-emerald transition-colors flex-shrink-0 mt-0.5" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Top argument ────────────────────────────────────────── */}
                  {data.topArgument && (
                    <div className={cardClass}>
                      <SectionHeader icon={MessageSquare} title="Top Argument" sub="your most upvoted argument this week" />
                      <Link
                        href={`/topic/${data.topArgument.topic_id}`}
                        className="group block p-4 rounded-xl border border-surface-300 bg-surface-200/40 hover:border-for-500/30 hover:bg-surface-200 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {data.topArgument.side === 'blue' ? (
                            <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                          ) : (
                            <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                          )}
                          <span className={cn(
                            'text-[10px] font-mono font-semibold uppercase tracking-wide',
                            data.topArgument.side === 'blue' ? 'text-for-400' : 'text-against-400'
                          )}>
                            {data.topArgument.side === 'blue' ? 'FOR' : 'AGAINST'}
                          </span>
                          <span className="text-[10px] font-mono text-surface-500 ml-auto">
                            {data.topArgument.upvotes} upvotes
                          </span>
                        </div>
                        <p className="text-sm text-white line-clamp-3 leading-relaxed mb-2">
                          {data.topArgument.content}
                        </p>
                        <p className="text-[11px] text-surface-500 truncate group-hover:text-for-400 transition-colors">
                          on: {data.topArgument.topic_statement}
                        </p>
                      </Link>
                    </div>
                  )}

                  {/* ── Achievements ────────────────────────────────────────── */}
                  {data.achievements.length > 0 && (
                    <div className={cardClass}>
                      <SectionHeader
                        icon={Award}
                        title="Achievements Unlocked"
                        sub={`${data.achievements.length} earned this week`}
                      />
                      <div className="space-y-3">
                        {data.achievements.map((ach) => (
                          <div
                            key={ach.id}
                            className="flex items-center gap-3 p-3 rounded-xl border border-gold/20 bg-gold/5"
                          >
                            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0 text-lg">
                              {ach.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gold">{ach.name}</p>
                              <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{ach.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Momentum vs last week ───────────────────────────────── */}
                  <div className={cardClass}>
                    <SectionHeader icon={TrendingUp} title="Weekly Momentum" />
                    <div className="flex items-center gap-4">
                      <div className="flex-1 text-center">
                        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Last week</p>
                        <p className="font-mono text-2xl font-bold text-surface-400">{data.prevWeekVotes}</p>
                        <p className="text-[10px] text-surface-600">votes</p>
                      </div>
                      <div className={cn(
                        'flex items-center justify-center h-10 w-10 rounded-full border flex-shrink-0',
                        data.votes.total > data.prevWeekVotes
                          ? 'border-emerald/40 bg-emerald/10'
                          : data.votes.total < data.prevWeekVotes
                          ? 'border-against-500/40 bg-against-500/10'
                          : 'border-surface-400/40 bg-surface-300/10'
                      )}>
                        {data.votes.total > data.prevWeekVotes
                          ? <TrendingUp className="h-4 w-4 text-emerald" />
                          : data.votes.total < data.prevWeekVotes
                          ? <TrendingDown className="h-4 w-4 text-against-400" />
                          : <Scale className="h-4 w-4 text-surface-400" />}
                      </div>
                      <div className="flex-1 text-center">
                        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">This week</p>
                        <p className={cn(
                          'font-mono text-2xl font-bold',
                          data.votes.total > data.prevWeekVotes ? 'text-emerald'
                            : data.votes.total < data.prevWeekVotes ? 'text-against-400'
                            : 'text-white'
                        )}>{data.votes.total}</p>
                        <p className="text-[10px] text-surface-600">votes</p>
                      </div>
                    </div>
                  </div>

                  {/* ── Footer links ─────────────────────────────────────────── */}
                  <div className="flex flex-wrap gap-3 mt-2 pt-4 border-t border-surface-300">
                    <Link href="/analytics" className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors">
                      <BarChart2 className="h-3.5 w-3.5" /> All-time analytics
                    </Link>
                    <Link href="/positions" className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors">
                      <Scale className="h-3.5 w-3.5" /> My positions
                    </Link>
                    <Link href="/achievements" className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors">
                      <Award className="h-3.5 w-3.5" /> All achievements
                    </Link>
                    <Link href="/challenge" className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors">
                      <Zap className="h-3.5 w-3.5" /> Daily challenge
                    </Link>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
