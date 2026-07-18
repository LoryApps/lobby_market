import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MarketIdea, IdeaAuthor } from '@/app/api/exchange/ideas/route'

export const dynamic = 'force-dynamic'

export interface IdeaDetailResponse {
  idea: MarketIdea & {
    author_ideas_count: number
    author_avg_score: number
  }
  related_topic_ideas: MarketIdea[]
  related_author_ideas: MarketIdea[]
}

function shapeIdea(
  raw: Record<string, unknown>,
  viewerVote: 'up' | 'down' | null,
): MarketIdea {
  const author = Array.isArray(raw.author) ? raw.author[0] : raw.author
  const topic  = Array.isArray(raw.topic)  ? raw.topic[0]  : raw.topic
  return {
    id:           raw.id as string,
    user_id:      raw.user_id as string,
    topic_id:     raw.topic_id as string | null,
    title:        raw.title as string,
    body:         raw.body as string,
    direction:    raw.direction as 'for' | 'against' | 'neutral',
    target_price: raw.target_price as number | null,
    confidence:   raw.confidence as number,
    upvotes:      raw.upvotes as number,
    downvotes:    raw.downvotes as number,
    is_featured:  raw.is_featured as boolean,
    created_at:   raw.created_at as string,
    score:        ((raw.upvotes as number) ?? 0) - ((raw.downvotes as number) ?? 0),
    author:       author as IdeaAuthor,
    topic:        (topic as MarketIdea['topic']) ?? null,
    viewer_vote:  viewerVote,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // ── Fetch the idea ─────────────────────────────────────────────────────
    const { data: raw, error } = await supabase
      .from('market_ideas')
      .select(`
        id, user_id, topic_id, title, body, direction,
        target_price, confidence, upvotes, downvotes, is_featured, created_at,
        author:profiles!user_id(
          id, username, display_name, avatar_url, role, clout
        ),
        topic:topics(
          id, statement, category, status, blue_pct
        )
      `)
      .eq('id', params.id)
      .maybeSingle()

    if (error) throw error
    if (!raw) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // ── Viewer vote for this idea ──────────────────────────────────────────
    let viewerVote: 'up' | 'down' | null = null
    if (user) {
      const { data: vRow } = await supabase
        .from('market_idea_votes')
        .select('direction')
        .eq('user_id', user.id)
        .eq('idea_id', params.id)
        .maybeSingle()
      viewerVote = (vRow?.direction as 'up' | 'down') ?? null
    }

    const idea = shapeIdea(raw as Record<string, unknown>, viewerVote)

    // ── Author's aggregate stats ───────────────────────────────────────────
    const { data: authorStats } = await supabase
      .from('market_ideas')
      .select('id, upvotes, downvotes')
      .eq('user_id', raw.user_id)

    const authorIdeasCount = authorStats?.length ?? 0
    const authorTotalScore = (authorStats ?? []).reduce(
      (sum, r) => sum + (r.upvotes ?? 0) - (r.downvotes ?? 0),
      0,
    )
    const authorAvgScore = authorIdeasCount > 0
      ? Math.round(authorTotalScore / authorIdeasCount)
      : 0

    // ── Related: same topic, different idea ───────────────────────────────
    let relatedTopicIdeas: MarketIdea[] = []
    if (raw.topic_id) {
      const { data: topicRaw } = await supabase
        .from('market_ideas')
        .select(`
          id, user_id, topic_id, title, body, direction,
          target_price, confidence, upvotes, downvotes, is_featured, created_at,
          author:profiles!user_id(
            id, username, display_name, avatar_url, role, clout
          ),
          topic:topics(
            id, statement, category, status, blue_pct
          )
        `)
        .eq('topic_id', raw.topic_id)
        .neq('id', params.id)
        .order('upvotes', { ascending: false })
        .limit(4)

      // Fetch viewer votes for related
      const topicIdeaIds = (topicRaw ?? []).map((r) => r.id)
      const topicVotes: Record<string, 'up' | 'down'> = {}
      if (user && topicIdeaIds.length > 0) {
        const { data: tv } = await supabase
          .from('market_idea_votes')
          .select('idea_id, direction')
          .eq('user_id', user.id)
          .in('idea_id', topicIdeaIds)
        for (const v of tv ?? []) topicVotes[v.idea_id] = v.direction as 'up' | 'down'
      }

      relatedTopicIdeas = (topicRaw ?? []).map((r) =>
        shapeIdea(r as Record<string, unknown>, topicVotes[r.id] ?? null),
      )
    }

    // ── Related: same author, different idea ─────────────────────────────
    const { data: authorRaw } = await supabase
      .from('market_ideas')
      .select(`
        id, user_id, topic_id, title, body, direction,
        target_price, confidence, upvotes, downvotes, is_featured, created_at,
        author:profiles!user_id(
          id, username, display_name, avatar_url, role, clout
        ),
        topic:topics(
          id, statement, category, status, blue_pct
        )
      `)
      .eq('user_id', raw.user_id)
      .neq('id', params.id)
      .order('upvotes', { ascending: false })
      .limit(3)

    const authorIdeaIds = (authorRaw ?? []).map((r) => r.id)
    const authorVotes: Record<string, 'up' | 'down'> = {}
    if (user && authorIdeaIds.length > 0) {
      const { data: av } = await supabase
        .from('market_idea_votes')
        .select('idea_id, direction')
        .eq('user_id', user.id)
        .in('idea_id', authorIdeaIds)
      for (const v of av ?? []) authorVotes[v.idea_id] = v.direction as 'up' | 'down'
    }

    const relatedAuthorIdeas = (authorRaw ?? []).map((r) =>
      shapeIdea(r as Record<string, unknown>, authorVotes[r.id] ?? null),
    )

    return NextResponse.json({
      idea: {
        ...idea,
        author_ideas_count: authorIdeasCount,
        author_avg_score: authorAvgScore,
      },
      related_topic_ideas: relatedTopicIdeas,
      related_author_ideas: relatedAuthorIdeas,
    } satisfies IdeaDetailResponse)
  } catch (err) {
    console.error('[exchange/ideas/[id] GET]', err)
    return NextResponse.json({ error: 'Failed to load idea' }, { status: 500 })
  }
}
