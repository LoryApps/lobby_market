'use client'

/**
 * /law/[id]/blueprint — Civic Law Implementation Blueprint
 *
 * AI-generated implementation plan for an established Codex law.
 * Covers phases, stakeholders, resources, challenges, success metrics,
 * and international policy comparisons.
 *
 * Distinct from:
 *   /law/[id]/impact  — vote timeline + community stats (data-driven)
 *   /simulate         — hypothetical outcomes for un-passed topics
 *   /law/[id]/graph   — knowledge-graph of connected laws
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Gavel,
  Globe,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { BlueprintNotes } from '@/components/law/BlueprintNotes'
import { cn } from '@/lib/utils/cn'
import type {
  BlueprintResponse,
  LawBlueprint,
  BlueprintStep,
  BlueprintStakeholder,
  BlueprintComparison,
} from '@/app/api/laws/[id]/blueprint/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Outlook config ───────────────────────────────────────────────────────────

const OUTLOOK_CONFIG: Record<LawBlueprint['overall_outlook'], {
  label: string
  icon: typeof TrendingUp
  text: string
  bg: string
  border: string
}> = {
  optimistic: {
    label: 'Optimistic',
    icon: TrendingUp,
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
  cautious: {
    label: 'Cautious',
    icon: Scale,
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  challenging: {
    label: 'Challenging',
    icon: TrendingDown,
    text: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  uncertain: {
    label: 'Uncertain',
    icon: AlertCircle,
    text: 'text-surface-400',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
  },
}

// ─── Impact config ────────────────────────────────────────────────────────────

const IMPACT_CONFIG: Record<BlueprintStakeholder['impact'], {
  icon: typeof ThumbsUp
  text: string
  bg: string
  border: string
}> = {
  positive: { icon: ThumbsUp,   text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  negative: { icon: ThumbsDown, text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  mixed:    { icon: Scale,      text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  neutral:  { icon: Users,      text: 'text-surface-400', bg: 'bg-surface-200',    border: 'border-surface-300'    },
}

// ─── Feasibility ring ─────────────────────────────────────────────────────────

function FeasibilityRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? '#10b981' : score >= 45 ? '#c9a84c' : '#ef4444'

  return (
    <div className="relative flex items-center justify-center h-24 w-24">
      <svg viewBox="0 0 88 88" className="absolute inset-0 -rotate-90">
        <circle cx="44" cy="44" r="36" fill="none" stroke="#1e2430" strokeWidth="8" />
        <motion.circle
          cx="44"
          cy="44"
          r="36"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="text-center">
        <div className="text-2xl font-mono font-bold text-white tabular-nums">{score}</div>
        <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">/ 100</div>
      </div>
    </div>
  )
}

// ─── Phase step card ──────────────────────────────────────────────────────────

function PhaseCard({ step, index, total }: { step: BlueprintStep; index: number; total: number }) {
  const [expanded, setExpanded] = useState(index === 0)
  const phaseColors = [
    'bg-for-500/20 border-for-500/40 text-for-300',
    'bg-purple/20 border-purple/40 text-purple',
    'bg-gold/20 border-gold/40 text-gold',
    'bg-emerald/20 border-emerald/40 text-emerald',
    'bg-against-500/20 border-against-500/40 text-against-300',
  ]
  const color = phaseColors[index % phaseColors.length]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-200/50 transition-colors"
        aria-expanded={expanded}
      >
        <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg border flex-shrink-0 text-xs font-mono font-bold', color)}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-surface-500 uppercase tracking-wide">{step.phase}</span>
            {step.duration && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-surface-600">
                <Clock className="h-2.5 w-2.5" />
                {step.duration}
              </span>
            )}
          </div>
          <p className="text-sm font-mono font-semibold text-white truncate">{step.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] font-mono text-surface-500">{step.actions.length} steps</span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-surface-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-surface-500" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-surface-300">
              <ul className="space-y-2 mt-3">
                {step.actions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-mono text-surface-300 leading-snug">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {index < total - 1 && (
        <div className="flex justify-center py-1">
          <ArrowRight className="h-3.5 w-3.5 text-surface-600 rotate-90" />
        </div>
      )}
    </motion.div>
  )
}

// ─── Stakeholder row ──────────────────────────────────────────────────────────

function StakeholderRow({ s }: { s: BlueprintStakeholder }) {
  const cfg = IMPACT_CONFIG[s.impact]
  const ImpactIcon = cfg.icon

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
      <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg border flex-shrink-0', cfg.bg, cfg.border)}>
        <ImpactIcon className={cn('h-4 w-4', cfg.text)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-mono font-semibold text-white">{s.group}</span>
          <span className={cn('text-[10px] font-mono uppercase tracking-wide font-bold', cfg.text)}>
            {s.impact}
          </span>
        </div>
        <p className="text-xs font-mono text-surface-400 leading-relaxed">{s.description}</p>
      </div>
    </div>
  )
}

// ─── Comparison row ───────────────────────────────────────────────────────────

function ComparisonRow({ c }: { c: BlueprintComparison }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/20 flex-shrink-0">
        <Globe className="h-4 w-4 text-for-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-mono font-bold text-white">{c.jurisdiction}</span>
          <span className="text-xs font-mono text-surface-500">·</span>
          <span className="text-xs font-mono text-surface-400 truncate">{c.policy}</span>
        </div>
        <p className="text-xs font-mono text-surface-400 leading-relaxed">{c.outcome}</p>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BlueprintSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-24 w-24 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </div>
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <Skeleton className="h-4 w-1/4 mb-3" />
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawBlueprintPage() {
  const { id } = useParams<{ id: string }>()

  const [data, setData] = useState<BlueprintResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/blueprint`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as BlueprintResponse)
    } catch {
      setError('Failed to load blueprint')
    } finally {
      setLoading(false)
    }
  }, [id])

  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/blueprint`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Generation failed')
      }
      setData(await res.json() as BlueprintResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const law = data?.law
  const blueprint = data?.blueprint
  const unavailable = data?.unavailable

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Back */}
        <div className="mb-5">
          <Link
            href={`/law/${id}`}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Law
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
              <Gavel className="h-4 w-4 text-gold" />
            </div>
            <span className="text-xs font-mono font-bold text-gold uppercase tracking-widest">
              Implementation Blueprint
            </span>
          </div>
          {law ? (
            <h1 className="text-xl font-mono font-bold text-white leading-snug mb-1">
              {law.statement}
            </h1>
          ) : (
            <Skeleton className="h-7 w-3/4 mb-1" />
          )}
          {law && (
            <div className="flex items-center flex-wrap gap-2 mt-2">
              {law.category && (
                <Badge variant="proposed" size="sm">{law.category}</Badge>
              )}
              <span className="text-xs font-mono text-surface-500">
                {Math.round(law.blue_pct ?? 66)}% consensus · {(law.total_votes ?? 0).toLocaleString()} votes
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <BlueprintSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-6 text-center">
            <AlertCircle className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="text-sm font-mono text-against-400 mb-4">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : unavailable ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <Sparkles className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <p className="text-base font-mono font-bold text-white mb-1">AI analysis unavailable</p>
            <p className="text-sm font-mono text-surface-500">
              Blueprint generation requires an AI connection. Check back later.
            </p>
          </div>
        ) : !blueprint ? (
          /* Generate CTA */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center"
          >
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gold/10 border border-gold/30 mx-auto mb-4">
              <Sparkles className="h-7 w-7 text-gold" />
            </div>
            <h2 className="text-lg font-mono font-bold text-white mb-2">
              Generate Implementation Blueprint
            </h2>
            <p className="text-sm font-mono text-surface-400 mb-6 max-w-sm mx-auto leading-relaxed">
              AI analysis of how this consensus law could be put into practice — phases,
              stakeholders, resources, challenges, and international comparisons.
            </p>
            <button
              onClick={generate}
              disabled={generating}
              className={cn(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl',
                'bg-gold text-surface-50 font-mono font-bold text-sm',
                'hover:bg-amber-400 transition-colors disabled:opacity-60 disabled:cursor-wait'
              )}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Blueprint
                </>
              )}
            </button>
            <p className="text-[11px] font-mono text-surface-600 mt-3">
              Takes ~10 seconds · Cached for future visits
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Feasibility + Outlook + Summary */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <div className="flex gap-5 items-start">
                {/* Feasibility ring */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                  <FeasibilityRing score={blueprint.feasibility_score} />
                  <div className="text-center">
                    <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">
                      Feasibility
                    </p>
                    <p className="text-xs font-mono font-bold text-white mt-0.5">
                      {blueprint.feasibility_label}
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    {(() => {
                      const cfg = OUTLOOK_CONFIG[blueprint.overall_outlook]
                      const Icon = cfg.icon
                      return (
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-mono font-bold uppercase tracking-wide',
                          cfg.text, cfg.bg, cfg.border
                        )}>
                          <Icon className="h-3 w-3" />
                          {cfg.label} Outlook
                        </span>
                      )
                    })()}
                  </div>
                  <p className="text-sm font-mono text-surface-300 leading-relaxed">{blueprint.summary}</p>
                  {data.generated_at && (
                    <p className="text-[11px] font-mono text-surface-600 mt-2">
                      Generated {relativeTime(data.generated_at)}
                    </p>
                  )}
                </div>
              </div>

              {/* Regenerate */}
              <div className="mt-4 pt-4 border-t border-surface-300">
                <button
                  onClick={generate}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {generating ? 'Regenerating…' : 'Regenerate analysis'}
                </button>
              </div>
            </motion.div>

            {/* Implementation Phases */}
            {blueprint.steps.length > 0 && (
              <div>
                <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5" />
                  Implementation Phases
                </h2>
                <div className="space-y-2">
                  {blueprint.steps.map((step, i) => (
                    <PhaseCard key={i} step={step} index={i} total={blueprint.steps.length} />
                  ))}
                </div>
              </div>
            )}

            {/* Stakeholders */}
            {blueprint.stakeholders.length > 0 && (
              <div>
                <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  Stakeholders
                </h2>
                <div className="space-y-2">
                  {blueprint.stakeholders.map((s, i) => (
                    <StakeholderRow key={i} s={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Resources + Challenges grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {blueprint.resources.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BarChart2 className="h-3.5 w-3.5" />
                    Resources Required
                  </h2>
                  <ul className="space-y-2">
                    {blueprint.resources.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Target className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs font-mono text-surface-300 leading-snug">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {blueprint.challenges.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Challenges
                  </h2>
                  <ul className="space-y-2">
                    {blueprint.challenges.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertCircle className="h-3.5 w-3.5 text-against-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs font-mono text-surface-300 leading-snug">{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Success Metrics */}
            {blueprint.metrics.length > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Success Metrics
                </h2>
                <ul className="space-y-2">
                  {blueprint.metrics.map((m, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald flex-shrink-0 mt-0.5" />
                      <span className="text-sm font-mono text-surface-300 leading-snug">{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* International Comparisons */}
            {blueprint.comparisons.length > 0 && (
              <div>
                <h2 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  International Comparisons
                </h2>
                <div className="space-y-2">
                  {blueprint.comparisons.map((c, i) => (
                    <ComparisonRow key={i} c={c} />
                  ))}
                </div>
              </div>
            )}

            {/* Community Notes */}
            <BlueprintNotes lawId={id} />

            {/* Bottom links */}
            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                href={`/law/${id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Gavel className="h-3.5 w-3.5" />
                View Law
              </Link>
              <Link
                href={`/law/${id}/impact`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Impact data
              </Link>
              <Link
                href="/simulate"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Policy Simulator
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
