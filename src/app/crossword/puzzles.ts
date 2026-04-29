/**
 * Civic Crossword — daily puzzle definitions.
 *
 * Puzzles rotate by day-of-year so every player sees the same puzzle
 * on the same UTC day.  All intersections are manually verified below.
 *
 * Intersection notation: (row, col) = letter_from_across = letter_from_down
 */

export interface PuzzleWord {
  word: string
  clue: string
  row: number        // 0-indexed row of first letter
  col: number        // 0-indexed col of first letter
  direction: 'across' | 'down'
}

export interface Puzzle {
  id: number
  subtitle: string
  rows: number
  cols: number
  words: PuzzleWord[]
}

export const PUZZLES: Puzzle[] = [
  // ── Puzzle 0 — "The Chamber" ─────────────────────────────────────────────
  // MOTION across (0,0-5) / TROLL down (0-4,2):  T at (0,2) ✓
  // TROLL  down   (0-4,2) / FLOOR across (2,0-4): O at (2,2) ✓
  // TROLL  down   (0-4,2) / RALLY across (4,0-4): L at (4,2) ✓
  {
    id: 0,
    subtitle: 'The Chamber',
    rows: 7,
    cols: 7,
    words: [
      {
        word: 'MOTION',
        clue: 'A formal proposal brought to a deliberative vote',
        row: 0, col: 0, direction: 'across',
      },
      {
        word: 'TROLL',
        clue: 'Disruptive actor who derails civic debate online',
        row: 0, col: 2, direction: 'down',
      },
      {
        word: 'FLOOR',
        clue: "The Lobby Market's live debate chamber",
        row: 2, col: 0, direction: 'across',
      },
      {
        word: 'RALLY',
        clue: 'To unite people around a growing cause',
        row: 4, col: 0, direction: 'across',
      },
    ],
  },

  // ── Puzzle 1 — "The Forum" ───────────────────────────────────────────────
  // DEBATE across (0,0-5) / DUEL  down  (0-3,0):  D at (0,0) ✓
  // DEBATE across (0,0-5) / AGENDA down (0-5,3):  A at (0,3) ✓
  // DUEL   down   (0-3,0) / ELDER across (2,0-4): E at (2,0) ✓
  // AGENDA down   (0-5,3) / ELDER across (2,0-4): E at (2,3) ✓
  // DUEL   down   (0-3,0) / LEAN  across (3,0-3): L at (3,0) ✓
  // AGENDA down   (0-5,3) / LEAN  across (3,0-3): N at (3,3) ✓
  {
    id: 1,
    subtitle: 'The Forum',
    rows: 7,
    cols: 7,
    words: [
      {
        word: 'DEBATE',
        clue: 'A structured argument between opposing sides',
        row: 0, col: 0, direction: 'across',
      },
      {
        word: 'DUEL',
        clue: 'One-on-one civic challenge on Lobby Market',
        row: 0, col: 0, direction: 'down',
      },
      {
        word: 'AGENDA',
        clue: 'List of items submitted for deliberation',
        row: 0, col: 3, direction: 'down',
      },
      {
        word: 'ELDER',
        clue: "Lobby Market's highest reputation role",
        row: 2, col: 0, direction: 'across',
      },
      {
        word: 'LEAN',
        clue: 'To tend toward one side of an argument',
        row: 3, col: 0, direction: 'across',
      },
    ],
  },

  // ── Puzzle 2 — "The Senate" ──────────────────────────────────────────────
  // SENATE across (0,0-5) / SCORE down (0-4,0):  S at (0,0) ✓
  // SENATE across (0,0-5) / ELECT down (0-4,5):  E at (0,5) ✓
  // SCORE  down   (0-4,0) / OPEN  across (2,0-3): O at (2,0) ✓
  // SCORE  down   (0-4,0) / EARLY across (4,0-4): E at (4,0) ✓
  {
    id: 2,
    subtitle: 'The Senate',
    rows: 7,
    cols: 7,
    words: [
      {
        word: 'SENATE',
        clue: 'Elected upper legislative chamber',
        row: 0, col: 0, direction: 'across',
      },
      {
        word: 'SCORE',
        clue: 'A tally of votes or debate points',
        row: 0, col: 0, direction: 'down',
      },
      {
        word: 'ELECT',
        clue: 'To choose by democratic ballot',
        row: 0, col: 5, direction: 'down',
      },
      {
        word: 'OPEN',
        clue: 'Available for participation — ___ debate',
        row: 2, col: 0, direction: 'across',
      },
      {
        word: 'EARLY',
        clue: 'Getting your vote in before the deadline',
        row: 4, col: 0, direction: 'across',
      },
    ],
  },

  // ── Puzzle 3 — "The Civic" ───────────────────────────────────────────────
  // CLOUT across (0,0-4) / CIVIC down (0-4,0):  C at (0,0) ✓
  // CIVIC down   (0-4,0) / VOTER across (2,0-4): V at (2,0) ✓
  // CIVIC down   (0-4,0) / CIVIL across (4,0-4): C at (4,0) ✓
  {
    id: 3,
    subtitle: 'The Civic',
    rows: 7,
    cols: 7,
    words: [
      {
        word: 'CLOUT',
        clue: 'The reputation currency earned on Lobby Market',
        row: 0, col: 0, direction: 'across',
      },
      {
        word: 'CIVIC',
        clue: 'Relating to citizens and their community duties',
        row: 0, col: 0, direction: 'down',
      },
      {
        word: 'VOTER',
        clue: 'One who casts a ballot on platform topics',
        row: 2, col: 0, direction: 'across',
      },
      {
        word: 'CIVIL',
        clue: 'Courteous conduct expected in debate',
        row: 4, col: 0, direction: 'across',
      },
    ],
  },

  // ── Puzzle 4 — "The Law" ─────────────────────────────────────────────────
  // LAWS  across (0,0-3) / LEGAL down (0-4,0):  L at (0,0) ✓
  // LEGAL down   (0-4,0) / GLOBE across (2,0-4): G at (2,0) ✓
  // LEGAL down   (0-4,0) / LOYAL across (4,0-4): L at (4,0) ✓
  {
    id: 4,
    subtitle: 'The Law',
    rows: 7,
    cols: 7,
    words: [
      {
        word: 'LAWS',
        clue: 'Rules established by community consensus on Lobby Market',
        row: 0, col: 0, direction: 'across',
      },
      {
        word: 'LEGAL',
        clue: 'Permitted under established civic rules',
        row: 0, col: 0, direction: 'down',
      },
      {
        word: 'GLOBE',
        clue: 'Scope of platform laws with worldwide reach',
        row: 2, col: 0, direction: 'across',
      },
      {
        word: 'LOYAL',
        clue: 'Steadfast in support of a coalition or cause',
        row: 4, col: 0, direction: 'across',
      },
    ],
  },

  // ── Puzzle 5 — "The Vote" ────────────────────────────────────────────────
  // VOICE across (0,0-4) / VOTER down (0-4,0):  V at (0,0) ✓
  // VOTER down   (0-4,0) / TALLY across (2,0-4): T at (2,0) ✓
  // VOTER down   (0-4,0) / ELECT across (3,0-4): E at (3,0) ✓
  {
    id: 5,
    subtitle: 'The Vote',
    rows: 7,
    cols: 7,
    words: [
      {
        word: 'VOICE',
        clue: 'Your individual say in collective decisions',
        row: 0, col: 0, direction: 'across',
      },
      {
        word: 'VOTER',
        clue: 'One who participates in democratic decision-making',
        row: 0, col: 0, direction: 'down',
      },
      {
        word: 'TALLY',
        clue: 'A running count of votes on a topic',
        row: 2, col: 0, direction: 'across',
      },
      {
        word: 'ELECT',
        clue: 'To choose representatives or pass a measure',
        row: 3, col: 0, direction: 'across',
      },
    ],
  },

  // ── Puzzle 6 — "The Consensus" ───────────────────────────────────────────
  // QUORUM across (0,0-5) / QUOTE down (0-4,0):  Q at (0,0) ✓
  // QUOTE  down   (0-4,0) / ORDER across (2,0-4): O at (2,0) ✓
  // QUOTE  down   (0-4,0) / ELDER across (4,0-4): E at (4,0) ✓
  {
    id: 6,
    subtitle: 'The Consensus',
    rows: 7,
    cols: 7,
    words: [
      {
        word: 'QUORUM',
        clue: 'Minimum members needed to conduct official business',
        row: 0, col: 0, direction: 'across',
      },
      {
        word: 'QUOTE',
        clue: 'To cite evidence or a source in an argument',
        row: 0, col: 0, direction: 'down',
      },
      {
        word: 'ORDER',
        clue: 'A call for ___ — to restore decorum in debate',
        row: 2, col: 0, direction: 'across',
      },
      {
        word: 'ELDER',
        clue: "Lobby Market's most respected civic rank",
        row: 4, col: 0, direction: 'across',
      },
    ],
  },
]

/**
 * Returns the puzzle for today's UTC date.
 * The same puzzle is shown to every player on the same day.
 */
export function getPuzzleForDate(date: Date = new Date()): Puzzle {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 0))
  const diff = date.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  return PUZZLES[dayOfYear % PUZZLES.length]
}
