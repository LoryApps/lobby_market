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
  forArgs: TopArgument[]
  againstArgs: TopArgument[]
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

  const toTopArg = (a: { id: string; content: string; upvotes: number }): TopArgument => ({
    id: a.id,
    content: a.content,
    upvotes: a.upvotes,
  })

  const forArgs = args.filter((a) => a.side === 'blue').slice(0, 3).map(toTopArg)
  const againstArgs = args.filter((a) => a.side === 'red').slice(0, 3).map(toTopArg)

  const response: TopArgumentsResponse = {
    forArg: forArgs[0] ?? null,
    againstArg: againstArgs[0] ?? null,
    forArgs,
    againstArgs,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}
