import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface TopicLinkEntry {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  description: string | null
}

export interface TopicBacklinksResponse {
  /** Topics whose descriptions link TO this topic (backlinks / "cited by") */
  cited_by: TopicLinkEntry[]
  /** Topics that this topic's description links TO (outgoing links / "cites") */
  cites: TopicLinkEntry[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const topicId = params.id

  const [incomingRes, outgoingRes] = await Promise.all([
    // Backlinks: other topics that link TO this topic
    supabase
      .from('topic_links')
      .select('source_topic_id')
      .eq('target_topic_id', topicId)
      .limit(20),

    // Outgoing: topics this topic links TO
    supabase
      .from('topic_links')
      .select('target_topic_id')
      .eq('source_topic_id', topicId)
      .limit(20),
  ])

  const incomingIds = (incomingRes.data ?? []).map((r) => r.source_topic_id)
  const outgoingIds = (outgoingRes.data ?? []).map((r) => r.target_topic_id)

  // Fetch topic details for both sets in parallel
  const [citedByRes, citesRes] = await Promise.all([
    incomingIds.length
      ? supabase
          .from('topics')
          .select('id, statement, category, status, blue_pct, total_votes, description')
          .in('id', incomingIds)
      : Promise.resolve({ data: [] }),

    outgoingIds.length
      ? supabase
          .from('topics')
          .select('id, statement, category, status, blue_pct, total_votes, description')
          .in('id', outgoingIds)
      : Promise.resolve({ data: [] }),
  ])

  return NextResponse.json({
    cited_by: (citedByRes.data ?? []) as TopicLinkEntry[],
    cites: (citesRes.data ?? []) as TopicLinkEntry[],
  } satisfies TopicBacklinksResponse)
}
