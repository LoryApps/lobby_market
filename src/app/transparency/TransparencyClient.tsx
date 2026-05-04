'use client'

/**
 * /transparency — Platform Transparency Report
 *
 * A public accountability page showing real-time platform statistics:
 * total users, topics, votes, laws, category breakdowns, community roles,
 * and milestone progress. Designed to build civic trust.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Circle,
  Gavel,
  Globe,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { TransparencyReport, CategoryBreakdown } from '@/app/api/transparency/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, { bar: string; text: string; dot: string }> = {
  Economics:   { bar: 'bg-gold',         text: 'text-gold',         dot: 'bg-gold' },
  Politics:    { bar: 'bg-for-500',      text: 'text-for-400',      dot: 'bg-for-500' },
  Technology:  { bar: 'bg-purple',       text: 'text-purple',       dot: 'bg-purple' },
  Science:     { bar: 'bg-emerald',      text: 'text-emerald',      dot: 'bg-emerald' },
  Ethics:      { bar: 'bg-against-500',  text: 'text-against-400',  dot: 'bg-against-500' },
  Philosophy:  { bar: 'bg-for-400',      text: 'text-for-300',      dot: 'bg-for-400' },
  Culture:     { bar: 'bg-gold',         text: 'text-gold',         dot: 'bg-gold' },
  Health:      { bar: 'bg-against-400',  text: 'text-against-300',  dot: 'bg-against-400' },
  Environment: { bar: 'bg-emerald',      text: 'text-emerald',      dot: 'bg-emerald' },
  Education:   { bar: 'bg-purple',       text: 'text-purple',       dot: 'bg-purple' },
}

function catColor(cat: string) {
  return CAT_COLOR[cat] ?? { bar: 'bg-surface-400', text: 'text-surface-400', dot: 'bg-surface-400' }
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { color: string; bg: string; border: string; bar: string; icon: typeof Users }> = {
  person:        { color: 'text-surface-400', bg: 'bg-surface-300/40', border: 'border-surface-400/30', bar: 'bg-surface-400',  icon: Users },
  debator:       { color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     bar: 'bg-for-500',      icon: MessageSquare },
  troll_catcher: { color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     bar: 'bg-emerald',      icon: Shield },
  elder:         { color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        bar: 'bg-gold',         icon: Award },
  senator:       { color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      bar: 'bg-purple',       icon: Award },
  lawmaker:      { color: 'text-gold',        bg: 'bg-gold/15',        border: 'border-gold/40',        bar: 'bg-gold',         icon: Gavel },
}

function roleConfig(role: string) {
  return ROLE_CONFIG[role] ?? ROLE_CONFIG.person
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  iconBorder: string
  label: string
  value: number
  suffix?: string
  delay?: number
}

function StatCard({ icon: Icon, iconColor, iconBg, iconBorder, label, value, suffix = '', delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-3"
    >
      <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl border', iconBg, iconBorder)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div>
        <p className="font-mono text-2xl font-bold text-white">
          <AnimatedNumber value={value} />{suffix}
        </p>
        <p className="font-mono text-xs text-surface-500 mt-0.5">{label}</p>
      </div>
    </motion.div>
  )
}

// ─── Category bar row ─────────────────────────────────────────────────────────

function CategoryRow({ cat, maxTopics, index }: { cat: CategoryBreakdown; maxTopics: number; index: number }) {
  const c = catColor(cat.category)
  const barWidth = maxTopics > 0 ? (cat.total_topics / maxTopics) * 100 : 0
  const lawBarWidth = cat.total_topics > 0 ? (cat.laws_passed / cat.total_topics) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      className="flex items-center gap-4 py-3 border-b border-surface-300/50 last:border-0"
    >
      {/* Category dot + name */}
      <div className="flex items-center gap-2 w-28 flex-shrink-0">
        <span className={cn('h-2 w-2 rounded-full flex-shrink-0', c.dot)} />
        <span className={cn('font-mono text-xs font-semibold truncate', c.text)}>
          {cat.category}
        </span>
      </div>

      {/* Bar */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Total topics bar */}
        <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ delay: 0.1 + 0.05 * index, duration: 0.5, ease: 'easeOut' }}
            className={cn('h-full rounded-full', c.bar, 'opacity-40')}
          />
        </div>
        {/* Laws bar */}
        <div className="h-1 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${lawBarWidth}%` }}
            transition={{ delay: 0.2 + 0.05 * index, duration: 0.5, ease: 'easeOut' }}
            className={cn('h-full rounded-full', c.bar)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 flex-shrink-0 text-right">
        <div className="hidden sm:block">
          <p className="font-mono text-[11px] text-white font-semibold">{cat.total_topics}</p>
          <p className="font-mono text-[10px] text-surface-500">topics</p>
        </div>
        <div>
          <p className="font-mono text-[11px] text-gold font-semibold">{cat.laws_passed}</p>
          <p className="font-mono text-[10px] text-surface-500">laws</p>
        </div>
        <div className="hidden sm:block">
          <p className={cn('font-mono text-[11px] font-semibold', cat.law_rate >= 50 ? 'text-emerald' : cat.law_rate >= 25 ? 'text-for-400' : 'text-surface-400')}>
            {cat.law_rate}%
          </p>
          <p className="font-mono text-[10px] text-surface-500">pass rate</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse">
            <div className="h-10 w-10 rounded-xl bg-surface-300" />
            <div className="space-y-1.5">
              <div className="h-6 w-20 bg-surface-300 rounded" />
              <div className="h-3 w-16 bg-surface-300 rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4 animate-pulse">
        <div className="h-5 w-36 bg-surface-300 rounded" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 bg-surface-300/40 rounded" />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TransparencyClient() {
  const [report, setReport] = useState<TransparencyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/transparency')
      if (res.ok) setReport(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const maxCatTopics = report ? Math.max(...report.categories.map((c) => c.total_topics), 1) : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30">
              <Shield className="h-5 w-5 text-emerald" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Transparency Report</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Real-time platform health &amp; governance stats
              </p>
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh report"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </motion.div>

        {/* Mission statement */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-gradient-to-br from-surface-100 to-surface-100/60 border border-surface-300 p-5 space-y-2"
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-for-400" />
            <span className="font-mono text-xs font-semibold text-for-400 uppercase tracking-wider">Our Commitment</span>
          </div>
          <p className="font-mono text-sm text-surface-400 leading-relaxed">
            Lobby Market operates as an open civic platform. We publish this report so every citizen
            can see how the platform is working: how many voices are participating, which debates are
            gaining consensus, and how the community is governing itself. No hidden metrics. No spin.
          </p>
        </motion.div>

        {loading ? (
          <ReportSkeleton />
        ) : !report ? (
          <div className="text-center py-20">
            <p className="font-mono text-surface-500">Failed to load report.</p>
            <button onClick={() => load()} className="mt-4 font-mono text-xs text-for-400 hover:text-for-300">
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Core stats grid */}
            <div>
              <h2 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4">
                Platform Overview
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  icon={Users} iconColor="text-for-400" iconBg="bg-for-500/10" iconBorder="border-for-500/20"
                  label="Total Citizens" value={report.total_users} delay={0}
                />
                <StatCard
                  icon={Vote} iconColor="text-purple" iconBg="bg-purple/10" iconBorder="border-purple/20"
                  label="Votes Cast" value={report.total_votes} delay={0.05}
                />
                <StatCard
                  icon={Gavel} iconColor="text-gold" iconBg="bg-gold/10" iconBorder="border-gold/20"
                  label="Laws Established" value={report.total_laws} delay={0.1}
                />
                <StatCard
                  icon={Scale} iconColor="text-against-400" iconBg="bg-against-500/10" iconBorder="border-against-500/20"
                  label="Total Topics" value={report.total_topics} delay={0.15}
                />
                <StatCard
                  icon={MessageSquare} iconColor="text-emerald" iconBg="bg-emerald/10" iconBorder="border-emerald/20"
                  label="Arguments Made" value={report.total_arguments} delay={0.2}
                />
                <StatCard
                  icon={Zap} iconColor="text-for-300" iconBg="bg-for-600/10" iconBorder="border-for-600/20"
                  label="Debates Held" value={report.total_debates} delay={0.25}
                />
                <StatCard
                  icon={Users} iconColor="text-purple" iconBg="bg-purple/10" iconBorder="border-purple/20"
                  label="Coalitions Formed" value={report.total_coalitions} delay={0.3}
                />
                <StatCard
                  icon={TrendingUp} iconColor="text-emerald" iconBg="bg-emerald/10" iconBorder="border-emerald/20"
                  label="Law Passage Rate" value={report.law_passage_rate} suffix="%" delay={0.35}
                />
              </div>
            </div>

            {/* Key ratios */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid sm:grid-cols-3 gap-3"
            >
              {[
                {
                  label: 'Avg votes per topic',
                  value: report.avg_votes_per_topic.toLocaleString(),
                  sub: 'Community engagement depth',
                  color: 'text-for-400',
                  bg: 'bg-for-500/10',
                  border: 'border-for-500/20',
                },
                {
                  label: 'Avg consensus on laws',
                  value: `${report.avg_consensus_on_laws}% FOR`,
                  sub: 'How decisive winning votes are',
                  color: 'text-gold',
                  bg: 'bg-gold/10',
                  border: 'border-gold/20',
                },
                {
                  label: 'Law passage rate',
                  value: `${report.law_passage_rate}%`,
                  sub: 'Of resolved topics become law',
                  color: 'text-emerald',
                  bg: 'bg-emerald/10',
                  border: 'border-emerald/20',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    'rounded-2xl p-4 border space-y-1',
                    item.bg,
                    item.border
                  )}
                >
                  <p className={cn('font-mono text-xl font-bold', item.color)}>{item.value}</p>
                  <p className="font-mono text-xs font-semibold text-white">{item.label}</p>
                  <p className="font-mono text-[11px] text-surface-500">{item.sub}</p>
                </div>
              ))}
            </motion.div>

            {/* Category breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-sm font-semibold text-white">Topics by Category</h2>
                <div className="flex items-center gap-4 text-[11px] font-mono text-surface-500">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-6 rounded-full bg-surface-400 opacity-40 inline-block" />
                    All topics
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1 w-6 rounded-full bg-gold inline-block" />
                    Laws
                  </span>
                </div>
              </div>
              <div>
                {report.categories.map((cat, i) => (
                  <CategoryRow key={cat.category} cat={cat} maxTopics={maxCatTopics} index={i} />
                ))}
              </div>
            </motion.div>

            {/* Community roles */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <h2 className="font-mono text-sm font-semibold text-white mb-4">Community Roles</h2>
              <div className="space-y-2">
                {report.roles.map((r) => {
                  const rc = roleConfig(r.role)
                  const RoleIcon = rc.icon
                  const barPct = r.pct
                  return (
                    <div key={r.role} className="flex items-center gap-3">
                      <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg border flex-shrink-0', rc.bg, rc.border)}>
                        <RoleIcon className={cn('h-3.5 w-3.5', rc.color)} />
                      </div>
                      <div className="w-24 flex-shrink-0">
                        <p className={cn('font-mono text-xs font-semibold', rc.color)}>{r.label}</p>
                      </div>
                      <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ delay: 0.55, duration: 0.5, ease: 'easeOut' }}
                          className={cn('h-full rounded-full opacity-80', rc.bar)}
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 text-right w-20">
                        <p className="font-mono text-xs text-white">{r.count.toLocaleString()}</p>
                        <p className="font-mono text-[11px] text-surface-500">{r.pct}%</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            {/* Top laws */}
            {report.top_laws.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono text-sm font-semibold text-white">
                    Most-Voted Laws
                  </h2>
                  <Link
                    href="/law"
                    className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
                  >
                    View Codex
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {report.top_laws.map((law, i) => {
                    const forPct = Math.round(law.blue_pct)
                    const c = catColor(law.category ?? '')
                    return (
                      <Link
                        key={law.id}
                        href={`/topic/${law.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-gold/30 hover:bg-gold/5 transition-colors group"
                      >
                        <span className="font-mono text-xs text-surface-500 w-4 flex-shrink-0">
                          #{i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs text-white truncate group-hover:text-gold transition-colors">
                            {truncate(law.statement, 80)}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {law.category && (
                              <span className={cn('font-mono text-[10px]', c.text)}>{law.category}</span>
                            )}
                            <span className="font-mono text-[10px] text-surface-500">
                              {law.total_votes.toLocaleString()} votes · {forPct}% FOR
                            </span>
                          </div>
                        </div>
                        <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0 opacity-70" />
                      </Link>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Milestones */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-gold" />
                <h2 className="font-mono text-sm font-semibold text-white">Platform Milestones</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {report.milestones.map((m) => (
                  <div
                    key={m.label}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                      m.achieved
                        ? 'bg-emerald/5 border-emerald/20'
                        : 'bg-surface-200/40 border-surface-300/40'
                    )}
                  >
                    {m.achieved ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-surface-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'font-mono text-xs',
                        m.achieved ? 'text-emerald font-semibold' : 'text-surface-400'
                      )}>
                        {m.label}
                      </p>
                      {!m.achieved && (
                        <p className="font-mono text-[10px] text-surface-500 mt-0.5">
                          {m.current.toLocaleString()} / {m.threshold.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Badge variant={m.achieved ? 'law' : 'proposed'} className="flex-shrink-0 text-[10px]">
                      {m.value}
                    </Badge>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Footer note */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="text-center space-y-2 pt-4 pb-2"
            >
              <p className="font-mono text-[11px] text-surface-600">
                Report generated {formatDate(report.generated_at)} · Data reflects all-time platform activity
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link href="/about" className="font-mono text-[11px] text-surface-500 hover:text-for-400 transition-colors">
                  About
                </Link>
                <Link href="/guidelines" className="font-mono text-[11px] text-surface-500 hover:text-for-400 transition-colors">
                  Guidelines
                </Link>
                <Link href="/help" className="font-mono text-[11px] text-surface-500 hover:text-for-400 transition-colors">
                  Help
                </Link>
                <Link href="/law" className="font-mono text-[11px] text-surface-500 hover:text-for-400 transition-colors">
                  Law Codex
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
