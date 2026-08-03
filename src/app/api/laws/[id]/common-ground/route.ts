import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NuancedArgument {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_grade: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  nuance_score: number
  highlighted_phrases: string[]
}

export interface SharedTheme {
  phrase: string
  for_count: number
  against_count: number
  total: number
}

export interface ConsensusPoint {
  concept: string
  for_endorsers: number
  against_endorsers: number
  bridge_strength: 'strong' | 'moderate' | 'weak'
}

export interface LawCommonGroundResponse {
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string | null
    blue_pct: number
    total_votes: number
  }
  common_ground_score: number
  nuanced_for: NuancedArgument[]
  nuanced_against: NuancedArgument[]
  shared_themes: SharedTheme[]
  consensus_points: ConsensusPoint[]
  total_for: number
  total_against: number
  nuance_for_pct: number
  nuance_against_pct: number
  victory_margin: 'decisive' | 'clear' | 'narrow'
  legitimacy_note: string
}

// ─── Concession / bridge language patterns ─────────────────────────────────────

const CONCESSION_PATTERNS = [
  /\b(however|although|while|even if|even though|despite|granted|admittedly)\b/gi,
  /\b(to be fair|fair enough|fair point|i understand|i acknowledge|i agree that)\b/gi,
  /\b(both sides|common ground|we can agree|everyone agrees|most people agree)\b/gi,
  /\b(the concern is valid|the concern about|legitimate concern|valid point)\b/gi,
  /\b(on the other hand|at the same time|that said|having said that|even so)\b/gi,
  /\b(nuanced|balanced|both|middle ground|compromise|neither extreme)\b/gi,
  /\b(not all|not every|more complex|complicated|it depends|context matters)\b/gi,
  /\b(true that|you're right that|one can argue|one could argue|some would say)\b/gi,
  /\b(yes, but|yes and|while valid|while true|while understandable)\b/gi,
  /\b(worth noting|important to note|it's worth|we should acknowledge)\b/gi,
  /\b(i see the point|i get that|that's fair|fair enough|point taken)\b/gi,
]

// Civic consensus concept seeds — topics both sides invoke
const CIVIC_CONCEPTS = [
  'freedom', 'rights', 'fairness', 'equality', 'justice', 'safety', 'security',
  'community', 'society', 'evidence', 'data', 'facts', 'research', 'science',
  'democracy', 'accountability', 'transparency', 'responsibility', 'opportunity',
  'future', 'children', 'families', 'workers', 'citizens', 'economy', 'jobs',
  'health', 'environment', 'education', 'innovation', 'progress', 'reform',
]

function computeNuanceScore(content: string): { score: number; phrases: string[] } {
  const lower = content.toLowerCase()
  const matches: string[] = []

  for (const pattern of CONCESSION_PATTERNS) {
    const found = lower.match(pattern)
    if (found) {
      matches.push(...found.map((m) => m.trim()))
    }
    pattern.lastIndex = 0
  }

  const unique = Array.from(new Set(matches))
  const raw = Math.min(100, unique.length * 20)
  return { score: raw, phrases: unique.slice(0, 5) }
}

function extractBigrams(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^\w\s]/g, ' ')
  const words = clean.split(/\s+/).filter((w) => w.length > 3)
  const bigrams: string[] = []
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`)
  }
  const STOP_BIGRAMS = new Set([
    'that the', 'in the', 'of the', 'to the', 'is the', 'and the',
    'for the', 'on the', 'this is', 'it is', 'there is', 'we are',
    'to be', 'will be', 'can be', 'should be', 'would be', 'have been',
    'more than', 'rather than', 'such as', 'as well', 'as long', 'as much',
    'this will', 'this has', 'this can', 'they are', 'they have', 'they will',
    'does not', 'do not', 'did not', 'will not', 'should not', 'cannot',
    'people who', 'people are', 'people will', 'people have', 'people need',
  ])
  return bigrams.filter((b) => !STOP_BIGRAMS.has(b))
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id: lawId } = params

    // Fetch the law
    const { data: law, error: lawError } = await supabase
      .from('laws')
      .select('id, statement, category, established_at, blue_pct, total_votes, topic_id')
      .eq('id', lawId)
      .maybeSingle()

    if (lawError || !law) {
      return NextResponse.json({ error: 'Law not found' }, { status: 404 })
    }

    // Return minimal data if no topic link
    if (!law.topic_id) {
      return NextResponse.json({
        law: {
          id: law.id,
          statement: law.statement,
          category: law.category,
          established_at: law.established_at,
          blue_pct: law.blue_pct ?? 75,
          total_votes: law.total_votes ?? 0,
        },
        common_ground_score: 0,
        nuanced_for: [],
        nuanced_against: [],
        shared_themes: [],
        consensus_points: [],
        total_for: 0,
        total_against: 0,
        nuance_for_pct: 0,
        nuance_against_pct: 0,
        victory_margin: 'decisive' as const,
        legitimacy_note: '',
      } satisfies LawCommonGroundResponse)
    }

    // Fetch up to 200 arguments from the original topic debate
    const { data: rawArgs } = await supabase
      .from('topic_arguments')
      .select(`
        id, side, content, upvotes, ai_grade, created_at, user_id,
        author:profiles!topic_arguments_user_id_fkey(id, username, display_name, avatar_url, role)
      `)
      .eq('topic_id', law.topic_id)
      .order('upvotes', { ascending: false })
      .limit(200)

    const args = (rawArgs ?? []) as Array<{
      id: string
      side: 'blue' | 'red'
      content: string
      upvotes: number
      ai_grade: string | null
      created_at: string
      user_id: string
      author: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string } | null
    }>

    const forArgs = args.filter((a) => a.side === 'blue')
    const againstArgs = args.filter((a) => a.side === 'red')

    // Score each argument for nuance
    const scoredFor: NuancedArgument[] = forArgs.map((a) => {
      const { score, phrases } = computeNuanceScore(a.content)
      return { ...a, nuance_score: score, highlighted_phrases: phrases }
    })

    const scoredAgainst: NuancedArgument[] = againstArgs.map((a) => {
      const { score, phrases } = computeNuanceScore(a.content)
      return { ...a, nuance_score: score, highlighted_phrases: phrases }
    })

    // Pick top 6 most nuanced from each side (score > 0)
    const nuancedFor = scoredFor
      .filter((a) => a.nuance_score > 0)
      .sort((a, b) => b.nuance_score - a.nuance_score || b.upvotes - a.upvotes)
      .slice(0, 6)

    const nuancedAgainst = scoredAgainst
      .filter((a) => a.nuance_score > 0)
      .sort((a, b) => b.nuance_score - a.nuance_score || b.upvotes - a.upvotes)
      .slice(0, 6)

    // Compute nuance percentages
    const nuanceForPct = forArgs.length
      ? Math.round((scoredFor.filter((a) => a.nuance_score > 0).length / forArgs.length) * 100)
      : 0
    const nuanceAgainstPct = againstArgs.length
      ? Math.round((scoredAgainst.filter((a) => a.nuance_score > 0).length / againstArgs.length) * 100)
      : 0

    // Common Ground Score: average of both nuance percentages, weighted toward minority side
    const commonGroundScore = Math.round(
      (nuanceForPct * 0.4 + nuanceAgainstPct * 0.6)
    )

    // Shared themes: bigrams that appear in BOTH for and against arguments
    const forBigramMap = new Map<string, number>()
    const againstBigramMap = new Map<string, number>()

    for (const a of forArgs.slice(0, 50)) {
      for (const bg of extractBigrams(a.content)) {
        forBigramMap.set(bg, (forBigramMap.get(bg) ?? 0) + 1)
      }
    }
    for (const a of againstArgs.slice(0, 50)) {
      for (const bg of extractBigrams(a.content)) {
        againstBigramMap.set(bg, (againstBigramMap.get(bg) ?? 0) + 1)
      }
    }

    const sharedThemes: SharedTheme[] = []
    for (const [phrase, forCount] of forBigramMap.entries()) {
      const againstCount = againstBigramMap.get(phrase) ?? 0
      if (forCount >= 2 && againstCount >= 2) {
        sharedThemes.push({ phrase, for_count: forCount, against_count: againstCount, total: forCount + againstCount })
      }
    }
    sharedThemes.sort((a, b) => b.total - a.total)
    const topThemes = sharedThemes.slice(0, 12)

    // Consensus points: civic concepts invoked by both sides
    const consensusPoints: ConsensusPoint[] = []
    const allForText = forArgs.map((a) => a.content.toLowerCase()).join(' ')
    const allAgainstText = againstArgs.map((a) => a.content.toLowerCase()).join(' ')

    for (const concept of CIVIC_CONCEPTS) {
      const forMentions = (allForText.match(new RegExp(`\\b${concept}\\b`, 'g')) ?? []).length
      const againstMentions = (allAgainstText.match(new RegExp(`\\b${concept}\\b`, 'g')) ?? []).length

      if (forMentions >= 3 && againstMentions >= 2) {
        const bridgeStrength: 'strong' | 'moderate' | 'weak' =
          forMentions >= 8 && againstMentions >= 5 ? 'strong'
          : forMentions >= 5 && againstMentions >= 3 ? 'moderate'
          : 'weak'

        consensusPoints.push({
          concept,
          for_endorsers: forMentions,
          against_endorsers: againstMentions,
          bridge_strength: bridgeStrength,
        })
      }
    }
    consensusPoints.sort((a, b) => (b.for_endorsers + b.against_endorsers) - (a.for_endorsers + a.against_endorsers))
    const topConsensusPoints = consensusPoints.slice(0, 8)

    // Victory margin descriptor
    const bluePct = law.blue_pct ?? 75
    const victoryMargin: 'decisive' | 'clear' | 'narrow' =
      bluePct >= 70 ? 'decisive'
      : bluePct >= 60 ? 'clear'
      : 'narrow'

    // Legitimacy note based on common ground score
    const legitimacyNote =
      commonGroundScore >= 60
        ? 'Both sides engaged constructively — this law emerged from genuine discourse with meaningful mutual acknowledgement.'
        : commonGroundScore >= 30
        ? 'Moderate bridging occurred — some arguments from both camps acknowledged the other side\'s concerns.'
        : 'The debate was largely polarised. Both sides argued their corners with limited acknowledgement of opposing views.'

    return NextResponse.json({
      law: {
        id: law.id,
        statement: law.statement,
        category: law.category,
        established_at: law.established_at,
        blue_pct: bluePct,
        total_votes: law.total_votes ?? 0,
      },
      common_ground_score: commonGroundScore,
      nuanced_for: nuancedFor,
      nuanced_against: nuancedAgainst,
      shared_themes: topThemes,
      consensus_points: topConsensusPoints,
      total_for: forArgs.length,
      total_against: againstArgs.length,
      nuance_for_pct: nuanceForPct,
      nuance_against_pct: nuanceAgainstPct,
      victory_margin: victoryMargin,
      legitimacy_note: legitimacyNote,
    } satisfies LawCommonGroundResponse)
  } catch (err) {
    console.error('[api/laws/[id]/common-ground]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
