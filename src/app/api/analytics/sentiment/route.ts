import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SentimentArgument {
  id: string
  content: string
  side: 'for' | 'against' | null
  upvotes: number
  score: number           // -1 to +1 sentiment score
  category: string | null
  topic_id: string
  topic_statement: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
  created_at: string
}

export interface CategorySentiment {
  category: string
  color: string
  total: number
  positive: number
  neutral: number
  negative: number
  positiveRate: number    // 0-1
  negativeRate: number    // 0-1
  avgScore: number        // -1 to +1
  forAvgScore: number
  againstAvgScore: number
}

export interface SentimentResponse {
  categories: CategorySentiment[]
  platform: {
    total: number
    positive: number
    neutral: number
    negative: number
    positiveRate: number
    negativeRate: number
    avgScore: number
  }
  topPositive: SentimentArgument[]   // most positive by score × upvotes
  topNegative: SentimentArgument[]   // most negative/critical
  userSentiment: {
    avgScore: number
    positiveRate: number
    total: number
    rank: string   // 'optimist' | 'realist' | 'critic' | 'balanced'
  } | null
}

// ─── Sentiment word lists ─────────────────────────────────────────────────────

const POSITIVE_WORDS = new Set([
  'benefit', 'benefits', 'hope', 'improve', 'improvement', 'protect', 'protection',
  'ensure', 'progress', 'better', 'stronger', 'positive', 'success', 'opportunity',
  'opportunities', 'growth', 'fair', 'fairness', 'rights', 'freedom', 'freedoms',
  'safe', 'safety', 'support', 'innovation', 'sustainable', 'sustainability', 'equal',
  'equality', 'quality', 'effective', 'boost', 'build', 'help', 'advance', 'promote',
  'prosper', 'prosperity', 'strengthen', 'thrive', 'empowers', 'empower', 'flourish',
  'gain', 'gains', 'achieve', 'achievement', 'encourage', 'enables', 'enable',
  'create', 'creates', 'value', 'valuable', 'promote', 'promotes', 'accessible',
  'access', 'efficient', 'efficiency', 'transparent', 'transparency', 'accountable',
  'accountability', 'reliable', 'resilient', 'resilience', 'inclusive', 'inclusion',
  'care', 'invest', 'investment', 'solution', 'solutions', 'resolve', 'resolves',
  'trust', 'trusted', 'benefit', 'beneficial', 'correct', 'right', 'ideal', 'best',
  'reform', 'reformed', 'restore', 'restored', 'innovate', 'innovates', 'lead',
  'leadership', 'independent', 'independence', 'dignity', 'respect', 'respected',
])

const NEGATIVE_WORDS = new Set([
  'harm', 'harms', 'harmful', 'risk', 'risks', 'risky', 'fail', 'fails', 'failure',
  'damage', 'damages', 'dangerous', 'danger', 'threat', 'threatens', 'threatening',
  'problem', 'problems', 'crisis', 'burden', 'burdens', 'loss', 'losses', 'fear',
  'fears', 'corrupt', 'corruption', 'broken', 'wrong', 'abuse', 'abuses', 'abusive',
  'unfair', 'restrict', 'restriction', 'restricts', 'waste', 'wasteful', 'ineffective',
  'costly', 'collapse', 'collapses', 'hurt', 'hurts', 'undermine', 'undermines',
  'erode', 'erodes', 'eroding', 'threat', 'threaten', 'threatens', 'attack',
  'attacks', 'destroy', 'destroys', 'destruction', 'deteriorate', 'worsen', 'worsens',
  'injustice', 'inequality', 'inequalities', 'oppression', 'oppress', 'opresses',
  'neglect', 'neglects', 'neglected', 'abandon', 'abandons', 'abandonment',
  'poverty', 'suffering', 'suffer', 'suffers', 'discriminate', 'discrimination',
  'exploit', 'exploits', 'exploitation', 'manipulate', 'manipulates', 'manipulation',
  'block', 'blocks', 'obstruct', 'obstructs', 'obstruction', 'fail', 'failing',
  'flawed', 'flaw', 'flaws', 'broken', 'inadequate', 'inadequacy', 'insufficient',
  'failed', 'worse', 'worst', 'terrible', 'terrible', 'devastating', 'devastating',
])

const STRONG_POSITIVE_WORDS = new Set([
  'excellent', 'outstanding', 'exceptional', 'remarkable', 'vital', 'essential',
  'critical', 'crucial', 'transformative', 'revolutionary', 'groundbreaking',
])

const STRONG_NEGATIVE_WORDS = new Set([
  'catastrophic', 'disastrous', 'devastating', 'catastrophe', 'disaster',
  'terrible', 'horrific', 'egregious', 'unacceptable', 'intolerable',
])

// ─── Score a single argument (-1 to +1) ──────────────────────────────────────

function scoreText(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 0

  let score = 0
  let count = 0

  for (const word of words) {
    if (STRONG_POSITIVE_WORDS.has(word)) { score += 2; count++ }
    else if (STRONG_NEGATIVE_WORDS.has(word)) { score -= 2; count++ }
    else if (POSITIVE_WORDS.has(word)) { score += 1; count++ }
    else if (NEGATIVE_WORDS.has(word)) { score -= 1; count++ }
  }

  if (count === 0) return 0
  // Normalize by word count to avoid length bias; clamp to [-1, 1]
  const raw = score / Math.max(words.length * 0.3, count)
  return Math.max(-1, Math.min(1, raw))
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:    '#c9a84c',
  Politics:     '#3b82f6',
  Technology:   '#8b5cf6',
  Science:      '#10b981',
  Ethics:       '#ef4444',
  Philosophy:   '#a78bfa',
  Culture:      '#f59e0b',
  Health:       '#ec4899',
  Environment:  '#22c55e',
  Education:    '#06b6d4',
  Other:        '#6b7280',
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch recent arguments (last 60 days, max 3000)
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const { data: rows, error } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      content,
      side,
      upvotes,
      created_at,
      user_id,
      topic:topics(id, statement, category),
      author:profiles(username, display_name, avatar_url, role)
    `)
    .gte('created_at', since)
    .order('upvotes', { ascending: false })
    .limit(3000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const args = (rows ?? []) as Array<{
    id: string
    content: string
    side: string | null
    upvotes: number
    created_at: string
    user_id: string
    topic: { id: string; statement: string; category: string | null } | null
    author: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  }>

  // Score each argument
  const scored = args.map((a) => ({
    ...a,
    score: scoreText(a.content),
    category: a.topic?.category ?? 'Other',
  }))

  // ── Category aggregation ──────────────────────────────────────────────────

  const catMap = new Map<string, {
    total: number; positive: number; neutral: number; negative: number
    scoreSum: number; forScoreSum: number; forCount: number
    againstScoreSum: number; againstCount: number
  }>()

  for (const a of scored) {
    const cat = a.category
    if (!catMap.has(cat)) {
      catMap.set(cat, { total: 0, positive: 0, neutral: 0, negative: 0, scoreSum: 0, forScoreSum: 0, forCount: 0, againstScoreSum: 0, againstCount: 0 })
    }
    const c = catMap.get(cat)!
    c.total++
    c.scoreSum += a.score
    if (a.score > 0.1) c.positive++
    else if (a.score < -0.1) c.negative++
    else c.neutral++
    if (a.side === 'for') { c.forScoreSum += a.score; c.forCount++ }
    else if (a.side === 'against') { c.againstScoreSum += a.score; c.againstCount++ }
  }

  const categories: CategorySentiment[] = Array.from(catMap.entries())
    .filter(([, c]) => c.total >= 3)
    .map(([cat, c]) => ({
      category: cat,
      color: CATEGORY_COLOR[cat] ?? '#6b7280',
      total: c.total,
      positive: c.positive,
      neutral: c.neutral,
      negative: c.negative,
      positiveRate: c.total > 0 ? c.positive / c.total : 0,
      negativeRate: c.total > 0 ? c.negative / c.total : 0,
      avgScore: c.total > 0 ? c.scoreSum / c.total : 0,
      forAvgScore: c.forCount > 0 ? c.forScoreSum / c.forCount : 0,
      againstAvgScore: c.againstCount > 0 ? c.againstScoreSum / c.againstCount : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)

  // ── Platform totals ────────────────────────────────────────────────────────

  const total = scored.length
  const positive = scored.filter((a) => a.score > 0.1).length
  const negative = scored.filter((a) => a.score < -0.1).length
  const neutral = total - positive - negative
  const avgScore = total > 0 ? scored.reduce((s, a) => s + a.score, 0) / total : 0

  const platform = {
    total,
    positive,
    neutral,
    negative,
    positiveRate: total > 0 ? positive / total : 0,
    negativeRate: total > 0 ? negative / total : 0,
    avgScore,
  }

  // ── Top positive & negative (weighted by score × log(upvotes+2)) ──────────

  const weightedScore = (a: typeof scored[0]) =>
    a.score * Math.log(a.upvotes + 2)

  const topPositive: SentimentArgument[] = scored
    .filter((a) => a.score > 0.15 && a.author)
    .sort((a, b) => weightedScore(b) - weightedScore(a))
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      content: a.content,
      side: a.side as 'for' | 'against' | null,
      upvotes: a.upvotes,
      score: a.score,
      category: a.topic?.category ?? null,
      topic_id: a.topic?.id ?? '',
      topic_statement: a.topic?.statement ?? '',
      author_username: a.author!.username,
      author_display_name: a.author!.display_name,
      author_avatar_url: a.author!.avatar_url,
      author_role: a.author!.role,
      created_at: a.created_at,
    }))

  const topNegative: SentimentArgument[] = scored
    .filter((a) => a.score < -0.15 && a.author)
    .sort((a, b) => weightedScore(a) - weightedScore(b))
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      content: a.content,
      side: a.side as 'for' | 'against' | null,
      upvotes: a.upvotes,
      score: a.score,
      category: a.topic?.category ?? null,
      topic_id: a.topic?.id ?? '',
      topic_statement: a.topic?.statement ?? '',
      author_username: a.author!.username,
      author_display_name: a.author!.display_name,
      author_avatar_url: a.author!.avatar_url,
      author_role: a.author!.role,
      created_at: a.created_at,
    }))

  // ── Current user's sentiment profile ──────────────────────────────────────

  let userSentiment: SentimentResponse['userSentiment'] = null

  if (user) {
    const userArgs = scored.filter((a) => a.user_id === user.id)
    if (userArgs.length > 0) {
      const userAvg = userArgs.reduce((s, a) => s + a.score, 0) / userArgs.length
      const userPositive = userArgs.filter((a) => a.score > 0.1).length
      const positiveRate = userPositive / userArgs.length
      const rank =
        userAvg > 0.25 ? 'optimist' :
        userAvg < -0.25 ? 'critic' :
        positiveRate > 0.55 ? 'optimist' :
        positiveRate < 0.35 ? 'critic' :
        Math.abs(userAvg) < 0.05 ? 'realist' : 'balanced'
      userSentiment = { avgScore: userAvg, positiveRate, total: userArgs.length, rank }
    }
  }

  const response: SentimentResponse = {
    categories,
    platform,
    topPositive,
    topNegative,
    userSentiment,
  }

  return NextResponse.json(response)
}
