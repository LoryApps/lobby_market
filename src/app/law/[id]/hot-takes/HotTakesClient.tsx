'use client'

/**
 * /law/[id]/hot-takes — Founding Voices
 *
 * A live stream of the most passionate voter statements from the debate
 * that established this law — named voters with avatars, filterable by
 * FOR/AGAINST, and live-updating as new takes come in.
 *
 * Distinct from:
 *   /law/[id]/reasons  — anonymous vote reason table with statistics
 *   /law/[id]/quotes   — top upvoted arguments (not vote reasons)
 *   /law/[id]/voters   — voter list ranked by clout
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  Flame,
  Gavel,
  Loader2,
  MessageSquare,
  Play,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { HotTake, HotTakesResponse } from '@/app/api/hot-takes/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000
const MAX_ITEMS = 80

const SIDES = [
  { id: 'all',     label: 'All' },
  { id: 'for',     label: 'FOR',     color: 'text-for-400' },
  { id: 'against', label: 'AGAINST', color: 'text-against-400' },
] as const

type SideFilter = 'all' | 'for' | 'against'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── HotTakeCard ─────────────────────────────────────────────────────────────

function HotTakeCard({ take, isNew }: { take: HotTake; isNew: boolean }) {
  const isFor = take.side === 'blue'
  const Icon = isFor ? ThumbsUp : ThumbsDown

  return (
    <motion.article
      layout
      initial={isNew ? { opacity: 0, y: -12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'rounded-xl border transition-colors',
        isFor
          ? 'bg-for-900/30 border-for-700/30 hover:border-for-600/50'
          : 'bg-against-900/30 border-against-700/30 hover:border-against-600/50',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2">
        {take.voter ? (
          <Link href={`/profile/${take.voter.username}`} className="flex-shrink-0 mt-0.5">
            <Avatar
              src={take.voter.avatar_url}
              fallback={take.voter.display_name || take.voter.username}
              size="sm"
            />
          </Link>
        ) : (
          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-surface-300" />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {take.voter ? (
              <Link
                href={`/profile/${take.voter.username}`}
                className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
              >
                {take.voter.display_name || take.voter.username}
              </Link>
            ) : (
              <span className="text-sm font-semibold text-surface-500">Citizen</span>
            )}
            {take.voter && (
              <span className="text-[11px] text-surface-500 font-mono truncate">
                @{take.voter.username}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[11px] font-mono font-bold tracking-wide',
                isFor ? 'text-for-400' : 'text-against-400',
              )}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            <span className="text-surface-600 text-[11px]">·</span>
            <span className="text-surface-500 text-[11px]">{relativeTime(take.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Quote */}
      <div
        className={cn(
          'mx-4 mb-3.5 px-3 py-2 rounded-lg text-sm leading-relaxed font-mono',
          isFor
            ? 'bg-for-800/40 text-for-200 border border-for-700/20'
            : 'bg-against-800/40 text-against-200 border border-against-700/20',
        )}
      >
        <MessageSquare
          className={cn(
            'h-3 w-3 inline-block mr-1.5 mb-0.5 opacity-60',
            isFor ? 'text-for-400' : 'text-against-400',
          )}
          aria-hidden="true"
        />
        &ldquo;{take.reason}&rdquo;
      </div>
    </motion.article>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-surface-300/30 bg-surface-200/30 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28 rounded" />
          <Skeleton className="h-2.5 w-16 rounded" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  lawId: string
  topicId: string
  statement: string
  forPct: number
  totalVotes: number
  establishedAt: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LawHotTakesClient({
  lawId,
  topicId,
  statement,
  forPct,
  totalVotes,
  establishedAt,
}: Props) {
  const [takes, setTakes] = useState<HotTake[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [side, setSide] = useState<SideFilter>('all')
  const [paused, setPaused] = useState(false)
  const newestAtRef = useRef<string | null>(null)

  const fetchTakes = useCallback(
    async (isSince = false) => {
      try {
        const qs = new URLSearchParams({ topic_id: topicId, limit: '40', side })
        if (isSince && newestAtRef.current) qs.set('since', newestAtRef.current)

        const res = await fetch(`/api/hot-takes?${qs}`)
        if (!res.ok) throw new Error(await res.text())
        const data: HotTakesResponse = await res.json()

        if (isSince && data.takes.length > 0) {
          setNewIds(new Set(data.takes.map((t) => t.id)))
          setTakes((prev) => {
            const combined = [...data.takes, ...prev]
            const seen = new Set<string>()
            return combined.filter((t) => {
              if (seen.has(t.id)) return false
              seen.add(t.id)
              return true
            }).slice(0, MAX_ITEMS)
          })
          if (data.newest_at) newestAtRef.current = data.newest_at
        } else if (!isSince) {
          setTakes(data.takes)
          if (data.newest_at) newestAtRef.current = data.newest_at
        }
      } catch (err) {
        if (!isSince) setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!isSince) setLoading(false)
      }
    },
    [topicId, side],
  )

  // Initial load + re-fetch on side change
  useEffect(() => {
    setLoading(true)
    setError(null)
    newestAtRef.current = null
    fetchTakes(false)
  }, [fetchTakes])

  // Live polling
  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => fetchTakes(true), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [paused, fetchTakes])

  // Fade new-item highlights after 3s
  useEffect(() => {
    if (newIds.size === 0) return
    const t = setTimeout(() => setNewIds(new Set()), 3000)
    return () => clearTimeout(t)
  }, [newIds])

  const forCount = takes.filter((t) => t.side === 'blue').length
  const againstCount = takes.filter((t) => t.side === 'red').length
  const estYear = new Date(establishedAt).getFullYear()

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-2xl mx-auto px-4 pt-6">

          {/* Header */}
          <div className="flex items-start gap-3 mb-5">
            <Link
              href={`/law/${lawId}`}
              aria-label="Back to law"
              className="flex-shrink-0 mt-0.5 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Flame className="h-4 w-4 text-against-400 flex-shrink-0" aria-hidden="true" />
                <h1 className="text-lg font-bold text-white tracking-tight">Founding Voices</h1>
                <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-gold/15 text-gold border border-gold/30">
                  <Gavel className="h-2.5 w-2.5" aria-hidden="true" />
                  LAW {estYear}
                </span>
              </div>
              <p className="text-xs text-surface-500 font-mono line-clamp-2 leading-relaxed">
                {statement}
              </p>
            </div>

            {/* Live / Pause toggle */}
            <button
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Resume live feed' : 'Pause live feed'}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                paused
                  ? 'bg-surface-200 border-surface-400 text-surface-700'
                  : 'bg-against-500/10 border-against-500/30 text-against-400 animate-pulse',
              )}
            >
              {paused ? (
                <>
                  <Play className="h-3 w-3" aria-hidden="true" />
                  PAUSED
                </>
              ) : (
                <>
                  <Activity className="h-3 w-3" aria-hidden="true" />
                  LIVE
                </>
              )}
            </button>
          </div>

          {/* Vote split bar */}
          {totalVotes > 0 && (
            <div className="mb-5 rounded-xl bg-surface-200/60 border border-surface-300/40 px-4 py-3">
              <div className="flex justify-between text-[11px] font-mono mb-1.5">
                <span className="text-for-400 font-bold">FOR {Math.round(forPct)}%</span>
                <span className="text-surface-500">{totalVotes.toLocaleString()} founding votes</span>
                <span className="text-against-400 font-bold">AGAINST {100 - Math.round(forPct)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-against-900/60 overflow-hidden">
                <div
                  className="h-full bg-for-500 rounded-full transition-all duration-500"
                  style={{ width: `${forPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Filters row */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-1 flex-1">
              {SIDES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSide(s.id as SideFilter)}
                  aria-pressed={side === s.id}
                  className={cn(
                    'flex-1 py-1 rounded-md text-xs font-mono font-semibold transition-all',
                    side === s.id
                      ? 'bg-surface-300 text-white shadow-sm'
                      : 'text-surface-500 hover:text-surface-700',
                    side === s.id && 'color' in s && s.color,
                  )}
                >
                  {s.label}
                  {s.id === 'for' && !loading && (
                    <span className="ml-1 opacity-60">({forCount})</span>
                  )}
                  {s.id === 'against' && !loading && (
                    <span className="ml-1 opacity-60">({againstCount})</span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => { newestAtRef.current = null; setLoading(true); fetchTakes(false) }}
              aria-label="Refresh"
              className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : error ? (
            <div className="text-center py-16 text-surface-500 text-sm font-mono">
              {error}
            </div>
          ) : takes.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No founding voices recorded"
              description={
                side !== 'all'
                  ? 'Try switching to All to see more takes.'
                  : 'Citizens who voted on the original debate did not leave written reasons.'
              }
              actions={[
                { label: 'View law', href: `/law/${lawId}` },
                { label: 'See top quotes', href: `/law/${lawId}/quotes` },
              ]}
            />
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {newIds.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center justify-center gap-2 py-2 text-xs font-mono text-for-400"
                  >
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    {newIds.size} new voice{newIds.size !== 1 ? 's' : ''}
                  </motion.div>
                )}
              </AnimatePresence>

              {takes.map((take) => (
                <HotTakeCard key={take.id} take={take} isNew={newIds.has(take.id)} />
              ))}

              {takes.length >= MAX_ITEMS && (
                <p className="text-center text-xs text-surface-600 py-4 font-mono">
                  Showing the {MAX_ITEMS} most recent founding voices
                </p>
              )}
            </div>
          )}

          {/* Footer links */}
          {!loading && !error && (
            <div className="mt-8 mb-4 flex items-center justify-center gap-4 text-xs font-mono text-surface-500 flex-wrap">
              <Link href={`/law/${lawId}`} className="hover:text-white transition-colors">
                ← Back to law
              </Link>
              <Link href={`/law/${lawId}/reasons`} className="hover:text-white transition-colors">
                Anonymous reasons
              </Link>
              <Link href={`/law/${lawId}/quotes`} className="hover:text-white transition-colors">
                Top arguments
              </Link>
              <Link href={`/law/${lawId}/voters`} className="hover:text-white transition-colors">
                Voter list
              </Link>
              <Link href="/hot-takes" className="flex items-center gap-1 hover:text-white transition-colors">
                <Flame className="h-3.5 w-3.5" />
                All hot takes
              </Link>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
