import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryDiversityRow {
  category: string
  count: number
  pct: number
  forPct: number        // % of your votes that were FOR in this category
  platformAvgFor: number // platform-wide FOR% in this category
  deviation: number     // how much your position deviates from platform avg
}

export interface BroadenSuggestion {
  id: string
  statement: string
  category: string
  blue_pct: number
  total_votes: number
  status: string
}

export interface DiversityData {
  totalVotes: number
  diversityScore: number      // 0–100 composite
  categoryScore: number       // 0–40 portion
  balanceScore: number        // 0–30 portion
  independenceScore: number   // 0–30 portion
  contrarian_rate: number     // 0–100 % of votes against majority
  categoriesVoted: number     // how many distinct categories
  label: 'Echo Chamber' | 'Leaning' | 'Balanced' | 'Curious' | 'Free Thinker'
  labelColor: string
  labelDesc: string
  byCategory: CategoryDiversityRow[]
  topCategory: string | null
  leastVotedCategory: string | null
  broadenSuggestions: BroadenSuggestion[]
  platformAvgDiversity: number  // rough platform average for comparison
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const N_CATEGORIES = ALL_CATEGORIES.length   // 10

// Shannon entropy of a probability distribution p[] (values sum to 1)
function shannonEntropy(probs: number[]): number {
  return -probs.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0)
}

const MAX_ENTROPY = Math.log2(N_CATEGORIES)  // ~3.321 for 10 categories

function toLabel(score: number): DiversityData['label'] {
  if (score < 20) return 'Echo Chamber'
  if (score < 40) return 'Leaning'
  if (score < 60) return 'Balanced'
  if (score < 80) return 'Curious'
  return 'Free Thinker'
}

const LABEL_META: Record<DiversityData['label'], { color: string; desc: string }> = {
  'Echo Chamber': {
    color: 'text-against-400',
    desc: 'Your civic diet is concentrated in a small slice of the debate space. Try exploring new categories.',
  },
  'Leaning': {
    color: 'text-gold',
    desc: 'You engage across several categories but lean heavily toward a few. Broaden your civic diet.',
  },
  'Balanced': {
    color: 'text-for-400',
    desc: 'A well-rounded voter who engages across many categories with a healthy mix of positions.',
  },
  'Curious': {
    color: 'text-emerald',
    desc: 'You explore civic topics widely and often vote independently of the majority. Strong civic instincts.',
  },
  'Free Thinker': {
    color: 'text-purple',
    desc: 'Exceptional civic breadth. You engage across all categories and form independent positions.',
  },
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Fetch user votes with topic info ──────────────────────────────────────
  const { data: voteRows, error: voteErr } = await supabase
    .from('votes')
    .select('side, topic_id')
    .eq('user_id', user.id)

  if (voteErr || !voteRows || voteRows.length === 0) {
    return NextResponse.json(emptyData())
  }

  const topicIds = [...new Set(voteRows.map((v) => v.topic_id))]

  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, category, blue_pct, status, statement, total_votes')
    .in('id', topicIds)

  if (!topicRows || topicRows.length === 0) {
    return NextResponse.json(emptyData())
  }

  const topicMap = new Map(topicRows.map((t) => [t.id, t]))

  // ── 2. Build per-vote enriched records ───────────────────────────────────────
  type VoteRec = {
    category: string
    side: 'blue' | 'red'
    bluePct: number
    inMajority: boolean
  }

  const records: VoteRec[] = []
  for (const vote of voteRows) {
    const t = topicMap.get(vote.topic_id)
    if (!t) continue
    const bluePct = t.blue_pct ?? 50
    const majorSide: 'blue' | 'red' = bluePct >= 50 ? 'blue' : 'red'
    records.push({
      category: t.category ?? 'Uncategorized',
      side: vote.side as 'blue' | 'red',
      bluePct,
      inMajority: vote.side === majorSide,
    })
  }

  const totalVotes = records.length
  if (totalVotes === 0) return NextResponse.json(emptyData())

  // ── 3. Category breakdown ────────────────────────────────────────────────────
  type CatAgg = { count: number; forVotes: number }
  const catMap = new Map<string, CatAgg>()
  for (const r of records) {
    const agg = catMap.get(r.category) ?? { count: 0, forVotes: 0 }
    agg.count++
    if (r.side === 'blue') agg.forVotes++
    catMap.set(r.category, agg)
  }

  // Platform-wide FOR% per category (sample from topic pool)
  const platformForByCategory: Record<string, number> = {}
  for (const cat of ALL_CATEGORIES) {
    const catTopics = topicRows.filter((t) => t.category === cat && t.blue_pct !== null)
    if (catTopics.length > 0) {
      platformForByCategory[cat] =
        catTopics.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / catTopics.length
    } else {
      platformForByCategory[cat] = 50
    }
  }

  const byCategory: CategoryDiversityRow[] = []
  for (const [category, agg] of catMap.entries()) {
    const pct = Math.round((agg.count / totalVotes) * 100)
    const forPct = agg.count > 0 ? Math.round((agg.forVotes / agg.count) * 100) : 50
    const platformAvgFor = Math.round(platformForByCategory[category] ?? 50)
    const deviation = Math.abs(forPct - platformAvgFor)
    byCategory.push({ category, count: agg.count, pct, forPct, platformAvgFor, deviation })
  }
  byCategory.sort((a, b) => b.count - a.count)

  // ── 4. Compute score components ───────────────────────────────────────────────

  // (a) Category score (0–40): how many of the 10 civic categories you vote in
  const distinctCategories = new Set(records.map((r) => r.category))
  const distinctCivicCategories = ALL_CATEGORIES.filter((c) => distinctCategories.has(c)).length
  const categoryScore = Math.round((distinctCivicCategories / N_CATEGORIES) * 40)

  // (b) Balance score (0–30): entropy of your category distribution
  const probs = ALL_CATEGORIES.map((c) => (catMap.get(c)?.count ?? 0) / totalVotes)
  const entropy = shannonEntropy(probs)
  const balanceScore = Math.round((entropy / MAX_ENTROPY) * 30)

  // (c) Independence score (0–30): based on contrarian rate
  // Optimal = 20–70% contrarian (you're not a conformist or pure contrarian)
  const contrarian_rate = Math.round(
    (records.filter((r) => !r.inMajority).length / totalVotes) * 100
  )
  // Bell curve centred at 45%: score = 30 * (1 - |rate - 45| / 45) clamped to [0,30]
  const indRaw = 30 * (1 - Math.abs(contrarian_rate - 45) / 45)
  const independenceScore = Math.max(0, Math.round(indRaw))

  const diversityScore = Math.min(100, categoryScore + balanceScore + independenceScore)

  // ── 5. Labels ─────────────────────────────────────────────────────────────────
  const label = toLabel(diversityScore)
  const { color: labelColor, desc: labelDesc } = LABEL_META[label]

  // ── 6. Top & least voted civic category ──────────────────────────────────────
  const sortedCivic = byCategory.filter((r) => ALL_CATEGORIES.includes(r.category))
  const topCategory = sortedCivic[0]?.category ?? null
  const leastVotedCategory =
    sortedCivic.length > 0 ? sortedCivic[sortedCivic.length - 1].category : null

  // ── 7. Broaden suggestions — up to 3 topics from least-voted categories ──────
  const leastCategories = ALL_CATEGORIES.filter(
    (c) => !distinctCategories.has(c) || (catMap.get(c)?.count ?? 0) < 3
  ).slice(0, 4)

  const broadenSuggestions: BroadenSuggestion[] = []
  if (leastCategories.length > 0) {
    const { data: broadenTopics } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, status')
      .in('category', leastCategories)
      .in('status', ['active', 'voting'])
      .order('total_votes', { ascending: false })
      .limit(6)

    const seenCategories = new Set<string>()
    for (const t of broadenTopics ?? []) {
      if (
        t.category &&
        !seenCategories.has(t.category) &&
        broadenSuggestions.length < 3
      ) {
        seenCategories.add(t.category)
        broadenSuggestions.push({
          id: t.id,
          statement: t.statement,
          category: t.category,
          blue_pct: t.blue_pct ?? 50,
          total_votes: t.total_votes ?? 0,
          status: t.status,
        })
      }
    }
  }

  // ── 8. Platform average diversity (rough approximation) ──────────────────────
  // Sample a random subset of users' vote distribution
  // For performance we just provide the expected value: ~45 for a typical user
  const platformAvgDiversity = 45

  return NextResponse.json({
    totalVotes,
    diversityScore,
    categoryScore,
    balanceScore,
    independenceScore,
    contrarian_rate,
    categoriesVoted: distinctCivicCategories,
    label,
    labelColor,
    labelDesc,
    byCategory,
    topCategory,
    leastVotedCategory,
    broadenSuggestions,
    platformAvgDiversity,
  } satisfies DiversityData)
}

function emptyData(): DiversityData {
  return {
    totalVotes: 0,
    diversityScore: 0,
    categoryScore: 0,
    balanceScore: 0,
    independenceScore: 0,
    contrarian_rate: 0,
    categoriesVoted: 0,
    label: 'Echo Chamber',
    labelColor: 'text-surface-500',
    labelDesc: 'Vote on more topics to generate your diversity profile.',
    byCategory: [],
    topCategory: null,
    leastVotedCategory: null,
    broadenSuggestions: [],
    platformAvgDiversity: 45,
  }
}
