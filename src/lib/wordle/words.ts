/**
 * Civic Wordle — daily word list and game logic.
 *
 * Words are 5-letter civic/political vocabulary terms.
 * The daily word is deterministically chosen by day index so every user
 * sees the same puzzle on the same UTC day.
 */

// ─── Word list (5 letters, civic vocabulary) ──────────────────────────────────

export const WORDLE_WORDS: string[] = [
  'LOBBY',
  'CLOUT',
  'TOPIC',
  'VOTES',
  'POLLS',
  'LEGAL',
  'PARTY',
  'COURT',
  'TRIAL',
  'CIVIC',
  'ELECT',
  'VOTER',
  'MAYOR',
  'GRANT',
  'PEACE',
  'QUOTA',
  'RALLY',
  'POWER',
  'RULER',
  'PANEL',
  'FLOOR',
  'ORDER',
  'CAUSE',
  'AMEND',
  'DRAFT',
  'AUDIT',
  'PROXY',
  'PLEAD',
  'EDICT',
  'BILLS',
  'CIVIL',
  'ARENA',
  'BENCH',
  'NEXUS',
  'PACTS',
  'ABIDE',
  'STAND',
  'STAKE',
  'RIGHT',
  'CLAIM',
  'FAITH',
  'VOICE',
  'TAXES',
  'WAGES',
  'BONDS',
  'FUNDS',
  'JUDGE',
  'SWEAR',
  'CREED',
  'FORGE',
  'REALM',
  'ENACT',
  'REPEL',
  'OATHS',
  'RERUN',
  'OVERT',
  'ARGUE',
  'QUASH',
  'CHAIR',
  'ELECT',
  'BLADE',
  'ETHIC',
  'LOCAL',
  'AUDIT',
  'UNITY',
  'LABOR',
  'ELECT',
  'FORUM',
  'RIDER',
  'LOBBY',
  'TALLY',
  'POLLS',
  'TERMS',
  'RULES',
  'PLANK',
  'FRONT',
  'PURSE',
  'WHIPS',
  'CLERK',
  'PRESS',
  'GUARD',
  'TRUCE',
  'PEACE',
  'QUOTA',
  'BRIEF',
  'SWEAR',
  'CREED',
  'REBEL',
  'MARCH',
  'CROWD',
  'VOTER',
  'CIVIL',
  'GUILD',
  'COURT',
  'BENCH',
  'TRUST',
  'PRIME',
  'REIGN',
  'STATE',
  'TOWNS',
]

// Remove duplicates
const UNIQUE_WORDS = [...new Set(WORDLE_WORDS)]

// ─── Day picker ───────────────────────────────────────────────────────────────

/**
 * Returns the word for a given UTC date string (YYYY-MM-DD).
 * Uses a fixed epoch (2025-01-01) so word #0 is always that date's word.
 */
export function getWordForDate(dateStr?: string): string {
  const date = dateStr ? new Date(dateStr) : new Date()
  const epoch = new Date('2025-01-01T00:00:00Z')
  const dayIndex =
    Math.floor(
      (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
        epoch.getTime()) /
        86_400_000
    ) % UNIQUE_WORDS.length
  return UNIQUE_WORDS[Math.max(0, dayIndex % UNIQUE_WORDS.length)]
}

export function todayUTC(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// ─── Game logic ───────────────────────────────────────────────────────────────

export type LetterState = 'correct' | 'present' | 'absent' | 'empty'

export interface GuessResult {
  letter: string
  state: LetterState
}

/**
 * Scores a 5-letter guess against the target word.
 * Handles duplicate letters correctly using a two-pass algorithm.
 */
export function scoreGuess(guess: string, target: string): GuessResult[] {
  const g = guess.toUpperCase().split('')
  const t = target.toUpperCase().split('')
  const result: GuessResult[] = g.map((letter) => ({ letter, state: 'absent' as LetterState }))
  const targetUsed = new Array(5).fill(false)

  // Pass 1: exact matches
  for (let i = 0; i < 5; i++) {
    if (g[i] === t[i]) {
      result[i].state = 'correct'
      targetUsed[i] = true
    }
  }

  // Pass 2: present but wrong position
  for (let i = 0; i < 5; i++) {
    if (result[i].state === 'correct') continue
    for (let j = 0; j < 5; j++) {
      if (!targetUsed[j] && g[i] === t[j]) {
        result[i].state = 'present'
        targetUsed[j] = true
        break
      }
    }
  }

  return result
}

/**
 * Build a keyboard state map: letter → best state seen across all guesses.
 */
export function buildKeyboardState(
  guesses: GuessResult[][]
): Record<string, LetterState> {
  const STATE_RANK: Record<LetterState, number> = { correct: 3, present: 2, absent: 1, empty: 0 }
  const map: Record<string, LetterState> = {}
  for (const guess of guesses) {
    for (const { letter, state } of guess) {
      const current = map[letter]
      if (!current || STATE_RANK[state] > STATE_RANK[current]) {
        map[letter] = state
      }
    }
  }
  return map
}

/**
 * Render share-text grid (emoji pattern).
 */
export function buildShareText(
  guesses: GuessResult[][],
  wordleNumber: number,
  won: boolean
): string {
  const rows = guesses
    .map((guess) =>
      guess
        .map(({ state }) => {
          if (state === 'correct') return '🟦'
          if (state === 'present') return '🟨'
          return '⬛'
        })
        .join('')
    )
    .join('\n')

  const score = won ? `${guesses.length}/6` : 'X/6'
  return `Civic Wordle #${wordleNumber} ${score}\n\n${rows}\n\nlobby.market/wordle`
}
