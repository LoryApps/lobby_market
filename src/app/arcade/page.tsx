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
  ArrowDownUp,
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  Calendar,
  CalendarClock,
  Compass,
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
  Gauge,
  RefreshCw,
  Scale,
  Scroll,
  Skull,
  Sparkles,
  Star,
  Swords,
  Target,
  ThumbsUp,
  Timer,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── localStorage key constants (must match game pages exactly) ──────────────────────────────────────────

const KEYS = {
  trivia:       'lm_trivia_result',
  blitz:        'lm_blitz_high_score_v1',
  knowledgeTest:'lm_knowledge_test_v1',
  duelPicks:    'lm_duel_picks_v1',
  wordle:       'lm_wordle_v1',
  connections:  'lm_connections_v1',
  cloze:        'lm_cloze_v1',
  crossword:    'lm_crossword_v1',
  myth:          'lm_myth_result',
  gauntlet:      'lm_gauntlet_best_v1',
  civicRank:     'lm_civic_rank_v1',
  civicTimeline: 'lm_civic_timeline_v1',
  bingo:         'lm_bingo_',
  sprint:        'lm_sprint_best_v1',
  sprintToday:   'lm_sprint_today_v1',
  imposter:      'lm_imposter_v1',
  mirror:        'lm_mirror_v1',
} as const

// ─── Types ─────────────────────────────────────────────────────────────────────────────────

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
  gauntletBest: number
  civicRankBest: number
  civicRankDate: string | null
  civicTimelineBest: number
  civicTimelineDate: string | null
  bingoDone: boolean
  bingoLines: number
  sprintBest: number
  sprintTodayScore: number | null
  imposterDone: boolean
  imposterCorrect: boolean | null
  imposterStreak: number
  mirrorDone: boolean
  mirrorScore: number | null
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
    gauntletBest: 0,
    civicRankBest: 0,
    civicRankDate: null,
    civicTimelineBest: 0,
    civicTimelineDate: null,
    bingoDone: false,
    bingoLines: 0,
    sprintBest: 0,
    sprintTodayScore: null,
    imposterDone: false,
    imposterCorrect: null,
    imposterStreak: 0,
    mirrorDone: false,
    mirrorScore: null,
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

    // Gauntlet — always, best streak
    const gauntletRaw = localStorage.getItem(KEYS.gauntlet)
    if (gauntletRaw) {
      const g = parseInt(gauntletRaw, 10)
      if (!isNaN(g)) def.gauntletBest = g
    }

    // Civic Rank — daily, best score for today
    const rankRaw = localStorage.getItem(KEYS.civicRank)
    if (rankRaw) {
      const rk = JSON.parse(rankRaw)
      if (typeof rk.score === 'number') {
        def.civicRankBest = rk.score
        def.civicRankDate = rk.date ?? null
      }
    }

    // Civic Timeline — daily
    const tlRaw = localStorage.getItem(KEYS.civicTimeline)
    if (tlRaw) {
      const tl = JSON.parse(tlRaw)
      if (typeof tl.score === 'number') {
        def.civicTimelineBest = tl.score
        def.civicTimelineDate = tl.date ?? null
      }
    }

    // Bingo — weekly, check for any win lines this week
    const bingoWeekKey = `${KEYS.bingo}${currentWeekKey()}`
    const bingoRaw = localStorage.getItem(bingoWeekKey)
    if (bingoRaw) {
      const marks: number[] = JSON.parse(bingoRaw)
      const marksSet = new Set(marks)
      const WIN_LINES = [
        [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
        [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
        [0,6,12,18,24],[4,8,12,16,20],
      ]
      const lines = WIN_LINES.filter((line) => line.every((pos) => marksSet.has(pos))).length
      def.bingoLines = lines
      def.bingoDone = lines > 0
    }

    // Sprint — all-time best + today
    const sprintRaw = localStorage.getItem(KEYS.sprint)
    if (sprintRaw) {
      const s = parseInt(sprintRaw, 10)
      if (!isNaN(s)) def.sprintBest = s
    }
    const sprintTodayRaw = localStorage.getItem(KEYS.sprintToday)
    if (sprintTodayRaw) {
      const st = JSON.parse(sprintTodayRaw)
      if (typeof st.score === 'number') def.sprintTodayScore = st.score
    }

    // Civic Imposter — daily
    const imposterRaw = localStorage.getItem(KEYS.imposter)
    if (imposterRaw) {
      const im = JSON.parse(imposterRaw)
      if (im.date === todayStr()) {
        def.imposterDone = true
        def.imposterCorrect = typeof im.correct === 'boolean' ? im.correct : null
        def.imposterStreak = typeof im.streak === 'number' ? im.streak : 0
      }
    }

    // Civic Mirror — daily
    const mirrorRaw = localStorage.getItem(KEYS.mirror)
    if (mirrorRaw) {
      const mr = JSON.parse(mirrorRaw)
      if (mr.date === todayStr()) {
        def.mirrorDone = true
        def.mirrorScore = typeof mr.score === 'number' ? mr.score : null
      }
    }
  } catch {
    // best-effort
  }
  return def
}

// ─── Game definitions ───────────────────────────────────────────────────────────────────────────────

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
    timeEstimate: '3 min',
  },
  {
    id: 'wordle',
    href: '/wordle',
    title: 'Civic Wordle',
    tagline: 'Guess today\'s 5-letter civic word',
    description:
      'A new civic-themed five-letter word every day. Six tries. Letter hints after each guess. Classic Wordle mechanics for civic vocabulary.',
    icon: Hash,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    border: 'border-emerald/20',
    badge: 'Daily',
    badgeColor: 'bg-emerald/10 text-emerald border-emerald/30',
    refresh: 'daily',
    difficulty: 'medium',
    timeEstimate: '3 min',
  },
  {
    id: 'knowledge-test',
    href: '/knowledge-test',
    title: 'Knowledge Test',
    tagline: 'Eight questions on civic platform data',
    description:
      'Eight multiple-choice questions built from real platform data. Vote counts, laws passed, category stats, debate types, top users. New test each week.',
    icon: BookOpen,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    border: 'border-purple/20',
    badge: 'Weekly',
    badgeColor: 'bg-purple/10 text-purple border-purple/30',
    refresh: 'weekly',
    difficulty: 'medium',
    timeEstimate: '5 min',
  },
  {
    id: 'blitz',
    href: '/blitz',
    title: 'Opinion Blitz',
    tagline: '60-second speed voting sprint',
    description:
      'Vote on as many topics as you can in 60 seconds. Your score is the number of votes cast. Can you break your high score today?',
    icon: Zap,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10',
    border: 'border-against-500/20',
    badge: 'Always',
    badgeColor: 'bg-against-600/10 text-against-400 border-against-600/30',
    refresh: 'always',
    difficulty: 'easy',
    timeEstimate: '1 min',
  },
  {
    id: 'judge',
    href: '/judge',
    title: 'Argument Judge',
    tagline: 'Rate argument quality across five dimensions',
    description:
      'Read a real civic argument and rate it on Clarity, Logic, Evidence, Persuasion, and Fairness. See how your ratings compare to the community\'s verdict.',
    icon: Scale,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    border: 'border-for-500/20',
    badge: 'Daily',
    badgeColor: 'bg-for-500/10 text-for-400 border-for-500/30',
    refresh: 'daily',
    difficulty: 'medium',
    timeEstimate: '4 min',
  },
  {
    id: 'bracket',
    href: '/bracket',
    title: 'Civic Bracket',
    tagline: 'Tournament of the most urgent civic debates',
    description:
      'Pick which debate matters more in each head-to-head match-up. Work through the bracket to crown the week\'s most pressing issue.',
    icon: Award,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    border: 'border-gold/20',
    badge: 'Weekly',
    badgeColor: 'bg-gold/10 text-gold border-gold/30',
    refresh: 'weekly',
    difficulty: 'easy',
    timeEstimate: '5 min',
  },
  {
    id: 'duel',
    href: '/duel',
    title: 'The Duel',
    tagline: 'Head-to-head argument quality vote',
    description:
      'Two arguments on the same topic, side-by-side. Pick the stronger one. Daily fresh matchups drawn from the most upvoted arguments on the platform.',
    icon: Swords,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-600/10',
    border: 'border-against-600/20',
    badge: 'Daily',
    badgeColor: 'bg-against-600/10 text-against-400 border-against-600/30',
    refresh: 'daily',
    difficulty: 'easy',
    timeEstimate: '3 min',
  },
  {
    id: 'swipe',
    href: '/swipe',
    title: 'Swipe & Vote',
    tagline: 'Tinder-style topic voting',
    description:
      'Swipe left for AGAINST, swipe right for FOR. Each card is a live civic topic. Go through as many as you like — no timer, no pressure.',
    icon: ThumbsUp,
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
    id: 'rapid',
    href: '/rapid',
    title: 'Rapid Fire',
    tagline: 'Fast-paced civic Q&A',
    description:
      'Questions fire in rapid succession — each one a different type: category quiz, vote-split guess, law-or-not binary. Ten questions, top speed.',
    icon: Zap,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    border: 'border-gold/20',
    badge: 'Daily',
    badgeColor: 'bg-gold/10 text-gold border-gold/30',
    refresh: 'daily',
    difficulty: 'hard',
    timeEstimate: '3 min',
  },
  {
    id: 'simulate',
    href: '/simulate',
    title: 'Policy Simulator',
    tagline: 'Model real-world outcomes with AI',
    description:
      'Choose a topic and ask Claude to model the downstream effects of a FOR or AGAINST outcome. A sandbox for civic consequence thinking.',
    icon: Activity,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    border: 'border-emerald/20',
    badge: 'AI Tool',
    badgeColor: 'bg-emerald/10 text-emerald border-emerald/30',
    refresh: 'always',
    difficulty: 'medium',
    timeEstimate: '5 min',
  },
  {
    id: 'coach',
    href: '/coach',
    title: 'Argument Coach',
    tagline: 'AI critique of your civic argument',
    description:
      'Write a civic argument and get a detailed AI critique across Clarity, Evidence, Logic, and Persuasion. Sharpen your reasoning with Claude.',
    icon: Gavel,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    border: 'border-purple/20',
    badge: 'AI Tool',
    badgeColor: 'bg-purple/10 text-purple border-purple/30',
    refresh: 'always',
    difficulty: 'hard',
    timeEstimate: '5 min',
  },
  {
    id: 'training',
    href: '/training',
    title: 'Argument Training',
    tagline: 'Sharpen debate skills with drills',
    description:
      'Three training modes: Fallacy Spotting, Argument Ranking, and Vote Calibration. Each session gives you 5 reps. Train every day.',
    icon: Scroll,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    border: 'border-for-500/20',
    badge: 'Daily',
    badgeColor: 'bg-for-500/10 text-for-400 border-for-500/30',
    refresh: 'daily',
    difficulty: 'hard',
    timeEstimate: '5 min',
  },
  {
    id: 'manifesto',
    href: '/manifesto',
    title: 'Civic Manifesto',
    tagline: 'AI writes your civic platform',
    description:
      'Answer five questions about your civic priorities. Claude synthesises your answers into a polished personal manifesto you can publish and share.',
    icon: Sparkles,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-600/15',
    border: 'border-for-600/20',
    badge: 'AI Tool',
    badgeColor: 'bg-for-600/15 text-for-300 border-for-500/30',
    refresh: 'always',
    difficulty: 'easy',
    timeEstimate: '5 min',
  },
  {
    id: 'compass',
    href: '/compass',
    title: 'Civic Compass',
    tagline: 'Your political co-ordinates',
    description:
      'Your vote history mapped onto a 2D political compass. See where you sit on the Liberty–Authority and Left–Right axes. Updates as you vote.',
    icon: Compass,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    border: 'border-gold/20',
    badge: 'Profile',
    badgeColor: 'bg-gold/10 text-gold border-gold/30',
    refresh: 'always',
    difficulty: 'easy',
    timeEstimate: '2 min',
  },
  {
    id: 'connections',
    href: '/connections',
    title: 'Civic Connections',
    tagline: 'Group civic terms into four categories',
    description:
      'Sixteen civic terms arranged in a grid. Find the four groups of four that share a hidden common thread. One new puzzle each day.',
    icon: Layers,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    border: 'border-purple/20',
    badge: 'Daily',
    badgeColor: 'bg-purple/10 text-purple border-purple/30',
    refresh: 'daily',
    difficulty: 'medium',
    timeEstimate: '4 min',
  },
  {
    id: 'cloze',
    href: '/cloze',
    title: 'Civic Cloze',
    tagline: 'Fill in the blank from real laws',
    description:
      'A real established law with one key word blanked out. Five words to choose from. How well do you know the letter of the law?',
    icon: BookOpen,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10',
    border: 'border-emerald/20',
    badge: 'Daily',
    badgeColor: 'bg-emerald/10 text-emerald border-emerald/30',
    refresh: 'daily',
    difficulty: 'hard',
    timeEstimate: '3 min',
  },
  {
    id: 'crossword',
    href: '/crossword',
    title: 'Civic Crossword',
    tagline: 'Daily civic vocabulary grid',
    description:
      'A small crossword built from civic and political vocabulary. Clues drawn from real platform debates and established laws. New grid each day.',
    icon: Hash,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-600/15',
    border: 'border-for-600/20',
    badge: 'Daily',
    badgeColor: 'bg-for-600/15 text-for-300 border-for-500/30',
    refresh: 'daily',
    difficulty: 'hard',
    timeEstimate: '5 min',
  },
  {
    id: 'myth',
    href: '/myth',
    title: 'Law or Myth',
    tagline: 'Did this actually become law?',
    description:
      'Five civic statements per day: did the community vote each one into law or was it rejected? Binary choice. Score up to 100 points.',
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
  {
    id: 'gauntlet',
    href: '/gauntlet',
    title: 'Civic Gauntlet',
    tagline: 'Sudden-death survival — pick the majority side',
    description:
      'Topics escalate from easy majorities to near-deadlocks. Pick the community\'s winning side each round. One wrong answer ends your run.',
    icon: Swords,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-600/10',
    border: 'border-against-600/20',
    badge: 'Survival',
    badgeColor: 'bg-against-600/10 text-against-400 border-against-600/30',
    refresh: 'always',
    difficulty: 'hard',
    timeEstimate: '3 min',
  },
  {
    id: 'civic-rank',
    href: '/civic-rank',
    title: 'Civic Rank',
    tagline: 'Sort 4 laws by community support',
    description:
      'Five rounds, four laws each. Arrange them from highest % voted FOR to lowest. Same laws every day — score how many you place correctly.',
    icon: ArrowDownUp,
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
    id: 'civic-timeline',
    href: '/civic-timeline',
    title: 'Civic Timeline',
    tagline: 'Arrange 5 laws in chronological order',
    description:
      'Three rounds, five laws each. Sort them from oldest established to newest — by when the community passed them into law. 60 seconds per round.',
    icon: CalendarClock,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    border: 'border-purple/20',
    badge: 'Daily',
    badgeColor: 'bg-purple/10 text-purple border-purple/30',
    refresh: 'daily',
    difficulty: 'hard',
    timeEstimate: '4 min',
  },
  {
    id: 'bingo',
    href: '/bingo',
    title: 'Civic Bingo',
    tagline: 'Weekly 5×5 board — mark topics as they become law',
    description:
      'A new bingo card every week using live platform topics. Laws that pass auto-mark your squares. Get five in a row — horizontally, vertically, or diagonally — for the BINGO.',
    icon: Star,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    border: 'border-for-500/20',
    badge: 'Weekly',
    badgeColor: 'bg-for-500/10 text-for-400 border-for-500/30',
    refresh: 'weekly',
    difficulty: 'easy',
    timeEstimate: '5 min',
  },
  {
    id: 'sprint',
    href: '/sprint',
    title: 'Civic Sprint',
    tagline: 'Predict law vs. fail on 10 closed topics',
    description:
      'Ten closed debates — no outcome visible. Guess whether each became law or failed to pass. Race the 15-second clock for speed bonuses. Max 150 points.',
    icon: Timer,
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
    id: 'civic-imposter',
    href: '/civic-imposter',
    title: 'Civic Imposter',
    tagline: 'Spot the fake law hiding among five real ones',
    description:
      'Five real established laws from the Lobby Codex — and one plausible-sounding fake. Can you identify the imposter? One guess per day. Build your detection streak.',
    icon: Skull,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-600/10',
    border: 'border-against-600/20',
    badge: 'Daily',
    badgeColor: 'bg-against-600/10 text-against-400 border-against-600/30',
    refresh: 'daily',
    difficulty: 'hard',
    timeEstimate: '2 min',
  },
  {
    id: 'civic-mirror',
    href: '/civic-mirror',
    title: 'Civic Mirror',
    tagline: 'Vote your gut — see if you\'re with the majority',
    description:
      'Five real platform topics per day. Tap FOR or AGAINST on gut instinct — no splits shown. After each vote, the community majority is revealed. How aligned are you?',
    icon: Gauge,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    border: 'border-for-500/20',
    badge: 'Daily',
    badgeColor: 'bg-for-500/10 text-for-400 border-for-500/30',
    refresh: 'daily',
    difficulty: 'easy',
    timeEstimate: '2 min',
  },
]

// ─── Difficulty badge ─────────────────────────────────────────────────────────────────

const DIFF_STYLE = {
  easy: 'text-emerald border-emerald/30 bg-emerald/10',
  medium: 'text-gold border-gold/30 bg-gold/10',
  hard: 'text-against-400 border-against-500/30 bg-against-500/10',
} as const

// ─── Score display ──────────────────────────────────────────────────────────────────────────────

function ScorePill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn('text-base font-mono font-bold tabular-nums', color)}>{value}</span>
      <span className="text-[10px] text-surface-500 uppercase tracking-wider">{label}</span>
    </div>
  )
}

// ─── Game card ───────────────────────────────────────────────────────────────────────────────

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
            <p className="text-xs text-surface-500 leading-snug">{game.tagline}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-surface-400 leading-relaxed">{game.description}</p>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-[10px] font-mono font-bold border rounded-full px-2 py-0.5',
              DIFF_STYLE[game.difficulty]
            )}>
              {game.difficulty}
            </span>
            <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <Clock className="h-3 w-3" />
              {game.timeEstimate}
            </div>
          </div>

          {/* Score or arrow */}
          {score ? (
            <span className="text-xs font-mono font-bold text-gold">{score}</span>
          ) : highScore != null && highScore > 0 ? (
            <span className="text-xs font-mono font-bold text-against-400">{highScore} best</span>
          ) : (
            <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Section header ──────────────────────────────────────────────────────────────────────────────

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

// ─── Page ───────────────────────────────────────────────────────────────────────────────────

export default function ArcadePage() {
  const [records, setRecords] = useState<ArcadeRecord | null>(null)

  useEffect(() => {
    setRecords(loadRecords())
  }, [])

  const dailyGames = GAMES.filter((g) => g.refresh === 'daily')
  const weeklyGames = GAMES.filter((g) => g.refresh === 'weekly')
  const alwaysGames = GAMES.filter((g) => g.refresh === 'always')

  const todayISO = new Date().toISOString().slice(0, 10)
  const civicRankDoneToday = records?.civicRankDate === todayISO
  const civicTimelineDoneToday = records?.civicTimelineDate === todayISO
  const sprintDone = (records?.sprintTodayScore != null)
  const imposterDoneToday = records?.imposterDone ?? false
  const mirrorDoneToday = records?.mirrorDone ?? false
  const dailyDone = (records?.triviaDone ? 1 : 0) + (records?.wordleDone ? 1 : 0) + (records?.connectionsDone ? 1 : 0) + (records?.clozeDone ? 1 : 0) + (records?.crosswordDone ? 1 : 0) + (records?.mythDone ? 1 : 0) + (civicRankDoneToday ? 1 : 0) + (civicTimelineDoneToday ? 1 : 0) + (sprintDone ? 1 : 0) + (imposterDoneToday ? 1 : 0) + (mirrorDoneToday ? 1 : 0)
  const weeklyDone = (records?.knowledgeDone ? 1 : 0) + (records?.bingoDone ? 1 : 0)

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
                  value={`${dailyDone}/11`}
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
                  label="Sprint"
                  value={records.sprintBest > 0 ? `${records.sprintBest}` : '—'}
                  color={records.sprintBest > 0 ? 'text-gold' : 'text-surface-500'}
                />
                <div className="w-px h-8 bg-surface-300" />
                <ScorePill
                  label="Gauntlet"
                  value={records.gauntletBest > 0 ? `${records.gauntletBest}` : '—'}
                  color={records.gauntletBest > 0 ? 'text-against-400' : 'text-surface-500'}
                />
                <div className="w-px h-8 bg-surface-300" />
                <ScorePill
                  label="Rank"
                  value={records.civicRankBest > 0 ? `${records.civicRankBest}/20` : '—'}
                  color={records.civicRankBest > 0 ? 'text-gold' : 'text-surface-500'}
                />
                <div className="w-px h-8 bg-surface-300" />
                <ScorePill
                  label="Timeline"
                  value={records.civicTimelineBest > 0 ? `${records.civicTimelineBest}/60` : '—'}
                  color={records.civicTimelineBest > 0 ? 'text-purple' : 'text-surface-500'}
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
              subtitle={`Resets at midnight · ${dailyDone}/11 done today`}
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
                      : game.id === 'civic-rank'
                      ? civicRankDoneToday
                      : game.id === 'civic-timeline'
                      ? civicTimelineDoneToday
                      : game.id === 'sprint'
                      ? sprintDone
                      : game.id === 'civic-imposter'
                      ? imposterDoneToday
                      : game.id === 'civic-mirror'
                      ? mirrorDoneToday
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
                      : game.id === 'civic-rank' && civicRankDoneToday && records?.civicRankBest != null
                      ? `${records.civicRankBest}/20`
                      : game.id === 'civic-timeline' && civicTimelineDoneToday && records?.civicTimelineBest != null
                      ? `${records.civicTimelineBest}/60`
                      : game.id === 'sprint' && records?.sprintTodayScore != null
                      ? `${records.sprintTodayScore} pts`
                      : game.id === 'civic-imposter' && imposterDoneToday
                      ? records?.imposterCorrect
                        ? records.imposterStreak > 1 ? `Correct · ${records.imposterStreak}🔥` : 'Correct!'
                        : 'Fooled'
                      : game.id === 'civic-mirror' && mirrorDoneToday && records?.mirrorScore != null
                      ? `${records.mirrorScore}/5 majority`
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
                      : game.id === 'bingo'
                      ? records?.bingoDone
                      : undefined
                  }
                  score={
                    game.id === 'knowledge-test' && records?.knowledgeScore != null
                      ? `${records.knowledgeScore}%`
                      : game.id === 'bingo' && records?.bingoLines != null && records.bingoLines > 0
                      ? `${records.bingoLines} line${records.bingoLines !== 1 ? 's' : ''}`
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
                      : game.id === 'gauntlet' && records?.gauntletBest != null
                        ? records.gauntletBest
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
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-xl border transition-all',
                    'bg-surface-100 hover:bg-surface-200/60',
                    item.border,
                  )}
                >
                  <div className={cn('p-1.5 rounded-lg', item.bg)}>
                    <item.icon className={cn('h-4 w-4', item.color)} />
                  </div>
                  <span className="text-xs font-semibold text-surface-200">{item.label}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── All games grid ── */}
          <section className="pb-8">
            <SectionHeader
              icon={Vote}
              iconColor="text-purple"
              iconBg="bg-purple/10"
              title="More Civic Activities"
              subtitle="Everything else on the platform"
            />
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/debate', icon: Gavel, label: 'Debates', color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/20' },
                { href: '/floor', icon: Scale, label: 'The Floor', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/20' },
                { href: '/crossfire', icon: Swords, label: 'Crossfire', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20' },
                { href: '/predictions', icon: Target, label: 'Predictions', color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/20' },
                { href: '/battleground', icon: Zap, label: 'Battleground', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20' },
                { href: '/tally', icon: BarChart2, label: 'Tally Board', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20' },
                { href: '/moments', icon: Sparkles, label: 'Moments', color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/20' },
                { href: '/bingo', icon: Award, label: 'Civic Bingo', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/20' },
                { href: '/gauntlet', icon: Swords, label: 'Gauntlet', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/20' },
                { href: '/civic-rank', icon: ArrowDownUp, label: 'Civic Rank', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20' },
                { href: '/civic-timeline', icon: CalendarClock, label: 'Civic Timeline', color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/20' },
                { href: '/civic-imposter', icon: Skull, label: 'Civic Imposter', color: 'text-against-400', bg: 'bg-against-600/10', border: 'border-against-600/20' },
                { href: '/civic-mirror', icon: Gauge, label: 'Civic Mirror', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/20' },
                { href: '/archetype', icon: Layers, label: 'Archetype', color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/20' },
                { href: '/crossroads', icon: Scale, label: 'Crossroads', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/20' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 p-3 rounded-xl border transition-all',
                    'bg-surface-100 hover:bg-surface-200/60',
                    item.border,
                  )}
                >
                  <div className={cn('p-1.5 rounded-lg', item.bg)}>
                    <item.icon className={cn('h-4 w-4', item.color)} />
                  </div>
                  <span className="text-xs font-semibold text-surface-200">{item.label}</span>
                </Link>
              ))}
            </div>
          </section>

        </div>
      </main>
      <BottomNav />
    </div>
  )
}
