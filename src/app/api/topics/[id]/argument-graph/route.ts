import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ArgumentGraphNode {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  reply_count: number
  source_url: string | null
  author_username: string | null
  author_display_name: string | null
  created_at: string
}

export interface ArgumentGraphTopic {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  status: string
}

export interface ArgumentGraphResponse {
  nodes: ArgumentGraphNode[]
  topic: ArgumentGraphTopic | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid topic ID' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    // Fetch topic metadata
    const { data: topic } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, status')
      .eq('id', id)
      .maybeSingle()

    // Fetch arguments with author info
    const { data: argsRaw } = await supabase
      .from('topic_arguments')
      .select(
        `id, side, content, upvotes, created_at,
         profiles!topic_arguments_user_id_fkey (username, display_name)`,
      )
      .eq('topic_id', id)
      .order('upvotes', { ascending: false })
      .limit(150)

    // Aggregate reply counts per argument
    const { data: replyRows } = await supabase
      .from('argument_replies')
      .select('argument_id')
      .eq('topic_id', id)

    const replyCountMap: Record<string, number> = {}
    for (const r of replyRows ?? []) {
      replyCountMap[r.argument_id] = (replyCountMap[r.argument_id] ?? 0) + 1
    }

    const nodes: ArgumentGraphNode[] = (argsRaw ?? []).map((a) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = a as any
      return {
        id: raw.id as string,
        side: raw.side as 'blue' | 'red',
        content: raw.content as string,
        upvotes: (raw.upvotes as number) ?? 0,
        reply_count: replyCountMap[raw.id as string] ?? 0,
        source_url: (raw.source_url as string | null) ?? null,
        author_username: raw.profiles?.username ?? null,
        author_display_name: raw.profiles?.display_name ?? null,
        created_at: raw.created_at as string,
      }
    })

    const response: ArgumentGraphResponse = {
      nodes,
      topic: topic as ArgumentGraphTopic | null,
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
