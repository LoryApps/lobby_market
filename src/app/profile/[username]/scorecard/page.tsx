'use client'

/**
 * /profile/[username]/scorecard — Civic Scorecard
 *
 * A shareable identity card showing a citizen's full civic performance profile:
 * composite score, grade, level, five dimension bars, and key stats.
 *
 * Distinct from:
 *   /civic-score        — your own live score (interactive, private)
 *   /report-card        — alphabetic grade report across subjects
 *   /analytics          — full personal analytics dashboard
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  MessageSquare,
  RefreshCw,
  Scale,
  Share2,
  Star,
  Target,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { ARCHETYPE_CONFIG, type ArchetypeId } from '@/lib/config/archetypes'
import { cn } from '@/lib/utils/cn'
import type { ScorecardResponse, ScorecardDimension } from '@/app/api/profile/[username]/scorecard/route'

// ─── Dimension config ─────────────────────────────────────────────────────────

const DIM_ICON: Record<string, typeof Vote> = {
  participation:  Vote,
  argumentation:  MessageSquare,
  breadth:        Globe,
  accuracy:       Target,
  reputation:     Trophy,
}

const DIM_COLOR: Record<string, { text: string; bar: string; bg: string; border: string }> = {
  participation: { text: 'text-for-400',     bar: 'bg-for-500',    bg: 'bg-for-500/10',    border: 'border-for-500/30' },
  argumentation: { text: 'text-purple',      bar: 'bg-purple',     bg: 'bg-purple/10',     border: 'border-purple/30' },
  breadth:       { text: 'text-emerald',     bar: 'bg-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  accuracy:      { text: 'text-gold',        bar: 'bg-gold',       bg: 'bg-gold/10',       border: 'border-gold/30' },
  reputation:    { text: 'text-against-300', bar: 'bg-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
}

// ─── Grade styling ─────────────────────────────────────────────────────────────

const GRADE_STYLE: Record<string, { text: string; glow: string }> = {
  'A+': { text: 'text-emerald',     glow: 'shadow-[0_0_20px_rgba(16,185,129,0.35)]' },
  'A':  { text: 'text-emerald',     glow: 'shadow-[0_0_16px_rgba(16,185,129,0.28)]' },
  'A-': { text: 'text-emerald',     glow: 'shadow-[0_0_12px_rgba(16,185,129,0.22)]' },
  'B+': { text: 'text-for-300',     glow: 'shadow-[0_0_16px_rgba(147,197,253,0.28)]' },
  'B':  { text: 'text-for-400',     glow: 'shadow-[0_0_12px_rgba(96,165,250,0.22)]' },
  'B-': { text: 'text-for-400',     glow: 'shadow-[0_0_10px_rgba(96,165,250,0.18)]' },
  'C+': { text: 'text-gold',        glow: 'shadow-[0_0_12px_rgba(245,158,11,0.22)]' },
  'C':  { text: 'text-gold',        glow: 'shadow-[0_0_10px_rgba(245,158,11,0.18)]' },
  'C-': { text: 'text-gold',        glow: 'shadow-[0_0_8px_rgba(245,158,11,0.14)]' },
  'D':  { text: 'text-against-400', glow: '' },
  'F':  { text: 'text-against-400', glow: '' },
}

const LEVEL_COLOR: Record<string, string> = {
  'Civic Elder':     'text-gold',
  'Policy Architect':'text-emerald',
  'Civic Champion':  'text-for-300',
  'Active Citizen':  'text-for-400',
  'Engaged Voter':   'text-purple',
  'Civic Apprentice':'text-surface-600',
  'New Citizen':     'text-surface-500',
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

// ─── Dimension bar ────────────────────────────────────────────────────────────

function DimensionBar({ dim, index }: { dim: ScorecardDimension; index: number }) {
  const colors = DIM_COLOR[dim.key] ?? DIM_COLOR.participation
  const Icon = DIM_ICON[dim.key] ?? Vote

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 + index * 0.07, duration: 0.4 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border',
        colors.bg,
        colors.border,
      )}
    >
      <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0', colors.bg)}>
        <Icon className={cn('h-4 w-4', colors.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-mono font-semibold text-white">{dim.label}</span>
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-mono text-surface-500')}>
              avg {dim.platform_avg}
            </span>
            <span className={cn('text-xs font-mono font-bold', colors.text)}>
              {dim.grade}
            </span>
          </div>
        </div>
        <div className="relative h-1.5 rounded-full bg-surface-400/40 overflow-hidden">
          {/* Platform average marker */}
          <div
            className="absolute top-0 bottom-0 w-px bg-surface-400/60 z-10"
            style={{ left: `${dim.platform_avg}%` }}
          />
          {/* Score bar */}
          <motion.div
            className={cn('h-full rounded-full', colors.bar)}
            initial={{ width: 0 }}
            animate={{ width: `${dim.score}%` }}
            transition={{ delay: 0.2 + index * 0.07, duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] font-mono text-surface-600">{dim.score}/100</span>
          <span className={cn('text-[10px] font-mono', dim.score > dim.platform_avg ? colors.text : 'text-surface-600')}>
            {dim.score > dim.platform_avg ? `+${dim.score - dim.platform_avg} above avg` : `${dim.score - dim.platform_avg} below avg`}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ScorecardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-5 rounded-2xl bg-surface-100 border border-surface-300">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-16 w-16 rounded-xl" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-xl" />
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScorecardPage() {
  const { username } = useParams<{ username: string }>()
  const [data, setData] = useState<ScorecardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/profile/${username}/scorecard`, { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Failed to load scorecard')
        return
      }
      setData(await res.json())
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => { load() }, [load])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: do nothing
    }
  }

  const gradeStyle = data ? (GRADE_STYLE[data.grade] ?? GRADE_STYLE['C']) : null
  const archConfig = data?.profile.archetype
    ? ARCHETYPE_CONFIG[data.profile.archetype as ArchetypeId] ?? null
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* Back link */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/profile/${username}`}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to profile
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all',
                'border border-surface-300 hover:border-surface-400',
                copied
                  ? 'text-emerald bg-emerald/10 border-emerald/30'
                  : 'text-surface-500 hover:text-white bg-surface-200/60'
              )}
              aria-label="Copy link to scorecard"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <Link
              href={`/analytics?user=${username}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border border-surface-300 hover:border-surface-400 text-surface-500 hover:text-white bg-surface-200/60 transition-all"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Full stats
            </Link>
          </div>
        </div>

        {loading && <ScorecardSkeleton />}

        {error && (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-8 text-center">
            <Scale className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="text-sm font-mono text-against-300 mb-4">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-sm font-mono text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {data && !loading && (
          <div ref={cardRef} className="space-y-4">
            {/* ── Identity card ────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={cn(
                'relative overflow-hidden rounded-2xl border bg-surface-100 p-5',
                archConfig ? archConfig.borderColor : 'border-surface-300',
              )}
            >
              {/* Background accent */}
              {archConfig && (
                <div
                  className={cn(
                    'absolute inset-0 opacity-[0.04] pointer-events-none',
                    archConfig.bgColor,
                  )}
                />
              )}

              <div className="relative flex items-start gap-4">
                {/* Avatar */}
                <Link href={`/profile/${data.profile.username}`}>
                  <Avatar
                    src={data.profile.avatar_url}
                    fallback={data.profile.display_name || data.profile.username}
                    size="lg"
                  />
                </Link>

                {/* Identity */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/profile/${data.profile.username}`}
                      className="text-lg font-mono font-bold text-white hover:text-for-400 transition-colors truncate"
                    >
                      {data.profile.display_name || `@${data.profile.username}`}
                    </Link>
                    <span
                      className={cn(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                        data.profile.role === 'elder'
                          ? 'text-gold border-gold/40 bg-gold/10'
                          : data.profile.role === 'troll_catcher'
                          ? 'text-emerald border-emerald/40 bg-emerald/10'
                          : data.profile.role === 'debator'
                          ? 'text-for-400 border-for-500/40 bg-for-500/10'
                          : 'text-surface-500 border-surface-400 bg-surface-300/20'
                      )}
                    >
                      {ROLE_LABEL[data.profile.role] ?? data.profile.role}
                    </span>
                  </div>

                  <p className="text-xs font-mono text-surface-500 mt-0.5">
                    @{data.profile.username}
                  </p>

                  {/* Archetype */}
                  {archConfig && (
                    <div className={cn('flex items-center gap-1.5 mt-2 text-xs font-mono', archConfig.color)}>
                      <archConfig.icon className="h-3.5 w-3.5" />
                      <span>{archConfig.name}</span>
                      <span className="text-surface-600">·</span>
                      <span className="text-surface-600 text-[11px]">{archConfig.tagline}</span>
                    </div>
                  )}

                  {/* Level */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <Award className="h-3.5 w-3.5 text-surface-500" />
                    <span className={cn('text-xs font-mono font-semibold', LEVEL_COLOR[data.level] ?? 'text-surface-500')}>
                      {data.level}
                    </span>
                    <span className="text-surface-600 text-[10px] font-mono">·</span>
                    <span className="text-surface-600 text-[10px] font-mono">
                      {data.level_description}
                    </span>
                  </div>
                </div>

                {/* Grade badge */}
                <div
                  className={cn(
                    'flex-shrink-0 flex flex-col items-center justify-center',
                    'h-16 w-16 rounded-2xl border-2 bg-surface-200',
                    gradeStyle?.glow,
                    data.grade.startsWith('A')
                      ? 'border-emerald/40'
                      : data.grade.startsWith('B')
                      ? 'border-for-500/40'
                      : data.grade.startsWith('C')
                      ? 'border-gold/40'
                      : 'border-against-500/40',
                  )}
                >
                  <span className={cn('text-2xl font-mono font-black leading-none', gradeStyle?.text ?? 'text-surface-500')}>
                    {data.grade}
                  </span>
                  <span className="text-[10px] font-mono text-surface-500 mt-0.5 leading-none">
                    {data.composite}/100
                  </span>
                </div>
              </div>

              {/* Percentile ribbon */}
              <div className="relative mt-4 pt-4 border-t border-surface-300/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
                  <Flame className="h-3 w-3" />
                  <span>Top <span className="text-white font-semibold">{100 - data.percentile}%</span> of citizens</span>
                </div>
                {data.stats.top_category && (
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <BookOpen className="h-3 w-3 text-surface-500" />
                    <span className="text-surface-500">Top topic:</span>
                    <span className={cn('font-semibold', CAT_COLOR[data.stats.top_category] ?? 'text-white')}>
                      {data.stats.top_category}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* ── Quick stats row ──────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.4 }}
              className="grid grid-cols-3 gap-3"
            >
              {[
                {
                  icon: Vote,
                  label: 'Votes',
                  value: data.profile.total_votes,
                  color: 'text-for-400',
                  bg: 'bg-for-500/10',
                  border: 'border-for-500/20',
                },
                {
                  icon: MessageSquare,
                  label: 'Arguments',
                  value: data.profile.total_arguments,
                  color: 'text-purple',
                  bg: 'bg-purple/10',
                  border: 'border-purple/20',
                },
                {
                  icon: Zap,
                  label: 'Clout',
                  value: data.profile.clout,
                  color: 'text-gold',
                  bg: 'bg-gold/10',
                  border: 'border-gold/20',
                },
              ].map(({ icon: Icon, label, value, color, bg, border }) => (
                <div
                  key={label}
                  className={cn('rounded-xl border p-3 text-center', bg, border)}
                >
                  <Icon className={cn('h-4 w-4 mx-auto mb-1.5', color)} />
                  <div className="text-base font-mono font-bold text-white">
                    <AnimatedNumber value={value} />
                  </div>
                  <div className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</div>
                </div>
              ))}
            </motion.div>

            {/* ── Vote stance bar ──────────────────────────────────────── */}
            {data.profile.total_votes > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12, duration: 0.4 }}
                className="rounded-xl border border-surface-300 bg-surface-100 p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono font-semibold text-white">Vote stance</span>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    <span className="flex items-center gap-1 text-for-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-for-500 inline-block" />
                      {Math.round((data.profile.blue_vote_count / Math.max(1, data.profile.total_votes)) * 100)}% For
                    </span>
                    <span className="flex items-center gap-1 text-against-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-against-500 inline-block" />
                      {Math.round((data.profile.red_vote_count / Math.max(1, data.profile.total_votes)) * 100)}% Against
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-surface-300 overflow-hidden flex">
                  <motion.div
                    className="h-full bg-for-500 rounded-l-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(data.profile.blue_vote_count / Math.max(1, data.profile.total_votes)) * 100}%` }}
                    transition={{ delay: 0.2, duration: 0.7, ease: 'easeOut' }}
                  />
                  <motion.div
                    className="h-full bg-against-500 rounded-r-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(data.profile.red_vote_count / Math.max(1, data.profile.total_votes)) * 100}%` }}
                    transition={{ delay: 0.2, duration: 0.7, ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            )}

            {/* ── Dimension bars ───────────────────────────────────────── */}
            <div>
              <h2 className="text-xs font-mono font-semibold uppercase tracking-widest text-surface-500 mb-3">
                Civic dimensions
              </h2>
              <div className="space-y-2">
                {data.dimensions.map((dim, i) => (
                  <DimensionBar key={dim.key} dim={dim} index={i} />
                ))}
              </div>
            </div>

            {/* ── Additional stats row ─────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.4 }}
              className="grid grid-cols-2 gap-3"
            >
              {[
                {
                  icon: Flame,
                  label: 'Vote streak',
                  value: `${data.profile.vote_streak}d`,
                  color: 'text-against-300',
                },
                {
                  icon: BookOpen,
                  label: 'Categories',
                  value: `${data.stats.categories_engaged}/10`,
                  color: 'text-for-300',
                },
                ...(data.stats.prediction_accuracy !== null
                  ? [{
                      icon: Target,
                      label: 'Prediction accuracy',
                      value: `${Math.round(data.stats.prediction_accuracy * 100)}%`,
                      color: 'text-gold',
                    }]
                  : []),
                ...(data.stats.avg_ai_score !== null
                  ? [{
                      icon: Star,
                      label: 'Arg. quality score',
                      value: `${data.stats.avg_ai_score.toFixed(1)}/10`,
                      color: 'text-purple',
                    }]
                  : []),
              ].map(({ icon: Icon, label, value, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3"
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                  <div>
                    <div className="text-sm font-mono font-bold text-white">{value}</div>
                    <div className="text-[10px] font-mono text-surface-500">{label}</div>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* ── Share / action footer ────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="flex items-center gap-3 pt-2"
            >
              <button
                onClick={copyLink}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-mono font-medium',
                  'border transition-all',
                  copied
                    ? 'bg-emerald/10 border-emerald/30 text-emerald'
                    : 'bg-surface-200 border-surface-300 hover:border-surface-400 text-white hover:bg-surface-300'
                )}
              >
                {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                {copied ? 'Link copied!' : 'Share scorecard'}
              </button>
              <Link
                href={`/profile/${username}`}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-mono font-medium bg-for-600 hover:bg-for-700 text-white transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Profile
              </Link>
            </motion.div>

            {/* Member since */}
            <p className="text-center text-[11px] font-mono text-surface-600 pt-1">
              Member since {new Date(data.profile.member_since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              {' · '}
              {data.stats.account_age_days} days on the platform
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
