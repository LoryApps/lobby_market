import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoleSegment {
  role: string
  label: string
  count: number
  pct: number
  avg_votes: number
  avg_arguments: number
}

export interface CategoryIdeology {
  category: string
  topic_count: number
  total_votes: number
  avg_for_pct: number
  law_count: number
  deadlock_count: number
  majority_count: number
  supermajority_count: number
}

export interface ConsensusQuality {
  supermajority: number
  majority: number
  contested: number
  deadlock: number
  total: number
}

export interface ActivityBand {
  label: string
  description: string
  count: number
  pct: number
  min_votes: number
  max_votes: number | null
}

export interface CensusData {
  totals: {
    registered_citizens: number
    total_votes_cast: number
    active_topics: number
    established_laws: number
    total_arguments: number
    coalitions: number
  }
  role_distribution: RoleSegment[]
  category_ideology: CategoryIdeology[]
  consensus_quality: ConsensusQuality
  activity_bands: ActivityBand[]
  platform_ideology: {
    overall_for_pct: number
    most_pro_category: string | null
    most_against_category: string | null
    polarisation_index: number
  }
  generated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const [profilesRes, topicsRes, lawsRes, coalitionsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, total_votes, total_arguments')
      .limit(20000),
    supabase
      .from('topics')
      .select('category, status, blue_pct, total_votes, blue_votes, red_votes')
      .not('status', 'eq', 'archived')
      .limit(20000),
    supabase
      .from('laws')
      .select('category, total_votes')
      .eq('is_active', true)
      .limit(5000),
    supabase
      .from('coalitions')
      .select('id', { count: 'exact', head: true }),
  ])

  const profiles = profilesRes.data ?? []
  const topics = topicsRes.data ?? []
  const laws = lawsRes.data ?? []
  const coalitionCount = coalitionsRes.count ?? 0

  // ── Totals ──────────────────────────────────────────────────────────────────

  const totalVotesCast = profiles.reduce((s, p) => s + (p.total_votes ?? 0), 0)
  const totalArguments = profiles.reduce((s, p) => s + (p.total_arguments ?? 0), 0)
  const activeTopics = topics.filter((t) => ['active', 'voting', 'proposed'].includes(t.status)).length

  // ── Role distribution ───────────────────────────────────────────────────────

  const roleMap: Record<string, { count: number; votes: number; args: number }> = {}
  for (const p of profiles) {
    const role = p.role ?? 'person'
    if (!roleMap[role]) roleMap[role] = { count: 0, votes: 0, args: 0 }
    roleMap[role].count += 1
    roleMap[role].votes += p.total_votes ?? 0
    roleMap[role].args += p.total_arguments ?? 0
  }

  const roleOrder = ['person', 'debator', 'troll_catcher', 'elder']
  const role_distribution: RoleSegment[] = roleOrder
    .filter((r) => roleMap[r])
    .map((role) => {
      const seg = roleMap[role]
      return {
        role,
        label: ROLE_LABELS[role] ?? role,
        count: seg.count,
        pct: profiles.length > 0 ? Math.round((seg.count / profiles.length) * 1000) / 10 : 0,
        avg_votes: seg.count > 0 ? Math.round(seg.votes / seg.count) : 0,
        avg_arguments: seg.count > 0 ? Math.round(seg.args / seg.count) : 0,
      }
    })

  // ── Category ideology ───────────────────────────────────────────────────────

  const lawCatMap: Record<string, number> = {}
  for (const l of laws) {
    const cat = l.category ?? 'Other'
    lawCatMap[cat] = (lawCatMap[cat] ?? 0) + 1
  }

  const catMap: Record<
    string,
    { topics: number; votes: number; for_pct_sum: number; deadlock: number; majority: number; supermajority: number }
  > = {}

  for (const t of topics) {
    if (!t.category) continue
    if (!catMap[t.category]) catMap[t.category] = { topics: 0, votes: 0, for_pct_sum: 0, deadlock: 0, majority: 0, supermajority: 0 }
    const c = catMap[t.category]
    c.topics += 1
    c.votes += t.total_votes ?? 0
    c.for_pct_sum += t.blue_pct ?? 50

    const pct = t.blue_pct ?? 50
    if (pct >= 40 && pct <= 60) c.deadlock += 1
    else if ((pct > 60 && pct < 75) || (pct > 25 && pct < 40)) c.majority += 1
    else if (pct >= 75 || pct <= 25) c.supermajority += 1
  }

  const category_ideology: CategoryIdeology[] = Object.entries(catMap)
    .map(([category, c]) => ({
      category,
      topic_count: c.topics,
      total_votes: c.votes,
      avg_for_pct: c.topics > 0 ? Math.round((c.for_pct_sum / c.topics) * 10) / 10 : 50,
      law_count: lawCatMap[category] ?? 0,
      deadlock_count: c.deadlock,
      majority_count: c.majority,
      supermajority_count: c.supermajority,
    }))
    .sort((a, b) => b.total_votes - a.total_votes)
    .slice(0, 12)

  // ── Consensus quality (all topics with votes) ────────────────────────────────

  const topicsWithVotes = topics.filter((t) => (t.total_votes ?? 0) > 0)
  let supermajority = 0, majority = 0, contested = 0, deadlock = 0
  for (const t of topicsWithVotes) {
    const pct = t.blue_pct ?? 50
    if (pct >= 75 || pct <= 25) supermajority += 1
    else if ((pct > 60 && pct < 75) || (pct > 25 && pct < 40)) majority += 1
    else if (pct >= 45 && pct <= 55) deadlock += 1
    else contested += 1
  }

  const consensus_quality: ConsensusQuality = {
    supermajority,
    majority,
    contested,
    deadlock,
    total: topicsWithVotes.length,
  }

  // ── Activity bands ───────────────────────────────────────────────────────────

  const bands = [
    { label: 'Dormant', description: '0 votes', min_votes: 0, max_votes: 0 },
    { label: 'Occasional', description: '1–9 votes', min_votes: 1, max_votes: 9 },
    { label: 'Active', description: '10–99 votes', min_votes: 10, max_votes: 99 },
    { label: 'Engaged', description: '100–499 votes', min_votes: 100, max_votes: 499 },
    { label: 'Dedicated', description: '500+ votes', min_votes: 500, max_votes: null },
  ]

  const activity_bands: ActivityBand[] = bands.map(({ label, description, min_votes, max_votes }) => {
    const count = profiles.filter((p) => {
      const v = p.total_votes ?? 0
      if (max_votes === null) return v >= min_votes
      if (min_votes === 0 && max_votes === 0) return v === 0
      return v >= min_votes && v <= max_votes
    }).length
    return {
      label,
      description,
      count,
      pct: profiles.length > 0 ? Math.round((count / profiles.length) * 1000) / 10 : 0,
      min_votes,
      max_votes,
    }
  })

  // ── Platform ideology ─────────────────────────────────────────────────────────

  const topicsWithPct = topics.filter((t) => (t.total_votes ?? 0) >= 5)
  const totalWeightedPct = topicsWithPct.reduce(
    (s, t) => s + (t.blue_pct ?? 50) * (t.total_votes ?? 0),
    0
  )
  const totalWeightedVotes = topicsWithPct.reduce((s, t) => s + (t.total_votes ?? 0), 0)
  const overall_for_pct =
    totalWeightedVotes > 0
      ? Math.round((totalWeightedPct / totalWeightedVotes) * 10) / 10
      : 50

  let mostPro: string | null = null
  let mostAgainst: string | null = null
  let maxFor = -Infinity
  let minFor = Infinity
  for (const c of category_ideology) {
    if (c.total_votes < 10) continue
    if (c.avg_for_pct > maxFor) { maxFor = c.avg_for_pct; mostPro = c.category }
    if (c.avg_for_pct < minFor) { minFor = c.avg_for_pct; mostAgainst = c.category }
  }

  // Polarisation index: average absolute deviation from 50%
  const polarisation_index =
    topicsWithPct.length > 0
      ? Math.round(
          (topicsWithPct.reduce((s, t) => s + Math.abs((t.blue_pct ?? 50) - 50), 0) /
            topicsWithPct.length) *
            10
        ) / 10
      : 0

  const data: CensusData = {
    totals: {
      registered_citizens: profiles.length,
      total_votes_cast: totalVotesCast,
      active_topics: activeTopics,
      established_laws: laws.length,
      total_arguments: totalArguments,
      coalitions: coalitionCount,
    },
    role_distribution,
    category_ideology,
    consensus_quality,
    activity_bands,
    platform_ideology: {
      overall_for_pct,
      most_pro_category: mostPro,
      most_against_category: mostAgainst,
      polarisation_index,
    },
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
  })
}
