import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

export type CivicCategory = (typeof CATEGORIES)[number]

export type MasteryLevel =
  | 'novice'
  | 'apprentice'
  | 'journeyman'
  | 'specialist'
  | 'expert'
  | 'master'

// ─── XP thresholds per level ─────────────────────────────────────────────────

const LEVEL_THRESHOLDS: Record<MasteryLevel, number> = {
  novice:      0,
  apprentice:  50,
  journeyman:  150,
  specialist:  400,
  expert:      900,
  master:      2000,
}

const LEVEL_ORDER: MasteryLevel[] = [
  'novice',
  'apprentice',
  'journeyman',
  'specialist',
  'expert',
  'master',
]

const LEVEL_LABELS: Record<MasteryLevel, string> = {
  novice:      'Novice',
  apprentice:  'Apprentice',
  journeyman:  'Journeyman',
  specialist:  'Specialist',
  expert:      'Expert',
  master:      'Master',
}

const LEVEL_DESCRIPTIONS: Record<MasteryLevel, string> = {
  novice:      'Just starting to engage with this category.',
  apprentice:  'Building familiarity with the key debates.',
  journeyman:  'Consistently engaged, starting to form strong opinions.',
  specialist:  'Deep knowledge, strong argument history.',
  expert:      'Top-tier contributor with proven impact in this area.',
  master:      'Civic authority — your voice shapes consensus in this category.',
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   '#f59e0b',
  Politics:    '#60a5fa',
  Technology:  '#8b5cf6',
  Science:     '#10b981',
  Ethics:      '#f87171',
  Philosophy:  '#818cf8',
  Culture:     '#fb923c',
  Health:      '#f472b6',
  Environment: '#4ade80',
  Education:   '#22d3ee',
}

// ─── XP calculation ──────────────────────────────────────────────────────────
// Each action contributes XP toward mastery:
//   Vote cast:           1 XP
//   Vote on winning side: 5 XP bonus
//   Argument posted:    10 XP
//   Argument upvote:     2 XP each (capped at 50 XP per argument)
//   A grade argument:   25 XP bonus
//   B grade argument:   10 XP bonus
//   Debate participation: 15 XP

function computeXp(stats: {
  votes: number
  law_wins: number
  arguments: number
  total_upvotes: number
  a_grade_args: number
  b_grade_args: number
  debates: number
}): number {
  const vote_xp       = stats.votes * 1
  const law_win_xp    = stats.law_wins * 5
  const arg_xp        = stats.arguments * 10
  const upvote_xp     = Math.min(stats.total_upvotes * 2, stats.arguments * 50)
  const grade_a_xp    = stats.a_grade_args * 25
  const grade_b_xp    = stats.b_grade_args * 10
  const debate_xp     = stats.debates * 15
  return Math.round(
    vote_xp + law_win_xp + arg_xp + upvote_xp + grade_a_xp + grade_b_xp + debate_xp
  )
}

function levelFromXp(xp: number): MasteryLevel {
  for (let i = LEVEL_ORDER.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[LEVEL_ORDER[i]]) return LEVEL_ORDER[i]
  }
  return 'novice'
}

function nextThreshold(level: MasteryLevel): number {
  const idx = LEVEL_ORDER.indexOf(level)
  if (idx === LEVEL_ORDER.length - 1) return LEVEL_THRESHOLDS.master
  return LEVEL_THRESHOLDS[LEVEL_ORDER[idx + 1]]
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryMastery {
  category: CivicCategory
  color: string
  level: MasteryLevel
  levelLabel: string
  levelDescription: string
  xp: number
  currentLevelXp: number
  nextLevelXp: number
  progressPct: number
  votes: number
  lawWins: number
  arguments: number
  totalUpvotes: number
  aGradeArgs: number
  avgQualityScore: number | null
  topGrade: string | null
  debates: number
  rank: number        // rank among all categories for this user (1 = best)
}

export interface CategoryMasteryResponse {
  authenticated: true
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  categories: CategoryMastery[]
  overallXp: number
  overallLevel: MasteryLevel
  overallLevelLabel: string
  topCategory: CivicCategory | null
  weakestCategory: CivicCategory | null
  masteredCount: number   // categories at expert or master
  totalVotes: number
  totalArguments: number
  totalLawWins: number
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  // ─── 1. Votes per category ─────────────────────────────────────────────────
  const { data: voteRows } = await supabase
    .from('votes')
    .select('side, topic_id, topics!inner(category, status)')
    .eq('user_id', user.id)

  const votesRaw = (voteRows ?? []) as Array<{
    side: string
    topic_id: string
    topics: { category: string | null; status: string }
  }>

  // ─── 2. Arguments per category ────────────────────────────────────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('upvotes, ai_score, ai_grade, topic_id, topics!inner(category)')
    .eq('user_id', user.id)

  const argsRaw = (argRows ?? []) as Array<{
    upvotes: number
    ai_score: number | null
    ai_grade: string | null
    topic_id: string
    topics: { category: string | null }
  }>

  // ─── 3. Law wins (voted on winning side of a law) ─────────────────────────
  // A "law win" = the user voted on a topic that became law AND their vote
  // matched the majority side (blue_pct >= 50 → blue wins, user voted blue, etc.)
  const { data: lawRows } = await supabase
    .from('votes')
    .select('side, topics!inner(category, status, blue_pct)')
    .eq('user_id', user.id)

  const lawWinsRaw = (lawRows ?? []) as Array<{
    side: string
    topics: { category: string | null; status: string; blue_pct: number }
  }>

  // ─── 4. Debate participation per category ─────────────────────────────────
  const { data: debateRows } = await supabase
    .from('debate_participants')
    .select('debate_id, debates!inner(topic_id, topics!inner(category))')
    .eq('user_id', user.id)

  const debatesRaw = (debateRows ?? []) as Array<{
    debate_id: string
    debates: { topic_id: string; topics: { category: string | null } }
  }>

  // ─── Aggregate per category ────────────────────────────────────────────────

  interface CatStats {
    votes: number
    law_wins: number
    arguments: number
    total_upvotes: number
    a_grade_args: number
    b_grade_args: number
    debates: number
    scores: number[]
    grades: string[]
  }

  const statsMap: Record<string, CatStats> = {}

  for (const cat of CATEGORIES) {
    statsMap[cat] = {
      votes: 0, law_wins: 0, arguments: 0, total_upvotes: 0,
      a_grade_args: 0, b_grade_args: 0, debates: 0, scores: [], grades: [],
    }
  }

  // Votes
  for (const v of votesRaw) {
    const cat = v.topics?.category
    if (!cat || !statsMap[cat]) continue
    statsMap[cat].votes++
  }

  // Law wins
  for (const v of lawWinsRaw) {
    const cat = v.topics?.category
    if (!cat || !statsMap[cat]) continue
    if (v.topics.status !== 'law') continue
    const majorityBlue = (v.topics.blue_pct ?? 50) >= 50
    if ((majorityBlue && v.side === 'blue') || (!majorityBlue && v.side === 'red')) {
      statsMap[cat].law_wins++
    }
  }

  // Arguments
  for (const a of argsRaw) {
    const cat = a.topics?.category
    if (!cat || !statsMap[cat]) continue
    statsMap[cat].arguments++
    statsMap[cat].total_upvotes += a.upvotes ?? 0
    if (a.ai_score != null) statsMap[cat].scores.push(a.ai_score)
    if (a.ai_grade) statsMap[cat].grades.push(a.ai_grade)
    if (a.ai_grade === 'A') statsMap[cat].a_grade_args++
    if (a.ai_grade === 'B') statsMap[cat].b_grade_args++
  }

  // Debates (deduplicated)
  const seenDebates = new Set<string>()
  for (const d of debatesRaw) {
    const cat = d.debates?.topics?.category
    if (!cat || !statsMap[cat]) continue
    const key = `${d.debate_id}-${cat}`
    if (!seenDebates.has(key)) {
      seenDebates.add(key)
      statsMap[cat].debates++
    }
  }

  // ─── Build per-category mastery objects ────────────────────────────────────

  const categories: CategoryMastery[] = CATEGORIES.map((cat) => {
    const s = statsMap[cat]
    const xp = computeXp(s)
    const level = levelFromXp(xp)
    const currentThreshold = LEVEL_THRESHOLDS[level]
    const next = nextThreshold(level)

    const progressPct =
      level === 'master'
        ? 100
        : Math.round(((xp - currentThreshold) / (next - currentThreshold)) * 100)

    const avgQualityScore =
      s.scores.length > 0
        ? Math.round((s.scores.reduce((a, b) => a + b, 0) / s.scores.length) * 10) / 10
        : null

    const topGrade =
      s.grades.includes('A') ? 'A' :
      s.grades.includes('B') ? 'B' :
      s.grades.includes('C') ? 'C' :
      s.grades.includes('D') ? 'D' :
      s.grades.includes('F') ? 'F' :
      null

    return {
      category: cat as CivicCategory,
      color: CATEGORY_COLORS[cat] ?? '#6b7280',
      level,
      levelLabel: LEVEL_LABELS[level],
      levelDescription: LEVEL_DESCRIPTIONS[level],
      xp,
      currentLevelXp: xp - currentThreshold,
      nextLevelXp: next - currentThreshold,
      progressPct: Math.max(0, Math.min(100, progressPct)),
      votes: s.votes,
      lawWins: s.law_wins,
      arguments: s.arguments,
      totalUpvotes: s.total_upvotes,
      aGradeArgs: s.a_grade_args,
      avgQualityScore,
      topGrade,
      debates: s.debates,
      rank: 0, // filled in below
    }
  })

  // Rank categories by XP
  const sorted = [...categories].sort((a, b) => b.xp - a.xp)
  sorted.forEach((c, i) => { c.rank = i + 1 })

  // ─── Overall stats ─────────────────────────────────────────────────────────

  const overallXp = categories.reduce((sum, c) => sum + c.xp, 0)
  const overallLevel = levelFromXp(Math.round(overallXp / CATEGORIES.length))
  const topCat = sorted[0]
  const nonZero = sorted.filter((c) => c.xp > 0)
  const weakestCat = nonZero.length > 0 ? nonZero[nonZero.length - 1] : null
  const masteredCount = categories.filter(
    (c) => c.level === 'expert' || c.level === 'master'
  ).length

  const totalVotes     = categories.reduce((s, c) => s + c.votes, 0)
  const totalArguments = categories.reduce((s, c) => s + c.arguments, 0)
  const totalLawWins   = categories.reduce((s, c) => s + c.lawWins, 0)

  const response: CategoryMasteryResponse = {
    authenticated: true,
    user: profile as CategoryMasteryResponse['user'],
    categories,
    overallXp,
    overallLevel,
    overallLevelLabel: LEVEL_LABELS[overallLevel],
    topCategory: topCat?.xp > 0 ? topCat.category : null,
    weakestCategory: weakestCat ? weakestCat.category : null,
    masteredCount,
    totalVotes,
    totalArguments,
    totalLawWins,
  }

  return NextResponse.json(response)
}
