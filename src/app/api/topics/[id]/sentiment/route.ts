import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SentimentBand {
  label: string
  key: string
  description: string
  forCount: number
  againstCount: number
  forPct: number  // % of FOR args in this band
  againstPct: number
}

export interface SentimentArg {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  score: number   // -100 to 100
  label: string   // 'constructive' | 'neutral' | 'charged' | 'inflammatory'
  topSignals: string[]
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface SentimentTrend {
  month: string   // "2024-01"
  avgScore: number
  count: number
}

export interface SentimentResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  // 0-100: overall civility of discourse
  civilityScore: number
  // distribution across sentiment bands
  distribution: SentimentBand[]
  // most constructive on each side
  mostConstructive: { for: SentimentArg | null; against: SentimentArg | null }
  // most inflammatory on each side
  mostCharged: { for: SentimentArg | null; against: SentimentArg | null }
  // monthly trend
  trend: SentimentTrend[]
  stats: {
    totalArgs: number
    forArgs: number
    againstArgs: number
    avgForScore: number
    avgAgainstScore: number
    constructivePct: number
    chargedPct: number
    inflammatoryPct: number
  }
  insight: string
}

// ─── Sentiment lexicons ───────────────────────────────────────────────────────

const POSITIVE_PATTERNS: RegExp[] = [
  /\b(evidence|research|study|data|analysis|fact|proven|demonstrat|show[s]?|support|suggest)\w*/i,
  /\b(benefit|improve|help|solve|solution|address|protect|ensure|guarante|strengthen)\w*/i,
  /\b(respectful|civil|honest|transparent|fair|equitable|inclusive|compassion)\w*/i,
  /\b(agree|acknowledge|valid|legitimate|reasonable|consider|understand|recogni[sz]e)\w*/i,
  /\b(collaborate|together|common|shared|mutual|cooperat|constructive|dialogue)\w*/i,
  /\b(nuance|complex|balance|careful|thoughtful|deliberat|reflect)\w*/i,
]

const NEGATIVE_PATTERNS: RegExp[] = [
  /\b(wrong|false|lie|liar|dishonest|deceiv|manipulat|mislead)\w*/i,
  /\b(stupid|idiot|fool|ignorant|naive|absurd|ridiculous|ludicrous|nonsense)\w*/i,
  /\b(dangerous|threat|destroy|ruin|catastroph|disaster|collapse|fail)\w*/i,
  /\b(never|always|every|all|none|total|absolute|extreme|radical)\w*/i,
  /\b(corrupt|greed|selfish|evil|immoral|unethical|shameful|disgrac)\w*/i,
  /\b(hate|despise|disgust|appall|horrif|outrag|fury|rage)\w*/i,
]

const INFLAMMATORY_PATTERNS: RegExp[] = [
  /\b(fascist|communist|socialist|nazi|terrorist|traitor|enemy|scum)\w*/i,
  /\b(brainwash|indoctrinat|sheep|wake\s*up|sheeple|pawn|puppet|shill)\w*/i,
  /\b(moron|imbecil|cretin|pathetic|worthless|garbage|trash|clown)\w*/i,
  /\bkill\b|\bdead\b|\bdie\b|\bkilling\b/i,
  /\b(propaganda|fake\s*news|conspiracy|psyop)\b/i,
]

const NEUTRAL_HEDGE_PATTERNS: RegExp[] = [
  /\b(however|although|whereas|despite|while|though|but|yet|neverthe)\w*/i,
  /\b(perhaps|possibly|might|could|may|likely|probably|arguably)\b/i,
  /\b(on\s*(the\s*)?other\s*hand|in\s*contrast|alternatively|conversely)\b/i,
]

// ─── Sentiment scorer ─────────────────────────────────────────────────────────

interface SentimentResult {
  score: number      // -100 to 100
  label: 'constructive' | 'neutral' | 'charged' | 'inflammatory'
  topSignals: string[]
}

function scoreArgument(text: string): SentimentResult {
  const lower = text.toLowerCase()
  const words = lower.split(/\W+/)

  let positiveHits = 0
  let negativeHits = 0
  let inflammatoryHits = 0
  const signals: string[] = []

  // Count inflammatory — these are hard negatives
  for (const pat of INFLAMMATORY_PATTERNS) {
    const match = text.match(pat)
    if (match) {
      inflammatoryHits++
      signals.push(match[0].toLowerCase().slice(0, 20))
    }
  }

  // Count constructive signals
  for (const pat of POSITIVE_PATTERNS) {
    const matches = text.match(new RegExp(pat.source, 'gi'))
    if (matches) {
      positiveHits += matches.length
      if (signals.length < 6) signals.push(matches[0].toLowerCase().slice(0, 20))
    }
  }

  // Count negative signals
  for (const pat of NEGATIVE_PATTERNS) {
    const matches = text.match(new RegExp(pat.source, 'gi'))
    if (matches) {
      negativeHits += matches.length
      if (signals.length < 6) signals.push(matches[0].toLowerCase().slice(0, 20))
    }
  }

  // Neutral hedging reduces extremes
  let hedgeBonus = 0
  for (const pat of NEUTRAL_HEDGE_PATTERNS) {
    if (pat.test(text)) hedgeBonus += 5
  }

  // Score: positive lifts, negative drops, inflammatory crushes
  // Word count normalisation (longer = more signal)
  const wordCount = Math.max(words.length, 1)
  const normFactor = Math.min(wordCount / 50, 1)

  let rawScore: number
  if (inflammatoryHits > 0) {
    rawScore = -40 - inflammatoryHits * 15
  } else {
    const positiveWeight = positiveHits * 8 * normFactor
    const negativeWeight = negativeHits * 5 * normFactor
    rawScore = positiveWeight - negativeWeight + hedgeBonus
  }

  const score = Math.max(-100, Math.min(100, Math.round(rawScore)))

  let label: SentimentResult['label']
  if (inflammatoryHits > 0 || score <= -40) {
    label = 'inflammatory'
  } else if (score <= -10) {
    label = 'charged'
  } else if (score <= 20) {
    label = 'neutral'
  } else {
    label = 'constructive'
  }

  return { score, label, topSignals: [...new Set(signals)].slice(0, 5) }
}

// ─── GET /api/topics/[id]/sentiment ──────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const { id } = params

  // ── Topic ─────────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // ── Arguments ─────────────────────────────────────────────────────────────
  const { data: rawArgs } = await supabase
    .from('arguments')
    .select(`
      id,
      side,
      content,
      upvotes,
      created_at,
      profiles(username, display_name, avatar_url, role)
    `)
    .eq('topic_id', id)
    .order('created_at', { ascending: true })
    .limit(200)

  const args = rawArgs ?? []

  if (args.length === 0) {
    const empty: SentimentResponse = {
      topic,
      civilityScore: 50,
      distribution: [],
      mostConstructive: { for: null, against: null },
      mostCharged: { for: null, against: null },
      trend: [],
      stats: {
        totalArgs: 0, forArgs: 0, againstArgs: 0,
        avgForScore: 50, avgAgainstScore: 50,
        constructivePct: 0, chargedPct: 0, inflammatoryPct: 0,
      },
      insight: 'No arguments yet — be the first to contribute to this discussion.',
    }
    return NextResponse.json(empty)
  }

  // ── Score each argument ───────────────────────────────────────────────────
  interface ScoredArg {
    id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    score: number
    label: 'constructive' | 'neutral' | 'charged' | 'inflammatory'
    topSignals: string[]
    created_at: string
    author: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  }

  const scored: ScoredArg[] = args.map((a) => {
    const result = scoreArgument(a.content ?? '')
    const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
    return {
      id: a.id,
      side: a.side as 'blue' | 'red',
      content: a.content ?? '',
      upvotes: a.upvotes ?? 0,
      score: result.score,
      label: result.label,
      topSignals: result.topSignals,
      created_at: a.created_at,
      author: profile
        ? {
            username: (profile as { username: string }).username,
            display_name: (profile as { display_name: string | null }).display_name,
            avatar_url: (profile as { avatar_url: string | null }).avatar_url,
            role: (profile as { role: string }).role,
          }
        : null,
    }
  })

  const forArgs = scored.filter((a) => a.side === 'blue')
  const againstArgs = scored.filter((a) => a.side === 'red')

  // ── Distribution bands ────────────────────────────────────────────────────
  const BANDS: Array<{ key: string; label: string; description: string; test: (s: ScoredArg) => boolean }> = [
    {
      key: 'constructive',
      label: 'Constructive',
      description: 'Evidence-based, reasoned, respectful',
      test: (a) => a.label === 'constructive',
    },
    {
      key: 'neutral',
      label: 'Neutral',
      description: 'Factual or measured, limited strong language',
      test: (a) => a.label === 'neutral',
    },
    {
      key: 'charged',
      label: 'Charged',
      description: 'Emotionally loaded but not abusive',
      test: (a) => a.label === 'charged',
    },
    {
      key: 'inflammatory',
      label: 'Inflammatory',
      description: 'Contains hostile or toxic language',
      test: (a) => a.label === 'inflammatory',
    },
  ]

  const distribution: SentimentBand[] = BANDS.map((band) => {
    const fc = forArgs.filter(band.test).length
    const ac = againstArgs.filter(band.test).length
    return {
      key: band.key,
      label: band.label,
      description: band.description,
      forCount: fc,
      againstCount: ac,
      forPct: forArgs.length > 0 ? Math.round((fc / forArgs.length) * 100) : 0,
      againstPct: againstArgs.length > 0 ? Math.round((ac / againstArgs.length) * 100) : 0,
    }
  })

  // ── Civility score ────────────────────────────────────────────────────────
  const allScores = scored.map((a) => a.score)
  const avgRaw = allScores.reduce((s, v) => s + v, 0) / allScores.length
  // Map from [-100,100] to [0,100]
  const civilityScore = Math.round(Math.max(0, Math.min(100, (avgRaw + 100) / 2)))

  // ── Best/worst per side ───────────────────────────────────────────────────
  const toSentimentArg = (a: ScoredArg): SentimentArg => ({
    id: a.id,
    side: a.side,
    content: a.content.slice(0, 400) + (a.content.length > 400 ? '…' : ''),
    upvotes: a.upvotes,
    score: a.score,
    label: a.label,
    topSignals: a.topSignals,
    author: a.author,
  })

  const topForConstructive = [...forArgs]
    .filter((a) => a.label === 'constructive')
    .sort((a, b) => b.score - a.score || b.upvotes - a.upvotes)[0] ?? null
  const topAgainstConstructive = [...againstArgs]
    .filter((a) => a.label === 'constructive')
    .sort((a, b) => b.score - a.score || b.upvotes - a.upvotes)[0] ?? null

  const topForCharged = [...forArgs]
    .filter((a) => a.label === 'inflammatory' || a.label === 'charged')
    .sort((a, b) => a.score - b.score)[0] ?? null
  const topAgainstCharged = [...againstArgs]
    .filter((a) => a.label === 'inflammatory' || a.label === 'charged')
    .sort((a, b) => a.score - b.score)[0] ?? null

  // ── Monthly trend ─────────────────────────────────────────────────────────
  const byMonth = new Map<string, number[]>()
  for (const a of scored) {
    const month = a.created_at.slice(0, 7)
    const bucket = byMonth.get(month) ?? []
    bucket.push(a.score)
    byMonth.set(month, bucket)
  }

  const trend: SentimentTrend[] = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, scores]) => ({
      month,
      avgScore: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
      count: scores.length,
    }))

  // ── Stats ─────────────────────────────────────────────────────────────────
  const avgForScore = forArgs.length
    ? Math.round(forArgs.reduce((s, a) => s + a.score, 0) / forArgs.length)
    : 0
  const avgAgainstScore = againstArgs.length
    ? Math.round(againstArgs.reduce((s, a) => s + a.score, 0) / againstArgs.length)
    : 0

  const constructivePct = Math.round(
    (scored.filter((a) => a.label === 'constructive').length / scored.length) * 100,
  )
  const chargedPct = Math.round(
    (scored.filter((a) => a.label === 'charged').length / scored.length) * 100,
  )
  const inflammatoryPct = Math.round(
    (scored.filter((a) => a.label === 'inflammatory').length / scored.length) * 100,
  )

  // ── Insight ───────────────────────────────────────────────────────────────
  let insight: string
  if (civilityScore >= 70) {
    insight = `This debate shows high civic quality — ${constructivePct}% of arguments are evidence-based and respectful. A model discussion.`
  } else if (civilityScore >= 50) {
    insight = `Mixed discourse: ${constructivePct}% constructive vs ${inflammatoryPct > 0 ? `${inflammatoryPct}% inflammatory` : `${chargedPct}% charged`}. Room for improvement but the core is solid.`
  } else if (civilityScore >= 30) {
    insight = `Heated debate: strong emotions dominate. ${chargedPct + inflammatoryPct}% of arguments are emotionally charged — consider whether more evidence could cool the conversation.`
  } else {
    insight = `Discourse health warning: this topic has elevated hostility. ${inflammatoryPct}% inflammatory content detected. Community moderation may help.`
  }

  const response: SentimentResponse = {
    topic,
    civilityScore,
    distribution,
    mostConstructive: {
      for: topForConstructive ? toSentimentArg(topForConstructive) : null,
      against: topAgainstConstructive ? toSentimentArg(topAgainstConstructive) : null,
    },
    mostCharged: {
      for: topForCharged ? toSentimentArg(topForCharged) : null,
      against: topAgainstCharged ? toSentimentArg(topAgainstCharged) : null,
    },
    trend,
    stats: {
      totalArgs: scored.length,
      forArgs: forArgs.length,
      againstArgs: againstArgs.length,
      avgForScore,
      avgAgainstScore,
      constructivePct,
      chargedPct,
      inflammatoryPct,
    },
    insight,
  }

  return NextResponse.json(response)
}
