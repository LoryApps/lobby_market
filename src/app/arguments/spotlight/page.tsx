'use client'

/**
 * /arguments/spotlight — Weekly Argument Showcase
 *
 * An editorial, weekly showcase of the best arguments on the platform:
 *   • One "Argument of the Week" hero — highest composite (AI × upvotes) this week
 *   • One "Category Champion" per civic category — best argument in each domain
 *
 * Distinct from:
 *   /arguments/top-scored   — filtered list sorted by AI score (no editorial framing)
 *   /arguments/champions    — arena faceoff win rate leaderboard
 *   /arguments/trending     — upvote velocity (last 24 h)
 *   /arguments/reactions    — emoji reaction counts
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Brain,
  Crown,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Zap,
  TrendingUp,
  Landmark,
  Cpu,
  FlaskConical,
  Scale,
  BookOpen,
  Music2,
  Heart,
  Leaf,
  GraduationCap,
  Link2,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { renderWithMentions } from '@/lib/utils/mentions'
import type { SpotlightResponse, SpotlightArgument, Category } from '@/app/api/arguments/spotlight/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_ICON: Record<Category, React.ComponentType<{ className?: string }>> = {
  Economics:   TrendingUp,
  Politics:    Landmark,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  BookOpen,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

const CAT_COLOR: Record<Category, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30'         },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',      border: 'border-for-500/30'      },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',       border: 'border-purple/30'       },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',      border: 'border-emerald/30'      },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10',  border: 'border-against-500/30'  },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-500/10',      border: 'border-for-500/20'      },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/20'         },
  Health:      { text: 'text-against-300', bg: 'bg-against-500/10',  border: 'border-against-500/30'  },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',      border: 'border-emerald/30'      },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',      border: 'border-for-500/30'      },
}

// ─── Grade badge ──────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  const cfg: Record<string, string> = {
    A: 'bg-gold/10 border-gold/30 text-gold',
    B: 'bg-emerald/10 border-emerald/30 text-emerald',
    C: 'bg-for-500/10 border-for-500/30 text-for-400',
    D: 'bg-against-500/10 border-against-500/30 text-against-400',
    F: 'bg-surface-300/10 border-surface-300/30 text-surface-500',
  }
  return (
    <span className={cn('text-xs font-mono font-semibold px-1.5 py-0.5 rounded border', cfg[grade] ?? cfg.F)}>
      {grade}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + '…'
}

function formatWeek(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(s)} – ${fmt(e)}`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HeroSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-5 w-40 rounded-md" />
      </div>
      <Skeleton className="h-6 w-3/4 rounded-md" />
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-5/6 rounded-md" />
      <Skeleton className="h-4 w-2/3 rounded-md" />
      <div className="flex items-center gap-3 pt-2">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-4 w-24 rounded-md" />
      </div>
    </div>
  )
}

function CatSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-4 w-24 rounded-md" />
      </div>
      <Skeleton className="h-3.5 w-full rounded-md" />
      <Skeleton className="h-3.5 w-5/6 rounded-md" />
      <Skeleton className="h-3.5 w-3/4 rounded-md" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
    </div>
  )
}

// ─── Argument card (hero) ─────────────────────────────────────────────────────

function HeroCard({ arg }: { arg: SpotlightArgument }) {
  const isFor = arg.side === 'blue'
  return (
    <Link href={`/arguments/${arg.id}`}>
      <motion.div
        whileHover={{ scale: 1.005 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'group rounded-2xl border p-6 cursor-pointer transition-colors',
          isFor
            ? 'bg-for-500/5 border-for-500/30 hover:border-for-500/50 hover:bg-for-500/8'
            : 'bg-against-500/5 border-against-500/30 hover:border-against-500/50 hover:bg-against-500/8',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg border',
                isFor
                  ? 'bg-for-500/15 border-for-500/40 text-for-400'
                  : 'bg-against-500/15 border-against-500/40 text-against-400',
              )}
            >
              {isFor ? (
                <ThumbsUp className="h-4 w-4" aria-hidden />
              ) : (
                <ThumbsDown className="h-4 w-4" aria-hidden />
              )}
            </div>
            <span
              className={cn(
                'text-xs font-mono font-semibold tracking-wide uppercase',
                isFor ? 'text-for-400' : 'text-against-400',
              )}
            >
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <GradeBadge grade={arg.ai_grade} />
            <div className="flex items-center gap-1 text-xs font-mono text-surface-500">
              <ThumbsUp className="h-3 w-3" aria-hidden />
              <span>{arg.upvotes}</span>
            </div>
          </div>
        </div>

        {/* Topic */}
        {arg.topic && (
          <div className="mb-3">
            <p className="text-xs font-mono text-surface-500 mb-1 uppercase tracking-wider">
              Topic
            </p>
            <p className="text-sm text-surface-600 leading-snug line-clamp-2">
              {arg.topic.statement}
            </p>
          </div>
        )}

        {/* Argument content */}
        <p className="text-base text-white leading-relaxed mb-4">
          {renderWithMentions(truncate(arg.content, 420))}
        </p>

        {/* Source */}
        {arg.source_url && (
          <div className="flex items-center gap-1.5 mb-4 text-xs font-mono text-surface-500">
            <Link2 className="h-3 w-3 flex-shrink-0" aria-hidden />
            <span className="truncate">{new URL(arg.source_url).hostname}</span>
          </div>
        )}

        {/* Author + topic link */}
        <div className="flex items-center justify-between pt-3 border-t border-surface-300">
          <div className="flex items-center gap-2">
            <Avatar
              src={arg.author?.avatar_url ?? null}
              username={arg.author?.username ?? 'unknown'}
              size="xs"
            />
            <span className="text-sm font-mono text-surface-600">
              {arg.author?.display_name ?? arg.author?.username ?? 'Anonymous'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs font-mono text-surface-500 group-hover:text-surface-400 transition-colors">
            <span>Read full</span>
            <ArrowRight className="h-3 w-3" aria-hidden />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({
  category,
  argument: arg,
}: {
  category: Category
  argument: SpotlightArgument
}) {
  const Icon = CAT_ICON[category]
  const style = CAT_COLOR[category]
  const isFor = arg.side === 'blue'

  return (
    <Link href={`/arguments/${arg.id}`}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="group rounded-xl border border-surface-300 bg-surface-100 p-4 cursor-pointer hover:border-surface-400 hover:bg-surface-200/60 transition-colors h-full flex flex-col"
      >
        {/* Category label */}
        <div className="flex items-center justify-between mb-3">
          <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md border', style.bg, style.border)}>
            <Icon className={cn('h-3.5 w-3.5', style.text)} aria-hidden />
            <span className={cn('text-xs font-mono font-semibold', style.text)}>{category}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <GradeBadge grade={arg.ai_grade} />
            <span
              className={cn(
                'text-xs font-mono font-semibold px-1.5 py-0.5 rounded border',
                isFor
                  ? 'bg-for-500/10 border-for-500/30 text-for-400'
                  : 'bg-against-500/10 border-against-500/30 text-against-400',
              )}
            >
              {isFor ? 'FOR' : 'AGN'}
            </span>
          </div>
        </div>

        {/* Argument text */}
        <p className="text-sm text-white leading-relaxed line-clamp-4 flex-1 mb-3">
          {renderWithMentions(truncate(arg.content, 240))}
        </p>

        {/* Votes + author */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-300 mt-auto">
          <div className="flex items-center gap-1.5">
            <Avatar
              src={arg.author?.avatar_url ?? null}
              username={arg.author?.username ?? 'unknown'}
              size="xs"
            />
            <span className="text-xs font-mono text-surface-500 truncate max-w-[80px]">
              {arg.author?.display_name ?? arg.author?.username ?? 'Anon'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs font-mono text-surface-500">
            <ThumbsUp className="h-3 w-3" aria-hidden />
            <span>{arg.upvotes}</span>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SpotlightPage() {
  const [data, setData] = useState<SpotlightResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/arguments/spotlight')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: SpotlightResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load spotlight')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* ── Page header ───────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/arguments"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-100 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            aria-label="Back to arguments"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
            <Crown className="h-5 w-5 text-gold" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Argument Spotlight</h1>
            <p className="text-xs font-mono text-surface-500">
              {data ? `Week of ${formatWeek(data.week_start, data.week_end)}` : 'Best arguments this week'}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg bg-surface-100 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loading && !data ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Hero skeleton */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-36 rounded-md" />
                </div>
                <HeroSkeleton />
              </div>
              {/* Category skeletons */}
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-48 rounded-md" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <CatSkeleton key={i} delay={i * 60} />
                ))}
              </div>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-against-500/20 bg-against-500/5 p-8 text-center"
            >
              <Scale className="h-8 w-8 text-against-400 mx-auto mb-3" aria-hidden />
              <p className="text-sm font-mono text-against-300 mb-4">{error}</p>
              <button
                onClick={load}
                className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Try again
              </button>
            </motion.div>
          ) : !data || (!data.hero && data.categories.length === 0) ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Brain}
                iconColor="text-purple"
                iconBg="bg-purple/10"
                iconBorder="border-purple/30"
                title="No spotlight yet this week"
                description="Arguments need AI quality scores and upvotes to appear here. Come back once the community has been debating."
                actions={[
                  { label: 'Browse Topics', href: '/' },
                  { label: 'Top Scored', href: '/arguments/top-scored' },
                ]}
              />
            </motion.div>
          ) : (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* ── Hero ─────────────────────────────────────── */}
              {data.hero && (
                <section className="mb-8" aria-label="Argument of the Week">
                  <div className="flex items-center gap-2 mb-4">
                    <Crown className="h-4 w-4 text-gold" aria-hidden />
                    <h2 className="text-sm font-mono font-semibold text-gold uppercase tracking-wider">
                      Argument of the Week
                    </h2>
                    <div className="flex items-center gap-1 ml-auto text-xs font-mono text-surface-500">
                      <Sparkles className="h-3 w-3" aria-hidden />
                      <span>Score: {data.hero.composite}</span>
                    </div>
                  </div>
                  <HeroCard arg={data.hero} />
                </section>
              )}

              {/* ── Category champions ──────────────────────── */}
              {data.categories.length > 0 && (
                <section aria-label="Category Champions">
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="h-4 w-4 text-surface-500" aria-hidden />
                    <h2 className="text-sm font-mono font-semibold text-surface-500 uppercase tracking-wider">
                      Category Champions
                    </h2>
                    <span className="text-xs font-mono text-surface-600 ml-1">— best argument per domain</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.categories.map(({ category, argument }) => (
                      <motion.div
                        key={category}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                      >
                        <CategoryCard category={category} argument={argument} />
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Footer nav ──────────────────────────────── */}
              <nav
                className="mt-8 pt-6 border-t border-surface-300 flex flex-wrap gap-2"
                aria-label="Related argument pages"
              >
                {[
                  { label: 'Top Scored', href: '/arguments/top-scored', icon: Brain },
                  { label: 'Trending', href: '/arguments/trending', icon: Zap },
                  { label: 'Champions', href: '/arguments/champions', icon: Award },
                  { label: 'Reactions', href: '/arguments/reactions', icon: ThumbsUp },
                  { label: 'All Arguments', href: '/arguments', icon: ExternalLink },
                ].map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    {label}
                  </Link>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
