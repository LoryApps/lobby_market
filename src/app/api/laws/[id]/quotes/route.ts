import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DebateQuote {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_grade: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface QuotesResponse {
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
    blue_pct: number
    total_votes: number
  }
  topic_id: string | null
  quotes: DebateQuote[]
  stats: {
    total: number
    for_count: number
    against_count: number
  }
}

// ─── GET /api/laws/[id]/quotes ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // 1. Fetch the law
  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, total_votes, blue_pct, topic_id')
    .eq('id', params.id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  const topicId = law.topic_id ?? null

  // 2. Fetch top arguments from the source topic
  const quotes: DebateQuote[] = []
  let totalFor = 0
  let totalAgainst = 0

  if (topicId) {
    const { data: argsData } = await supabase
      .from('topic_arguments')
      .select(`
        id,
        content,
        side,
        upvotes,
        ai_grade,
        created_at,
        profiles:user_id (
          id,
          username,
          display_name,
          avatar_url,
          role
        )
      `)
      .eq('topic_id', topicId)
      .order('upvotes', { ascending: false })
      .limit(60)

    if (argsData) {
      for (const arg of argsData) {
        const profile = Array.isArray(arg.profiles)
          ? (arg.profiles[0] ?? null)
          : (arg.profiles ?? null)

        const side = arg.side as 'blue' | 'red'
        if (side === 'blue') totalFor++
        else totalAgainst++

        quotes.push({
          id: arg.id,
          content: arg.content,
          side,
          upvotes: arg.upvotes ?? 0,
          ai_grade: (arg as { ai_grade?: string | null }).ai_grade ?? null,
          created_at: arg.created_at,
          author: profile
            ? {
                id: (profile as { id: string }).id,
                username: (profile as { username: string }).username,
                display_name: (profile as { display_name?: string | null }).display_name ?? null,
                avatar_url: (profile as { avatar_url?: string | null }).avatar_url ?? null,
                role: (profile as { role?: string }).role ?? 'person',
              }
            : null,
        })
      }
    }
  }

  // Take top 30 interleaved (15 for, 15 against), sorted by upvotes
  const forQuotes = quotes.filter((q) => q.side === 'blue').slice(0, 15)
  const againstQuotes = quotes.filter((q) => q.side === 'red').slice(0, 15)

  // Interleave for and against for a balanced view
  const interleaved: DebateQuote[] = []
  const maxLen = Math.max(forQuotes.length, againstQuotes.length)
  for (let i = 0; i < maxLen; i++) {
    if (forQuotes[i]) interleaved.push(forQuotes[i])
    if (againstQuotes[i]) interleaved.push(againstQuotes[i])
  }

  const response: QuotesResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category ?? null,
      established_at: law.established_at ?? new Date().toISOString(),
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
    },
    topic_id: topicId,
    quotes: interleaved,
    stats: {
      total: quotes.length,
      for_count: totalFor,
      against_count: totalAgainst,
    },
  }

  return NextResponse.json(response)
}
