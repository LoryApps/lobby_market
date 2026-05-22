'use client'

/**
 * /insights — Platform Insights
 *
 * Weekly data-driven intelligence about the Lobby Market civic ecosystem.
 * Distinct from:
 *   /signals      — raw real-time data dashboard
 *   /observatory  — researcher aggregate metrics
 *   /transparency — governance + participation counts
 *   /analytics    — personal user stats
 *
 * This is the "what does the data tell us THIS WEEK" surface:
 * category momentum, consensus health, argument quality trends,
 * top movers, rising contributors, and law velocity.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Award,
  BarChart2,
  Brain,
  ChevronRight,
  Cpu,
  DollarSign,
  ExternalLink,
  FlaskConical,
  Flame,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Lightbulb,
  MessageSquare,
  Minus,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { InsightsResponse, CategoryMomentum, TopMoverTopic, RisingContributor } from '@/app/api/insights/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: typeof Landmark
  color: string
  bg: string
  border: string
}> = {
  Politics:    { icon: Landmark,      color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  Economics:   { icon: DollarSign,    color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  Technology:  { icon: Cpu,           color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
  Science:     { icon: FlaskConical,  color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Ethics:      { icon: Scale,         color: 'text-for-300',       bg: 'bg-for-400/10',       border: 'border-for-400/30' },
  Philosophy:  { icon: Lightbulb,     color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
  Culture:     { icon: Music2,        color: 'text-against-400',   bg: 'bg-against-500/10',   border: 'border-against-500/30' },
  Health:      { icon: Heart,         color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Education:   { icon: GraduationCap, color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  Environment: { icon: Leaf,          color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
}

function getCatCfg(name: string) {
  return CATEGORY_CONFIG[name] ?? {
    icon: BarChart2,
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-gold'
    case 'B': return 'text-emerald'
    case 'C': return 'text-for-400'
    default:  return 'text-against-400'
  }
}

// ─── Section: Platform Totals strip ───────────────────────────────────────────

function TotalsStrip({ data }: { data: InsightsResponse }) {
  const stats = [
    { label: 'Votes cast', value: data.platform_totals.total_votes_7d, icon: Vote, color: 'text-for-400' },
    { label: 'Arguments', value: data.platform_totals.total_arguments_7d, icon: MessageSquare, color: 'text-purple' },
    { label: 'New topics', value: data.platform_totals.new_topics_7d, icon: BarChart2, color: 'text-for-300' },
    { label: 'New laws', value: data.platform_totals.new_laws_7d, icon: Gavel, color: 'text-gold' },
    { label: 'Active citizens', value: data.platform_totals.active_citizens_7d, icon: Users, color: 'text-emerald' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
      {stats.map((s) => {
        const Icon = s.icon
        return (
          <div
            key={s.label}
            className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-1"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={cn('h-3.5 w-3.5', s.color)} />
              <span className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider">
                {s.label}
              </span>
            </div>
            <span className={cn('font-mono text-2xl font-bold', s.color)}>
              <AnimatedNumber value={s.value} />
            </span>
            <span className="text-[10px] text-surface-600 font-mono">this week</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Section: Category Momentum ───────────────────────────────────────────────

function CategoryMomentumSection({ rows }: { rows: CategoryMomentum[] }) {
  const sorted = [...rows].sort((a, b) => b.change_pct - a.change_pct)
  const top = sorted.slice(0, 5)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/30">
          <TrendingUp className="h-4 w-4 text-for-400" />
        </div>
        <div>
          <h2 className="font-mono text-sm font-bold text-white">Category Momentum</h2>
          <p className="text-[11px] text-surface-500 font-mono">7-day vote volume vs prior week</p>
        </div>
      </div>

      <div className="divide-y divide-surface-300">
        {top.map((row, i) => {
          const cfg = getCatCfg(row.category)
          const Icon = cfg.icon
          const isUp = row.change_pct > 0
          const isFlat = row.change_pct === 0
          const maxVotes = Math.max(...rows.map((r) => r.votes_this_week), 1)
          const barPct = Math.round((row.votes_this_week / maxVotes) * 100)

          return (
            <motion.div
              key={row.category}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="px-5 py-3.5 flex items-center gap-3 hover:bg-surface-200/40 transition-colors"
            >
              <div className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
                cfg.bg, 'border', cfg.border
              )}>
                <Icon className={cn('h-4 w-4', cfg.color)} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <Link
                    href={`/topic/categories/${row.category}`}
                    className="text-sm font-mono font-semibold text-white hover:text-for-300 transition-colors truncate"
                  >
                    {row.category}
                  </Link>
                  <div className={cn(
                    'flex items-center gap-0.5 text-[11px] font-mono font-bold flex-shrink-0',
                    isUp ? 'text-emerald' : isFlat ? 'text-surface-500' : 'text-against-400'
                  )}>
                    {isUp ? <ArrowUp className="h-3 w-3" /> : isFlat ? <Minus className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(row.change_pct)}%
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', cfg.bg.replace('/10', '/60'))}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
                    {row.votes_this_week.toLocaleString()} votes · {row.active_count} active · {row.law_count} laws
                  </span>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Section: Consensus Health ────────────────────────────────────────────────

function ConsensusHealthSection({ data }: { data: InsightsResponse }) {
  const c = data.consensus

  const metrics = [
    {
      label: 'Strong consensus',
      value: c.strong_consensus_pct,
      suffix: '%',
      desc: 'of active topics have ≥70% agreement',
      color: 'text-emerald',
      bg: 'bg-emerald/10',
      border: 'border-emerald/30',
    },
    {
      label: 'Deadlocked',
      value: c.contested_pct,
      suffix: '%',
      desc: 'of active topics are within 6% of 50/50',
      color: 'text-against-400',
      bg: 'bg-against-500/10',
      border: 'border-against-500/30',
    },
    {
      label: 'Near law threshold',
      value: c.trending_to_law,
      suffix: '',
      desc: 'topics are 62–79% FOR — approaching passage',
      color: 'text-gold',
      bg: 'bg-gold/10',
      border: 'border-gold/30',
    },
    {
      label: 'Platform FOR avg',
      value: c.avg_platform_for_pct,
      suffix: '%',
      desc: 'average FOR% across all active topics',
      color: 'text-for-400',
      bg: 'bg-for-500/10',
      border: 'border-for-500/30',
    },
  ]

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
          <Scale className="h-4 w-4 text-gold" />
        </div>
        <div>
          <h2 className="font-mono text-sm font-bold text-white">Consensus Health</h2>
          <p className="text-[11px] text-surface-500 font-mono">How united or divided is the Lobby right now</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            className={cn(
              'rounded-xl p-4 border',
              m.bg, m.border
            )}
          >
            <div className={cn('font-mono text-2xl font-bold', m.color)}>
              <AnimatedNumber value={m.value} />{m.suffix}
            </div>
            <div className="font-mono text-[11px] font-semibold text-white mt-0.5">{m.label}</div>
            <div className="text-[10px] text-surface-500 mt-0.5 leading-relaxed">{m.desc}</div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Section: Argument Quality ────────────────────────────────────────────────

function ArgumentQualitySection({ data }: { data: InsightsResponse }) {
  const q = data.argument_quality

  const grades = [
    { grade: 'A', pct: q.grade_a_pct, color: 'bg-gold', label: 'Exceptional' },
    { grade: 'B', pct: q.grade_b_pct, color: 'bg-emerald', label: 'Good' },
    { grade: 'C', pct: q.grade_c_pct, color: 'bg-for-400', label: 'Fair' },
    { grade: 'D/F', pct: q.grade_df_pct, color: 'bg-against-500', label: 'Needs work' },
  ]

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/30">
          <Brain className="h-4 w-4 text-purple" />
        </div>
        <div>
          <h2 className="font-mono text-sm font-bold text-white">Argument Quality Index</h2>
          <p className="text-[11px] text-surface-500 font-mono">AI-graded distribution across all arguments</p>
        </div>
      </div>

      <div className="px-5 pb-5">
        {/* Grade bar */}
        <div className="flex h-3 rounded-full overflow-hidden gap-px mb-3">
          {grades.map((g) => (
            <motion.div
              key={g.grade}
              className={cn(g.color, 'flex-shrink-0')}
              style={{ width: `${g.pct}%` }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {grades.map((g) => (
            <div key={g.grade} className="flex items-center gap-2">
              <div className={cn('h-2.5 w-2.5 rounded-sm flex-shrink-0', g.color)} />
              <span className="text-[11px] font-mono font-semibold text-white">{g.grade}</span>
              <span className="text-[11px] font-mono text-surface-500">{g.pct}%</span>
              <span className="text-[10px] text-surface-600">{g.label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono border-t border-surface-300 pt-3">
          <span className="text-surface-500">
            {q.total_graded.toLocaleString()} total graded · {q.total_this_week} this week
          </span>
          {q.avg_score !== null && (
            <span className={cn('font-bold', gradeColor(
              q.avg_score >= 8 ? 'A' : q.avg_score >= 6 ? 'B' : q.avg_score >= 4 ? 'C' : 'D'
            ))}>
              Avg {q.avg_score}/10
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section: Top Mover Topics ────────────────────────────────────────────────

function TopMoversSection({ topics }: { topics: TopMoverTopic[] }) {
  if (topics.length === 0) return null

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/10 border border-against-500/30">
          <Flame className="h-4 w-4 text-against-400" />
        </div>
        <div>
          <h2 className="font-mono text-sm font-bold text-white">Most Active Debates</h2>
          <p className="text-[11px] text-surface-500 font-mono">Highest combined vote + argument activity this week</p>
        </div>
      </div>

      <div className="divide-y divide-surface-300">
        {topics.map((t, i) => {
          const cfg = getCatCfg(t.category ?? 'Other')
          const forPct = Math.round(t.blue_pct)
          const isFor = forPct > 50

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="px-5 py-3.5 hover:bg-surface-200/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-md mt-0.5 text-[11px] font-mono font-bold',
                  i === 0 ? 'bg-gold/20 text-gold border border-gold/40' :
                  i === 1 ? 'bg-surface-400/20 text-surface-300 border border-surface-400/40' :
                  'bg-surface-300/20 text-surface-500 border border-surface-400/20'
                )}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/topic/${t.id}`}
                    className="text-sm font-mono font-semibold text-white hover:text-for-300 transition-colors line-clamp-2 leading-snug"
                  >
                    {t.statement}
                  </Link>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {t.category && (
                      <Badge size="xs" variant="ghost" className={cn(cfg.color, cfg.bg, 'border', cfg.border)}>
                        {t.category}
                      </Badge>
                    )}
                    <span className={cn(
                      'text-[11px] font-mono font-bold',
                      isFor ? 'text-for-400' : 'text-against-400'
                    )}>
                      {forPct}% FOR
                    </span>
                    <span className="text-[11px] font-mono text-surface-500">
                      +{t.votes_7d} votes · +{t.arguments_7d} args
                    </span>
                  </div>
                </div>
                <Link
                  href={`/topic/${t.id}`}
                  className="flex-shrink-0 p-1 rounded-lg hover:bg-surface-300/60 text-surface-500 hover:text-white transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Section: Rising Contributors ─────────────────────────────────────────────

function RisingContributorsSection({ contributors }: { contributors: RisingContributor[] }) {
  if (contributors.length === 0) return null

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center gap-2.5">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald/10 border border-emerald/30">
          <Star className="h-4 w-4 text-emerald" />
        </div>
        <div>
          <h2 className="font-mono text-sm font-bold text-white">Rising This Week</h2>
          <p className="text-[11px] text-surface-500 font-mono">Highest civic impact in the last 7 days</p>
        </div>
      </div>

      <div className="divide-y divide-surface-300">
        {contributors.map((c, i) => (
          <motion.div
            key={c.user_id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.07 }}
            className="px-5 py-3.5 flex items-center gap-3 hover:bg-surface-200/40 transition-colors"
          >
            <div className={cn(
              'flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-md text-[11px] font-mono font-bold',
              i === 0 ? 'bg-gold/20 text-gold border border-gold/40' :
              i === 1 ? 'bg-surface-400/20 text-surface-300 border border-surface-400/40' :
              'bg-surface-300/20 text-surface-500 border border-surface-400/20'
            )}>
              {i + 1}
            </div>
            <Avatar
              src={c.avatar_url}
              fallback={c.display_name || c.username}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <Link
                href={`/profile/${c.username}`}
                className="text-sm font-mono font-semibold text-white hover:text-for-300 transition-colors truncate block"
              >
                {c.display_name || c.username}
              </Link>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] font-mono text-for-400">{c.votes_7d} votes</span>
                <span className="text-[10px] font-mono text-purple">{c.arguments_7d} args</span>
                <span className="text-[10px] font-mono text-gold">{c.upvotes_received_7d} upvotes</span>
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-[11px] font-mono font-bold text-emerald">
                +{c.impact_score}
              </div>
              <div className="text-[10px] font-mono text-surface-600">score</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// ─── Section: Law Velocity ────────────────────────────────────────────────────

function LawVelocitySection({ data }: { data: InsightsResponse }) {
  const v = data.law_velocity
  const monthChange = v.laws_last_month > 0
    ? Math.round(((v.laws_this_month - v.laws_last_month) / v.laws_last_month) * 100)
    : null

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
      <div className="px-5 pt-5 pb-4 flex items-center gap-2.5">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald/10 border border-emerald/30">
          <Gavel className="h-4 w-4 text-emerald" />
        </div>
        <div>
          <h2 className="font-mono text-sm font-bold text-white">Law Velocity</h2>
          <p className="text-[11px] text-surface-500 font-mono">How fast consensus is crystallising into law</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pb-5">
        <div className="rounded-xl bg-emerald/10 border border-emerald/30 p-4">
          <div className="font-mono text-2xl font-bold text-emerald">
            <AnimatedNumber value={v.laws_this_month} />
          </div>
          <div className="text-[11px] font-mono font-semibold text-white mt-0.5">Laws this month</div>
          {monthChange !== null && (
            <div className={cn(
              'flex items-center gap-0.5 text-[10px] font-mono mt-1',
              monthChange > 0 ? 'text-emerald' : monthChange < 0 ? 'text-against-400' : 'text-surface-500'
            )}>
              {monthChange > 0 ? <ArrowUp className="h-3 w-3" /> : monthChange < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              {Math.abs(monthChange)}% vs last month
            </div>
          )}
        </div>

        <div className="rounded-xl bg-gold/10 border border-gold/30 p-4">
          <div className="font-mono text-2xl font-bold text-gold">
            <AnimatedNumber value={v.laws_last_month} />
          </div>
          <div className="text-[11px] font-mono font-semibold text-white mt-0.5">Laws last month</div>
          <div className="text-[10px] text-surface-500 font-mono mt-1">
            {v.laws_this_month > v.laws_last_month ? 'Accelerating' : v.laws_this_month < v.laws_last_month ? 'Decelerating' : 'Steady pace'}
          </div>
        </div>
      </div>

      {v.fastest_recent_law && (
        <div className="mx-5 mb-5 rounded-xl bg-surface-200/60 border border-surface-400/30 p-3.5">
          <div className="flex items-start gap-2">
            <Zap className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[10px] font-mono font-semibold text-gold uppercase tracking-wide mb-1">
                Fastest recent law — {v.fastest_recent_law.days} day{v.fastest_recent_law.days !== 1 ? 's' : ''}
              </div>
              <div className="text-xs font-mono text-surface-300 leading-snug line-clamp-2">
                {v.fastest_recent_law.statement}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InsightsClient() {
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/insights', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load insights')
      const json = await res.json() as InsightsResponse
      setData(json)
    } catch {
      setError('Could not load platform insights')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Sparkles className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Platform Insights</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                What the data is telling us this week
                {data && (
                  <span className="ml-2 text-surface-600">
                    · updated {relTime(data.generated_at)}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200/80 border border-surface-400/40 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Quick-nav context pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { label: 'Signals', href: '/signals', icon: Activity },
            { label: 'Observatory', href: '/observatory', icon: BarChart2 },
            { label: 'Transparency', href: '/transparency', icon: Award },
            { label: 'Leaderboard', href: '/leaderboard', icon: Users },
            { label: 'Annual', href: '/annual', icon: Award },
          ].map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.label}
                href={link.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200/60 border border-surface-400/30 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
              >
                <Icon className="h-3 w-3" />
                {link.label}
              </Link>
            )
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" exit={{ opacity: 0 }}>
              <InsightsSkeleton />
            </motion.div>
          )}

          {error && !loading && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl bg-against-500/10 border border-against-500/30 p-8 text-center"
            >
              <p className="text-sm font-mono text-against-400">{error}</p>
              <button
                onClick={load}
                className="mt-3 px-4 py-2 rounded-lg bg-surface-200 border border-surface-400/40 text-xs font-mono text-surface-400 hover:text-white transition-all"
              >
                Try again
              </button>
            </motion.div>
          )}

          {data && !loading && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Platform totals strip */}
              <TotalsStrip data={data} />

              {/* Main 2-column grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <CategoryMomentumSection rows={data.category_momentum} />
                <ConsensusHealthSection data={data} />
                <ArgumentQualitySection data={data} />
                <LawVelocitySection data={data} />
              </div>

              {/* Full-width sections */}
              <TopMoversSection topics={data.top_movers} />
              <RisingContributorsSection contributors={data.rising_contributors} />

              {/* Footer CTA row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                {[
                  { href: '/leaderboard', label: 'Full Leaderboard', icon: Users, desc: 'All-time citizen rankings' },
                  { href: '/law', label: 'The Codex', icon: Gavel, desc: 'Every established law' },
                  { href: '/analytics', label: 'My Analytics', icon: BarChart2, desc: 'Your personal stats' },
                ].map((card) => {
                  const Icon = card.icon
                  return (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="group flex items-center gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all"
                    >
                      <Icon className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-mono font-semibold text-white">{card.label}</div>
                        <div className="text-[11px] font-mono text-surface-500">{card.desc}</div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-for-300 flex-shrink-0 transition-colors" />
                    </Link>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
