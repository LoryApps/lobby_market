import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

// ─── Category → political spectrum positioning ─────────────────────────────

interface SpectrumProfile {
  axis: 'economic' | 'social' | 'governance' | 'environmental'
  left_label: string
  right_label: string
  description: string
}

const CATEGORY_SPECTRUM: Record<string, SpectrumProfile> = {
  Economics: {
    axis: 'economic',
    left_label: 'State-led economy',
    right_label: 'Free market',
    description: 'Economic policy positions range from state intervention to market liberalisation',
  },
  Politics: {
    axis: 'governance',
    left_label: 'Progressive governance',
    right_label: 'Conservative governance',
    description: 'Political positions range from institutional reform to preservation of norms',
  },
  Technology: {
    axis: 'governance',
    left_label: 'Regulated tech',
    right_label: 'Unregulated innovation',
    description: 'Technology policy ranges from strict oversight to permissionless innovation',
  },
  Science: {
    axis: 'governance',
    left_label: 'Evidence-based mandates',
    right_label: 'Individual scientific freedom',
    description: 'Science policy ranges from evidence-based mandates to open inquiry',
  },
  Ethics: {
    axis: 'social',
    left_label: 'Progressive values',
    right_label: 'Traditional values',
    description: 'Ethical positions range from progressive social norms to traditional frameworks',
  },
  Philosophy: {
    axis: 'social',
    left_label: 'Collective philosophy',
    right_label: 'Individualist philosophy',
    description: 'Philosophical positions range from communitarian to individualist worldviews',
  },
  Culture: {
    axis: 'social',
    left_label: 'Cultural pluralism',
    right_label: 'Cultural conservatism',
    description: 'Cultural positions range from pluralism and multiculturalism to cultural preservation',
  },
  Health: {
    axis: 'governance',
    left_label: 'Universal healthcare',
    right_label: 'Market-based health',
    description: 'Health policy ranges from universal public provision to market-driven systems',
  },
  Environment: {
    axis: 'environmental',
    left_label: 'Strong green policy',
    right_label: 'Economic primacy',
    description: 'Environmental positions range from climate-first policy to economic development focus',
  },
  Education: {
    axis: 'governance',
    left_label: 'Public universal education',
    right_label: 'Private school choice',
    description: 'Education policy ranges from universal public systems to market-based school choice',
  },
}

// ─── Global policy context per category ────────────────────────────────────
// Static reference data representing real-world international policy postures

interface GlobalContext {
  region: string
  stance: 'strongly-for' | 'for' | 'mixed' | 'against' | 'strongly-against'
  note: string
}

const GLOBAL_CONTEXT: Record<string, GlobalContext[]> = {
  Economics: [
    { region: 'Nordic countries', stance: 'strongly-for', note: 'High consensus around regulated markets and universal services' },
    { region: 'Western Europe', stance: 'for', note: 'Generally favour mixed economy models with strong worker protections' },
    { region: 'United States', stance: 'mixed', note: 'Deeply divided between free-market and regulated economy camps' },
    { region: 'East Asia (Japan/Korea)', stance: 'for', note: 'State-guided market models common in successful economies' },
    { region: 'Global South', stance: 'mixed', note: 'Varied: some favour development-first, others social protections' },
  ],
  Politics: [
    { region: 'Western liberal democracies', stance: 'for', note: 'Strong consensus around democratic norms and institutions' },
    { region: 'Eastern Europe', stance: 'mixed', note: 'Significant debate between populist and liberal democratic models' },
    { region: 'Latin America', stance: 'mixed', note: 'Oscillating between progressive reform and conservative pushback' },
    { region: 'East/Southeast Asia', stance: 'mixed', note: 'Varied: from mature democracies to authoritarian models' },
    { region: 'Middle East & Africa', stance: 'against', note: 'Mixed political systems; many not aligned with liberal norms' },
  ],
  Technology: [
    { region: 'European Union', stance: 'strongly-for', note: 'Leading on tech regulation: GDPR, AI Act, DSA' },
    { region: 'United States', stance: 'against', note: 'Generally permissive; industry self-regulation preferred' },
    { region: 'China', stance: 'mixed', note: 'Heavy domestic regulation but state-controlled rather than rights-based' },
    { region: 'UK & Commonwealth', stance: 'for', note: 'Moving toward stronger tech regulation post-Brexit' },
    { region: 'Emerging markets', stance: 'mixed', note: 'Rapidly digitising; governance lagging behind technology' },
  ],
  Science: [
    { region: 'European Union', stance: 'strongly-for', note: 'Strong evidence-based policymaking tradition' },
    { region: 'United States', stance: 'mixed', note: 'Science policy contested across party lines' },
    { region: 'East Asia (Japan/S.Korea/Taiwan)', stance: 'for', note: 'High public trust in scientific institutions' },
    { region: 'Global South', stance: 'mixed', note: 'Capacity constraints affect evidence-based governance' },
    { region: 'Russia & allies', stance: 'against', note: 'Science often subordinated to geopolitical interests' },
  ],
  Ethics: [
    { region: 'Western Europe', stance: 'for', note: 'Progressive social ethics widely accepted in law and policy' },
    { region: 'Scandinavia', stance: 'strongly-for', note: 'Global leaders in social rights and ethical governance' },
    { region: 'United States', stance: 'mixed', note: 'Deep cultural divide on social ethics and values' },
    { region: 'Latin America', stance: 'mixed', note: 'Catholic social tradition vs. progressive reform movements' },
    { region: 'Middle East & Africa', stance: 'against', note: 'Traditional and religious ethical frameworks dominant' },
  ],
  Philosophy: [
    { region: 'Continental Europe', stance: 'for', note: 'Rich tradition of civic philosophy influencing policy' },
    { region: 'Anglo-Saxon countries', stance: 'mixed', note: 'Empiricist and liberal traditions dominate; diverse views' },
    { region: 'East Asia', stance: 'mixed', note: 'Confucian collective ethics vs. Western individual rights' },
    { region: 'Islamic world', stance: 'against', note: 'Islamic philosophical tradition largely diverges from Western norms' },
    { region: 'Global', stance: 'mixed', note: 'No universal philosophical consensus; ongoing global discourse' },
  ],
  Culture: [
    { region: 'Western Europe & Oceania', stance: 'strongly-for', note: 'Cultural pluralism and diversity legally protected' },
    { region: 'North America', stance: 'mixed', note: 'Culture war tensions; pluralism contested' },
    { region: 'East Asia', stance: 'against', note: 'Cultural homogeneity often prioritised over pluralism' },
    { region: 'Russia', stance: 'strongly-against', note: 'State-promoted cultural conservatism' },
    { region: 'Africa', stance: 'mixed', note: 'Rich cultural diversity; traditional vs. modern tensions' },
  ],
  Health: [
    { region: 'Western Europe', stance: 'strongly-for', note: 'Universal healthcare seen as a basic right' },
    { region: 'Canada & Oceania', stance: 'for', note: 'Public healthcare systems broadly supported' },
    { region: 'United States', stance: 'mixed', note: 'Healthcare deeply contested; market vs. universal access' },
    { region: 'East Asia', stance: 'for', note: 'Strong public health systems and preventive care culture' },
    { region: 'Global South', stance: 'mixed', note: 'Universal aspiration; constrained by resources' },
  ],
  Environment: [
    { region: 'European Union', stance: 'strongly-for', note: 'Global leader on climate law and green transition' },
    { region: 'Small island nations', stance: 'strongly-for', note: 'Existential stakes drive maximum climate ambition' },
    { region: 'United States', stance: 'mixed', note: 'Climate policy contested; varies by administration' },
    { region: 'China', stance: 'mixed', note: 'Growing climate commitments; still coal-dependent economy' },
    { region: 'Petrostates', stance: 'strongly-against', note: 'Economic dependence on fossil fuels drives resistance' },
  ],
  Education: [
    { region: 'Nordic countries', stance: 'strongly-for', note: 'World-leading public education systems; free at all levels' },
    { region: 'Western Europe', stance: 'for', note: 'Strong public education; subsidised higher education common' },
    { region: 'United States', stance: 'mixed', note: 'Public school system + large private sector; school choice contested' },
    { region: 'East Asia', stance: 'for', note: 'High public investment in education; Confucian academic culture' },
    { region: 'Global South', stance: 'mixed', note: 'Universal aspiration; gaps in access and quality remain' },
  ],
}

// ─── Response types ────────────────────────────────────────────────────────────

export interface GlobalAlignedLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
}

export interface GlobalPeerLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  shared_keywords: string[]
}

export interface GlobalResponse {
  law_id: string
  law_statement: string
  law_category: string | null
  law_blue_pct: number
  law_total_votes: number
  law_established_at: string
  // Political spectrum positioning (0 = left, 100 = right, 50 = centre)
  spectrum_profile: SpectrumProfile | null
  spectrum_position: number
  spectrum_label: string
  // Where global consensus aligns
  global_context: GlobalContext[]
  global_alignment_score: number  // 0-100 — how well does Lobby consensus match global trends?
  // Other laws in the Codex in different categories (cross-category perspective)
  cross_category_laws: GlobalAlignedLaw[]
  // Laws in same category with similar FOR percentage (comparable global peers)
  peer_laws: GlobalPeerLaw[]
  // Category stats
  category_law_count: number
  category_avg_blue_pct: number
  category_highest_vote: GlobalAlignedLaw | null
  cached_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeSpectrumPosition(category: string | null, bluePct: number): number {
  // bluePct = % FOR. We map FOR% to a position on the spectrum.
  // For most categories, a high FOR% means the community leans left/progressive.
  // We invert for categories where FOR means more conservative.
  const invertedCategories = new Set(['Economics']) // high FOR in Economics might mean regulation (left)
  const base = bluePct
  if (invertedCategories.has(category ?? '')) {
    return Math.round(100 - base)
  }
  return Math.round(base)
}

function spectrumLabel(position: number): string {
  if (position >= 80) return 'Strongly Progressive'
  if (position >= 65) return 'Progressive'
  if (position >= 55) return 'Centre-Left'
  if (position >= 45) return 'Centrist'
  if (position >= 35) return 'Centre-Right'
  if (position >= 20) return 'Conservative'
  return 'Strongly Conservative'
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 5)
    .slice(0, 10)
}

function computeGlobalAlignment(category: string | null, bluePct: number): number {
  const ctx = GLOBAL_CONTEXT[category ?? ''] ?? []
  if (ctx.length === 0) return 50

  const stanceScores: Record<string, number> = {
    'strongly-for': 90,
    'for': 70,
    'mixed': 50,
    'against': 30,
    'strongly-against': 10,
  }

  const avgGlobal = ctx.reduce((sum, c) => sum + (stanceScores[c.stance] ?? 50), 0) / ctx.length
  const diff = Math.abs(bluePct - avgGlobal)
  return Math.round(Math.max(0, 100 - diff))
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ error: 'Missing law id' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, blue_pct, total_votes, established_at')
    .eq('id', id)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const keywords = extractKeywords(law.statement)

  const [categoryLawsResult, crossCatResult] = await Promise.all([
    // Laws in the same category
    supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at')
      .neq('id', id)
      .eq('category', law.category)
      .order('total_votes', { ascending: false })
      .limit(30),

    // Laws in other categories — most voted, for cross-category context
    supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at')
      .neq('id', id)
      .neq('category', law.category)
      .order('total_votes', { ascending: false })
      .limit(20),
  ])

  const catLaws = (categoryLawsResult.data ?? []) as GlobalAlignedLaw[]
  const crossLaws = (crossCatResult.data ?? []) as GlobalAlignedLaw[]

  // Peer laws: same category, similar FOR% (within 15 points)
  const peerLaws: GlobalPeerLaw[] = catLaws
    .filter((l) => Math.abs((l.blue_pct ?? 50) - (law.blue_pct ?? 50)) <= 15)
    .map((l) => {
      const lawKws = extractKeywords(l.statement)
      const shared = keywords.filter((k) => lawKws.includes(k))
      return { ...l, shared_keywords: shared }
    })
    .slice(0, 5)

  // Category stats
  const categoryAvgBluePct = catLaws.length > 0
    ? Math.round(catLaws.reduce((s, l) => s + (l.blue_pct ?? 50), 0) / catLaws.length)
    : Math.round(law.blue_pct ?? 50)

  const categoryHighestVote = catLaws.sort((a, b) => b.total_votes - a.total_votes)[0] ?? null

  // Cross-category: one law per other category (diverse perspective)
  const seen = new Set<string>()
  const crossCatFiltered: GlobalAlignedLaw[] = []
  for (const l of crossLaws) {
    const cat = l.category ?? 'Other'
    if (!seen.has(cat)) {
      seen.add(cat)
      crossCatFiltered.push(l)
    }
    if (crossCatFiltered.length >= 5) break
  }

  const spectrumProfile = CATEGORY_SPECTRUM[law.category ?? ''] ?? null
  const spectrumPosition = computeSpectrumPosition(law.category, law.blue_pct ?? 50)
  const globalAlignment = computeGlobalAlignment(law.category, law.blue_pct ?? 50)
  const globalCtx = GLOBAL_CONTEXT[law.category ?? ''] ?? []

  return NextResponse.json({
    law_id: law.id,
    law_statement: law.statement,
    law_category: law.category ?? null,
    law_blue_pct: law.blue_pct ?? 50,
    law_total_votes: law.total_votes ?? 0,
    law_established_at: law.established_at,
    spectrum_profile: spectrumProfile,
    spectrum_position: spectrumPosition,
    spectrum_label: spectrumLabel(spectrumPosition),
    global_context: globalCtx,
    global_alignment_score: globalAlignment,
    cross_category_laws: crossCatFiltered,
    peer_laws: peerLaws,
    category_law_count: catLaws.length + 1,
    category_avg_blue_pct: categoryAvgBluePct,
    category_highest_vote: categoryHighestVote ?? null,
    cached_at: new Date().toISOString(),
  } satisfies GlobalResponse)
}
