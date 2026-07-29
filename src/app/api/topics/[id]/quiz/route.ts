import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type QuestionType =
  | 'for_pct'
  | 'total_votes'
  | 'category'
  | 'status'
  | 'threshold'
  | 'argument_count'
  | 'created_year'
  | 'top_argument_side'

export interface QuizQuestion {
  id: string
  type: QuestionType
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface TopicQuizData {
  topicId: string
  statement: string
  category: string | null
  status: string
  questions: QuizQuestion[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function nearbyPcts(correct: number): string[] {
  const offsets = [-15, -8, 8, 15].filter((o) => {
    const v = correct + o
    return v >= 1 && v <= 99 && Math.abs(v - correct) >= 5
  })
  const distractors = offsets.slice(0, 3).map((o) => `${Math.max(1, Math.min(99, correct + o))}%`)
  return distractors
}

function nearbyVoteCounts(correct: number): string[] {
  const ranges = [0.3, 0.6, 1.8, 2.5]
  return ranges
    .filter((r) => Math.abs(r - 1) > 0.2)
    .slice(0, 3)
    .map((r) => fmtVotes(Math.round(correct * r)))
}

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Established Law',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

const ALL_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const ALL_STATUSES = ['Proposed', 'Active', 'Voting', 'Established Law', 'Failed']

// ─── Question builders ────────────────────────────────────────────────────────

function buildForPctQuestion(forPct: number): QuizQuestion {
  const correct = `${Math.round(forPct)}%`
  const distractors = nearbyPcts(Math.round(forPct))
  const options = shuffle([correct, ...distractors].slice(0, 4))
  const correctIndex = options.indexOf(correct)
  const dir = forPct >= 50 ? 'in favour' : 'against'
  return {
    id: 'for_pct',
    type: 'for_pct',
    question: 'What percentage of voters are currently FOR this topic?',
    options,
    correctIndex,
    explanation: `${Math.round(forPct)}% of voters are FOR this topic — meaning the community leans ${dir} with ${100 - Math.round(forPct)}% opposed.`,
  }
}

function buildTotalVotesQuestion(totalVotes: number): QuizQuestion {
  const correct = fmtVotes(totalVotes)
  const distractors = nearbyVoteCounts(totalVotes)
  const options = shuffle([correct, ...distractors].slice(0, 4))
  const correctIndex = options.indexOf(correct)
  return {
    id: 'total_votes',
    type: 'total_votes',
    question: 'Approximately how many citizens have voted on this topic?',
    options,
    correctIndex,
    explanation: `${fmtVotes(totalVotes)} citizens have cast their vote on this topic.`,
  }
}

function buildCategoryQuestion(category: string): QuizQuestion {
  const others = shuffle(ALL_CATEGORIES.filter((c) => c !== category)).slice(0, 3)
  const options = shuffle([category, ...others])
  const correctIndex = options.indexOf(category)
  return {
    id: 'category',
    type: 'category',
    question: 'Which policy category does this topic belong to?',
    options,
    correctIndex,
    explanation: `This topic is classified under ${category}.`,
  }
}

function buildStatusQuestion(status: string): QuizQuestion {
  const correct = STATUS_LABEL[status] ?? status
  const others = shuffle(ALL_STATUSES.filter((s) => s !== correct)).slice(0, 3)
  const options = shuffle([correct, ...others])
  const correctIndex = options.indexOf(correct)
  return {
    id: 'status',
    type: 'status',
    question: 'What is the current status of this topic?',
    options,
    correctIndex,
    explanation: `This topic has a status of "${correct}".`,
  }
}

function buildThresholdQuestion(forPct: number): QuizQuestion {
  const threshold = 60
  const isAbove = forPct >= threshold
  const correct = isAbove ? 'Above — it could become law' : 'Below — it has not reached consensus'
  const wrong = isAbove ? 'Below — it has not reached consensus' : 'Above — it could become law'
  const options = [correct, wrong]
  return {
    id: 'threshold',
    type: 'threshold',
    question: `The consensus threshold is ${threshold}%. Is this topic currently above or below it?`,
    options,
    correctIndex: 0,
    explanation: `At ${Math.round(forPct)}% FOR, this topic is ${isAbove ? 'above' : 'below'} the ${threshold}% law threshold.`,
  }
}

function buildArgumentCountQuestion(argCount: number): QuizQuestion {
  const correct = `${argCount}`
  const opts: string[] = []
  const candidates = [
    Math.max(0, argCount - 15),
    Math.max(0, argCount - 7),
    argCount + 8,
    argCount + 20,
  ]
  for (const c of candidates) {
    if (c !== argCount) opts.push(`${c}`)
    if (opts.length === 3) break
  }
  const options = shuffle([correct, ...opts.slice(0, 3)])
  const correctIndex = options.indexOf(correct)
  return {
    id: 'argument_count',
    type: 'argument_count',
    question: 'How many arguments have been posted in this debate?',
    options,
    correctIndex,
    explanation: `${argCount} argument${argCount !== 1 ? 's' : ''} have been contributed to this debate.`,
  }
}

function buildCreatedYearQuestion(createdAt: string): QuizQuestion {
  const year = new Date(createdAt).getFullYear()
  const correct = `${year}`
  const nearYears = [year - 2, year - 1, year + 1].filter((y) => y !== year && y <= new Date().getFullYear())
  const options = shuffle([correct, ...nearYears.slice(0, 3).map(String)])
  const correctIndex = options.indexOf(correct)
  return {
    id: 'created_year',
    type: 'created_year',
    question: 'In which year was this topic first proposed?',
    options,
    correctIndex,
    explanation: `This topic was proposed in ${year}.`,
  }
}

function buildTopArgumentSideQuestion(topSide: 'blue' | 'red'): QuizQuestion {
  const correct = topSide === 'blue' ? 'FOR the topic' : 'AGAINST the topic'
  const wrong = topSide === 'blue' ? 'AGAINST the topic' : 'FOR the topic'
  const options = [correct, wrong]
  return {
    id: 'top_argument_side',
    type: 'top_argument_side',
    question: 'Which side posted the most-upvoted argument in this debate?',
    options,
    correctIndex: 0,
    explanation: `The highest-rated argument was posted by the ${topSide === 'blue' ? 'FOR' : 'AGAINST'} side.`,
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    const { data: topic } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, created_at')
      .eq('id', id)
      .maybeSingle()

    if (!topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    const forPct = topic.blue_pct ?? 50
    const totalVotes = topic.total_votes ?? 0
    const category = topic.category ?? 'Politics'
    const status = topic.status ?? 'proposed'
    const createdAt = topic.created_at ?? new Date().toISOString()

    // Fetch argument count and top-voted argument side
    const { count: argCount } = await supabase
      .from('topic_arguments')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', id)

    const { data: topArg } = await supabase
      .from('topic_arguments')
      .select('side, upvote_count')
      .eq('topic_id', id)
      .order('upvote_count', { ascending: false })
      .limit(1)
      .maybeSingle()

    const questions: QuizQuestion[] = []

    // Always include FOR% and status questions
    questions.push(buildForPctQuestion(forPct))
    questions.push(buildStatusQuestion(status))

    // Category question only if categorized
    if (category) {
      questions.push(buildCategoryQuestion(category))
    }

    // Total votes if enough votes exist
    if (totalVotes >= 5) {
      questions.push(buildTotalVotesQuestion(totalVotes))
    }

    // Threshold question
    questions.push(buildThresholdQuestion(forPct))

    // Argument count if topic has arguments
    if ((argCount ?? 0) >= 3) {
      questions.push(buildArgumentCountQuestion(argCount ?? 0))
    }

    // Top argument side question
    if (topArg?.side === 'blue' || topArg?.side === 'red') {
      questions.push(buildTopArgumentSideQuestion(topArg.side as 'blue' | 'red'))
    }

    // Created year — only if has > 1 year of history
    const ageMs = Date.now() - new Date(createdAt).getTime()
    const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365)
    if (ageYears >= 1) {
      questions.push(buildCreatedYearQuestion(createdAt))
    }

    // Pick 5 random questions from the pool
    const selected = shuffle(questions).slice(0, 5)

    const response: TopicQuizData = {
      topicId: id,
      statement: topic.statement,
      category,
      status,
      questions: selected,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[topic quiz]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
