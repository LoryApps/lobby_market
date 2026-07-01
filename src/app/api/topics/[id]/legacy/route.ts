import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // 1 hour — resolved topics change rarely

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LegacyArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface CoalitionRecord {
  id: string
  name: string
  stance: 'for' | 'against' | 'neutral'
  member_count: number
  coalition_influence: number
  aligned_with_outcome: boolean
  statement: string | null
}

export interface CitingTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
}

export interface LegacyData {
  topic: {
    id: string
    statement: string
    category: string | null
    status: 'law' | 'failed'
    blue_pct: number
    blue_votes: number
    red_votes: number
    total_votes: number
    total_arguments: number
    view_count: number
    created_at: string
    established_at: string | null
  }
  // Participation percentile: how does this debate rank among all resolved?
  participation_rank: {
    percentile: number // 0–100, higher = more votes than this % of debates
    total_resolved: number
    rank_position: number
  }
  // Coalition involvement and victory/defeat
  coalitions: CoalitionRecord[]
  winning_side_coalitions: number
  losing_side_coalitions: number
  // Memorial arguments — preserved as civic artifacts
  memorial_for_arg: LegacyArgument | null
  memorial_against_arg: LegacyArgument | null
  // Topics that cite this one (wiki/link backlinks)
  citing_topics: CitingTopic[]
  total_citations: number
  // Topics that continue from this one
  continuation_topics: CitingTopic[]
  total_continuations: number
  // Historic context
  platform_law_rate: number // % of all resolved topics that became law
  category_law_rate: number | null // % of resolved in this category that became law
  // How long it took to resolve
  debate_days: number
  // Combined influence: votes × citation_weight
  legacy_score: number
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  try {
    // ── 1. Fetch the topic ──────────────────────────────────────────────────
    const { data: topic, error: topicErr } = await supabase
      .from('topics')
      .select(
        'id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes, view_count, created_at, voting_ends_at'
      )
      .eq('id', params.id)
      .single()

    if (topicErr || !topic) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    if (topic.status !== 'law' && topic.status !== 'failed') {
      return NextResponse.json({ error: 'not_resolved' }, { status: 422 })
    }

    // ── 2. Total arguments ─────────────────────────────────────────────────
    const { count: totalArguments } = await supabase
      .from('arguments')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', params.id)

    // ── 3. Participation rank ───────────────────────────────────────────────
    const { data: resolvedTopics } = await supabase
      .from('topics')
      .select('id, total_votes')
      .in('status', ['law', 'failed'])

    const resolved = resolvedTopics ?? []
    const thisPct = topic.blue_pct ?? 50
    const thisVotes = topic.total_votes ?? 0

    const sortedByVotes = [...resolved].sort(
      (a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0)
    )
    const rankPos = sortedByVotes.findIndex((t) => t.id === params.id) + 1
    const percentile =
      resolved.length > 1
        ? Math.round(((resolved.length - rankPos) / (resolved.length - 1)) * 100)
        : 50

    // ── 4. Coalition involvement ────────────────────────────────────────────
    const { data: stanceRows } = await supabase
      .from('coalition_stances')
      .select(
        'id, coalition_id, stance, statement, coalitions(id, name, member_count, coalition_influence)'
      )
      .eq('topic_id', params.id)
      .limit(10)

    const wonByFor = topic.status === 'law'
    const coalitions: CoalitionRecord[] = (stanceRows ?? []).map((s) => {
      const c = s.coalitions as { id: string; name: string; member_count: number; coalition_influence: number } | null
      const alignedWithOutcome =
        (s.stance === 'for' && wonByFor) ||
        (s.stance === 'against' && !wonByFor)
      return {
        id: c?.id ?? s.coalition_id,
        name: c?.name ?? 'Unknown Coalition',
        stance: s.stance,
        member_count: c?.member_count ?? 0,
        coalition_influence: c?.coalition_influence ?? 0,
        aligned_with_outcome: alignedWithOutcome,
        statement: s.statement,
      }
    })

    const winningCoalitions = coalitions.filter((c) => c.aligned_with_outcome).length
    const losingCoalitions = coalitions.filter((c) => !c.aligned_with_outcome).length

    // ── 5. Memorial arguments ───────────────────────────────────────────────
    const { data: argRows } = await supabase
      .from('arguments')
      .select('id, content, side, upvote_count, created_at, profiles(username, display_name, avatar_url)')
      .eq('topic_id', params.id)
      .order('upvote_count', { ascending: false })
      .limit(20)

    type ArgRow = {
      id: string
      content: string
      side: string
      upvote_count: number
      created_at: string
      profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null
    }

    function mapArg(row: ArgRow): LegacyArgument {
      return {
        id: row.id,
        content: row.content,
        side: row.side as 'blue' | 'red',
        upvotes: row.upvote_count,
        created_at: row.created_at,
        author_username: row.profiles?.username ?? null,
        author_display_name: row.profiles?.display_name ?? null,
        author_avatar_url: row.profiles?.avatar_url ?? null,
      }
    }

    const forArgs = (argRows ?? []).filter((r) => r.side === 'blue')
    const againstArgs = (argRows ?? []).filter((r) => r.side === 'red')
    const memorialFor = forArgs.length > 0 ? mapArg(forArgs[0] as ArgRow) : null
    const memorialAgainst = againstArgs.length > 0 ? mapArg(againstArgs[0] as ArgRow) : null

    // ── 6. Topics that cite this one ────────────────────────────────────────
    const { data: citingLinks } = await supabase
      .from('topic_links')
      .select('source_topic_id')
      .eq('target_topic_id', params.id)
      .limit(20)

    const citingIds = (citingLinks ?? []).map((l) => l.source_topic_id)
    let citingTopics: CitingTopic[] = []

    if (citingIds.length > 0) {
      const { data: citingRows } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct')
        .in('id', citingIds)
        .limit(6)

      citingTopics = (citingRows ?? []).map((t) => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
      }))
    }

    // ── 7. Continuation topics (topics that follow from this one) ──────────
    const { data: continuationRows } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct')
      .contains('chain_topic_ids', [params.id])
      .limit(6)

    const continuationTopics: CitingTopic[] = (continuationRows ?? []).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
    }))

    // ── 8. Platform & category law rates ───────────────────────────────────
    // Re-fetch status for platform law rate (we need status field)
    const { data: statusRows } = await supabase
      .from('topics')
      .select('status, category')
      .in('status', ['law', 'failed'])
      .limit(500)

    const lawCount = (statusRows ?? []).filter((r) => r.status === 'law').length
    const platformLawRate =
      statusRows && statusRows.length > 0
        ? Math.round((lawCount / statusRows.length) * 100)
        : 50

    let categoryLawRate: number | null = null
    if (topic.category) {
      const catRows = (statusRows ?? []).filter((r) => r.category === topic.category)
      const catLaws = catRows.filter((r) => r.status === 'law').length
      if (catRows.length > 0) {
        categoryLawRate = Math.round((catLaws / catRows.length) * 100)
      }
    }

    // ── 9. Debate duration ─────────────────────────────────────────────────
    const createdAt = new Date(topic.created_at)
    const resolvedAt = topic.voting_ends_at
      ? new Date(topic.voting_ends_at)
      : new Date()
    const debateDays = Math.max(
      1,
      Math.round((resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    )

    // ── 10. Legacy score ───────────────────────────────────────────────────
    const citationWeight = 50
    const legacyScore = Math.round(
      (thisVotes * 1) +
      (citingIds.length * citationWeight) +
      (coalitions.length * 10) +
      ((totalArguments ?? 0) * 2)
    )

    const response: LegacyData = {
      topic: {
        id: topic.id,
        statement: topic.statement,
        category: topic.category,
        status: topic.status as 'law' | 'failed',
        blue_pct: thisPct,
        blue_votes: topic.blue_votes ?? 0,
        red_votes: topic.red_votes ?? 0,
        total_votes: thisVotes,
        total_arguments: totalArguments ?? 0,
        view_count: topic.view_count ?? 0,
        created_at: topic.created_at,
        established_at: topic.voting_ends_at,
      },
      participation_rank: {
        percentile,
        total_resolved: resolved.length,
        rank_position: rankPos,
      },
      coalitions,
      winning_side_coalitions: winningCoalitions,
      losing_side_coalitions: losingCoalitions,
      memorial_for_arg: memorialFor,
      memorial_against_arg: memorialAgainst,
      citing_topics: citingTopics,
      total_citations: citingIds.length,
      continuation_topics: continuationTopics,
      total_continuations: continuationTopics.length,
      platform_law_rate: platformLawRate,
      category_law_rate: categoryLawRate,
      debate_days: debateDays,
      legacy_score: legacyScore,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[legacy]', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
