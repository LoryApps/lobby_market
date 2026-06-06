'use client'

/**
 * /weight — The Civic Weight Index
 *
 * Ranks every active debate by its composite "civic weight" — a single score
 * answering the question: "How much does this topic MATTER right now?"
 *
 * Four signals are combined into one index:
 *   • Stakes (40%)    — scope multiplier: Global (4×) > National (3×) > Regional (2×) > Local (1×)
 *   • Engagement (30%) — total vote participation (sqrt-scaled to avoid outlier dominance)
 *   • Urgency (20%)   — how contested (50/50 = maximum; unanimous = minimum)
 *   • Depth (10%)     — argument density per debate (log-scaled)
 *
 * Tiers:
 *   Critical ≥70 — maximum civic importance; these debates shape the Codex
 *   Major    ≥45 — high-stakes, actively contested, needs civic attention
 *   Notable  ≥20 — worth engaging with; real stakes on the table
 *   Local    <20 — emerging or lower-scope debates
 *
 * Distinct from:
 *   /trending     — raw popularity (vote rate)
 *   /traction     — acceleration of engagement (momentum derivative)
 *   /tipping-point — proximity to the consensus threshold
 *   /momentum     — direction of the opinion shift (FOR vs. AGAINST)
 *   /seismic      — anomaly spikes (sudden vs. sustained weight)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Gavel,
  Globe,
  Info,
  MapPin,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { WeightTopic, WeightResponse } from '@/app/api/topics/weight/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<WeightTopic['tier'], {
  label: string
  color: string
  bg: string
  border: string
  bar: string
  glow: string
}> = {
  critical: {
    label:  'Critical',
    color:  'text-against-400',
    bg:     'bg-against-500/10',
    border: 'border-against-500/40',
    bar:    'bg-against-500',
    glow:   'bg-against-500/5',
  },
  major: {
    label:  'Major',
    color:  'text-gold',
    bg:     'bg-gold/10',
    border: 'border-gold/40',
    bar:    'bg-gold',
    glow:   'bg-gold/5',
  },
  notable: {
    label:  'Notable',
    color:  'text-for-400',
    bg:     'bg-for-500/10',
    border: 'border-for-500/40',
    bar:    'bg-for-500',
    glow:   'bg-for-500/5',
  },
  local: {
    label:  'Local',
    color:  'text-emerald',
    bg:     'bg-emerald/10',
    border: 'border-emerald/40',
    bar:    'bg-emerald',
    glow:   'bg-emerald/5',
  },
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  Economics:   'text-gold        border-gold/40        bg-gold/10',
  Politics:    'text-for-400     border-for-500/40     bg-for-500/10',
  Technology:  'text-purple      border-purple/40      bg-purple/10',
  Science:     'text-emerald     border-emerald/40     bg-emerald/10',
  Ethics:      'text-amber-400   border-amber-500/40   bg-amber-500/10',
  Philosophy:  'text-purple      border-purple/40      bg-purple/10',
  Culture:     'text-against-400 border-against-500/40 bg-against-500/10',
  Health:      'text-emerald     border-emerald/40     bg-emerald/10',
  Environment: 'text-emerald     border-emerald/40     bg-emerald/10',
  Education:   'text-gold        border-gold/40        bg-gold/10',
}

function catClass(cat: string | null): string {
  return CAT_COLORS[cat ?? ''] ?? 'text-surface-500 border-surface-400 bg-surface-300/40'
}

// ─── Scope icon ───────────────────────────────────────────────────────────────

function ScopeIcon({ scope, className }: { scope: string | null; className?: string }) {
  const Icon = scope === 'Global'   ? Globe :
               scope === 'National' ? Shield :
               scope === 'Regional' ? MapPin :
               scope === 'Local'    ? MapPin : Activity
  return <Icon className={cn('w-3 h-3', className)} />
}

const SCOPE_MULT_LABEL: Record<string, string> = {
  Global: '4×', National: '3×', Regional: '2×', Local: '1×',
}

// ─── Status badge map ─────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active:   'Active',
  voting:   'Voting',
}

// ─── Weight bar ───────────────────────────────────────────────────────────────

function WeightBar({ score, tier }: { score: number; tier: WeightTopic['tier'] }) {
  const cfg = TIER_CONFIG[tier]
  return (
    <div className="h-1.5 bg-surface-300/60 rounded-full overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full', cfg.bar)}
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}

// ─── Breakdown pill ───────────────────────────────────────────────────────────

function BreakdownPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Vote
  label: string
  value: string
  color: string
}) {
  return (
    <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono font-semibold', color)}>
      <Icon className="w-3 h-3" />
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({ topic, rank }: { topic: WeightTopic; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = TIER_CONFIG[topic.tier]
  const forPct  = Math.round(topic.blue_pct)
  const agstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04, duration: 0.3 }}
      className={cn(
        'rounded-xl border p-4 transition-colors',
        cfg.glow,
        cfg.border,
        'hover:border-opacity-70',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Rank */}
        <span className="flex-shrink-0 w-6 text-center text-xs font-mono font-bold text-surface-500 mt-0.5">
          {rank}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Tier + category + scope */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono font-semibold', cfg.color, cfg.bg, cfg.border)}>
              <Zap className="w-2.5 h-2.5" />
              {cfg.label}
            </span>
            {topic.category && (
              <span className={cn('px-2 py-0.5 rounded-md border text-[11px] font-mono', catClass(topic.category))}>
                {topic.category}
              </span>
            )}
            {topic.scope && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-surface-400/30 bg-surface-300/30 text-[11px] font-mono text-surface-400">
                <ScopeIcon scope={topic.scope} />
                {topic.scope}
              </span>
            )}
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
              {STATUS_LABEL[topic.status] ?? topic.status}
            </Badge>
          </div>

          {/* Statement */}
          <Link
            href={`/topic/${topic.id}`}
            className="block text-sm font-semibold text-white hover:text-for-300 transition-colors leading-snug mb-2"
          >
            {topic.statement}
          </Link>

          {/* Weight bar */}
          <WeightBar score={topic.weight_score} tier={topic.tier} />

          {/* Score + vote split */}
          <div className="flex items-center justify-between mt-1.5">
            <span className={cn('text-xs font-mono font-bold', cfg.color)}>
              {topic.weight_score} / 100
            </span>
            <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
              <span className="flex items-center gap-0.5 text-for-400">
                <ThumbsUp className="w-3 h-3" />{forPct}%
              </span>
              <span className="flex items-center gap-0.5 text-against-400">
                <ThumbsDown className="w-3 h-3" />{agstPct}%
              </span>
              <span className="flex items-center gap-0.5">
                <Vote className="w-3 h-3" />{topic.total_votes.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Breakdown toggle */}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 mt-2 text-[11px] font-mono text-surface-500 hover:text-surface-400 transition-colors"
            aria-expanded={expanded}
            aria-label="Toggle weight breakdown"
          >
            <Info className="w-3 h-3" />
            Weight breakdown
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Breakdown pills */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <BreakdownPill
                    icon={Globe}
                    label="scope"
                    value={SCOPE_MULT_LABEL[topic.scope ?? ''] ?? '1.5×'}
                    color="text-for-300 border-for-500/30 bg-for-500/10"
                  />
                  <BreakdownPill
                    icon={Vote}
                    label="votes"
                    value={topic.total_votes.toLocaleString()}
                    color="text-purple border-purple/30 bg-purple/10"
                  />
                  <BreakdownPill
                    icon={Scale}
                    label="contest"
                    value={`${Math.round(topic.contested_factor * 100)}%`}
                    color="text-against-400 border-against-500/30 bg-against-500/10"
                  />
                  <BreakdownPill
                    icon={MessageSquare}
                    label="args"
                    value={topic.argument_count.toString()}
                    color="text-gold border-gold/30 bg-gold/10"
                  />
                  <BreakdownPill
                    icon={Activity}
                    label="7d"
                    value={topic.votes_7d.toLocaleString()}
                    color="text-emerald border-emerald/30 bg-emerald/10"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Link arrow */}
        <Link
          href={`/topic/${topic.id}`}
          aria-label={`Go to topic: ${topic.statement}`}
          className="flex-shrink-0 p-1.5 rounded-lg bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-200 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5 text-surface-500" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Category summary row ─────────────────────────────────────────────────────

function CategoryRow({ cat }: { cat: { category: string; avg_weight: number; count: number } }) {
  const tier = cat.avg_weight >= 70 ? 'critical' :
               cat.avg_weight >= 45 ? 'major' :
               cat.avg_weight >= 20 ? 'notable' : 'local'
  const cfg = TIER_CONFIG[tier]

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border', cfg.glow, cfg.border)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn('text-sm font-semibold', cfg.color)}>{cat.category}</span>
          <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
            <span>{cat.count} {cat.count === 1 ? 'topic' : 'topics'}</span>
            <span className={cn('font-bold', cfg.color)}>{cat.avg_weight}</span>
          </div>
        </div>
        <WeightBar score={cat.avg_weight} tier={tier} />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'ranked' | 'categories'

const TIER_FILTERS: { id: WeightTopic['tier'] | 'all'; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'major',    label: 'Major' },
  { id: 'notable',  label: 'Notable' },
  { id: 'local',    label: 'Local' },
]

export function WeightClient() {
  const [data, setData]           = useState<WeightResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [tab, setTab]             = useState<Tab>('ranked')
  const [tierFilter, setTierFilter] = useState<WeightTopic['tier'] | 'all'>('all')
  const [catFilter, setCatFilter] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/topics/weight')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: WeightResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const categories = data
    ? Array.from(new Set(data.topics.map((t) => t.category).filter(Boolean) as string[])).sort()
    : []

  const filtered = (data?.topics ?? []).filter((t) => {
    if (tierFilter !== 'all' && t.tier !== tierFilter) return false
    if (catFilter && t.category !== catFilter) return false
    return true
  })

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-against-400" />
              <h1 className="text-xl font-bold text-white tracking-tight">Civic Weight Index</h1>
            </div>
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh weight index"
              className="p-1.5 rounded-lg border border-surface-300/60 bg-surface-200/60 hover:border-surface-400/60 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4 text-surface-400', loading && 'animate-spin')} />
            </button>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed">
            Active debates ranked by composite civic importance — scope, engagement, urgency, and argument depth combined into one score.
          </p>
          {data && (
            <p className="text-[11px] font-mono text-surface-600 mt-1">
              {data.topics.length} topics · updated {new Date(data.generated_at).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-200/60 border border-surface-300/40 mb-5">
          {(['ranked', 'categories'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                tab === t
                  ? 'bg-surface-300/80 text-white border border-surface-400/40'
                  : 'text-surface-500 hover:text-surface-400',
              )}
            >
              {t === 'ranked' ? (
                <><BarChart2 className="w-3.5 h-3.5" />Ranked</>
              ) : (
                <><BookOpen className="w-3.5 h-3.5" />By Category</>
              )}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-5">
          {Object.entries(TIER_CONFIG).map(([tier, cfg]) => (
            <div
              key={tier}
              className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold', cfg.color, cfg.bg, cfg.border)}
            >
              <Zap className="w-2.5 h-2.5" />
              {cfg.label}
            </div>
          ))}
        </div>

        {tab === 'ranked' && (
          <>
            {/* Tier filter */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {TIER_FILTERS.map((f) => {
                const active = tierFilter === f.id
                const cfg = f.id !== 'all' ? TIER_CONFIG[f.id] : null
                return (
                  <button
                    key={f.id}
                    onClick={() => setTierFilter(f.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold transition-all',
                      active
                        ? cfg
                          ? cn(cfg.color, cfg.bg, cfg.border)
                          : 'bg-surface-300 text-white border-surface-400'
                        : 'text-surface-500 border-surface-300/40 hover:border-surface-400/40',
                    )}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>

            {/* Category filter */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                <button
                  onClick={() => setCatFilter(null)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold transition-all',
                    !catFilter
                      ? 'bg-surface-300 text-white border-surface-400'
                      : 'text-surface-500 border-surface-300/40 hover:border-surface-400/40',
                  )}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCatFilter(cat === catFilter ? null : cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold transition-all',
                      catFilter === cat
                        ? catClass(cat)
                        : 'text-surface-500 border-surface-300/40 hover:border-surface-400/40',
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Gavel}
            title="Index unavailable"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        ) : tab === 'ranked' ? (
          filtered.length === 0 ? (
            <EmptyState
              icon={BarChart2}
              title="No topics match"
              description="Try adjusting the tier or category filter."
              action={{ label: 'Clear filters', onClick: () => { setTierFilter('all'); setCatFilter(null) } }}
            />
          ) : (
            <div className="space-y-3">
              {filtered.map((t, i) => (
                <TopicCard key={t.id} topic={t} rank={i + 1} />
              ))}
            </div>
          )
        ) : (
          /* Categories tab */
          data && data.category_weights.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No categories yet"
              description="Weight data will appear once topics accumulate votes."
            />
          ) : (
            <div className="space-y-3">
              {(data?.category_weights ?? []).map((cat) => (
                <CategoryRow key={cat.category} cat={cat} />
              ))}
            </div>
          )
        )}

        {/* Footer note */}
        {!loading && !error && data && (
          <p className="mt-8 text-[11px] font-mono text-surface-600 text-center leading-relaxed">
            Weight = scope × √votes × contestedness × argument depth × recency.
            <br />
            100 = the maximum observed civic weight on the platform today.
          </p>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
