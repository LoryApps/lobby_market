// Daily Civic Connections puzzles.
// Rotate by (dayOfYear % PUZZLES.length) so the puzzle changes each day.

export type GroupColor = 'yellow' | 'green' | 'blue' | 'purple'

export interface PuzzleGroup {
  id: string
  category: string
  color: GroupColor
  items: [string, string, string, string]
}

export interface Puzzle {
  number: number
  groups: [PuzzleGroup, PuzzleGroup, PuzzleGroup, PuzzleGroup]
}

// Colors map: yellow = easiest, purple = hardest
const PUZZLES: Puzzle[] = [
  {
    number: 1,
    groups: [
      { id: '1a', color: 'yellow', category: 'Ways to participate in democracy', items: ['VOTE', 'PETITION', 'CAMPAIGN', 'LOBBY'] },
      { id: '1b', color: 'green',  category: 'Types of government spending',      items: ['GRANT', 'BOND', 'STIMULUS', 'APPROPRIATION'] },
      { id: '1c', color: 'blue',   category: 'International relations',           items: ['TREATY', 'SANCTION', 'EMBARGO', 'DIPLOMACY'] },
      { id: '1d', color: 'purple', category: '"Universal ___"',                   items: ['SUFFRAGE', 'INCOME', 'HEALTHCARE', 'EDUCATION'] },
    ],
  },
  {
    number: 2,
    groups: [
      { id: '2a', color: 'yellow', category: 'Voting-related terms',              items: ['BALLOT', 'POLL', 'CAUCUS', 'PRIMARY'] },
      { id: '2b', color: 'green',  category: 'Branches of government',            items: ['EXECUTIVE', 'LEGISLATIVE', 'JUDICIAL', 'REGULATORY'] },
      { id: '2c', color: 'blue',   category: 'Economic policy tools',             items: ['TARIFF', 'SUBSIDY', 'QUOTA', 'LEVY'] },
      { id: '2d', color: 'purple', category: '"___ reform"',                      items: ['TAX', 'IMMIGRATION', 'PRISON', 'HEALTHCARE'] },
    ],
  },
  {
    number: 3,
    groups: [
      { id: '3a', color: 'yellow', category: 'A bill\'s lifecycle stages',        items: ['PROPOSED', 'DEBATED', 'VOTED', 'ENACTED'] },
      { id: '3b', color: 'green',  category: 'Types of elections',                items: ['GENERAL', 'SPECIAL', 'MIDTERM', 'RUNOFF'] },
      { id: '3c', color: 'blue',   category: 'Climate policy terms',              items: ['CARBON', 'OFFSET', 'NET-ZERO', 'SEQUESTER'] },
      { id: '3d', color: 'purple', category: '"Civil ___"',                       items: ['WAR', 'RIGHTS', 'SERVICE', 'SOCIETY'] },
    ],
  },
  {
    number: 4,
    groups: [
      { id: '4a', color: 'yellow', category: 'Things that can be "direct"',       items: ['DEMOCRACY', 'ACTION', 'ELECTION', 'DEPOSIT'] },
      { id: '4b', color: 'green',  category: 'Types of constitutional documents', items: ['AMENDMENT', 'CHARTER', 'STATUTE', 'ORDINANCE'] },
      { id: '4c', color: 'blue',   category: 'Labour policy terms',               items: ['MINIMUM WAGE', 'UNION', 'STRIKE', 'COLLECTIVE'] },
      { id: '4d', color: 'purple', category: 'What a senator can do',             items: ['FILIBUSTER', 'CAUCUS', 'LOBBY', 'RECESS'] },
    ],
  },
  {
    number: 5,
    groups: [
      { id: '5a', color: 'yellow', category: 'Types of taxes',                    items: ['INCOME', 'CAPITAL GAINS', 'ESTATE', 'EXCISE'] },
      { id: '5b', color: 'green',  category: 'Rights enshrined in law',           items: ['ASSEMBLY', 'SPEECH', 'PRIVACY', 'PETITION'] },
      { id: '5c', color: 'blue',   category: 'Fiscal policy levers',              items: ['DEFICIT', 'SURPLUS', 'STIMULUS', 'AUSTERITY'] },
      { id: '5d', color: 'purple', category: 'What can follow "popular"',        items: ['VOTE', 'SOVEREIGNTY', 'MOVEMENT', 'MANDATE'] },
    ],
  },
  {
    number: 6,
    groups: [
      { id: '6a', color: 'yellow', category: 'Public health policy',              items: ['QUARANTINE', 'MANDATE', 'SUBSIDY', 'COVERAGE'] },
      { id: '6b', color: 'green',  category: 'Housing policy terms',              items: ['ZONING', 'TENURE', 'EVICTION', 'SUBSIDY'] },
      { id: '6c', color: 'blue',   category: 'Trade agreement concepts',          items: ['TARIFF', 'QUOTA', 'DUMPING', 'PARITY'] },
      { id: '6d', color: 'purple', category: '"Free ___"',                        items: ['SPEECH', 'TRADE', 'MARKET', 'PRESS'] },
    ],
  },
  {
    number: 7,
    groups: [
      { id: '7a', color: 'yellow', category: 'Civic engagement tools',            items: ['INITIATIVE', 'REFERENDUM', 'RECALL', 'PLEBISCITE'] },
      { id: '7b', color: 'green',  category: 'Types of courts',                   items: ['SUPREME', 'FEDERAL', 'DISTRICT', 'APPELLATE'] },
      { id: '7c', color: 'blue',   category: 'Immigration policy terms',          items: ['ASYLUM', 'VISA', 'NATURALIZATION', 'DEPORTATION'] },
      { id: '7d', color: 'purple', category: 'What can be "executive"',          items: ['ORDER', 'BRANCH', 'PRIVILEGE', 'POWER'] },
    ],
  },
  {
    number: 8,
    groups: [
      { id: '8a', color: 'yellow', category: 'Education policy terms',            items: ['VOUCHER', 'CHARTER', 'CURRICULUM', 'ACCREDITATION'] },
      { id: '8b', color: 'green',  category: 'Criminal justice concepts',         items: ['BAIL', 'PAROLE', 'PROBATION', 'CLEMENCY'] },
      { id: '8c', color: 'blue',   category: 'Budget terminology',                items: ['SEQUESTER', 'APPROPRIATION', 'OUTLAYS', 'RECONCILIATION'] },
      { id: '8d', color: 'purple', category: '"Public ___"',                      items: ['INTEREST', 'DEFENDER', 'DOMAIN', 'RECORD'] },
    ],
  },
  {
    number: 9,
    groups: [
      { id: '9a', color: 'yellow', category: 'Types of political parties',        items: ['MAJORITY', 'MINORITY', 'COALITION', 'OPPOSITION'] },
      { id: '9b', color: 'green',  category: 'Regulatory agency functions',       items: ['AUDIT', 'INSPECT', 'LICENSE', 'ENFORCE'] },
      { id: '9c', color: 'blue',   category: 'Social safety net programs',        items: ['PENSION', 'WELFARE', 'MEDICAID', 'FOOD STAMPS'] },
      { id: '9d', color: 'purple', category: 'What can follow "checks and"',      items: ['BALANCES', 'ACCOUNTABILITY', 'OVERSIGHT', 'REVIEW'] },
    ],
  },
  {
    number: 10,
    groups: [
      { id: '10a', color: 'yellow', category: 'Debate formats',                   items: ['OXFORD', 'LINCOLN', 'PANEL', 'TOWN HALL'] },
      { id: '10b', color: 'green',  category: 'Ways a law can end',               items: ['REPEALED', 'OVERTURNED', 'EXPIRED', 'VETOED'] },
      { id: '10c', color: 'blue',   category: 'Energy policy terms',              items: ['GRID', 'NUCLEAR', 'RENEWABLE', 'SUBSIDY'] },
      { id: '10d', color: 'purple', category: '"National ___"',                   items: ['SECURITY', 'INTEREST', 'DEBT', 'GUARD'] },
    ],
  },
  {
    number: 11,
    groups: [
      { id: '11a', color: 'yellow', category: 'Voting system types',              items: ['RANKED CHOICE', 'PLURALITY', 'PROPORTIONAL', 'APPROVAL'] },
      { id: '11b', color: 'green',  category: 'Redistricting terms',              items: ['GERRYMANDERING', 'CENSUS', 'APPORTIONMENT', 'DISTRICT'] },
      { id: '11c', color: 'blue',   category: 'Monetary policy tools',            items: ['INTEREST RATE', 'QUANTITATIVE EASING', 'RESERVE', 'INFLATION'] },
      { id: '11d', color: 'purple', category: '"State of ___"',                   items: ['THE UNION', 'EMERGENCY', 'THE ART', 'AFFAIRS'] },
    ],
  },
  {
    number: 12,
    groups: [
      { id: '12a', color: 'yellow', category: 'Tech regulation concepts',         items: ['PRIVACY', 'ANTITRUST', 'ALGORITHM', 'PLATFORM'] },
      { id: '12b', color: 'green',  category: 'Intelligence community terms',     items: ['CLASSIFIED', 'SURVEILLANCE', 'WHISTLEBLOWER', 'REDACTED'] },
      { id: '12c', color: 'blue',   category: 'Drug policy options',              items: ['DECRIMINALIZE', 'LEGALIZE', 'PROHIBIT', 'REGULATE'] },
      { id: '12d', color: 'purple', category: '"Open ___"',                       items: ['GOVERNMENT', 'DATA', 'BORDERS', 'SOURCE'] },
    ],
  },
]

// Get today's puzzle based on day of year
export function getDailyPuzzle(): Puzzle & { puzzleNumber: number; dateString: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  const idx = dayOfYear % PUZZLES.length
  const puzzle = PUZZLES[idx]

  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return { ...puzzle, puzzleNumber: dayOfYear, dateString }
}

// Emoji share grid (like Wordle)
export function buildShareEmoji(
  guessHistory: Array<{ items: string[]; correct: boolean }>,
  groups: PuzzleGroup[],
): string {
  const colorEmoji: Record<GroupColor, string> = {
    yellow: '🟨',
    green:  '🟩',
    blue:   '🟦',
    purple: '🟪',
  }

  const itemToColor = new Map<string, GroupColor>()
  for (const g of groups) {
    for (const item of g.items) {
      itemToColor.set(item, g.color)
    }
  }

  return guessHistory
    .map((guess) =>
      guess.items
        .map((item) => colorEmoji[itemToColor.get(item) ?? 'yellow'])
        .join('')
    )
    .join('\n')
}
