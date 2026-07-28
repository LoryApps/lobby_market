import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntelligenceLiveDebate {
  id: string
  title: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  type: string
  viewer_count: number
  blue_sway: number
  red_sway: number
  started_at: string | null
  scheduled_at: string
}

export interface IntelligenceUpcomingDebate {
  id: string
  title: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  type: string
  scheduled_at: string
  rsvp_count: number
  creator_username: string
  creator_display_name: string | null
  creator_avatar_url: string | null
}

export interface IntelligenceRecentOutcome {
  id: string
  title: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  type: string
  ended_at: string
  blue_sway: number
  red_sway: number
  viewer_count: number
  topic_blue_pct: number | null
  winner_side: 'blue' | 'red' | 'draw'
}

export interface IntelligenceTopDebater {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  debate_count: number
  speaker_count: number
}

export interface IntelligenceCategoryStat {
  category: string
  debate_count: number
  live_count: number
  upcoming_count: number
  ended_count: number
  avg_viewers: number
}

export interface IntelligenceStats {
  total_debates: number
  live_now: number
  upcoming_7d: number
  ended_30d: number
  total_rsvps: number
  avg_viewer_count: number
  most_active_category: string | null
}

export interface IntelligenceResponse {
  live: IntelligenceLiveDebate[]
  upcoming: IntelligenceUpcomingDebate[]
  recent_outcomes: IntelligenceRecentOutcome[]
  top_debaters: IntelligenceTopDebater[]
  category_stats: IntelligenceCategoryStat[]
  stats: IntelligenceStats
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = new Date().toISOString()
  const in7d = new Date(Date.now() + 7 * 86_400_000).toISOString()
  const ago30d = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const ago7d = new Date(Date.now() - 7 * 86_400_000).toISOString()

  // Fetch in parallel
  const [
    liveRes,
    upcomingRes,
    recentRes,
    allDebatesRes,
    rsvpCountRes,
    participantsRes,
  ] = await Promise.all([
    // Live debates
    supabase
      .from('debates')
      .select('id, title, topic_id, type, viewer_count, blue_sway, red_sway, started_at, scheduled_at')
      .eq('status', 'live')
      .order('viewer_count', { ascending: false })
      .limit(6),

    // Upcoming debates in next 7 days
    supabase
      .from('debates')
      .select('id, title, topic_id, type, scheduled_at, creator_id')
      .eq('status', 'scheduled')
      .gte('scheduled_at', now)
      .lte('scheduled_at', in7d)
      .order('scheduled_at', { ascending: true })
      .limit(10),

    // Recent ended debates (last 14 days)
    supabase
      .from('debates')
      .select('id, title, topic_id, type, ended_at, blue_sway, red_sway, viewer_count')
      .eq('status', 'ended')
      .gte('ended_at', ago7d)
      .order('ended_at', { ascending: false })
      .limit(8),

    // All debates for stats (last 30d)
    supabase
      .from('debates')
      .select('status, topic_id, viewer_count, scheduled_at')
      .gte('created_at', ago30d),

    // RSVP counts for upcoming debates
    supabase
      .from('debate_rsvps')
      .select('debate_id'),

    // Debate participants for top debaters (last 30d speakers only)
    supabase
      .from('debate_participants')
      .select('debate_id, user_id, is_speaker')
      .eq('is_speaker', true),
  ])

  // ── Collect topic IDs & user IDs ──────────────────────────────────────────
  const liveDebates = liveRes.data ?? []
  const upcomingDebates = upcomingRes.data ?? []
  const recentDebates = recentRes.data ?? []

  const topicIds = Array.from(new Set([
    ...liveDebates.map((d) => d.topic_id),
    ...upcomingDebates.map((d) => d.topic_id),
    ...recentDebates.map((d) => d.topic_id),
  ]))

  const creatorIds = Array.from(new Set(upcomingDebates.map((d) => d.creator_id)))

  // Count debate appearances per user (speakers)
  const speakerMap = new Map<string, number>()
  for (const p of participantsRes.data ?? []) {
    speakerMap.set(p.user_id, (speakerMap.get(p.user_id) ?? 0) + 1)
  }

  // Top debater user IDs by speaker count
  const topDebaterIds = Array.from(speakerMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id)

  // Fetch topics, creators, and top debater profiles in parallel
  const [topicsRes, creatorsRes, topDebaterProfilesRes] = await Promise.all([
    topicIds.length
      ? supabase
          .from('topics')
          .select('id, statement, category, blue_pct')
          .in('id', topicIds)
      : Promise.resolve({ data: [] }),

    creatorIds.length
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', creatorIds)
      : Promise.resolve({ data: [] }),

    topDebaterIds.length
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', topDebaterIds)
      : Promise.resolve({ data: [] }),
  ])

  const topicMap = new Map(
    ((topicsRes.data ?? []) as { id: string; statement: string; category: string | null; blue_pct: number | null }[]).map(
      (t) => [t.id, t]
    )
  )

  const creatorMap = new Map(
    ((creatorsRes.data ?? []) as { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }[]).map(
      (p) => [p.id, p]
    )
  )

  const profileMap = new Map(
    ((topDebaterProfilesRes.data ?? []) as { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }[]).map(
      (p) => [p.id, p]
    )
  )

  // RSVP count map: debate_id → count
  const rsvpMap = new Map<string, number>()
  for (const r of rsvpCountRes.data ?? []) {
    rsvpMap.set(r.debate_id, (rsvpMap.get(r.debate_id) ?? 0) + 1)
  }

  // ── Assemble live ─────────────────────────────────────────────────────────
  const live: IntelligenceLiveDebate[] = liveDebates.map((d) => {
    const topic = topicMap.get(d.topic_id)
    return {
      id: d.id,
      title: d.title,
      topic_id: d.topic_id,
      topic_statement: topic?.statement ?? '',
      topic_category: topic?.category ?? null,
      type: d.type,
      viewer_count: d.viewer_count ?? 0,
      blue_sway: d.blue_sway ?? 50,
      red_sway: d.red_sway ?? 50,
      started_at: d.started_at ?? null,
      scheduled_at: d.scheduled_at,
    }
  })

  // ── Assemble upcoming ─────────────────────────────────────────────────────
  const upcoming: IntelligenceUpcomingDebate[] = upcomingDebates
    .map((d) => {
      const topic = topicMap.get(d.topic_id)
      const creator = creatorMap.get(d.creator_id)
      return {
        id: d.id,
        title: d.title,
        topic_id: d.topic_id,
        topic_statement: topic?.statement ?? '',
        topic_category: topic?.category ?? null,
        type: d.type,
        scheduled_at: d.scheduled_at,
        rsvp_count: rsvpMap.get(d.id) ?? 0,
        creator_username: creator?.username ?? '',
        creator_display_name: creator?.display_name ?? null,
        creator_avatar_url: creator?.avatar_url ?? null,
      }
    })
    .sort((a, b) => b.rsvp_count - a.rsvp_count || new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

  // ── Assemble recent outcomes ───────────────────────────────────────────────
  const recent_outcomes: IntelligenceRecentOutcome[] = recentDebates.map((d) => {
    const topic = topicMap.get(d.topic_id)
    const blue = d.blue_sway ?? 50
    const red = d.red_sway ?? 50
    const winner_side: 'blue' | 'red' | 'draw' =
      Math.abs(blue - red) < 5 ? 'draw' : blue > red ? 'blue' : 'red'
    return {
      id: d.id,
      title: d.title,
      topic_id: d.topic_id,
      topic_statement: topic?.statement ?? '',
      topic_category: topic?.category ?? null,
      type: d.type,
      ended_at: d.ended_at ?? '',
      blue_sway: blue,
      red_sway: red,
      viewer_count: d.viewer_count ?? 0,
      topic_blue_pct: topic?.blue_pct ?? null,
      winner_side,
    }
  })

  // ── Top debaters ──────────────────────────────────────────────────────────
  const top_debaters: IntelligenceTopDebater[] = topDebaterIds
    .map((uid) => {
      const profile = profileMap.get(uid)
      if (!profile) return null
      return {
        user_id: uid,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        debate_count: speakerMap.get(uid) ?? 0,
        speaker_count: speakerMap.get(uid) ?? 0,
      }
    })
    .filter((x): x is IntelligenceTopDebater => x !== null)

  // ── Category stats ────────────────────────────────────────────────────────
  // Build from all debates we fetched (live + upcoming + recent_outcomes + allDebates)
  const catMap = new Map<string, { live: number; upcoming: number; ended: number; viewers: number[] }>()

  function addToCategory(category: string | null, status: 'live' | 'upcoming' | 'ended', viewers: number) {
    const cat = category ?? 'Uncategorised'
    if (!catMap.has(cat)) catMap.set(cat, { live: 0, upcoming: 0, ended: 0, viewers: [] })
    const entry = catMap.get(cat)!
    entry[status]++
    if (viewers > 0) entry.viewers.push(viewers)
  }

  for (const d of live) addToCategory(d.topic_category, 'live', d.viewer_count)
  for (const d of upcoming) addToCategory(d.topic_category, 'upcoming', 0)
  for (const d of recent_outcomes) addToCategory(d.topic_category, 'ended', d.viewer_count)

  const category_stats: IntelligenceCategoryStat[] = Array.from(catMap.entries())
    .map(([category, s]) => ({
      category,
      debate_count: s.live + s.upcoming + s.ended,
      live_count: s.live,
      upcoming_count: s.upcoming,
      ended_count: s.ended,
      avg_viewers: s.viewers.length > 0 ? Math.round(s.viewers.reduce((a, b) => a + b, 0) / s.viewers.length) : 0,
    }))
    .sort((a, b) => b.debate_count - a.debate_count)
    .slice(0, 6)

  // ── Global stats ──────────────────────────────────────────────────────────
  const allDebates = allDebatesRes.data ?? []
  const totalViewers = allDebates.filter((d) => (d.viewer_count ?? 0) > 0).map((d) => d.viewer_count ?? 0)
  const totalRsvps = rsvpCountRes.data?.length ?? 0

  const stats: IntelligenceStats = {
    total_debates: allDebates.length,
    live_now: live.length,
    upcoming_7d: upcoming.length,
    ended_30d: allDebates.filter((d) => d.status === 'ended').length,
    total_rsvps: totalRsvps,
    avg_viewer_count: totalViewers.length > 0 ? Math.round(totalViewers.reduce((a, b) => a + b, 0) / totalViewers.length) : 0,
    most_active_category: category_stats[0]?.category ?? null,
  }

  const response: IntelligenceResponse = {
    live,
    upcoming,
    recent_outcomes,
    top_debaters,
    category_stats,
    stats,
  }

  return NextResponse.json(response)
}
