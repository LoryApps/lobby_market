'use client'

/**
 * /analytics/audience — Civic Audience Analytics
 *
 * Shows WHO engages with your arguments: top supporters, their civic roles,
 * which categories resonate most, and how your audience has grown month by month.
 *
 * Distinct from:
 *   /analytics/influence   — your composite influence score (how powerful you are)
 *   /analytics/network     — your social follow graph topology
 *   /analytics/resonance   — cross-partisan argument appeal
 *   /activity/upvotes      — raw chronological list of upvotes received
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Crown,
  ExternalLink,
  Flame,
  RefreshCw,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  AudienceResponse,
  TopSupporter,
  CategoryAffinity,
  MonthlyEngagement,
} from '@/app/api/analytics/audience/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  Education:   'text-for-400',
}

const ROLE_COLOR: Record<string, string> = {
  elder:         'text-gold',
  senator:       'text-purple',
  lawmaker:      'text-gold',
  debator:       'text-for-400',
  troll_catcher: 'text-emerald',
  person:        'text-surface-500',
  citizen:       'text-surface-500',
}

const ROLE_LABEL: Record<string, string> = {
  elder:         'Elder',
  senator:       'Senator',
  lawmaker:      'Lawmaker',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  person:        'Citizen',
  citizen:       'Citizen',
}

const ROLE_ICON: Record<string, typeof Crown> = {
  elder:         Crown,
  senator:       Shield,
  lawmaker:      Trophy,
  debator:       Star,
  troll_catcher: Zap,
  person:        Users,
  citizen:       Users,
}

const TIER_ICON: Record<string, typeof Users> = {
  micro:       Users,
  rising:      Flame,
  established: Star,
  prominent:   Trophy,
  civic_voice: Crown,
}

const TIER_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  micro:       { text: 'text-surface-400',  bg: 'bg-surface-300/20',   border: 'border-surface-300' },
  rising:      { text: 'text-for-400',      bg: 'bg-for-500/10',       border: 'border-for-500/30' },
  established: { text: 'text-gold',         bg: 'bg-gold/10',          border: 'border-gold/30' },
  prominent:   { text: 'text-purple',       bg: 'bg-purple/10',        border: 'border-purple/30' },
  civic_voice: { text: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30' },
}

function shortMonth(ym: string): string {
  const [year, month] = ym.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role
}
function roleColor(role: string): string {
  return ROLE_COLOR[role] ?? 'text-surface-500'
}
function catColor(cat: string): string {
  return CAT_COLOR[cat] ?? 'text-surface-400'
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
  animateValue,
  delay = 0,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  animateValue?: number
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 flex flex-col gap-2"
    >
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <p className="font-mono text-2xl font-bold text-white tabular-nums">
          {animateValue !== undefined ? <AnimatedNumber value={animateValue} /> : value}
        </p>
        {sub && <p className="text-[11px] font-mono text-surface-500 mt-0.5">{sub}</p>}
      </div>
      <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
    </motion.div>
  )
}

// ─── Monthly bar chart ────────────────────────────────────────────────────────

function MonthlyChart({ months }: { months: MonthlyEngagement[] }) {
  const max = Math.max(...months.map((m) => m.upvotes_received), 1)
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="h-4 w-4 text-surface-500" />
        <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Monthly engagement</p>
      </div>
      <div className="flex items-end gap-1.5 h-24">
        {months.map((m, i) => {
          const pct = (m.upvotes_received / max) * 100
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full flex flex-col justify-end h-20 relative">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(pct, m.upvotes_received > 0 ? 4 : 0)}%` }}
                  transition={{ duration: 0.5, delay: i * 0.03, ease: 'easeOut' }}
                  className={cn(
                    'w-full rounded-t-sm',
                    m.upvotes_received > 0 ? 'bg-for-500' : 'bg-surface-300/30',
                  )}
                />
              </div>
              <span className="text-[9px] font-mono text-surface-600 group-hover:text-surface-400 transition-colors">
                {shortMonth(m.month)}
              </span>
              {/* Tooltip */}
              {m.upvotes_received > 0 && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap">
                  <div className="bg-surface-100 border border-surface-300 rounded-lg px-2 py-1 text-[10px] font-mono text-white shadow-lg">
                    {m.upvotes_received} upvote{m.upvotes_received !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Role breakdown ───────────────────────────────────────────────────────────

function RoleBar({ role, count, pct }: { role: string; count: number; pct: number }) {
  const Icon = ROLE_ICON[role] ?? Users
  const color = roleColor(role)
  const barColors: Record<string, string> = {
    elder: 'bg-gold',
    senator: 'bg-purple',
    lawmaker: 'bg-gold/70',
    debator: 'bg-for-500',
    troll_catcher: 'bg-emerald',
    person: 'bg-surface-400',
    citizen: 'bg-surface-400',
  }
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
        <span className={cn('text-xs font-mono', color)}>{roleLabel(role)}</span>
      </div>
      <div className="flex-1 relative h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('absolute inset-y-0 left-0 rounded-full', barColors[role] ?? 'bg-surface-400')}
        />
      </div>
      <span className="text-xs font-mono text-surface-500 w-12 text-right tabular-nums">
        {count} <span className="text-surface-600">({pct}%)</span>
      </span>
    </div>
  )
}

// ─── Supporter card ───────────────────────────────────────────────────────────

function SupporterCard({ supporter, rank }: { supporter: TopSupporter; rank: number }) {
  const color = roleColor(supporter.role)
  return (
    <Link href={`/profile/${supporter.username}`}>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, delay: rank * 0.04 }}
        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-300/40 bg-surface-100/60 hover:border-surface-400/60 hover:bg-surface-200/60 transition-all group"
      >
        <span className="text-[10px] font-mono text-surface-600 w-5 tabular-nums text-right">
          {rank + 1}
        </span>
        <Avatar
          src={supporter.avatar_url ?? undefined}
          fallback={supporter.username}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-medium text-white truncate">
            {supporter.display_name ?? supporter.username}
          </p>
          <p className={cn('text-[11px] font-mono', color)}>
            {roleLabel(supporter.role)}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-mono font-bold text-for-400">
            {supporter.upvote_count}
          </p>
          <p className="text-[10px] font-mono text-surface-600">upvotes</p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-surface-600 group-hover:text-white flex-shrink-0 transition-colors" />
      </motion.div>
    </Link>
  )
}

// ─── Category affinity card ───────────────────────────────────────────────────

function CategoryCard({ cat, total }: { cat: CategoryAffinity; total: number }) {
  const pct = total > 0 ? (cat.upvote_count / total) * 100 : 0
  const color = catColor(cat.category)
  return (
    <div className="flex items-center gap-3">
      <span className={cn('text-xs font-mono font-medium w-24 flex-shrink-0', color)}>
        {cat.category}
      </span>
      <div className="flex-1 relative h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 rounded-full bg-for-500"
        />
      </div>
      <div className="text-right flex-shrink-0 w-24">
        <span className="text-xs font-mono text-white tabular-nums">{cat.upvote_count}</span>
        <span className="text-[10px] font-mono text-surface-600 ml-1">
          ({cat.avg_upvotes_per_arg.toFixed(1)}/arg)
        </span>
      </div>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function AudienceSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <div className="h-8 w-8 rounded-lg bg-surface-300" />
            <div className="h-7 w-16 rounded bg-surface-300" />
            <div className="h-3 w-20 rounded bg-surface-300" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-44" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-48" />
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-48" />
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-surface-300" />
            <div className="flex-1 h-4 rounded bg-surface-300" />
            <div className="h-4 w-12 rounded bg-surface-300" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AudiencePage() {
  const router = useRouter()
  const [data, setData] = useState<AudienceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllSupporters, setShowAllSupporters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/audience')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load audience data')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Could not load audience analytics. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const tierStyle = data ? TIER_COLOR[data.audience_tier] ?? TIER_COLOR.micro : TIER_COLOR.micro
  const TierIcon = data ? (TIER_ICON[data.audience_tier] ?? Users) : Users

  const visibleSupporters = data
    ? showAllSupporters
      ? data.top_supporters
      : data.top_supporters.slice(0, 8)
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-5 pb-24 md:pb-10 space-y-5">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">Civic Audience</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Who engages with your arguments
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Loading / Error ──────────────────────────────────────────── */}
        {loading && <AudienceSkeleton />}

        {!loading && error && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={load}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-white text-xs font-mono transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        )}

        {!loading && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* Audience tier banner */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border p-5 flex items-center gap-4',
                  tierStyle.bg, tierStyle.border,
                )}
              >
                <div className={cn('h-12 w-12 rounded-xl border flex items-center justify-center flex-shrink-0', tierStyle.bg, tierStyle.border)}>
                  <TierIcon className={cn('h-6 w-6', tierStyle.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn('text-[10px] font-mono font-bold uppercase tracking-widest', tierStyle.text)}>
                      Audience Tier
                    </span>
                  </div>
                  <p className="font-mono text-lg font-bold text-white">{data.audience_tier_label}</p>
                  <p className="text-xs font-mono text-surface-500 mt-0.5">{data.audience_tier_desc}</p>
                </div>
                <Link
                  href="/activity/upvotes"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white text-xs font-mono transition-colors flex-shrink-0"
                >
                  View history
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </motion.div>

              {/* ── Summary stats ─────────────────────────────────────────── */}
              {data.total_upvotes_received === 0 ? (
                <EmptyState
                  icon={Users}
                  iconColor="text-surface-500"
                  iconBg="bg-surface-200"
                  iconBorder="border-surface-300"
                  title="No audience yet"
                  description="Start writing arguments on topics you care about. Every upvote is your first follower."
                  actions={[
                    { label: 'Browse debates', href: '/', variant: 'primary' },
                    { label: 'Write an argument', href: '/topics', variant: 'secondary' },
                  ]}
                />
              ) : (
                <>
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                      label="Upvotes received"
                      value={data.total_upvotes_received}
                      animateValue={data.total_upvotes_received}
                      icon={ThumbsUp}
                      iconColor="text-for-400"
                      iconBg="bg-for-500/10"
                      delay={0}
                    />
                    <StatCard
                      label="Unique supporters"
                      value={data.unique_supporters}
                      animateValue={data.unique_supporters}
                      icon={Users}
                      iconColor="text-purple"
                      iconBg="bg-purple/10"
                      delay={0.05}
                    />
                    <StatCard
                      label="Avg per argument"
                      value={`${data.avg_upvotes_per_argument}`}
                      icon={BarChart2}
                      iconColor="text-gold"
                      iconBg="bg-gold/10"
                      delay={0.1}
                    />
                    <StatCard
                      label="Support rate"
                      value={`${data.support_rate}%`}
                      sub="of args with ≥1 upvote"
                      icon={Flame}
                      iconColor="text-emerald"
                      iconBg="bg-emerald/10"
                      delay={0.15}
                    />
                  </div>

                  {/* FOR vs AGAINST split */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5"
                  >
                    <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                      Engagement by side
                    </p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-1.5">
                        <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                        <span className="text-xs font-mono text-for-400">FOR</span>
                      </div>
                      <div className="flex-1 relative h-3 rounded-full bg-surface-300 overflow-hidden">
                        {(() => {
                          const total = data.for_upvotes + data.against_upvotes
                          const forPct = total > 0 ? (data.for_upvotes / total) * 100 : 50
                          return (
                            <>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${forPct}%` }}
                                transition={{ duration: 0.7, ease: 'easeOut' }}
                                className="absolute inset-y-0 left-0 bg-for-500 rounded-l-full"
                              />
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${100 - forPct}%` }}
                                transition={{ duration: 0.7, ease: 'easeOut' }}
                                className="absolute inset-y-0 right-0 bg-against-500 rounded-r-full"
                              />
                            </>
                          )
                        })()}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-against-400">AGAINST</span>
                        <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-for-400 font-bold">{data.for_upvotes} upvotes</span>
                      <span className="text-against-400 font-bold">{data.against_upvotes} upvotes</span>
                    </div>
                  </motion.div>

                  {/* ── Monthly chart ──────────────────────────────────────── */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <MonthlyChart months={data.monthly_engagement} />
                  </motion.div>

                  {/* ── Role breakdown + Category affinity ─────────────────── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Role breakdown */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3"
                    >
                      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                        Audience by role
                      </p>
                      {data.role_breakdown.length === 0 ? (
                        <p className="text-xs font-mono text-surface-600">No role data yet.</p>
                      ) : (
                        data.role_breakdown.map((r) => (
                          <RoleBar
                            key={r.role}
                            role={r.role}
                            count={r.upvoter_count}
                            pct={r.pct}
                          />
                        ))
                      )}
                    </motion.div>

                    {/* Category affinity */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3"
                    >
                      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                        Category affinity
                      </p>
                      {data.category_affinity.length === 0 ? (
                        <p className="text-xs font-mono text-surface-600">No category data yet.</p>
                      ) : (
                        data.category_affinity.map((cat) => (
                          <CategoryCard
                            key={cat.category}
                            cat={cat}
                            total={data.total_upvotes_received}
                          />
                        ))
                      )}
                    </motion.div>
                  </div>

                  {/* ── Top supporters ─────────────────────────────────────── */}
                  {data.top_supporters.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                          Top supporters
                        </p>
                        {data.unique_supporters > 8 && (
                          <span className="text-[10px] font-mono text-surface-600">
                            {data.unique_supporters} total
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {visibleSupporters.map((s, i) => (
                          <SupporterCard key={s.user_id} supporter={s} rank={i} />
                        ))}
                      </div>
                      {data.top_supporters.length > 8 && (
                        <button
                          onClick={() => setShowAllSupporters((v) => !v)}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-surface-300/40 hover:border-surface-400/60 text-surface-500 hover:text-white text-xs font-mono transition-all"
                        >
                          {showAllSupporters
                            ? 'Show fewer'
                            : `Show all ${data.top_supporters.length} supporters`}
                          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showAllSupporters && 'rotate-90')} />
                        </button>
                      )}
                    </motion.div>
                  )}

                  {/* ── Footer links ───────────────────────────────────────── */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="flex flex-wrap gap-2"
                  >
                    {[
                      { label: 'Upvote history', href: '/activity/upvotes', icon: ThumbsUp },
                      { label: 'Influence score', href: '/analytics/influence', icon: Star },
                      { label: 'Resonance', href: '/analytics/resonance', icon: ArrowRight },
                      { label: 'Network', href: '/analytics/network', icon: Users },
                    ].map(({ label, href, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-300/40 hover:border-surface-400/60 bg-surface-100 hover:bg-surface-200 text-surface-500 hover:text-white text-xs font-mono transition-all"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </Link>
                    ))}
                  </motion.div>
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
