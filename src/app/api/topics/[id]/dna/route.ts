import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DNAStrand {
  id: string
  label: string
  description: string
  forPct: number
  againstPct: number
  combined: number
  forCount: number
  againstCount: number
  color: string
  topForArg: string | null
  topAgainstArg: string | null
}

export interface CoreTension {
  label: string
  forStrand: string
  againstStrand: string
  description: string
  intensity: 'low' | 'moderate' | 'high' | 'extreme'
}

export interface GeneticRelative {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  similarity: number
  sharedStrand: string
}

export interface DNAResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  strands: DNAStrand[]
  dominantForStrand: string
  dominantAgainstStrand: string
  coreTension: CoreTension | null
  uniquenessScore: number
  relatives: GeneticRelative[]
  totalArgs: number
  forArgs: number
  againstArgs: number
  insight: string
}

// ─── Strand keyword patterns ──────────────────────────────────────────────────

const STRANDS: Array<{
  id: string
  label: string
  description: string
  color: string
  keywords: RegExp[]
}> = [
  {
    id: 'economic',
    label: 'Economic',
    description: 'Cost, benefit, jobs, and fiscal impact arguments',
    color: '#f59e0b', // gold
    keywords: [
      /\b(cost|costs|money|fund|budget|tax|spend|spending|afford|economic|economy|GDP|job|jobs|employ|wage|salary|income|profit|wealth|financial|fiscal|price|market|invest|revenue|expenditure|billion|million|dollar)\b/i,
    ],
  },
  {
    id: 'rights',
    label: 'Rights & Freedoms',
    description: 'Constitutional rights, civil liberties, and personal autonomy',
    color: '#3b82f6', // blue
    keywords: [
      /\b(right|rights|freedom|freedoms|liberty|liberties|constitutional|civil|autonomy|privacy|consent|choice|choose|individual|personal|property|protect|protection|speech|religion|gun|arms|vote|voting)\b/i,
    ],
  },
  {
    id: 'safety',
    label: 'Safety & Harm',
    description: 'Public safety, health risks, and harm prevention',
    color: '#ef4444', // red
    keywords: [
      /\b(safe|safety|danger|dangerous|harm|harmful|risk|threat|violent|violence|crime|criminal|death|die|kill|hurt|injur|protect|security|health|disease|illness|epidemic|pandemic|emergency|crisis|disaster)\b/i,
    ],
  },
  {
    id: 'evidence',
    label: 'Evidence & Science',
    description: 'Data-driven and research-backed arguments',
    color: '#10b981', // emerald
    keywords: [
      /\b(research|data|study|studies|evidence|statistic|statistics|proven|proof|science|scientific|expert|analysis|report|survey|fact|facts|show[s]?|demonstrate|measur|quantif|experiment|experiment|peer|journal|publish)\b/i,
    ],
  },
  {
    id: 'moral',
    label: 'Moral & Ethical',
    description: 'Value judgements, justice, and ethical principles',
    color: '#8b5cf6', // purple
    keywords: [
      /\b(moral|morality|ethical|ethics|justice|just|fair|fairness|wrong|right|virtue|dignity|principle|values|corrupt|immoral|unjust|inequit|equal|equality|inequality|discriminat|responsib|duty|obligation|honor|integrity|compassion|empathy|human)\b/i,
    ],
  },
  {
    id: 'pragmatic',
    label: 'Pragmatic',
    description: 'Practical feasibility, implementation, and real-world effects',
    color: '#06b6d4', // cyan
    keywords: [
      /\b(practical|practicality|feasib|feasible|implement|work|works|effective|efficient|realistic|realistically|alternative|solution|approach|plan|policy|law|enforce|fail|failure|success|result|outcome|consequence|effect|impact|actually|reality|real|problem|challenge|difficult)\b/i,
    ],
  },
]

// ─── Core tension matrix ──────────────────────────────────────────────────────

const TENSION_MAP: Record<string, Record<string, { label: string; description: string }>> = {
  economic: {
    moral:     { label: 'Profit vs. Principle', description: 'Economic pragmatism clashing with moral imperatives' },
    safety:    { label: 'Growth vs. Protection', description: 'Economic expansion conflicting with harm prevention' },
    rights:    { label: 'Market Freedom vs. Regulation', description: 'Free-market principles versus rights-based protections' },
    evidence:  { label: 'Investment vs. Proof', description: 'Financial commitments debated against empirical outcomes' },
    pragmatic: { label: 'Cost vs. Effectiveness', description: 'Fiscal concerns balanced against real-world results' },
  },
  rights: {
    safety:    { label: 'Freedom vs. Security', description: 'Personal liberties in tension with collective safety' },
    moral:     { label: 'Rights vs. Responsibility', description: 'Individual freedoms balanced against ethical duties' },
    economic:  { label: 'Market Freedom vs. Regulation', description: 'Free-market principles versus rights-based protections' },
    evidence:  { label: 'Principle vs. Evidence', description: 'Constitutional values challenged by empirical data' },
    pragmatic: { label: 'Ideal vs. Reality', description: 'Rights-based ideals confronted with practical constraints' },
  },
  safety: {
    rights:    { label: 'Freedom vs. Security', description: 'Personal liberties in tension with collective safety' },
    economic:  { label: 'Growth vs. Protection', description: 'Economic expansion conflicting with harm prevention' },
    moral:     { label: 'Welfare vs. Values', description: 'Public health competing with deeply held principles' },
    pragmatic: { label: 'Risk vs. Reality', description: 'Safety concerns weighed against practical limitations' },
    evidence:  { label: 'Caution vs. Data', description: 'Precautionary principles tested against empirical findings' },
  },
  moral: {
    economic:  { label: 'Profit vs. Principle', description: 'Economic pragmatism clashing with moral imperatives' },
    pragmatic: { label: 'Principle vs. Practicality', description: 'Ethical ideals meeting real-world limitations' },
    safety:    { label: 'Welfare vs. Values', description: 'Public health competing with deeply held principles' },
    rights:    { label: 'Rights vs. Responsibility', description: 'Individual freedoms balanced against ethical duties' },
    evidence:  { label: 'Values vs. Evidence', description: 'Moral convictions tested against scientific findings' },
  },
  evidence: {
    moral:     { label: 'Values vs. Evidence', description: 'Moral convictions tested against scientific findings' },
    rights:    { label: 'Principle vs. Evidence', description: 'Constitutional values challenged by empirical data' },
    economic:  { label: 'Investment vs. Proof', description: 'Financial commitments debated against empirical outcomes' },
    safety:    { label: 'Caution vs. Data', description: 'Precautionary principles tested against empirical findings' },
    pragmatic: { label: 'Science vs. Feasibility', description: 'Research findings confronted with implementation realities' },
  },
  pragmatic: {
    moral:     { label: 'Principle vs. Practicality', description: 'Ethical ideals meeting real-world limitations' },
    rights:    { label: 'Ideal vs. Reality', description: 'Rights-based ideals confronted with practical constraints' },
    economic:  { label: 'Cost vs. Effectiveness', description: 'Fiscal concerns balanced against real-world results' },
    evidence:  { label: 'Science vs. Feasibility', description: 'Research findings confronted with implementation realities' },
    safety:    { label: 'Risk vs. Reality', description: 'Safety concerns weighed against practical limitations' },
  },
}

function getTension(forStrand: string, againstStrand: string): { label: string; description: string } | null {
  return TENSION_MAP[forStrand]?.[againstStrand] ?? TENSION_MAP[againstStrand]?.[forStrand] ?? null
}

// ─── Analysis helpers ─────────────────────────────────────────────────────────

function scoreArg(content: string): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const strand of STRANDS) {
    let count = 0
    for (const re of strand.keywords) {
      const matches = content.match(re)
      count += matches ? matches.length : 0
    }
    scores[strand.id] = count
  }
  return scores
}

function dominantStrand(args: Array<{ content: string }>): string {
  const totals: Record<string, number> = {}
  for (const arg of args) {
    const s = scoreArg(arg.content)
    for (const k of Object.keys(s)) totals[k] = (totals[k] ?? 0) + s[k]
  }
  let best = STRANDS[0].id
  let bestScore = 0
  for (const [id, count] of Object.entries(totals)) {
    if (count > bestScore) { best = id; bestScore = count }
  }
  return best
}

// Cosine similarity between two score vectors
function vectorSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = STRANDS.map((s) => s.id)
  let dot = 0, magA = 0, magB = 0
  for (const k of keys) {
    const va = a[k] ?? 0, vb = b[k] ?? 0
    dot += va * vb
    magA += va * va
    magB += vb * vb
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

// ─── GET /api/topics/[id]/dna ─────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  // Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch up to 100 arguments
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('id, side, content, upvotes, ai_score')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .limit(100)

  const args = argRows ?? []
  const forArgs  = args.filter((a) => a.side === 'blue')
  const againstArgs = args.filter((a) => a.side === 'red')

  // Score each argument per strand
  interface ScoredArg { id: string; side: 'blue' | 'red'; content: string; upvotes: number; scores: Record<string, number> }
  const scored: ScoredArg[] = args.map((a) => ({
    id: a.id,
    side: a.side as 'blue' | 'red',
    content: a.content,
    upvotes: a.upvotes,
    scores: scoreArg(a.content),
  }))

  const scoredFor     = scored.filter((a) => a.side === 'blue')
  const scoredAgainst = scored.filter((a) => a.side === 'red')

  // Aggregate scores per strand per side
  const strandData: DNAStrand[] = STRANDS.map((strand) => {
    const forTotal = scoredFor.reduce((s, a) => s + (a.scores[strand.id] ?? 0), 0)
    const againstTotal = scoredAgainst.reduce((s, a) => s + (a.scores[strand.id] ?? 0), 0)

    const forArgCount = scoredFor.filter((a) => (a.scores[strand.id] ?? 0) > 0).length
    const againstArgCount = scoredAgainst.filter((a) => (a.scores[strand.id] ?? 0) > 0).length

    const forPct = forArgs.length > 0 ? Math.round((forArgCount / forArgs.length) * 100) : 0
    const againstPct = againstArgs.length > 0 ? Math.round((againstArgCount / againstArgs.length) * 100) : 0
    const combined = Math.round(((forTotal + againstTotal) / Math.max(1, scored.length)) * 10)

    // Top arg for each side using this strand
    const topFor = scoredFor
      .filter((a) => (a.scores[strand.id] ?? 0) > 0)
      .sort((a, b) => b.upvotes - a.upvotes)[0]?.content ?? null

    const topAgainst = scoredAgainst
      .filter((a) => (a.scores[strand.id] ?? 0) > 0)
      .sort((a, b) => b.upvotes - a.upvotes)[0]?.content ?? null

    return {
      id: strand.id,
      label: strand.label,
      description: strand.description,
      forPct,
      againstPct,
      combined,
      forCount: forArgCount,
      againstCount: againstArgCount,
      color: strand.color,
      topForArg: topFor ? topFor.slice(0, 160) + (topFor.length > 160 ? '…' : '') : null,
      topAgainstArg: topAgainst ? topAgainst.slice(0, 160) + (topAgainst.length > 160 ? '…' : '') : null,
    }
  })

  // Dominant strand per side
  const domFor     = dominantStrand(forArgs)
  const domAgainst = dominantStrand(againstArgs)

  // Core tension
  let coreTension: CoreTension | null = null
  if (args.length >= 4) {
    const tensionBase = getTension(domFor, domAgainst)
    if (tensionBase) {
      // Intensity: how different are the dominant strands between sides?
      const combinedMax = Math.max(...strandData.map((s) => s.combined))
      const intensity: CoreTension['intensity'] =
        combinedMax >= 15 ? 'extreme'
        : combinedMax >= 10 ? 'high'
        : combinedMax >= 5  ? 'moderate'
        : 'low'

      coreTension = {
        label: tensionBase.label,
        forStrand: STRANDS.find((s) => s.id === domFor)?.label ?? domFor,
        againstStrand: STRANDS.find((s) => s.id === domAgainst)?.label ?? domAgainst,
        description: tensionBase.description,
        intensity,
      }
    }
  }

  // Build score vector for topic
  const topicVector: Record<string, number> = {}
  for (const strand of strandData) {
    topicVector[strand.id] = strand.forCount + strand.againstCount
  }

  // Genetic relatives: other active topics in same category
  let relatives: GeneticRelative[] = []
  if (topic.category) {
    const { data: siblingTopics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct')
      .eq('category', topic.category)
      .neq('id', params.id)
      .in('status', ['active', 'voting', 'law'])
      .order('total_votes', { ascending: false })
      .limit(20)

    if (siblingTopics && siblingTopics.length > 0) {
      // Fetch a sample of arguments for each sibling for comparison
      const siblingScores: Array<{ topic: (typeof siblingTopics)[0]; vector: Record<string, number>; sim: number }> = []

      for (const sib of siblingTopics.slice(0, 10)) {
        const { data: sibArgs } = await supabase
          .from('topic_arguments')
          .select('content')
          .eq('topic_id', sib.id)
          .limit(20)

        const sibVec: Record<string, number> = {}
        for (const strand of STRANDS) sibVec[strand.id] = 0
        for (const a of sibArgs ?? []) {
          const s = scoreArg(a.content)
          for (const k of Object.keys(s)) sibVec[k] = (sibVec[k] ?? 0) + s[k]
        }

        const sim = vectorSimilarity(topicVector, sibVec)
        siblingScores.push({ topic: sib, vector: sibVec, sim })
      }

      relatives = siblingScores
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 3)
        .filter((s) => s.sim > 0)
        .map((s) => {
          // Find the strand this topic most shares with the relative
          let bestStrand = STRANDS[0].id
          let bestScore = 0
          for (const strand of STRANDS) {
            const shared = Math.min(topicVector[strand.id] ?? 0, s.vector[strand.id] ?? 0)
            if (shared > bestScore) { bestStrand = strand.id; bestScore = shared }
          }
          return {
            id: s.topic.id,
            statement: s.topic.statement,
            category: s.topic.category,
            status: s.topic.status,
            blue_pct: s.topic.blue_pct ?? 50,
            similarity: Math.round(s.sim * 100),
            sharedStrand: STRANDS.find((str) => str.id === bestStrand)?.label ?? bestStrand,
          }
        })
    }
  }

  // Uniqueness score: how different is this topic from category average?
  // Low uniqueness = very typical for category; high = outlier
  const avgSim = relatives.length > 0 ? relatives.reduce((s, r) => s + r.similarity, 0) / relatives.length : 50
  const uniquenessScore = Math.max(0, Math.min(100, 100 - avgSim))

  // Insight sentence
  const dominantStrandLabel = STRANDS.find((s) => s.id === domFor)?.label ?? 'pragmatic'
  const categoryLabel = topic.category ?? 'civic'
  const insight = args.length < 4
    ? 'Not enough arguments yet to compute a full DNA profile. Check back as the debate grows.'
    : coreTension
      ? `This ${categoryLabel} debate centers on a ${coreTension.intensity} tension between ${coreTension.label.toLowerCase()}. ` +
        `FOR arguments lean ${dominantStrandLabel.toLowerCase()}, while AGAINST arguments favor ` +
        `${STRANDS.find((s) => s.id === domAgainst)?.label?.toLowerCase() ?? 'pragmatic'} reasoning.`
      : `This ${categoryLabel} debate is primarily driven by ${dominantStrandLabel.toLowerCase()} arguments on both sides, ` +
        `suggesting a narrower policy disagreement than a fundamental value conflict.`

  return NextResponse.json({
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct ?? 50,
      total_votes: topic.total_votes ?? 0,
    },
    strands: strandData,
    dominantForStrand: domFor,
    dominantAgainstStrand: domAgainst,
    coreTension,
    uniquenessScore,
    relatives,
    totalArgs: args.length,
    forArgs: forArgs.length,
    againstArgs: againstArgs.length,
    insight,
  } satisfies DNAResponse)
}
