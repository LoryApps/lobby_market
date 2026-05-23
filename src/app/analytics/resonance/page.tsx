'use client'

/**
 * /analytics/resonance — Civic Resonance Report
 *
 * Measures cross-partisan appeal: which of your arguments were upvoted by
 * people who voted the OPPOSITE side on that topic?
 *
 * A high resonance score means your arguments break through partisan lines —
 * you're persuading people who disagree with you, not just preaching to the choir.
 *
 * Distinct from:
 *   /analytics/impact      — raw upvote counts and argument reach
 *   /analytics/rhetoric    — writing style analysis
 *   /analytics/opposition  — arguments written AGAINST your positions
 *   /analytics/influence   — reputation and clout earned from arguments
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Flame,
  GitMerge,
  Info,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ResonanceResponse,
  ResonantArgument,
  CategoryResonance,
  CrossPartisanVoice,
} from '@/app/api/analytics/resonance/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-gold',
}

const ROLE_COLOR: Record<string, string> = {
  elder:         'text-gold',
  senator:       'text-purple',
  lawmaker:      'text-gold',
  debator:       'text-for-400',
  troll_catcher: 'text-emerald',
  person:        'text-surface-500',
}

const ROLE_LABEL: Record<string, string> = {
  elder:         'Elder',
  senator:       'Senator',
  lawmaker:      'Lawmaker',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  person:        'Citizen',
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

function archetypeStyle(archetype: string): {
  color: string
  bg: string
  border: string
} {
  if (archetype === 'Bridge Builder')
    return { color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' }
  if (archetype === 'Cross-Aisle Advocate')
    return { color: 'text-for-300', bg: 'bg-for-500/10', border: 'border-for-500/30' }
  if (archetype === 'Emerging Persuader')
    return { color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' }
  if (archetype === 'Choir Preacher')
    return { color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' }
  return { color: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-300' }
}

// ─── Cross-partisan bar ───────────────────────────────────────────────────────

function CrossBar({ pct, animated }: { pct: number; animated: boolean }) {
  const barColor =
    pct >= 40 ? 'bg-emerald'
    : pct >= 25 ? 'bg-for-500'
    : pct >= 12 ? 'bg-gold'
    : 'bg-surface-400'

  return (
    <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
      <motion.div
        className={cn('absolute inset-y-0 left-0 rounded-full', barColor)}
        initial={{ width: 0 }}
        animate={{ width: animated ? `${Math.min(pct, 100)}%` : 0 }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
      />
    </div>
  )
}

// ─── Resonant argument card ───────────────────────────────────────────────────

function ResonantArgCard({
  arg,
  rank,
}: {
  arg: ResonantArgument
  rank: number
}) {
  const isFor = arg.argument_side === 'blue'
  const catColor = CATEGORY_COLOR[arg.topic_category ?? ''] ?? 'text-surface-500'
  const topicStatus = arg.topic_status

  const pctColor =
    arg.cross_upvote_pct >= 40 ? 'text-emerald'
    : arg.cross_upvote_pct >= 25 ? 'text-for-300'
    : arg.cross_upvote_pct >= 12 ? 'text-gold'
    : 'text-surface-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05, duration: 0.3 }}
      className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 hover:border-surface-400/60 transition-colors"
    >
      {/* Topic line */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {arg.topic_category && (
          <span className={cn('text-[11px] font-mono font-semibold', catColor)}>
            {arg.topic_category}
          </span>
        )}
        <span className="text-surface-600 text-[11px]">·</span>
        <Badge
          variant={
            topicStatus === 'law' ? 'law'
            : topicStatus === 'failed' ? 'failed'
            : 'active'
          }
          size="sm"
        >
          {topicStatus === 'law' ? 'LAW' : topicStatus === 'failed' ? 'Failed' : topicStatus}
        </Badge>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-full',
            isFor
              ? 'bg-for-500/15 text-for-300 border border-for-500/25'
              : 'bg-against-500/15 text-against-300 border border-against-500/25'
          )}
        >
          {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
      </div>

      {/* Topic statement */}
      <Link href={`/topic/${arg.topic_id}`}>
        <p className="text-xs font-mono text-surface-400 mb-2 leading-relaxed hover:text-surface-300 transition-colors">
          {truncate(arg.topic_statement, 100)}
        </p>
      </Link>

      {/* Argument content */}
      <p className="text-sm font-mono text-white leading-relaxed mb-3">
        {truncate(arg.argument_content, 180)}
      </p>

      {/* Resonance metrics */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-surface-500">
            {arg.cross_upvotes} cross-divide upvote{arg.cross_upvotes !== 1 ? 's' : ''}
          </span>
          <span className={cn('font-bold', pctColor)}>
            {arg.cross_upvote_pct}% cross-partisan
          </span>
        </div>
        <CrossBar pct={arg.cross_upvote_pct} animated />
        <div className="flex items-center justify-between text-[11px] font-mono text-surface-600 pt-0.5">
          <span>{arg.total_upvotes} total upvotes</span>
          <Link
            href={`/topic/${arg.topic_id}/arguments`}
            className="inline-flex items-center gap-0.5 hover:text-surface-400 transition-colors"
          >
            View argument
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Category breakdown row ───────────────────────────────────────────────────

function CategoryRow({ cat, rank }: { cat: CategoryResonance; rank: number }) {
  const color = CATEGORY_COLOR[cat.category] ?? 'text-surface-500'
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.06 }}
      className="flex items-center gap-3"
    >
      <span className={cn('text-xs font-mono font-semibold w-28 truncate flex-shrink-0', color)}>
        {cat.category}
      </span>
      <div className="flex-1">
        <CrossBar pct={cat.avg_cross_pct} animated />
      </div>
      <span className="text-xs font-mono text-surface-400 w-12 text-right flex-shrink-0">
        {cat.avg_cross_pct}%
      </span>
      <span className="text-[11px] font-mono text-surface-600 w-16 text-right flex-shrink-0">
        {cat.resonant_args}/{cat.total_args} args
      </span>
    </motion.div>
  )
}

// ─── Cross-partisan voice card ────────────────────────────────────────────────

function CrossVoiceCard({ voice, rank }: { voice: CrossPartisanVoice; rank: number }) {
  const roleColor = ROLE_COLOR[voice.role] ?? 'text-surface-500'
  const roleLabel = ROLE_LABEL[voice.role] ?? voice.role

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
    >
      <Link
        href={`/profile/${voice.username}`}
        className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:border-surface-400/50 hover:bg-surface-200/70 transition-all"
      >
        <Avatar
          src={voice.avatar_url}
          fallback={voice.display_name ?? voice.username}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {voice.display_name ?? voice.username}
          </p>
          <p className={cn('text-[11px] font-mono', roleColor)}>{roleLabel}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xs font-mono font-bold text-emerald">{voice.upvoted_args}</p>
          <p className="text-[10px] font-mono text-surface-600">cross-upvotes</p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-36 rounded-2xl bg-surface-100 border border-surface-300/40" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-surface-100 border border-surface-300/40" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl bg-surface-100 border border-surface-300/40" />
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ResonancePage() {
  const router = useRouter()
  const [data, setData] = useState<ResonanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/resonance')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const json: ResonanceResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const arcStyle = data ? archetypeStyle(data.stats.resonance_archetype) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <Link
            href="/analytics"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200/60 border border-surface-300/50 text-surface-400 hover:text-white hover:border-surface-400 transition-all mt-0.5"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald/10 border border-emerald/30">
                <GitMerge className="h-4 w-4 text-emerald" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-white leading-none">
                  Civic Resonance
                </h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  Arguments that crossed the partisan divide
                </p>
              </div>
            </div>
          </div>

          {data && !loading && (
            <button
              onClick={load}
              className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border border-surface-300/40 text-surface-500 hover:text-white hover:border-surface-400 transition-all"
              aria-label="Refresh resonance data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={Scale}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Couldn't load resonance data"
            description={error}
            actions={[{ label: 'Try again', onClick: load, variant: 'primary', icon: RefreshCw }]}
          />
        )}

        {/* No data empty state */}
        {!loading && !error && data && !data.has_data && (
          <EmptyState
            icon={GitMerge}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            title="No resonance data yet"
            description={data.stats.archetype_desc}
            actions={[
              { label: 'Write arguments', href: '/trending', variant: 'primary', icon: ArrowRight },
              { label: 'Browse topics', href: '/', variant: 'secondary', icon: Flame },
            ]}
          />
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {!loading && !error && data && data.has_data && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Archetype card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border p-5 bg-surface-100',
                  arcStyle?.border ?? 'border-surface-300/40'
                )}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      'flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-2xl border',
                      arcStyle?.bg ?? 'bg-surface-200',
                      arcStyle?.border ?? 'border-surface-300',
                    )}
                  >
                    <GitMerge className={cn('h-5 w-5', arcStyle?.color ?? 'text-surface-400')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={cn(
                          'text-xs font-mono font-bold px-2 py-0.5 rounded-full border',
                          arcStyle?.bg,
                          arcStyle?.border,
                          arcStyle?.color,
                        )}
                      >
                        {data.stats.resonance_archetype}
                      </span>
                    </div>
                    <p className="text-sm font-mono text-surface-300 leading-relaxed">
                      {data.stats.archetype_desc}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: 'Arguments with cross-appeal',
                    value: data.stats.arguments_with_cross_upvotes,
                    sub: `of ${data.stats.total_arguments} total`,
                    color: 'text-emerald',
                    icon: GitMerge,
                  },
                  {
                    label: 'Total cross-partisan upvotes',
                    value: data.stats.total_cross_upvotes,
                    sub: 'from the other side',
                    color: 'text-for-300',
                    icon: ThumbsUp,
                  },
                  {
                    label: 'Avg cross-partisan rate',
                    value: data.stats.avg_cross_pct,
                    sub: '% of upvotes cross-divide',
                    suffix: '%',
                    color: 'text-gold',
                    icon: Scale,
                  },
                  {
                    label: 'Top resonant categories',
                    value: data.category_breakdown.length,
                    sub: 'categories with cross-appeal',
                    color: 'text-purple',
                    icon: BarChart2,
                  },
                ].map(({ label, value, sub, color, icon: Icon, suffix = '' }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="rounded-2xl bg-surface-100 border border-surface-300/40 p-4"
                  >
                    <Icon className={cn('h-4 w-4 mb-2', color)} aria-hidden="true" />
                    <p className={cn('font-mono text-2xl font-bold leading-none', color)}>
                      <AnimatedNumber value={value} />
                      {suffix}
                    </p>
                    <p className="text-[11px] font-mono text-surface-500 mt-1 leading-snug">{label}</p>
                    <p className="text-[10px] font-mono text-surface-600 mt-0.5">{sub}</p>
                  </motion.div>
                ))}
              </div>

              {/* Top resonant arguments */}
              {data.top_resonant.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="h-4 w-4 text-gold" aria-hidden="true" />
                    <h2 className="font-mono text-sm font-semibold text-white">
                      Most resonant arguments
                    </h2>
                    <span className="text-[11px] font-mono text-surface-500">
                      · highest cross-partisan appeal
                    </span>
                  </div>
                  <div className="space-y-3">
                    {data.top_resonant.map((arg, i) => (
                      <ResonantArgCard key={arg.argument_id} arg={arg} rank={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* Category breakdown */}
              {data.category_breakdown.length > 0 && (
                <section className="rounded-2xl bg-surface-100 border border-surface-300/40 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BookOpen className="h-4 w-4 text-purple" aria-hidden="true" />
                    <h2 className="font-mono text-sm font-semibold text-white">
                      Cross-partisan reach by category
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {data.category_breakdown.map((cat, i) => (
                      <CategoryRow key={cat.category} cat={cat} rank={i} />
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] font-mono text-surface-600 leading-relaxed">
                    Average % of upvotes on your arguments that came from voters on the opposing side.
                  </p>
                </section>
              )}

              {/* Cross-partisan upvoters */}
              {data.top_cross_upvoters.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-for-400" aria-hidden="true" />
                    <h2 className="font-mono text-sm font-semibold text-white">
                      Your cross-partisan upvoters
                    </h2>
                    <span className="text-[11px] font-mono text-surface-500">
                      · oppose your positions, respect your arguments
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {data.top_cross_upvoters.map((v, i) => (
                      <CrossVoiceCard key={v.user_id} voice={v} rank={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* Explainer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="rounded-2xl bg-surface-100 border border-surface-300/40 p-4"
              >
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="text-xs font-mono font-semibold text-surface-400">
                      How resonance is measured
                    </p>
                    <p className="text-[11px] font-mono text-surface-600 leading-relaxed">
                      A cross-partisan upvote occurs when someone who voted the <em>opposite side</em> on a
                      topic still upvoted your argument on that same topic. Resonance score
                      weights cross upvotes by the square root of total upvotes, rewarding
                      both cross-appeal and absolute reach.
                    </p>
                    <p className="text-[11px] font-mono text-surface-600 leading-relaxed">
                      Archetypes: <span className="text-emerald">Bridge Builder</span> (≥40% cross),&nbsp;
                      <span className="text-for-300">Cross-Aisle Advocate</span> (≥25%),&nbsp;
                      <span className="text-gold">Emerging Persuader</span> (≥12%),&nbsp;
                      <span className="text-purple">Choir Preacher</span> (&lt;12%).
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Footer links */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/analytics/impact"
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300/40 hover:border-surface-400/60 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">Argument Impact</p>
                    <p className="text-[11px] font-mono text-surface-500">Total reach & influence</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-300 transition-colors" />
                </Link>
                <Link
                  href="/analytics/opposition"
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300/40 hover:border-surface-400/60 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">Opposition Intel</p>
                    <p className="text-[11px] font-mono text-surface-500">Arguments against you</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-300 transition-colors" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
