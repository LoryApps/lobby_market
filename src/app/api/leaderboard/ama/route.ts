import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AMAExpertEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  session_count: number
  answer_count: number
  question_count: number
  rsvp_count: number
  categories: string[]
  last_session_at: string | null
  rank: number
}

export interface AMALeaderboardResponse {
  topHosts: AMAExpertEntry[]
  mostAttended: AMAExpertEntry[]
  rising: AMAExpertEntry[]
  stats: {
    total_sessions: number
    total_experts: number
    total_answers: number
    total_attendees: number
  }
  generatedAt: string
}

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch all ended/live sessions with host data
    const { data: sessions, error } = await supabase
      .from('ama_sessions')
      .select(`
        id,
        host_id,
        category,
        answer_count,
        question_count,
        rsvp_count,
        scheduled_at,
        started_at,
        ended_at,
        status,
        created_at
      `)
      .in('status', ['ended', 'live', 'upcoming'])
      .order('scheduled_at', { ascending: false })

    if (error) throw error
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        topHosts: [],
        mostAttended: [],
        rising: [],
        stats: { total_sessions: 0, total_experts: 0, total_answers: 0, total_attendees: 0 },
        generatedAt: new Date().toISOString(),
      } satisfies AMALeaderboardResponse)
    }

    // Aggregate per host
    const hostMap = new Map<string, {
      session_count: number
      answer_count: number
      question_count: number
      rsvp_count: number
      categories: Set<string>
      last_session_at: string | null
      earliest_session_at: string | null
    }>()

    for (const s of sessions) {
      const existing = hostMap.get(s.host_id)
      const sessionDate = s.ended_at ?? s.started_at ?? s.scheduled_at

      if (!existing) {
        hostMap.set(s.host_id, {
          session_count: 1,
          answer_count: s.answer_count ?? 0,
          question_count: s.question_count ?? 0,
          rsvp_count: s.rsvp_count ?? 0,
          categories: new Set(s.category ? [s.category] : []),
          last_session_at: sessionDate,
          earliest_session_at: sessionDate,
        })
      } else {
        existing.session_count++
        existing.answer_count += s.answer_count ?? 0
        existing.question_count += s.question_count ?? 0
        existing.rsvp_count += s.rsvp_count ?? 0
        if (s.category) existing.categories.add(s.category)
        if (!existing.last_session_at || sessionDate > existing.last_session_at) {
          existing.last_session_at = sessionDate
        }
        if (!existing.earliest_session_at || sessionDate < existing.earliest_session_at) {
          existing.earliest_session_at = sessionDate
        }
      }
    }

    // Fetch profiles for all hosts
    const hostIds = [...hostMap.keys()]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', hostIds)

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

    // Build entries array
    const entries: Omit<AMAExpertEntry, 'rank'>[] = []
    for (const [hostId, agg] of hostMap) {
      const profile = profileMap.get(hostId)
      if (!profile) continue

      entries.push({
        user_id: hostId,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role ?? 'person',
        clout: profile.clout ?? 0,
        session_count: agg.session_count,
        answer_count: agg.answer_count,
        question_count: agg.question_count,
        rsvp_count: agg.rsvp_count,
        categories: [...agg.categories].slice(0, 3),
        last_session_at: agg.last_session_at,
      })
    }

    // Sort: Top Hosts — session count × 4 + answers
    const topHosts: AMAExpertEntry[] = [...entries]
      .sort((a, b) => (b.session_count * 4 + b.answer_count) - (a.session_count * 4 + a.answer_count))
      .slice(0, 50)
      .map((e, i) => ({ ...e, rank: i + 1 }))

    // Sort: Most Attended — total RSVPs
    const mostAttended: AMAExpertEntry[] = [...entries]
      .sort((a, b) => b.rsvp_count - a.rsvp_count)
      .slice(0, 50)
      .map((e, i) => ({ ...e, rank: i + 1 }))

    // Sort: Rising — newest experts (first session in last 90 days) with at least 1 session
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const rising: AMAExpertEntry[] = [...entries]
      .filter((e) => e.last_session_at && e.last_session_at >= cutoff && e.session_count >= 1)
      .sort((a, b) => {
        // Score: recency + answers per session
        const scoreA = (a.answer_count / Math.max(a.session_count, 1)) * 2 + a.rsvp_count
        const scoreB = (b.answer_count / Math.max(b.session_count, 1)) * 2 + b.rsvp_count
        return scoreB - scoreA
      })
      .slice(0, 50)
      .map((e, i) => ({ ...e, rank: i + 1 }))

    // Platform stats
    const stats = {
      total_sessions: sessions.filter((s) => s.status === 'ended').length,
      total_experts: hostMap.size,
      total_answers: sessions.reduce((sum, s) => sum + (s.answer_count ?? 0), 0),
      total_attendees: sessions.reduce((sum, s) => sum + (s.rsvp_count ?? 0), 0),
    }

    return NextResponse.json({
      topHosts,
      mostAttended,
      rising,
      stats,
      generatedAt: new Date().toISOString(),
    } satisfies AMALeaderboardResponse)
  } catch (err) {
    console.error('[GET /api/leaderboard/ama]', err)
    return NextResponse.json({ error: 'Failed to load AMA leaderboard' }, { status: 500 })
  }
}
