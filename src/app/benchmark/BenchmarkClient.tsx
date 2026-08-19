'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Share2,
  CheckCircle2,
  TrendingUp,
  Users,
  MessageSquare,
  Zap,
  Star,
  Flame,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import type { BenchmarkData, BenchmarkMetric } from '@/app/api/benchmark/route'

// ── Tier config ────────────────────────────────────────────────────────────────

const TIER_STYLES: Record<
  string,
  { bg: string; border: string; text: string; label: string }
> = {
  observer: {
    bg: 'bg-surface-200',
    border: 'border-surface-400',
    text: 'text-surface-400',
    label: 'Observer',
  },
  active: {
    bg: 'bg-for-900/40',
    border: 'border-for-700',
    text: 'text-for-400',
    label: 'Active Citizen',
  },
  engaged: {
    bg: 'bg-for-800/40',
    border: 'border-for-600',
    text: 'text-for-300',
    label: 'Engaged Civic Voice',
  },
  power: {
    bg: 'bg-purple-900/40',
    border: 'border-purple-600',
    text: 'text-purple-300',
    label: 'Power User',
  },
  champion: {
    bg: 'bg-gold/10',
    border: 'border-gold',
    text: 'text-gold',
    label: 'Civic Champion',
  },
}

// ── Metric icon map ────────────────────────────────────────────────────────────

const METRIC_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  votes: CheckCircle2,
  arguments: MessageSquare,
  clout: Zap,
  reputation: Star,
  streak: Flame,
  followers: Users,
}

// ── Percentile bar ─────────────────────────────────────────────────────────────

function PercentileBar({ percentile, median, p90 }: { percentile: number; median: number; p90: number }) {
  const barColor =
    percentile >= 90
      ? 'bg-gold'
      : percentile >= 50
      ? 'bg-for-400'
      : 'bg-surface-500'

  return (
    <div className="relative h-2 w-full rounded-full bg-surface-300 overflow-visible">
      {/* Filled bar */}
      <motion.div
        className={`absolute left-0 top-0 h-full rounded-full ${barColor}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(percentile, 100)}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
      />
      {/* Median marker */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-3.5 w-0.5 bg-surface-500 rounded-full"
        style={{ left: `${median}%` }}
        title={`Platform median: ${median}th percentile`}
      />
      {/* P90 marker */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-3.5 w-0.5 bg-surface-400 rounded-full"
        style={{ left: `${p90}%` }}
        title="Top 10% threshold"
      />
    </div>
  )
}

// ── Metric card ────────────────────────────────────────────────────────────────

function MetricCard({ metric, index }: { metric: BenchmarkMetric; index: number }) {
  const Icon = METRIC_ICONS[metric.key] ?? TrendingUp
  const percentileColor =
    metric.percentile >= 90
      ? 'text-gold'
      : metric.percentile >= 70
      ? 'text-for-300'
      : metric.percentile >= 50
      ? 'text-for-400'
      : 'text-surface-400'

  const formattedValue =
    metric.userValue >= 1000
      ? `${(metric.userValue / 1000).toFixed(1)}k`
      : metric.userValue.toString()

  return (
    <motion.div
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-surface-400 flex-shrink-0" />
          <span className="font-mono text-sm text-surface-300">{metric.label}</span>
        </div>
        <span className={`font-mono text-sm font-bold ${percentileColor}`}>
          {metric.percentile}%ile
        </span>
      </div>

      <PercentileBar percentile={metric.percentile} median={50} p90={90} />

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-surface-500">
          You: <span className="text-white">{formattedValue}{metric.unit ? ` ${metric.unit}` : ''}</span>
        </span>
        <span className="font-mono text-xs text-surface-500">
          Median: <span className="text-surface-300">{metric.platformMedian}{metric.unit ? ` ${metric.unit}` : ''}</span>
        </span>
      </div>
    </motion.div>
  )
}

// ── Suggestion card ────────────────────────────────────────────────────────────

interface Suggestion {
  key: string
  label: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

function getSuggestions(metrics: BenchmarkMetric[]): Suggestion[] {
  const sorted = [...metrics].sort((a, b) => a.percentile - b.percentile)
  const suggestions: Suggestion[] = []

  for (const m of sorted) {
    if (suggestions.length >= 3) break
    if (m.key === 'votes' && m.percentile < 70) {
      suggestions.push({
        key: m.key,
        label: 'Cast More Votes',
        description: `You're in the ${m.percentile}th percentile for votes. Head to the feed to cast your ballot.`,
        href: '/',
        icon: CheckCircle2,
      })
    } else if (m.key === 'arguments' && m.percentile < 70) {
      suggestions.push({
        key: m.key,
        label: 'Write an Argument',
        description: `Boost your arguments ranking — currently ${m.percentile}th percentile. Share your reasoning on active topics.`,
        href: '/',
        icon: MessageSquare,
      })
    } else if (m.key === 'clout' && m.percentile < 70) {
      suggestions.push({
        key: m.key,
        label: 'Grow Your Clout',
        description: `Your clout (${m.percentile}th pct) rises with every vote and debate win. Stay active!`,
        href: '/profile/me',
        icon: Zap,
      })
    } else if (m.key === 'streak' && m.percentile < 70) {
      suggestions.push({
        key: m.key,
        label: 'Keep Your Streak',
        description: `You're in the ${m.percentile}th percentile for vote streaks. Vote daily to build momentum.`,
        href: '/',
        icon: Flame,
      })
    } else if (m.key === 'followers' && m.percentile < 70) {
      suggestions.push({
        key: m.key,
        label: 'Build Your Following',
        description: `Grow your audience — currently ${m.percentile}th percentile. Engage in debates to get noticed.`,
        href: '/debate',
        icon: Users,
      })
    } else if (m.key === 'reputation' && m.percentile < 70) {
      suggestions.push({
        key: m.key,
        label: 'Improve Reputation',
        description: `Your reputation (${m.percentile}th pct) reflects the quality of your contributions. Vote consistently.`,
        href: '/',
        icon: Star,
      })
    }
  }

  return suggestions
}

// ── Score ring ─────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const strokeColor =
    score >= 90
      ? '#D4AF37' // gold
      : score >= 70
      ? '#60a5fa' // for-400 approximation
      : score >= 50
      ? '#3b82f6'
      : score >= 20
      ? '#6b7280'
      : '#4b5563'

  return (
    <div className="relative h-16 w-16 flex-shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="5"
          className="stroke-surface-300"
        />
        <motion.circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="5"
          stroke={strokeColor}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono text-xs font-bold text-white leading-none">{score}</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BenchmarkClient() {
  const [data, setData] = useState<BenchmarkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/benchmark')
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json() as Promise<BenchmarkData>
      })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  async function handleShare() {
    if (!data) return
    const text = `My Civic Benchmark on Lobby Market: ${data.overallScore}/100 (${data.tierLabel}) — ${data.metrics.map((m) => `${m.label}: ${m.percentile}%ile`).join(' · ')}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'My Civic Benchmark', text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // User cancelled share
    }
  }

  const tierStyle = data ? TIER_STYLES[data.tier] ?? TIER_STYLES.observer : TIER_STYLES.observer
  const suggestions = data ? getSuggestions(data.metrics) : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back + title */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/profile/me"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-mono font-bold text-white text-base leading-tight">Civic Benchmark</h1>
            <p className="font-mono text-xs text-surface-500">How you compare to the platform</p>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <>
            <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 mb-5 space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
              </div>
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Error state */}
        {!loading && error && (
          <EmptyState
            icon={TrendingUp}
            title="Couldn't load benchmark"
            description="Something went wrong fetching your stats. Try refreshing the page."
            action={{ label: 'Refresh', onClick: () => window.location.reload() }}
          />
        )}

        {/* Data loaded */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Hero card */}
            <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 mb-5">
              <div className="flex items-center gap-4">
                <Avatar
                  src={data.profile.avatar_url}
                  username={data.profile.username}
                  size="lg"
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-white text-base truncate">
                    {data.profile.display_name ?? data.profile.username}
                  </p>
                  <p className="font-mono text-xs text-surface-500">@{data.profile.username}</p>
                  <span
                    className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${tierStyle.bg} ${tierStyle.border} ${tierStyle.text}`}
                  >
                    {data.tierLabel}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <ScoreRing score={data.overallScore} />
                  <span className="font-mono text-xs text-surface-500">overall</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-4 pt-4 border-t border-surface-300 flex items-center justify-between">
                <div className="text-center">
                  <p className="font-mono text-xs text-surface-500">Member for</p>
                  <p className="font-mono text-sm font-bold text-white">{data.memberSinceDays}d</p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-xs text-surface-500">Platform users</p>
                  <p className="font-mono text-sm font-bold text-white">
                    {data.totalUsers >= 1000
                      ? `${(data.totalUsers / 1000).toFixed(1)}k`
                      : data.totalUsers}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-xs text-surface-500">Civic score</p>
                  <p
                    className={`font-mono text-sm font-bold ${
                      data.overallScore >= 90
                        ? 'text-gold'
                        : data.overallScore >= 50
                        ? 'text-for-400'
                        : 'text-surface-400'
                    }`}
                  >
                    {data.overallScore}/100
                  </p>
                </div>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors font-mono text-xs"
                >
                  <Share2 className="h-3 w-3" />
                  {copied ? 'Copied!' : 'Share'}
                </button>
              </div>
            </div>

            {/* Metrics grid */}
            <p className="font-mono text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">
              Your Metrics
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {data.metrics.map((m, i) => (
                <MetricCard key={m.key} metric={m} index={i} />
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-6 px-1">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-4 rounded-full bg-gold" />
                <span className="font-mono text-xs text-surface-500">Top 10%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-4 rounded-full bg-for-400" />
                <span className="font-mono text-xs text-surface-500">Above median</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-4 rounded-full bg-surface-500" />
                <span className="font-mono text-xs text-surface-500">Below median</span>
              </div>
            </div>

            {/* Improvement suggestions */}
            {suggestions.length > 0 && (
              <>
                <p className="font-mono text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">
                  How to Improve
                </p>
                <div className="space-y-2">
                  {suggestions.map((s) => {
                    const Icon = s.icon
                    return (
                      <motion.div
                        key={s.key}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Link
                          href={s.href}
                          className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
                        >
                          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 group-hover:border-surface-400 flex-shrink-0">
                            <Icon className="h-4 w-4 text-for-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm font-bold text-white">{s.label}</p>
                            <p className="font-mono text-xs text-surface-500 leading-relaxed mt-0.5">
                              {s.description}
                            </p>
                          </div>
                          <Trophy className="h-4 w-4 text-surface-500 group-hover:text-for-400 flex-shrink-0 transition-colors" />
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              </>
            )}

            {/* All maxed out */}
            {suggestions.length === 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center">
                <Trophy className="h-8 w-8 text-gold mx-auto mb-2" />
                <p className="font-mono font-bold text-white text-sm">Top performer!</p>
                <p className="font-mono text-xs text-surface-500 mt-1">
                  You're ranking above the 70th percentile in all categories. Keep it up!
                </p>
              </div>
            )}
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
