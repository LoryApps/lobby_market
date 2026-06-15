import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type LegacyTier =
  | 'founder'        // top 1%
  | 'elder'          // top 5%
  | 'veteran'        // top 15%
  | 'established'    // top 35%
  | 'rising'         // everyone else

export interface LegacyLeaderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  // Raw components
  laws_coauthored: number
  law_quality_score: number       // weighted by blue_pct and total_votes
  argument_upvotes: number
  argument_longevity_score: number // upvotes × age_factor
  longest_streak: number
  days_since_joined: number
  // Composite
  legacy_score: number
  tier: LegacyTier
}

export interface LegacyMyStats {
  rank: number | null
  legacy_score: number
  laws_coauthored: number
  law_quality_score: number
  argument_longevity_score: number
  longest_streak: number
  tier: LegacyTier
  percentile: number | null
}

export interface LegacyLeaderboardResponse {
  entries: LegacyLeaderEntry[]
  total_citizens: number
  my_stats: LegacyMyStats | null
  generated_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTier(score: number, entries: { legacy_score: number }[]): LegacyTier {
  if (entries.length === 0) return 'rising'
  const sorted = [...entries].sort((a, b) => b.legacy_score - a.legacy_score)
  const idx = sorted.findIndex((e) => e.legacy_score <= score)
  const pct = idx === -1 ? 0 : idx / sorted.length
  if (pct < 0.01) return 'founder'
  if (pct < 0.05) return 'elder'
  if (pct < 0.15) return 'veteran'
  if (pct < 0.35) return 'established'
  return 'rising'
}

function legacyScore(
  lawQualityScore: number,
  argumentLongevityScore: number,
  longestStreak: number,
  daysSinceJoined: number,
): number {
  // Weighted composite:
  //   50% law quality (laws authored, weighted by margin and engagement)
  //   30% argument longevity (upvotes × age factor)
  //   20% tenure consistency (streak × tenure in years)
  const tenureYears = Math.max(daysSinceJoined / 365, 0.1)
  const tenureScore = Math.log10(longestStreak + 1) * tenureYears * 10

  const raw =
    lawQualityScore * 0.5 +
    argumentLongevityScore * 0.3 +
    tenureScore * 0.2

  return Math.round(Math.min(raw, 9999) * 10) / 10
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10),
    100,
  )

  // ── 1. Law quality per user ───────────────────────────────────────────────
  // Count how many laws each user voted FOR that became laws,
  // weighted by the decisiveness (blue_pct) and engagement (total_votes).
  const { data: lawVoteRows } = await supabase
    .from('votes')
    .select(`
      user_id,
      topic_id,
      topics!inner(status, blue_pct, total_votes)
    `)
    .eq('side', 'blue')
    .eq('topics.status', 'law')

  type LawVoteRow = {
    user_id: string
    topic_id: string
    topics: { status: string; blue_pct: number | null; total_votes: number | null } | null
  }

  const lawVoteCast = (lawVoteRows as unknown as LawVoteRow[] | null) ?? []

  const lawMap = new Map<
    string,
    { count: number; qualityScore: number }
  >()
  for (const row of lawVoteCast) {
    if (!row.user_id || !row.topics) continue
    const bluePct = row.topics.blue_pct ?? 50
    const totalVotes = row.topics.total_votes ?? 0
    // Quality weight: margin (how decisive) × log(engagement)
    const margin = Math.abs(bluePct - 50) / 50  // 0–1
    const engFactor = Math.log10(Math.max(totalVotes, 1) + 1)
    const quality = (margin * 0.7 + (1 - margin) * 0.3) * engFactor * 10

    const entry = lawMap.get(row.user_id) ?? { count: 0, qualityScore: 0 }
    entry.count += 1
    entry.qualityScore += quality
    lawMap.set(row.user_id, entry)
  }

  // ── 2. Argument longevity per user ────────────────────────────────────────
  // Upvotes on each argument, weighted by how old the argument is.
  // Older arguments still accumulating upvotes are worth more.
  const { data: argRows } = await supabase
    .from('arguments')
    .select('user_id, upvotes, created_at')

  type ArgRow = { user_id: string; upvotes: number | null; created_at: string }
  const args = (argRows as unknown as ArgRow[] | null) ?? []
  const now = Date.now()

  const argMap = new Map<string, { upvotes: number; longevity: number }>()
  for (const row of args) {
    if (!row.user_id) continue
    const upvotes = row.upvotes ?? 0
    const ageMonths = (now - new Date(row.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
    // Arguments older than 1 month that still have upvotes are valued more
    const ageFactor = Math.max(1, Math.log2(ageMonths + 1))
    const longevity = upvotes * ageFactor

    const entry = argMap.get(row.user_id) ?? { upvotes: 0, longevity: 0 }
    entry.upvotes += upvotes
    entry.longevity += longevity
    argMap.set(row.user_id, entry)
  }

  // ── 3. Profile data (streak, join date, role, etc.) ───────────────────────
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, vote_streak, created_at')
    .not('username', 'is', null)

  type ProfileRow = {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    vote_streak: number
    created_at: string
  }
  const profiles = (profileRows as unknown as ProfileRow[] | null) ?? []

  // ── 4. Compose entries ────────────────────────────────────────────────────
  const rawEntries: (Omit<LegacyLeaderEntry, 'rank' | 'tier'> & { legacy_score: number })[] = []

  for (const p of profiles) {
    if (!p.username) continue

    const daysSinceJoined = Math.max(
      (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24),
      1,
    )

    const lawData = lawMap.get(p.id) ?? { count: 0, qualityScore: 0 }
    const argData = argMap.get(p.id) ?? { upvotes: 0, longevity: 0 }

    const score = legacyScore(
      lawData.qualityScore,
      argData.longevity,
      p.vote_streak,
      daysSinceJoined,
    )

    // Only include citizens who have at least some legacy signal
    if (score < 0.1 && lawData.count === 0 && argData.upvotes === 0) continue

    rawEntries.push({
      user_id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role,
      clout: p.clout,
      laws_coauthored: lawData.count,
      law_quality_score: Math.round(lawData.qualityScore * 10) / 10,
      argument_upvotes: argData.upvotes,
      argument_longevity_score: Math.round(argData.longevity * 10) / 10,
      longest_streak: p.vote_streak,
      days_since_joined: Math.round(daysSinceJoined),
      legacy_score: score,
    })
  }

  // Sort descending by legacy_score
  rawEntries.sort((a, b) => b.legacy_score - a.legacy_score)

  // Assign tiers and ranks
  const allScores = rawEntries.map((e) => ({ legacy_score: e.legacy_score }))
  const entries: LegacyLeaderEntry[] = rawEntries
    .slice(0, limit)
    .map((e, i) => ({
      ...e,
      rank: i + 1,
      tier: getTier(e.legacy_score, allScores),
    }))

  // ── 5. My stats ───────────────────────────────────────────────────────────
  let myStats: LegacyMyStats | null = null
  if (user) {
    const myEntry = rawEntries.find((e) => e.user_id === user.id)
    if (myEntry) {
      const myRank = rawEntries.findIndex((e) => e.user_id === user.id)
      const percentile =
        rawEntries.length > 1
          ? Math.round((1 - myRank / rawEntries.length) * 100)
          : 100
      myStats = {
        rank: myRank + 1,
        legacy_score: myEntry.legacy_score,
        laws_coauthored: myEntry.laws_coauthored,
        law_quality_score: myEntry.law_quality_score,
        argument_longevity_score: myEntry.argument_longevity_score,
        longest_streak: myEntry.longest_streak,
        tier: getTier(myEntry.legacy_score, allScores),
        percentile,
      }
    } else {
      // User has no legacy signal yet
      myStats = {
        rank: null,
        legacy_score: 0,
        laws_coauthored: 0,
        law_quality_score: 0,
        argument_longevity_score: 0,
        longest_streak: 0,
        tier: 'rising',
        percentile: 0,
      }
    }
  }

  const response: LegacyLeaderboardResponse = {
    entries,
    total_citizens: rawEntries.length,
    my_stats: myStats,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
