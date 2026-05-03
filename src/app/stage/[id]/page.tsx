'use client'

/**
 * /stage/[id] — Civic Stage Presentation View
 *
 * Full-screen, minimal UI for projecting a live civic debate at events.
 * Auto-refreshes every 15 seconds. Shows:
 *   - Topic statement (large)
 *   - Animated FOR / AGAINST split bars
 *   - Live vote percentages
 *   - Top argument quote from each side
 *   - Vote count + refresh countdown
 *   - Keyboard: F = browser fullscreen, Esc = exit, ← → = navigate topics
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Expand,
  Gavel,
  Maximize2,
  Minimize2,
  MonitorPlay,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TopArgumentsResponse } from '@/app/api/topics/[id]/top-arguments/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StageTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string
  description: string | null
}

interface StageArgument {
  id: string
  content: string
  upvotes: number
}

interface StageData {
  topic: StageTopic
  forArg: StageArgument | null
  againstArg: StageArgument | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 15_000
const TICK_MS = 250

// ─── Animated vote number ─────────────────────────────────────────────────────

function AnimPct({ value, side }: { value: number; side: 'for' | 'against' }) {
  const [displayed, setDisplayed] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    if (value === prev.current) return
    const start = prev.current
    const end = value
    const steps = 20
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(Math.round(start + (end - start) * (i / steps)))
      if (i >= steps) {
        clearInterval(id)
        prev.current = end
      }
    }, 30)
    return () => clearInterval(id)
  }, [value])

  return (
    <span
      className={cn(
        'tabular-nums font-mono font-black',
        side === 'for' ? 'text-for-300' : 'text-against-300'
      )}
    >
      {displayed}%
    </span>
  )
}

// ─── Countdown ring ───────────────────────────────────────────────────────────

function CountdownRing({ ms, total }: { ms: number; total: number }) {
  const pct = ms / total
  const r = 14
  const circ = 2 * Math.PI * r
  const dash = circ * pct

  return (
    <svg width="36" height="36" className="rotate-[-90deg]" aria-hidden>
      <circle cx="18" cy="18" r={r} stroke="currentColor" strokeWidth="2.5" fill="none" className="text-surface-600" />
      <circle
        cx="18" cy="18" r={r}
        stroke="currentColor" strokeWidth="2.5" fill="none"
        className="text-for-500 transition-all duration-200"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StagePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [data, setData] = useState<StageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(REFRESH_MS)
  const [refreshing, setRefreshing] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [navTopics, setNavTopics] = useState<{ id: string }[]>([])
  const [navIdx, setNavIdx] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)

  // ── Fetch topic data ────────────────────────────────────────────────────────

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const [topicRes, argsRes] = await Promise.all([
        fetch(`/api/topics/${id}`, { cache: 'no-store' }),
        fetch(`/api/topics/${id}/top-arguments`, { cache: 'no-store' }),
      ])

      if (!topicRes.ok) throw new Error('Topic not found')

      const { topic } = await topicRes.json()
      const { forArg, againstArg }: TopArgumentsResponse = argsRes.ok
        ? await argsRes.json()
        : { forArg: null, againstArg: null }

      setData({
        topic: {
          id: topic.id,
          statement: topic.statement,
          category: topic.category ?? null,
          status: topic.status,
          blue_pct: topic.blue_pct ?? 50,
          total_votes: topic.total_votes ?? 0,
          scope: topic.scope ?? 'Global',
          description: topic.description ?? null,
        },
        forArg: forArg ?? null,
        againstArg: againstArg ?? null,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load topic')
    } finally {
      setLoading(false)
      setRefreshing(false)
      setCountdown(REFRESH_MS)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Load sibling topics for ← → nav ────────────────────────────────────────

  useEffect(() => {
    fetch('/api/feed?status=active&limit=40')
      .then((r) => r.json())
      .then((d) => {
        const list: { id: string }[] = Array.isArray(d) ? d : (d.topics ?? d.data ?? [])
        setNavTopics(list)
        const idx = list.findIndex((t) => t.id === id)
        setNavIdx(idx)
      })
      .catch(() => {})
  }, [id])

  // ── Countdown + auto-refresh ────────────────────────────────────────────────

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= TICK_MS) {
          fetchData(true)
          return REFRESH_MS
        }
        return c - TICK_MS
      })
    }, TICK_MS)
    return () => clearInterval(tick)
  }, [fetchData])

  // ── Fullscreen detection ────────────────────────────────────────────────────

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen()
      } else if (e.key === 'ArrowLeft') {
        navigateTopic(-1)
      } else if (e.key === 'ArrowRight') {
        navigateTopic(1)
      } else if (e.key === 'Escape' && !document.fullscreenElement) {
        router.push('/stage')
      } else if (e.key === 'r' || e.key === 'R') {
        fetchData(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navIdx, navTopics, fetchData])

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  function navigateTopic(dir: -1 | 1) {
    if (navTopics.length === 0) return
    const next = navIdx + dir
    if (next < 0 || next >= navTopics.length) return
    router.push(`/stage/${navTopics[next].id}`)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <MonitorPlay className="h-10 w-10 text-for-400 animate-pulse" />
          <p className="text-surface-500 font-mono text-sm">Loading stage…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <Scale className="h-10 w-10 text-surface-500" />
          <p className="text-white font-mono font-semibold">{error ?? 'Topic not found'}</p>
          <Link href="/stage" className="text-for-400 text-sm font-mono hover:underline">
            ← Back to Stage
          </Link>
        </div>
      </div>
    )
  }

  const { topic, forArg, againstArg } = data
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const isContested = Math.abs(forPct - 50) <= 10

  const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
    active: Zap,
    voting: Scale,
    law: Gavel,
  }
  const StatusIcon = STATUS_ICON[topic.status] ?? Zap

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#080c14] flex flex-col select-none overflow-hidden"
    >
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300/30 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/stage"
            className="flex items-center gap-1.5 text-surface-500 hover:text-white transition-colors text-xs font-mono"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Stage
          </Link>
          <span className="h-3 w-px bg-surface-600" />
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
            <StatusIcon className="h-3.5 w-3.5 text-for-400" />
            <span className="capitalize">{topic.status}</span>
            {topic.category && (
              <>
                <span>·</span>
                <span>{topic.category}</span>
              </>
            )}
            <span>·</span>
            <span>{topic.scope}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Countdown */}
          <div className="relative flex items-center justify-center" title={`Refreshes in ${Math.ceil(countdown / 1000)}s`}>
            <CountdownRing ms={countdown} total={REFRESH_MS} />
            {refreshing ? (
              <RefreshCw className="absolute h-3 w-3 text-for-400 animate-spin" />
            ) : (
              <span className="absolute text-[9px] font-mono text-surface-500">
                {Math.ceil(countdown / 1000)}
              </span>
            )}
          </div>

          {/* Nav arrows */}
          {navTopics.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateTopic(-1)}
                disabled={navIdx <= 0}
                aria-label="Previous topic"
                className="p-1 rounded text-surface-500 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[10px] font-mono text-surface-600 w-8 text-center">
                {navIdx >= 0 ? `${navIdx + 1}/${navTopics.length}` : '—'}
              </span>
              <button
                onClick={() => navigateTopic(1)}
                disabled={navIdx >= navTopics.length - 1}
                aria-label="Next topic"
                className="p-1 rounded text-surface-500 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300/40 transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* ── Main stage ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">

        {/* Statement */}
        <AnimatePresence mode="wait">
          <motion.div
            key={topic.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-4xl text-center"
          >
            {isContested && (
              <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-gold/10 text-gold border border-gold/30">
                <Expand className="h-3 w-3" />
                CONTESTED — Needs Your Vote
              </div>
            )}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
              {topic.statement}
            </h1>
          </motion.div>
        </AnimatePresence>

        {/* Split bars */}
        <div className="w-full max-w-4xl flex flex-col gap-3">
          {/* Bar */}
          <div className="relative h-10 rounded-2xl overflow-hidden flex shadow-lg shadow-black/40">
            <motion.div
              className="h-full bg-gradient-to-r from-for-700 to-for-500 flex items-center justify-start pl-4"
              animate={{ width: `${forPct}%` }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              {forPct >= 20 && (
                <span className="text-white font-mono font-bold text-sm flex items-center gap-1.5">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  FOR
                </span>
              )}
            </motion.div>
            <motion.div
              className="h-full bg-gradient-to-l from-against-700 to-against-500 flex items-center justify-end pr-4 flex-1"
              animate={{ width: `${againstPct}%` }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              {againstPct >= 20 && (
                <span className="text-white font-mono font-bold text-sm flex items-center gap-1.5">
                  AGAINST
                  <ThumbsDown className="h-3.5 w-3.5" />
                </span>
              )}
            </motion.div>
          </div>

          {/* Big numbers */}
          <div className="flex items-center justify-between px-2">
            <div className="text-center">
              <div className="text-5xl md:text-6xl lg:text-7xl font-black leading-none">
                <AnimPct value={forPct} side="for" />
              </div>
              <div className="text-sm font-mono text-for-500 mt-1 flex items-center gap-1">
                <ThumbsUp className="h-3 w-3" />
                IN FAVOUR
              </div>
            </div>

            {/* Centre divider */}
            <div className="flex flex-col items-center gap-1">
              <Scale className="h-5 w-5 text-surface-500" />
              <div className="flex items-center gap-1 text-xs font-mono text-surface-500">
                <Users className="h-3 w-3" />
                {topic.total_votes.toLocaleString()}
              </div>
              <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">votes</span>
            </div>

            <div className="text-center">
              <div className="text-5xl md:text-6xl lg:text-7xl font-black leading-none">
                <AnimPct value={againstPct} side="against" />
              </div>
              <div className="text-sm font-mono text-against-500 mt-1 flex items-center gap-1 justify-end">
                OPPOSED
                <ThumbsDown className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>

        {/* Arguments */}
        {(forArg || againstArg) && (
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* FOR argument */}
            {forArg ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-for-900/20 border border-for-700/30 rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp className="h-4 w-4 text-for-400" />
                  <span className="text-xs font-mono font-semibold text-for-400 uppercase tracking-wider">
                    Best FOR Argument
                  </span>
                </div>
                <p className="text-white/90 text-sm leading-relaxed line-clamp-4 italic">
                  &ldquo;{forArg.content}&rdquo;
                </p>
                <div className="mt-2 text-[11px] font-mono text-for-600">
                  {forArg.upvotes.toLocaleString()} upvotes
                </div>
              </motion.div>
            ) : (
              <div className="bg-surface-200/30 border border-surface-300/30 rounded-2xl p-5 flex items-center justify-center">
                <p className="text-surface-600 text-sm font-mono">No FOR arguments yet</p>
              </div>
            )}

            {/* AGAINST argument */}
            {againstArg ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-against-900/20 border border-against-700/30 rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsDown className="h-4 w-4 text-against-400" />
                  <span className="text-xs font-mono font-semibold text-against-400 uppercase tracking-wider">
                    Best AGAINST Argument
                  </span>
                </div>
                <p className="text-white/90 text-sm leading-relaxed line-clamp-4 italic">
                  &ldquo;{againstArg.content}&rdquo;
                </p>
                <div className="mt-2 text-[11px] font-mono text-against-600">
                  {againstArg.upvotes.toLocaleString()} upvotes
                </div>
              </motion.div>
            ) : (
              <div className="bg-surface-200/30 border border-surface-300/30 rounded-2xl p-5 flex items-center justify-center">
                <p className="text-surface-600 text-sm font-mono">No AGAINST arguments yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer bar ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-surface-300/20 bg-surface-50/30 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <MonitorPlay className="h-3.5 w-3.5 text-for-500" />
          <span className="text-xs font-mono text-surface-600">
            lobby.market
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href={`/topic/${topic.id}`}
            className="text-[11px] font-mono text-surface-600 hover:text-for-400 transition-colors"
          >
            Vote at lobby.market/topic/{topic.id.slice(0, 8)}
          </Link>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono text-surface-700">
          <kbd className="px-1.5 py-0.5 rounded bg-surface-300/40 border border-surface-400/30">F</kbd>
          <span>fullscreen</span>
          <kbd className="px-1.5 py-0.5 rounded bg-surface-300/40 border border-surface-400/30">R</kbd>
          <span>refresh</span>
          <kbd className="px-1.5 py-0.5 rounded bg-surface-300/40 border border-surface-400/30">←→</kbd>
          <span>navigate</span>
        </div>
      </div>
    </div>
  )
}
