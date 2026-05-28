'use client'

/**
 * /chronicle — The Civic Chronicle
 *
 * A chronological record of every major event in the Lobby's history:
 * laws established, debates held, and notable topics proposed.
 * Presented as a newspaper-style timeline.
 *
 * Distinct from:
 *   /timeline        — single-topic vote history
 *   /laws/timeline   — law codex visual history
 *   /legacy          — hall-of-fame top performers
 *   /lore            — editorial narrative history
 *
 * This is the raw historical record — every event, every month,
 * in chronological order.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  ChevronDown,
  Cpu,
  DollarSign,
  ExternalLink,
  FileText,
  Filter,
  FlaskConical,
  GraduationCap,
  Gavel,
  Globe,
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
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ChronicleResponse, ChronicleMonth, ChronicleEvent } from '@/app/api/chronicle/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics: DollarSign,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: BookOpen,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/20'     },
  Culture:     { text: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Education:   { text: 'text-for-300',     bg: 'bg-for-400/10',     border: 'border-for-400/20'     },
}

const DEBATE_TYPE_LABEL: Record<string, string> = {
  oxford:     'Oxford Debate',
  town_hall:  'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel:      'Panel',
  quick:      'Quick Debate',
  grand:      'Grand Debate',
  tribunal:   'Tribunal',
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

type TypeFilter = 'all' | 'law' | 'debate' | 'topic'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChronicleSkeletonMonth() {
  return (
    <div className="mb-10">
      <Skeleton className="h-8 w-40 mb-6" />
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: ChronicleEvent }) {
  const catStyle = event.category ? CATEGORY_COLOR[event.category] : null
  const CatIcon = event.category ? CATEGORY_ICON[event.category] : Globe

  const isLaw = event.type === 'law'
  const isDebate = event.type === 'debate'

  const topicId = event.id.startsWith('topic-') ? event.id.replace('topic-', '') : null
  const lawId   = event.id.startsWith('law-')   ? event.id.replace('law-', '')   : null
  const debateId = event.id.startsWith('debate-') ? event.id.replace('debate-', '') : null

  const href = lawId
    ? `/law/${lawId}`
    : debateId
      ? `/debate/${debateId}`
      : topicId
        ? `/topic/${topicId}`
        : '#'

  const forPct  = Math.round(event.blue_pct ?? 50)
  const agPct   = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href={href}
        className={cn(
          'group block rounded-2xl border p-4 transition-all duration-200',
          isLaw
            ? 'bg-gold/5 border-gold/20 hover:bg-gold/10 hover:border-gold/40'
            : isDebate
              ? 'bg-purple/5 border-purple/20 hover:bg-purple/10 hover:border-purple/40'
              : 'bg-surface-100 border-surface-300 hover:bg-surface-200 hover:border-surface-400',
        )}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={cn(
              'flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center',
              isLaw
                ? 'bg-gold/15 text-gold'
                : isDebate
                  ? 'bg-purple/15 text-purple'
                  : catStyle
                    ? cn(catStyle.bg, catStyle.text)
                    : 'bg-surface-300 text-surface-500',
            )}
          >
            {isLaw ? (
              <Gavel className="h-4 w-4" />
            ) : isDebate ? (
              <Mic className="h-4 w-4" />
            ) : CatIcon ? (
              <CatIcon className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Badge row */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {isLaw && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-gold/15 text-gold border border-gold/30 uppercase tracking-wide">
                  <Gavel className="h-2.5 w-2.5" />
                  Law
                </span>
              )}
              {isDebate && event.debate_type && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple/15 text-purple border border-purple/30 uppercase tracking-wide">
                  <Mic className="h-2.5 w-2.5" />
                  {DEBATE_TYPE_LABEL[event.debate_type] ?? event.debate_type}
                </span>
              )}
              {event.type === 'topic' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-surface-300 text-surface-500 border border-surface-400 uppercase tracking-wide">
                  <FileText className="h-2.5 w-2.5" />
                  Proposed
                </span>
              )}
              {event.category && catStyle && (
                <span className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono',
                  catStyle.bg, catStyle.text, catStyle.border,
                  'border',
                )}>
                  {event.category}
                </span>
              )}
              <span className="text-[10px] font-mono text-surface-500 ml-auto">
                {formatShortDate(event.date)}
              </span>
            </div>

            {/* Title */}
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors">
              {event.title}
            </p>

            {/* Stats */}
            {event.votes !== null && (
              <div className="flex items-center gap-3 mt-2">
                {event.blue_pct !== null && (
                  <>
                    <span className="flex items-center gap-1 text-[11px] font-mono text-for-400">
                      <ThumbsUp className="h-3 w-3" />
                      {forPct}%
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-mono text-against-400">
                      <ThumbsDown className="h-3 w-3" />
                      {agPct}%
                    </span>
                  </>
                )}
                <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                  <Scale className="h-3 w-3" />
                  {event.votes.toLocaleString()} votes
                </span>
              </div>
            )}
          </div>

          <ExternalLink className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-400 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Month section ────────────────────────────────────────────────────────────

function MonthSection({ month, index }: { month: ChronicleMonth; index: number }) {
  const [expanded, setExpanded] = useState(index < 2)

  return (
    <div className="mb-8">
      {/* Month header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between mb-4 group"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors" />
            <h2 className="text-lg font-bold text-white group-hover:text-gold transition-colors font-mono">
              {month.label}
            </h2>
          </div>

          {/* Month stats pills */}
          <div className="flex items-center gap-1.5">
            {month.stats.laws > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-gold/15 text-gold border border-gold/30">
                {month.stats.laws} law{month.stats.laws !== 1 ? 's' : ''}
              </span>
            )}
            {month.stats.debates > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple/15 text-purple border border-purple/30">
                {month.stats.debates} debate{month.stats.debates !== 1 ? 's' : ''}
              </span>
            )}
            {month.stats.topics > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-surface-300 text-surface-500 border border-surface-400">
                {month.stats.topics} topic{month.stats.topics !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        <ChevronDown
          className={cn(
            'h-4 w-4 text-surface-500 transition-transform duration-200',
            expanded ? 'rotate-180' : '',
          )}
        />
      </button>

      {/* Separator */}
      <div className="h-px bg-surface-300 mb-4" />

      {/* Events */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-3">
              {month.events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChronicleClient() {
  const [data, setData] = useState<ChronicleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      const res = await fetch(`/api/chronicle?${params}`)
      if (!res.ok) throw new Error('Failed to load chronicle')
      const json = (await res.json()) as ChronicleResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, categoryFilter])

  useEffect(() => { load() }, [load])

  const TYPE_OPTIONS: { id: TypeFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'all',    label: 'All Events', icon: Sparkles },
    { id: 'law',    label: 'Laws',       icon: Gavel },
    { id: 'debate', label: 'Debates',    icon: Mic },
    { id: 'topic',  label: 'Proposals',  icon: FileText },
  ]

  return (
    <div className="flex flex-col h-screen bg-surface-0">
      <TopBar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-24">

          {/* Header */}
          <div className="mb-6">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>

            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white leading-tight">The Civic Chronicle</h1>
                <p className="text-sm text-surface-500 font-mono">Platform history · every event, every month</p>
              </div>
            </div>

            {/* Platform-wide totals */}
            {data && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-3 gap-2 mt-4"
              >
                <div className="rounded-xl bg-gold/5 border border-gold/20 p-3 text-center">
                  <div className="text-lg font-bold font-mono text-gold">{data.totals.laws}</div>
                  <div className="text-[10px] text-surface-500 font-mono uppercase tracking-wide">Laws</div>
                </div>
                <div className="rounded-xl bg-purple/5 border border-purple/20 p-3 text-center">
                  <div className="text-lg font-bold font-mono text-purple">{data.totals.debates}</div>
                  <div className="text-[10px] text-surface-500 font-mono uppercase tracking-wide">Debates</div>
                </div>
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                  <div className="text-lg font-bold font-mono text-white">{data.totals.topics}</div>
                  <div className="text-[10px] text-surface-500 font-mono uppercase tracking-wide">Topics</div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Filter controls */}
          <div className="mb-6 space-y-3">
            {/* Type filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {TYPE_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTypeFilter(id)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-all duration-150',
                    typeFilter === id
                      ? id === 'law'
                        ? 'bg-gold/20 text-gold border-gold/40'
                        : id === 'debate'
                          ? 'bg-purple/20 text-purple border-purple/40'
                          : id === 'topic'
                            ? 'bg-for-500/20 text-for-300 border-for-500/40'
                            : 'bg-surface-300 text-white border-surface-400'
                      : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-white',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}

              <button
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-all duration-150',
                  showFilters || categoryFilter
                    ? 'bg-surface-300 text-white border-surface-400'
                    : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-white',
                )}
              >
                <Filter className="h-3 w-3" />
                {categoryFilter ? categoryFilter : 'Category'}
              </button>
            </div>

            {/* Category filter dropdown */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <button
                      onClick={() => { setCategoryFilter(null); setShowFilters(false) }}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all',
                        !categoryFilter
                          ? 'bg-surface-300 text-white border-surface-400'
                          : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white',
                      )}
                    >
                      All
                    </button>
                    {CATEGORIES.map((cat) => {
                      const style = CATEGORY_COLOR[cat]
                      const Icon = CATEGORY_ICON[cat]
                      return (
                        <button
                          key={cat}
                          onClick={() => { setCategoryFilter(cat); setShowFilters(false) }}
                          className={cn(
                            'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all',
                            categoryFilter === cat
                              ? cn(style.bg, style.text, style.border)
                              : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white',
                          )}
                        >
                          {Icon && <Icon className="h-2.5 w-2.5" />}
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Content */}
          {loading && (
            <div className="space-y-8">
              {[...Array(3)].map((_, i) => <ChronicleSkeletonMonth key={i} />)}
            </div>
          )}

          {error && (
            <EmptyState
              icon={MessageSquare}
              title="Chronicle unavailable"
              description={error}
              action={{ label: 'Try again', onClick: load }}
            />
          )}

          {!loading && !error && data && data.months.length === 0 && (
            <EmptyState
              icon={BookOpen}
              title="No records yet"
              description="The Chronicle grows with each law, debate, and proposal on the platform."
              action={{ label: 'Explore Topics', href: '/' }}
            />
          )}

          {!loading && !error && data && data.months.length > 0 && (
            <div>
              {data.months.map((month, i) => (
                <MonthSection key={`${month.year}-${month.month}`} month={month} index={i} />
              ))}

              {/* Platform founded note */}
              {data.first_event_date && (
                <div className="text-center py-8">
                  <div className="h-px bg-surface-300 mb-6" />
                  <Calendar className="h-5 w-5 text-surface-500 mx-auto mb-2" />
                  <p className="text-xs text-surface-500 font-mono">
                    Platform records begin{' '}
                    <span className="text-surface-400">
                      {new Date(data.first_event_date).toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Refresh button */}
          {!loading && (
            <div className="flex justify-center pt-2">
              <button
                onClick={load}
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors font-mono"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
