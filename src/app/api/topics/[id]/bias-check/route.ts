import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SideStat {
  count: number
  avgUpvotes: number
  avgLength: number
  sourcedPct: number        // % with source_url
  topArgument: {
    id: string
    content: string
    upvotes: number
    authorUsername: string | null
    authorAvatar: string | null
  } | null
}

export interface LoadedWord {
  word: string
  weight: number            // 1–3: mild / moderate / heavy
  context: string           // snippet from the statement
}

export interface BalanceDimension {
  key: string
  label: string
  forScore: number          // 0–100
  againstScore: number
  note: string
}

export interface BiasCheckResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  balanceScore: number                  // 0–100: 100 = perfectly balanced
  verdict: 'balanced' | 'leaning_for' | 'leaning_against' | 'one_sided'
  dimensions: BalanceDimension[]
  loadedWords: LoadedWord[]
  statementBiasScore: number            // 0–100: 0 = neutral, 100 = highly loaded
  forStats: SideStat
  againstStats: SideStat
  totalArguments: number
}

// ─── Loaded-language word list ────────────────────────────────────────────────

const LOADED_WORDS: [string, number][] = [
  // Heavy (3) — emotionally charged or politically loaded
  ['destroy', 3], ['ruin', 3], ['catastrophic', 3], ['evil', 3], ['corrupt', 3],
  ['radical', 3], ['extreme', 3], ['dangerous', 3], ['disastrous', 3], ['forced', 3],
  ['ban', 3], ['abolish', 3], ['eliminate', 3], ['mandate', 3], ['tyranny', 3],
  ['propaganda', 3], ['indoctrinate', 3], ['agenda', 3], ['crisis', 3],
  // Moderate (2) — slightly loaded framing
  ['should', 2], ['must', 2], ['never', 2], ['always', 2], ['obvious', 2],
  ['clearly', 2], ['simply', 2], ['just', 2], ['only', 2], ['proven', 2],
  ['failed', 2], ['broken', 2], ['wrong', 2], ['harmful', 2], ['unfair', 2],
  ['free', 2], ['common sense', 2], ['everyone', 2], ['nobody', 2],
  // Mild (1) — slightly directional words
  ['better', 1], ['worse', 1], ['improve', 1], ['fix', 1], ['solve', 1],
  ['protect', 1], ['support', 1], ['oppose', 1], ['reform', 1], ['change', 1],
]

function detectLoadedWords(statement: string): LoadedWord[] {
  const lower = statement.toLowerCase()
  const found: LoadedWord[] = []

  for (const [word, weight] of LOADED_WORDS) {
    const idx = lower.indexOf(word)
    if (idx !== -1) {
      const start = Math.max(0, idx - 20)
      const end = Math.min(statement.length, idx + word.length + 20)
      found.push({
        word,
        weight,
        context: '…' + statement.slice(start, end).trim() + '…',
      })
    }
  }
  return found
}

function statementBiasScore(loadedWords: LoadedWord[]): number {
  if (loadedWords.length === 0) return 0
  const total = loadedWords.reduce((s, w) => s + w.weight, 0)
  return Math.min(100, Math.round((total / (loadedWords.length * 3)) * 100))
}

// ─── Balance score helpers ────────────────────────────────────────────────────

function balanceRatio(a: number, b: number): number {
  if (a === 0 && b === 0) return 100
  const total = a + b
  const larger = Math.max(a, b)
  return Math.round(100 - ((larger / total - 0.5) / 0.5) * 100)
}

// ─── GET /api/topics/[id]/bias-check ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const [topicRes, argsRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', params.id)
      .single(),
    supabase
      .from('arguments')
      .select(`
        id, side, content, upvotes, source_url,
        author:profiles ( username, display_name, avatar_url )
      `)
      .eq('topic_id', params.id)
      .order('upvotes', { ascending: false })
      .limit(200),
  ])

  if (!topicRes.data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const topic = topicRes.data
  const args = (argsRes.data ?? []) as {
    id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    source_url: string | null
    author: { username: string; display_name: string | null; avatar_url: string | null } | null
  }[]

  const forArgs = args.filter((a) => a.side === 'blue')
  const againstArgs = args.filter((a) => a.side === 'red')

  function sideStats(sideArgs: typeof args): SideStat {
    if (sideArgs.length === 0) {
      return { count: 0, avgUpvotes: 0, avgLength: 0, sourcedPct: 0, topArgument: null }
    }
    const avgUpvotes = sideArgs.reduce((s, a) => s + (a.upvotes ?? 0), 0) / sideArgs.length
    const avgLength = sideArgs.reduce((s, a) => s + a.content.length, 0) / sideArgs.length
    const sourcedCount = sideArgs.filter((a) => a.source_url && a.source_url.trim()).length
    const top = sideArgs[0]
    return {
      count: sideArgs.length,
      avgUpvotes: Math.round(avgUpvotes * 10) / 10,
      avgLength: Math.round(avgLength),
      sourcedPct: Math.round((sourcedCount / sideArgs.length) * 100),
      topArgument: top
        ? {
            id: top.id,
            content: top.content.slice(0, 200),
            upvotes: top.upvotes ?? 0,
            authorUsername: top.author?.username ?? null,
            authorAvatar: top.author?.avatar_url ?? null,
          }
        : null,
    }
  }

  const forStats = sideStats(forArgs)
  const againstStats = sideStats(againstArgs)

  // ── Dimensions ─────────────────────────────────────────────────────────────

  const volumeBalance = balanceRatio(forStats.count, againstStats.count)
  const engagementBalance = balanceRatio(
    forStats.avgUpvotes * forStats.count,
    againstStats.avgUpvotes * againstStats.count
  )
  const depthBalance = balanceRatio(forStats.avgLength, againstStats.avgLength)
  const sourceBalance = balanceRatio(forStats.sourcedPct, againstStats.sourcedPct)

  const dimensions: BalanceDimension[] = [
    {
      key: 'volume',
      label: 'Argument Volume',
      forScore: forStats.count,
      againstScore: againstStats.count,
      note:
        volumeBalance >= 80
          ? 'Both sides have similar representation'
          : volumeBalance >= 60
          ? 'One side has significantly more arguments'
          : 'Debate is heavily skewed toward one side',
    },
    {
      key: 'engagement',
      label: 'Community Engagement',
      forScore: Math.round(forStats.avgUpvotes * 10) / 10,
      againstScore: Math.round(againstStats.avgUpvotes * 10) / 10,
      note:
        engagementBalance >= 80
          ? 'Community upvotes both sides equally'
          : 'One side is receiving more community validation',
    },
    {
      key: 'depth',
      label: 'Argument Depth',
      forScore: forStats.avgLength,
      againstScore: againstStats.avgLength,
      note:
        depthBalance >= 70
          ? 'Arguments on both sides are similarly detailed'
          : 'One side tends to write longer, more detailed arguments',
    },
    {
      key: 'evidence',
      label: 'Source Citation',
      forScore: forStats.sourcedPct,
      againstScore: againstStats.sourcedPct,
      note:
        sourceBalance >= 70
          ? 'Both sides cite sources at similar rates'
          : 'One side cites significantly more external sources',
    },
  ]

  // ── Overall balance score ──────────────────────────────────────────────────

  const overallBalance = Math.round(
    (volumeBalance + engagementBalance + depthBalance + sourceBalance) / 4
  )

  let verdict: BiasCheckResponse['verdict']
  if (overallBalance >= 75) {
    verdict = 'balanced'
  } else if (overallBalance >= 55) {
    verdict = forArgs.length > againstArgs.length ? 'leaning_for' : 'leaning_against'
  } else {
    verdict = forArgs.length > againstArgs.length ? 'leaning_for' : 'leaning_against'
    if (overallBalance < 40) verdict = 'one_sided'
  }

  const loadedWords = detectLoadedWords(topic.statement)
  const stmtBias = statementBiasScore(loadedWords)

  const response: BiasCheckResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category ?? null,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
    },
    balanceScore: overallBalance,
    verdict,
    dimensions,
    loadedWords,
    statementBiasScore: stmtBias,
    forStats,
    againstStats,
    totalArguments: args.length,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' },
  })
}
