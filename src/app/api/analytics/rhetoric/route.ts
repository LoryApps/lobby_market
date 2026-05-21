import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RhetoricalStyle =
  | 'evidence_based'
  | 'logical'
  | 'historical'
  | 'hypothetical'
  | 'normative'
  | 'personal'

export type LengthBracket = 'concise' | 'standard' | 'detailed' | 'comprehensive'

export interface StyleBreakdown {
  style: RhetoricalStyle
  label: string
  count: number
  pct: number
  avg_upvotes: number
  description: string
  color: string
}

export interface LengthDistribution {
  bracket: LengthBracket
  label: string
  wordRange: string
  count: number
  pct: number
  avg_upvotes: number
  avg_score: number | null
}

export interface CategoryRhetoric {
  category: string
  count: number
  dominant_style: RhetoricalStyle | null
  avg_length: number
  avg_score: number | null
  avg_upvotes: number
}

export interface MonthlyRhetoric {
  month: string
  count: number
  avg_score: number | null
  dominant_style: RhetoricalStyle | null
}

export interface RhetoricTip {
  id: string
  title: string
  body: string
  priority: 'high' | 'medium'
}

export interface RhetoricResponse {
  total: number
  graded: number
  avg_words: number
  dominant_style: RhetoricalStyle | null
  dominant_style_label: string | null
  style_breakdown: StyleBreakdown[]
  length_distribution: LengthDistribution[]
  category_rhetoric: CategoryRhetoric[]
  monthly_rhetoric: MonthlyRhetoric[]
  tips: RhetoricTip[]
  archetype: string | null
  archetype_description: string | null
}

// ─── Text analysis helpers ────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function detectStyle(content: string): RhetoricalStyle {
  const lower = content.toLowerCase()

  const evidenceScore =
    (lower.match(/\b(study|research|data|statistic|report|survey|evidence|source|according|percent|%|\d+\s*%)/g) ?? []).length * 2 +
    (lower.match(/\b(shows?|proves?|demonstrates?|confirms?|indicates?)\b/g) ?? []).length

  const logicalScore =
    (lower.match(/\b(because|therefore|thus|hence|consequently|since|as a result|if|then|implies?|follow|logic|argument|premise|conclusion)\b/g) ?? []).length * 2 +
    (lower.match(/\b(first|second|third|finally|furthermore|moreover|however|although)\b/g) ?? []).length

  const historicalScore =
    (lower.match(/\b(history|historically|throughout|since|century|decade|year|ago|past|previously|traditional|originally|founded|established)\b/g) ?? []).length * 2 +
    (lower.match(/\b(19[0-9]{2}|20[0-2][0-9])\b/g) ?? []).length

  const hypotheticalScore =
    (lower.match(/\b(imagine|suppose|consider|what if|if we|were to|could|would|might|hypothetically|scenario|envision|picture)\b/g) ?? []).length * 2

  const normativeScore =
    (lower.match(/\b(should|must|need|ought|right|wrong|moral|ethical|fair|unfair|just|unjust|principle|value|duty|responsibility|obligation)\b/g) ?? []).length * 2 +
    (lower.match(/\b(never|always|every|all|none|essential|critical|vital|imperative)\b/g) ?? []).length

  const personalScore =
    (lower.match(/\b(i |i'|my |we |our |you |your |personally|in my opinion|from my|believe|think|feel|experience)\b/g) ?? []).length * 2

  const scores: Record<RhetoricalStyle, number> = {
    evidence_based: evidenceScore,
    logical: logicalScore,
    historical: historicalScore,
    hypothetical: hypotheticalScore,
    normative: normativeScore,
    personal: personalScore,
  }

  const dominant = (Object.entries(scores) as [RhetoricalStyle, number][])
    .sort(([, a], [, b]) => b - a)[0]

  return dominant[1] > 0 ? dominant[0] : 'logical'
}

function lengthBracket(words: number): LengthBracket {
  if (words < 50)  return 'concise'
  if (words < 120) return 'standard'
  if (words < 250) return 'detailed'
  return 'comprehensive'
}

const STYLE_META: Record<RhetoricalStyle, { label: string; description: string; color: string }> = {
  evidence_based: {
    label: 'Evidence-Based',
    description: 'You cite data, studies, and statistics to ground your claims.',
    color: 'text-for-300',
  },
  logical: {
    label: 'Logical',
    description: 'You reason from premises to conclusions using structured argument.',
    color: 'text-purple',
  },
  historical: {
    label: 'Historical',
    description: 'You invoke historical context, precedent, and temporal patterns.',
    color: 'text-gold',
  },
  hypothetical: {
    label: 'Hypothetical',
    description: 'You explore scenarios and thought experiments to test ideas.',
    color: 'text-emerald',
  },
  normative: {
    label: 'Normative',
    description: 'You appeal to values, principles, and moral obligations.',
    color: 'text-against-300',
  },
  personal: {
    label: 'Personal Voice',
    description: 'You speak from experience and first-person conviction.',
    color: 'text-for-400',
  },
}

const LENGTH_META: Record<LengthBracket, { label: string; wordRange: string }> = {
  concise:       { label: 'Concise',       wordRange: 'Under 50 words' },
  standard:      { label: 'Standard',      wordRange: '50–120 words' },
  detailed:      { label: 'Detailed',      wordRange: '120–250 words' },
  comprehensive: { label: 'Comprehensive', wordRange: '250+ words' },
}

function archetypeFromStyle(style: RhetoricalStyle | null, avgWords: number): {
  archetype: string; description: string
} | null {
  if (!style) return null
  const long = avgWords > 160

  const map: Record<RhetoricalStyle, { short: [string, string]; long: [string, string] }> = {
    evidence_based: {
      short: ['The Analyst', 'Sharp, data-driven takes that cut straight to the facts.'],
      long:  ['The Researcher', 'Deep, evidence-rich arguments backed by data and sources.'],
    },
    logical: {
      short: ['The Debater', 'Crisp, structured reasoning that forces the issue.'],
      long:  ['The Philosopher', 'Thorough logical frameworks that build airtight cases.'],
    },
    historical: {
      short: ['The Historian', 'Quick historical references that ground the debate in reality.'],
      long:  ['The Scholar', 'Deep historical analysis that contextualises the present.'],
    },
    hypothetical: {
      short: ['The Provocateur', 'Sharp hypotheticals that challenge assumptions.'],
      long:  ['The Visionary', 'Expansive thought experiments that imagine alternative futures.'],
    },
    normative: {
      short: ['The Moralist', 'Direct appeals to values that cut through the noise.'],
      long:  ['The Ethicist', 'Rigorous moral reasoning that maps the principled path forward.'],
    },
    personal: {
      short: ['The Voice', 'Personal conviction delivered with clarity and force.'],
      long:  ['The Storyteller', 'Rich personal testimony that brings abstract debates to life.'],
    },
  }

  const pair = map[style]
  const [archetype, description] = long ? pair.long : pair.short
  return { archetype, description }
}

function generateTips(
  breakdown: StyleBreakdown[],
  lengthDist: LengthDistribution[],
  avgScore: number | null
): RhetoricTip[] {
  const tips: RhetoricTip[] = []

  const hasEvidence = breakdown.find((s) => s.style === 'evidence_based')?.count ?? 0
  const hasLogical = breakdown.find((s) => s.style === 'logical')?.count ?? 0
  const concise = lengthDist.find((l) => l.bracket === 'concise')?.count ?? 0
  const total = breakdown.reduce((s, b) => s + b.count, 0)

  if (total > 0 && hasEvidence / total < 0.15) {
    tips.push({
      id: 'add_evidence',
      title: 'Back claims with data',
      body: 'Less than 15% of your arguments cite evidence. Adding even one statistic or study dramatically increases persuasiveness.',
      priority: 'high',
    })
  }

  if (concise / total > 0.5) {
    tips.push({
      id: 'expand_arguments',
      title: 'Develop your points further',
      body: 'Over half your arguments are under 50 words. Longer, more developed arguments tend to earn more upvotes and better AI scores.',
      priority: 'high',
    })
  }

  if (hasLogical / total < 0.2) {
    tips.push({
      id: 'structure_reasoning',
      title: 'Show your logical chain',
      body: 'Connect your claims explicitly — use "because", "therefore", or "as a result" to make your reasoning transparent and harder to dismiss.',
      priority: 'medium',
    })
  }

  if (avgScore !== null && avgScore < 6) {
    tips.push({
      id: 'improve_clarity',
      title: 'Focus on clarity first',
      body: 'Your average AI score is below 6. Lead with your strongest point, support it with one piece of evidence, and conclude with the implication.',
      priority: 'high',
    })
  }

  const dominant = breakdown[0]
  if (dominant && breakdown.length > 1) {
    const secondStyle = breakdown[1]
    tips.push({
      id: 'diversify_style',
      title: `Try mixing in ${secondStyle.label.toLowerCase()} arguments`,
      body: `You favour ${dominant.label.toLowerCase()} arguments. Occasionally switching to ${secondStyle.label.toLowerCase()} can reach different audiences and make your overall position stronger.`,
      priority: 'medium',
    })
  }

  return tips.slice(0, 4)
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all user's arguments with scores and topic categories
  const { data: rawArgs, error } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      content,
      side,
      upvotes,
      ai_score,
      ai_grade,
      created_at,
      topics:topic_id ( category )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: 'Failed to load arguments' }, { status: 500 })
  }

  if (!rawArgs || rawArgs.length === 0) {
    return NextResponse.json({
      total: 0,
      graded: 0,
      avg_words: 0,
      dominant_style: null,
      dominant_style_label: null,
      style_breakdown: [],
      length_distribution: [],
      category_rhetoric: [],
      monthly_rhetoric: [],
      tips: [],
      archetype: null,
      archetype_description: null,
    } satisfies RhetoricResponse)
  }

  // ── Enrich each argument ──────────────────────────────────────────────────
  const enriched = rawArgs.map((a) => {
    const topicArr = a.topics as Array<{ category: string | null }> | null
    const category = (Array.isArray(topicArr) ? topicArr[0]?.category : (topicArr as { category?: string | null } | null)?.category) ?? null

    return {
      id: a.id as string,
      content: a.content as string,
      side: a.side as 'blue' | 'red',
      upvotes: a.upvotes as number,
      ai_score: a.ai_score as number | null,
      ai_grade: a.ai_grade as string | null,
      created_at: a.created_at as string,
      category,
      words: countWords(a.content as string),
      style: detectStyle(a.content as string),
      bracket: lengthBracket(countWords(a.content as string)),
    }
  })

  const total = enriched.length
  const graded = enriched.filter((a) => a.ai_score !== null).length
  const avgWords = Math.round(enriched.reduce((s, a) => s + a.words, 0) / total)

  // ── Style breakdown ───────────────────────────────────────────────────────
  const styleMap = new Map<RhetoricalStyle, { count: number; upvotesSum: number }>()
  for (const a of enriched) {
    const cur = styleMap.get(a.style) ?? { count: 0, upvotesSum: 0 }
    styleMap.set(a.style, { count: cur.count + 1, upvotesSum: cur.upvotesSum + a.upvotes })
  }

  const styleBreakdown: StyleBreakdown[] = [...styleMap.entries()]
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([style, { count, upvotesSum }]) => ({
      style,
      label: STYLE_META[style].label,
      count,
      pct: Math.round((count / total) * 100),
      avg_upvotes: count > 0 ? Math.round((upvotesSum / count) * 10) / 10 : 0,
      description: STYLE_META[style].description,
      color: STYLE_META[style].color,
    }))

  // ── Length distribution ───────────────────────────────────────────────────
  const bracketMap = new Map<
    LengthBracket,
    { count: number; upvotesSum: number; scoreSum: number; scoredCount: number }
  >()
  for (const a of enriched) {
    const cur = bracketMap.get(a.bracket) ?? { count: 0, upvotesSum: 0, scoreSum: 0, scoredCount: 0 }
    bracketMap.set(a.bracket, {
      count: cur.count + 1,
      upvotesSum: cur.upvotesSum + a.upvotes,
      scoreSum: cur.scoreSum + (a.ai_score ?? 0),
      scoredCount: cur.scoredCount + (a.ai_score !== null ? 1 : 0),
    })
  }

  const lengthOrder: LengthBracket[] = ['concise', 'standard', 'detailed', 'comprehensive']
  const lengthDistribution: LengthDistribution[] = lengthOrder
    .filter((b) => bracketMap.has(b))
    .map((bracket) => {
      const { count, upvotesSum, scoreSum, scoredCount } = bracketMap.get(bracket)!
      return {
        bracket,
        label: LENGTH_META[bracket].label,
        wordRange: LENGTH_META[bracket].wordRange,
        count,
        pct: Math.round((count / total) * 100),
        avg_upvotes: count > 0 ? Math.round((upvotesSum / count) * 10) / 10 : 0,
        avg_score: scoredCount > 0 ? Math.round((scoreSum / scoredCount) * 10) / 10 : null,
      }
    })

  // ── Category rhetoric ─────────────────────────────────────────────────────
  const catMap = new Map<
    string,
    { count: number; wordsSum: number; upvotesSum: number; scoreSum: number; scoredCount: number; styleMap: Map<RhetoricalStyle, number> }
  >()
  for (const a of enriched) {
    const cat = a.category ?? 'General'
    const cur = catMap.get(cat) ?? {
      count: 0, wordsSum: 0, upvotesSum: 0, scoreSum: 0, scoredCount: 0,
      styleMap: new Map<RhetoricalStyle, number>(),
    }
    cur.count++
    cur.wordsSum += a.words
    cur.upvotesSum += a.upvotes
    if (a.ai_score !== null) { cur.scoreSum += a.ai_score; cur.scoredCount++ }
    cur.styleMap.set(a.style, (cur.styleMap.get(a.style) ?? 0) + 1)
    catMap.set(cat, cur)
  }

  const categoryRhetoric: CategoryRhetoric[] = [...catMap.entries()]
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 8)
    .map(([category, { count, wordsSum, upvotesSum, scoreSum, scoredCount, styleMap: sm }]) => {
      const dominantStyle = [...sm.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] ?? null
      return {
        category,
        count,
        dominant_style: dominantStyle,
        avg_length: Math.round(wordsSum / count),
        avg_score: scoredCount > 0 ? Math.round((scoreSum / scoredCount) * 10) / 10 : null,
        avg_upvotes: count > 0 ? Math.round((upvotesSum / count) * 10) / 10 : 0,
      }
    })

  // ── Monthly rhetoric ──────────────────────────────────────────────────────
  const monthMap = new Map<
    string,
    { count: number; scoreSum: number; scoredCount: number; styleMap: Map<RhetoricalStyle, number> }
  >()
  for (const a of enriched) {
    const month = a.created_at.slice(0, 7)
    const cur = monthMap.get(month) ?? {
      count: 0, scoreSum: 0, scoredCount: 0, styleMap: new Map<RhetoricalStyle, number>(),
    }
    cur.count++
    if (a.ai_score !== null) { cur.scoreSum += a.ai_score; cur.scoredCount++ }
    cur.styleMap.set(a.style, (cur.styleMap.get(a.style) ?? 0) + 1)
    monthMap.set(month, cur)
  }

  const monthlyRhetoric: MonthlyRhetoric[] = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, { count, scoreSum, scoredCount, styleMap: sm }]) => {
      const dominantStyle = [...sm.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] ?? null
      return {
        month,
        count,
        avg_score: scoredCount > 0 ? Math.round((scoreSum / scoredCount) * 10) / 10 : null,
        dominant_style: dominantStyle,
      }
    })

  // ── Dominant style & archetype ────────────────────────────────────────────
  const dominantStyle = styleBreakdown[0]?.style ?? null
  const overallAvgScore = graded > 0
    ? Math.round(enriched.filter((a) => a.ai_score !== null).reduce((s, a) => s + (a.ai_score ?? 0), 0) / graded * 10) / 10
    : null

  const archetypeData = archetypeFromStyle(dominantStyle, avgWords)

  // ── Tips ──────────────────────────────────────────────────────────────────
  const tips = generateTips(styleBreakdown, lengthDistribution, overallAvgScore)

  return NextResponse.json({
    total,
    graded,
    avg_words: avgWords,
    dominant_style: dominantStyle,
    dominant_style_label: dominantStyle ? STYLE_META[dominantStyle].label : null,
    style_breakdown: styleBreakdown,
    length_distribution: lengthDistribution,
    category_rhetoric: categoryRhetoric,
    monthly_rhetoric: monthlyRhetoric,
    tips,
    archetype: archetypeData?.archetype ?? null,
    archetype_description: archetypeData?.description ?? null,
  } satisfies RhetoricResponse)
}
