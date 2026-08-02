'use client'

/**
 * /law/[id]/themes — Argument Themes that Shaped This Law
 *
 * Clusters the debate arguments (from the original topic) into civic themes
 * — Individual Freedom, Economic Impact, Moral & Ethics, etc. — and shows
 * the FOR/AGAINST split within each theme.
 *
 * Answers: "What kinds of reasoning led the community to pass this law?"
 *
 * Distinct from:
 *   /law/[id]/reasons    — individual vote reasons
 *   /law/[id]/blocs      — demographic voting blocs
 *   /law/[id]/synthesis  — AI synthesis of positions
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gavel,
  Layers,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawThemesResponse, LawDebateTheme, LawThemeArgument } from '@/app/api/laws/[id]/themes/route'

// ─── Mini argument card ────────────────────────────────────────────────────────

function MiniArgCard({ arg }: { arg: LawThemeArgument }) {
  const isFor = arg.side === 'blue'
  return (
    <Link
      href={`/arguments/${arg.id}`}
      className={cn(
        'block rounded-xl border p-3 transition-colors group',
        isFor
          ? 'border-for-500/20 bg-for-500/5 hover:border-for-500/40 hover:bg-for-500/10'
          : 'border-against-500/20 bg-against-500/5 hover:border-against-500/40 hover:bg-against-500/10'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            'flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center',
            isFor ? 'bg-for-500/20' : 'bg-against-500/20'
          )}
        >
          {isFor
            ? <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
            : <ThumbsDown className="h-2.5 w-2.5 text-against-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-surface-600 leading-relaxed line-clamp-3 group-hover:text-surface-500 transition-colors">
            {arg.content}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={cn(
              'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded',
              isFor ? 'text-for-400 bg-for-500/10' : 'text-against-400 bg-against-500/10'
            )}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            {arg.ai_grade && (
              <span className="text-[10px] font-mono text-gold bg-gold/10 px-1.5 py-0.5 rounded">
                Grade {arg.ai_grade}
              </span>
            )}
            {arg.upvotes > 0 && (
              <span className="text-[10px] text-surface-500">
                +{arg.upvotes}
              </span>
            )}
          </div>
        </div>
        <ExternalLink className="h-3 w-3 text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
      </div>
    </Link>
  )
}

// ─── Theme Card ────────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  isExpanded,
  onToggle,
  rank,
}: {
  theme: LawDebateTheme
  isExpanded: boolean
  onToggle: () => void
  rank: number
}) {
  const forPct = theme.for_pct
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={cn(
        'rounded-2xl border overflow-hidden',
        theme.border,
        theme.bg
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-white/5 transition-colors"
        aria-expanded={isExpanded}
      >
        {/* Rank badge */}
        <span className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-surface-200/60 border border-surface-300/60 flex items-center justify-center text-[10px] font-mono text-surface-500">
          {rank + 1}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn('font-semibold text-sm', theme.color)}>{theme.label}</h3>
            <span className="text-[10px] font-mono text-surface-500 bg-surface-200/60 border border-surface-300/40 px-1.5 py-0.5 rounded-full">
              {theme.total} argument{theme.total !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-surface-500 mt-0.5">{theme.description}</p>

          {/* FOR/AGAINST bar */}
          <div className="mt-3 space-y-1.5">
            <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
              <div
                className="h-full bg-for-500 rounded-l-full transition-all"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="h-full bg-against-500 rounded-r-full transition-all"
                style={{ width: `${againstPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-for-400">{forPct}% FOR ({theme.for_count})</span>
              <span className="text-against-400">{againstPct}% AGAINST ({theme.against_count})</span>
            </div>
          </div>
        </div>

        <div className={cn('flex-shrink-0 mt-1', theme.textColor)}>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              {theme.arguments.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {theme.arguments.map((arg) => (
                    <MiniArgCard key={arg.id} arg={arg} />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-surface-500 italic">No arguments to display.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300/40 bg-surface-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LawThemesPage() {
  const params = useParams<{ id: string }>()
  const lawId = params.id

  const [data, setData] = useState<LawThemesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/themes`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load themes')
      const json: LawThemesResponse = await res.json()
      setData(json)
      // Auto-expand the top 2 themes
      if (json.themes.length > 0) {
        setExpanded(new Set(json.themes.slice(0, 2).map((t) => t.id)))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  function toggleTheme(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const forPct = data ? Math.round(data.law_blue_pct) : 0
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Back link ──────────────────────────────────────────────── */}
        <Link
          href={`/law/${lawId}`}
          className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Law
        </Link>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30">
              <Layers className="h-5 w-5 text-emerald" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Argument Themes</h1>
              <p className="text-xs text-surface-500">Civic reasoning that shaped this law</p>
            </div>
          </div>

          {data && (
            <div className="mt-4 p-4 rounded-xl bg-surface-100 border border-surface-300/60">
              <div className="flex items-start gap-3">
                <Gavel className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium leading-snug line-clamp-2">
                    {data.law_statement}
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {data.law_category && (
                      <Badge variant="outline" className="text-[10px]">{data.law_category}</Badge>
                    )}
                    <span className="text-[10px] text-for-400 font-mono">
                      {forPct}% FOR
                    </span>
                    <span className="text-[10px] text-against-400 font-mono">
                      {againstPct}% AGAINST
                    </span>
                    <span className="text-[10px] text-surface-500 font-mono">
                      {data.law_total_votes.toLocaleString()} votes
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Stats strip ────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Themes Found', value: data.themes.length, color: 'text-white' },
              { label: 'Arguments Analysed', value: data.total_arguments.toLocaleString(), color: 'text-white' },
              {
                label: 'Dominant Theme',
                value: data.themes[0]?.label ?? '—',
                color: data.themes[0]?.color ?? 'text-surface-500',
                small: true,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-surface-100 border border-surface-300/60 p-3 text-center"
              >
                <p className={cn('font-bold', stat.small ? 'text-xs leading-tight' : 'text-lg', stat.color)}>
                  {stat.value}
                </p>
                <p className="text-[10px] text-surface-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Controls ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-surface-500" />
            <span className="text-sm text-surface-500">
              {loading ? 'Loading...' : `${data?.themes.length ?? 0} themes`}
            </span>
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading && <LoadingSkeleton />}

        {error && !loading && (
          <EmptyState
            icon={Layers}
            iconColor="text-surface-500"
            title="Could not load themes"
            description={error}
            action={{ label: 'Retry', onClick: () => load() }}
          />
        )}

        {!loading && !error && data?.themes.length === 0 && (
          <EmptyState
            icon={MessageSquare}
            iconColor="text-surface-500"
            title="No themed arguments yet"
            description="This law hasn't accumulated enough arguments for theme classification."
            action={{ label: 'View Arguments', href: `/law/${lawId}/community` }}
          />
        )}

        {!loading && !error && data && data.themes.length > 0 && (
          <div className="space-y-3">
            {data.themes.map((theme, i) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                rank={i}
                isExpanded={expanded.has(theme.id)}
                onToggle={() => toggleTheme(theme.id)}
              />
            ))}

            {data.uncategorized_count > 0 && (
              <p className="text-center text-xs text-surface-600 pt-2">
                {data.uncategorized_count} argument{data.uncategorized_count !== 1 ? 's' : ''} did not match any theme
              </p>
            )}
          </div>
        )}

        {/* ── Related links ────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="mt-8 grid gap-2 sm:grid-cols-3">
            {[
              { label: 'Original Debate', href: `/topic/${data.topic_id}`, desc: 'Full discussion' },
              { label: 'Voting Blocs', href: `/law/${lawId}/blocs`, desc: 'Who voted how' },
              { label: 'Law Synthesis', href: `/law/${lawId}/synthesis`, desc: 'AI summary' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
              >
                <div>
                  <p className="text-xs font-medium text-white group-hover:text-for-300 transition-colors">
                    {link.label}
                  </p>
                  <p className="text-[10px] text-surface-500">{link.desc}</p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
