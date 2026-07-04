'use client'

/**
 * /contested — The Contested Debates
 *
 * A live browser of every active topic where the FOR/AGAINST split is
 * closest to 50/50. These are the genuinely undecided debates where every
 * vote matters and the outcome is impossible to predict.
 *
 * Distinct from:
 *   /battleground   — cinematic split-screen view of ONE contested topic
 *   /tipping-point  — topics near the law/fail threshold (not 50/50)
 *   /flashpoint     — single hottest debate right now
 *   /deadlock       — (upcoming) topics stuck at exactly 50/50 for days
 *   /standoff       — topics with two equally matched debate teams
 *
 * Polls every 30 s. Controversy score: 100 = perfect 50/50, 60+ = shown here.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Filter,
  Flame,
  Info,
  RefreshCw,
  Scale,
  Swords,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ContestedTopic } from '@/app/api/topics/contested/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 30_000

const STATUS_TABS = [
  { id: null,       label: 'All Live' },
  { id: 'active',   label: 'Active' },
  { id: 'voting',   label: 'Voting' },
  { id: 'proposed', label: 'Proposed' },
] as const

const SORT_OPTIONS = [
  { id: 'contested', label: 'Most Contested' },
  { id: 'votes',     label: 'Most Votes' },
  { id: 'recent',    label: 'Most Recent' },
] as const

const CATEGORIES = [
  'All',
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
] as const

const CAT_COLOR: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-for-300/10 text-for-300 border-for-300/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Culture:     'bg-against-400/10 text-against-300 border-against-400/30',
  Health:      'bg-emerald/10 text-emerald border-emerald/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-gold/10 text-gold border-gold/30',
}

type StatusId = null | 'active' | 'voting' | 'proposed'
type SortId = 'contested' | 'votes' | 'recent'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function contestLabel(score: number): { label: string; color: string; glow: string } {
  if (score >= 98) return { label: 'DEADLOCKED', color: 'text-against-300', glow: 'shadow-against-500/30' }
  if (score >= 92) return { label: 'RAZOR-THIN',  color: 'text-against-400', glow: 'shadow-against-500/20' }
  if (score >= 84) return { label: 'TOO CLOSE',   color: 'text-gold',        glow: 'shadow-gold/20' }
  if (score >= 74) return { label: 'CONTESTED',   color: 'text-surface-400', glow: '' }
  return              { label: 'DIVIDED',    color: 'text-surface-500', glow: '' }
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

// ─── Split bar ────────────────────────────────────────────────────────────────

function SplitBar({ forPct }: { forPct: number }) {
  const forWidth = Math.max(2, Math.min(98, forPct))
  const vsGap    = Math.abs(forPct - 50)

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] font-mono">
        <span className="text-for-400 font-bold">{forPct}% FOR</span>
        <span className="text-against-400 font-bold">{100 - forPct}% AGAINST</span>
      </div>
      {/* Bar: against fills full width as bg, for animates on top */}
      <div className="relative h-3 rounded-full overflow-hidden bg-against-500">
        <motion.div
          className="absolute left-0 top-0 h-full bg-for-500 rounded-r-full"
          initial={{ width: '50%' }}
          animate={{ width: `${forWidth}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        {/* Center reference line */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-surface-100/40 -translate-x-px z-10" />
      </div>
      <div className="text-[10px] font-mono text-surface-500 text-center">
        {vsGap < 1
          ? 'Exactly even — every vote decides this'
          : `${vsGap.toFixed(1)}% gap — ${vsGap < 3 ? 'one argument away from shifting' : 'neck and neck'}`
        }
      </div>
    </div>
  )
}

// ─── Controversy dial ─────────────────────────────────────────────────────────

function ContestDial({ score }: { score: number }) {
  const { label, color } = contestLabel(score)
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          'flex items-center justify-center h-6 w-6 rounded-full border text-[9px] font-mono font-bold',
          score >= 92 ? 'border-against-500/50 bg-against-500/10 text-against-300' :
          score >= 84 ? 'border-gold/50 bg-gold/10 text-gold' :
          'border-surface-400/50 bg-surface-300/50 text-surface-400',
        )}
        title={`Controversy score: ${Math.round(score)}/100`}
      >
        {Math.round(score)}
      </div>
      <span className={cn('text-[10px] font-mono font-semibold', color)}>{label}</span>
    </div>
  )
}

// ─── Contested card ───────────────────────────────────────────────────────────

function ContestedCard({ topic, index }: { topic: ContestedTopic; index: number }) {
  const forPct = Math.round(topic.blue_pct)
  const score  = topic.controversy_score
  const { glow }  = contestLabel(score)
  const isVoting  = topic.status === 'voting'
  const isActive  = topic.status === 'active'
  const catClass  = topic.category ? (CAT_COLOR[topic.category] ?? 'bg-surface-300 text-surface-400 border-surface-400') : ''

  const borderGlow = score >= 92
    ? 'border-against-500/40 hover:border-against-500/60'
    : score >= 84
    ? 'border-gold/30 hover:border-gold/50'
    : 'border-surface-300 hover:border-surface-400'

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.035, ease: 'easeOut' }}
      className={cn(
        'relative rounded-2xl border bg-surface-100 overflow-hidden transition-colors',
        borderGlow,
        score >= 92 && glow ? `shadow-lg ${glow}` : '',
      )}
    >
      {/* Top accent strip */}
      <div className="flex h-0.5">
        <div className="flex-1 bg-for-500/50" />
        <div className="flex-1 bg-against-500/50" />
      </div>

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300">
            <Scale className="h-4 w-4 text-surface-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={`/topic/${topic.id}`}
              className="text-sm font-mono text-white hover:text-for-300 transition-colors leading-snug line-clamp-2 block"
            >
              {topic.statement}
            </Link>
          </div>
        </div>

        {/* Split bar — the hero element */}
        <SplitBar forPct={forPct} />

        {/* Contest dial + meta */}
        <div className="flex items-center justify-between gap-2">
          <ContestDial score={score} />
          <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {topic.total_votes.toLocaleString()}
            </span>
            <span>{relTime(topic.updated_at)}</span>
          </div>
        </div>

        {/* Badges + quick links */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {topic.category && (
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono', catClass)}>
                {topic.category}
              </span>
            )}
            {topic.scope && topic.scope !== 'Global' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-surface-400/30 bg-surface-200/50 text-[10px] font-mono text-surface-400">
                {topic.scope}
              </span>
            )}
            {isVoting && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple/10 border border-purple/30 text-[10px] font-mono text-purple">
                <Zap className="h-2.5 w-2.5" aria-hidden="true" /> Voting
              </span>
            )}
            {isActive && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-for-500/10 border border-for-500/30 text-[10px] font-mono text-for-400">
                <Flame className="h-2.5 w-2.5" aria-hidden="true" /> Active
              </span>
            )}
          </div>
          <Link
            href={`/topic/${topic.id}`}
            className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            aria-label={`Cast your vote on: ${topic.statement}`}
          >
            Vote <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </motion.article>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ContestedSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-3/4 rounded" />
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContestedPage() {
  const [topics, setTopics]         = useState<ContestedTopic[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [status, setStatus]         = useState<StatusId>(null)
  const [category, setCategory]     = useState<string>('All')
  const [sort, setSort]             = useState<SortId>('contested')
  const [showFilters, setShowFilters] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '60' })
      if (status) params.set('status', status)
      if (category !== 'All') params.set('category', category)
      const res = await fetch(`/api/topics/contested?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as { topics: ContestedTopic[] }
      let result = json.topics ?? []

      // Client-side sort on top of the API's controversy sort
      if (sort === 'votes') {
        result = [...result].sort((a, b) => b.total_votes - a.total_votes)
      } else if (sort === 'recent') {
        result = [...result].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
      }
      // 'contested' is already sorted by the API

      setTopics(result)
      setLastRefresh(new Date())
    } catch {
      setError('Could not load contested topics.')
    } finally {
      setIsLoading(false)
    }
  }, [status, category, sort])

  // Initial load + dependency re-fetch
  useEffect(() => {
    load(true)
  }, [load])

  // Poll for freshness
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => load(false), POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [load])

  const deadlocked = topics.filter((t) => t.controversy_score >= 92)
  const contested  = topics.filter((t) => t.controversy_score >= 60 && t.controversy_score < 92)

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-6 space-y-6">

        {/* Page header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-against-500/10 border border-against-500/30">
              <Swords className="h-5 w-5 text-against-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-mono tracking-tight">
                The Contested
              </h1>
              <p className="text-xs text-surface-500 font-mono">
                Debates closest to 50/50 — every vote matters here
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => load(false)}
                className="text-surface-500 hover:text-white transition-colors p-1"
                aria-label="Refresh contested topics"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                onClick={() => setShowFilters((f) => !f)}
                className={cn(
                  'flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded-lg border transition-colors',
                  showFilters
                    ? 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white',
                )}
                aria-label="Toggle filters"
              >
                <Filter className="h-3 w-3" aria-hidden="true" />
                Filters
              </button>
            </div>
          </div>
          {lastRefresh && (
            <p className="text-[10px] font-mono text-surface-600 pl-12">
              Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' · '}auto-refreshes every 30 s
            </p>
          )}
        </div>

        {/* Info callout */}
        <div className="flex items-start gap-2.5 rounded-xl bg-surface-200/50 border border-surface-300/60 p-3">
          <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[11px] font-mono text-surface-400 leading-relaxed">
            These debates have no clear winner yet. The split is within{' '}
            <strong className="text-surface-300">20% of even</strong> — your
            vote could shift the balance. Deadlocked debates (within 4%) are
            shown first.
          </p>
        </div>

        {/* Status tabs */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
          role="tablist"
          aria-label="Filter by topic status"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={String(tab.id)}
              role="tab"
              aria-selected={status === tab.id}
              onClick={() => setStatus(tab.id as StatusId)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-mono border transition-all',
                status === tab.id
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Expandable filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 rounded-xl bg-surface-200/40 border border-surface-300/60 p-3">
                {/* Sort */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 mb-1.5 uppercase tracking-widest">Sort</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSort(opt.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                          sort === opt.id
                            ? 'bg-surface-300 border-surface-400 text-white'
                            : 'bg-transparent border-surface-300/60 text-surface-500 hover:text-white',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Category */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 mb-1.5 uppercase tracking-widest">Category</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                          category === cat
                            ? 'bg-surface-300 border-surface-400 text-white'
                            : 'bg-transparent border-surface-300/60 text-surface-500 hover:text-white',
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {isLoading ? (
          <ContestedSkeleton />
        ) : error ? (
          <EmptyState
            icon={Scale}
            title="Could not load contested topics"
            description={error}
            action={{ label: 'Try again', onClick: () => load(true) }}
          />
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No contested debates"
            description="All current debates have a clear consensus. Try removing filters or check back later."
            action={{ label: 'Clear filters', onClick: () => { setStatus(null); setCategory('All') } }}
          />
        ) : (
          <div className="space-y-6">
            {/* Deadlocked section */}
            {deadlocked.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-against-500/20" />
                  <span className="text-[11px] font-mono font-bold text-against-400 uppercase tracking-widest px-2">
                    Deadlocked ({deadlocked.length})
                  </span>
                  <div className="h-px flex-1 bg-against-500/20" />
                </div>
                <div className="space-y-3">
                  {deadlocked.map((topic, i) => (
                    <ContestedCard key={topic.id} topic={topic} index={i} />
                  ))}
                </div>
              </section>
            )}

            {/* Contested section */}
            {contested.length > 0 && (
              <section>
                {deadlocked.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-surface-300/50" />
                    <span className="text-[11px] font-mono font-bold text-surface-500 uppercase tracking-widest px-2">
                      Contested ({contested.length})
                    </span>
                    <div className="h-px flex-1 bg-surface-300/50" />
                  </div>
                )}
                <div className="space-y-3">
                  {contested.map((topic, i) => (
                    <ContestedCard key={topic.id} topic={topic} index={deadlocked.length + i} />
                  ))}
                </div>
              </section>
            )}

            {/* Links to related tools */}
            <div className="rounded-xl bg-surface-200/40 border border-surface-300/60 p-4 space-y-2">
              <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest">Related</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: '/battleground', label: 'Battleground', desc: 'One topic, cinematic split-screen' },
                  { href: '/tipping-point', label: 'Tipping Point', desc: 'Near the law/fail threshold' },
                  { href: '/flashpoint', label: 'Flashpoint', desc: 'The single hottest debate' },
                  { href: '/standoff', label: 'Standoff', desc: 'Equal teams, max intensity' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex flex-col gap-0.5 rounded-lg p-2.5 bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
                  >
                    <span className="text-[11px] font-mono text-white group-hover:text-for-300 transition-colors">
                      {link.label}
                    </span>
                    <span className="text-[10px] font-mono text-surface-500">{link.desc}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
