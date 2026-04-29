'use client'

/**
 * /wordle — Civic Wordle
 *
 * A daily Wordle-style word game using civic vocabulary.
 * One 5-letter word per day (same for every player, reset at UTC midnight).
 * 6 attempts. Colour feedback: 🟦 correct position, 🟨 present, ⬛ absent.
 *
 * Progress is persisted in localStorage so refreshing doesn't lose state.
 * Share button copies emoji results to clipboard.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Gamepad2,
  Share2,
  Trophy,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import {
  getWordForDate,
  scoreGuess,
  buildKeyboardState,
  buildShareText,
  todayUTC,
  type GuessResult,
  type LetterState,
} from '@/lib/wordle/words'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_GUESSES = 6
const WORD_LENGTH = 5
const LS_KEY = 'lm_wordle_v1'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedState {
  date: string
  guesses: GuessResult[][]
  currentGuess: string
  gameOver: boolean
  won: boolean
}

// ─── Tile component ───────────────────────────────────────────────────────────

const STATE_CLASSES: Record<LetterState, string> = {
  correct: 'bg-for-600 border-for-500 text-white',
  present: 'bg-gold/80 border-gold text-black',
  absent:  'bg-surface-400 border-surface-400 text-surface-700',
  empty:   'bg-transparent border-surface-400 text-white',
}

function Tile({
  letter,
  state,
  delay = 0,
  reveal = false,
  bounce = false,
}: {
  letter: string
  state: LetterState
  delay?: number
  reveal?: boolean
  bounce?: boolean
}) {
  return (
    <motion.div
      initial={false}
      animate={
        reveal
          ? { rotateX: [0, -90, 0], transition: { duration: 0.5, delay } }
          : bounce
          ? { scale: [1, 1.1, 1], transition: { duration: 0.12 } }
          : {}
      }
      className={cn(
        'w-12 h-12 sm:w-14 sm:h-14 border-2 rounded-lg flex items-center justify-center',
        'text-xl font-black tracking-widest uppercase select-none',
        'transition-colors',
        state === 'empty' && letter ? 'border-surface-500 scale-100' : '',
        STATE_CLASSES[state]
      )}
      aria-label={letter ? `${letter}, ${state}` : 'empty'}
    >
      {letter}
    </motion.div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function GuessRow({
  guess,
  reveal = false,
  shake = false,
  isCurrent = false,
  currentTyped = '',
}: {
  guess?: GuessResult[]
  reveal?: boolean
  shake?: boolean
  isCurrent?: boolean
  currentTyped?: string
}) {
  return (
    <motion.div
      animate={shake ? { x: [0, -8, 8, -8, 8, 0] } : {}}
      transition={{ duration: 0.35 }}
      className="flex gap-1.5 sm:gap-2 justify-center"
      role="row"
    >
      {Array.from({ length: WORD_LENGTH }).map((_, i) => {
        if (guess) {
          return (
            <Tile
              key={i}
              letter={guess[i].letter}
              state={guess[i].state}
              reveal={reveal}
              delay={i * 0.12}
            />
          )
        }
        const letter = isCurrent ? (currentTyped[i] ?? '') : ''
        return (
          <Tile
            key={i}
            letter={letter}
            state="empty"
            bounce={isCurrent && i === currentTyped.length - 1}
          />
        )
      })}
    </motion.div>
  )
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

const ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
]

const KEY_STATE_CLASSES: Record<LetterState, string> = {
  correct: 'bg-for-600 border-for-500 text-white',
  present: 'bg-gold/80 border-gold text-black',
  absent:  'bg-surface-500 border-surface-500 text-surface-600',
  empty:   'bg-surface-200 border-surface-300 text-white hover:bg-surface-300',
}

function Keyboard({
  keyState,
  onKey,
  disabled,
}: {
  keyState: Record<string, LetterState>
  onKey: (key: string) => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5 items-center" aria-label="On-screen keyboard">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1 sm:gap-1.5 justify-center">
          {row.map((key) => {
            const isSpecial = key === 'ENTER' || key === '⌫'
            const state = !isSpecial ? (keyState[key] ?? 'empty') : 'empty'
            return (
              <button
                key={key}
                aria-label={key === '⌫' ? 'Backspace' : key}
                disabled={disabled}
                onClick={() => onKey(key)}
                className={cn(
                  'h-12 sm:h-14 rounded-lg border font-bold text-xs sm:text-sm transition-colors',
                  'active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  isSpecial ? 'px-2 sm:px-3 min-w-[4rem] sm:min-w-[4.5rem] text-[11px] sm:text-xs' : 'w-8 sm:w-10',
                  KEY_STATE_CLASSES[state]
                )}
              >
                {key}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full bg-white text-surface-900 text-sm font-semibold shadow-lg"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Result modal ─────────────────────────────────────────────────────────────

function ResultModal({
  won,
  word,
  guesses,
  wordleNumber,
  onClose,
}: {
  won: boolean
  word: string
  guesses: GuessResult[][]
  wordleNumber: number
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(() => {
    const text = buildShareText(guesses, wordleNumber, won)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [guesses, wordleNumber, won])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-surface-100 border border-surface-300 rounded-2xl p-6 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {won ? (
              <Trophy className="h-5 w-5 text-gold" />
            ) : (
              <X className="h-5 w-5 text-against-400" />
            )}
            <span className="font-bold text-white text-lg">
              {won ? 'Solved!' : 'Better luck tomorrow'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-surface-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Word reveal */}
        <div className="text-center space-y-1">
          <p className="text-xs text-surface-500 uppercase tracking-widest font-mono">
            Today&apos;s word
          </p>
          <p className="text-3xl font-black text-white tracking-[0.2em] uppercase">{word}</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Guesses', value: won ? guesses.length : '—' },
            { label: 'Puzzle', value: `#${wordleNumber}` },
            { label: 'Result', value: won ? `${guesses.length}/6` : 'X/6' },
          ].map(({ label, value }) => (
            <div key={label} className="text-center p-2 bg-surface-200 rounded-xl">
              <div className="text-lg font-black text-white">{value}</div>
              <div className="text-[10px] text-surface-500 font-mono">{label}</div>
            </div>
          ))}
        </div>

        {/* Share */}
        <button
          onClick={handleShare}
          className={cn(
            'w-full flex items-center justify-center gap-2 h-11 rounded-xl font-semibold text-sm transition-all',
            copied
              ? 'bg-emerald/20 border border-emerald/40 text-emerald'
              : 'bg-for-600 hover:bg-for-700 text-white'
          )}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              Copied to clipboard!
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              Share result
            </>
          )}
        </button>

        {/* Next game */}
        <p className="text-center text-xs text-surface-500">
          New word at midnight UTC · Come back tomorrow!
        </p>
      </motion.div>
    </motion.div>
  )
}

// ─── How-to-play modal ────────────────────────────────────────────────────────

function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-surface-100 border border-surface-300 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <span className="font-bold text-white text-lg">How to play</span>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-surface-500 leading-relaxed">
          Guess the civic word in 6 tries. Each word relates to democracy, law,
          politics, or civic life.
        </p>

        <div className="space-y-3">
          {/* Example rows */}
          <div className="space-y-1">
            <div className="flex gap-1.5">
              {['L', 'O', 'B', 'B', 'Y'].map((l, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-10 h-10 border-2 rounded-lg flex items-center justify-center text-base font-black',
                    i === 0 ? 'bg-for-600 border-for-500 text-white' : 'bg-surface-400 border-surface-400 text-surface-700'
                  )}
                >
                  {l}
                </div>
              ))}
            </div>
            <p className="text-xs text-surface-500">
              <span className="text-for-300">L</span> is in the word and in the correct spot.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex gap-1.5">
              {['V', 'O', 'T', 'E', 'S'].map((l, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-10 h-10 border-2 rounded-lg flex items-center justify-center text-base font-black',
                    i === 2 ? 'bg-gold/80 border-gold text-black' : 'bg-surface-400 border-surface-400 text-surface-700'
                  )}
                >
                  {l}
                </div>
              ))}
            </div>
            <p className="text-xs text-surface-500">
              <span className="text-gold">T</span> is in the word but in the wrong spot.
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex gap-1.5">
              {['P', 'A', 'R', 'T', 'Y'].map((l, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-10 h-10 border-2 rounded-lg flex items-center justify-center text-base font-black',
                    i === 1 ? 'bg-surface-400 border-surface-400 text-surface-600 opacity-60' : 'bg-surface-400 border-surface-400 text-surface-700'
                  )}
                >
                  {l}
                </div>
              ))}
            </div>
            <p className="text-xs text-surface-500">
              <span className="text-surface-500">A</span> is not in the word at all.
            </p>
          </div>
        </div>

        <div className="pt-1 border-t border-surface-300">
          <p className="text-xs text-surface-500">
            A new word is available each day at midnight UTC. All words come from civic
            vocabulary: laws, voting, democracy, and governance.
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WordlePage() {
  const today = todayUTC()
  const targetWord = getWordForDate(today)

  // Compute puzzle number (days since epoch)
  const epoch = new Date('2025-01-01T00:00:00Z')
  const d = new Date(today)
  const wordleNumber =
    Math.floor(
      (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - epoch.getTime()) /
        86_400_000
    ) + 1

  // ── State ──────────────────────────────────────────────────────────────────
  const [guesses, setGuesses] = useState<GuessResult[][]>([])
  const [currentGuess, setCurrentGuess] = useState('')
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [shake, setShake] = useState(false)
  const [reveal, setReveal] = useState<number | null>(null) // row index being revealed
  const [toast, setToast] = useState<string | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [showHowTo, setShowHowTo] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Persist / restore ──────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const saved: SavedState = JSON.parse(raw)
        if (saved.date === today) {
          setGuesses(saved.guesses)
          setCurrentGuess(saved.currentGuess ?? '')
          setGameOver(saved.gameOver)
          setWon(saved.won)
          if (saved.gameOver) {
            // show result after a short delay so the grid animates in
            setTimeout(() => setShowResult(true), 500)
          }
        }
      }
    } catch {
      // corrupt storage — start fresh
    }
    setHydrated(true)
  }, [today])

  const persist = useCallback(
    (
      g: GuessResult[][],
      cg: string,
      go: boolean,
      w: boolean
    ) => {
      const state: SavedState = { date: today, guesses: g, currentGuess: cg, gameOver: go, won: w }
      localStorage.setItem(LS_KEY, JSON.stringify(state))
    },
    [today]
  )

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    setToast(msg)
    toastTimeout.current = setTimeout(() => setToast(null), 2000)
  }, [])

  // ── Input handler ──────────────────────────────────────────────────────────
  const handleKey = useCallback(
    (key: string) => {
      if (gameOver || reveal !== null) return

      if (key === '⌫' || key === 'BACKSPACE') {
        setCurrentGuess((prev) => {
          const next = prev.slice(0, -1)
          persist(guesses, next, false, false)
          return next
        })
        return
      }

      if (key === 'ENTER') {
        if (currentGuess.length < WORD_LENGTH) {
          showToast('Not enough letters')
          setShake(true)
          setTimeout(() => setShake(false), 400)
          return
        }

        const result = scoreGuess(currentGuess, targetWord)
        const nextGuesses = [...guesses, result]
        const didWin = result.every((r) => r.state === 'correct')
        const rowIdx = guesses.length

        setReveal(rowIdx)
        setTimeout(() => {
          setReveal(null)
          setGuesses(nextGuesses)
          setCurrentGuess('')

          if (didWin) {
            const msgs = ['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!']
            showToast(msgs[Math.min(rowIdx, msgs.length - 1)])
            setWon(true)
            setGameOver(true)
            persist(nextGuesses, '', true, true)
            setTimeout(() => setShowResult(true), 1800)
          } else if (nextGuesses.length >= MAX_GUESSES) {
            showToast(targetWord)
            setGameOver(true)
            persist(nextGuesses, '', true, false)
            setTimeout(() => setShowResult(true), 2200)
          } else {
            persist(nextGuesses, '', false, false)
          }
        }, WORD_LENGTH * 120 + 200)
        return
      }

      if (/^[A-Za-z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
        setCurrentGuess((prev) => {
          const next = (prev + key.toUpperCase()).slice(0, WORD_LENGTH)
          persist(guesses, next, false, false)
          return next
        })
      }
    },
    [currentGuess, gameOver, guesses, persist, reveal, showToast, targetWord]
  )

  // ── Physical keyboard ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Backspace') handleKey('BACKSPACE')
      else if (e.key === 'Enter') handleKey('ENTER')
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKey])

  // ── Derived state ──────────────────────────────────────────────────────────
  const keyState = buildKeyboardState(guesses)
  const revealRow = reveal !== null ? scoreGuess(currentGuess, targetWord) : null

  if (!hydrated) {
    return (
      <div className="flex flex-col h-screen bg-surface-50">
        <TopBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-surface-500 text-sm font-mono animate-pulse">Loading…</div>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />

      <Toast message={toast} />
      {showResult && (
        <ResultModal
          won={won}
          word={targetWord}
          guesses={guesses}
          wordleNumber={wordleNumber}
          onClose={() => setShowResult(false)}
        />
      )}
      {showHowTo && <HowToPlay onClose={() => setShowHowTo(false)} />}

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between h-12 px-4 border-b border-surface-300 bg-surface-100">
        <Link
          href="/arcade"
          className="flex items-center gap-1.5 text-surface-500 hover:text-white transition-colors text-sm"
          aria-label="Back to Arcade"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline font-mono">Arcade</span>
        </Link>

        <div className="flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-for-400" />
          <span className="font-mono text-sm font-semibold text-white">
            Civic Wordle <span className="text-surface-500">#{wordleNumber}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHowTo(true)}
            className="text-surface-500 hover:text-white transition-colors text-lg font-bold w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-200"
            aria-label="How to play"
          >
            ?
          </button>
          {gameOver && (
            <button
              onClick={() => setShowResult(true)}
              className="text-surface-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-200"
              aria-label="Show result"
            >
              <Trophy className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* ── Game grid ── */}
      <main className="flex-1 flex flex-col items-center justify-between py-4 px-4 overflow-hidden">
        <div className="flex flex-col gap-1.5 sm:gap-2">
          {Array.from({ length: MAX_GUESSES }).map((_, rowIdx) => {
            const submittedGuess = guesses[rowIdx]
            const isCurrent = rowIdx === guesses.length && reveal === null
            const isRevealing = rowIdx === reveal

            if (isRevealing && revealRow) {
              return (
                <GuessRow
                  key={rowIdx}
                  guess={revealRow}
                  reveal={true}
                  isCurrent={false}
                />
              )
            }

            return (
              <GuessRow
                key={rowIdx}
                guess={submittedGuess}
                reveal={false}
                shake={shake && isCurrent}
                isCurrent={isCurrent}
                currentTyped={isCurrent ? currentGuess : ''}
              />
            )
          })}
        </div>

        {/* ── Keyboard ── */}
        <div className="w-full max-w-sm pb-2">
          <Keyboard
            keyState={keyState}
            onKey={handleKey}
            disabled={gameOver || reveal !== null}
          />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
