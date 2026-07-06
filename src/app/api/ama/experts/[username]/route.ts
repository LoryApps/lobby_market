import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Response types ───────────────────────────────────────────────────────────

export interface ExpertSession {
  id: string
  title: string
  description: string | null
  category: string | null
  scheduled_at: string
  started_at: string | null
  ended_at: string | null
  status: 'upcoming' | 'live' | 'ended' | 'cancelled'
  question_count: number
  answer_count: number
  rsvp_count: number
  user_rsvped: boolean
}

export interface ExpertAnswer {
  id: string
  content: string
  created_at: string
  question: {
    id: string
    content: string
    upvotes: number
  }
  session: {
    id: string
    title: string
    category: string | null
    status: string
  }
}

export interface ExpertProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: string
  clout: number
  reputation_score: number
  joined_at: string
}

export interface ExpertStats {
  totalSessions: number
  endedSessions: number
  upcomingSessions: number
  liveSessions: number
  totalAnswers: number
  totalQuestions: number
  totalRsvps: number
  categories: string[]
}

export interface AMAExpertProfileResponse {
  profile: ExpertProfile
  stats: ExpertStats
  sessions: ExpertSession[]
  topAnswers: ExpertAnswer[]
  isCurrentUser: boolean
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Fetch profile by username
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio, role, clout, reputation_score, created_at')
      .eq('username', params.username)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Expert not found' }, { status: 404 })
    }

    const expertId = profile.id

    // Fetch all sessions hosted by this expert (excluding cancelled)
    const { data: sessionRows } = await supabase
      .from('ama_sessions')
      .select('*')
      .eq('host_id', expertId)
      .neq('status', 'cancelled')
      .order('scheduled_at', { ascending: false })
      .limit(20)

    const sessions = (sessionRows ?? []) as ExpertSession[]

    // Fetch current user's RSVPs if logged in
    let rsvpedSessionIds = new Set<string>()
    if (user && sessions.length > 0) {
      const upcomingIds = sessions
        .filter((s) => s.status === 'upcoming' || s.status === 'live')
        .map((s) => s.id)
      if (upcomingIds.length > 0) {
        const { data: rsvps } = await supabase
          .from('ama_rsvps')
          .select('session_id')
          .eq('user_id', user.id)
          .in('session_id', upcomingIds)
        rsvpedSessionIds = new Set((rsvps ?? []).map((r) => r.session_id))
      }
    }

    const sessionsWithRsvp: ExpertSession[] = sessions.map((s) => ({
      ...s,
      user_rsvped: rsvpedSessionIds.has(s.id),
    }))

    // Compute stats
    const stats: ExpertStats = {
      totalSessions: sessions.length,
      endedSessions: sessions.filter((s) => s.status === 'ended').length,
      upcomingSessions: sessions.filter((s) => s.status === 'upcoming').length,
      liveSessions: sessions.filter((s) => s.status === 'live').length,
      totalAnswers: sessions.reduce((sum, s) => sum + (s.answer_count ?? 0), 0),
      totalQuestions: sessions.reduce((sum, s) => sum + (s.question_count ?? 0), 0),
      totalRsvps: sessions.reduce((sum, s) => sum + (s.rsvp_count ?? 0), 0),
      categories: [...new Set(sessions.map((s) => s.category).filter(Boolean) as string[])],
    }

    // Fetch top answers by this expert (highest-upvoted questions they answered)
    const { data: answerRows } = await supabase
      .from('ama_answers')
      .select(`
        id,
        content,
        created_at,
        question_id,
        session_id
      `)
      .eq('host_id', expertId)
      .order('created_at', { ascending: false })
      .limit(50)

    let topAnswers: ExpertAnswer[] = []
    if (answerRows && answerRows.length > 0) {
      const questionIds = answerRows.map((a) => a.question_id)
      const sessionIds = [...new Set(answerRows.map((a) => a.session_id))]

      const [{ data: questions }, { data: sessionDetails }] = await Promise.all([
        supabase
          .from('ama_questions')
          .select('id, content, upvotes')
          .in('id', questionIds),
        supabase
          .from('ama_sessions')
          .select('id, title, category, status')
          .in('id', sessionIds),
      ])

      const questionMap = new Map((questions ?? []).map((q) => [q.id, q]))
      const sessionMap = new Map((sessionDetails ?? []).map((s) => [s.id, s]))

      topAnswers = answerRows
        .map((a) => {
          const q = questionMap.get(a.question_id)
          const s = sessionMap.get(a.session_id)
          if (!q || !s) return null
          return {
            id: a.id,
            content: a.content,
            created_at: a.created_at,
            question: {
              id: q.id,
              content: q.content,
              upvotes: q.upvotes,
            },
            session: {
              id: s.id,
              title: s.title,
              category: s.category,
              status: s.status,
            },
          }
        })
        .filter(Boolean)
        // Sort by question upvotes (most-upvoted questions answered first)
        .sort((a, b) => (b?.question.upvotes ?? 0) - (a?.question.upvotes ?? 0))
        .slice(0, 5) as ExpertAnswer[]
    }

    const response: AMAExpertProfileResponse = {
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        role: profile.role,
        clout: profile.clout ?? 0,
        reputation_score: profile.reputation_score ?? 0,
        joined_at: profile.created_at,
      },
      stats,
      sessions: sessionsWithRsvp,
      topAnswers,
      isCurrentUser: user?.id === expertId,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[GET /api/ama/experts/[username]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
