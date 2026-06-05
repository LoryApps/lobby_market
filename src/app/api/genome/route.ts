import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics',
  'Economics',
  'Technology',
  'Ethics',
  'Science',
  'Culture',
  'Philosophy',
  'Health',
  'Environment',
  'Education',
] as const

type Category = (typeof CATEGORIES)[number] | 'Other'

const MAX_VOTES = 600

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenomeStrand {
  category: Category
  /** % of user's votes in this category that were FOR */
  for_pct: number
  /** platform average FOR % in this category */
  platform_for_pct: number
  /** deviation from platform average: positive = more progressive, negative = more conservative */
  deviation: number
  /** number of user votes in this category */
  vote_count: number
  /** consistency score 0–100: how predictable the user is in this category */
  consistency: number
}

export interface MonthlySequence {
  month: string        // e.g. "2024-11"
  for_count: number
  against_count: number
  for_pct: number      // 0–100
  categories: string[] // top category that month
}

export interface GenomeData {
  strands: GenomeStrand[]
  monthly_sequence: MonthlySequence[]
  dominant_strand: GenomeStrand | null   // most votes + strongest position
  recessive_strand: GenomeStrand | null  // fewest votes or most conflicted
  genome_score: number     // 0–100: breadth × depth composite
  breadth: number          // how many categories voted in (0–100)
  depth: number            // avg votes per active category (0–100)
  consistency_score: number // avg consistency across strands (0–100)
  total_votes: number
  active_categories: number
  /** One-word civic genome "type" */
  genome_type: string
  genome_description: string
  /** Sequence string: a 24-char DNA-like string unique to this user */
  dna_sequence: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeConsistency(forCount: number, againstCount: number): number {
  const total = forCount + againstCount
  if (total < 2) return 50
  const majority = Math.max(forCount, againstCount)
  return Math.round((majority / total) * 100)
}

function encodeSequence(strands: GenomeStrand[], userId: string): string {
  // Build a 24-char sequence from the strand data
  const bases = 'ACGT'
  let seq = ''
  // Use a simple hash of userId for the seed
  let seed = 0
  for (let i = 0; i < userId.length; i++) {
    seed = (seed * 31 + userId.charCodeAt(i)) >>> 0
  }

  for (let i = 0; i < 24; i++) {
    if (i < strands.length * 2) {
      const strandIdx = Math.floor(i / 2)
      const strand = strands[strandIdx]
      if (strand) {
        // Even positions: encode FOR/AGAINST lean; odd: encode deviation strength
        const val = i % 2 === 0
          ? Math.floor((strand.for_pct / 100) * 4)
          : Math.floor((Math.abs(strand.deviation) / 50) * 4)
        seq += bases[Math.min(3, val)]
        continue
      }
    }
    // Pad with deterministic noise from seed
    seed = (seed * 1664525 + 1013904223) >>> 0
    seq += bases[seed % 4]
  }
  return seq
}

function computeGenomeType(
  breadth: number,
  consistency: number,
  totalVotes: number,
  dominantStrand: GenomeStrand | null,
): { type: string; description: string } {
  if (totalVotes < 5) {
    return {
      type: 'Nascent',
      description: 'Your civic genome is still forming. Vote on more topics to reveal your full sequence.',
    }
  }

  if (breadth >= 70 && consistency >= 75) {
    return {
      type: 'Helical',
      description:
        'A complete double-helix of civic engagement — broad across issues and highly consistent in position. The rarest genome type.',
    }
  }
  if (breadth >= 70 && consistency < 60) {
    return {
      type: 'Amorphous',
      description:
        'Wide-ranging but fluid — you engage across the entire civic spectrum without fixed stances. Your genome resists easy classification.',
    }
  }
  if (breadth < 40 && consistency >= 80) {
    return {
      type: 'Crystalline',
      description:
        'Intense focus on a narrow domain with ironclad consistency. Your civic DNA is a single dominant strand, not a full helix.',
    }
  }
  if (dominantStrand && Math.abs(dominantStrand.deviation) >= 30) {
    return {
      type: 'Mutant',
      description: `Your ${dominantStrand.category} strand deviates radically from the platform norm. A true outlier sequence.`,
    }
  }
  if (consistency >= 75) {
    return {
      type: 'Stable',
      description:
        'A well-defined genome with consistent positions across your active categories. Predictable and principled.',
    }
  }
  if (consistency < 50) {
    return {
      type: 'Polymorphic',
      description:
        'High variance in your positions — you vote differently on similar topics. A genome shaped by nuance rather than ideology.',
    }
  }
  return {
    type: 'Standard',
    description:
      'A balanced civic genome — moderate breadth and consistency, tracking closely with the platform norm in most areas.',
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch user's votes joined with topic data
  const { data: votes } = await supabase
    .from('votes')
    .select('side, created_at, topics(id, category, status, blue_pct, total_votes, statement)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(MAX_VOTES)

  if (!votes || votes.length === 0) {
    return NextResponse.json({
      strands: [],
      monthly_sequence: [],
      dominant_strand: null,
      recessive_strand: null,
      genome_score: 0,
      breadth: 0,
      depth: 0,
      consistency_score: 0,
      total_votes: 0,
      active_categories: 0,
      genome_type: 'Nascent',
      genome_description: 'Cast votes on topics to reveal your civic genome.',
      dna_sequence: 'ACGTACGTACGTACGTACGTACGT',
    } satisfies GenomeData)
  }

  // ── Build per-category strand data ─────────────────────────────────────────

  const strandMap = new Map<
    Category,
    {
      forCount: number
      againstCount: number
      platformForSum: number
      topicCount: number
    }
  >()

  // ── Build monthly sequence data ─────────────────────────────────────────────

  const monthMap = new Map<
    string,
    {
      forCount: number
      againstCount: number
      categoryCount: Map<string, number>
    }
  >()

  let totalVotes = 0

  for (const vote of votes) {
    const topic = Array.isArray(vote.topics) ? vote.topics[0] : vote.topics
    if (!topic) continue

    const rawCat = (topic.category as string | null) ?? 'Other'
    const cat: Category = (CATEGORIES as readonly string[]).includes(rawCat)
      ? (rawCat as Category)
      : 'Other'

    if (!strandMap.has(cat)) {
      strandMap.set(cat, { forCount: 0, againstCount: 0, platformForSum: 0, topicCount: 0 })
    }
    const entry = strandMap.get(cat)!
    if (vote.side === 'for') entry.forCount++
    else entry.againstCount++
    entry.platformForSum += topic.blue_pct ?? 50
    entry.topicCount++

    // Monthly aggregation
    const monthKey = vote.created_at.slice(0, 7) // "YYYY-MM"
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { forCount: 0, againstCount: 0, categoryCount: new Map() })
    }
    const mEntry = monthMap.get(monthKey)!
    if (vote.side === 'for') mEntry.forCount++
    else mEntry.againstCount++
    mEntry.categoryCount.set(cat, (mEntry.categoryCount.get(cat) ?? 0) + 1)

    totalVotes++
  }

  // ── Convert to GenomeStrand array ───────────────────────────────────────────

  const strands: GenomeStrand[] = []

  for (const [cat, entry] of strandMap.entries()) {
    const total = entry.forCount + entry.againstCount
    if (total === 0) continue
    const forPct = Math.round((entry.forCount / total) * 100)
    const platformForPct = Math.round(entry.platformForSum / entry.topicCount)
    strands.push({
      category: cat,
      for_pct: forPct,
      platform_for_pct: platformForPct,
      deviation: forPct - platformForPct,
      vote_count: total,
      consistency: computeConsistency(entry.forCount, entry.againstCount),
    })
  }

  // Sort by vote count desc so dominant strand comes first
  strands.sort((a, b) => b.vote_count - a.vote_count)

  // ── Monthly sequence ────────────────────────────────────────────────────────

  const monthly_sequence: MonthlySequence[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => {
      const total = m.forCount + m.againstCount
      const topCat = Array.from(m.categoryCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([c]) => c)
      return {
        month,
        for_count: m.forCount,
        against_count: m.againstCount,
        for_pct: total > 0 ? Math.round((m.forCount / total) * 100) : 50,
        categories: topCat,
      }
    })

  // ── Composite scores ────────────────────────────────────────────────────────

  const activeCats = strands.length
  const breadth = Math.min(100, Math.round((activeCats / CATEGORIES.length) * 100))
  const avgVotesPerCat = activeCats > 0 ? totalVotes / activeCats : 0
  const depth = Math.min(100, Math.round(Math.log2(avgVotesPerCat + 1) * 20))
  const consistencyScore =
    strands.length > 0
      ? Math.round(strands.reduce((s, c) => s + c.consistency, 0) / strands.length)
      : 50

  // Genome score = harmonic mean of breadth × depth × consistency
  const genomeScore = Math.round((breadth + depth + consistencyScore) / 3)

  // ── Dominant / recessive strands ────────────────────────────────────────────

  const dominantStrand =
    strands.length > 0
      ? strands.reduce((best, s) =>
          s.vote_count > best.vote_count ||
          (s.vote_count === best.vote_count && Math.abs(s.deviation) > Math.abs(best.deviation))
            ? s
            : best,
        )
      : null

  // Recessive = highest vote_count strand with lowest consistency (most conflicted)
  const recessiveStrand =
    strands.length > 1
      ? strands
          .filter((s) => s !== dominantStrand)
          .reduce((worst, s) =>
            s.consistency < worst.consistency ? s : worst,
          )
      : null

  // ── Genome type ─────────────────────────────────────────────────────────────

  const { type, description } = computeGenomeType(breadth, consistencyScore, totalVotes, dominantStrand)

  const dnaSequence = encodeSequence(strands, user.id)

  return NextResponse.json({
    strands,
    monthly_sequence,
    dominant_strand: dominantStrand,
    recessive_strand: recessiveStrand,
    genome_score: genomeScore,
    breadth,
    depth,
    consistency_score: consistencyScore,
    total_votes: totalVotes,
    active_categories: activeCats,
    genome_type: type,
    genome_description: description,
    dna_sequence: dnaSequence,
  } satisfies GenomeData)
}
