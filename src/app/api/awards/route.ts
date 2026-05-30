import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5-minute cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AwardWinner {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  metric: number
  metric_label: string
  detail: string | null
}

export interface ArgumentAward {
  argument_id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  topic_id: string
  topic_statement: string
  topic_category: string | null
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
}

export interface AwardsResponse {
  period: string
  generated_at: string
  best_argument: ArgumentAward | null
  bridge_builder: AwardWinner | null   // most upvoted cross-side arguer
  top_voter: AwardWinner | null        // most votes cast in period
  top_lawmaker: AwardWinner | null     // most authored laws
  streak_champion: AwardWinner | null  // longest current streak
  rising_star: AwardWinner | null      // highest clout per vote (newcomers)
  top_debater: AwardWinner | null      // most argument upvotes received
}

type Period = 'week' | 'month' | 'all'

function periodStart(period: Period): string | null {
  const d = new Date()
  if (period === 'week') {
    d.setDate(d.getDate() - 7)
    return d.toISOString()
  }
  if (period === 'month') {
    d.setMonth(d.getMonth() - 1)
    return d.toISOString()
  }
  return null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawPeriod = searchParams.get('period') ?? 'week'
  const period: Period = rawPeriod === 'month' ? 'month' : rawPeriod === 'all' ? 'all' : 'week'
  const since = periodStart(period)

  const supabase = await createClient()

  // ── 1. Best argument in period ─────────────────────────────────────────────
  const argQuery = supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id, side, content, upvotes, created_at')
    .gt('upvotes', 0)
    .order('upvotes', { ascending: false })
    .limit(1)

  if (since) {
    argQuery.gte('created_at', since)
  }

  const { data: argRows } = await argQuery

  let bestArgument: ArgumentAward | null = null
  if (argRows && argRows.length > 0) {
    const row = argRows[0]
    // Fetch related topic and author
    const [{ data: argTopic }, { data: argAuthor }] = await Promise.all([
      supabase
        .from('topics')
        .select('statement, category')
        .eq('id', row.topic_id)
        .single(),
      supabase
        .from('profiles')
        .select('username, display_name, avatar_url, role')
        .eq('id', row.user_id)
        .single(),
    ])
    if (argTopic && argAuthor) {
      bestArgument = {
        argument_id: row.id,
        content: row.content,
        side: row.side as 'blue' | 'red',
        upvotes: row.upvotes,
        topic_id: row.topic_id,
        topic_statement: argTopic.statement,
        topic_category: argTopic.category,
        author_id: row.user_id,
        author_username: argAuthor.username,
        author_display_name: argAuthor.display_name,
        author_avatar_url: argAuthor.avatar_url,
        author_role: argAuthor.role,
      }
    }
  }

  // ── 2. Bridge Builder: most argument upvotes across BOTH sides ─────────────
  // Group total upvotes per user, penalise one-sided writers
  const bridgeQuery = supabase
    .from('topic_arguments')
    .select('user_id, side, upvotes')
    .gt('upvotes', 0)

  if (since) {
    bridgeQuery.gte('created_at', since)
  }

  const { data: bridgeRows } = await bridgeQuery

  let bridgeBuilder: AwardWinner | null = null
  if (bridgeRows && bridgeRows.length > 0) {
    type SideData = { blue: number; red: number; total: number }
    const byUser: Record<string, SideData> = {}
    for (const row of bridgeRows) {
      if (!byUser[row.user_id]) byUser[row.user_id] = { blue: 0, red: 0, total: 0 }
      if (row.side === 'blue') byUser[row.user_id].blue += row.upvotes
      else byUser[row.user_id].red += row.upvotes
      byUser[row.user_id].total += row.upvotes
    }
    // Bridge score = total upvotes * min(blue_pct, red_pct) * 2 — rewards balance
    const scored = Object.entries(byUser)
      .filter(([, d]) => d.blue > 0 && d.red > 0)
      .map(([uid, d]) => {
        const ratio = Math.min(d.blue, d.red) / Math.max(d.blue, d.red)
        return { uid, score: Math.round(d.total * ratio), total: d.total }
      })
      .sort((a, b) => b.score - a.score)

    if (scored.length > 0) {
      const best = scored[0]
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .eq('id', best.uid)
        .single()
      if (profile) {
        bridgeBuilder = {
          user_id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          role: profile.role,
          metric: best.score,
          metric_label: 'bridge score',
          detail: `${best.total} total upvotes across FOR and AGAINST arguments`,
        }
      }
    }
  }

  // ── 3. Top voter in period ─────────────────────────────────────────────────
  let topVoter: AwardWinner | null = null
  if (since) {
    const { data: voteRows } = await supabase
      .from('votes')
      .select('user_id')
      .gte('created_at', since)

    if (voteRows && voteRows.length > 0) {
      const counts: Record<string, number> = {}
      for (const v of voteRows) {
        counts[v.user_id] = (counts[v.user_id] ?? 0) + 1
      }
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
      if (sorted.length > 0) {
        const [uid, count] = sorted[0]
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .eq('id', uid)
          .single()
        if (profile) {
          topVoter = {
            user_id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            role: profile.role,
            metric: count,
            metric_label: 'votes cast',
            detail: null,
          }
        }
      }
    }
  } else {
    // All time: use profiles.total_votes
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, total_votes')
      .order('total_votes', { ascending: false })
      .limit(1)
    const p = profiles?.[0]
    if (p) {
      topVoter = {
        user_id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
        metric: p.total_votes,
        metric_label: 'votes cast',
        detail: null,
      }
    }
  }

  // ── 4. Top lawmaker ────────────────────────────────────────────────────────
  let topLawmaker: AwardWinner | null = null
  {
    const lawQuery = supabase
      .from('topics')
      .select('author_id')
      .eq('status', 'law')
    if (since) {
      lawQuery.gte('created_at', since)
    }
    const { data: lawRows } = await lawQuery
    if (lawRows && lawRows.length > 0) {
      const counts: Record<string, number> = {}
      for (const row of lawRows) {
        if (row.author_id) counts[row.author_id] = (counts[row.author_id] ?? 0) + 1
      }
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
      if (sorted.length > 0) {
        const [uid, count] = sorted[0]
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .eq('id', uid)
          .single()
        if (profile) {
          topLawmaker = {
            user_id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            role: profile.role,
            metric: count,
            metric_label: `law${count === 1 ? '' : 's'} authored`,
            detail: 'Topics proposed that reached community consensus',
          }
        }
      }
    }
  }

  // ── 5. Streak champion: longest current vote_streak ───────────────────────
  let streakChampion: AwardWinner | null = null
  {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, vote_streak')
      .gt('vote_streak', 0)
      .order('vote_streak', { ascending: false })
      .limit(1)
    const p = profiles?.[0]
    if (p) {
      streakChampion = {
        user_id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
        metric: p.vote_streak,
        metric_label: `day streak`,
        detail: 'Consecutive days with at least one vote cast',
      }
    }
  }

  // ── 6. Rising star: highest clout-to-votes ratio (min 10 votes, <500 total) ─
  let risingStar: AwardWinner | null = null
  {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes')
      .gte('total_votes', 10)
      .lt('total_votes', 500)
      .gt('reputation_score', 0)
      .order('reputation_score', { ascending: false })
      .limit(10)
    if (profiles && profiles.length > 0) {
      // Highest clout per vote
      const scored = profiles
        .map((p) => ({
          ...p,
          efficiency: p.reputation_score / Math.max(p.total_votes, 1),
        }))
        .sort((a, b) => b.efficiency - a.efficiency)
      const p = scored[0]
      risingStar = {
        user_id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
        metric: Math.round(p.reputation_score),
        metric_label: 'reputation',
        detail: `${p.total_votes} votes cast · strongest influence ratio`,
      }
    }
  }

  // ── 7. Top debater: most total argument upvotes received ──────────────────
  let topDebater: AwardWinner | null = null
  {
    const debaterQuery = supabase
      .from('topic_arguments')
      .select('user_id, upvotes')
      .gt('upvotes', 0)
    if (since) {
      debaterQuery.gte('created_at', since)
    }
    const { data: debaterRows } = await debaterQuery
    if (debaterRows && debaterRows.length > 0) {
      const totals: Record<string, number> = {}
      for (const row of debaterRows) {
        totals[row.user_id] = (totals[row.user_id] ?? 0) + row.upvotes
      }
      const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])
      if (sorted.length > 0) {
        const [uid, total] = sorted[0]
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .eq('id', uid)
          .single()
        if (profile) {
          topDebater = {
            user_id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            role: profile.role,
            metric: total,
            metric_label: 'argument upvotes',
            detail: 'Total upvotes received across all arguments',
          }
        }
      }
    }
  }

  const response: AwardsResponse = {
    period,
    generated_at: new Date().toISOString(),
    best_argument: bestArgument,
    bridge_builder: bridgeBuilder,
    top_voter: topVoter,
    top_lawmaker: topLawmaker,
    streak_champion: streakChampion,
    rising_star: risingStar,
    top_debater: topDebater,
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
