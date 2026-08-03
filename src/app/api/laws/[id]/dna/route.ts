import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawDNAStrand {
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

export interface LawCoreTension {
  label: string
  forStrand: string
  againstStrand: string
  description: string
  intensity: 'low' | 'moderate' | 'high' | 'extreme'
}

export interface LawGeneticRelative {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  similarity: number
  sharedStrand: string
}

export interface LawDNAResponse {
  law: {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
  }
  strands: LawDNAStrand[]
  dominantForStrand: string
  dominantAgainstStrand: string
  coreTension: LawCoreTension | null
  uniquenessScore: number
  relatives: LawGeneticRelative[]
  totalArgs: number
  forArgs: number
  againstArgs: number
  insight: string
}

// ─── Strand definitions ───────────────────────────────────────────────────────

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
    color: '#f59e0b',
    keywords: [
      /\b(cost|costs|money|fund|budget|tax|spend|spending|afford|economic|economy|GDP|job|jobs|employ|wage|salary|income|profit|wealth|financial|fiscal|price|market|invest|revenue|expenditure|billion|million|dollar)\b/i,
    ],
  },
  {
    id: 'rights',
    label: 'Rights & Freedoms',
    description: 'Constitutional rights, civil liberties, and personal autonomy',
    color: '#3b82f6',
    keywords: [
      /\b(right|rights|freedom|freedoms|liberty|liberties|constitutional|civil|autonomy|privacy|consent|choice|choose|individual|personal|property|protect|protection|speech|religion|gun|arms|vote|voting)\b/i,
    ],
  },
  {
    id: 'safety',
    label: 'Safety & Harm',
    description: 'Public safety, health risks, and harm prevention',
    color: '#ef4444',
    keywords: [
      /\b(safe|safety|danger|dangerous|harm|harmful|risk|threat|violent|violence|crime|criminal|death|die|kill|hurt|injur|protect|security|health|disease|illness|epidemic|pandemic|emergency|crisis|disaster)\b/i,
    ],
  },
  {
    id: 'evidence',
    label: 'Evidence & Science',
    description: 'Data-driven and research-backed arguments',
    color: '#10b981',
    keywords: [
      /\b(research|data|study|studies|evidence|statistic|statistics|proven|proof|science|scientific|expert|analysis|report|survey|fact|facts|show[s]?|demonstrate|measur|quantif|experiment|peer|journal|publish)\b/i,
    ],
  },
  {
    id: 'moral',
    label: 'Moral & Ethical',
    description: 'Value judgements, justice, and ethical principles',
    color: '#8b5cf6',
    keywords: [
      /\b(moral|morality|ethical|ethics|justice|just|fair|fairness|wrong|right|virtue|dignity|principle|values|corrupt|immoral|unjust|inequit|equal|equality|inequality|discriminat|responsib|duty|obligation|honor|integrity|compassion|empathy|human)\b/i,
    ],
  },
  {
    id: 'pragmatic',
    label: 'Pragmatic',
    description: 'Practical feasibility, implementation, and real-world effects',
    color: '#06b6d4',
    keywords: [
      /\b(practical|practicality|feasib|feasible|implement|work|works|effective|efficient|realistic|realistically|alternative|solution|approach|plan|policy|law|enforce|fail|failure|success|result|outcome|consequence|effect|impact|actually|reality|real|problem|challenge|difficult)\b/i,
    ],
  },
]

// ─── Tension map ──────────────────────────────────────────────────────────────

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

function getTension(a: string, b: string) {
  return TENSION_MAP[a]?.[b] ?? TENSION_MAP[b]?.[a] ?? null
}

// ─── Analysis helpers ─────────────────────────────────────────────────────────

function scoreContent(content: string): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const strand of STRANDS) {
    let count = 0
    for (const re of strand.keywords) {
      const m = content.match(re)
      count += m ? m.length : 0
    }
    scores[strand.id] = count
  }
  return scores
}

function dominantId(args: Array<{ content: string }>): string {
  const totals: Record<string, number> = {}
  for (const a of args) {
    const s = scoreContent(a.content)
    for (const k of Object.keys(s)) totals[k] = (totals[k] ?? 0) + s[k]
  }
  let best = STRANDS[0].id
  let bestScore = 0
  for (const [id, n] of Object.entries(totals)) {
    if (n > bestScore) { best = id; bestScore = n }
  }
  return best
}

function cosineSim(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0, magA = 0, magB = 0
  for (const s of STRANDS) {
    const va = a[s.id] ?? 0
    const vb = b[s.id] ?? 0
    dot += va * vb
    magA += va * va
    magB += vb * vb
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}

// ─── GET /api/laws/[id]/dna ───────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  // 1. Fetch law + source topic_id
  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
    .eq('id', params.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!law) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 2. Fetch founding arguments from source topic
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('id, side, content, upvotes, ai_score')
    .eq('topic_id', law.topic_id)
    .order('upvotes', { ascending: false })
    .limit(120)

  const args = argRows ?? []
  const forArgs     = args.filter((a) => a.side === 'blue')
  const againstArgs = args.filter((a) => a.side === 'red')

  // 3. Score each argument per strand
  type ScoredArg = { id: string; side: string; content: string; upvotes: number; scores: Record<string, number> }
  const scored: ScoredArg[] = args.map((a) => ({
    id: a.id,
    side: a.side,
    content: a.content,
    upvotes: a.upvotes ?? 0,
    scores: scoreContent(a.content),
  }))
  const scoredFor     = scored.filter((a) => a.side === 'blue')
  const scoredAgainst = scored.filter((a) => a.side === 'red')

  // 4. Build strand data
  const strandData: LawDNAStrand[] = STRANDS.map((strand) => {
    const forArgCount     = scoredFor.filter((a) => (a.scores[strand.id] ?? 0) > 0).length
    const againstArgCount = scoredAgainst.filter((a) => (a.scores[strand.id] ?? 0) > 0).length
    const forTotal        = scoredFor.reduce((s, a) => s + (a.scores[strand.id] ?? 0), 0)
    const againstTotal    = scoredAgainst.reduce((s, a) => s + (a.scores[strand.id] ?? 0), 0)

    const forPct     = forArgs.length     > 0 ? Math.round((forArgCount / forArgs.length) * 100)     : 0
    const againstPct = againstArgs.length > 0 ? Math.round((againstArgCount / againstArgs.length) * 100) : 0
    const combined   = Math.round(((forTotal + againstTotal) / Math.max(1, scored.length)) * 10)

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
      topForArg: topFor    ? topFor.slice(0, 160)    + (topFor.length    > 160 ? '…' : '') : null,
      topAgainstArg: topAgainst ? topAgainst.slice(0, 160) + (topAgainst.length > 160 ? '…' : '') : null,
    }
  })

  // 5. Dominant strands
  const domFor     = dominantId(forArgs)
  const domAgainst = dominantId(againstArgs)

  // 6. Core tension
  let coreTension: LawCoreTension | null = null
  if (args.length >= 4) {
    const base = getTension(domFor, domAgainst)
    if (base) {
      const maxCombined = Math.max(...strandData.map((s) => s.combined))
      const intensity: LawCoreTension['intensity'] =
        maxCombined >= 15 ? 'extreme'
        : maxCombined >= 10 ? 'high'
        : maxCombined >= 5  ? 'moderate'
        : 'low'
      coreTension = {
        label: base.label,
        forStrand: STRANDS.find((s) => s.id === domFor)?.label ?? domFor,
        againstStrand: STRANDS.find((s) => s.id === domAgainst)?.label ?? domAgainst,
        description: base.description,
        intensity,
      }
    }
  }

  // 7. Build DNA vector for this law
  const lawVector: Record<string, number> = {}
  for (const s of strandData) lawVector[s.id] = s.forCount + s.againstCount

  // 8. Genetic relatives — other laws in the same category
  let relatives: LawGeneticRelative[] = []
  if (law.category) {
    const { data: siblingLaws } = await supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at, topic_id')
      .eq('category', law.category)
      .eq('is_active', true)
      .neq('id', params.id)
      .order('established_at', { ascending: false })
      .limit(15)

    if (siblingLaws && siblingLaws.length > 0) {
      type SiblingWithSim = { law: typeof siblingLaws[0]; vector: Record<string, number>; sim: number }
      const siblingScores: SiblingWithSim[] = []

      for (const sib of siblingLaws.slice(0, 8)) {
        const { data: sibArgs } = await supabase
          .from('topic_arguments')
          .select('content')
          .eq('topic_id', sib.topic_id)
          .limit(25)

        const sibVec: Record<string, number> = {}
        for (const s of STRANDS) sibVec[s.id] = 0
        for (const a of sibArgs ?? []) {
          const sc = scoreContent(a.content)
          for (const k of Object.keys(sc)) sibVec[k] = (sibVec[k] ?? 0) + sc[k]
        }

        siblingScores.push({ law: sib, vector: sibVec, sim: cosineSim(lawVector, sibVec) })
      }

      relatives = siblingScores
        .sort((a, b) => b.sim - a.sim)
        .slice(0, 3)
        .filter((s) => s.sim > 0)
        .map((s) => {
          let bestStrand = STRANDS[0].id
          let bestScore = 0
          for (const strand of STRANDS) {
            const shared = Math.min(lawVector[strand.id] ?? 0, s.vector[strand.id] ?? 0)
            if (shared > bestScore) { bestStrand = strand.id; bestScore = shared }
          }
          return {
            id: s.law.id,
            statement: s.law.statement,
            category: s.law.category,
            blue_pct: s.law.blue_pct ?? 50,
            total_votes: s.law.total_votes ?? 0,
            established_at: s.law.established_at,
            similarity: Math.round(s.sim * 100),
            sharedStrand: STRANDS.find((str) => str.id === bestStrand)?.label ?? bestStrand,
          }
        })
    }
  }

  // 9. Uniqueness score
  const avgSim = relatives.length > 0
    ? relatives.reduce((s, r) => s + r.similarity, 0) / relatives.length
    : 50
  const uniquenessScore = Math.max(0, Math.min(100, 100 - avgSim))

  // 10. Insight sentence
  const domForLabel     = STRANDS.find((s) => s.id === domFor)?.label     ?? 'pragmatic'
  const domAgainstLabel = STRANDS.find((s) => s.id === domAgainst)?.label ?? 'pragmatic'
  const catLabel = law.category ?? 'civic'
  const insight = args.length < 4
    ? 'Not enough founding arguments to compute a full DNA profile for this law.'
    : coreTension
      ? `This ${catLabel} law was forged through a ${coreTension.intensity} tension between ${coreTension.label.toLowerCase()}. ` +
        `FOR arguments leaned ${domForLabel.toLowerCase()}, while AGAINST arguments emphasised ` +
        `${domAgainstLabel.toLowerCase()} reasoning.`
      : `This ${catLabel} law was primarily contested on ${domForLabel.toLowerCase()} grounds on both sides, ` +
        `suggesting a narrow policy disagreement rather than a fundamental value conflict.`

  return NextResponse.json({
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      established_at: law.established_at,
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
  } satisfies LawDNAResponse)
}
