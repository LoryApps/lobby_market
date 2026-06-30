import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SideLengthDist {
  short: number   // < 50 words
  medium: number  // 50–149 words
  long: number    // 150+ words
}

export interface SideGradeDist {
  A: number; B: number; C: number; D: number; F: number; ungraded: number
}

export interface SideScoreStats {
  avg: number | null
  median: number | null
  max: number | null
}

export interface TopWord {
  word: string
  count: number
}

export interface TopArg {
  content: string
  upvotes: number
  grade: string | null
}

export interface AnatomyData {
  topic_id: string
  topic_statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number

  total_arguments: number
  for_count: number
  against_count: number

  length_dist: { for: SideLengthDist; against: SideLengthDist }
  grade_dist: { for: SideGradeDist; against: SideGradeDist }

  // % of arguments that include a source_url
  citation_rate: { for: number; against: number }

  upvote_stats: { for: SideScoreStats; against: SideScoreStats }
  ai_score_stats: { for: SideScoreStats; against: SideScoreStats }
  reply_stats: { for: { avg: number; max: number }; against: { avg: number; max: number } }

  top_words: { for: TopWord[]; against: TopWord[] }

  top_for: TopArg | null
  top_against: TopArg | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could',
  'may', 'might', 'shall', 'can', 'not', 'no', 'nor', 'so', 'yet', 'both',
  'either', 'neither', 'this', 'that', 'these', 'those', 'it', 'its', 'they',
  'them', 'their', 'we', 'our', 'you', 'your', 'he', 'she', 'his', 'her',
  'who', 'which', 'what', 'when', 'where', 'why', 'how', 'all', 'any', 'each',
  'more', 'most', 'other', 'some', 'such', 'than', 'then', 'there', 'only',
  'also', 'just', 'very', 'even', 'if', 'as', 'up', 'out', 'about', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under',
  'again', 'further', 'while', 'because', 'since', 'until', 'although', 'over',
  'same', 'much', 'many', 'long', 'make', 'made', 'take', 'taken', 'get', 'got',
  'use', 'used', 'using', 'like', 'need', 'see', 'want', 'well', 'way', 'new',
  'give', 'given', 'work', 'think', 'people', 'government', 'one', 'two', 'must',
])

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function lengthBucket(wc: number): keyof SideLengthDist {
  if (wc < 50) return 'short'
  if (wc < 150) return 'medium'
  return 'long'
}

function parseGrade(g: string | null): keyof SideGradeDist {
  if (g === 'A' || g === 'B' || g === 'C' || g === 'D' || g === 'F') return g
  return 'ungraded'
}

function median(nums: number[]): number | null {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function topWords(texts: string[], n = 12): TopWord[] {
  const freq = new Map<string, number>()
  for (const text of texts) {
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
    for (const w of words) {
      freq.set(w, (freq.get(w) ?? 0) + 1)
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word, count]) => ({ word, count }))
}

function emptyLengthDist(): SideLengthDist {
  return { short: 0, medium: 0, long: 0 }
}

function emptyGradeDist(): SideGradeDist {
  return { A: 0, B: 0, C: 0, D: 0, F: 0, ungraded: 0 }
}

function emptyScoreStats(): SideScoreStats {
  return { avg: null, median: null, max: null }
}

function computeScoreStats(nums: number[]): SideScoreStats {
  if (!nums.length) return emptyScoreStats()
  const avg = nums.reduce((s, v) => s + v, 0) / nums.length
  return {
    avg: Math.round(avg * 10) / 10,
    median: median(nums),
    max: Math.max(...nums),
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch all arguments — no limit (we need complete analysis)
  const { data: args } = await supabase
    .from('topic_arguments')
    .select('id, side, content, upvotes, source_url, ai_score, ai_grade')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })

  const allArgs = args ?? []

  // Fetch reply counts
  const argIds = allArgs.map((a) => a.id)
  const replyCounts = new Map<string, number>()
  if (argIds.length > 0) {
    const { data: replies } = await supabase
      .from('argument_replies')
      .select('argument_id')
      .in('argument_id', argIds)
    for (const r of replies ?? []) {
      replyCounts.set(r.argument_id, (replyCounts.get(r.argument_id) ?? 0) + 1)
    }
  }

  // Partition by side
  const forArgs = allArgs.filter((a) => a.side === 'blue')
  const againstArgs = allArgs.filter((a) => a.side === 'red')

  // Length distributions
  const forLen = emptyLengthDist()
  const againstLen = emptyLengthDist()
  for (const a of forArgs) forLen[lengthBucket(wordCount(a.content))]++
  for (const a of againstArgs) againstLen[lengthBucket(wordCount(a.content))]++

  // Grade distributions
  const forGrades = emptyGradeDist()
  const againstGrades = emptyGradeDist()
  for (const a of forArgs) forGrades[parseGrade(a.ai_grade)]++
  for (const a of againstArgs) againstGrades[parseGrade(a.ai_grade)]++

  // Citation rates
  const forCited = forArgs.filter((a) => !!a.source_url).length
  const againstCited = againstArgs.filter((a) => !!a.source_url).length

  // Upvote stats
  const forUpvotes = forArgs.map((a) => a.upvotes ?? 0)
  const againstUpvotes = againstArgs.map((a) => a.upvotes ?? 0)

  // AI score stats
  const forScores = forArgs.map((a) => a.ai_score).filter((s): s is number => s != null)
  const againstScores = againstArgs.map((a) => a.ai_score).filter((s): s is number => s != null)

  // Reply stats
  const forReplies = forArgs.map((a) => replyCounts.get(a.id) ?? 0)
  const againstReplies = againstArgs.map((a) => replyCounts.get(a.id) ?? 0)
  const avgReplies = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((s, v) => s + v, 0) / arr.length) * 10) / 10 : 0

  // Top words
  const forWords = topWords(forArgs.map((a) => a.content))
  const againstWords = topWords(againstArgs.map((a) => a.content))

  // Top argument per side (already sorted by upvotes desc)
  const topFor = forArgs[0]
    ? { content: forArgs[0].content, upvotes: forArgs[0].upvotes, grade: forArgs[0].ai_grade }
    : null
  const topAgainst = againstArgs[0]
    ? { content: againstArgs[0].content, upvotes: againstArgs[0].upvotes, grade: againstArgs[0].ai_grade }
    : null

  const data: AnatomyData = {
    topic_id: topic.id,
    topic_statement: topic.statement,
    category: topic.category,
    status: topic.status,
    blue_pct: topic.blue_pct ?? 50,
    total_votes: topic.total_votes ?? 0,

    total_arguments: allArgs.length,
    for_count: forArgs.length,
    against_count: againstArgs.length,

    length_dist: { for: forLen, against: againstLen },
    grade_dist: { for: forGrades, against: againstGrades },

    citation_rate: {
      for: forArgs.length ? Math.round((forCited / forArgs.length) * 100) : 0,
      against: againstArgs.length ? Math.round((againstCited / againstArgs.length) * 100) : 0,
    },

    upvote_stats: {
      for: computeScoreStats(forUpvotes),
      against: computeScoreStats(againstUpvotes),
    },
    ai_score_stats: {
      for: computeScoreStats(forScores),
      against: computeScoreStats(againstScores),
    },
    reply_stats: {
      for: { avg: avgReplies(forReplies), max: Math.max(0, ...forReplies) },
      against: { avg: avgReplies(againstReplies), max: Math.max(0, ...againstReplies) },
    },

    top_words: { for: forWords, against: againstWords },
    top_for: topFor,
    top_against: topAgainst,
  }

  return NextResponse.json(data)
}
