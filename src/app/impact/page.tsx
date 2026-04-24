'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Target,
  TrendingUp,
  TrendingDown,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type {
  ImpactData,
  LawRecord,
  FailedRecord,
  TopArgument,
  ActiveStake,
} from '@/app/api/impact/route'

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
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function truncate(s: string, max = 90): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  iconColor,
  iconBg,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  value: number | string
  label: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface-100 border border-surface-300/60 p-4">
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border', iconBg)}>
        <Icon className={cn('h-4.5 w-4.5', iconColor)} />
      </div>
      <div className="mt-1">
        <div className="font-mono text-2xl font-bold text-white leading-none">
          {typeof value === 'number' ? (
            <AnimatedNumber value={value} />
          ) : (
            value
          )}
        </div>
        <div className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mt-1">
          {label}
        </div>
      </div>
    </div>
  )
}

// ─── Score ring ───────────────────────────────────────────────────────────────

function ImpactScoreRing({ score }: { score: number }) {
  const tier =
    score >= 500
      ? { label: 'Legendary', color: '#c9a84c', glow: 'shadow-[0_0_32px_rgba(201,168,76,0.35)]' }
      : score >= 200
      ? { label: 'Champion', color: '#8b5cf6', glow: 'shadow-[0_0_32px_rgba(139,92,246,0.3)]' }
      : score >= 80
      ? { label: 'Advocate', color: '#10b981', glow: 'shadow-[0_0_24px_rgba(16,185,129,0.25)]' }
      : score >= 20
      ? { label: 'Contributor', color: '#3b82f6', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.2)]' }
      : { label: 'Newcomer', color: '#4b5563', glow: '' }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'flex items-center justify-center rounded-full h-24 w-24 border-2',
          tier.glow
        )}
        style={{ borderColor: tier.color, boxShadow: undefined }}
      >
        <div className="flex flex-col items-center">
          <span className="font-mono text-2xl font-black text-white leading-none">
            {score}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest mt-0.5" style={{ color: tier.color }}>
            pts
          </span>
        </div>
      </div>
      <span className="font-mono text-xs uppercase tracking-wider font-bold" style={{ color: tier.color }}>
        {tier.label}
      </span>
    </div>
  )
}

// ─── Win-rate bar ─────────────────────────────────────────────────────────────

function WinRateBar({ rate, label }: { rate: number | null; label: string }) {
  if (rate === null) {
    return (
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-surface-500">{label}</span>
        <span className="text-surface-600">No data yet</span>
      </div>
    )
  }
  const color = rate >= 60 ? '#10b981' : rate >= 40 ? '#3b82f6' : '#ef4444'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-surface-500">{label}</span>
        <span className="font-bold" style={{ color }}>
          {rate}%
        </span>
      </div>
      <div className="h-1.5 bg-surface-300/50 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${rate}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law }: { law: LawRecord }) {
  return (
    <Link href={`/topic/${law.topic_id}`}>
      <div className="group flex items-start gap-3 rounded-xl border border-surface-300/50 bg-surface-100 p-4 hover:border-gold/40 hover:bg-surface-200/80 transition-all">
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg mt-0.5',
            law.won
              ? 'bg-gold/15 border border-gold/30'
              : 'bg-against-500/10 border border-against-500/20'
          )}
        >
          {law.won ? (
            <Gavel className="h-4 w-4 text-gold" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-against-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-700 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {law.statement}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {law.category && (
              <span
                className={cn(
                  'text-[10px] font-mono uppercase tracking-wider',
                  CATEGORY_COLORS[law.category] ?? 'text-surface-500'
                )}
              >
                {law.category}
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-600">
              {law.final_pct}% for
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {law.established_at ? relativeTime(law.established_at) : ''}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <div
            className={cn(
              'flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full',
              law.side === 'blue'
                ? 'bg-for-500/15 text-for-400'
                : 'bg-against-500/15 text-against-400'
            )}
          >
            {law.side === 'blue' ? (
              <ThumbsUp className="h-2.5 w-2.5" />
            ) : (
              <ThumbsDown className="h-2.5 w-2.5" />
            )}
            {law.side === 'blue' ? 'FOR' : 'AGAINST'}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Failed card ──────────────────────────────────────────────────────────────

function FailedCard({ item }: { item: FailedRecord }) {
  return (
    <Link href={`/topic/${item.topic_id}`}>
      <div className="group flex items-start gap-3 rounded-xl border border-surface-300/50 bg-surface-100 p-4 hover:border-surface-400/40 hover:bg-surface-200/80 transition-all">
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg mt-0.5',
            item.won
              ? 'bg-emerald/15 border border-emerald/30'
              : 'bg-surface-400/10 border border-surface-400/20'
          )}
        >
          {item.won ? (
            <CheckCircle2 className="h-4 w-4 text-emerald" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-surface-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-700 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {item.statement}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {item.category && (
              <span
                className={cn(
                  'text-[10px] font-mono uppercase tracking-wider',
                  CATEGORY_COLORS[item.category] ?? 'text-surface-500'
                )}
              >
                {item.category}
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-600">
              Ended {item.final_pct}% for
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {relativeTime(item.resolved_at)}
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {item.won && (
            <span className="text-[10px] font-mono font-bold text-emerald px-2 py-0.5 bg-emerald/10 rounded-full">
              Called it
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgCard({ arg }: { arg: TopArgument }) {
  return (
    <Link href={`/arguments/${arg.id}`}>
      <div className="group rounded-xl border border-surface-300/50 bg-surface-100 p-4 hover:border-for-500/30 hover:bg-surface-200/80 transition-all space-y-2">
        <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider line-clamp-1">
          {truncate(arg.topic_statement, 60)}
        </p>
        <p className="text-sm text-surface-700 leading-snug line-clamp-2 group-hover:text-white transition-colors">
          {arg.content}
        </p>
        <div className="flex items-center justify-between">
          <div
            className={cn(
              'flex items-center gap-1 text-[10px] font-mono font-bold',
              arg.side === 'blue' ? 'text-for-400' : 'text-against-400'
            )}
          >
            {arg.side === 'blue' ? (
              <ThumbsUp className="h-2.5 w-2.5" />
            ) : (
              <ThumbsDown className="h-2.5 w-2.5" />
            )}
            {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
          </div>
          <div className="flex items-center gap-1 text-xs font-mono text-for-400">
            <ChevronUp className="h-3.5 w-3.5" />
            <span className="font-bold">{arg.upvotes}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Active stake card ────────────────────────────────────────────────────────

function StakeCard({ stake }: { stake: ActiveStake }) {
  const forPct = Math.round(stake.blue_pct)
  const isFor = stake.side === 'blue'
  const isWinning = stake.is_winning

  return (
    <Link href={`/topic/${stake.topic_id}`}>
      <div className="group flex items-start gap-3 rounded-xl border border-surface-300/50 bg-surface-100 p-4 hover:border-surface-400/40 hover:bg-surface-200/80 transition-all">
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg mt-0.5',
            isWinning
              ? 'bg-emerald/10 border border-emerald/30'
              : 'bg-against-500/10 border border-against-500/20'
          )}
        >
          {isWinning ? (
            <TrendingUp className="h-4 w-4 text-emerald" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-against-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-700 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {stake.statement}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {stake.category && (
              <span
                className={cn(
                  'text-[10px] font-mono uppercase tracking-wider',
                  CATEGORY_COLORS[stake.category] ?? 'text-surface-500'
                )}
              >
                {stake.category}
              </span>
            )}
            <Badge variant={stake.status as 'proposed' | 'active' | 'law' | 'failed'}>
              {stake.status}
            </Badge>
            <span className="text-[10px] font-mono text-surface-600">
              {forPct}% for · {stake.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>
        <div className="flex-shrink-0">
          <div
            className={cn(
              'flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full',
              isFor
                ? 'bg-for-500/15 text-for-400'
                : 'bg-against-500/15 text-against-400'
            )}
          >
            {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
            {isFor ? 'FOR' : 'AGAINST'}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  count,
  children,
  emptyText,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  title: string
  count: number
  children: React.ReactNode
  emptyText: string
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-3 w-full text-left"
      >
        <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg border', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <span className="font-mono text-sm font-bold text-white uppercase tracking-wider flex-1">
          {title}
        </span>
        <span className="font-mono text-xs text-surface-500">{count}</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-surface-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {count === 0 ? (
              <p className="text-sm font-mono text-surface-600 py-4 pl-11">{emptyText}</p>
            ) : (
              <div className="space-y-2 pl-0">{children}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImpactPage() {
  const router = useRouter()
  const [data, setData] = useState<ImpactData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Auth check
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const res = await fetch('/api/impact')
      if (!res.ok) throw new Error('Failed to load')
      const json: ImpactData = await res.json()
      setData(json)
    } catch {
      setError('Could not load your impact data.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12 space-y-8">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/analytics"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:bg-surface-300/60 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-surface-500" />
            </Link>
            <div>
              <h1 className="font-mono text-2xl font-black text-white tracking-tight">
                Your Impact
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Your civic legacy on Lobby Market
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:bg-surface-300/60 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
              </div>
            ))}
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && !loading && (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center space-y-3">
            <p className="text-against-400 font-mono text-sm">{error}</p>
            <button onClick={load} className="text-xs font-mono text-surface-500 hover:text-white transition-colors">
              Try again
            </button>
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────────────── */}
        {data && !loading && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Score + accuracy band */}
              <div className="rounded-2xl border border-surface-300/60 bg-surface-100 p-6 flex flex-col md:flex-row items-center gap-6">
                <ImpactScoreRing score={data.impact_score} />
                <div className="flex-1 w-full space-y-4">
                  <WinRateBar
                    rate={data.stats.all_win_rate}
                    label="Overall win rate"
                  />
                  <WinRateBar
                    rate={data.stats.law_win_rate}
                    label="Law pass rate"
                  />
                  <p className="text-[11px] font-mono text-surface-600">
                    Based on{' '}
                    <span className="text-white">{data.stats.resolved_count}</span>{' '}
                    resolved topics
                  </p>
                </div>
              </div>

              {/* Stat pills */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatPill
                  icon={Gavel}
                  iconColor="text-gold"
                  iconBg="bg-gold/10 border-gold/30"
                  value={data.stats.total_laws_shaped}
                  label="Laws shaped"
                />
                <StatPill
                  icon={CheckCircle2}
                  iconColor="text-emerald"
                  iconBg="bg-emerald/10 border-emerald/30"
                  value={data.stats.total_correct_calls}
                  label="Correct calls"
                />
                <StatPill
                  icon={MessageSquare}
                  iconColor="text-for-400"
                  iconBg="bg-for-500/10 border-for-500/30"
                  value={data.stats.arg_total_upvotes}
                  label="Arg upvotes"
                />
                <StatPill
                  icon={Zap}
                  iconColor="text-purple"
                  iconBg="bg-purple/10 border-purple/30"
                  value={data.stats.total_active_stakes}
                  label="Active stakes"
                />
              </div>

              {/* Laws championed */}
              <Section
                icon={Gavel}
                iconColor="text-gold"
                iconBg="bg-gold/10 border-gold/30"
                title="Laws You Shaped"
                count={data.laws_championed.length}
                emptyText="No resolved laws yet — keep voting on active topics."
              >
                {data.laws_championed.map((law) => (
                  <LawCard key={law.topic_id} law={law} />
                ))}
              </Section>

              {/* Correct against */}
              {data.correct_against.length > 0 && (
                <Section
                  icon={Target}
                  iconColor="text-emerald"
                  iconBg="bg-emerald/10 border-emerald/30"
                  title="Correct Predictions"
                  count={data.correct_against.length}
                  emptyText="No failed topics to show yet."
                >
                  {data.correct_against.map((item) => (
                    <FailedCard key={item.topic_id} item={item} />
                  ))}
                </Section>
              )}

              {/* Top arguments */}
              {data.top_arguments.length > 0 && (
                <Section
                  icon={MessageSquare}
                  iconColor="text-for-400"
                  iconBg="bg-for-500/10 border-for-500/30"
                  title="Your Best Arguments"
                  count={data.top_arguments.length}
                  emptyText="No upvoted arguments yet."
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {data.top_arguments.map((arg) => (
                      <ArgCard key={arg.id} arg={arg} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Active stakes */}
              <Section
                icon={Scale}
                iconColor="text-purple"
                iconBg="bg-purple/10 border-purple/30"
                title="Active Stakes"
                count={data.active_stakes.length}
                emptyText="No active topics you've voted on — vote on something!"
              >
                {data.active_stakes.map((stake) => (
                  <StakeCard key={stake.topic_id} stake={stake} />
                ))}
              </Section>

              {/* CTA to analytics */}
              <div className="flex items-center justify-between rounded-2xl border border-surface-300/40 bg-surface-100 p-5">
                <div>
                  <p className="font-mono text-sm font-bold text-white">Deeper analytics</p>
                  <p className="text-xs font-mono text-surface-500 mt-0.5">
                    Category breakdown, vote calendar, political kin
                  </p>
                </div>
                <Link
                  href="/analytics"
                  className="flex items-center gap-2 text-xs font-mono font-bold text-for-400 hover:text-for-300 transition-colors"
                >
                  Analytics <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
