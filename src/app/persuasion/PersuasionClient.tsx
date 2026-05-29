'use client'

/**
 * /persuasion — The Civic Persuader
 *
 * Shows WHERE you argue (category territory map), WHICH SIDE you favour,
 * and HOW your arguments land across civic debates. Surfaces a "persuasion
 * archetype" — a plain-language identity for your argument personality.
 *
 * Distinct from:
 *   /analytics/persuasion  — normalised effectiveness scores + monthly trend
 *   /analytics/rhetoric    — writing style (evidence vs. logic vs. values)
 *   /analytics/arguments   — raw list of your arguments
 *   /resonance             — cross-partisan upvote impact specifically
 *
 * Persuasion answers: "WHERE do you argue — and how fierce are you?"
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
  Cpu,
  DollarSign,
  ExternalLink,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  PersuasionResponse,
  CategoryPersuasion,
  PersuasionArgument,
} from '@/app/api/analytics/persuasion/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Politics:    Landmark,
  Economics:   DollarSign,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  BookOpen,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
  General:     Globe,
  Uncategorized: Globe,
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string; bar: string }> = {
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     bar: 'bg-for-500' },
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        bar: 'bg-gold' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      bar: 'bg-purple' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     bar: 'bg-emerald' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', bar: 'bg-against-500' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/30',     bar: 'bg-for-400' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        bar: 'bg-gold' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     bar: 'bg-emerald' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     bar: 'bg-emerald' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      bar: 'bg-purple' },
  General:     { text: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/30', bar: 'bg-surface-400' },
  Uncategorized:{ text: 'text-surface-400',bg: 'bg-surface-300/30', border: 'border-surface-400/30', bar: 'bg-surface-400' },
}

function getCatColors(cat: string) {
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.General
}
function getCatIcon(cat: string) {
  return CATEGORY_ICONS[cat] ?? Globe
}

// ─── Archetype ────────────────────────────────────────────────────────────────

interface Archetype {
  id: string
  label: string
  description: string
  accent: string
  bg: string
  border: string
  icon: React.ComponentType<{ className?: string }>
}

function deriveArchetype(data: PersuasionResponse): Archetype {
  const { total_arguments, by_category, for_stats, avg_persuasion_score } = data

  if (total_arguments < 3) {
    return {
      id: 'silent',
      label: 'The Silent Observer',
      description: 'You mostly vote and watch — post a few arguments to reveal your true debate style.',
      accent: 'text-surface-500',
      bg: 'bg-surface-300/20',
      border: 'border-surface-400/30',
      icon: Globe,
    }
  }

  const topCat = by_category[0]
  const topCatShare = topCat ? topCat.argument_count / total_arguments : 0
  const categoryCount = by_category.length

  // Domain specialist: >65% of arguments in one category
  if (topCatShare >= 0.65 && topCat) {
    const colors = getCatColors(topCat.category)
    return {
      id: 'specialist',
      label: `The ${topCat.category} Specialist`,
      description: `Over ${Math.round(topCatShare * 100)}% of your arguments land in ${topCat.category} debates — you're a domain expert and the community knows it.`,
      accent: colors.text,
      bg: colors.bg,
      border: colors.border,
      icon: getCatIcon(topCat.category),
    }
  }

  // Cross-aisle debater: both sides active and fairly balanced
  const forRatio = for_stats.count / Math.max(total_arguments, 1)
  const crossAisle = forRatio >= 0.30 && forRatio <= 0.70 && total_arguments >= 6
  if (crossAisle) {
    return {
      id: 'cross_aisle',
      label: 'The Cross-Aisle Debater',
      description: `You argue both FOR and AGAINST across different topics — a rare civic voice that doesn't toe a single line.`,
      accent: 'text-purple',
      bg: 'bg-purple/10',
      border: 'border-purple/30',
      icon: Scale,
    }
  }

  // Partisan fighter: strong FOR preference
  if (forRatio > 0.75 && total_arguments >= 4) {
    return {
      id: 'for_partisan',
      label: 'The FOR Champion',
      description: `${Math.round(forRatio * 100)}% of your arguments back proposals rather than oppose them — you're a builder, not a blocker.`,
      accent: 'text-for-400',
      bg: 'bg-for-500/10',
      border: 'border-for-500/30',
      icon: ThumbsUp,
    }
  }

  // Partisan fighter: strong AGAINST preference
  if (forRatio < 0.25 && total_arguments >= 4) {
    return {
      id: 'against_partisan',
      label: 'The AGAINST Champion',
      description: `${Math.round((1 - forRatio) * 100)}% of your arguments challenge proposals — you're a rigorous critic keeping the Lobby honest.`,
      accent: 'text-against-400',
      bg: 'bg-against-500/10',
      border: 'border-against-500/30',
      icon: ThumbsDown,
    }
  }

  // Elite persuader: high score
  if (avg_persuasion_score >= 50 && total_arguments >= 5) {
    return {
      id: 'elite',
      label: 'The Elite Persuader',
      description: `Your arguments consistently punch above their weight — high upvotes even in debates with massive vote counts.`,
      accent: 'text-gold',
      bg: 'bg-gold/10',
      border: 'border-gold/30',
      icon: Sparkles,
    }
  }

  // Prolific: many arguments across many categories
  if (total_arguments >= 15 && categoryCount >= 4) {
    return {
      id: 'prolific',
      label: 'The Civic Voice',
      description: `${total_arguments} arguments across ${categoryCount} categories — your presence is felt everywhere in the Lobby.`,
      accent: 'text-emerald',
      bg: 'bg-emerald/10',
      border: 'border-emerald/30',
      icon: MessageSquare,
    }
  }

  // Default: engaged contributor
  return {
    id: 'contributor',
    label: 'The Engaged Contributor',
    description: `You show up and make your case across the debates you care about. Keep building — your voice is gaining weight.`,
    accent: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: Zap,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const w = Math.floor(d / 7)
  const m = Math.floor(d / 30)
  if (d < 1) return 'today'
  if (d < 7) return `${d}d ago`
  if (w < 5) return `${w}w ago`
  return `${m}mo ago`
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-5 w-40 mb-2" />
        <Skeleton className="h-8 w-64 mb-3" />
        <Skeleton className="h-4 w-full max-w-sm" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-8 w-12 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-4 w-32 mb-4" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full mb-2" />)}
      </div>
    </div>
  )
}

// ─── Category Territory Card ──────────────────────────────────────────────────

function CategoryTerritoryCard({
  cat,
  maxCount,
  rank,
}: {
  cat: CategoryPersuasion
  maxCount: number
  rank: number
}) {
  const colors = getCatColors(cat.category)
  const Icon = getCatIcon(cat.category)
  const widthPct = maxCount > 0 ? Math.round((cat.argument_count / maxCount) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.06 }}
      className={cn(
        'rounded-xl border p-3 flex items-center gap-3',
        colors.bg, colors.border
      )}
    >
      <div className={cn('flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center', colors.bg)}>
        <Icon className={cn('h-4 w-4', colors.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn('text-xs font-mono font-semibold truncate', colors.text)}>
            {cat.category}
          </span>
          <span className="text-xs font-mono text-surface-500 ml-2 flex-shrink-0">
            {cat.argument_count} arg{cat.argument_count !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="h-1.5 bg-surface-300/50 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${widthPct}%` }}
            transition={{ duration: 0.6, delay: rank * 0.06 + 0.2, ease: 'easeOut' }}
            className={cn('h-full rounded-full', colors.bar)}
          />
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-surface-500">
          <span>{cat.total_upvotes} upvotes</span>
          <span>·</span>
          <span>avg {cat.avg_upvotes} per arg</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg, rank }: { arg: PersuasionArgument; rank: number }) {
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.08 }}
      className="rounded-xl bg-surface-200/50 border border-surface-300 p-4 hover:bg-surface-200 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex-shrink-0 h-6 w-6 rounded-lg flex items-center justify-center mt-0.5',
          isFor ? 'bg-for-500/15' : 'bg-against-500/15'
        )}>
          {isFor
            ? <ThumbsUp className="h-3 w-3 text-for-400" />
            : <ThumbsDown className="h-3 w-3 text-against-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-700 leading-snug">
            {truncate(arg.content, 160)}
          </p>
          <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-surface-500">
            <span className={isFor ? 'text-for-400 font-semibold' : 'text-against-400 font-semibold'}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            {arg.category && (
              <>
                <span>·</span>
                <span className={getCatColors(arg.category).text}>{arg.category}</span>
              </>
            )}
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <ThumbsUp className="h-2.5 w-2.5" />
              {arg.upvotes}
            </span>
            <span>·</span>
            <span>{relativeTime(arg.created_at)}</span>
          </div>
        </div>
        <Link
          href={`/topic/${arg.topic_id}`}
          className="flex-shrink-0 p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          aria-label="View topic"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PersuasionClient() {
  const router = useRouter()
  const [data, setData] = useState<PersuasionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/persuasion', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load persuasion data')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const archetype = data ? deriveArchetype(data) : null
  const maxCatCount = data ? Math.max(...(data.by_category.map(c => c.argument_count)), 1) : 1

  const forPct = data
    ? Math.round((data.for_stats.count / Math.max(data.total_arguments, 1)) * 100)
    : 0
  const againstPct = data ? 100 - forPct : 0

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 pb-20 md:pb-8">
        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-base font-mono font-bold text-white">Civic Persuasion</h1>
              <p className="text-xs text-surface-500 font-mono">Your argument territory</p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>

          {loading && <PageSkeleton />}

          {error && !loading && (
            <EmptyState
              icon={BarChart2}
              title="Couldn't load persuasion data"
              description={error}
              actions={[{ label: 'Try again', onClick: load }]}
            />
          )}

          {!loading && !error && data && (
            <AnimatePresence mode="wait">
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {/* Archetype banner */}
                {archetype && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className={cn(
                      'rounded-2xl border p-5',
                      archetype.bg, archetype.border
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        'flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center',
                        archetype.bg, archetype.border, 'border'
                      )}>
                        <archetype.icon className={cn('h-6 w-6', archetype.accent)} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">
                          Persuasion Archetype
                        </p>
                        <h2 className={cn('text-lg font-mono font-bold mb-1', archetype.accent)}>
                          {archetype.label}
                        </h2>
                        <p className="text-sm text-surface-600 leading-relaxed">
                          {archetype.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* No arguments state */}
                {data.total_arguments === 0 && (
                  <EmptyState
                    icon={MessageSquare}
                    title="No arguments yet"
                    description="Post your first argument in a debate to reveal your persuasion profile."
                    actions={[{ label: 'Browse debates', href: '/debate' }]}
                  />
                )}

                {data.total_arguments > 0 && (
                  <>
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {
                          label: 'Arguments',
                          value: data.total_arguments,
                          sub: `${data.for_stats.count} FOR · ${data.against_stats.count} AGAINST`,
                          color: 'text-white',
                        },
                        {
                          label: 'Upvotes',
                          value: data.total_upvotes,
                          sub: `avg ${data.avg_upvotes_per_argument} per arg`,
                          color: 'text-emerald',
                        },
                        {
                          label: 'Persuasion',
                          value: `${Math.round(data.avg_persuasion_score)}`,
                          sub: data.persuasion_tier,
                          color: data.persuasion_tier_color,
                        },
                      ].map((stat, i) => (
                        <motion.div
                          key={stat.label}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: i * 0.07 }}
                          className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
                        >
                          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">
                            {stat.label}
                          </p>
                          <p className={cn('text-2xl font-mono font-bold', stat.color)}>
                            {stat.value}
                          </p>
                          <p className="text-[10px] font-mono text-surface-500 mt-0.5 leading-tight">
                            {stat.sub}
                          </p>
                        </motion.div>
                      ))}
                    </div>

                    {/* FOR vs AGAINST bar */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.15 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                    >
                      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
                        Argument Side Split
                      </p>
                      <div className="h-3 rounded-full overflow-hidden flex mb-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${forPct}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
                          className="bg-for-500 h-full rounded-l-full"
                        />
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${againstPct}%` }}
                          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
                          className="bg-against-500 h-full rounded-r-full"
                        />
                      </div>
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-for-400 font-semibold">{forPct}% FOR</span>
                        <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
                      </div>
                      {data.for_stats.count >= 2 && data.against_stats.count >= 2 && (
                        <div className="mt-3 pt-3 border-t border-surface-300 grid grid-cols-2 gap-3 text-[10px] font-mono text-surface-500">
                          <div>
                            <span className="text-for-400 font-semibold">FOR avg upvotes: </span>
                            {data.for_stats.avg_upvotes}
                          </div>
                          <div>
                            <span className="text-against-400 font-semibold">AGAINST avg upvotes: </span>
                            {data.against_stats.avg_upvotes}
                          </div>
                        </div>
                      )}
                    </motion.div>

                    {/* Category territory */}
                    {data.by_category.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.2 }}
                        className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                            Argument Territory
                          </p>
                          <span className="text-[10px] font-mono text-surface-500">
                            {data.by_category.length} categor{data.by_category.length === 1 ? 'y' : 'ies'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {data.by_category.map((cat, i) => (
                            <CategoryTerritoryCard
                              key={cat.category}
                              cat={cat}
                              maxCount={maxCatCount}
                              rank={i}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Top arguments */}
                    {data.top_arguments.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.25 }}
                        className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                            Most Persuasive Arguments
                          </p>
                          <Sparkles className="h-3.5 w-3.5 text-gold" />
                        </div>
                        <div className="space-y-3">
                          {data.top_arguments.slice(0, 5).map((arg, i) => (
                            <ArgumentCard key={arg.id} arg={arg} rank={i} />
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Related pages */}
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.3 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                    >
                      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
                        Explore More
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { href: '/resonance',           label: 'Cross-Partisan Impact', icon: Scale,        color: 'text-purple' },
                          { href: '/rhetoric',            label: 'Rhetorical Style',       icon: MessageSquare, color: 'text-emerald' },
                          { href: '/conviction',          label: 'Conviction Scores',      icon: Zap,           color: 'text-gold' },
                          { href: '/timing',              label: 'Civic Timing',           icon: BarChart2,     color: 'text-for-400' },
                          { href: '/analytics/persuasion', label: 'Effectiveness Deep Dive', icon: Sparkles,   color: 'text-gold' },
                          { href: '/analytics/arguments', label: 'All Arguments',          icon: ArrowRight,    color: 'text-surface-400' },
                        ].map(({ href, label, icon: Icon, color }) => (
                          <Link
                            key={href}
                            href={href}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                          >
                            <Icon className={cn('h-3 w-3', color)} />
                            {label}
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
