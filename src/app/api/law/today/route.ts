import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
// Revalidate every hour — the "law of the day" rotates daily but we allow
// the cache to serve for 60 minutes to avoid hammering the DB.
export const revalidate = 3600

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodayArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface TodayLawResponse {
  id: string
  topic_id: string
  statement: string
  full_statement: string
  body_markdown: string | null
  category: string | null
  established_at: string
  blue_pct: number
  total_votes: number
  // Derived from the parent topic
  scope: string
  description: string | null
  // Top arguments
  top_for: TodayArgument | null
  top_against: TodayArgument | null
  // Daily metadata
  day_index: number
  law_index: number
  total_laws: number
}

// ─── Deterministic daily picker ───────────────────────────────────────────────

/**
 * Returns a zero-based "day index" for the current UTC date since a fixed
 * epoch (2024-01-01). Used to pick the same law for every user on the same
 * calendar day regardless of when they load the page.
 */
function dayIndex(): number {
  const epoch = new Date('2024-01-01T00:00:00Z').getTime()
  const now = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  )
  return Math.floor((now - epoch) / 86_400_000)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Fetch all active laws ordered by total_votes desc so more-voted laws
    //    appear earlier (higher quality signal).
    const { data: laws, error: lawsError } = await supabase
      .from('laws')
      .select('id, topic_id, statement, full_statement, body_markdown, category, established_at, blue_pct, total_votes, is_active')
      .eq('is_active', true)
      .order('total_votes', { ascending: false })
      .order('established_at', { ascending: false })

    if (lawsError || !laws || laws.length === 0) {
      return NextResponse.json({ error: 'No laws found' }, { status: 404 })
    }

    // 2. Pick today's law deterministically.
    const idx = dayIndex()
    const lawIndex = idx % laws.length
    const law = laws[lawIndex]

    // 3. Fetch parent topic for scope/description.
    const { data: topic } = await supabase
      .from('topics')
      .select('scope, description')
      .eq('id', law.topic_id)
      .maybeSingle()

    // 4. Fetch top FOR and AGAINST arguments for this topic.
    const { data: args } = await supabase
      .from('topic_arguments')
      .select(`
        id,
        content,
        side,
        upvotes,
        created_at,
        author:profiles!topic_arguments_user_id_fkey(
          id, username, display_name, avatar_url, role
        )
      `)
      .eq('topic_id', law.topic_id)
      .order('upvotes', { ascending: false })
      .limit(20)

    const argList = (args ?? []) as Array<{
      id: string
      content: string
      side: 'blue' | 'red'
      upvotes: number
      created_at: string
      author: TodayArgument['author']
    }>

    const top_for = argList.find((a) => a.side === 'blue') ?? null
    const top_against = argList.find((a) => a.side === 'red') ?? null

    const result: TodayLawResponse = {
      id: law.id,
      topic_id: law.topic_id,
      statement: law.statement,
      full_statement: law.full_statement,
      body_markdown: law.body_markdown ?? null,
      category: law.category ?? null,
      established_at: law.established_at,
      blue_pct: law.blue_pct,
      total_votes: law.total_votes,
      scope: topic?.scope ?? 'Global',
      description: topic?.description ?? null,
      top_for,
      top_against,
      day_index: idx,
      law_index: lawIndex,
      total_laws: laws.length,
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/law/today]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
