'use client'

/**
 * Civic Crossword — interactive mini-crossword client.
 *
 * Click a white cell to select it (first click = across if available, else down).
 * Click the same cell again to toggle direction.
 * Type letters to fill, Backspace to clear, Arrow keys to navigate.
 * When every cell is filled correctly the solved state fires.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Copy,
  Gamepad2,
  Share2,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import { getPuzzleForDate, type Puzzle, type PuzzleWord } from './puzzles'

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_crossword_v1'

interface SavedState {
  date: string
  puzzleId: number
  inputs: Record<string, string>
  solved: boolean
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadSaved(puzzleId: number): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SavedState
    if (s.date !== todayUTC() || s.puzzleId !== puzzleId) return null
    return s
  } catch {
    return null
  }
}

function persistState(state: SavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // best-effort
  }
}

// ─── Grid types ───────────────────────────────────────────────────────────────

interface GridCell {
  isBlack: boolean
  solution: string
  number?: number
  acrossWordIdx: number | null   // index into puzzle.words
  downWordIdx: number | null
  row: number
  col: number
}

function buildGrid(puzzle: Puzzle): GridCell[][] {
  const { rows, cols, words } = puzzle

  const grid: GridCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      isBlack: true,
      solution: '',
      acrossWordIdx: null,
      downWordIdx: null,
      row: r,
      col: c,
    }))
  )

  // Mark letter cells and record which word(s) they belong to
  words.forEach((word, wi) => {
    for (let i = 0; i < word.word.length; i++) {
      const r = word.direction === 'down' ? word.row + i : word.row
      const c = word.direction === 'across' ? word.col + i : word.col
      const cell = grid[r][c]
      cell.isBlack = false
      cell.solution = word.word[i]
      if (word.direction === 'across') cell.acrossWordIdx = wi
      else cell.downWordIdx = wi
    }
  })

  // Assign clue numbers in reading order (left-to-right, top-to-bottom)
  let n = 1
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c]
      if (cell.isBlack) continue
      const startsAcross = words.some(
        (w) => w.direction === 'across' && w.row === r && w.col === c
      )
      const startsDown = words.some(
        (w) => w.direction === 'down' && w.row === r && w.col === c
      )
      if (startsAcross || startsDown) {
        cell.number = n++
      }
    }
  }

  return grid
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cellKey(r: number, c: number): string {
  return `${r},${c}`
}

function nextCellInWord(
  row: number,
  col: number,
  direction: 'across' | 'down',
  grid: GridCell[][]
): [number, number] | null {
  const nr = direction === 'down' ? row + 1 : row
  const nc = direction === 'across' ? col + 1 : col
  if (nr < grid.length && nc < grid[0].length && !grid[nr][nc].isBlack) {
    return [nr, nc]
  }
  return null
}

function prevCellInWord(
  row: number,
  col: number,
  direction: 'across' | 'down',
  grid: GridCell[][]
): [number, number] | null {
  const pr = direction === 'down' ? row - 1 : row
  const pc = direction === 'across' ? col - 1 : col
  if (pr >= 0 && pc >= 0 && !grid[pr][pc].isBlack) {
    return [pr, pc]
  }
  return null
}

// ─── Clue list derivation ─────────────────────────────────────────────────────

interface ClueEntry {
  number: number
  direction: 'across' | 'down'
  clue: string
  word: PuzzleWord
}

function buildClues(puzzle: Puzzle, grid: GridCell[][]): { across: ClueEntry[]; down: ClueEntry[] } {
  const across: ClueEntry[] = []
  const down: ClueEntry[] = []

  for (const word of puzzle.words) {
    const cell = grid[word.row][word.col]
    const entry: ClueEntry = {
      number: cell.number ?? 0,
      direction: word.direction,
      clue: word.clue,
      word,
    }
    if (word.direction === 'across') across.push(entry)
    else down.push(entry)
  }

  across.sort((a, b) => a.number - b.number)
  down.sort((a, b) => a.number - b.number)

  return { across, down }
}

// ─── Share helper ─────────────────────────────────────────────────────────────

function buildShareText(puzzle: Puzzle, inputs: Record<string, string>): string {
  const rows = puzzle.rows
  const cols = puzzle.cols
  const lines: string[] = [`Civic Crossword — ${puzzle.subtitle}`, '']
  for (let r = 0; r < rows; r++) {
    let line = ''
    for (let c = 0; c < cols; c++) {
      const k = cellKey(r, c)
      const cell = inputs[k]
      if (cell === undefined) {
        line += '⬛'
      } else if (cell === '') {
        line += '⬜'
      } else {
        line += '🟦'
      }
    }
    lines.push(line)
  }
  lines.push('')
  lines.push('lobby.market/crossword')
  return lines.join('\n')
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CrosswordClient() {
  const puzzle = getPuzzleForDate()
  const [grid] = useState<GridCell[][]>(() => buildGrid(puzzle))
  const clues = buildClues(puzzle, grid)

  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {}
    const saved = loadSaved(puzzle.id)
    return saved?.inputs ?? {}
  })

  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null)
  const [direction, setDirection] = useState<'across' | 'down'>('across')
  const [solved, setSolved] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return loadSaved(puzzle.id)?.solved ?? false
  })
  const [shareMsg, setShareMsg] = useState<string | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)

  // ── Persistence ─────────────────────────────────────────────────────────────

  useEffect(() => {
    persistState({ date: todayUTC(), puzzleId: puzzle.id, inputs, solved })
  }, [inputs, solved, puzzle.id])

  // ── Check solution ──────────────────────────────────────────────────────────

  const checkSolved = useCallback(
    (currentInputs: Record<string, string>) => {
      for (let r = 0; r < puzzle.rows; r++) {
        for (let c = 0; c < puzzle.cols; c++) {
          const cell = grid[r][c]
          if (cell.isBlack) continue
          const k = cellKey(r, c)
          if ((currentInputs[k] ?? '') !== cell.solution) return false
        }
      }
      return true
    },
    [grid, puzzle.rows, puzzle.cols]
  )

  // ── Select cell ─────────────────────────────────────────────────────────────

  const selectCell = useCallback(
    (row: number, col: number) => {
      const cell = grid[row][col]
      if (cell.isBlack) return

      if (selected?.row === row && selected?.col === col) {
        // Toggle direction if this cell supports both
        const hasAcross = cell.acrossWordIdx !== null
        const hasDown = cell.downWordIdx !== null
        if (hasAcross && hasDown) {
          setDirection((d) => (d === 'across' ? 'down' : 'across'))
        }
        return
      }

      setSelected({ row, col })

      // Default to across if available, otherwise down
      const hasAcross = cell.acrossWordIdx !== null
      const hasDown = cell.downWordIdx !== null
      if (hasAcross) setDirection('across')
      else if (hasDown) setDirection('down')
    },
    [grid, selected]
  )

  // ── Keyboard handling ───────────────────────────────────────────────────────

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!selected) return

      const { row, col } = selected

      if (e.key === 'Escape') {
        setSelected(null)
        return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        // Advance to next word
        const allEntries = [...clues.across, ...clues.down]
        const currentWordIdx =
          direction === 'across'
            ? grid[row][col].acrossWordIdx
            : grid[row][col].downWordIdx

        if (currentWordIdx !== null) {
          const currentWord = puzzle.words[currentWordIdx]
          const idx = allEntries.findIndex(
            (e) => e.word === currentWord
          )
          if (idx !== -1) {
            const next = allEntries[(idx + 1) % allEntries.length]
            setSelected({ row: next.word.row, col: next.word.col })
            setDirection(next.direction)
          }
        }
        return
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (direction === 'across') {
          const next = nextCellInWord(row, col, 'across', grid)
          if (next) setSelected({ row: next[0], col: next[1] })
        } else {
          setDirection('across')
        }
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (direction === 'across') {
          const prev = prevCellInWord(row, col, 'across', grid)
          if (prev) setSelected({ row: prev[0], col: prev[1] })
        } else {
          setDirection('across')
        }
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (direction === 'down') {
          const next = nextCellInWord(row, col, 'down', grid)
          if (next) setSelected({ row: next[0], col: next[1] })
        } else {
          setDirection('down')
        }
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (direction === 'down') {
          const prev = prevCellInWord(row, col, 'down', grid)
          if (prev) setSelected({ row: prev[0], col: prev[1] })
        } else {
          setDirection('down')
        }
        return
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        const k = cellKey(row, col)
        if ((inputs[k] ?? '') !== '') {
          const next = { ...inputs, [k]: '' }
          setInputs(next)
        } else {
          const prev = prevCellInWord(row, col, direction, grid)
          if (prev) {
            const pk = cellKey(prev[0], prev[1])
            setInputs((i) => ({ ...i, [pk]: '' }))
            setSelected({ row: prev[0], col: prev[1] })
          }
        }
        return
      }

      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        const letter = e.key.toUpperCase()
        const k = cellKey(row, col)
        const next = { ...inputs, [k]: letter }
        setInputs(next)

        if (checkSolved(next)) {
          setSolved(true)
        }

        // Advance to next empty cell in the current word direction
        const advance = (r: number, c: number): void => {
          const nx = nextCellInWord(r, c, direction, grid)
          if (!nx) return
          const nk = cellKey(nx[0], nx[1])
          if ((next[nk] ?? '') === '') {
            setSelected({ row: nx[0], col: nx[1] })
          } else {
            advance(nx[0], nx[1])
          }
        }
        advance(row, col)
      }
    },
    [selected, direction, grid, inputs, clues, puzzle.words, checkSolved]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // ── Share ────────────────────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    const text = buildShareText(puzzle, inputs)
    try {
      await navigator.clipboard.writeText(text)
      setShareMsg('Copied!')
    } catch {
      setShareMsg('Share failed')
    }
    setTimeout(() => setShareMsg(null), 2000)
  }, [puzzle, inputs])

  // ── Active word highlighting ──────────────────────────────────────────────

  const activeWordCells = new Set<string>()
  if (selected) {
    const cell = grid[selected.row][selected.col]
    const wordIdx =
      direction === 'across' ? cell.acrossWordIdx : cell.downWordIdx
    if (wordIdx !== null) {
      const word = puzzle.words[wordIdx]
      for (let i = 0; i < word.word.length; i++) {
        const r = word.direction === 'down' ? word.row + i : word.row
        const c = word.direction === 'across' ? word.col + i : word.col
        activeWordCells.add(cellKey(r, c))
      }
    }
  }

  // ── Cell appearance ──────────────────────────────────────────────────────

  function cellClass(cell: GridCell): string {
    if (cell.isBlack) return 'bg-surface-0 rounded-sm'
    const k = cellKey(cell.row, cell.col)
    const isSelected = selected?.row === cell.row && selected?.col === cell.col
    const isActive = activeWordCells.has(k)
    const val = inputs[k] ?? ''
    const isCorrect = solved && val === cell.solution
    const isFilled = val !== ''

    if (isSelected)
      return 'bg-for-500 text-white border border-for-300 rounded-sm cursor-pointer'
    if (isActive)
      return 'bg-for-500/20 text-white border border-for-500/30 rounded-sm cursor-pointer'
    if (isCorrect)
      return 'bg-emerald/20 text-emerald border border-emerald/30 rounded-sm cursor-pointer'
    if (isFilled)
      return 'bg-surface-200 text-white border border-surface-400 rounded-sm cursor-pointer'
    return 'bg-surface-100 text-white border border-surface-300 rounded-sm cursor-pointer hover:bg-surface-200/60'
  }

  // ── Active clue ──────────────────────────────────────────────────────────

  let activeClue: ClueEntry | null = null
  if (selected) {
    const cell = grid[selected.row][selected.col]
    const wordIdx =
      direction === 'across' ? cell.acrossWordIdx : cell.downWordIdx
    if (wordIdx !== null) {
      const word = puzzle.words[wordIdx]
      const allClues = [...clues.across, ...clues.down]
      activeClue = allClues.find((c) => c.word === word) ?? null
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-28 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Link
            href="/arcade"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-bold text-white leading-tight">
                Civic Crossword
              </h1>
              <span className="text-[10px] font-mono font-bold border rounded-full px-2 py-px bg-purple/10 text-purple border-purple/30">
                Daily
              </span>
            </div>
            <p className="text-xs text-surface-500 mt-0.5 font-medium">
              {puzzle.subtitle} · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button
            onClick={handleShare}
            className="relative flex items-center gap-1.5 text-xs font-semibold text-surface-500 hover:text-white border border-surface-400 hover:border-surface-300 rounded-lg px-3 py-1.5 transition-colors"
          >
            {shareMsg ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald" />
                <span className="text-emerald">{shareMsg}</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                Share
              </>
            )}
          </button>
        </div>

        {/* ── Solved banner ── */}
        <AnimatePresence>
          {solved && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-emerald/10 border border-emerald/30"
            >
              <Trophy className="h-5 w-5 text-emerald flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald">Puzzle complete!</p>
                <p className="text-xs text-surface-500 mt-0.5">Come back tomorrow for a new puzzle.</p>
              </div>
              <button
                onClick={handleShare}
                className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-emerald border border-emerald/30 rounded-lg px-3 py-1.5 hover:bg-emerald/10 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy result
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Active clue ── */}
        <div className="min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-100 border border-surface-300">
          {activeClue ? (
            <>
              <span className="text-xs font-mono font-bold text-for-300 flex-shrink-0">
                {activeClue.number}{activeClue.direction === 'across' ? 'A' : 'D'}
              </span>
              <span className="text-sm text-surface-600 leading-snug">{activeClue.clue}</span>
            </>
          ) : (
            <span className="text-xs text-surface-500">Click a cell to begin</span>
          )}
        </div>

        {/* ── Grid ── */}
        <div
          ref={gridRef}
          className="flex justify-center"
          onClick={() => {
            // Clicking outside cells deselects
          }}
        >
          <div
            className="inline-grid gap-0.5"
            style={{
              gridTemplateColumns: `repeat(${puzzle.cols}, 1fr)`,
            }}
          >
            {grid.map((row) =>
              row.map((cell) => {
                const k = cellKey(cell.row, cell.col)
                const val = inputs[k] ?? ''

                if (cell.isBlack) {
                  return (
                    <div
                      key={k}
                      className="w-10 h-10 sm:w-12 sm:h-12 bg-surface-0 rounded-sm"
                    />
                  )
                }

                return (
                  <div
                    key={k}
                    className={cn(
                      'relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center select-none',
                      cellClass(cell)
                    )}
                    onClick={() => selectCell(cell.row, cell.col)}
                  >
                    {cell.number !== undefined && (
                      <span className="absolute top-0.5 left-0.5 text-[8px] font-mono font-bold text-surface-500 leading-none">
                        {cell.number}
                      </span>
                    )}
                    <span className="text-sm sm:text-base font-mono font-bold">
                      {val}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Clue lists ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Across */}
          <div className="space-y-1">
            <h2 className="text-xs font-mono font-bold text-for-300 uppercase tracking-wider mb-2">
              Across
            </h2>
            {clues.across.map((entry) => {
              const isActive = activeClue === entry
              return (
                <button
                  key={`${entry.number}-across`}
                  onClick={() => {
                    setSelected({ row: entry.word.row, col: entry.word.col })
                    setDirection('across')
                  }}
                  className={cn(
                    'w-full text-left flex items-start gap-2 px-3 py-2 rounded-lg transition-colors text-xs',
                    isActive
                      ? 'bg-for-500/15 border border-for-500/30'
                      : 'hover:bg-surface-100 border border-transparent'
                  )}
                >
                  <span className={cn('font-mono font-bold flex-shrink-0 mt-px', isActive ? 'text-for-300' : 'text-surface-500')}>
                    {entry.number}.
                  </span>
                  <span className={cn('leading-snug', isActive ? 'text-white' : 'text-surface-600')}>
                    {entry.clue}
                    <span className="ml-1 text-surface-500">({entry.word.word.length})</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Down */}
          <div className="space-y-1">
            <h2 className="text-xs font-mono font-bold text-against-300 uppercase tracking-wider mb-2">
              Down
            </h2>
            {clues.down.map((entry) => {
              const isActive = activeClue === entry
              return (
                <button
                  key={`${entry.number}-down`}
                  onClick={() => {
                    setSelected({ row: entry.word.row, col: entry.word.col })
                    setDirection('down')
                  }}
                  className={cn(
                    'w-full text-left flex items-start gap-2 px-3 py-2 rounded-lg transition-colors text-xs',
                    isActive
                      ? 'bg-against-500/15 border border-against-500/30'
                      : 'hover:bg-surface-100 border border-transparent'
                  )}
                >
                  <span className={cn('font-mono font-bold flex-shrink-0 mt-px', isActive ? 'text-against-300' : 'text-surface-500')}>
                    {entry.number}.
                  </span>
                  <span className={cn('leading-snug', isActive ? 'text-white' : 'text-surface-600')}>
                    {entry.clue}
                    <span className="ml-1 text-surface-500">({entry.word.word.length})</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Mobile keyboard hint ── */}
        <p className="text-center text-[11px] text-surface-600">
          Click a cell · type letters · Backspace to erase · Tab for next word
        </p>

        {/* ── Link back ── */}
        <div className="flex justify-center">
          <Link
            href="/arcade"
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <Gamepad2 className="h-3.5 w-3.5" />
            More civic games in the Arcade
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
