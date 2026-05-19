'use client'

/**
 * /tensions — The Civic Tensions Report
 *
 * Surfaces pairs of established laws that may pull in opposing directions
 * on key policy dimensions (spending, regulation, social contract, governance
 * scope). Not every pair is a true contradiction — some can be reconciled
 * through context, nuance, or judicial interpretation — but flagging them
 * invites the community to think critically about the coherence of its
 * collective decisions.
 *
 * Distinct from:
 *   /law/graph    — shows source→topic→law provenance chains
 *   /law/compare  — side-by-side comparison of two specific laws
 *   /consensus    — convergence of opinion on individual topics
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Filter,
  Gavel,
  Info,
  RefreshCw,
  Scale,
  Swords,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawTension, TensionsResponse } from '@/app/api/law/tensions/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

const TENSION_TYPE_CONFIG: Record<LawTension['tension_type'], {
  label: string
  icon: typeof Scale
  color: string
  bg: string
  border: string
  description: string
}> = {
  spending: {
    label: 'Spending',
    icon: TrendingUp,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'One law advocates expansion while the other calls for restraint',
  },
  regulation: {
    label: 'Regulation',
    icon: Scale,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description: 'One law tightens rules while the other favors lighter intervention',
  },
  social: {
    label: 'Social Contract',
    icon: Swords,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    description: 'One law prioritises collective goods; the other emphasises individual choice',
  },
  governance: {
    label: 'Governance',
    icon: Gavel,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    description: 'One law centralises authority while the other devolves power',
  },
  scope: {
    label: 'Scope',
    icon: Zap,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    description: 'One law broadens reach while the other narrows focus',
  },
}

const ALL_TYPES = ['all', 'spending', 'regulation', 'social', 'governance', 'scope'] as const
type TypeFilter = typeof ALL_TYPES[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d < 1) return 'today'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function tensionBand(score: number): { label: string; color: string; width: string } {
  if (score >= 6) return { label: 'High', color: 'text-against-400 bg-against-500/20 border-against-500/40', width: 'w-full' }
  if (score >= 4) return { label: 'Moderate', color: 'text-gold bg-gold/20 border-gold/40', width: 'w-3/4' }
  return { label: 'Low', color: 'text-surface-400 bg-surface-300/20 border-surface-400/30', width: 'w-1/2' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LawPill({ law, side }: { law: LawTension['law_a']; side: 'a' | 'b' }) {
  return (
    <Link href={`/law/${law.id}`}>
      <div
        className={cn(
          'group flex flex-col gap-2 rounded-xl border p-4 transition-all hover:brightness-110 cursor-pointer',
          side === 'a'
            ? 'bg-for-500/5 border-for-500/25 hover:border-for-500/50'
            : 'bg-against-500/5 border-against-500/25 hover:border-against-500/50',
        )}
      >
        <div className="flex items-center gap-2">
          {side === 'a' ? (
            <TrendingUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
          )}
          <span
            className={cn(
              'text-[10px] font-mono font-bold uppercase tracking-widest',
              side === 'a' ? 'text-for-400' : 'text-against-400',
            )}
          >
            {side === 'a' ? 'Expansionary' : 'Contractionary'}
          </span>
          {law.category && (
            <span className={cn('ml-auto text-[10px] font-mono font-semibold', CATEGORY_COLORS[law.category] ?? 'text-surface-400')}>
              {law.category}
            </span>
          )}
        </div>
        <p className="text-sm font-mono text-white leading-snug group-hover:text-white">
          {truncate(law.statement, 120)}
        </p>
        <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
          <span className="flex items-center gap-1">
            <Gavel className="h-3 w-3" />
            Law
          </span>
          <span>{Math.round(law.blue_pct)}% FOR · {law.total_votes.toLocaleString()} votes</span>
          <span className="ml-auto flex items-center gap-1 text-surface-600 group-hover:text-surface-400 transition-colors">
            <ExternalLink className="h-3 w-3" />
            View
          </span>
        </div>
      </div>
    </Link>
  )
}

function TensionCard({ tension, defaultExpanded = false }: { tension: LawTension; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const cfg = TENSION_TYPE_CONFIG[tension.tension_type]
  const TypeIcon = cfg.icon
  const band = tensionBand(tension.tension_score)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-4 p-5 text-left hover:bg-surface-200/40 transition-colors"
        aria-expanded={expanded}
      >
        {/* Type icon */}
        <div
          className={cn(
            'flex items-center justify-center h-10 w-10 rounded-xl border flex-shrink-0 mt-0.5',
            cfg.bg,
            cfg.border,
          )}
        >
          <TypeIcon className={cn('h-5 w-5', cfg.color)} aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border',
                cfg.bg, cfg.border, cfg.color,
              )}
            >
              <TypeIcon className="h-3 w-3" />
              {cfg.label}
            </span>

            {tension.shared_domain !== 'general' && (
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold border bg-surface-200 border-surface-300 text-surface-400 capitalize">
                {tension.shared_domain}
              </span>
            )}

            <span
              className={cn(
                'px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold border',
                band.color,
              )}
            >
              {band.label} tension
            </span>
          </div>

          {/* Summary */}
          <p className="text-xs font-mono text-surface-400 leading-relaxed line-clamp-2">
            {truncate(tension.law_a.statement, 80)} ← vs → {truncate(tension.law_b.statement, 80)}
          </p>
        </div>

        <div className="flex-shrink-0 mt-2">
          {expanded
            ? <ChevronUp className="h-4 w-4 text-surface-500" />
            : <ChevronDown className="h-4 w-4 text-surface-500" />
          }
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-surface-300/60 pt-4">
              {/* Type description */}
              <p className="text-xs font-mono text-surface-500 italic">{cfg.description}</p>

              {/* The two laws side by side (stacked on mobile) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <LawPill law={tension.law_a} side="a" />
                <LawPill law={tension.law_b} side="b" />
              </div>

              {/* Detected keywords */}
              {(tension.keywords_a.length > 0 || tension.keywords_b.length > 0) && (
                <div className="flex flex-wrap gap-3 pt-1">
                  {tension.keywords_a.slice(0, 4).map((kw) => (
                    <span key={kw} className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-for-500/10 text-for-300 border border-for-500/20">
                      +{kw}
                    </span>
                  ))}
                  {tension.keywords_b.slice(0, 4).map((kw) => (
                    <span key={kw} className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-against-500/10 text-against-300 border border-against-500/20">
                      −{kw}
                    </span>
                  ))}
                </div>
              )}

              {/* Nuance note */}
              <div className="flex items-start gap-2.5 rounded-xl bg-surface-200 border border-surface-300 px-4 py-3">
                <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                  These laws were each passed by community vote and reflect genuine consensus. A tension here doesn&apos;t mean one is wrong — context, scope, and judicial interpretation may reconcile them.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TensionsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-lg" />
                <Skeleton className="h-5 w-16 rounded-lg" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Coherence meter ──────────────────────────────────────────────────────────

function CoherenceMeter({ score, tensionCount, lawCount }: { score: number; tensionCount: number; lawCount: number }) {
  const color = score >= 80 ? 'text-emerald' : score >= 60 ? 'text-gold' : 'text-against-400'
  const barColor = score >= 80 ? 'bg-emerald' : score >= 60 ? 'bg-gold' : 'bg-against-500'
  const label = score >= 80 ? 'High Coherence' : score >= 60 ? 'Some Tensions Detected' : 'Multiple Tensions Found'

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-surface-200 border border-surface-300 flex-shrink-0">
          <BarChart2 className="h-5 w-5 text-surface-400" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-mono text-surface-500 uppercase tracking-widest">Codex Coherence</p>
          <p className={cn('font-mono text-lg font-bold leading-tight', color)}>{label}</p>
        </div>
        <span className={cn('ml-auto font-mono text-3xl font-bold tabular-nums', color)}>
          {score}
        </span>
      </div>

      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 pt-1 border-t border-surface-300/60">
        <div className="text-center">
          <p className="font-mono text-base font-bold text-white">{lawCount}</p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">Laws</p>
        </div>
        <div className="text-center">
          <p className={cn('font-mono text-base font-bold', tensionCount > 0 ? 'text-against-400' : 'text-emerald')}>
            {tensionCount}
          </p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">Tensions</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-base font-bold text-white">
            {lawCount > 1 ? `${Math.round((1 - tensionCount / Math.max(1, (lawCount * (lawCount - 1)) / 2)) * 100)}%` : '—'}
          </p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">Aligned</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TensionsPage() {
  const [data, setData] = useState<TensionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [showInfo, setShowInfo] = useState(false)
  const lastFetch = useRef(0)

  const load = useCallback(async () => {
    const now = Date.now()
    if (now - lastFetch.current < 10_000) return
    lastFetch.current = now
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/law/tensions', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = data
    ? typeFilter === 'all'
      ? data.tensions
      : data.tensions.filter((t) => t.tension_type === typeFilter)
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Hero ── */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30">
              <Scale className="h-6 w-6 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white">
                Civic Tensions
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Laws that may pull in opposing directions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              aria-label="What is this?"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              {showInfo ? <X className="h-4 w-4" /> : <Info className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => { lastFetch.current = 0; load() }}
              disabled={loading}
              aria-label="Refresh"
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold',
                'bg-surface-200 border border-surface-300 text-surface-400',
                'hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50',
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Info panel ── */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              key="info"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-gold flex-shrink-0" />
                  <p className="text-sm font-mono font-semibold text-white">How tensions are detected</p>
                </div>
                <p className="text-sm font-mono text-surface-400 leading-relaxed">
                  Each established law is scored across five policy dimensions: spending, regulation, social contract, governance level, and scope. When two laws in the same category score in opposite directions on the same dimension, a potential tension is flagged.
                </p>
                <p className="text-sm font-mono text-surface-400 leading-relaxed">
                  This is a semantic heuristic — it catches real patterns but can also surface cases where context resolves the apparent conflict. Think of tensions as <strong className="text-white">conversation starters</strong>, not verdicts.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  {Object.entries(TENSION_TYPE_CONFIG).map(([type, cfg]) => {
                    const Icon = cfg.icon
                    return (
                      <div key={type} className="flex items-start gap-2.5">
                        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', cfg.color)} />
                        <div>
                          <p className={cn('text-[10px] font-mono font-bold uppercase tracking-wide', cfg.color)}>{cfg.label}</p>
                          <p className="text-[10px] font-mono text-surface-500 leading-tight mt-0.5">{cfg.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-300/60">
                  <Link href="/law" className="text-xs font-mono text-for-400 hover:text-white transition-colors flex items-center gap-1">
                    <Gavel className="h-3.5 w-3.5" />
                    Browse Codex
                  </Link>
                  <span className="text-surface-600">·</span>
                  <Link href="/law/graph" className="text-xs font-mono text-emerald hover:text-white transition-colors flex items-center gap-1">
                    <BarChart2 className="h-3.5 w-3.5" />
                    Law Graph
                  </Link>
                  <span className="text-surface-600">·</span>
                  <Link href="/law/compare" className="text-xs font-mono text-purple hover:text-white transition-colors flex items-center gap-1">
                    <Scale className="h-3.5 w-3.5" />
                    Compare Laws
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Coherence meter ── */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <CoherenceMeter
              score={data.coherence_score}
              tensionCount={data.tensions.length}
              lawCount={data.total_laws}
            />
          </motion.div>
        )}

        {/* ── Type filter pills ── */}
        {data && data.tensions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-6">
            <Filter className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden="true" />
            {ALL_TYPES.map((t) => {
              const isActive = typeFilter === t
              const count = t === 'all' ? data.tensions.length : data.tensions.filter((x) => x.tension_type === t).length
              if (t !== 'all' && count === 0) return null
              const cfg = t !== 'all' ? TENSION_TYPE_CONFIG[t] : null
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all',
                    isActive
                      ? cfg
                        ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                        : 'bg-surface-300 border-surface-400 text-white'
                      : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                  aria-pressed={isActive}
                >
                  {cfg && <cfg.icon className="h-3 w-3" aria-hidden="true" />}
                  {t === 'all' ? 'All' : TENSION_TYPE_CONFIG[t].label}
                  <span className={cn('text-[10px]', isActive ? '' : 'text-surface-500')}>({count})</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Content ── */}
        {loading && !data && <TensionsSkeleton />}

        {error && !data && (
          <EmptyState
            icon={AlertTriangle}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Failed to load"
            description="Could not analyse the Codex. Try again shortly."
            actions={[{
              label: 'Retry',
              onClick: () => { lastFetch.current = 0; load() },
              variant: 'primary',
            }]}
          />
        )}

        {data && filtered.length === 0 && (
          <EmptyState
            icon={Scale}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            title={data.total_laws === 0 ? 'No laws yet' : 'No tensions detected'}
            description={
              data.total_laws === 0
                ? 'The Codex is empty. Once laws are established by community vote, this page will analyse them for potential contradictions.'
                : typeFilter !== 'all'
                ? `No ${TENSION_TYPE_CONFIG[typeFilter].label.toLowerCase()} tensions found in the current Codex.`
                : 'The Codex looks coherent — no significant opposing-direction laws detected across the same categories.'
            }
            actions={
              typeFilter !== 'all'
                ? [{ label: 'Show all types', onClick: () => setTypeFilter('all'), variant: 'secondary' }]
                : [{ label: 'Browse Codex', href: '/law', variant: 'primary', icon: Gavel }]
            }
          />
        )}

        {data && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((tension, idx) => (
              <TensionCard
                key={tension.id}
                tension={tension}
                defaultExpanded={idx === 0}
              />
            ))}

            {/* Bottom context note */}
            <div className="flex items-start gap-2.5 rounded-xl bg-surface-100 border border-surface-300 px-5 py-4 mt-4">
              <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-xs font-mono text-surface-400 leading-relaxed">
                  Tensions are detected via keyword analysis across {data.total_laws} established laws. Each pair was voted into the Codex independently — a tension reflects the natural complexity of democratic governance, where communities may hold simultaneous but context-dependent values.
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <Link href="/law" className="text-xs font-mono text-for-400 hover:text-white transition-colors flex items-center gap-1">
                    <Gavel className="h-3 w-3" />
                    Browse all laws
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                  <Link href="/law/graph" className="text-xs font-mono text-emerald hover:text-white transition-colors flex items-center gap-1">
                    <ArrowRight className="h-3 w-3" />
                    Law Graph
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generated timestamp */}
        {data && (
          <p className="text-center text-[11px] font-mono text-surface-600 mt-8">
            Analysed {data.total_laws} laws · updated {relativeTime(data.generated_at)}
          </p>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
