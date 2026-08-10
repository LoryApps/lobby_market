'use client'

/**
 * /profile/[username]/style — Argument Style Analysis
 *
 * A deep-dive into a citizen's argument writing style — quality grades,
 * topic focus, FOR/AGAINST balance, peak activity hours, and their top
 * arguments. Gives readers a feel for HOW someone argues, not just what.
 *
 * Distinct from:
 *   /profile/[username]/analytics  — voting patterns and civic engagement
 *   /profile/[username]/arguments  — chronological argument list
 *   /profile/[username]/impact     — influence on laws and debates
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Brain,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Flame,
  Globe,
  Link2,
  Loader2,
  MessageSquare,
  Moon,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  Sun,
  SunMedium,
  Sunrise,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ArgumentStyleResponse, StyleArgument } from '@/app/api/profile/[username]/style/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  Economics:   { bar: 'bg-gold',        text: 'text-gold',        bg: 'bg-gold/10' },
  Politics:    { bar: 'bg-for-500',     text: 'text-for-400',     bg: 'bg-for-500/10' },
  Technology:  { bar: 'bg-purple',      text: 'text-purple',      bg: 'bg-purple/10' },
  Science:     { bar: 'bg-emerald',     text: 'text-emerald',     bg: 'bg-emerald/10' },
  Ethics:      { bar: 'bg-against-500', text: 'text-against-400', bg: 'bg-against-500/10' },
  Philosophy:  { bar: 'bg-indigo-400',  text: 'text-indigo-400',  bg: 'bg-indigo-400/10' },
  Culture:     { bar: 'bg-orange-400',  text: 'text-orange-400',  bg: 'bg-orange-400/10' },
  Health:      { bar: 'bg-pink-400',    text: 'text-pink-400',    bg: 'bg-pink-400/10' },
  Environment: { bar: 'bg-green-400',   text: 'text-green-400',   bg: 'bg-green-400/10' },
  Education:   { bar: 'bg-cyan-400',    text: 'text-cyan-400',    bg: 'bg-cyan-400/10' },
  Other:       { bar: 'bg-surface-500', text: 'text-surface-500', bg: 'bg-surface-300/20' },
}

function catColor(cat: string) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other
}

// ─── Grade config ──────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { text: string; bg: string; border: string; label: string }> = {
  A: { text: 'text-emerald',      bg: 'bg-emerald/10',     border: 'border-emerald/30',     label: 'Excellent' },
  B: { text: 'text-for-300',      bg: 'bg-for-500/10',     border: 'border-for-500/30',     label: 'Good' },
  C: { text: 'text-gold',         bg: 'bg-gold/10',        border: 'border-gold/30',        label: 'Fair' },
  D: { text: 'text-against-300',  bg: 'bg-against-500/10', border: 'border-against-500/30', label: 'Weak' },
  F: { text: 'text-against-400',  bg: 'bg-against-600/10', border: 'border-against-600/30', label: 'Poor' },
}

// ─── Hour icon ─────────────────────────────────────────────────────────────────

const HOUR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Dawn:      Sunrise,
  Morning:   Sun,
  Afternoon: SunMedium,
  Evening:   Flame,
  Night:     Moon,
}

// ─── Archetype config ──────────────────────────────────────────────────────────

const ARCHETYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; desc: string; color: string }> = {
  'The Researcher':    { icon: BookOpen,    desc: 'Backs every claim with sources. Evidence-first reasoning.',           color: 'text-emerald' },
  'The Advocate':      { icon: ThumbsUp,    desc: 'Consistently argues FOR — a champion of progress and change.',        color: 'text-for-400' },
  'The Dissenter':     { icon: ThumbsDown,  desc: 'Consistently pushes AGAINST — a principled voice of opposition.',     color: 'text-against-400' },
  'The Essayist':      { icon: FileText,    desc: 'Writes long, detailed arguments. Values thoroughness over brevity.',   color: 'text-purple' },
  'The Sharpshooter':  { icon: Zap,         desc: 'Short, punchy arguments that land fast. Every word earns its place.', color: 'text-gold' },
  'The Analyst':       { icon: Brain,       desc: 'Balanced across all dimensions — measured, clear, and versatile.',    color: 'text-for-300' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-surface-200/60 border border-surface-300/40 rounded-xl p-4 flex flex-col gap-1">
      <div className="text-xs text-surface-500 uppercase tracking-wide">{label}</div>
      <div className={cn('text-2xl font-bold font-mono', color ?? 'text-surface-900')}>{value}</div>
      {sub && <div className="text-xs text-surface-500">{sub}</div>}
    </div>
  )
}

function ArgumentCard({ arg, rank }: { arg: StyleArgument; rank?: number }) {
  return (
    <div className="bg-surface-200/50 border border-surface-300/30 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {rank !== undefined && (
            <span className="text-xs font-mono text-surface-500 shrink-0">#{rank + 1}</span>
          )}
          <Badge
            variant={arg.side === 'blue' ? 'active' : 'failed'}
            className="shrink-0 text-xs"
          >
            {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
          </Badge>
          {arg.ai_grade && (
            <span className={cn(
              'text-xs font-mono font-bold px-1.5 py-0.5 rounded border',
              GRADE_CONFIG[arg.ai_grade]?.text,
              GRADE_CONFIG[arg.ai_grade]?.bg,
              GRADE_CONFIG[arg.ai_grade]?.border,
            )}>
              {arg.ai_grade}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-gold shrink-0">
          <Star className="h-3 w-3" />
          <span>{arg.upvotes}</span>
        </div>
      </div>

      <p className="text-sm text-surface-800 leading-relaxed line-clamp-3">{arg.content}</p>

      <div className="flex items-center justify-between gap-2 pt-1">
        {arg.topic_statement ? (
          <span className="text-xs text-surface-500 truncate">
            {arg.topic_statement.slice(0, 55)}{arg.topic_statement.length > 55 ? '…' : ''}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2 shrink-0">
          {arg.source_url && <Link2 className="h-3 w-3 text-surface-500" />}
          <span className="text-xs text-surface-500">{relTime(arg.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

function SkeletonLoader() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ProfileStylePage() {
  const params = useParams<{ username: string }>()
  const router = useRouter()
  const username = params.username

  const [data, setData] = useState<ArgumentStyleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/profile/${username}/style`)
      if (!res.ok) {
        if (res.status === 404) { router.push('/404'); return }
        throw new Error('Failed to load style data')
      }
      setData(await res.json())
    } catch {
      setError('Could not load argument style data.')
    } finally {
      setLoading(false)
    }
  }, [username, router])

  useEffect(() => { load() }, [load])

  // ─── Archetype ───────────────────────────────────────────────────────────────

  const archetypeInfo = data ? (ARCHETYPE_CONFIG[data.styleArchetype] ?? ARCHETYPE_CONFIG['The Analyst']) : null

  // ─── Render ───────────────────────────────────────────────────────────────────

  const topHourBucket = data?.hourDistribution.reduce<{ label: string; count: number } | null>(
    (best, b) => (!best || b.count > best.count ? b : best),
    null
  )

  const maxHourCount = data ? Math.max(...data.hourDistribution.map((b) => b.count), 1) : 1
  const maxCatCount = data ? Math.max(...data.categoryDistribution.map((c) => c.count), 1) : 1
  const maxGradeCount = data ? Math.max(...data.gradeDistribution.map((g) => g.count), 1) : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* Back link */}
        <Link
          href={`/profile/${username}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>

        {loading ? (
          <SkeletonLoader />
        ) : error ? (
          <EmptyState icon={MessageSquare} title="Style unavailable" description={error} />
        ) : !data ? null : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar
                  src={data.profile.avatar_url}
                  alt={data.profile.display_name ?? data.profile.username}
                  size="lg"
                />
                <div>
                  <h1 className="text-xl font-bold text-surface-900">
                    {data.profile.display_name ?? data.profile.username}
                  </h1>
                  <p className="text-sm text-surface-500">Argument Style Analysis</p>
                </div>
              </div>
              <button
                onClick={load}
                aria-label="Refresh"
                className="p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {/* No arguments state */}
            {data.totalArguments === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No arguments yet"
                description={`${data.profile.display_name ?? data.profile.username} hasn't posted any arguments yet. Style analysis will appear once they join the debate.`}
              />
            ) : (
              <>

                {/* Archetype card */}
                {archetypeInfo && (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.05 }}
                    className="bg-surface-200/60 border border-surface-300/40 rounded-2xl p-5 flex items-start gap-4"
                  >
                    <div className={cn(
                      'p-3 rounded-xl shrink-0',
                      'bg-surface-300/40',
                    )}>
                      <archetypeInfo.icon className={cn('h-6 w-6', archetypeInfo.color)} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs text-surface-500 uppercase tracking-wide mb-1">Style Archetype</div>
                      <div className={cn('text-lg font-bold', archetypeInfo.color)}>{data.styleArchetype}</div>
                      <p className="text-sm text-surface-600 mt-0.5">{archetypeInfo.desc}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-surface-500 mb-1">Quality</div>
                      <div className="text-sm font-semibold text-surface-800">{data.qualityLabel}</div>
                    </div>
                  </motion.div>
                )}

                {/* Stat tiles */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-3"
                >
                  <StatTile
                    label="Arguments"
                    value={data.totalArguments.toLocaleString()}
                    sub="total posted"
                    color="text-for-400"
                  />
                  <StatTile
                    label="Avg Length"
                    value={`${data.avgLength}`}
                    sub={`chars · ${data.verbosityLabel}`}
                    color="text-surface-800"
                  />
                  <StatTile
                    label="Avg Upvotes"
                    value={data.avgUpvotes.toString()}
                    sub={`${data.totalUpvotes.toLocaleString()} total`}
                    color="text-gold"
                  />
                  <StatTile
                    label="Cited Sources"
                    value={`${Math.round(data.citationRate * 100)}%`}
                    sub="of arguments"
                    color="text-emerald"
                  />
                </motion.div>

                {/* FOR / AGAINST balance */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="bg-surface-200/60 border border-surface-300/40 rounded-2xl p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Scale className="h-4 w-4 text-surface-500" />
                    <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wide">Stance Balance</h2>
                  </div>

                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-for-400 font-mono font-bold text-sm w-10 shrink-0">{data.forPct}%</span>
                    <div className="flex-1 h-3 bg-surface-300/50 rounded-full overflow-hidden flex">
                      <div
                        className="bg-for-500 h-full transition-all duration-700 rounded-l-full"
                        style={{ width: `${data.forPct}%` }}
                      />
                      <div
                        className="bg-against-500 h-full transition-all duration-700 rounded-r-full"
                        style={{ width: `${data.againstPct}%` }}
                      />
                    </div>
                    <span className="text-against-400 font-mono font-bold text-sm w-10 shrink-0 text-right">{data.againstPct}%</span>
                  </div>

                  <div className="flex justify-between text-xs text-surface-500 px-10">
                    <span>FOR</span>
                    <span>AGAINST</span>
                  </div>

                  {data.avgAiScore !== null && (
                    <div className="mt-4 pt-4 border-t border-surface-300/30 flex items-center justify-between">
                      <span className="text-sm text-surface-600">Avg AI Quality Score</span>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                'w-2 h-4 rounded-sm transition-all',
                                i < Math.round(data.avgAiScore ?? 0)
                                  ? 'bg-emerald'
                                  : 'bg-surface-300/50',
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-mono font-bold text-emerald">{data.avgAiScore}/10</span>
                      </div>
                    </div>
                  )}
                </motion.div>

                {/* Grade distribution */}
                {data.gradeDistribution.length > 0 && (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-surface-200/60 border border-surface-300/40 rounded-2xl p-5"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="h-4 w-4 text-surface-500" />
                      <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wide">AI Grade Distribution</h2>
                    </div>

                    <div className="space-y-2">
                      {['A', 'B', 'C', 'D', 'F'].map((grade) => {
                        const entry = data.gradeDistribution.find((g) => g.grade === grade)
                        const count = entry?.count ?? 0
                        const config = GRADE_CONFIG[grade]
                        const widthPct = maxGradeCount > 0 ? pct(count, maxGradeCount) : 0
                        return (
                          <div key={grade} className="flex items-center gap-3">
                            <span className={cn('text-sm font-mono font-bold w-5 shrink-0 text-center', config.text)}>{grade}</span>
                            <div className="flex-1 h-5 bg-surface-300/30 rounded overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${widthPct}%` }}
                                transition={{ duration: 0.6, delay: 0.3 }}
                                className={cn('h-full rounded', config.bg.replace('/10', '/50'))}
                              />
                            </div>
                            <span className="text-xs text-surface-500 w-8 shrink-0 text-right">{count}</span>
                            <span className="text-xs text-surface-500 w-16 shrink-0">{config.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}

                {/* Category distribution */}
                {data.categoryDistribution.length > 0 && (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    className="bg-surface-200/60 border border-surface-300/40 rounded-2xl p-5"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart2 className="h-4 w-4 text-surface-500" />
                      <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wide">Topic Focus Areas</h2>
                    </div>

                    <div className="space-y-3">
                      {data.categoryDistribution.map((cat) => {
                        const colors = catColor(cat.category)
                        const widthPct = pct(cat.count, maxCatCount)
                        const forCatPct = pct(cat.for, cat.count)
                        return (
                          <div key={cat.category} className="flex items-center gap-3">
                            <span className={cn('text-xs font-medium w-24 shrink-0 truncate', colors.text)}>
                              {cat.category}
                            </span>
                            <div className="flex-1 h-5 bg-surface-300/30 rounded overflow-hidden flex">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${widthPct * forCatPct / 100}%` }}
                                transition={{ duration: 0.6, delay: 0.35 }}
                                className="h-full bg-for-500/60"
                              />
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${widthPct * (100 - forCatPct) / 100}%` }}
                                transition={{ duration: 0.6, delay: 0.35 }}
                                className="h-full bg-against-500/60"
                              />
                            </div>
                            <span className="text-xs text-surface-500 w-6 shrink-0 text-right">{cat.count}</span>
                          </div>
                        )
                      })}
                    </div>

                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-300/20">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-for-500/60" />
                        <span className="text-xs text-surface-500">FOR</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-against-500/60" />
                        <span className="text-xs text-surface-500">AGAINST</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Peak writing time */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="bg-surface-200/60 border border-surface-300/40 rounded-2xl p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-4 w-4 text-surface-500" />
                    <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wide">Peak Writing Time</h2>
                    {topHourBucket && (
                      <Badge variant="proposed" className="ml-auto text-xs">
                        {topHourBucket.label}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-end gap-2 h-20">
                    {data.hourDistribution.map((bucket) => {
                      const HIcon = HOUR_ICONS[bucket.label] ?? Clock
                      const heightPct = maxHourCount > 0 ? pct(bucket.count, maxHourCount) : 0
                      const isTop = bucket.label === topHourBucket?.label
                      return (
                        <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex items-end justify-center" style={{ height: '60px' }}>
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(heightPct, 4)}%` }}
                              transition={{ duration: 0.6, delay: 0.4 }}
                              style={{ height: `${Math.max((heightPct / 100) * 60, 4)}px` }}
                              className={cn(
                                'w-full rounded-t transition-all',
                                isTop ? 'bg-for-500' : 'bg-surface-400/40',
                              )}
                            />
                          </div>
                          <HIcon className={cn('h-3.5 w-3.5', isTop ? 'text-for-400' : 'text-surface-500')} />
                          <span className={cn('text-[10px]', isTop ? 'text-for-400' : 'text-surface-500')}>
                            {bucket.label.slice(0, 3)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>

                {/* Top arguments */}
                {data.topArguments.length > 0 && (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-gold" />
                      <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wide">Signature Arguments</h2>
                    </div>
                    {data.topArguments.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} rank={i} />
                    ))}
                  </motion.div>
                )}

                {/* Recent arguments */}
                {data.recentArguments.length > 0 && (
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-surface-500" />
                        <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wide">Recent Arguments</h2>
                      </div>
                      <Link
                        href={`/profile/${username}/arguments`}
                        className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1 transition-colors"
                      >
                        View all <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                    {data.recentArguments.map((arg) => (
                      <ArgumentCard key={arg.id} arg={arg} />
                    ))}
                  </motion.div>
                )}

                {/* Footer links */}
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="flex flex-wrap gap-2 pt-2"
                >
                  {[
                    { href: `/profile/${username}/analytics`, label: 'Vote Analytics', icon: BarChart2 },
                    { href: `/profile/${username}/arguments`, label: 'All Arguments', icon: MessageSquare },
                    { href: `/profile/${username}/impact`,    label: 'Impact',         icon: Globe },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm',
                        'bg-surface-200/60 border border-surface-300/40',
                        'text-surface-600 hover:text-surface-800 hover:bg-surface-200 transition-colors',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </Link>
                  ))}
                </motion.div>

              </>
            )}
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
