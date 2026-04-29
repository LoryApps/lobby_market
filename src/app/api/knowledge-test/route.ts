import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KnowledgeQuestion {
  id: string
  question: string
  choices: string[]
  correctIndex: number
  explanation: string
  category: 'platform' | 'civic' | 'stats' | 'law'
}

export interface KnowledgeTestPayload {
  questions: KnowledgeQuestion[]
  week: string       // ISO week e.g. "2025-W18"
  totalQuestions: number
}

// ─── Week seed ────────────────────────────────────────────────────────────────

function isoWeek(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const start = new Date(Date.UTC(year, 0, 1))
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1
  const week = Math.ceil(dayOfYear / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.abs((seed * 1103515245 + 12345) ^ i) % (i + 1)
    seed = j
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function seedFromWeek(week: string): number {
  return week.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0)
}

// ─── Question builders ────────────────────────────────────────────────────────

function bucketVotes(n: number): { label: string; lo: number; hi: number }[] {
  if (n < 500) return [
    { label: 'Under 100',       lo: 0,     hi: 99 },
    { label: '100 – 299',       lo: 100,   hi: 299 },
    { label: '300 – 499',       lo: 300,   hi: 499 },
    { label: '500 or more',     lo: 500,   hi: Infinity },
  ]
  if (n < 2_000) return [
    { label: '100 – 499',       lo: 100,   hi: 499 },
    { label: '500 – 999',       lo: 500,   hi: 999 },
    { label: '1 000 – 1 999',   lo: 1_000, hi: 1_999 },
    { label: '2 000 or more',   lo: 2_000, hi: Infinity },
  ]
  if (n < 10_000) return [
    { label: '500 – 1 999',     lo: 500,    hi: 1_999 },
    { label: '2 000 – 4 999',   lo: 2_000,  hi: 4_999 },
    { label: '5 000 – 9 999',   lo: 5_000,  hi: 9_999 },
    { label: '10 000 or more',  lo: 10_000, hi: Infinity },
  ]
  return [
    { label: '2 000 – 9 999',    lo: 2_000,  hi: 9_999 },
    { label: '10 000 – 49 999',  lo: 10_000, hi: 49_999 },
    { label: '50 000 – 99 999',  lo: 50_000, hi: 99_999 },
    { label: '100 000 or more',  lo: 100_000, hi: Infinity },
  ]
}

function correctBucket(n: number, buckets: { label: string; lo: number; hi: number }[]): number {
  return buckets.findIndex((b) => n >= b.lo && n <= b.hi)
}

function pctBuckets(): { label: string; lo: number; hi: number }[] {
  return [
    { label: 'Under 30 %',   lo: 0,  hi: 29 },
    { label: '30 % – 44 %',  lo: 30, hi: 44 },
    { label: '45 % – 55 %',  lo: 45, hi: 55 },
    { label: '56 % – 70 %',  lo: 56, hi: 70 },
    { label: 'Over 70 %',    lo: 71, hi: 100 },
  ]
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const week = isoWeek()
  const seed = seedFromWeek(week)

  // ── Gather platform data ─────────────────────────────────────────────────

  const [
    { data: topicsRaw },
    { data: lawsRaw },
    { data: debatesRaw },
    { data: profilesRaw },
  ] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting', 'law', 'failed', 'proposed'])
      .order('total_votes', { ascending: false })
      .limit(500),
    supabase
      .from('topics')
      .select('category')
      .eq('status', 'law'),
    supabase
      .from('debates')
      .select('type')
      .not('type', 'is', null),
    supabase
      .from('profiles')
      .select('username, reputation_score, total_votes')
      .order('reputation_score', { ascending: false })
      .limit(20),
  ])

  const topics = topicsRaw ?? []
  const laws = lawsRaw ?? []
  const debates = debatesRaw ?? []
  const profiles = profilesRaw ?? []

  // ── Compute stats ────────────────────────────────────────────────────────

  const totalVotes = topics.reduce((s, t) => s + (t.total_votes ?? 0), 0)
  const totalTopics = topics.length
  const totalLaws = laws.length
  const totalFailed = topics.filter((t) => t.status === 'failed').length

  // Category law counts
  const lawsByCat: Record<string, number> = {}
  for (const l of laws) {
    const cat = l.category ?? 'Other'
    lawsByCat[cat] = (lawsByCat[cat] ?? 0) + 1
  }
  const topLawCat = Object.entries(lawsByCat).sort((a, b) => b[1] - a[1])

  // Category topic counts
  const topicsByCat: Record<string, number> = {}
  for (const t of topics) {
    const cat = t.category ?? 'Other'
    topicsByCat[cat] = (topicsByCat[cat] ?? 0) + 1
  }
  const topTopicCat = Object.entries(topicsByCat).sort((a, b) => b[1] - a[1])

  // Most-voted topic
  const mostVoted = topics[0]

  // Closest-to-50 topic (most contested)
  const activeTopics = topics.filter((t) => ['active', 'voting'].includes(t.status) && t.total_votes >= 10)
  const closest = [...activeTopics].sort((a, b) =>
    Math.abs((a.blue_pct ?? 50) - 50) - Math.abs((b.blue_pct ?? 50) - 50),
  )[0]

  // Debate type breakdown
  const debateTypes: Record<string, number> = {}
  for (const d of debates) {
    const t = d.type ?? 'quick'
    debateTypes[t] = (debateTypes[t] ?? 0) + 1
  }
  const topDebateType = Object.entries(debateTypes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'quick'

  // Overall FOR percentage across all votes
  const totalBlue = topics.reduce((s, t) => s + (t.blue_pct ?? 50) * (t.total_votes ?? 0) / 100, 0)
  const overallForPct = totalVotes > 0 ? Math.round((totalBlue / totalVotes) * 100) : 50

  // Failure rate
  const decidedTopics = totalLaws + totalFailed
  const failurePct = decidedTopics > 0 ? Math.round((totalFailed / decidedTopics) * 100) : 0

  // Top contributor
  const topUser = profiles[0]

  // ── Build questions ──────────────────────────────────────────────────────

  const allQuestions: KnowledgeQuestion[] = []

  // Q1: Total platform votes
  if (totalVotes > 0) {
    const buckets = bucketVotes(totalVotes)
    const correct = correctBucket(totalVotes, buckets)
    if (correct >= 0) {
      allQuestions.push({
        id: 'total-votes',
        question: 'How many total votes have been cast across all topics on Lobby Market?',
        choices: buckets.map((b) => b.label),
        correctIndex: correct,
        explanation: `The platform has recorded ${totalVotes.toLocaleString()} votes in total across ${totalTopics.toLocaleString()} topics.`,
        category: 'stats',
      })
    }
  }

  // Q2: Total laws passed
  if (totalLaws > 0) {
    const buckets = [
      { label: '1 – 9',   lo: 1,  hi: 9 },
      { label: '10 – 24', lo: 10, hi: 24 },
      { label: '25 – 49', lo: 25, hi: 49 },
      { label: '50 +',    lo: 50, hi: Infinity },
    ]
    const correct = correctBucket(totalLaws, buckets)
    if (correct >= 0) {
      allQuestions.push({
        id: 'total-laws',
        question: 'How many topics have successfully passed into Law through the community vote?',
        choices: buckets.map((b) => b.label),
        correctIndex: correct,
        explanation: `${totalLaws} topic${totalLaws === 1 ? '' : 's'} have earned enough FOR votes to be ratified as community law.`,
        category: 'law',
      })
    }
  }

  // Q3: Category with most laws
  if (topLawCat.length >= 4) {
    const [winner, ...others] = topLawCat
    const wrong = others.slice(0, 3).map(([cat]) => cat)
    const choices = shuffle([winner[0], ...wrong], seed + 3)
    const correctIndex = choices.indexOf(winner[0])
    allQuestions.push({
      id: 'top-law-cat',
      question: 'Which debate category has produced the most Laws on Lobby Market?',
      choices,
      correctIndex,
      explanation: `"${winner[0]}" leads with ${winner[1]} law${winner[1] === 1 ? '' : 's'} passed by community vote.`,
      category: 'law',
    })
  }

  // Q4: Most active category (by topic count)
  if (topTopicCat.length >= 4) {
    const [winner, ...others] = topTopicCat
    const wrong = others.slice(0, 3).map(([cat]) => cat)
    const choices = shuffle([winner[0], ...wrong], seed + 4)
    const correctIndex = choices.indexOf(winner[0])
    allQuestions.push({
      id: 'top-topic-cat',
      question: 'Which category has the most debate topics proposed on the platform?',
      choices,
      correctIndex,
      explanation: `"${winner[0]}" has ${winner[1]} total topics — the most active debate arena on the platform.`,
      category: 'platform',
    })
  }

  // Q5: Overall FOR percentage
  if (totalVotes > 0) {
    const buckets = pctBuckets()
    const correct = buckets.findIndex((b) => overallForPct >= b.lo && overallForPct <= b.hi)
    if (correct >= 0) {
      allQuestions.push({
        id: 'for-pct',
        question: 'Across all topics on Lobby Market, what percentage of total votes are cast FOR (blue)?',
        choices: buckets.map((b) => b.label),
        correctIndex: correct,
        explanation: `${overallForPct}% of platform votes are FOR, meaning the community leans ${overallForPct > 50 ? 'slightly towards agreement' : 'slightly towards disagreement'} overall.`,
        category: 'stats',
      })
    }
  }

  // Q6: Topic failure rate
  if (decidedTopics >= 5) {
    const buckets = [
      { label: 'Under 20 %',   lo: 0,  hi: 19 },
      { label: '20 % – 39 %',  lo: 20, hi: 39 },
      { label: '40 % – 59 %',  lo: 40, hi: 59 },
      { label: '60 % or more', lo: 60, hi: 100 },
    ]
    const correct = buckets.findIndex((b) => failurePct >= b.lo && failurePct <= b.hi)
    if (correct >= 0) {
      allQuestions.push({
        id: 'failure-rate',
        question: 'What percentage of topics that go to a vote ultimately FAIL to become Law?',
        choices: buckets.map((b) => b.label),
        correctIndex: correct,
        explanation: `${failurePct}% of decided topics fail. Out of ${decidedTopics} concluded topics, ${totalFailed} were rejected by voters.`,
        category: 'stats',
      })
    }
  }

  // Q7: Most-voted topic (truncated to 60 chars)
  if (mostVoted && topics.length >= 4) {
    const othersForQ = topics.slice(1, 4).map((t) =>
      t.statement.length > 60 ? t.statement.slice(0, 57) + '…' : t.statement,
    )
    const winnerLabel =
      mostVoted.statement.length > 60
        ? mostVoted.statement.slice(0, 57) + '…'
        : mostVoted.statement
    const choices = shuffle([winnerLabel, ...othersForQ], seed + 7)
    const correctIndex = choices.indexOf(winnerLabel)
    allQuestions.push({
      id: 'most-voted',
      question: 'Which topic has received the most total votes on the platform?',
      choices,
      correctIndex,
      explanation: `"${winnerLabel}" has gathered ${mostVoted.total_votes.toLocaleString()} votes — more than any other topic.`,
      category: 'platform',
    })
  }

  // Q8: Most common debate type
  if (topDebateType && Object.keys(debateTypes).length >= 2) {
    const typeLabels: Record<string, string> = {
      quick: 'Quick Debate (15 min)',
      grand: 'Grand Debate (60 min)',
      tribunal: 'Tribunal (structured)',
    }
    const allTypes = ['quick', 'grand', 'tribunal']
    const choices = allTypes.map((t) => typeLabels[t] ?? t)
    const correctIndex = allTypes.indexOf(topDebateType)
    allQuestions.push({
      id: 'debate-type',
      question: 'Which debate format is used most frequently on Lobby Market?',
      choices,
      correctIndex,
      explanation: `"${typeLabels[topDebateType] ?? topDebateType}" is the most popular format, used in ${debateTypes[topDebateType] ?? 0} debates.`,
      category: 'platform',
    })
  }

  // Q9: Closest contested topic vote split
  if (closest) {
    const actualPct = Math.round(closest.blue_pct ?? 50)
    const buckets = [
      { label: 'Under 40 % FOR',   lo: 0,  hi: 39 },
      { label: '40 % – 49 % FOR',  lo: 40, hi: 49 },
      { label: '50 % – 59 % FOR',  lo: 50, hi: 59 },
      { label: '60 % or more FOR', lo: 60, hi: 100 },
    ]
    const correct = buckets.findIndex((b) => actualPct >= b.lo && actualPct <= b.hi)
    const truncated =
      closest.statement.length > 65
        ? closest.statement.slice(0, 62) + '…'
        : closest.statement
    if (correct >= 0) {
      allQuestions.push({
        id: 'closest-topic',
        question: `What is the current FOR vote percentage on the most contested active topic: "${truncated}"?`,
        choices: buckets.map((b) => b.label),
        correctIndex: correct,
        explanation: `This topic sits at ${actualPct}% FOR — one of the most evenly split debates on the platform.`,
        category: 'civic',
      })
    }
  }

  // Q10: Top reputation user (if enough profiles)
  if (topUser && profiles.length >= 4) {
    const others = profiles.slice(1, 4).map((p) => p.username)
    const choices = shuffle([topUser.username, ...others], seed + 10)
    const correctIndex = choices.indexOf(topUser.username)
    allQuestions.push({
      id: 'top-user',
      question: 'Which user currently holds the highest reputation score on Lobby Market?',
      choices,
      correctIndex,
      explanation: `@${topUser.username} leads the reputation rankings with a score of ${topUser.reputation_score.toLocaleString()} — earned through consistent civic engagement.`,
      category: 'platform',
    })
  }

  // ── Finalise: pick up to 8 questions with weekly seed shuffle ───────────

  const shuffled = shuffle(allQuestions, seed)
  const selected = shuffled.slice(0, 8)

  if (selected.length < 3) {
    return NextResponse.json({ error: 'Not enough data yet' }, { status: 404 })
  }

  return NextResponse.json({
    questions: selected,
    week,
    totalQuestions: selected.length,
  } satisfies KnowledgeTestPayload)
}
