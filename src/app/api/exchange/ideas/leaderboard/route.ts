import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface IdeaAuthorRank {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  idea_count: number
  total_upvotes: number
  total_downvotes: number
  net_score: number
  avg_score: number
  featured_count: number
  top_idea_title: string | null
  top_idea_score: number
  top_idea_direction: string | null
}

export interface IdeasLeaderboardResponse {
  authors: IdeaAuthorRank[]
  period: string
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const period = (searchParams.get('period') ?? 'all') as 'week' | 'month' | 'all'

    // Build date filter
    let dateFilter: string | null = null
    if (period === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      dateFilter = d.toISOString()
    } else if (period === 'month') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      dateFilter = d.toISOString()
    }

    // Fetch all ideas with author info
    let query = supabase
      .from('market_ideas')
      .select(`
        id, user_id, title, direction, upvotes, downvotes, is_featured, created_at,
        author:profiles!market_ideas_user_id_fkey(
          id, username, display_name, avatar_url, role, clout
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (dateFilter) {
      query = query.gte('created_at', dateFilter)
    }

    const { data: ideas, error } = await query

    if (error) throw error

    // Aggregate by author
    const authorMap = new Map<string, IdeaAuthorRank>()

    for (const idea of ideas ?? []) {
      const author = Array.isArray(idea.author) ? idea.author[0] : idea.author
      if (!author) continue

      const key = idea.user_id
      const score = (idea.upvotes ?? 0) - (idea.downvotes ?? 0)

      if (!authorMap.has(key)) {
        authorMap.set(key, {
          user_id:          idea.user_id,
          username:         author.username ?? '',
          display_name:     author.display_name ?? null,
          avatar_url:       author.avatar_url ?? null,
          role:             author.role ?? 'citizen',
          clout:            author.clout ?? 0,
          idea_count:       0,
          total_upvotes:    0,
          total_downvotes:  0,
          net_score:        0,
          avg_score:        0,
          featured_count:   0,
          top_idea_title:   null,
          top_idea_score:   -Infinity,
          top_idea_direction: null,
        })
      }

      const entry = authorMap.get(key)!
      entry.idea_count++
      entry.total_upvotes  += idea.upvotes ?? 0
      entry.total_downvotes += idea.downvotes ?? 0
      entry.net_score      += score
      if (idea.is_featured) entry.featured_count++

      if (score > entry.top_idea_score) {
        entry.top_idea_score     = score
        entry.top_idea_title     = idea.title
        entry.top_idea_direction = idea.direction
      }
    }

    // Compute avg score and sort by net_score desc
    const authors = Array.from(authorMap.values())
      .map(a => ({
        ...a,
        avg_score:      a.idea_count > 0 ? Math.round(a.net_score / a.idea_count * 10) / 10 : 0,
        top_idea_score: a.top_idea_score === -Infinity ? 0 : a.top_idea_score,
      }))
      .filter(a => a.idea_count >= 1)
      .sort((a, b) => b.net_score - a.net_score || b.idea_count - a.idea_count)
      .slice(0, 50)

    return NextResponse.json({ authors, period } satisfies IdeasLeaderboardResponse)
  } catch (err) {
    console.error('[/api/exchange/ideas/leaderboard]', err)
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 })
  }
}
