'use client'

/**
 * /bingo — Civic Bingo
 *
 * A 5×5 weekly bingo card of civic topics.
 * Topics that reach "law" status are auto-marked.
 * Players can also mark any square they've personally voted on.
 * Win lines (5-in-a-row horizontal / vertical / diagonal) trigger a
 * confetti-burst animation.
 *
 * Card is deterministic per ISO week — every user sees the same 24 topics
 * arranged in the same order. Marks are persisted in localStorage.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  Trophy,
  Zap,
  FileText,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { BingoCard, BingoTopic } from '@/app/api/bingo/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'lm_bingo_'

// Grid positions 0-24; position 12 is the FREE center
const FREE_CELL = 12

// Win lines: all possible 5-in-a-row combos on a 5×5 grid
const WIN_LINES: number[][] = [
  // Rows
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  // Columns
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  // Diagonals
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
]

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-surface-600',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  law: Gavel,
  voting: Scale,
  active: Zap,
  proposed: FileText,
  failed: FileText,
}

const STATUS_COLOR: Record<string, string> = {
  law: 'text-gold',
  voting: 'text-purple',
  active: 'text-for-400',
  proposed: 'text-surface-500',
  failed: 'text-against-400',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStorageKey(week: string) {
  return `${STORAGE_KEY_PREFIX}${week}`
}

function loadMarks(week: string): Set<number> {
  try {
    const raw = localStorage.getItem(getStorageKey(week))
    if (!raw) return new Set([FREE_CELL])
    const arr = JSON.parse(raw) as number[]
    const s = new Set(arr)
    s.add(FREE_CELL)
    return s
  } catch {
    return new Set([FREE_CELL])
  }
}

function saveMarks(week: string, marks: Set<number>) {
  try {
    localStorage.setItem(getStorageKey(week), JSON.stringify([...marks]))
  } catch {
    // best-effort
  }
}

function findWinLines(marks: Set<number>): number[][] {
  return WIN_LINES.filter((line) => line.every((pos) => marks.has(pos)))
}

// Build the 25-cell grid: insert FREE at position 12, topics fill the rest
function buildGrid(topics: BingoTopic[]): (BingoTopic | null)[] {
  const grid: (BingoTopic | null)[] = []
  for (let i = 0; i < 25; i++) {
    if (i === FREE_CELL) {
      grid.push(null) // null = FREE
    } else {
      const topicIdx = i < FREE_CELL ? i : i - 1
      grid.push(topics[topicIdx] ?? null)
    }
  }
  return grid
}

// ─── Confetti particle ────────────────────────────────────────────────────────

function ConfettiParticle({ delay }: { delay: number }) {
  const colors = [
    'bg-for-400', 'bg-against-400', 'bg-gold', 'bg-emerald', 'bg-purple',
  ]
  const color = colors[Math.floor(Math.random() * colors.length)]
  const x = (Math.random() - 0.5) * 300
  const startY = -20
  const endY = window.innerHeight + 50

  return (
    <motion.div
      className={cn('fixed top-0 w-2 h-2 rounded-sm pointer-events-none z-50', color)}
      style={{ left: `calc(50% + ${x}px)` }}
      initial={{ y: startY, opacity: 1, rotate: 0, scale: 1 }}
      animate={{ y: endY, opacity: 0, rotate: 720, scale: 0.5 }}
      transition={{ duration: 2 + Math.random() * 1.5, delay, ease: 'easeIn' }}
    />
  )
}

// ─── Bingo Cell ───────────────────────────────────────────────────────────────

interface CellProps {
  topic: BingoTopic | null
  position: number
  isMarked: boolean
  isWinCell: boolean
  isFree: boolean
  onClick: () => void
}

function BingoCell({ topic, isMarked, isWinCell, isFree, onClick }: CellProps) {
  const StatusIcon = topic ? (STATUS_ICON[topic.status] ?? FileText) : null
  const categoryColor = topic?.category ? (CATEGORY_COLOR[topic.category] ?? 'text-surface-500') : ''

  return (
    <motion.button
      onClick={onClick}
      disabled={isFree}
      whileHover={!isFree && !isMarked ? { scale: 1.02 } : {}}
      whileTap={!isFree ? { scale: 0.97 } : {}}
      aria-label={isFree ? 'Free space' : topic?.statement ?? 'Empty cell'}
      aria-pressed={isMarked}
      className={cn(
        'relative flex flex-col items-start justify-between rounded-xl border p-2 sm:p-2.5',
        'text-left transition-all duration-200 overflow-hidden',
        'aspect-square min-h-[72px] sm:min-h-[80px]',
        isFree
          ? 'bg-gold/15 border-gold/40 cursor-default'
          : isWinCell
          ? 'bg-for-500/25 border-for-500/60 shadow-md shadow-for-900/30'
          : isMarked
          ? 'bg-surface-300/80 border-surface-400/80'
          : 'bg-surface-200/60 border-surface-300/60 hover:border-surface-400/80 hover:bg-surface-200 cursor-pointer'
      )}
    >
      {/* Win shimmer */}
      <AnimatePresence>
        {isWinCell && (
          <motion.div
            key="shimmer"
            className="absolute inset-0 bg-for-500/10 rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </AnimatePresence>

      {/* Mark overlay */}
      <AnimatePresence>
        {isMarked && !isFree && (
          <motion.div
            key="mark"
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <div
              className={cn(
                'rounded-full p-1',
                isWinCell ? 'bg-for-500/40' : 'bg-surface-400/30'
              )}
            >
              <CheckCircle2
                className={cn(
                  'h-6 w-6 sm:h-7 sm:w-7',
                  isWinCell ? 'text-for-300' : 'text-surface-500'
                )}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FREE cell content */}
      {isFree ? (
        <div className="flex flex-col items-center justify-center w-full h-full gap-1">
          <Star className="h-5 w-5 sm:h-6 sm:w-6 text-gold fill-gold/40" />
          <span className="text-[10px] sm:text-xs font-mono font-bold text-gold tracking-widest">
            FREE
          </span>
        </div>
      ) : (
        <>
          {/* Status + category row */}
          <div className="flex items-center gap-1 w-full mb-0.5">
            {StatusIcon && (
              <StatusIcon
                className={cn(
                  'h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0',
                  STATUS_COLOR[topic?.status ?? ''] ?? 'text-surface-500'
                )}
              />
            )}
            {topic?.category && (
              <span
                className={cn('text-[8px] sm:text-[9px] font-mono truncate', categoryColor)}
              >
                {topic.category}
              </span>
            )}
          </div>

          {/* Statement */}
          <p
            className={cn(
              'text-[9px] sm:text-[10px] font-mono leading-tight flex-1',
              isMarked ? 'text-surface-500 line-through' : 'text-surface-700'
            )}
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {topic?.statement}
          </p>

          {/* Law badge */}
          {topic?.status === 'law' && !isMarked && (
            <div className="mt-0.5 self-start">
              <span className="text-[7px] sm:text-[8px] font-mono font-bold text-gold bg-gold/10 border border-gold/30 rounded px-1 py-0.5 tracking-wider">
                LAW
              </span>
            </div>
          )}
        </>
      )}
    </motion.button>
  )
}

// ─── Win Banner ───────────────────────────────────────────────────────────────

function WinBanner({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-for-500/15 border border-for-500/40 mb-4"
    >
      <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/20 border border-for-500/30 flex-shrink-0">
        <Trophy className="h-4 w-4 text-for-400" />
      </div>
      <div>
        <p className="text-sm font-mono font-bold text-white">
          BINGO! {count > 1 ? `${count} lines!` : ''}
        </p>
        <p className="text-xs font-mono text-surface-500">
          {count === 1
            ? 'Five in a row — your civic sense is sharp.'
            : `${count} winning lines — civic genius confirmed.`}
        </p>
      </div>
      <Sparkles className="h-4 w-4 text-gold ml-auto" />
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BingoClient() {
  const [card, setCard] = useState<BingoCard | null>(null)
  const [marks, setMarks] = useState<Set<number>>(new Set([FREE_CELL]))
  const [winLines, setWinLines] = useState<number[][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const prevWinCount = useRef(0)

  // Load card from API
  const loadCard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bingo')
      if (!res.ok) throw new Error('Failed to load')
      const data = (await res.json()) as BingoCard
      setCard(data)
      const saved = loadMarks(data.week)
      setMarks(saved)
      const wl = findWinLines(saved)
      setWinLines(wl)
      prevWinCount.current = wl.length
    } catch {
      setError('Could not load your bingo card.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCard()
  }, [loadCard])

  // Auto-mark any topics that have become law
  useEffect(() => {
    if (!card) return
    const grid = buildGrid(card.topics)
    let changed = false
    const updated = new Set(marks)
    grid.forEach((topic, pos) => {
      if (topic?.status === 'law' && !updated.has(pos)) {
        updated.add(pos)
        changed = true
      }
    })
    if (changed) {
      updated.add(FREE_CELL)
      setMarks(updated)
      saveMarks(card.week, updated)
      const wl = findWinLines(updated)
      setWinLines(wl)
      if (wl.length > prevWinCount.current) {
        setShowConfetti(true)
        prevWinCount.current = wl.length
        setTimeout(() => setShowConfetti(false), 4000)
      }
    }
  }, [card, marks])

  function toggleMark(position: number) {
    if (!card || position === FREE_CELL) return
    const updated = new Set(marks)
    if (updated.has(position)) {
      updated.delete(position)
    } else {
      updated.add(position)
    }
    updated.add(FREE_CELL)
    setMarks(updated)
    saveMarks(card.week, updated)
    const wl = findWinLines(updated)
    const prevCount = winLines.length
    setWinLines(wl)
    if (wl.length > prevCount) {
      setShowConfetti(true)
      prevWinCount.current = wl.length
      setTimeout(() => setShowConfetti(false), 4000)
    }
  }

  const winCellSet = new Set(winLines.flat())
  const markedCount = marks.size
  const grid = card ? buildGrid(card.topics) : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      {/* Confetti burst on win */}
      <AnimatePresence>
        {showConfetti &&
          Array.from({ length: 40 }).map((_, i) => (
            <ConfettiParticle key={i} delay={i * 0.04} />
          ))}
      </AnimatePresence>

      <main className="max-w-2xl mx-auto px-3 sm:px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Star className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="text-xl font-mono font-bold text-white tracking-tight">
                Civic Bingo
              </h1>
              <p className="text-xs font-mono text-surface-500">
                {card ? `Week ${card.week} · Mark laws as they pass` : 'Weekly civic game'}
              </p>
            </div>
          </div>
          <button
            onClick={loadCard}
            disabled={loading}
            aria-label="Refresh bingo card"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* How it works */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-surface-500 mb-5 px-1">
          <span className="flex items-center gap-1">
            <Gavel className="h-3 w-3 text-gold" /> Topics reaching LAW auto-mark
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-for-400" /> Click any cell to mark manually
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="h-3 w-3 text-for-400" /> 5 in a row = BINGO
          </span>
        </div>

        {/* Win banner */}
        <WinBanner count={winLines.length} />

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {Array.from({ length: 25 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl min-h-[72px] sm:min-h-[80px]" />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <EmptyState
            icon={Scale}
            title="Card unavailable"
            description={error}
            actions={[{ label: 'Try again', onClick: loadCard }]}
          />
        )}

        {/* Bingo grid */}
        {!loading && !error && card && (
          <motion.div
            className="grid grid-cols-5 gap-1.5 sm:gap-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {grid.map((topic, pos) => (
              <BingoCell
                key={pos}
                topic={topic}
                position={pos}
                isMarked={marks.has(pos)}
                isWinCell={winCellSet.has(pos)}
                isFree={pos === FREE_CELL}
                onClick={() => toggleMark(pos)}
              />
            ))}
          </motion.div>
        )}

        {/* Progress + stats */}
        {!loading && !error && card && (
          <motion.div
            className="mt-5 grid grid-cols-3 gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
              <span className="text-lg font-mono font-bold text-white">{markedCount}</span>
              <span className="text-[10px] font-mono text-surface-500 text-center">marked</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
              <span className="text-lg font-mono font-bold text-white">{winLines.length}</span>
              <span className="text-[10px] font-mono text-surface-500 text-center">
                {winLines.length === 1 ? 'bingo' : 'bingos'}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
              <span className="text-lg font-mono font-bold text-gold">
                {grid.filter((t) => t?.status === 'law').length}
              </span>
              <span className="text-[10px] font-mono text-surface-500 text-center">
                laws passed
              </span>
            </div>
          </motion.div>
        )}

        {/* Topic detail links */}
        {!loading && !error && card && (
          <div className="mt-6 space-y-2">
            <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider px-1 mb-3">
              This week&apos;s topics
            </p>
            {card.topics.map((topic, i) => {
              const StatusIcon = STATUS_ICON[topic.status] ?? FileText
              const cellPos = i < FREE_CELL ? i : i + 1
              const isMarked = marks.has(cellPos)

              return (
                <Link
                  key={topic.id}
                  href={`/topic/${topic.id}`}
                  className={cn(
                    'flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-colors',
                    isMarked
                      ? 'bg-surface-300/40 border-surface-400/40'
                      : 'bg-surface-200/40 border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/80'
                  )}
                >
                  <StatusIcon
                    className={cn(
                      'h-3.5 w-3.5 mt-0.5 flex-shrink-0',
                      STATUS_COLOR[topic.status] ?? 'text-surface-500'
                    )}
                  />
                  <span
                    className={cn(
                      'text-xs font-mono flex-1 leading-relaxed',
                      isMarked ? 'line-through text-surface-500' : 'text-surface-700'
                    )}
                  >
                    {topic.statement}
                  </span>
                  {topic.status === 'law' && (
                    <span className="text-[9px] font-mono font-bold text-gold bg-gold/10 border border-gold/30 rounded px-1 py-0.5 flex-shrink-0">
                      LAW
                    </span>
                  )}
                  <ArrowRight className="h-3 w-3 text-surface-600 flex-shrink-0 mt-0.5" />
                </Link>
              )
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
