'use client'

/**
 * /frontier — The Civic Frontier
 *
 * The leading edge of civic debate on Lobby Market. Shows:
 *   • Newest Arrivals    — topics proposed in the last 72 h
 *   • Uncharted Ground   — topics where the debate has just begun (first arguments)
 *   • Almost Active      — topics at 60–95% of their activation threshold
 *   • Uncovered Ground   — civic categories with very few established laws
 *
 * Distinct from:
 *   /pipeline   — full stage view of all topics in the system
 *   /surge      — topics gaining momentum
 *   /groundswell — topics with new voices joining
 *   /trending   — general trending by feed score
 *
 * The Frontier answers: "Where is civic debate just beginning?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  Compass,
  Cpu,
  ExternalLink,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Mic,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { FrontierResponse, FrontierTopic } from '@/app/api/topics/frontier/route'

// ─── Category icons ────────────────────────────────────────────────────────────

const CAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics: TrendingUp,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Law: Scale,
  Philosophy: BookOpen,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
  Media: Mic,
  International: Globe,
}

const CAT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/25' },
  Politics: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/25' },
  Technology: { text: 'text-for-300', bg: 'bg-for-500/10', border: 'border-for-500/25' },
  Science: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/25' },
  Law: { text: 'text-gold', bg: 'bg-gold/15', border: 'border-gold/30' },
  Philosophy: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/25' },
  Culture: { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/25' },
  Health: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/25' },
  Environment: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/25' },
  Education: { text: 'text-for-300', bg: 'bg-for-500/10', border: 'border-for-500/25' },
  Media: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/25' },
  International: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/25' },
}

const DEFAULT_CAT = { text: 'text-surface-400', bg: 'bg-surface-300/40', border: 'border-surface-300/40' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  return `${d}d ago`
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── TopicRow ─────────────────────────────────────────────────────────────────

function TopicRow({ topic, showProgress }: { topic: FrontierTopic; showProgress?: boolean }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CAT_COLORS[topic.category ?? ''] ?? DEFAULT_CAT
  const CatIcon = CAT_ICONS[topic.category ?? ''] ?? Globe
  const progressPct = topic.activation_threshold > 0
    ? Math.min(100, Math.round((topic.support_count / topic.activation_threshold) * 100))
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="group block rounded-2xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/80 hover:bg-surface-200/60 transition-all duration-200 p-4"
      >
        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-3">
          {/* Category icon */}
          <div className={cn(
            'flex items-center justify-center h-8 w-8 rounded-xl flex-shrink-0 border mt-0.5',
            catColor.bg, catColor.border
          )}>
            <CatIcon className={cn('h-4 w-4', catColor.text)} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {topic.category && (
                <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', catColor.text)}>
                  {topic.category}
                </span>
              )}
              <span className="text-surface-600 text-[10px]">·</span>
              <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} />
              <span className="text-surface-600 text-[10px]">·</span>
              <span className="text-[10px] font-mono text-surface-500">{relativeTime(topic.created_at)}</span>
            </div>

            {/* Statement */}
            <p className="text-sm font-mono font-semibold text-white leading-snug group-hover:text-for-200 transition-colors line-clamp-2">
              {topic.statement}
            </p>
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="flex items-center gap-3 flex-wrap">
          {topic.total_votes > 0 ? (
            <>
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3 text-for-400" />
                <span className="text-[11px] font-mono text-for-400">{forPct}%</span>
              </div>
              <div className="flex items-center gap-1">
                <ThumbsDown className="h-3 w-3 text-against-400" />
                <span className="text-[11px] font-mono text-against-400">{againstPct}%</span>
              </div>
              <div className="flex items-center gap-1 text-surface-500">
                <BarChart2 className="h-3 w-3" />
                <span className="text-[11px] font-mono">{topic.total_votes.toLocaleString()} votes</span>
              </div>
            </>
          ) : (
            <span className="text-[11px] font-mono text-surface-600 italic">No votes yet — be the first</span>
          )}

          {topic.argument_count > 0 && (
            <div className="flex items-center gap-1 text-purple">
              <MessageSquare className="h-3 w-3" />
              <span className="text-[11px] font-mono">{topic.argument_count} {topic.argument_count === 1 ? 'argument' : 'arguments'}</span>
            </div>
          )}

          {topic.author && (
            <div className="flex items-center gap-1.5 ml-auto">
              <Avatar
                src={topic.author.avatar_url}
                username={topic.author.username}
                size="xs"
              />
              <span className="text-[10px] font-mono text-surface-500">
                @{topic.author.username}
              </span>
            </div>
          )}
        </div>

        {/* ── Activation progress (for almostActive section) ── */}
        {showProgress && topic.support_count > 0 && (
          <div className="mt-3 pt-3 border-t border-surface-300/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-surface-500">Activation progress</span>
              <span className="text-[10px] font-mono text-emerald font-semibold">{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[10px] font-mono text-surface-600 mt-1">
              {topic.support_count.toLocaleString()} / {topic.activation_threshold.toLocaleString()} supporters
            </p>
          </div>
        )}
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TopicSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="h-8 w-8 rounded-xl flex-shrink-0" />
        <div className="flex-1">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  iconClass,
  title,
  subtitle,
  topics,
  loading,
  showProgress,
  empty,
}: {
  icon: typeof Compass
  iconClass: string
  title: string
  subtitle: string
  topics: FrontierTopic[]
  loading: boolean
  showProgress?: boolean
  empty: string
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-4">
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg border', iconClass)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div>
          <h2 className="text-sm font-mono font-bold text-white leading-none">{title}</h2>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <TopicSkeleton key={i} />)}
        </div>
      ) : topics.length === 0 ? (
        <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-6 text-center">
          <p className="text-sm font-mono text-surface-500">{empty}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((t) => (
            <TopicRow key={t.id} topic={t} showProgress={showProgress} />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function FrontierClient() {
  const [data, setData] = useState<FrontierResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/topics/frontier', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load frontier')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const total = data
    ? data.newest.length + data.uncharted.length + data.almostActive.length
    : 0

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pt-4 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="flex items-center gap-2.5 flex-1">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/30">
                <Compass className="h-4.5 w-4.5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-white leading-none">The Civic Frontier</h1>
                <p className="text-[11px] font-mono text-surface-500 mt-0.5">Where civic debate is just beginning</p>
              </div>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Description */}
          <p className="text-sm text-surface-400 font-mono leading-relaxed">
            The freshest debates — just proposed, barely voted on, and wide open for your input.
            {!loading && total > 0 && (
              <span className="text-for-400 font-semibold"> {total} frontier topics</span>
            )}
            {!loading && total > 0 && ' waiting for the community.'}
          </p>
        </div>

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-6 rounded-2xl bg-against-500/10 border border-against-500/30 p-4 text-center">
            <p className="text-sm font-mono text-against-400 mb-2">{error}</p>
            <button
              onClick={load}
              className="text-xs font-mono text-against-400 hover:text-against-200 underline transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Sections ──────────────────────────────────────────────────────── */}
        <div className="space-y-10">

          {/* 1. Newest Arrivals */}
          <Section
            icon={Sparkles}
            iconClass="bg-for-500/10 border-for-500/30 text-for-400"
            title="Newest Arrivals"
            subtitle="Proposed in the last 72 hours"
            topics={data?.newest ?? []}
            loading={loading}
            empty="No new topics proposed in the last 72 hours."
          />

          {/* 2. Uncharted Ground */}
          <Section
            icon={Compass}
            iconClass="bg-purple/10 border-purple/30 text-purple"
            title="Uncharted Ground"
            subtitle="Early debates — first arguments just landing"
            topics={data?.uncharted ?? []}
            loading={loading}
            empty="No uncharted topics right now — check back soon."
          />

          {/* 3. Almost Active */}
          <Section
            icon={Zap}
            iconClass="bg-emerald/10 border-emerald/30 text-emerald"
            title="Almost Active"
            subtitle="60–95% of votes needed to enter full debate"
            topics={data?.almostActive ?? []}
            loading={loading}
            showProgress
            empty="No topics near activation right now."
          />

          {/* 4. Uncovered Ground */}
          {!loading && data && data.uncoveredCategories.length > 0 && (
            <section>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg border bg-gold/10 border-gold/30">
                  <Globe className="h-3.5 w-3.5 text-gold" />
                </div>
                <div>
                  <h2 className="text-sm font-mono font-bold text-white leading-none">Uncovered Ground</h2>
                  <p className="text-[11px] font-mono text-surface-500 mt-0.5">Categories with the fewest established laws</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AnimatePresence>
                  {data.uncoveredCategories.map((cat, i) => {
                    const CatIcon = CAT_ICONS[cat.category] ?? Globe
                    const catColor = CAT_COLORS[cat.category] ?? DEFAULT_CAT
                    return (
                      <motion.div
                        key={cat.category}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                      >
                        <Link
                          href={`/categories?cat=${encodeURIComponent(cat.category)}`}
                          className="group flex items-start gap-3 rounded-2xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/80 hover:bg-surface-200/60 transition-all p-4"
                        >
                          <div className={cn(
                            'flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0',
                            catColor.bg, catColor.border
                          )}>
                            <CatIcon className={cn('h-4.5 w-4.5', catColor.text)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-mono font-bold group-hover:opacity-90 transition-opacity', catColor.text)}>
                              {cat.category}
                            </p>
                            <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                              {cat.lawCount === 0
                                ? 'No established laws yet'
                                : `Only ${cat.lawCount} law${cat.lawCount === 1 ? '' : 's'}`}
                              {' · '}
                              {cat.proposedCount} proposed topic{cat.proposedCount === 1 ? '' : 's'}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-white mt-0.5 transition-colors flex-shrink-0" />
                        </Link>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </section>
          )}

        </div>

        {/* ── Footer nav ────────────────────────────────────────────────────── */}
        {!loading && (
          <div className="mt-10 pt-6 border-t border-surface-300/40 flex flex-wrap gap-3 justify-center">
            <Link
              href="/surge"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white text-xs font-mono font-semibold transition-all"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Surge
            </Link>
            <Link
              href="/pipeline"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white text-xs font-mono font-semibold transition-all"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              Pipeline
            </Link>
            <Link
              href="/trending"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white text-xs font-mono font-semibold transition-all"
            >
              <Zap className="h-3.5 w-3.5" />
              Trending
            </Link>
            <Link
              href="/groundswell"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white text-xs font-mono font-semibold transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Groundswell
            </Link>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
