'use client'

/**
 * /depth — The Civic Depth Index
 *
 * Ranks civic debates by intellectual richness: argument density, citation
 * rate, AI quality scores, wiki content, predictions, and reply depth.
 *
 * Distinct from:
 *   /vitals     — platform-level discourse quality, not per-topic ranking
 *   /arguments  — lists individual arguments, not ranked debate topics
 *   /analytics  — personal stats, not topic-level depth scoring
 *   /signals    — power-user velocity metrics, not discourse richness
 *
 * Answers: "Which civic debates have the richest, most substantive discourse?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  Cpu,
  ExternalLink,
  FileText,
  FlaskConical,
  GraduationCap,
  Heart,
  Info,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DepthTopic, CategoryDepth, DepthResponse } from '@/app/api/depth/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: typeof Landmark; color: string; bg: string; border: string }> = {
  Politics:    { icon: Landmark,      color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30'      },
  Economics:   { icon: TrendingUp,    color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30'          },
  Technology:  { icon: Cpu,           color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30'        },
  Science:     { icon: FlaskConical,  color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30'       },
  Ethics:      { icon: Scale,         color: 'text-for-300',       bg: 'bg-for-400/10',       border: 'border-for-400/30'       },
  Philosophy:  { icon: BookOpen,      color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30'        },
  Culture:     { icon: Music2,        color: 'text-against-400',   bg: 'bg-against-500/10',   border: 'border-against-500/30'   },
  Health:      { icon: Heart,         color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30'       },
  Education:   { icon: GraduationCap, color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30'          },
  Environment: { icon: Leaf,          color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30'       },
}

function getCatConfig(name: string | null) {
  return CATEGORY_CONFIG[name ?? ''] ?? {
    icon: FileText,
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
  }
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'Active',   color: 'text-for-400',    bg: 'bg-for-500/15'    },
  voting:   { label: 'Voting',   color: 'text-purple',     bg: 'bg-purple/15'     },
  law:      { label: 'Law',      color: 'text-gold',       bg: 'bg-gold/15'       },
  failed:   { label: 'Failed',   color: 'text-surface-500',bg: 'bg-surface-300/30'},
  proposed: { label: 'Proposed', color: 'text-surface-600',bg: 'bg-surface-400/20'},
}

// ─── Depth score color ────────────────────────────────────────────────────────

function depthColor(score: number): string {
  if (score >= 70) return 'text-emerald'
  if (score >= 45) return 'text-for-400'
  if (score >= 25) return 'text-gold'
  return 'text-surface-500'
}

function depthLabel(score: number): string {
  if (score >= 70) return 'Deep'
  if (score >= 45) return 'Substantive'
  if (score >= 25) return 'Moderate'
  return 'Surface'
}

function depthRingColor(score: number): string {
  if (score >= 70) return 'border-emerald/50 bg-emerald/10'
  if (score >= 45) return 'border-for-500/50 bg-for-500/10'
  if (score >= 25) return 'border-gold/50 bg-gold/10'
  return 'border-surface-400 bg-surface-200'
}

// ─── Dimension bar ────────────────────────────────────────────────────────────

function DimensionBar({
  label,
  value,
  max,
  color,
}: {
  label: string
  value: number | null
  max: number
  color: string
}) {
  const pct = value !== null ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-surface-500 w-20 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className={cn('text-[10px] font-mono tabular-nums w-8 text-right', value !== null ? 'text-surface-500' : 'text-surface-600')}>
        {value !== null ? (value % 1 === 0 ? value : value.toFixed(1)) : '—'}
      </span>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({ topic, rank }: { topic: DepthTopic; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const catConf = getCatConfig(topic.category)
  const statConf = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const CatIcon = catConf.icon

  return (
    <div className={cn(
      'rounded-xl border bg-surface-100 overflow-hidden transition-colors',
      'hover:border-surface-400',
      expanded ? 'border-surface-400' : 'border-surface-300',
    )}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {/* Rank */}
        <span className="text-xs font-mono text-surface-600 w-5 flex-shrink-0 tabular-nums">
          {rank}
        </span>

        {/* Depth score ring */}
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full border-2 font-mono text-sm font-bold',
          depthRingColor(topic.depth_score),
          depthColor(topic.depth_score),
        )}>
          {topic.depth_score}
        </div>

        {/* Category icon */}
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md border',
          catConf.bg, catConf.border,
        )}>
          <CatIcon className={cn('h-3.5 w-3.5', catConf.color)} />
        </div>

        {/* Statement */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm text-white leading-snug line-clamp-2">{topic.statement}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-md', statConf.bg, statConf.color)}>
              {statConf.label}
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {topic.total_votes.toLocaleString()} votes
            </span>
            <span className={cn('text-[10px] font-mono', depthColor(topic.depth_score))}>
              {depthLabel(topic.depth_score)}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <span className="flex-shrink-0 text-surface-500">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-surface-300 px-4 pb-4 pt-3 overflow-hidden"
          >
            <div className="grid gap-2 mb-3">
              <DimensionBar
                label="Arg. density"
                value={topic.argument_density}
                max={20}
                color="bg-for-500"
              />
              <DimensionBar
                label="Citations"
                value={topic.citation_rate}
                max={100}
                color="bg-emerald"
              />
              <DimensionBar
                label="AI quality"
                value={topic.avg_ai_score}
                max={10}
                color="bg-purple"
              />
              <DimensionBar
                label="Wiki length"
                value={topic.wiki_length}
                max={5000}
                color="bg-gold"
              />
              <DimensionBar
                label="Predictions"
                value={topic.prediction_count}
                max={20}
                color="bg-against-500"
              />
              <DimensionBar
                label="Replies"
                value={topic.reply_count}
                max={30}
                color="bg-for-300"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
                <span>{topic.argument_count} arguments</span>
                <span>{topic.cited_arguments} cited</span>
                {topic.avg_ai_score !== null && <span>AI avg: {topic.avg_ai_score}/10</span>}
              </div>
              <Link
                href={`/topic/${topic.id}`}
                className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                View debate
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategoryDepth }) {
  const conf = getCatConfig(cat.category)
  const CatIcon = conf.icon
  return (
    <div className={cn(
      'rounded-xl border p-3 bg-surface-100',
      conf.border,
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          'flex items-center justify-center w-6 h-6 rounded-md border',
          conf.bg, conf.border,
        )}>
          <CatIcon className={cn('h-3 w-3', conf.color)} />
        </div>
        <span className="font-mono text-xs font-semibold text-white">{cat.category}</span>
      </div>
      <div className={cn('font-mono text-2xl font-bold mb-0.5', depthColor(cat.avg_depth_score))}>
        {cat.avg_depth_score}
      </div>
      <div className="text-[10px] font-mono text-surface-500 space-y-0.5">
        <div>{cat.topic_count} topics</div>
        <div>{cat.avg_argument_density} args/100 votes</div>
        <div>{cat.avg_citation_rate}% cited</div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type SortKey = 'depth_score' | 'argument_density' | 'citation_rate' | 'argument_count'

export default function DepthPage() {
  const [data, setData] = useState<DepthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sort, setSort] = useState<SortKey>('depth_score')
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showInfo, setShowInfo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/depth', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filteredTopics = (data?.topics ?? [])
    .filter((t) => !filterCat || t.category === filterCat)
    .filter((t) => !search || t.statement.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'depth_score') return b.depth_score - a.depth_score
      if (sort === 'argument_density') return b.argument_density - a.argument_density
      if (sort === 'citation_rate') return b.citation_rate - a.citation_rate
      return b.argument_count - a.argument_count
    })

  const categories = data?.categories ?? []
  const platform = data?.platform

  const SORT_OPTIONS: { id: SortKey; label: string }[] = [
    { id: 'depth_score',      label: 'Depth Score' },
    { id: 'argument_density', label: 'Arg. Density' },
    { id: 'citation_rate',    label: 'Citation Rate' },
    { id: 'argument_count',   label: 'Argument Count' },
  ]

  return (
    <div className="min-h-screen bg-surface-50 pb-20">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-surface-500 hover:text-white text-xs font-mono mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Feed
          </Link>

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Brain className="h-4 w-4 text-for-400" />
                <span className="text-xs font-mono text-for-400 uppercase tracking-widest">Civic Depth Index</span>
              </div>
              <h1 className="font-mono text-2xl font-bold text-white leading-tight">
                Deepest Debates
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-1 leading-relaxed">
                Ranked by argument richness, citation quality, and deliberation depth.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              aria-label="How depth is calculated"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Info panel ─────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="rounded-xl border border-for-500/20 bg-for-500/5 p-4 text-xs font-mono text-surface-500 leading-relaxed">
                <p className="text-white font-semibold mb-2">How depth is scored (0–100)</p>
                <ul className="space-y-1">
                  <li><span className="text-for-400">Argument density (30 pts)</span> — arguments per vote cast</li>
                  <li><span className="text-emerald">Citation rate (20 pts)</span> — % of arguments backed by a source</li>
                  <li><span className="text-purple">AI quality (25 pts)</span> — average AI critique score (1–10)</li>
                  <li><span className="text-gold">Wiki richness (15 pts)</span> — length of the topic&apos;s context doc</li>
                  <li><span className="text-against-400">Predictions (10 pts)</span> — market confidence engagement</li>
                  <li><span className="text-for-300">Reply depth (10 pts)</span> — threaded argument replies</li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Platform stats ──────────────────────────────────────────────────── */}
        {platform && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5 text-center">
              <div className="font-mono text-xl font-bold text-white">{platform.avg_depth_score}</div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Avg depth score</div>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5 text-center">
              <div className="font-mono text-xl font-bold text-emerald">{platform.avg_argument_density}</div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Args / 100 votes</div>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5 text-center">
              <div className="font-mono text-xl font-bold text-purple">{platform.avg_citation_rate}%</div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Cited arguments</div>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5 text-center">
              <div className="font-mono text-xl font-bold text-gold">
                {platform.avg_ai_score !== null ? platform.avg_ai_score : '—'}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Avg AI score</div>
            </div>
          </div>
        )}

        {/* ── Category breakdown ──────────────────────────────────────────────── */}
        {!loading && categories.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="h-3.5 w-3.5 text-surface-500" />
              <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">By Category</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setFilterCat(filterCat === cat.category ? null : cat.category)}
                  className={cn(
                    'transition-opacity',
                    filterCat && filterCat !== cat.category ? 'opacity-40' : 'opacity-100',
                  )}
                >
                  <CategoryCard cat={cat} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Filters & sort ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
            <input
              type="search"
              placeholder="Search debates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-100 border border-surface-300 rounded-xl pl-9 pr-4 py-2 text-sm font-mono text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500/50"
            />
          </div>
          {/* Sort */}
          <div className="flex gap-1.5 flex-wrap">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSort(opt.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors',
                  sort === opt.id
                    ? 'bg-for-600 border-for-500 text-white'
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Topic list ──────────────────────────────────────────────────────── */}
        {loading && <PageSkeleton />}

        {error && !loading && (
          <EmptyState
            icon={Brain}
            title="Couldn't load depth data"
            description="Failed to calculate depth scores. Try refreshing."
            action={
              <button
                type="button"
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm font-mono font-semibold transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            }
          />
        )}

        {!loading && !error && filteredTopics.length === 0 && (
          <EmptyState
            icon={Brain}
            title="No debates found"
            description={search ? 'No debates match your search.' : 'No debates have been scored yet.'}
          />
        )}

        {!loading && !error && filteredTopics.length > 0 && (
          <div className="space-y-2">
            {filteredTopics.map((topic, i) => (
              <TopicRow key={topic.id} topic={topic} rank={i + 1} />
            ))}
          </div>
        )}

        {/* ── Footer context ──────────────────────────────────────────────────── */}
        {!loading && !error && filteredTopics.length > 0 && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/vitals"
              className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 hover:border-for-500/40 hover:bg-surface-200/60 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-emerald" />
                <div>
                  <div className="font-mono text-xs font-semibold text-white">Discourse Vitals</div>
                  <div className="text-[10px] font-mono text-surface-500">Platform quality health</div>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors" />
            </Link>
            <Link
              href="/arguments/top-scored"
              className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 hover:border-for-500/40 hover:bg-surface-200/60 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Trophy className="h-4 w-4 text-gold" />
                <div>
                  <div className="font-mono text-xs font-semibold text-white">Top Arguments</div>
                  <div className="text-[10px] font-mono text-surface-500">Highest AI-scored arguments</div>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
