import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LawQuestionType =
  | 'for_pct'
  | 'total_votes'
  | 'category'
  | 'established_year'
  | 'days_to_law'
  | 'argument_count'
  | 'wiki_exists'
  | 'law_links'

export interface LawQuizQuestion {
  id: string
  type: LawQuestionType
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface LawQuizData {
  lawId: string
  statement: string
  category: string | null
  establishedAt: string
  questions: LawQuizQuestion[]
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
  const offsets = [-18, -9, 9, 18].filter((o) => {
    const v = correct + o
    return v >= 1 && v <= 100 && Math.abs(v - correct) >= 6
  })
  return offsets.slice(0, 3).map((o) => `${Math.max(1, Math.min(100, correct + o))}%`)
}

function nearbyVoteCounts(correct: number): string[] {
  return [0.25, 0.5, 2, 4]
    .filter((r) => Math.abs(r - 1) > 0.1)
    .slice(0, 3)
    .map((r) => fmtVotes(Math.round(correct * r)))
}

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function nearbyDays(correct: number): string[] {
  return [
    Math.max(1, Math.round(correct * 0.3)),
    Math.max(1, Math.round(correct * 0.6)),
    Math.round(correct * 2.5),
    Math.round(correct * 4),
  ]
    .filter((d) => d !== correct)
    .slice(0, 3)
    .map((d) => `${d} day${d !== 1 ? 's' : ''}`)
}

const ALL_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Question builders ────────────────────────────────────────────────────────

function buildForPctQuestion(forPct: number): LawQuizQuestion {
  const correct = `${Math.round(forPct)}%`
  const distractors = nearbyPcts(Math.round(forPct))
  const options = shuffle([correct, ...distractors].slice(0, 4))
  return {
    id: 'for_pct',
    type: 'for_pct',
    question: 'When this topic was voted into law, what percentage of citizens voted FOR it?',
    options,
    correctIndex: options.indexOf(correct),
    explanation: `${Math.round(forPct)}% of voters were FOR this topic — a ${forPct >= 75 ? 'strong majority' : forPct >= 60 ? 'clear majority' : 'majority'} that earned it a place in the Codex.`,
  }
}

function buildTotalVotesQuestion(totalVotes: number): LawQuizQuestion {
  const correct = fmtVotes(totalVotes)
  const distractors = nearbyVoteCounts(totalVotes)
  const options = shuffle([correct, ...distractors].slice(0, 4))
  return {
    id: 'total_votes',
    type: 'total_votes',
    question: 'Approximately how many citizens cast a vote on this topic before it became law?',
    options,
    correctIndex: options.indexOf(correct),
    explanation: `${fmtVotes(totalVotes)} citizens voted on this topic over its lifetime, collectively deciding its fate.`,
  }
}

function buildCategoryQuestion(category: string): LawQuizQuestion {
  const others = shuffle(ALL_CATEGORIES.filter((c) => c !== category)).slice(0, 3)
  const options = shuffle([category, ...others])
  return {
    id: 'category',
    type: 'category',
    question: 'This law belongs to which policy category?',
    options,
    correctIndex: options.indexOf(category),
    explanation: `This law is classified under ${category}. Every law in the Codex is tagged to help citizens browse by domain.`,
  }
}

function buildEstablishedYearQuestion(establishedAt: string): LawQuizQuestion {
  const year = new Date(establishedAt).getFullYear()
  const correct = `${year}`
  const nearYears = [year - 2, year - 1, year + 1].filter((y) => y !== year && y <= new Date().getFullYear())
  const options = shuffle([correct, ...nearYears.slice(0, 3).map(String)])
  return {
    id: 'established_year',
    type: 'established_year',
    question: 'In which year did this topic achieve consensus and become an established law?',
    options,
    correctIndex: options.indexOf(correct),
    explanation: `This law was established in ${year}, when the community reached the consensus threshold.`,
  }
}

function buildDaysToLawQuestion(daysToLaw: number): LawQuizQuestion {
  const correct = `${daysToLaw} day${daysToLaw !== 1 ? 's' : ''}`
  const distractors = nearbyDays(daysToLaw)
  const options = shuffle([correct, ...distractors].slice(0, 4))
  return {
    id: 'days_to_law',
    type: 'days_to_law',
    question: 'How long did it take from when this topic was first proposed to when it became law?',
    options,
    correctIndex: options.indexOf(correct),
    explanation: `It took ${daysToLaw} day${daysToLaw !== 1 ? 's' : ''} for this topic to go from proposed to established law — ${daysToLaw <= 3 ? 'a lightning-fast consensus' : daysToLaw <= 14 ? 'a swift community decision' : daysToLaw <= 60 ? 'a deliberate process' : 'a long road to consensus'}.`,
  }
}

function buildArgumentCountQuestion(argCount: number): LawQuizQuestion {
  const correct = `${argCount}`
  const opts: string[] = []
  const candidates = [
    Math.max(0, argCount - 20),
    Math.max(0, argCount - 10),
    argCount + 12,
    argCount + 25,
  ]
  for (const c of candidates) {
    if (c !== argCount) opts.push(`${c}`)
    if (opts.length === 3) break
  }
  const options = shuffle([correct, ...opts.slice(0, 3)])
  return {
    id: 'argument_count',
    type: 'argument_count',
    question: 'How many arguments were posted in the debate that shaped this law?',
    options,
    correctIndex: options.indexOf(correct),
    explanation: `${argCount} argument${argCount !== 1 ? 's' : ''} were contributed before this law was established. Each one shaped the community's understanding.`,
  }
}

function buildWikiExistsQuestion(hasWiki: boolean): LawQuizQuestion {
  const correct = hasWiki ? 'Yes — it has a community wiki article' : 'No — it has not been documented yet'
  const wrong = hasWiki ? 'No — it has not been documented yet' : 'Yes — it has a community wiki article'
  const options = [correct, wrong]
  return {
    id: 'wiki_exists',
    type: 'wiki_exists',
    question: 'Has the community written a wiki article for this law on Lobby Market?',
    options,
    correctIndex: 0,
    explanation: hasWiki
      ? 'Citizens have written a wiki article for this law, documenting its context, history, and impact.'
      : 'This law does not yet have a wiki article. You could be the first to contribute one!',
  }
}

function buildLawLinksQuestion(linkCount: number): LawQuizQuestion {
  const correct = `${linkCount} linked law${linkCount !== 1 ? 's' : ''}`
  const distractors = [
    Math.max(0, linkCount - 2),
    linkCount + 3,
    linkCount + 7,
  ]
    .filter((n) => n !== linkCount)
    .slice(0, 3)
    .map((n) => `${n} linked law${n !== 1 ? 's' : ''}`)
  const options = shuffle([correct, ...distractors].slice(0, 4))
  return {
    id: 'law_links',
    type: 'law_links',
    question: 'How many other laws in the Codex are directly linked to this law?',
    options,
    correctIndex: options.indexOf(correct),
    explanation: `This law is connected to ${linkCount} other law${linkCount !== 1 ? 's' : ''} in the Codex network, ${linkCount === 0 ? 'standing independently without direct connections' : 'forming part of the broader civic knowledge graph'}.`,
  }
}

// ─── GET /api/laws/[id]/quiz ──────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing law id' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    const { data: law } = await supabase
      .from('laws')
      .select('id, statement, category, established_at, blue_pct, total_votes, topic_id, wiki_content, created_at')
      .eq('id', id)
      .maybeSingle()

    if (!law) {
      return NextResponse.json({ error: 'Law not found' }, { status: 404 })
    }

    const forPct = law.blue_pct ?? 60
    const totalVotes = law.total_votes ?? 0
    const category = law.category ?? 'Politics'
    const establishedAt = law.established_at ?? new Date().toISOString()
    const hasWiki = (law.wiki_content ?? '').trim().length > 50

    // Days from topic creation to law establishment
    let daysToLaw: number | null = null
    if (law.topic_id) {
      const { data: topic } = await supabase
        .from('topics')
        .select('created_at')
        .eq('id', law.topic_id)
        .maybeSingle()
      if (topic?.created_at) {
        const proposed = new Date(topic.created_at).getTime()
        const established = new Date(establishedAt).getTime()
        daysToLaw = Math.max(1, Math.round((established - proposed) / 86_400_000))
      }
    }

    // Argument count from topic
    let argCount = 0
    if (law.topic_id) {
      const { count } = await supabase
        .from('topic_arguments')
        .select('*', { count: 'exact', head: true })
        .eq('topic_id', law.topic_id)
      argCount = count ?? 0
    }

    // Law link count
    const { count: linkCount } = await supabase
      .from('law_links')
      .select('*', { count: 'exact', head: true })
      .or(`source_law_id.eq.${id},target_law_id.eq.${id}`)

    const questions: LawQuizQuestion[] = []

    // Always include FOR% and category
    questions.push(buildForPctQuestion(forPct))
    questions.push(buildCategoryQuestion(category))

    // Year established
    questions.push(buildEstablishedYearQuestion(establishedAt))

    // Total votes if significant
    if (totalVotes >= 5) {
      questions.push(buildTotalVotesQuestion(totalVotes))
    }

    // Days to law if we have the data and it's interesting (more than 1 day)
    if (daysToLaw !== null && daysToLaw >= 1) {
      questions.push(buildDaysToLawQuestion(daysToLaw))
    }

    // Argument count if topic had arguments
    if (argCount >= 2) {
      questions.push(buildArgumentCountQuestion(argCount))
    }

    // Wiki existence — always interesting
    questions.push(buildWikiExistsQuestion(hasWiki))

    // Law links
    if ((linkCount ?? 0) >= 0) {
      questions.push(buildLawLinksQuestion(linkCount ?? 0))
    }

    // Pick 5 random questions from the pool
    const selected = shuffle(questions).slice(0, 5)

    const response: LawQuizData = {
      lawId: id,
      statement: law.statement,
      category,
      establishedAt,
      questions: selected,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[law quiz]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
