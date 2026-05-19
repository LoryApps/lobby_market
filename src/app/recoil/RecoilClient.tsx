'use client'

/**
 * /recoil — The Civic Recoil
 *
 * Measures the BACKLASH EFFECT of failed debates: when a topic fails to
 * become law, does its defeat inspire a surge of new debate in its category,
 * or does it die silently?
 *
 * An "Ignited" failure triggered a 3× or greater spike in category activity.
 * A "Stirred" failure triggered a 1.75–3× spike.
 * An "Echoed" failure triggered a 1.1–1.75× increase.
 * A "Silenced" failure saw little downstream change.
 *
 * Distinct from:
 *   /cascade    — measures post-law energy for SUCCESSFUL laws
 *   /graveyard  — lists failed topics with cause-of-death labels
 *   /groundswell — tracks dormant topics waking up independently
 *   /convergence — recent voter alignment vs. overall consensus
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  Ghost,
  RefreshCw,
  Scale,
  Skull,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RecoilTopic, RecoilResponse } from '@/app/api/recoil/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/20' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/20' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Ethics:      { text: 'text-for-300',       bg: 'bg-for-300/10',      border: 'border-for-300/20' },
  Philosophy:  { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/20' },
  Culture:     { text: 'text-against-300',   bg: 'bg-against-400/10',  border: 'border-against-400/20' },
  Health:      { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Education:   { text: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/20' },
}

const RECOIL_CONFIG: Record<RecoilTopic['recoil_class'], {
  label: string
  icon: typeof Flame
  color: string
  bg: string
  border: string
  ring: string
  description: string
}> = {
  ignited: {
    label: 'Ignited',
    icon: Zap,
    color: 'text-against-400',
    bg: 'bg-against-500/15',
    border: 'border-against-500/40',
    ring: 'ring-against-500/20',
    description: '3× surge in category debate after defeat',
  },
  stirred: {
    label: 'Stirred',
    icon: Flame,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/20',
    description: '1.75–3× uptick in debate activity',
  },
  echoed: {
    label: 'Echoed',
    icon: Waves,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    ring: 'ring-for-500/20',
    description: '1.1–1.75× ripple in the category',
  },
  silenced: {
    label: 'Silenced',
    icon: Ghost,
    color: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-300/40',
    ring: 'ring-surface-300/20',
    description: 'Category went quiet after defeat',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Bar chart for before/after comparison ────────────────────────────────────

function BeforeAfterBars({
  beforeVal,
  afterVal,
  beforeLabel,
  afterLabel,
}: {
  beforeVal: number
  afterVal: number
  beforeLabel: string
  afterLabel: string
}) {
  const max = Math.max(beforeVal, afterVal, 1)
  const beforePct = Math.round((beforeVal / max) * 100)
  const afterPct = Math.round((afterVal / max) * 100)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-surface-600 w-14 flex-shrink-0 text-right">{beforeLabel}</span>
        <div className="flex-1 h-3 rounded-full bg-surface-300/60 overflow-hidden">
          <div
            className="h-full rounded-full bg-surface-500 transition-all duration-500"
            style={{ width: `${beforePct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-surface-500 w-8 text-right tabular-nums">{beforeVal.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-against-400 w-14 flex-shrink-0 text-right">{afterLabel}</span>
        <div className="flex-1 h-3 rounded-full bg-surface-300/60 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-against-500"
            initial={{ width: 0 }}
            animate={{ width: `${afterPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[10px] font-mono text-against-400 w-8 text-right tabular-nums">{afterVal.toLocaleString()}</span>
      </div>
    </div>
  )
}

// ─── Recoil card ──────────────────────────────────────────────────────────────

function RecoilCard({ topic }: { topic: RecoilTopic }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = RECOIL_CONFIG[topic.recoil_class]
  const catCfg = CATEGORY_COLORS[topic.category] ?? { text: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-300/40' }
  const RecoilIcon = cfg.icon
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden transition-colors',
        expanded ? cfg.border : 'border-surface-300/60 hover:border-surface-400/60'
      )}
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="w-full text-left p-4 flex items-start gap-3"
      >
        {/* Recoil class badge */}
        <div className={cn(
          'flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0 mt-0.5',
          cfg.bg, cfg.border
        )}>
          <RecoilIcon className={cn('h-4 w-4', cfg.color)} aria-hidden />
        </div>

        <div className="flex-1 min-w-0">
          {/* Top row: category + recoil label */}
          <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
            <span className={cn(
              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold',
              catCfg.text, catCfg.bg
            )}>
              {topic.category}
            </span>
            <span className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-semibold',
              cfg.color, cfg.bg, cfg.border
            )}>
              <RecoilIcon className="h-2.5 w-2.5" aria-hidden />
              {cfg.label}
            </span>
            <span className="text-[10px] font-mono text-surface-600 ml-auto flex-shrink-0">
              {relativeTime(topic.failed_at)}
            </span>
          </div>

          {/* Statement */}
          <p className="text-sm font-mono text-white leading-snug line-clamp-2 mb-2">
            {topic.statement}
          </p>

          {/* Vote split */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
              <div
                className="h-full bg-for-600"
                style={{ width: `${forPct}%` }}
                aria-label={`${forPct}% voted for`}
              />
              <div
                className="h-full bg-against-600"
                style={{ width: `${againstPct}%` }}
                aria-label={`${againstPct}% voted against`}
              />
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono flex-shrink-0">
              <span className="text-for-400">{forPct}% for</span>
              <span className="text-surface-600">·</span>
              <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
            </div>
          </div>

          {/* Recoil score */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-surface-600">
              Recoil score: <span className={cn('font-bold', cfg.color)}>{topic.recoil_score.toFixed(2)}×</span>
            </span>
            <div className={cn('flex items-center gap-1 text-[10px] font-mono', cfg.color)}>
              {topic.recoil_score >= 1.1 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {topic.recoil_score >= 1.1
                ? `+${Math.round((topic.recoil_score - 1) * 100)}% activity`
                : 'activity fell'}
            </div>
          </div>
        </div>

        {/* Expand toggle */}
        <div className="flex-shrink-0 mt-1">
          {expanded
            ? <ChevronUp className="h-4 w-4 text-surface-500" aria-hidden />
            : <ChevronDown className="h-4 w-4 text-surface-500" aria-hidden />
          }
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn('px-4 pb-4 pt-0 border-t', cfg.border)}>
              <p className="text-[11px] font-mono text-surface-600 pt-3 mb-3 italic">
                {cfg.description}
              </p>

              <div className="grid grid-cols-2 gap-3 mb-3">
                {/* Votes */}
                <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3">
                  <p className="text-[10px] font-mono text-surface-600 mb-2">Category votes</p>
                  <BeforeAfterBars
                    beforeVal={topic.votes_before}
                    afterVal={topic.votes_after}
                    beforeLabel="Before"
                    afterLabel="After"
                  />
                </div>

                {/* New topics */}
                <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3">
                  <p className="text-[10px] font-mono text-surface-600 mb-2">New debates</p>
                  <BeforeAfterBars
                    beforeVal={topic.topics_before}
                    afterVal={topic.topics_after}
                    beforeLabel="Before"
                    afterLabel="After"
                  />
                </div>
              </div>

              <Link
                href={`/topic/${topic.topic_id}`}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                  'text-xs font-mono border transition-colors',
                  'bg-surface-200 text-surface-500 border-surface-300',
                  'hover:bg-surface-300 hover:text-white'
                )}
              >
                <ExternalLink className="h-3 w-3" aria-hidden />
                View topic
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RecoilSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function RecoilLegend() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 mb-4">
      <p className="text-[11px] font-mono text-surface-600 mb-3 uppercase tracking-widest">How to read this</p>
      <div className="grid grid-cols-2 gap-2">
        {(Object.entries(RECOIL_CONFIG) as [RecoilTopic['recoil_class'], typeof RECOIL_CONFIG[keyof typeof RECOIL_CONFIG]][]).map(([key, cfg]) => {
          const Icon = cfg.icon
          return (
            <div key={key} className="flex items-start gap-2">
              <span className={cn(
                'inline-flex items-center justify-center h-5 w-5 rounded flex-shrink-0 mt-0.5',
                cfg.bg
              )}>
                <Icon className={cn('h-3 w-3', cfg.color)} aria-hidden />
              </span>
              <div>
                <p className={cn('text-[10px] font-mono font-semibold', cfg.color)}>{cfg.label}</p>
                <p className="text-[10px] font-mono text-surface-600 leading-tight">{cfg.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RecoilClient() {
  const [data, setData] = useState<RecoilResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [category, setCategory] = useState<string>('All')
  const [showLegend, setShowLegend] = useState(false)

  const load = useCallback(async (cat: string) => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams()
      if (cat !== 'All') params.set('category', cat)
      const res = await fetch(`/api/recoil?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json: RecoilResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(category)
  }, [load, category])

  const catCounts = data
    ? Object.fromEntries(
        CATEGORIES.slice(1).map((cat) => [
          cat,
          data.topics.filter((t) => t.category === cat).length,
        ])
      )
    : {}

  const filteredTopics = data?.topics ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Skull className="h-5 w-5 text-against-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white">The Civic Recoil</h1>
              <p className="text-xs font-mono text-surface-500">
                When debates die — do they inspire new ones?
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowLegend((v) => !v)}
                aria-label="Toggle legend"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" aria-hidden />
                Guide
              </button>
              <button
                onClick={() => load(category)}
                aria-label="Refresh"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Refresh
              </button>
            </div>
          </div>

          <p className="text-xs font-mono text-surface-600 leading-relaxed bg-surface-100 border border-surface-300/60 rounded-xl px-4 py-3">
            Each failed debate is measured: how many new topics were proposed and votes cast in its
            category in the 7 days <em>before</em> vs <em>after</em> failure. A high recoil score
            means defeat lit a fire — the community responded with renewed civic energy.
          </p>
        </div>

        {/* ── Legend (togglable) ─────────────────────────────────────────── */}
        <AnimatePresence>
          {showLegend && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <RecoilLegend />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stats strip ────────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              {
                label: 'Total failed',
                value: data.topics.length,
                icon: Skull,
                color: 'text-surface-500',
              },
              {
                label: 'Ignited',
                value: data.topics.filter((t) => t.recoil_class === 'ignited').length,
                icon: Zap,
                color: 'text-against-400',
              },
              {
                label: 'Stirred',
                value: data.topics.filter((t) => t.recoil_class === 'stirred').length,
                icon: Flame,
                color: 'text-gold',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl bg-surface-100 border border-surface-300/60 px-3 py-2.5 text-center">
                <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} aria-hidden />
                <p className={cn('text-base font-mono font-bold', color)}>{value}</p>
                <p className="text-[10px] font-mono text-surface-600">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Category filter ─────────────────────────────────────────────── */}
        <div
          className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none"
          role="group"
          aria-label="Filter by category"
        >
          {CATEGORIES.map((cat) => {
            const active = category === cat
            const count = cat === 'All' ? (data?.topics.length ?? 0) : (catCounts[cat] ?? 0)
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                aria-pressed={active}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold border transition-all whitespace-nowrap',
                  active
                    ? 'bg-against-600/20 border-against-500/50 text-against-400'
                    : 'bg-surface-200 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {cat}
                {count > 0 && (
                  <span className={cn(
                    'text-[10px] tabular-nums',
                    active ? 'text-against-500' : 'text-surface-600'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {loading ? (
          <RecoilSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-8 text-center">
            <Scale className="h-8 w-8 text-surface-500 mx-auto mb-3" aria-hidden />
            <p className="font-mono text-sm text-white mb-1">Failed to load</p>
            <p className="font-mono text-xs text-surface-500 mb-4">Could not fetch recoil data.</p>
            <button
              onClick={() => load(category)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-xs font-mono text-white border border-surface-300 hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Retry
            </button>
          </div>
        ) : filteredTopics.length === 0 ? (
          <EmptyState
            icon={Ghost}
            title="No failed debates found"
            description={
              category === 'All'
                ? "No failed topics to measure yet — the community hasn't reached any dead ends."
                : `No failed ${category} debates yet. Try a different category.`
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredTopics.map((topic) => (
              <RecoilCard key={topic.topic_id} topic={topic} />
            ))}

            {/* Footer note */}
            {data && (
              <p className="text-[10px] font-mono text-surface-700 text-center pt-2">
                Showing {filteredTopics.length} failed debate{filteredTopics.length !== 1 ? 's' : ''} ·
                {' '}7-day before/after window ·
                {' '}Updated {relativeTime(data.generated_at)}
              </p>
            )}
          </div>
        )}

        {/* ── Related links ───────────────────────────────────────────────── */}
        {!loading && !error && (
          <div className="mt-6 pt-4 border-t border-surface-300/60">
            <p className="text-[10px] font-mono text-surface-600 mb-2 uppercase tracking-widest">Related</p>
            <div className="flex flex-wrap gap-2">
              {[
                { href: '/cascade', label: 'Law Cascade', desc: 'Post-law energy for successes' },
                { href: '/graveyard', label: 'Graveyard', desc: 'All failed topics' },
                { href: '/groundswell', label: 'Groundswell', desc: 'Dormant topics awakening' },
              ].map(({ href, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex flex-col px-3 py-2 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/80 transition-colors group"
                >
                  <span className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors">{label}</span>
                  <span className="text-[10px] font-mono text-surface-600">{desc}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
