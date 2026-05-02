'use client'

/**
 * /arcade — The Civic Arcade
 *
 * Central hub for all civic games and daily challenges on the platform.
 * Shows completion status (read from localStorage), personal records,
 * and links to every civic mini-game.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  Calendar,
  GitCompare,
  CheckCircle2,
  Circle,
  Clock,
  Crown,
  Flame,
  Gavel,
  Gamepad2,
  Hash,
  Layers,
  RefreshCw,
  Scale,
  Scroll,
  Sparkles,
  Star,
  Swords,
  Target,
  ThumbsUp,
  Timer,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── localStorage key constants (must match game pages exactly) ───────────────

const KEYS = {
  trivia:       'lm_trivia_result',
  blitz:        'lm_blitz_high_score_v1',
  knowledgeTest:'lm_knowledge_test_v1',
  duelPicks:    'lm_duel_picks_v1',
  wordle:       'lm_wordle_v1',
  connections:  'lm_connections_v1',
  cloze:        'lm_cloze_v1',
  crossword:    'lm_crossword_v1',
  myth:         'lm_myth_result',
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArcadeRecord {
  triviaScore: number | null
  triviaDone: boolean
  blitzHighScore: number
  knowledgeDone: boolean
  knowledgeScore: number | null
  wordleDone: boolean
  wordleGuesses: number | null
  connectionsDone: boolean
  connectionsWon: boolean
  connectionsMistakes: number | null
  clozeDone: boolean
  clozeScore: number | null
  crosswordDone: boolean
  crosswordSolved: boolean
  mythDone: boolean
  mythScore: number | null
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function currentWeekKey(): string {
  const d = new Date()
  const year = d.getFullYear()
  const start = new Date(year, 0, 1)
  const weekNum = Math.ceil(
    ((d.getTime() - start.getTime()) / 86_400_000 + start.getDay() + 1) / 7,
  )
  return `${year}-W${weekNum}`
}

function loadRecords(): ArcadeRecord {
  const def: ArcadeRecord = {
    triviaScore: null,
    triviaDone: false,
    blitzHighScore: 0,
    knowledgeDone: false,
    knowledgeScore: null,
    wordleDone: false,
    wordleGuesses: null,
    connectionsDone: false,
    connectionsWon: false,
    connectionsMistakes: null,
    clozeDone: false,
    clozeScore: null,
    crosswordDone: false,
    crosswordSolved: false,
    mythDone: false,
    mythScore: null,
  }
  try {
    // Trivia — daily
    const triviaRaw = localStorage.getItem(KEYS.trivia)
    if (triviaRaw) {
      const t = JSON.parse(triviaRaw)
      if (t.date === todayStr()) {
        def.triviaDone = true
        def.triviaScore = typeof t.total === 'number' ? t.total : null
      }
    }

    // Blitz — all-time high score
    const blitzRaw = localStorage.getItem(KEYS.blitz)
    if (blitzRaw) {
      const n = parseInt(blitzRaw, 10)
      if (!isNaN(n)) def.blitzHighScore = n
    }

    // Knowledge test — weekly
    const kRaw = localStorage.getItem(KEYS.knowledgeTest)
    if (kRaw) {
      const k = JSON.parse(kRaw)
      if (k.week === currentWeekKey()) {
        def.knowledgeDone = true
        def.knowledgeScore = typeof k.score === 'number' ? k.score : null
      }
    }

    // Wordle — daily
    const wRaw = localStorage.getItem(KEYS.wordle)
    if (wRaw) {
      const w = JSON.parse(wRaw)
      if (w.date === todayStr() && w.gameOver) {
        def.wordleDone = true
        def.wordleGuesses = w.won && Array.isArray(w.guesses) ? w.guesses.length : null
      }
    }

    // Connections — daily (keyed by puzzle number = day of year)
    const cRaw = localStorage.getItem(KEYS.connections)
    if (cRaw) {
      const c = JSON.parse(cRaw)
      const today = new Date()
      const start = new Date(today.getFullYear(), 0, 0)
      const dayOfYear = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      if (c.puzzleNumber === dayOfYear && c.done) {
        def.connectionsDone = true
        def.connectionsWon = !!c.won
        def.connectionsMistakes = typeof c.mistakes === 'number' ? c.mistakes : null
      }
    }
    // Cloze — daily
    const clozeRaw = localStorage.getItem(KEYS.cloze)
    if (clozeRaw) {
      const cl = JSON.parse(clozeRaw)
      if (cl.date === todayStr()) {
        def.clozeDone = true
        def.clozeScore = typeof cl.score === 'number' ? cl.score : null
      }
    }

    // Crossword — daily
    const cwRaw = localStorage.getItem(KEYS.crossword)
    if (cwRaw) {
      const cw = JSON.parse(cwRaw)
      if (cw.date === todayStr()) {
        def.crosswordDone = true
        def.crosswordSolved = !!cw.solved
      }
    }

    // Law or Myth — daily
    const mythRaw = localStorage.getItem(KEYS.myth)
    if (mythRaw) {
      const m = JSON.parse(mythRaw)
      if (m.date === todayStr() && m.gameOver) {
        def.mythDone = true
        def.mythScore = typeof m.score === 'number' ? m.score : null
      }
    }
  } catch {
    // best-effort
  }
  return def
}

// ─── Game definitions ─────────────────────────────────────────────────────────

interface GameDef {
  id: string
  href: string
  title: string
  tagline: string
  description: string
  icon: typeof Target
  iconColor: string
  iconBg: string
  border: string
  badge: string
  badgeColor: string
  refresh: 'daily' | 'weekly' | 'always'
  difficulty: 'easy' | 'medium' | 'hard'
  timeEstimate: string
}

const GAMES: GameDef[] = [
  {
    id: 'trivia',
    href: '/trivia',
    title: 'Civic Trivia',
    tagline: 'Guess the community\'s vote split',
    description:
      'Five real platform topics. Estimate the exact FOR/AGAINST split. Score up to 125 points. New questions every day.',
    icon: Target,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    border: 'border-gold/20',
    badge: 'Daily',
    badgeColor: 'bg-gold/10 text-gold border-gold/30',
    refresh: 'daily',
    difficulty: 'medium',
    timeEstimate: '2 min',
  },
  {
    id: 'wordle',
    href: '/wordle',
    title: 'Civic Wordle',
    tagline: 'Guess the 5-letter civic word',
    description:
      'A daily word puzzle using civic vocabulary — laws, governance, democracy. 6 guesses. Share your result.',
    icon: Hash,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-400/10',
    border: 'border-for-400/20',
    badge: 'Daily',
    badgeColor: 'bg-for-400/10 text-for-300 border-for-400/30',
    refresh: 'daily',
    difficulty: 'medium',
    timeEstimate: '2 min',
  },
  {
    id: 'knowledge-test',
    href: '/knowledge-test',
    title: 'Knowledge Test',
    tagline: 'Weekly civic literacy quiz',
    description:
      'Ten questions on platform laws, debate outcomes, and community milestones. Changes every Monday.',
    icon: BookOpen,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    border: 'border-emerald/20',
    badge: 'Weekly',
    badgeColor: 'bg-emerald/10 text-emerald border-emerald/30',
    refresh: 'weekly',
    difficulty: 'hard',
    timeEstimate: '5 min',
  },
  {
    id: 'blitz',
    href: '/blitz',
    title: 'Opinion Blitz',
    tagline: '60-second speed-voting challenge',
    description:
      'Vote on as many topics as possible in 60 seconds. Beat your high score. No thinking — just gut reaction.',
    icon: Timer,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
    border: 'border-against-500/20',
    badge: 'Always',
    badgeColor: 'bg-against-500/10 text-against-400 border-against-500/30',
    refresh: 'always',
    difficulty: 'easy',
    timeEstimate: '1 min',
  },
  {
    id: 'judge',
    href: '/judge',
    title: 'Argument Judge',
    tagline: 'Pick the stronger argument',
    description:
      'Two real arguments go head-to-head. You decide which is more compelling. Test your rhetorical eye.',
    icon: Scale,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    border: 'border-purple/20',
    badge: 'Always',
    badgeColor: 'bg-purple/10 text-purple border-purple/30',
    refresh: 'always',
    difficulty: 'medium',
    timeEstimate: '3 min',
  },
  {
    id: 'bracket',
    href: '/bracket',
    title: 'Civic Bracket',
    tagline: 'Weekly topic tournament',
    description:
      'Eight topics compete head-to-head. Vote each round until a champion emerges. New bracket every week.',
    icon: Layers,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    border: 'border-for-500/20',
    badge: 'Weekly',
    badgeColor: 'bg-for-500/10 text-for-400 border-for-500/30',
    refresh: 'weekly',
    difficulty: 'easy',
    timeEstimate: '2 min',
  },
  {
    id: 'duel',
    href: '/duel',
    title: 'The Duel',
    tagline: 'FOR vs AGAINST argument showdown',
    description:
      'The top FOR argument and top AGAINST argument from each topic face off. Pick your champion.',
    icon: Swords,
    iconColor: 'text-against-300',
    iconBg: 'bg-against-500/10',
    border: 'border-against-500/20',
    badge: 'Always',
    badgeColor: 'bg-against-500/10 text-against-300 border-against-500/30',
    refresh: 'always',
    difficulty: 'medium',
    timeEstimate: '3 min',
  },
  {
    id: 'swipe',
    href: '/swipe',
    title: 'Swipe & Vote',
    tagline: 'Card-by-card voting flow',
    description:
      'Focused, distraction-free voting. Swipe right to agree, left to disagree. One topic at a time.',
    icon: Vote,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-400/10',
    border: 'border-for-400/20',
    badge: 'Always',
    badgeColor: 'bg-for-400/10 text-for-300 border-for-400/30',
    refresh: 'always',
    difficulty: 'easy',
    timeEstimate: '5 min',
  },
  {
    id: 'rapid',
    href: '/rapid',
    title: 'Rapid Fire',
    tagline: 'Fast-paced argument voting',
    description:
      'Arguments scroll by quickly. Vote thumbs up or down before time runs out. Pure instinct.',
    icon: Zap,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    border: 'border-gold/20',
    badge: 'Always',
    badgeColor: 'bg-gold/10 text-gold border-gold/30',
    refresh: 'always',
    difficulty: 'easy',
    timeEstimate: '2 min',
  },
  {
    id: 'simulate',
    href: '/simulate',
    title: 'Policy Simulator',
    tagline: 'AI analysis of any policy statement',
    description:
      'Pick any topic or write your own policy proposal. Claude analyses consequences, tradeoffs, and viability.',
    icon: Sparkles,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    border: 'border-emerald/20',
    badge: 'AI',
    badgeColor: 'bg-emerald/10 text-emerald border-emerald/30',
    refresh: 'always',
    difficulty: 'hard',
    timeEstimate: '5 min',
  },
  {
    id: 'coach',
    href: '/coach',
    title: 'Argument Coach',
    tagline: 'AI critique of your arguments',
    description:
      'Write a civic argument and get scored on Clarity, Evidence, Logic, and Persuasion by Claude.',
    icon: Award,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    border: 'border-purple/20',
    badge: 'AI',
    badgeColor: 'bg-purple/10 text-purple border-purple/30',
    refresh: 'always',
    difficulty: 'medium',
    timeEstimate: '5 min',
  },
  {
    id: 'training',
    href: '/training',
    title: 'Argument Training',
    tagline: 'Drill your debate and critical-thinking skills',
    description:
      'Three drills in one: spot the logical fallacy, rank arguments by strength, and calibrate your vote sense.',
    icon: Zap,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    border: 'border-for-500/20',
    badge: 'Training',
    badgeColor: 'bg-for-500/10 text-for-400 border-for-500/30',
    refresh: 'always',
    difficulty: 'medium',
    timeEstimate: '5 min',
  },
  {
    id: 'manifesto',
    href: '/manifesto',
    title: 'Civic Manifesto',
    tagline: 'AI-generated political archetype',
    description:
      'Based on your voting history, Claude crafts a personalized civic manifesto defining your political identity.',
    icon: Gavel,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    border: 'border-gold/20',
    badge: 'AI',
    badgeColor: 'bg-gold/10 text-gold border-gold/30',
    refresh: 'always',
    difficulty: 'easy',
    timeEstimate: '1 min',
  },
  {
    id: 'compass',
    href: '/compass',
    title: 'Civic Compass',
    tagline: 'Your political radar chart',
    description:
      'A category-by-category radar chart showing where you stand across Economics, Politics, Technology, and more.',
    icon: Activity,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    border: 'border-for-500/20',
    badge: 'Analytics',
    badgeColor: 'bg-for-500/10 text-for-400 border-for-500/30',
    refresh: 'always',
    difficulty: 'easy',
    timeEstimate: '1 min',
  },
  {
    id: 'connections',
    href: '/connections',
    title: 'Civic Connections',
    tagline: 'Group 4 civic terms that share a bond',
    description:
      'Sixteen civic terms, four hidden categories. Find the groups before you run out of guesses. Yellow is easiest, purple is hardest.',
    icon: Layers,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    border: 'border-purple/20',
    badge: 'Daily',
    badgeColor: 'bg-purple/10 text-purple border-purple/30',
    refresh: 'daily',
    difficulty: 'hard',
    timeEstimate: '3 min',
  },
  {
    id: 'cloze',
    href: '/cloze',
    title: 'Civic Cloze',
    tagline: 'Fill in the missing word from a real law',
    description:
      'Five real platform laws and debate statements — each with one key word blanked out. Pick the correct missing word from four options.',
    icon: Scroll,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    border: 'border-gold/20',
    badge: 'Daily',
    badgeColor: 'bg-gold/10 text-gold border-gold/30',
    refresh: 'daily',
    difficulty: 'medium',
    timeEstimate: '2 min',
  },
  {
    id: 'crossword',
    href: '/crossword',
    title: 'Civic Crossword',
    tagline: 'Daily mini-crossword with civic clues',
    description:
      'Fill in the grid using clues drawn from platform debates, laws, and community concepts. A new puzzle every day.',
    icon: Hash,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    border: 'border-purple/20',
    badge: 'Daily',
    badgeColor: 'bg-purple/10 text-purple border-purple/30',
    refresh: 'daily',
    difficulty: 'medium',
    timeEstimate: '3 min',
  },
  {
    id: 'myth',
    href: '/myth',
    title: 'Law or Myth',
    tagline: 'Did the Lobby pass it — or myth?',
    description:
      'Five statements from the Codex. For each, decide: did the community vote it into law, or did it fail? Test your civic knowledge.',
    icon: Gavel,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    border: 'border-gold/20',
    badge: 'Daily',
    badgeColor: 'bg-gold/10 text-gold border-gold/30',
    refresh: 'daily',
    difficulty: 'medium',
    timeEstimate: '3 min',
  },
  {
    id: 'match',
    href: '/match',
    title: 'Civic Match',
    tagline: 'Which topic is more urgent?',
    description:
      'Two live topics appear side-by-side. Pick which one you think deserves more urgent attention. Build your personal priority list.',
    icon: GitCompare,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    border: 'border-for-500/20',
    badge: 'Always',
    badgeColor: 'bg-for-500/10 text-for-400 border-for-500/30',
    refresh: 'always',
    difficulty: 'easy',
    timeEstimate: '2 min',
  },
  {
    id: 'flashcards',
    href: '/flashcards',
    title: 'Civic Flashcards',
    tagline: 'Study established laws at your own pace',
    description:
      'Flip through established laws from the Codex. Mark what you\'ve learned, flag what needs review. Spaced repetition for civic knowledge.',
    icon: BookOpen,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    border: 'border-gold/20',
    badge: 'Study',
    badgeColor: 'bg-gold/10 text-gold border-gold/30',
    refresh: 'always',
    difficulty: 'easy',
    timeEstimate: '5 min',
  },
]

// ─── Difficulty badge ─────────────────────────────────────────────────────────

const DIFF_STYLE = {
  easy: 'text-emerald border-emerald/30 bg-emerald/10',
  medium: 'text-gold border-gold/30 bg-gold/10',
  hard: 'text-against-400 border-against-500/30 bg-against-500/10',
} as const

// ─── Score display ────────────────────────────────────────────────────────────

function ScorePill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn('text-base font-mono font-bold tabular-nums', color)}>{value}</span>
      <span className="text-[10px] text-surface-500 uppercase tracking-wider">{label}</span>
    </div>
  )
}

// ─── Game card ────────────────────────────────────────────────────────────────

interface GameCardProps {
  game: GameDef
  done?: boolean
  score?: string | null
  highScore?: number | null
}

function GameCard({ game, done, score, highScore }: GameCardProps) {
  const Icon = game.icon
  const isDone = done && game.refresh !== 'always'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Link
        href={game.href}
        className={cn(
          'group relative flex flex-col gap-3 p-4 rounded-2xl border transition-all',
          'bg-surface-100 hover:bg-surface-200/60',
          game.border,
          isDone && 'opacity-75',
        )}
      >
        {/* Done indicator */}
        {isDone && (
          <div className="absolute top-3 right-3">
            <CheckCircle2 className="h-4 w-4 text-emerald" />
          </div>
        )}
        {!isDone && game.refresh !== 'always' && (
          <div className="absolute top-3 right-3">
            <Circle className="h-4 w-4 text-surface-500" />
          </div>
        )}

        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={cn('flex-shrink-0 p-2.5 rounded-xl', game.iconBg)}>
            <Icon className={cn('h-5 w-5', game.iconColor)} />
          </div>
          <div className="flex-1 min-w-0 pr-5">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <span className="text-sm font-semibold text-white">{game.title}</span>
              <span className={cn('text-[10px] font-mono font-bold border rounded-full px-2 py-px', game.badgeColor)}>
                {game.badge}
              </span>
            </div>
            <p className="text-xs text-surface-500 font-medium">{game.tagline}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-surface-500 leading-relaxed line-clamp-2">{game.description}</p>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn('text-[10px] font-semibold border rounded-full px-2 py-px', DIFF_STYLE[game.difficulty])}>
              {game.difficulty}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-surface-500">
              <Clock className="h-3 w-3" />
              {game.timeEstimate}
            </span>
          </div>

          {/* Score display */}
          {score != null && (
            <span className="text-[11px] font-mono font-bold text-gold">{score}</span>
          )}
          {highScore != null && highScore > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-gold">
              <Trophy className="h-3 w-3" />
              {highScore}
            </span>
          )}

          <span className={cn(
            'text-xs font-semibold flex items-center gap-1 transition-colors',
            isDone ? 'text-emerald' : 'text-surface-500 group-hover:text-white',
          )}>
            {isDone ? 'Done' : 'Play'}
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  subtitle,
}: {
  icon: typeof Target
  iconColor: string
  iconBg: string
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn('p-2 rounded-xl', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div>
        <h2 className="text-base font-bold text-white">{title}</h2>
        <p className="text-xs text-surface-500">{subtitle}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArcadePage() {
  const [records, setRecords] = useState<ArcadeRecord | null>(null)

  useEffect(() => {
    setRecords(loadRecords())
  }, [])

  const dailyGames = GAMES.filter((g) => g.refresh === 'daily')
  const weeklyGames = GAMES.filter((g) => g.refresh === 'weekly')
  const alwaysGames = GAMES.filter((g) => g.refresh === 'always')

  const dailyDone = (records?.triviaDone ? 1 : 0) + (records?.wordleDone ? 1 : 0) + (records?.connectionsDone ? 1 : 0) + (records?.clozeDone ? 1 : 0) + (records?.crosswordDone ? 1 : 0) + (records?.mythDone ? 1 : 0)
  const weeklyDone = records?.knowledgeDone ? 1 : 0

  return (
    <div className="relative flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 pb-24 pt-16">
        {/* ── Hero ── */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-purple/5 via-transparent to-transparent pointer-events-none" />
          <div className="px-4 pt-8 pb-6 max-w-lg mx-auto">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2 mb-3"
            >
              <div className="p-2.5 rounded-2xl bg-purple/10 border border-purple/20">
                <Gamepad2 className="h-6 w-6 text-purple" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">The Civic Arcade</h1>
                <p className="text-xs text-surface-500">Games, challenges &amp; civic training</p>
              </div>
            </motion.div>

            {/* Progress strip */}
            {records !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50"
              >
                <ScorePill
                  label="Today"
                  value={`${dailyDone}/6`}
                  color={dailyDone > 0 ? 'text-gold' : 'text-surface-500'}
                />
                <div className="w-px h-8 bg-surface-300" />
                <ScorePill
                  label="This week"
                  value={`${weeklyDone}/2`}
                  color={weeklyDone > 0 ? 'text-emerald' : 'text-surface-500'}
                />
                <div className="w-px h-8 bg-surface-300" />
                <ScorePill
                  label="Blitz best"
                  value={records.blitzHighScore > 0 ? String(records.blitzHighScore) : '—'}
                  color={records.blitzHighScore > 0 ? 'text-against-400' : 'text-surface-500'}
                />
                <div className="w-px h-8 bg-surface-300" />
                <ScorePill
                  label="Trivia best"
                  value={records.triviaScore != null ? `${records.triviaScore}/125` : '—'}
                  color={records.triviaScore != null ? 'text-gold' : 'text-surface-500'}
                />
              </motion.div>
            )}
          </div>
        </div>

        <div className="px-4 max-w-lg mx-auto space-y-8">

          {/* ── Daily challenges ── */}
          <section>
            <SectionHeader
              icon={Calendar}
              iconColor="text-gold"
              iconBg="bg-gold/10"
              title="Daily Challenges"
              subtitle={`Resets at midnight · ${dailyDone}/6 done today`}
            />
            <div className="space-y-3">
              {dailyGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  done={
                    game.id === 'trivia'
                      ? records?.triviaDone
                      : game.id === 'wordle'
                      ? records?.wordleDone
                      : game.id === 'connections'
                      ? records?.connectionsDone
                      : game.id === 'cloze'
                      ? records?.clozeDone
                      : game.id === 'crossword'
                      ? records?.crosswordDone
                      : game.id === 'myth'
                      ? records?.mythDone
                      : undefined
                  }
                  score={
                    game.id === 'trivia' && records?.triviaScore != null
                      ? `${records.triviaScore}/125`
                      : game.id === 'wordle' && records?.wordleGuesses != null
                      ? `${records.wordleGuesses}/6`
                      : game.id === 'connections' && records?.connectionsDone
                      ? records.connectionsWon
                        ? records.connectionsMistakes === 0 ? 'Perfect' : `${records.connectionsMistakes} mistake${records.connectionsMistakes !== 1 ? 's' : ''}`
                        : 'Lost'
                      : game.id === 'cloze' && records?.clozeScore != null
                      ? `${records.clozeScore}/5`
                      : game.id === 'crossword' && records?.crosswordDone
                      ? records.crosswordSolved ? 'Solved!' : 'In progress'
                      : game.id === 'myth' && records?.mythScore != null
                      ? `${records.mythScore}/100`
                      : null
                  }
                />
              ))}
            </div>
          </section>

          {/* ── Weekly challenges ── */}
          <section>
            <SectionHeader
              icon={RefreshCw}
              iconColor="text-emerald"
              iconBg="bg-emerald/10"
              title="Weekly Challenges"
              subtitle={`Resets every Monday · ${weeklyDone}/2 done this week`}
            />
            <div className="space-y-3">
              {weeklyGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  done={
                    game.id === 'knowledge-test'
                      ? records?.knowledgeDone
                      : undefined
                  }
                  score={
                    game.id === 'knowledge-test' && records?.knowledgeScore != null
                      ? `${records.knowledgeScore}%`
                      : null
                  }
                />
              ))}
            </div>
          </section>

          {/* ── Always available ── */}
          <section>
            <SectionHeader
              icon={Flame}
              iconColor="text-against-400"
              iconBg="bg-against-500/10"
              title="Always Available"
              subtitle="No limits — play anytime"
            />
            <div className="space-y-3">
              {alwaysGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  highScore={
                    game.id === 'blitz' && records?.blitzHighScore != null
                      ? records.blitzHighScore
                      : null
                  }
                />
              ))}
            </div>
          </section>

          {/* ── Quick links ── */}
          <section>
            <SectionHeader
              icon={BarChart2}
              iconColor="text-for-400"
              iconBg="bg-for-500/10"
              title="Leaderboards &amp; Records"
              subtitle="See how you rank"
            />
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/leaderboard', icon: Crown, label: 'Top Players', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20' },
                { href: '/achievements', icon: Star, label: 'Achievements', color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/20' },
                { href: '/streaks', icon: Flame, label: 'Streaks', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20' },
                { href: '/analytics', icon: BarChart2, label: 'My Stats', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/20' },
                { href: '/compass', icon: Activity, label: 'My Compass', color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/20' },
                { href: '/wrapped', icon: Sparkles, label: 'My Wrapped', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 p-3 rounded-xl border transition-colors',
                      'bg-surface-100 hover:bg-surface-200/60',
                      item.border,
                    )}
                  >
                    <div className={cn('p-1.5 rounded-lg', item.bg)}>
                      <Icon className={cn('h-4 w-4', item.color)} />
                    </div>
                    <span className="text-xs font-semibold text-white">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* ── Footer tip ── */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-200/40 border border-surface-300/40">
            <ThumbsUp className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-surface-500 leading-relaxed">
              Every game uses real platform data — real topics, real arguments, real votes. Your scores reflect
              genuine civic knowledge, not trivia.
            </p>
          </div>

        </div>
      </main>

      <BottomNav />
    </div>
  )
}
