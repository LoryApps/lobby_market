import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContrarianArchetype =
  | 'lone_wolf'
  | 'devils_advocate'
  | 'selective_rebel'
  | 'principled_dissenter'
  | 'mainstream_voter'
  | 'true_believer'

export interface ContrarianTopic {
  topic_id: string
  statement: string
  category: string | null
  status: string
  user_vote: 'blue' | 'red'
  blue_pct: number
  total_votes: number
  gap: number
  voted_at: string
}

export interface ContrarianCategoryStat {
  category: string
  total: number
  contrarian: number
  contrarian_pct: number
  avg_gap: number
}

export interface ContrarianResponse {
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  total_voted: number
  contrarian_count: number
  contrarian_pct: number
  avg_gap: number
  archetype: ContrarianArchetype
  archetype_label: string
  archetype_description: string
  current_streak: number
  longest_streak: number
  top_contrarian: ContrarianTopic[]
  category_stats: ContrarianCategoryStat[]
  most_contrarian_category: string | null
  least_contrarian_category: string | null
  resolved_contrarian_wins: number
  resolved_contrarian_total: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isContrarian(userVote: 'blue' | 'red', bluePct: number): boolean {
  const userFor = userVote === 'blue'
  const majorityFor = bluePct > 50
  return userFor !== majorityFor && Math.abs(bluePct - 50) >= 5
}

function gapScore(userVote: 'blue' | 'red', bluePct: number): number {
  const userFor = userVote === 'blue'
  const agreePct = userFor ? bluePct : 100 - bluePct
  return Math.max(0, 50 - agreePct)
}

function classifyArchetype(
  contrarianPct: number,
  avgGap: number,
  categoryStats: ContrarianCategoryStat[]
): ContrarianArchetype {
  const activeCats = categoryStats.filter((c) => c.total >= 3)
  const highContrarianCats = activeCats.filter((c) => c.contrarian_pct >= 50).length
  const spreadAcrossCats = activeCats.length > 0
    ? highContrarianCats / activeCats.length
    : 0

  if (contrarianPct >= 60) return 'lone_wolf'
  if (contrarianPct >= 40 && avgGap >= 20) return 'principled_dissenter'
  if (contrarianPct >= 35 && spreadAcrossCats <= 0.3) return 'selective_rebel'
  if (contrarianPct >= 25) return 'devils_advocate'
  if (contrarianPct <= 10) return 'true_believer'
  return 'mainstream_voter'
}

const ARCHETYPE_META: Record<
  ContrarianArchetype,
  { label: string; description: string; color: string }
> = {
  lone_wolf: {
    label: 'The Lone Wolf',
    description: 'You consistently vote against community consensus across nearly all topics. You trust your own judgment, full stop.',
    color: 'text-against-400',
  },
  principled_dissenter: {
    label: 'The Principled Dissenter',
    description: 'When you break from the majority, you really mean it — your contrarian votes oppose strong consensus with conviction.',
    color: 'text-gold',
  },
  selective_rebel: {
    label: 'The Selective Rebel',
    description: 'You align with the mainstream on most topics but hold firm contrarian positions in specific categories you care deeply about.',
    color: 'text-purple',
  },
  devils_advocate: {
    label: 'The Devil\'s Advocate',
    description: 'You vote against the grain often enough to challenge groupthink, but not so often as to lose touch with community consensus.',
    color: 'text-for-300',
  },
  mainstream_voter: {
    label: 'The Mainstream Voter',
    description: 'You tend to align with community consensus. Your votes reflect the majority view more often than not.',
    color: 'text-emerald',
  },
  true_believer: {
    label: 'The True Believer',
    description: 'You vote in lockstep with the community consensus. Either you\'re shaping it — or it\'s shaping you.',
    color: 'text-for-400',
  },
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Fetch all user votes joined with topic data
  const { data: voteRows } = await supabase
    .from('votes')
    .select(
      `
      side,
      created_at,
      topics (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (!voteRows || voteRows.length === 0) {
    const archetype: ContrarianArchetype = 'mainstream_voter'
    return NextResponse.json({
      user: {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
      total_voted: 0,
      contrarian_count: 0,
      contrarian_pct: 0,
      avg_gap: 0,
      archetype,
      archetype_label: ARCHETYPE_META[archetype].label,
      archetype_description: ARCHETYPE_META[archetype].description,
      current_streak: 0,
      longest_streak: 0,
      top_contrarian: [],
      category_stats: [],
      most_contrarian_category: null,
      least_contrarian_category: null,
      resolved_contrarian_wins: 0,
      resolved_contrarian_total: 0,
    } satisfies ContrarianResponse)
  }

  // Build enriched vote list
  const votes: Array<{
    userVote: 'blue' | 'red'
    topic: { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }
    contrarian: boolean
    gap: number
    voted_at: string
  }> = []

  for (const row of voteRows) {
    const topic = row.topics as {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number | null
      total_votes: number
    } | null
    if (!topic || topic.blue_pct === null) continue

    const userVote = row.side as 'blue' | 'red'
    const bluePct = topic.blue_pct
    const contrarian = isContrarian(userVote, bluePct)
    const gap = gapScore(userVote, bluePct)

    votes.push({
      userVote,
      topic: { ...topic, blue_pct: bluePct },
      contrarian,
      gap,
      voted_at: row.created_at as string,
    })
  }

  const total = votes.length
  const contrarianVotes = votes.filter((v) => v.contrarian)
  const contrarianCount = contrarianVotes.length
  const contrarianPct = total > 0 ? Math.round((contrarianCount / total) * 100) : 0
  const avgGap = contrarianCount > 0
    ? Math.round(contrarianVotes.reduce((s, v) => s + v.gap, 0) / contrarianCount)
    : 0

  // ── Category breakdown ────────────────────────────────────────────────────
  const catMap = new Map<string, { total: number; contrarian: number; gaps: number[] }>()
  for (const v of votes) {
    const cat = v.topic.category ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, { total: 0, contrarian: 0, gaps: [] })
    const c = catMap.get(cat)!
    c.total++
    if (v.contrarian) {
      c.contrarian++
      c.gaps.push(v.gap)
    }
  }
  const categoryStats: ContrarianCategoryStat[] = Array.from(catMap.entries())
    .map(([category, c]) => ({
      category,
      total: c.total,
      contrarian: c.contrarian,
      contrarian_pct: c.total > 0 ? Math.round((c.contrarian / c.total) * 100) : 0,
      avg_gap: c.gaps.length > 0 ? Math.round(c.gaps.reduce((s, g) => s + g, 0) / c.gaps.length) : 0,
    }))
    .filter((c) => c.total >= 2)
    .sort((a, b) => b.contrarian_pct - a.contrarian_pct)

  // Most/least contrarian categories (min 3 votes to qualify)
  const qualifiedCats = categoryStats.filter((c) => c.total >= 3)
  const mostContrarianCategory = qualifiedCats.length > 0 ? qualifiedCats[0].category : null
  const leastContrarianCategory = qualifiedCats.length > 0
    ? qualifiedCats[qualifiedCats.length - 1].category
    : null

  // ── Streaks ───────────────────────────────────────────────────────────────
  // votes are ordered desc (newest first) — compute streak from most-recent
  let currentStreak = 0
  for (const v of votes) {
    if (v.contrarian) currentStreak++
    else break
  }
  let longestStreak = 0
  let runningStreak = 0
  for (const v of [...votes].reverse()) {
    if (v.contrarian) {
      runningStreak++
      longestStreak = Math.max(longestStreak, runningStreak)
    } else {
      runningStreak = 0
    }
  }

  // ── Top contrarian topics ──────────────────────────────────────────────────
  const topContrarian: ContrarianTopic[] = contrarianVotes
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 12)
    .map((v) => ({
      topic_id: v.topic.id,
      statement: v.topic.statement,
      category: v.topic.category,
      status: v.topic.status,
      user_vote: v.userVote,
      blue_pct: v.topic.blue_pct,
      total_votes: v.topic.total_votes,
      gap: v.gap,
      voted_at: v.voted_at,
    }))

  // ── Contrarian win rate (for resolved topics) ─────────────────────────────
  // "win" = user voted and their side ended up with majority (law or failed with correct prediction)
  const resolvedContrarian = contrarianVotes.filter(
    (v) => v.topic.status === 'law' || v.topic.status === 'failed'
  )
  const resolvedContrarianWins = resolvedContrarian.filter((v) => {
    if (v.topic.status === 'law') return v.userVote === 'blue'
    if (v.topic.status === 'failed') return v.userVote === 'red'
    return false
  }).length

  // ── Archetype ─────────────────────────────────────────────────────────────
  const archetype = classifyArchetype(contrarianPct, avgGap, categoryStats)

  return NextResponse.json({
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    },
    total_voted: total,
    contrarian_count: contrarianCount,
    contrarian_pct: contrarianPct,
    avg_gap: avgGap,
    archetype,
    archetype_label: ARCHETYPE_META[archetype].label,
    archetype_description: ARCHETYPE_META[archetype].description,
    current_streak: currentStreak,
    longest_streak: longestStreak,
    top_contrarian: topContrarian,
    category_stats: categoryStats,
    most_contrarian_category: mostContrarianCategory,
    least_contrarian_category: leastContrarianCategory,
    resolved_contrarian_wins: resolvedContrarianWins,
    resolved_contrarian_total: resolvedContrarian.length,
  } satisfies ContrarianResponse)
}
