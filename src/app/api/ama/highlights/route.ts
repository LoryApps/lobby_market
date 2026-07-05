import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface AMAHighlightHost {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
}

export interface AMAHighlight {
  answer_id: string
  question_id: string
  session_id: string
  session_title: string
  session_category: string | null
  session_ended_at: string | null
  question_content: string
  question_upvotes: number
  answer_content: string
  answer_created_at: string
  host: AMAHighlightHost | null
}

export interface AMAHighlightsResponse {
  highlights: AMAHighlight[]
  total: number
  insight_of_the_week: AMAHighlight | null
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    const url = req.nextUrl
    const category = url.searchParams.get('category')
    const period = url.searchParams.get('period') ?? 'all' // week | month | all
    const sort = url.searchParams.get('sort') ?? 'upvotes' // upvotes | recent
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50)
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

    // Build date filter
    let sinceDate: string | null = null
    if (period === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      sinceDate = d.toISOString()
    } else if (period === 'month') {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      sinceDate = d.toISOString()
    }

    // Fetch answers joined with questions and sessions
    // We query ama_answers, join to ama_questions and ama_sessions
    let answersQuery = supabase
      .from('ama_answers')
      .select(`
        id,
        question_id,
        session_id,
        host_id,
        content,
        created_at,
        ama_questions!inner(
          id,
          content,
          upvotes
        ),
        ama_sessions!inner(
          id,
          title,
          category,
          ended_at,
          status
        )
      `)
      .eq('ama_sessions.status', 'ended')

    if (category) {
      answersQuery = answersQuery.eq('ama_sessions.category', category)
    }
    if (sinceDate) {
      answersQuery = answersQuery.gte('created_at', sinceDate)
    }

    // Total count query
    let countQuery = supabase
      .from('ama_answers')
      .select('id', { count: 'exact', head: true })
      .eq('ama_sessions.status', 'ended')

    if (category) {
      countQuery = countQuery.eq('ama_sessions.category', category)
    }
    if (sinceDate) {
      countQuery = countQuery.gte('created_at', sinceDate)
    }

    const [answersRes, countRes] = await Promise.all([
      answersQuery.limit(limit + offset + 50), // fetch more for sorting
      countQuery,
    ])

    const rows = answersRes.data ?? []
    const total = countRes.count ?? 0

    // Shape the data
    type AnswerRow = {
      id: string
      question_id: string
      session_id: string
      host_id: string
      content: string
      created_at: string
      ama_questions: { id: string; content: string; upvotes: number } | null
      ama_sessions: { id: string; title: string; category: string | null; ended_at: string | null; status: string } | null
    }

    const shaped = (rows as unknown as AnswerRow[])
      .filter(r => r.ama_questions && r.ama_sessions)
      .map(r => ({
        answer_id: r.id,
        question_id: r.question_id,
        session_id: r.session_id,
        session_title: r.ama_sessions!.title,
        session_category: r.ama_sessions!.category,
        session_ended_at: r.ama_sessions!.ended_at,
        question_content: r.ama_questions!.content,
        question_upvotes: r.ama_questions!.upvotes,
        answer_content: r.content,
        answer_created_at: r.created_at,
        host_id: r.host_id,
        host: null as AMAHighlightHost | null,
      }))

    // Sort
    if (sort === 'recent') {
      shaped.sort((a, b) => new Date(b.answer_created_at).getTime() - new Date(a.answer_created_at).getTime())
    } else {
      shaped.sort((a, b) => b.question_upvotes - a.question_upvotes)
    }

    // Paginate
    const paginated = shaped.slice(offset, offset + limit)

    // Fetch host profiles
    const hostIds = [...new Set(paginated.map(h => h.host_id))]
    if (hostIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .in('id', hostIds)

      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
      for (const h of paginated) {
        const prof = profileMap.get(h.host_id)
        if (prof) {
          h.host = {
            id: prof.id,
            username: prof.username,
            display_name: prof.display_name,
            avatar_url: prof.avatar_url,
            role: prof.role,
            clout: prof.clout ?? 0,
          }
        }
      }
    }

    // Insight of the week: the top-upvoted Q&A from the last 7 days
    let insight_of_the_week: AMAHighlight | null = null
    if (offset === 0) {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const { data: weekRows } = await supabase
        .from('ama_answers')
        .select(`
          id,
          question_id,
          session_id,
          host_id,
          content,
          created_at,
          ama_questions!inner(id, content, upvotes),
          ama_sessions!inner(id, title, category, ended_at, status)
        `)
        .eq('ama_sessions.status', 'ended')
        .gte('created_at', weekAgo.toISOString())
        .limit(50)

      const weekShaped = ((weekRows ?? []) as unknown as AnswerRow[])
        .filter(r => r.ama_questions && r.ama_sessions)
        .map(r => ({
          answer_id: r.id,
          question_id: r.question_id,
          session_id: r.session_id,
          session_title: r.ama_sessions!.title,
          session_category: r.ama_sessions!.category,
          session_ended_at: r.ama_sessions!.ended_at,
          question_content: r.ama_questions!.content,
          question_upvotes: r.ama_questions!.upvotes,
          answer_content: r.content,
          answer_created_at: r.created_at,
          host_id: r.host_id,
          host: null as AMAHighlightHost | null,
        }))
        .sort((a, b) => b.question_upvotes - a.question_upvotes)

      if (weekShaped.length > 0) {
        const top = weekShaped[0]
        const { data: hostProf } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role, clout')
          .eq('id', top.host_id)
          .maybeSingle()
        if (hostProf) {
          top.host = {
            id: hostProf.id,
            username: hostProf.username,
            display_name: hostProf.display_name,
            avatar_url: hostProf.avatar_url,
            role: hostProf.role,
            clout: hostProf.clout ?? 0,
          }
        }
        insight_of_the_week = top
      }
    }

    // Strip internal host_id before returning
    const highlights: AMAHighlight[] = paginated.map(({ host_id: _hid, ...rest }) => rest)

    return NextResponse.json({ highlights, total, insight_of_the_week } as AMAHighlightsResponse)
  } catch (err) {
    console.error('AMA highlights error:', err)
    return NextResponse.json({ error: 'Failed to load highlights' }, { status: 500 })
  }
}
