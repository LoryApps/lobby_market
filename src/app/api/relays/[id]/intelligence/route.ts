import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegAnalysis {
  leg_number: number
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
  content: string
  word_count: number
  sentence_count: number
  /** Estimated quality 0–100 based on length, structure, and signal words */
  quality_score: number
  quality_tier: 'excellent' | 'strong' | 'adequate' | 'weak'
  /** Whether this leg builds on the previous (non-first) */
  builds_on_prev: boolean
}

export interface ContributorStat {
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
  legs_contributed: number
  avg_quality: number
  is_starter: boolean
}

export interface RelayIntelligence {
  relay_id: string
  topic_statement: string | null
  topic_category: string | null
  topic_status: string | null
  side: 'for' | 'against'
  status: string
  max_legs: number
  legs_filled: number
  created_at: string
  completed_at: string | null
  starter_id: string

  /** Composite score 0–100 */
  intel_score: number
  intel_tier: 'exceptional' | 'strong' | 'adequate' | 'weak' | 'poor'

  /** Community verdict */
  vote_compelling: number
  vote_not_compelling: number
  compelling_rate: number | null
  verdict: 'compelling' | 'not_compelling' | 'mixed' | 'pending'

  /** Average leg quality 0–100 */
  avg_quality: number
  /** Whether each leg consistently builds on the previous */
  flow_score: number
  /** Vocabulary richness: distinct words / total words */
  vocabulary_richness: number
  /** Total words across all legs */
  total_words: number

  /** Per-leg breakdown */
  legs: LegAnalysis[]
  /** Unique contributor stats */
  contributors: ContributorStat[]
  /** Unique contributor count */
  unique_contributors: number

  /** Signal words found in arguments for the side */
  signal_words: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const QUALITY_SIGNALS_FOR = [
  'evidence', 'research', 'study', 'data', 'shows', 'demonstrates', 'proves',
  'because', 'therefore', 'thus', 'hence', 'consequently', 'example', 'instance',
  'statistics', 'percent', 'majority', 'experts', 'scientists', 'economists',
  'rights', 'freedom', 'liberty', 'equality', 'justice', 'benefit', 'improve',
]

const QUALITY_SIGNALS_AGAINST = [
  'however', 'but', 'yet', 'despite', 'although', 'unless', 'except',
  'risk', 'danger', 'harm', 'problem', 'issue', 'concern', 'caution',
  'fails', 'flawed', 'misleading', 'ignores', 'overlooks', 'contradicts',
  'evidence shows', 'research finds', 'studies suggest', 'data indicates',
]

function countSentences(text: string): number {
  return (text.match(/[.!?]+/g) ?? []).length || 1
}

function scoreLeg(content: string, side: 'for' | 'against', prevContent?: string): LegAnalysis['quality_score'] {
  const words = content.trim().split(/\s+/)
  const wordCount = words.length
  const signals = side === 'for' ? QUALITY_SIGNALS_FOR : QUALITY_SIGNALS_AGAINST
  const lower = content.toLowerCase()

  // Word count score (0–40): sweet spot is 80–200 words
  let lengthScore = 0
  if (wordCount >= 30) lengthScore = 10
  if (wordCount >= 60) lengthScore = 20
  if (wordCount >= 80) lengthScore = 30
  if (wordCount >= 120) lengthScore = 35
  if (wordCount >= 200) lengthScore = 40

  // Signal word score (0–40): quality marker words
  const signalHits = signals.filter((s) => lower.includes(s)).length
  const signalScore = Math.min(40, signalHits * 8)

  // Sentence variety (0–10): good arguments use varied sentences
  const sentenceCount = countSentences(content)
  const avgSentLen = wordCount / sentenceCount
  const varietyScore = avgSentLen >= 8 && avgSentLen <= 25 ? 10 : 5

  // Reference to previous leg (0–10): coherence bonus
  let coherenceScore = 0
  if (prevContent) {
    const prevWords = new Set(prevContent.toLowerCase().split(/\s+/).filter((w) => w.length > 4))
    const shared = words.filter((w) => prevWords.has(w.toLowerCase())).length
    coherenceScore = shared >= 2 ? 10 : shared >= 1 ? 5 : 0
  }

  return Math.min(100, Math.round(lengthScore + signalScore + varietyScore + coherenceScore))
}

function qualityTier(score: number): LegAnalysis['quality_tier'] {
  if (score >= 70) return 'excellent'
  if (score >= 50) return 'strong'
  if (score >= 30) return 'adequate'
  return 'weak'
}

function intelTier(score: number): RelayIntelligence['intel_tier'] {
  if (score >= 75) return 'exceptional'
  if (score >= 55) return 'strong'
  if (score >= 35) return 'adequate'
  if (score >= 20) return 'weak'
  return 'poor'
}

function extractSignalWords(legs: Array<{ content: string }>, side: 'for' | 'against'): string[] {
  const signals = side === 'for' ? QUALITY_SIGNALS_FOR : QUALITY_SIGNALS_AGAINST
  const combined = legs.map((l) => l.content.toLowerCase()).join(' ')
  return signals.filter((s) => combined.includes(s)).slice(0, 8)
}

// ─── GET /api/relays/[id]/intelligence ───────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const relayId = params.id

  // Fetch relay core row
  const { data: raw } = await supabase
    .from('civic_relays')
    .select('*')
    .eq('id', relayId)
    .maybeSingle()

  if (!raw) {
    return NextResponse.json({ error: 'Relay not found' }, { status: 404 })
  }

  // Fetch legs + author profiles
  const { data: legsRaw } = await supabase
    .from('relay_legs')
    .select('*, profiles:author_id(id, username, display_name, avatar_url, role, clout)')
    .eq('relay_id', relayId)
    .order('leg_number', { ascending: true })

  const legs = legsRaw ?? []

  // Fetch topic
  let topic: { statement: string; category: string | null; status: string } | null = null
  if (raw.topic_id) {
    const { data: t } = await supabase
      .from('topics')
      .select('statement, category, status')
      .eq('id', raw.topic_id)
      .maybeSingle()
    topic = t
  }

  // ─── Compute per-leg analysis ─────────────────────────────────────────────

  const legAnalyses: LegAnalysis[] = legs.map((leg, idx) => {
    const author = (leg.profiles as {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null) ?? null

    const words = leg.content.trim().split(/\s+/)
    const prevContent = idx > 0 ? legs[idx - 1].content : undefined
    const qScore = scoreLeg(leg.content, raw.side, prevContent)
    const lower = leg.content.toLowerCase()
    const prevLower = prevContent?.toLowerCase() ?? ''

    // Check if this leg explicitly references or builds on the previous
    const buildSignals = ['building on', 'furthermore', 'additionally', 'moreover',
      'as mentioned', 'to add to', 'expanding on', 'following from', 'this means',
      'therefore', 'hence', 'thus', 'in addition', 'strengthens']
    const buildsPrev = idx === 0
      ? true
      : buildSignals.some((s) => lower.includes(s)) ||
        (prevLower.length > 0 && (() => {
          const pWords = new Set(prevLower.split(/\s+/).filter((w) => w.length > 5))
          return words.filter((w) => pWords.has(w.toLowerCase())).length >= 3
        })())

    return {
      leg_number: leg.leg_number,
      author_username: author?.username ?? 'anonymous',
      author_display_name: author?.display_name ?? null,
      author_avatar_url: author?.avatar_url ?? null,
      author_role: author?.role ?? 'person',
      content: leg.content,
      word_count: words.length,
      sentence_count: countSentences(leg.content),
      quality_score: qScore,
      quality_tier: qualityTier(qScore),
      builds_on_prev: buildsPrev,
    } satisfies LegAnalysis
  })

  // ─── Contributor stats ────────────────────────────────────────────────────

  const contribMap = new Map<string, ContributorStat>()
  legs.forEach((leg, idx) => {
    const author = leg.profiles as {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null
    if (!author) return
    const existing = contribMap.get(author.id)
    const qScore = legAnalyses[idx].quality_score
    if (existing) {
      existing.legs_contributed += 1
      existing.avg_quality = Math.round(
        (existing.avg_quality * (existing.legs_contributed - 1) + qScore) / existing.legs_contributed
      )
    } else {
      contribMap.set(author.id, {
        author_id: author.id,
        author_username: author.username,
        author_display_name: author.display_name,
        author_avatar_url: author.avatar_url,
        author_role: author.role,
        legs_contributed: 1,
        avg_quality: qScore,
        is_starter: author.id === raw.starter_id,
      })
    }
  })

  const contributors = Array.from(contribMap.values()).sort(
    (a, b) => b.avg_quality - a.avg_quality
  )

  // ─── Aggregate scores ─────────────────────────────────────────────────────

  const totalWords = legAnalyses.reduce((s, l) => s + l.word_count, 0)
  const allWords = legs.map((l) => l.content.toLowerCase().split(/\s+/)).flat()
  const distinctWords = new Set(allWords.filter((w) => w.length > 3)).size
  const vocabularyRichness = allWords.length > 0
    ? Math.round((distinctWords / allWords.length) * 100) / 100
    : 0

  const avgQuality = legAnalyses.length > 0
    ? Math.round(legAnalyses.reduce((s, l) => s + l.quality_score, 0) / legAnalyses.length)
    : 0

  const buildsCount = legAnalyses.filter((l) => l.builds_on_prev).length
  const flowScore = legAnalyses.length > 0
    ? Math.round((buildsCount / legAnalyses.length) * 100)
    : 0

  // Completeness bonus
  const completenessBonus = raw.status === 'complete' || raw.status === 'voted' ? 10 : 0

  // Community vote factor
  const totalVotes = (raw.vote_compelling ?? 0) + (raw.vote_not_compelling ?? 0)
  const compellingRate = totalVotes > 0
    ? Math.round(((raw.vote_compelling ?? 0) / totalVotes) * 100)
    : null

  const communityBonus = compellingRate !== null
    ? Math.round((compellingRate / 100) * 20)
    : 0

  // Intel score: avg quality (50%) + flow (25%) + vocab richness (15%) + bonuses
  const intelScore = Math.min(100, Math.round(
    avgQuality * 0.5 +
    flowScore * 0.25 +
    vocabularyRichness * 100 * 0.15 +
    completenessBonus +
    communityBonus
  ))

  // Verdict
  let verdict: RelayIntelligence['verdict'] = 'pending'
  if (totalVotes > 0) {
    if ((compellingRate ?? 0) >= 60) verdict = 'compelling'
    else if ((compellingRate ?? 0) <= 35) verdict = 'not_compelling'
    else verdict = 'mixed'
  }

  const signalWords = extractSignalWords(legs, raw.side)

  const response: RelayIntelligence = {
    relay_id: relayId,
    topic_statement: topic?.statement ?? raw.topic_id ?? null,
    topic_category: topic?.category ?? null,
    topic_status: topic?.status ?? null,
    side: raw.side,
    status: raw.status,
    max_legs: raw.max_legs,
    legs_filled: legs.length,
    created_at: raw.created_at,
    completed_at: raw.completed_at ?? null,
    starter_id: raw.starter_id,

    intel_score: intelScore,
    intel_tier: intelTier(intelScore),

    vote_compelling: raw.vote_compelling ?? 0,
    vote_not_compelling: raw.vote_not_compelling ?? 0,
    compelling_rate: compellingRate,
    verdict,

    avg_quality: avgQuality,
    flow_score: flowScore,
    vocabulary_richness: vocabularyRichness,
    total_words: totalWords,

    legs: legAnalyses,
    contributors,
    unique_contributors: contributors.length,

    signal_words: signalWords,
  }

  return NextResponse.json(response)
}
