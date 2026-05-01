import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface TopArgument {
  id: string
  content: string
  upvotes: number
}

export interface TopArgumentsResponse {
  forArg: TopArgument | null
  againstArg: TopArgument | null
}

// GET /api/topics/[id]/top-arguments
// Returns the single highest-upvoted FOR and AGAINST argument for a topic.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topic_arguments')
    .select('id, content, upvotes, side')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const args = data ?? []

  const forArg = args.find((a) => a.side === 'blue') ?? null
  const againstArg = args.find((a) => a.side === 'red') ?? null

  const response: TopArgumentsResponse = {
    forArg: forArg ? { id: forArg.id, content: forArg.content, upvotes: forArg.upvotes } : null,
    againstArg: againstArg ? { id: againstArg.id, content: againstArg.content, upvotes: againstArg.upvotes } : null,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}
