import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SteelmanArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  source_url: string | null
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }
  tag: 'champion' | 'quality' | 'expert' | 'cited' | 'recent'
}

export interface SteelmanSide {
  champion: SteelmanArgument | null   // highest upvotes
  quality: SteelmanArgument | null    // highest ai_score
  expert: SteelmanArgument | null     // from highest-role user
  cited: SteelmanArgument | null      // has source_url + high upvotes
  recent: SteelmanArgument | null     // most recent high-quality
  total: number
  avg_score: number | null
  top_upvotes: number
}

export interface SteelmanMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  blue_votes: number
  red_votes: number
  total_votes: number
}

export interface SteelmanResponse {
  market: SteelmanMarket
  for: SteelmanSide
  against: SteelmanSide
  has_data: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_RANK: Record<string, number> = {
  elder: 4,
  troll_catcher: 3,
  debator: 2,
  person: 1,
}

function rankRole(role: string): number {
  return ROLE_RANK[role] ?? 0
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params

  const supabase = await createClient()

  // ── 1. Market ─────────────────────────────────────────────────────────────
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, blue_votes, red_votes, total_votes')
    .eq('id', id)
    .maybeSingle()

  if (!topic) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 })
  }

  // ── 2. Arguments with author clout ────────────────────────────────────────
  const { data: rows } = await supabase
    .from('topic_arguments')
    .select(`
      id, side, content, upvotes, ai_score, ai_grade, source_url, created_at,
      profiles:user_id (username, display_name, avatar_url, role, clout)
    `)
    .eq('topic_id', id)
    .order('upvotes', { ascending: false })
    .limit(100)

  const all = (rows ?? []).map((r) => {
    const p = (r as Record<string, unknown>).profiles as {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
    } | null
    return {
      id: r.id as string,
      content: r.content as string,
      side: r.side as 'blue' | 'red',
      upvotes: r.upvotes as number,
      ai_score: r.ai_score as number | null,
      ai_grade: r.ai_grade as string | null,
      source_url: r.source_url as string | null,
      created_at: r.created_at as string,
      author: {
        username: p?.username ?? 'anon',
        display_name: p?.display_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        role: p?.role ?? 'person',
        clout: p?.clout ?? 0,
      },
    }
  })

  const forArgs   = all.filter((a) => a.side === 'blue')
  const againstArgs = all.filter((a) => a.side === 'red')

  function buildSide(args: typeof all): SteelmanSide {
    if (args.length === 0) {
      return {
        champion: null, quality: null, expert: null, cited: null, recent: null,
        total: 0, avg_score: null, top_upvotes: 0,
      }
    }

    const sortedByUpvotes = [...args].sort((a, b) => b.upvotes - a.upvotes)
    const sortedByScore   = [...args].filter((a) => a.ai_score != null).sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))
    const sortedByRole    = [...args].sort((a, b) => rankRole(b.author.role) - rankRole(a.author.role) || b.upvotes - a.upvotes)
    const sortedByCited   = [...args].filter((a) => a.source_url != null).sort((a, b) => b.upvotes - a.upvotes)
    const sortedByRecent  = [...args].filter((a) => (a.ai_score ?? 0) >= 60 || a.upvotes >= 3).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const seen = new Set<string>()

    function pick(sorted: typeof args, tag: SteelmanArgument['tag']): SteelmanArgument | null {
      const arg = sorted.find((a) => !seen.has(a.id))
      if (!arg) return null
      seen.add(arg.id)
      return { ...arg, tag }
    }

    const champion = pick(sortedByUpvotes, 'champion')
    const quality  = pick(sortedByScore,   'quality')
    const expert   = pick(sortedByRole,    'expert')
    const cited    = pick(sortedByCited,   'cited')
    const recent   = pick(sortedByRecent,  'recent')

    const scored = args.filter((a) => a.ai_score != null)
    const avg_score = scored.length > 0
      ? Math.round((scored.reduce((s, a) => s + (a.ai_score ?? 0), 0) / scored.length) * 10) / 10
      : null

    return {
      champion,
      quality,
      expert,
      cited,
      recent,
      total: args.length,
      avg_score,
      top_upvotes: sortedByUpvotes[0]?.upvotes ?? 0,
    }
  }

  const forSide     = buildSide(forArgs)
  const againstSide = buildSide(againstArgs)

  const has_data = forSide.total > 0 || againstSide.total > 0

  const response: SteelmanResponse = {
    market: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category ?? null,
      status: topic.status,
      price: Math.round(topic.blue_pct ?? 50),
      blue_votes: topic.blue_votes ?? 0,
      red_votes: topic.red_votes ?? 0,
      total_votes: topic.total_votes ?? 0,
    },
    for: forSide,
    against: againstSide,
    has_data,
  }

  return NextResponse.json(response)
}
