import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HearingChair {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface HearingRow {
  id: string
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  committee: string
  title: string
  description: string | null
  chair: HearingChair | null
  status: 'open' | 'closed' | 'archived'
  recommendation: 'for' | 'against' | 'hold' | 'neutral' | null
  rationale: string | null
  testimony_count: number
  for_count: number
  against_count: number
  neutral_count: number
  created_at: string
  closed_at: string | null
  user_testimony: {
    id: string
    stance: string
    content: string
    created_at: string
  } | null
}

export interface HearingsResponse {
  hearings: HearingRow[]
  total: number
  open_count: number
}

// ─── GET /api/hearings ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'open'
  const committee = searchParams.get('committee')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  try {
    // ── Fetch hearings ────────────────────────────────────────────────────────
    let query = supabase
      .from('civic_hearings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status !== 'all') query = query.eq('status', status)
    if (committee) query = query.eq('committee', committee)

    const { data: rawHearings, count, error } = await query

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ hearings: [], total: 0, open_count: 0 } satisfies HearingsResponse)
      }
      throw error
    }

    if (!rawHearings?.length) {
      return NextResponse.json({ hearings: [], total: count ?? 0, open_count: 0 } satisfies HearingsResponse)
    }

    const hearingIds = rawHearings.map((h: { id: string }) => h.id)
    const topicIds = rawHearings.map((h: { topic_id: string | null }) => h.topic_id).filter(Boolean) as string[]
    const chairIds = rawHearings.map((h: { chair_id: string | null }) => h.chair_id).filter(Boolean) as string[]

    // ── Fetch related data in parallel ────────────────────────────────────────
    const [topicResult, chairResult, testimonyStats, userTestimonies, openCount] = await Promise.all([
      topicIds.length > 0
        ? supabase.from('topics').select('id, statement, category').in('id', topicIds)
        : Promise.resolve({ data: [] }),
      chairIds.length > 0
        ? supabase.from('profiles').select('id, username, display_name, avatar_url, role').in('id', chairIds)
        : Promise.resolve({ data: [] }),
      supabase.from('civic_testimonies')
        .select('hearing_id, stance')
        .in('hearing_id', hearingIds),
      user
        ? supabase.from('civic_testimonies')
          .select('hearing_id, id, stance, content, created_at')
          .in('hearing_id', hearingIds)
          .eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
      supabase.from('civic_hearings').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ])

    const topicMap = new Map(
      (topicResult.data ?? []).map((t: { id: string; statement: string; category: string | null }) => [t.id, t])
    )
    const chairMap = new Map(
      (chairResult.data ?? []).map((p: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }) => [p.id, p])
    )
    const statsMap = new Map<string, { for: number; against: number; neutral: number }>()
    for (const t of (testimonyStats.data ?? []) as { hearing_id: string; stance: string }[]) {
      const s = statsMap.get(t.hearing_id) ?? { for: 0, against: 0, neutral: 0 }
      if (t.stance === 'for') s.for++
      else if (t.stance === 'against') s.against++
      else s.neutral++
      statsMap.set(t.hearing_id, s)
    }
    const userTestimonyMap = new Map(
      (userTestimonies.data ?? []).map((t: { hearing_id: string; id: string; stance: string; content: string; created_at: string }) => [
        t.hearing_id,
        { id: t.id, stance: t.stance, content: t.content, created_at: t.created_at },
      ])
    )

    const hearings: HearingRow[] = rawHearings.map((h: {
      id: string;
      topic_id: string | null;
      committee: string;
      title: string;
      description: string | null;
      chair_id: string | null;
      status: 'open' | 'closed' | 'archived';
      recommendation: 'for' | 'against' | 'hold' | 'neutral' | null;
      rationale: string | null;
      testimony_count: number;
      created_at: string;
      closed_at: string | null;
    }) => {
      const topic = h.topic_id ? topicMap.get(h.topic_id) : null
      const chair = h.chair_id ? chairMap.get(h.chair_id) ?? null : null
      const stats = statsMap.get(h.id) ?? { for: 0, against: 0, neutral: 0 }
      return {
        id: h.id,
        topic_id: h.topic_id,
        topic_statement: (topic as { statement?: string } | null)?.statement ?? null,
        topic_category: (topic as { category?: string | null } | null)?.category ?? null,
        committee: h.committee,
        title: h.title,
        description: h.description,
        chair: chair ? {
          username: (chair as { username: string }).username,
          display_name: (chair as { display_name: string | null }).display_name,
          avatar_url: (chair as { avatar_url: string | null }).avatar_url,
          role: (chair as { role: string }).role,
        } : null,
        status: h.status,
        recommendation: h.recommendation,
        rationale: h.rationale,
        testimony_count: h.testimony_count,
        for_count: stats.for,
        against_count: stats.against,
        neutral_count: stats.neutral,
        created_at: h.created_at,
        closed_at: h.closed_at,
        user_testimony: userTestimonyMap.get(h.id) ?? null,
      }
    })

    return NextResponse.json({
      hearings,
      total: count ?? 0,
      open_count: openCount.count ?? 0,
    } satisfies HearingsResponse)
  } catch (err) {
    console.error('[hearings GET]', err)
    return NextResponse.json({ error: 'Failed to fetch hearings' }, { status: 500 })
  }
}
