'use client'

/**
 * /connections — Civic Connections
 *
 * Group 16 civic terms into 4 categories.
 * Yellow = easiest, Purple = hardest.
 *
 * Rules:
 *   • Select 4 tiles and press Submit
 *   • Correct → group revealed
 *   • Wrong → 1 mistake (4 mistakes = game over)
 *   • Win = all 4 groups solved
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Gamepad2,
  Lightbulb,
  RotateCcw,
  Share2,
  Shuffle,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  getDailyPuzzle,
  buildShareEmoji,
  type GroupColor,
  type PuzzleGroup,
} from './puzzles'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_connections_v1'
const MAX_MISTAKES = 4

// ─── Color styles ─────────────────────────────────────────────────────────────

const GROUP_STYLES: Record<GroupColor, {
  bg: string; border: string; text: string; badge: string; dot: string
}> = {
  yellow: {
    bg:     'bg-gold/15',
    border: 'border-gold/40',
    text:   'text-gold',
    badge:  'bg-gold/20 text-gold',
    dot:    'bg-gold',
  },
  green: {
    bg:     'bg-emerald/15',
    border: 'border-emerald/40',
    text:   'text-emerald',
    badge:  'bg-emerald/20 text-emerald',
    dot:    'bg-emerald',
  },
  blue: {
    bg:     'bg-for-500/15',
    border: 'border-for-500/40',
    text:   'text-for-300',
    badge:  'bg-for-500/20 text-for-300',
    dot:    'bg-for-400',
  },
  purple: {
    bg:     'bg-purple/15',
    border: 'border-purple/40',
    text:   'text-purple',
    badge:  'bg-purple/20 text-purple',
    dot:    'bg-purple',
  },
}

const COLOR_LABELS: Record<GroupColor, string> = {
  yellow: 'Easiest',
  green:  'Medium',
  blue:   'Hard',
  purple: 'Hardest',
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

interface SavedState {
  puzzleNumber: number
  solvedGroups: string[]           // group ids
  mistakes: number
  done: boolean
  won: boolean
  guessHistory: Array<{ items: string[]; correct: boolean }>
}

function loadSaved(puzzleNumber: number): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedState
    return parsed.puzzleNumber === puzzleNumber ? parsed : null
  } catch {
    return null
  }
}

function saveSaved(state: SavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch { /* best-effort */ }
}

// ─── Shuffle utility ──────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConnectionsClient() {
  const puzzle = getDailyPuzzle()
  const allItems = puzzle.groups.flatMap((g) => g.items)

  // Map item → group
  const itemToGroup = new Map<string, PuzzleGroup>()
  for (const g of puzzle.groups) {
    for (const item of g.items) {
      itemToGroup.set(item, g)
    }
  }

  // ── State ──────────────────────────────────────────────────────────────────

  const [tiles, setTiles] = useState<string[]>(() => shuffleArray(allItems))
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [solvedGroups, setSolvedGroups] = useState<PuzzleGroup[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [done, setDone] = useState(false)
  const [won, setWon] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [guessHistory, setGuessHistory] = useState<Array<{ items: string[]; correct: boolean }>>([])
  const [showShare, setShowShare] = useState(false)
  const [copied, setCopied] = useState(false)
  const [oneAway, setOneAway] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [hintGroup, setHintGroup] = useState<GroupColor | null>(null)

  const shakeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const oneAwayTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate from saved state
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    const saved = loadSaved(puzzle.puzzleNumber)
    if (saved) {
      const solvedIds = new Set(saved.solvedGroups)
      const resolved = puzzle.groups.filter((g) => solvedIds.has(g.id))
      setSolvedGroups(resolved)
      setMistakes(saved.mistakes)
      setDone(saved.done)
      setWon(saved.won)
      setGuessHistory(saved.guessHistory)
      if (saved.done) setShowShare(true)

      // Remove solved items from tile grid
      const remainingItems = allItems.filter(
        (item) => !resolved.some((g) => g.items.includes(item))
      )
      setTiles(shuffleArray(remainingItems))
    }
    setHydrated(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const solvedIds = new Set(solvedGroups.map((g) => g.id))
  const remainingGroups = puzzle.groups.filter((g) => !solvedIds.has(g.id))

  // ── Persist on state change ────────────────────────────────────────────────

  useEffect(() => {
    if (!hydrated) return
    saveSaved({
      puzzleNumber: puzzle.puzzleNumber,
      solvedGroups: solvedGroups.map((g) => g.id),
      mistakes,
      done,
      won,
      guessHistory,
    })
  }, [hydrated, puzzle.puzzleNumber, solvedGroups, mistakes, done, won, guessHistory])

  // ── Tile selection ─────────────────────────────────────────────────────────

  const toggleTile = useCallback((item: string) => {
    if (done) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(item)) {
        next.delete(item)
      } else if (next.size < 4) {
        next.add(item)
      }
      return next
    })
  }, [done])

  // ── Submit guess ───────────────────────────────────────────────────────────

  const submitGuess = useCallback(() => {
    if (selected.size !== 4 || done) return

    const guessedItems = Array.from(selected)
    const record = { items: guessedItems, correct: false }

    // Check if all 4 belong to the same group
    const groups = guessedItems.map((item) => itemToGroup.get(item))
    const firstGroup = groups[0]
    const allSame = groups.every((g) => g?.id === firstGroup?.id)

    if (allSame && firstGroup && !solvedIds.has(firstGroup.id)) {
      // Correct!
      record.correct = true
      const newSolved = [...solvedGroups, firstGroup]
      setSolvedGroups(newSolved)
      setTiles((prev) => prev.filter((t) => !selected.has(t)))
      setSelected(new Set())
      setGuessHistory((prev) => [...prev, record])

      if (newSolved.length === 4) {
        setDone(true)
        setWon(true)
        setTimeout(() => setShowShare(true), 600)
      }
    } else {
      // Wrong — check if one away
      let bestMatchCount = 0
      for (const g of remainingGroups) {
        const matchCount = guessedItems.filter((item) => g.items.includes(item)).length
        if (matchCount > bestMatchCount) bestMatchCount = matchCount
      }
      if (bestMatchCount === 3) {
        setOneAway(true)
        if (oneAwayTimeout.current) clearTimeout(oneAwayTimeout.current)
        oneAwayTimeout.current = setTimeout(() => setOneAway(false), 1800)
      }

      setGuessHistory((prev) => [...prev, record])
      const newMistakes = mistakes + 1
      setMistakes(newMistakes)
      setSelected(new Set())

      setShaking(true)
      if (shakeTimeout.current) clearTimeout(shakeTimeout.current)
      shakeTimeout.current = setTimeout(() => setShaking(false), 500)

      if (newMistakes >= MAX_MISTAKES) {
        setDone(true)
        setWon(false)
        setTimeout(() => setShowShare(true), 800)
      }
    }
  }, [selected, done, itemToGroup, solvedIds, solvedGroups, remainingGroups, mistakes])

  // ── Deselect all ──────────────────────────────────────────────────────────

  const deselectAll = useCallback(() => setSelected(new Set()), [])

  // ── Shuffle remaining tiles ────────────────────────────────────────────────

  const shuffleTiles = useCallback(() => {
    setTiles((prev) => shuffleArray(prev))
  }, [])

  // ── Hint ──────────────────────────────────────────────────────────────────

  const triggerHint = useCallback(() => {
    if (!remainingGroups.length) return
    const unsolvedColors = remainingGroups.map((g) => g.color)
    const order: GroupColor[] = ['yellow', 'green', 'blue', 'purple']
    const next = order.find((c) => unsolvedColors.includes(c))
    setHintGroup(next ?? null)
    setShowHint(true)
    setTimeout(() => setShowHint(false), 3000)
  }, [remainingGroups])

  // ── Share ─────────────────────────────────────────────────name-─────────────

  const shareResult = useCallback(async () => {
    const emojiGrid = buildShareEmoji(guessHistory, puzzle.groups)
    const mistakeLabel = won
      ? mistakes === 0 ? 'Perfect!' : `${mistakes} mistake${mistakes !== 1 ? 's' : ''}`
      : 'Lost'
    const text = [
      `Civic Connections #${puzzle.puzzleNumber}`,
      `${puzzle.dateString}`,
      mistakeLabel,
      '',
      emojiGrid,
      '',
      'lobby.market/connections',
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: show text in alert
    }
  }, [guessHistory, puzzle, won, mistakes])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && selected.size === 4) submitGuess()
      if (e.key === 'Escape') deselectAll()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [submitGuess, deselectAll, selected.size])

  // ─────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300 flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-center h-14 px-4 gap-3">
          <Link
            href="/arcade"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to Arcade"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Gamepad2 className="h-4 w-4 text-purple flex-shrink-0" />
            <span className="text-sm font-mono text-surface-700 truncate">Civic Connections</span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-[11px] font-mono text-surface-500">
            <span className="hidden sm:block truncate">{puzzle.dateString}</span>
            <span className="text-surface-600">·</span>
            <span>#{puzzle.puzzleNumber}</span>
          </div>
        </div>
      </header>

      {/* ── Main game area ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-start py-6 px-4 gap-5 max-w-lg mx-auto w-full">

        {/* Instructions */}
        <p className="text-sm font-mono text-surface-500 text-center">
          Group 4 civic terms that share something in common.
        </p>

        {/* Mistake tracker */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-surface-500">Mistakes:</span>
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-4 h-4 rounded-full border transition-all duration-300',
                  i < mistakes
                    ? 'bg-against-500 border-against-500'
                    : 'bg-transparent border-surface-400'
                )}
              />
            ))}
          </div>
          {won && (
            <span className="text-xs font-mono text-emerald ml-1 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {mistakes === 0 ? 'Perfect!' : 'Solved!'}
            </span>
          )}
          {!won && done && (
            <span className="text-xs font-mono text-against-400 ml-1 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              Game over
            </span>
          )}
        </div>

        {/* One away banner */}
        <AnimatePresence>
          {oneAway && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="w-full text-center py-2 px-4 rounded-xl bg-gold/10 border border-gold/30 text-gold text-xs font-mono font-semibold"
            >
              One away!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hint banner */}
        <AnimatePresence>
          {showHint && hintGroup && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={cn(
                'w-full text-center py-2 px-4 rounded-xl border text-xs font-mono',
                GROUP_STYLES[hintGroup].bg,
                GROUP_STYLES[hintGroup].border,
                GROUP_STYLES[hintGroup].text
              )}
            >
              Hint: look for {COLOR_LABELS[hintGroup].toLowerCase()} connections ({hintGroup})
            </motion.div>
          )}
        </AnimatePresence>

        {/* Solved groups */}
        <div className="w-full space-y-2">
          <AnimatePresence>
            {solvedGroups.map((group) => {
              const s = GROUP_STYLES[group.color]
              return (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    'w-full rounded-xl border p-3 flex flex-col gap-1',
                    s.bg, s.border
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wide', s.text)}>
                      {group.category}
                    </span>
                    <span className={cn('ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full', s.badge)}>
                      {COLOR_LABELS[group.color]}
                    </span>
                  </div>
                  <p className={cn('text-sm font-mono font-semibold', s.text)}>
                    {group.items.join(' · ')}
                  </p>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Tile grid */}
        {tiles.length > 0 && (
          <motion.div
            animate={shaking ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full grid grid-cols-4 gap-2"
          >
            {tiles.map((item) => {
              const isSel = selected.has(item)
              return (
                <motion.button
                  key={item}
                  onClick={() => toggleTile(item)}
                  whileTap={{ scale: 0.95 }}
                  aria-pressed={isSel}
                  disabled={done}
                  className={cn(
                    'relative rounded-xl border p-2 min-h-[64px] flex items-center justify-center text-center',
                    'text-[11px] font-mono font-bold leading-tight transition-all duration-150',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400',
                    isSel
                      ? 'bg-for-500/25 border-for-400 text-white scale-[1.03] shadow-lg shadow-for-500/20'
                      : 'bg-surface-200 border-surface-300 text-white hover:bg-surface-300 hover:border-surface-400',
                    done && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  {item}
                </motion.button>
              )
            })}
          </motion.div>
        )}

        {/* Game over — reveal remaining groups */}
        {!won && done && remainingGroups.length > 0 && (
          <div className="w-full space-y-2">
            <p className="text-xs font-mono text-surface-500 text-center">The answers:</p>
            {remainingGroups.map((group) => {
              const s = GROUP_STYLES[group.color]
              return (
                <div
                  key={group.id}
                  className={cn('w-full rounded-xl border p-3 flex flex-col gap-1 opacity-80', s.bg, s.border)}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wide', s.text)}>
                      {group.category}
                    </span>
                    <span className={cn('ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full', s.badge)}>
                      {COLOR_LABELS[group.color]}
                    </span>
                  </div>
                  <p className={cn('text-sm font-mono font-semibold', s.text)}>
                    {group.items.join(' · ')}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Action buttons */}
        {!done && (
          <div className="w-full flex items-center gap-2 flex-wrap">
            <button
              onClick={shuffleTiles}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Shuffle
            </button>
            <button
              onClick={deselectAll}
              disabled={selected.size === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Deselect
            </button>
            <button
              onClick={triggerHint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Hint
            </button>
            <button
              onClick={submitGuess}
              disabled={selected.size !== 4}
              className={cn(
                'ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg border text-xs font-mono font-semibold transition-all',
                selected.size === 4
                  ? 'bg-for-500 border-for-400 text-white hover:bg-for-400 shadow-md shadow-for-500/30'
                  : 'bg-surface-200 border-surface-300 text-surface-500 cursor-not-allowed opacity-50'
              )}
            >
              Submit
            </button>
          </div>
        )}

        {/* Keyboard hint */}
        {!done && (
          <p className="text-[10px] font-mono text-surface-600 text-center">
            Press Enter to submit · Esc to deselect
          </p>
        )}

        {/* Share / results panel */}
        <AnimatePresence>
          {showShare && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full rounded-2xl border border-surface-300 bg-surface-200/60 p-5 space-y-4"
            >
              <div className="text-center space-y-1">
                <p className="font-mono text-lg font-bold text-white">
                  {won ? (mistakes === 0 ? 'Perfect game!' : 'Well done!') : 'Better luck tomorrow'}
                </p>
                <p className="text-xs font-mono text-surface-500">
                  {won
                    ? `Solved in ${guessHistory.filter((g) => g.correct).length} correct guess${guessHistory.filter((g) => g.correct).length !== 1 ? 'es' : ''} · ${mistakes} mistake${mistakes !== 1 ? 's' : ''}`
                    : `${MAX_MISTAKES} mistakes — puzzle #${puzzle.puzzleNumber}`}
                </p>
              </div>

              {/* Emoji guess history */}
              <div className="flex flex-col items-center gap-1 font-mono text-xl leading-none">
                {guessHistory.map((guess, i) => {
                  const colorEmoji: Record<GroupColor, string> = {
                    yellow: '🟨', green: '🟩', blue: '🟦', purple: '🟪'
                  }
                  return (
                    <div key={i} className="flex gap-0.5">
                      {guess.items.map((item, j) => {
                        const g = puzzle.groups.find((grp) => grp.items.includes(item))
                        return (
                          <span key={j}>{g ? colorEmoji[g.color] : '⬛'}</span>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2 justify-center">
                <button
                  onClick={shareResult}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-300 border border-surface-400 text-xs font-mono text-white hover:bg-surface-400 transition-colors"
                >
                  {copied ? (
                    <><Copy className="h-3.5 w-3.5 text-emerald" /> Copied!</>
                  ) : (
                    <><Share2 className="h-3.5 w-3.5" /> Copy Result</>
                  )}
                </button>
                <Link
                  href="/arcade"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-500/20 border border-for-500/30 text-xs font-mono text-for-300 hover:bg-for-500/30 transition-colors"
                >
                  <Gamepad2 className="h-3.5 w-3.5" />
                  More Games
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Color legend */}
        {!done && (
          <div className="w-full flex flex-wrap items-center justify-center gap-3 mt-1">
            {(['yellow', 'green', 'blue', 'purple'] as GroupColor[]).map((color) => {
              const s = GROUP_STYLES[color]
              return (
                <div key={color} className="flex items-center gap-1.5">
                  <div className={cn('w-2.5 h-2.5 rounded-full', s.dot)} />
                  <span className="text-[10px] font-mono text-surface-500">{COLOR_LABELS[color]}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Related links */}
        <div className="w-full grid grid-cols-3 gap-2 mt-2">
          {[
            { href: '/wordle',         label: 'Wordle',    color: 'text-emerald' },
            { href: '/trivia',         label: 'Trivia',    color: 'text-for-400' },
            { href: '/knowledge-test', label: 'Quiz',      color: 'text-purple'  },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-center py-2 px-3 rounded-xl bg-surface-200 border border-surface-300 text-[10px] font-mono hover:border-surface-400 transition-colors"
            >
              <span className={cn('font-semibold', link.color)}>{link.label}</span>
            </Link>
          ))}
        </div>

      </main>
    </div>
  )
}
