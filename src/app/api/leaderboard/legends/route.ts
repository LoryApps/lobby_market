import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegendProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  reputation_score: number
  clout: number
  vote_streak: number
  total_votes: number
  created_at: string
}

export interface LegendEntry {
  category: LegendCategory
  title: string
  description: string
  stat_label: string
  stat_value: number | string
  color: string
  profile: LegendProfile
}

export type LegendCategory =
  | 'sage'
  | 'architect'
  | 'orator'
  | 'titan'
  | 'stalwart'
  | 'voter'
  | 'champion'

export interface LegendsResponse {
  legends: LegendEntry[]
  generated_at: string
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Run all queries in parallel for speed
  const [
    sageRes,
    titanRes,
    stalwartRes,
    voterRes,
    architectRes,
    oratorRes,
    championRes,
  ] = await Promise.all([
    // Sage: highest all-time reputation score
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, reputation_score, clout, vote_streak, total_votes, created_at')
      .order('reputation_score', { ascending: false })
      .gt('reputation_score', 0)
      .limit(1)
      .maybeSingle(),

    // Titan: most clout earned
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, reputation_score, clout, vote_streak, total_votes, created_at')
      .order('clout', { ascending: false })
      .gt('clout', 0)
      .limit(1)
      .maybeSingle(),

    // Stalwart: longest vote streak
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, reputation_score, clout, vote_streak, total_votes, created_at')
      .order('vote_streak', { ascending: false })
      .gt('vote_streak', 0)
      .limit(1)
      .maybeSingle(),

    // Voter: most votes ever cast
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, reputation_score, clout, vote_streak, total_votes, created_at')
      .order('total_votes', { ascending: false })
      .gt('total_votes', 0)
      .limit(1)
      .maybeSingle(),

    // Architect: most topics that became law (authored) — limited to avoid huge scan
    supabase
      .from('topics')
      .select('author_id')
      .eq('status', 'law')
      .not('author_id', 'is', null)
      .limit(2000),

    // Orator: most argument upvotes earned across all arguments
    supabase
      .from('topic_arguments')
      .select('author_id, upvotes')
      .gt('upvotes', 0)
      .limit(5000),

    // Champion: most debates participated in as a speaker
    supabase
      .from('debate_participants')
      .select('user_id')
      .eq('is_speaker', true)
      .limit(5000),
  ])

  // ── Architect: count laws per author ──────────────────────────────────────
  const lawCountByAuthor: Record<string, number> = {}
  for (const row of (architectRes.data ?? [])) {
    if (row.author_id) {
      lawCountByAuthor[row.author_id] = (lawCountByAuthor[row.author_id] ?? 0) + 1
    }
  }
  const architectEntry = Object.entries(lawCountByAuthor).sort((a, b) => b[1] - a[1])[0]
  const architectAuthorId = architectEntry?.[0]
  const architectLawCount = architectEntry?.[1] ?? 0

  // ── Orator: sum upvotes per author ────────────────────────────────────────
  const upvotesByAuthor: Record<string, number> = {}
  for (const row of (oratorRes.data ?? [])) {
    if (row.author_id) {
      upvotesByAuthor[row.author_id] = (upvotesByAuthor[row.author_id] ?? 0) + (row.upvotes ?? 0)
    }
  }
  const oratorEntry = Object.entries(upvotesByAuthor).sort((a, b) => b[1] - a[1])[0]
  const oratorAuthorId = oratorEntry?.[0]
  const oratorUpvoteTotal = oratorEntry?.[1] ?? 0

  // ── Champion: count debate appearances per speaker ────────────────────────
  const debatesByUser: Record<string, number> = {}
  for (const row of (championRes.data ?? [])) {
    if (row.user_id) {
      debatesByUser[row.user_id] = (debatesByUser[row.user_id] ?? 0) + 1
    }
  }
  const championEntry = Object.entries(debatesByUser).sort((a, b) => b[1] - a[1])[0]
  const championUserId = championEntry?.[0]
  const championDebateCount = championEntry?.[1] ?? 0

  // ── Fetch profiles for computed legends ───────────────────────────────────
  const computedIds = [architectAuthorId, oratorAuthorId, championUserId].filter(Boolean) as string[]
  const computedProfiles: Record<string, LegendProfile> = {}

  if (computedIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, reputation_score, clout, vote_streak, total_votes, created_at')
      .in('id', computedIds)
    for (const p of profiles ?? []) {
      computedProfiles[p.id] = p as LegendProfile
    }
  }

  // ── Assemble legend entries ───────────────────────────────────────────────
  const legends: LegendEntry[] = []

  if (sageRes.data) {
    legends.push({
      category: 'sage',
      title: 'The Sage',
      description: 'Highest all-time reputation — the most respected voice in the Lobby',
      stat_label: 'Reputation',
      stat_value: Math.round(sageRes.data.reputation_score),
      color: 'purple',
      profile: sageRes.data as LegendProfile,
    })
  }

  if (titanRes.data) {
    legends.push({
      category: 'titan',
      title: 'The Titan',
      description: 'Most clout ever accumulated — the economic powerhouse of the Lobby',
      stat_label: 'Clout',
      stat_value: Math.round(titanRes.data.clout),
      color: 'gold',
      profile: titanRes.data as LegendProfile,
    })
  }

  if (architectAuthorId && computedProfiles[architectAuthorId] && architectLawCount > 0) {
    legends.push({
      category: 'architect',
      title: 'The Architect',
      description: "Most topics proposed that became law — built the Lobby's legal foundation",
      stat_label: 'Laws authored',
      stat_value: architectLawCount,
      color: 'law',
      profile: computedProfiles[architectAuthorId],
    })
  }

  if (oratorAuthorId && computedProfiles[oratorAuthorId] && oratorUpvoteTotal > 0) {
    legends.push({
      category: 'orator',
      title: 'The Orator',
      description: 'Most argument upvotes ever earned — the voice that moved the most minds',
      stat_label: 'Total upvotes',
      stat_value: oratorUpvoteTotal,
      color: 'for',
      profile: computedProfiles[oratorAuthorId],
    })
  }

  if (stalwartRes.data) {
    legends.push({
      category: 'stalwart',
      title: 'The Stalwart',
      description: 'Longest consecutive voting streak — the most loyal civic servant',
      stat_label: 'Day streak',
      stat_value: stalwartRes.data.vote_streak,
      color: 'emerald',
      profile: stalwartRes.data as LegendProfile,
    })
  }

  if (voterRes.data) {
    legends.push({
      category: 'voter',
      title: 'The Voter',
      description: 'Most total votes ever cast — the engine of democratic participation',
      stat_label: 'Votes cast',
      stat_value: voterRes.data.total_votes,
      color: 'blue',
      profile: voterRes.data as LegendProfile,
    })
  }

  if (championUserId && computedProfiles[championUserId] && championDebateCount > 0) {
    legends.push({
      category: 'champion',
      title: 'The Champion',
      description: 'Most live debate appearances as a speaker — the arena veteran',
      stat_label: 'Debates entered',
      stat_value: championDebateCount,
      color: 'against',
      profile: computedProfiles[championUserId],
    })
  }

  return NextResponse.json({
    legends,
    generated_at: new Date().toISOString(),
  } satisfies LegendsResponse)
}
