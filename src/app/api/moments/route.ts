import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MomentType =
  | 'law_established'
  | 'voting_open'
  | 'law_milestone'
  | 'vote_surge'
  | 'debate_ended'
  | 'near_law'

export interface Moment {
  id: string
  type: MomentType
  topic_id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  /** Extra context depending on type */
  context: {
    established_at?: string
    voting_ends_at?: string
    law_number?: number
    // For vote_surge: change in % over last 24h
    swing_pct?: number
    // For debate_ended
    debate_id?: string
    debate_outcome?: string
  }
  timestamp: string
}

export interface MomentsResponse {
  moments: Moment[]
  total: number
}

// ─── GET /api/moments ────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const cutoff14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

  const moments: Moment[] = []

  // ── 1. Recent laws (last 14 days) ─────────────────────────────────────────
  const { data: lawRows } = await supabase
    .from('laws')
    .select('id, topic_id, statement, category, blue_pct, total_votes, established_at')
    .eq('is_active', true)
    .gte('established_at', cutoff14d)
    .order('established_at', { ascending: false })
    .limit(8)

  if (lawRows) {
    // Assign ordinal law numbers by counting all established laws
    const { count: lawCount } = await supabase
      .from('laws')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    for (let i = 0; i < lawRows.length; i++) {
      const law = lawRows[i]
      moments.push({
        id: `law-${law.id}`,
        type: 'law_established',
        topic_id: law.topic_id,
        statement: law.statement,
        category: law.category,
        blue_pct: law.blue_pct,
        total_votes: law.total_votes,
        context: {
          established_at: law.established_at,
          law_number: (lawCount ?? 0) - i,
        },
        timestamp: law.established_at,
      })
    }
  }

  // ── 2. Topics currently in voting (recent 48h entry) ────────────────────
  const { data: votingRows } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, voting_ends_at, updated_at')
    .eq('status', 'voting')
    .gte('updated_at', cutoff48h)
    .order('total_votes', { ascending: false })
    .limit(6)

  if (votingRows) {
    for (const t of votingRows) {
      moments.push({
        id: `voting-${t.id}`,
        type: 'voting_open',
        topic_id: t.id,
        statement: t.statement,
        category: t.category,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        context: { voting_ends_at: t.voting_ends_at ?? undefined },
        timestamp: t.updated_at,
      })
    }
  }

  // ── 3. Topics close to becoming law (blue_pct >= 60%, active/voting) ────
  const { data: nearLawRows } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, updated_at')
    .in('status', ['active', 'voting'])
    .gte('blue_pct', 60)
    .gte('total_votes', 30)
    .order('blue_pct', { ascending: false })
    .limit(5)

  if (nearLawRows) {
    for (const t of nearLawRows) {
      // Skip if already in voting (covered above)
      if (moments.some((m) => m.topic_id === t.id)) continue
      moments.push({
        id: `near-law-${t.id}`,
        type: 'near_law',
        topic_id: t.id,
        statement: t.statement,
        category: t.category,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        context: {},
        timestamp: t.updated_at,
      })
    }
  }

  // ── 4. High-participation surges (topics with most votes in last 7 days) ─
  const { data: surgeRows } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, feed_score, updated_at')
    .in('status', ['active', 'voting'])
    .gte('updated_at', cutoff7d)
    .gte('total_votes', 50)
    .order('feed_score', { ascending: false })
    .limit(5)

  if (surgeRows) {
    for (const t of surgeRows) {
      if (moments.some((m) => m.topic_id === t.id)) continue
      moments.push({
        id: `surge-${t.id}`,
        type: 'vote_surge',
        topic_id: t.id,
        statement: t.statement,
        category: t.category,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        context: {},
        timestamp: t.updated_at,
      })
    }
  }

  // ── 5. Recently ended debates ─────────────────────────────────────────────
  const { data: debateRows } = await supabase
    .from('debates')
    .select('id, topic_id, ended_at')
    .eq('status', 'ended')
    .gte('ended_at', cutoff14d)
    .order('ended_at', { ascending: false })
    .limit(4)

  if (debateRows && debateRows.length > 0) {
    const topicIds = debateRows.map((d) => d.topic_id)
    const { data: debateTopics } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes')
      .in('id', topicIds)

    const topicMap = Object.fromEntries((debateTopics ?? []).map((t) => [t.id, t]))

    for (const debate of debateRows) {
      const t = topicMap[debate.topic_id]
      if (!t) continue
      if (moments.some((m) => m.id === `debate-${debate.id}`)) continue
      moments.push({
        id: `debate-${debate.id}`,
        type: 'debate_ended',
        topic_id: debate.topic_id,
        statement: t.statement,
        category: t.category,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
        context: { debate_id: debate.id },
        timestamp: debate.ended_at ?? now.toISOString(),
      })
    }
  }

  // ── Sort all moments by recency, deduplicate by topic ────────────────────
  const seen = new Set<string>()
  const deduped = moments
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .filter((m) => {
      // law_established gets priority over other types for the same topic
      const key = m.topic_id
      if (seen.has(key) && m.type !== 'law_established') return false
      seen.add(key)
      return true
    })
    .slice(0, 20)

  return NextResponse.json({
    moments: deduped,
    total: deduped.length,
  } satisfies MomentsResponse)
}
