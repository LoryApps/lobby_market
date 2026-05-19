import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TensionLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
}

export interface LawTension {
  id: string
  law_a: TensionLaw
  law_b: TensionLaw
  tension_score: number
  tension_type: 'spending' | 'regulation' | 'social' | 'governance' | 'scope'
  tension_label: string
  keywords_a: string[]
  keywords_b: string[]
  shared_domain: string
}

export interface TensionsResponse {
  tensions: LawTension[]
  total_laws: number
  coherence_score: number
  generated_at: string
}

// ─── Keyword dictionaries ─────────────────────────────────────────────────────

const DIMENSIONS: Record<string, { positive: string[]; negative: string[]; label: string }> = {
  spending: {
    positive: ['invest', 'fund', 'spending', 'allocate', 'increase funding', 'more money', 'expand budget', 'subsidi', 'grant', 'public spending', 'increase investment'],
    negative: ['cut', 'reduce spending', 'austerity', 'fiscal', 'budget cut', 'defund', 'eliminate funding', 'savings', 'privatize', 'reduce cost'],
    label: 'Spending',
  },
  regulation: {
    positive: ['regulate', 'oversight', 'standard', 'require', 'mandatory', 'must', 'enforce', 'compliance', 'restrict', 'ban', 'prohibit', 'limit'],
    negative: ['deregulate', 'voluntary', 'freedom', 'choice', 'market', 'competition', 'private sector', 'self-regulation', 'reduce regulation', 'remove restriction'],
    label: 'Regulation',
  },
  social: {
    positive: ['collective', 'community', 'society', 'public good', 'common', 'shared', 'universal', 'equal access', 'solidarity', 'social protection'],
    negative: ['individual', 'personal responsibility', 'private', 'merit', 'choice', 'opt-out', 'freedom of', 'voluntary', 'personal'],
    label: 'Social',
  },
  governance: {
    positive: ['government', 'federal', 'national', 'state-led', 'public institution', 'central', 'authority', 'department', 'ministry', 'parliament'],
    negative: ['local', 'decentralize', 'community-led', 'devolution', 'state rights', 'autonomy', 'self-govern', 'reduce government'],
    label: 'Governance',
  },
  scope: {
    positive: ['expand', 'extend', 'broaden', 'increase', 'grow', 'scale up', 'universal', 'comprehensive', 'all', 'every'],
    negative: ['narrow', 'limit', 'restrict scope', 'targeted', 'reduce', 'phase out', 'specific', 'only', 'exclusive'],
    label: 'Scope',
  },
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreStatement(text: string): Record<string, number> {
  const lower = text.toLowerCase()
  const scores: Record<string, number> = {}

  for (const [dim, { positive, negative }] of Object.entries(DIMENSIONS)) {
    let score = 0
    for (const kw of positive) {
      if (lower.includes(kw)) score += 1
    }
    for (const kw of negative) {
      if (lower.includes(kw)) score -= 1
    }
    scores[dim] = score
  }
  return scores
}

function matchedKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase()
  return keywords.filter((kw) => lower.includes(kw))
}

function pickTensionType(dim: string): LawTension['tension_type'] {
  const map: Record<string, LawTension['tension_type']> = {
    spending: 'spending',
    regulation: 'regulation',
    social: 'social',
    governance: 'governance',
    scope: 'scope',
  }
  return map[dim] ?? 'regulation'
}

// ─── Domain extraction ────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: [string, string[]][] = [
  ['education', ['school', 'education', 'teacher', 'student', 'university', 'college', 'learn', 'curriculum']],
  ['healthcare', ['health', 'medical', 'hospital', 'drug', 'medicine', 'patient', 'doctor', 'mental health']],
  ['energy', ['energy', 'renewable', 'fossil', 'oil', 'gas', 'electricity', 'carbon', 'climate', 'emission']],
  ['economy', ['economy', 'tax', 'trade', 'market', 'wage', 'income', 'business', 'finance', 'bank']],
  ['technology', ['technology', 'digital', 'internet', 'data', 'privacy', 'AI', 'software', 'algorithm']],
  ['justice', ['crime', 'police', 'justice', 'prison', 'court', 'law enforcement', 'security', 'penalty']],
  ['immigration', ['immigra', 'border', 'asylum', 'refugee', 'migrant', 'citizen', 'visa', 'foreigner']],
  ['environment', ['environment', 'pollution', 'nature', 'biodiversity', 'ecosystem', 'wildlife', 'forest']],
  ['housing', ['housing', 'rent', 'property', 'home', 'land', 'zoning', 'construction', 'affordable']],
  ['labor', ['worker', 'wage', 'union', 'employment', 'job', 'labor', 'workplace', 'minimum wage']],
]

function extractDomain(text: string): string {
  const lower = text.toLowerCase()
  for (const [domain, keywords] of DOMAIN_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return domain
  }
  return 'general'
}

// ─── GET /api/law/tensions ─────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: lawRows, error } = await supabase
    .from('laws')
    .select('id, statement, full_statement, category, blue_pct, total_votes, established_at')
    .eq('is_active', true)
    .order('established_at', { ascending: false })
    .limit(200)

  if (error || !lawRows) {
    return NextResponse.json({ tensions: [], total_laws: 0, coherence_score: 100, generated_at: new Date().toISOString() })
  }

  const laws = lawRows as TensionLaw[]

  // Score every law
  const scored = laws.map((law) => ({
    law,
    scores: scoreStatement(law.statement + ' ' + (law.full_statement ?? '')),
    domain: extractDomain(law.statement + ' ' + (law.full_statement ?? '')),
  }))

  // Find tensions: same category or same domain, opposing dimension scores
  const tensions: LawTension[] = []
  const seen = new Set<string>()

  for (let i = 0; i < scored.length; i++) {
    for (let j = i + 1; j < scored.length; j++) {
      const a = scored[i]
      const b = scored[j]

      // Only pair laws in same category OR same inferred domain
      const sameCategory = a.law.category && b.law.category && a.law.category === b.law.category
      const sameDomain = a.domain === b.domain && a.domain !== 'general'
      if (!sameCategory && !sameDomain) continue

      // Find the dimension with the biggest opposing score
      let maxTensionScore = 0
      let tensionDim = ''
      for (const dim of Object.keys(DIMENSIONS)) {
        const scoreA = a.scores[dim] ?? 0
        const scoreB = b.scores[dim] ?? 0
        // Tension = both laws have nonzero scores in opposite directions
        if (scoreA > 0 && scoreB < 0) {
          const t = scoreA + Math.abs(scoreB)
          if (t > maxTensionScore) { maxTensionScore = t; tensionDim = dim }
        } else if (scoreA < 0 && scoreB > 0) {
          const t = Math.abs(scoreA) + scoreB
          if (t > maxTensionScore) { maxTensionScore = t; tensionDim = dim }
        }
      }

      if (maxTensionScore < 2 || !tensionDim) continue

      const pairKey = [a.law.id, b.law.id].sort().join(':')
      if (seen.has(pairKey)) continue
      seen.add(pairKey)

      const dim = DIMENSIONS[tensionDim]
      const scoreA = a.scores[tensionDim] ?? 0

      // Law A is positive, Law B is negative
      const [posLaw, negLaw] =
        scoreA > 0
          ? [a, b]
          : [b, a]

      tensions.push({
        id: pairKey,
        law_a: posLaw.law,
        law_b: negLaw.law,
        tension_score: maxTensionScore,
        tension_type: pickTensionType(tensionDim),
        tension_label: dim.label,
        keywords_a: matchedKeywords(posLaw.law.statement + ' ' + (posLaw.law.full_statement ?? ''), dim.positive),
        keywords_b: matchedKeywords(negLaw.law.statement + ' ' + (negLaw.law.full_statement ?? ''), dim.negative),
        shared_domain: sameCategory ? (a.law.category ?? a.domain) : a.domain,
      })
    }
  }

  // Sort by tension score descending, limit to 40
  tensions.sort((a, b) => b.tension_score - a.tension_score)
  const topTensions = tensions.slice(0, 40)

  // Coherence score: 100 if no tensions, lower the more tensions there are relative to laws
  const coherenceScore = laws.length === 0
    ? 100
    : Math.max(0, Math.round(100 - (tensions.length / Math.max(1, laws.length)) * 50))

  return NextResponse.json({
    tensions: topTensions,
    total_laws: laws.length,
    coherence_score: coherenceScore,
    generated_at: new Date().toISOString(),
  } satisfies TensionsResponse)
}
