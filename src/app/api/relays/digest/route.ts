import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DigestContributor {
  author_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  legs_this_week: number
  total_stars: number
}

export interface DigestLeg {
  id: string
  relay_id: string
  leg_number: number
  content: string
  upvote_count: number
  created_at: string
  relay_side: 'for' | 'against'
  relay_topic: string | null
  relay_topic_category: string | null
  author_id: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
}

export interface DigestRelay {
  id: string
  side: 'for' | 'against'
  status: string
  topic_id: string | null
  topic_statement: string | null
  topic_category: string | null
  vote_compelling: number
  vote_not_compelling: number
  compelling_pct: number | null
  legs_count: number
  max_legs: number
  created_at: string
  completed_at: string | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
  starter_role: string
  new_legs_this_week: number
}

export interface DigestCategoryStat {
  category: string
  new_relays: number
  new_legs: number
  color: string
}

export interface DigestResponse {
  week_label: string
  week_start_iso: string
  week_end_iso: string
  stats: {
    new_relays: number
    new_legs: number
    total_voters: number
    unique_contributors: number
    completed_relays: number
    for_relays: number
    against_relays: number
  }
  featured_relay: DigestRelay | null
  hottest_relay: DigestRelay | null
  top_legs: DigestLeg[]
  top_contributors: DigestContributor[]
  by_category: DigestCategoryStat[]
  open_relays_count: number
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-against-300',
  Health:      'text-emerald',
  Education:   'text-gold',
  Environment: 'text-emerald',
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

function getWeekBounds(offsetWeeks = 0): { start: Date; end: Date } {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7) - offsetWeeks * 7)
  monday.setUTCHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function formatWeekLabel(start: Date): string {
  return start.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// ─── GET /api/relays/digest ───────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { start: weekStart, end: weekEnd } = getWeekBounds(0)
  const weekStartISO = weekStart.toISOString()
  const weekEndISO = weekEnd.toISOString()

  // ── 1. New relays created this week ────────────────────────────────────────

  const { data: newRelaysRaw } = await supabase
    .from('civic_relays')
    .select('id, side, status, topic_id, created_at, completed_at, vote_compelling, vote_not_compelling, max_legs, starter_id')
    .gte('created_at', weekStartISO)
    .lte('created_at', weekEndISO)

  const newRelays = newRelaysRaw ?? []

  // ── 2. New legs created this week ──────────────────────────────────────────

  const { data: newLegsRaw } = await supabase
    .from('relay_legs')
    .select('id, relay_id, author_id, leg_number, content, created_at')
    .gte('created_at', weekStartISO)
    .lte('created_at', weekEndISO)

  const newLegs = newLegsRaw ?? []

  // ── 3. Unique contributors this week ───────────────────────────────────────

  const uniqueContributorIds = [...new Set(newLegs.map((l) => l.author_id))]

  // ── 4. Relay voters this week (compelling + not_compelling) ───────────────

  const { count: totalVoters } = await supabase
    .from('relay_votes')
    .select('voter_id', { count: 'exact', head: true })
    .gte('created_at', weekStartISO)
    .lte('created_at', weekEndISO)

  // ── 5. Leg stars this week ─────────────────────────────────────────────────

  const { data: legStarsRaw } = await supabase
    .from('relay_leg_upvotes')
    .select('leg_id, voter_id, created_at')
    .gte('created_at', weekStartISO)
    .lte('created_at', weekEndISO)

  const legStars = legStarsRaw ?? []

  // ── 6. Build leg star counts per leg ──────────────────────────────────────

  const legStarMap: Record<string, number> = {}
  for (const s of legStars) {
    legStarMap[s.leg_id] = (legStarMap[s.leg_id] ?? 0) + 1
  }

  // ── 7. Top legs this week (most starred) ──────────────────────────────────

  const topLegIds = Object.entries(legStarMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  let topLegs: DigestLeg[] = []
  if (topLegIds.length > 0) {
    const { data: topLegsRaw } = await supabase
      .from('relay_legs')
      .select('id, relay_id, leg_number, content, created_at, author_id')
      .in('id', topLegIds)

    if (topLegsRaw) {
      // Fetch relay side/topic info for these legs
      const relayIds = [...new Set(topLegsRaw.map((l) => l.relay_id))]
      const { data: relaysInfo } = await supabase
        .from('civic_relays')
        .select('id, side, topic_id')
        .in('id', relayIds)

      const relayInfoMap: Record<string, { side: string; topic_id: string | null }> = {}
      for (const r of relaysInfo ?? []) {
        relayInfoMap[r.id] = { side: r.side, topic_id: r.topic_id }
      }

      // Fetch topic statements for these relays
      const topicIdsForLegs = [...new Set((relaysInfo ?? []).filter((r) => r.topic_id).map((r) => r.topic_id as string))]
      const { data: topicsForLegs } = topicIdsForLegs.length > 0
        ? await supabase.from('topics').select('id, statement, category').in('id', topicIdsForLegs)
        : { data: [] }
      const topicLegMap: Record<string, { statement: string; category: string | null }> = {}
      for (const t of topicsForLegs ?? []) {
        topicLegMap[t.id] = { statement: t.statement, category: t.category }
      }

      // Fetch author profiles for top legs
      const authorIds = [...new Set(topLegsRaw.map((l) => l.author_id))]
      const { data: authorProfiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', authorIds)
      const authorMap: Record<string, { username: string; display_name: string | null; avatar_url: string | null; role: string }> = {}
      for (const p of authorProfiles ?? []) {
        authorMap[p.id] = { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, role: p.role }
      }

      topLegs = topLegIds
        .map((legId) => {
          const leg = topLegsRaw.find((l) => l.id === legId)
          if (!leg) return null
          const relayInfo = relayInfoMap[leg.relay_id]
          const topicInfo = relayInfo?.topic_id ? topicLegMap[relayInfo.topic_id] : null
          const author = authorMap[leg.author_id]
          return {
            id: leg.id,
            relay_id: leg.relay_id,
            leg_number: leg.leg_number,
            content: leg.content,
            upvote_count: legStarMap[leg.id] ?? 0,
            created_at: leg.created_at,
            relay_side: (relayInfo?.side ?? 'for') as 'for' | 'against',
            relay_topic: topicInfo?.statement ?? null,
            relay_topic_category: topicInfo?.category ?? null,
            author_id: leg.author_id,
            author_username: author?.username ?? 'unknown',
            author_display_name: author?.display_name ?? null,
            author_avatar_url: author?.avatar_url ?? null,
            author_role: author?.role ?? 'person',
          } satisfies DigestLeg
        })
        .filter(Boolean) as DigestLeg[]
    }
  }

  // ── 8. Top contributors (most legs this week) ──────────────────────────────

  const legsByContributor: Record<string, { count: number; stars: number }> = {}
  for (const leg of newLegs) {
    const existing = legsByContributor[leg.author_id]
    legsByContributor[leg.author_id] = {
      count: (existing?.count ?? 0) + 1,
      stars: (existing?.stars ?? 0) + (legStarMap[leg.id] ?? 0),
    }
  }

  const topContributorIds = Object.entries(legsByContributor)
    .sort((a, b) => b[1].count - a[1].count || b[1].stars - a[1].stars)
    .slice(0, 6)
    .map(([id]) => id)

  let topContributors: DigestContributor[] = []
  if (topContributorIds.length > 0) {
    const { data: profilesRaw } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', topContributorIds)

    topContributors = topContributorIds
      .map((id) => {
        const p = profilesRaw?.find((x) => x.id === id)
        if (!p) return null
        return {
          author_id: id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          role: p.role ?? 'person',
          legs_this_week: legsByContributor[id]?.count ?? 0,
          total_stars: legsByContributor[id]?.stars ?? 0,
        } satisfies DigestContributor
      })
      .filter(Boolean) as DigestContributor[]
  }

  // ── 9. Featured relay (completed this week, most compelling votes) ─────────

  const completedThisWeek = newRelays.filter(
    (r) => r.status === 'complete' || r.status === 'voted'
  )

  let featuredRelay: DigestRelay | null = null
  if (completedThisWeek.length > 0) {
    const sorted = [...completedThisWeek].sort(
      (a, b) => b.vote_compelling - a.vote_compelling
    )
    const top = sorted[0]

    const { data: topicData } = top.topic_id
      ? await supabase.from('topics').select('statement, category').eq('id', top.topic_id).maybeSingle()
      : { data: null }

    const { data: starterData } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, role')
      .eq('id', top.starter_id)
      .maybeSingle()

    const { count: legsCount } = await supabase
      .from('relay_legs')
      .select('id', { count: 'exact', head: true })
      .eq('relay_id', top.id)

    const newLegsThisWeek = newLegs.filter((l) => l.relay_id === top.id).length
    const total = top.vote_compelling + top.vote_not_compelling

    featuredRelay = {
      id: top.id,
      side: top.side as 'for' | 'against',
      status: top.status,
      topic_id: top.topic_id ?? null,
      topic_statement: topicData?.statement ?? null,
      topic_category: topicData?.category ?? null,
      vote_compelling: top.vote_compelling,
      vote_not_compelling: top.vote_not_compelling,
      compelling_pct: total > 0 ? Math.round((top.vote_compelling / total) * 100) : null,
      legs_count: legsCount ?? 0,
      max_legs: top.max_legs,
      created_at: top.created_at,
      completed_at: top.completed_at ?? null,
      starter_username: starterData?.username ?? 'unknown',
      starter_display_name: starterData?.display_name ?? null,
      starter_avatar_url: starterData?.avatar_url ?? null,
      starter_role: starterData?.role ?? 'person',
      new_legs_this_week: newLegsThisWeek,
    }
  }

  // ── 10. Hottest relay this week (most new legs added) ─────────────────────

  const legsByRelay: Record<string, number> = {}
  for (const leg of newLegs) {
    legsByRelay[leg.relay_id] = (legsByRelay[leg.relay_id] ?? 0) + 1
  }

  let hottestRelay: DigestRelay | null = null
  const hottestRelayId = Object.entries(legsByRelay)
    .sort((a, b) => b[1] - a[1])
    .find(([id]) => !featuredRelay || id !== featuredRelay.id)?.[0]

  if (hottestRelayId) {
    const { data: relayData } = await supabase
      .from('civic_relays')
      .select('id, side, status, topic_id, created_at, completed_at, vote_compelling, vote_not_compelling, max_legs, starter_id')
      .eq('id', hottestRelayId)
      .maybeSingle()

    if (relayData) {
      const { data: topicData } = relayData.topic_id
        ? await supabase.from('topics').select('statement, category').eq('id', relayData.topic_id).maybeSingle()
        : { data: null }

      const { data: starterData } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, role')
        .eq('id', relayData.starter_id)
        .maybeSingle()

      const { count: legsCount } = await supabase
        .from('relay_legs')
        .select('id', { count: 'exact', head: true })
        .eq('relay_id', relayData.id)

      const total = relayData.vote_compelling + relayData.vote_not_compelling

      hottestRelay = {
        id: relayData.id,
        side: relayData.side as 'for' | 'against',
        status: relayData.status,
        topic_id: relayData.topic_id ?? null,
        topic_statement: topicData?.statement ?? null,
        topic_category: topicData?.category ?? null,
        vote_compelling: relayData.vote_compelling,
        vote_not_compelling: relayData.vote_not_compelling,
        compelling_pct: total > 0 ? Math.round((relayData.vote_compelling / total) * 100) : null,
        legs_count: legsCount ?? 0,
        max_legs: relayData.max_legs,
        created_at: relayData.created_at,
        completed_at: relayData.completed_at ?? null,
        starter_username: starterData?.username ?? 'unknown',
        starter_display_name: starterData?.display_name ?? null,
        starter_avatar_url: starterData?.avatar_url ?? null,
        starter_role: starterData?.role ?? 'person',
        new_legs_this_week: legsByRelay[relayData.id] ?? 0,
      }
    }
  }

  // ── 11. Category breakdown ─────────────────────────────────────────────────

  const catMap: Record<string, { relays: number; legs: number }> = {}

  // Get topic IDs from new relays to look up categories
  const topicIds = [...new Set(newRelays.filter((r) => r.topic_id).map((r) => r.topic_id as string))]
  const topicCatMap: Record<string, string> = {}
  if (topicIds.length > 0) {
    const { data: topicsRaw } = await supabase
      .from('topics')
      .select('id, category')
      .in('id', topicIds)
    for (const t of topicsRaw ?? []) {
      if (t.category) topicCatMap[t.id] = t.category
    }
  }

  for (const relay of newRelays) {
    const cat = relay.topic_id ? (topicCatMap[relay.topic_id] ?? 'Other') : 'Other'
    if (!catMap[cat]) catMap[cat] = { relays: 0, legs: 0 }
    catMap[cat].relays++
  }
  for (const leg of newLegs) {
    const relay = newRelays.find((r) => r.id === leg.relay_id)
    const cat = relay?.topic_id ? (topicCatMap[relay.topic_id] ?? 'Other') : 'Other'
    if (!catMap[cat]) catMap[cat] = { relays: 0, legs: 0 }
    catMap[cat].legs++
  }

  const byCategory: DigestCategoryStat[] = Object.entries(catMap)
    .sort((a, b) => b[1].relays - a[1].relays)
    .slice(0, 8)
    .map(([cat, d]) => ({
      category: cat,
      new_relays: d.relays,
      new_legs: d.legs,
      color: CAT_COLOR[cat] ?? 'text-surface-400',
    }))

  // ── 12. Open relays count ──────────────────────────────────────────────────

  const { count: openRelaysCount } = await supabase
    .from('civic_relays')
    .select('id', { count: 'exact', head: true })
    .in('status', ['open', 'in_progress'])

  // ── 13. Assemble response ──────────────────────────────────────────────────

  const stats = {
    new_relays: newRelays.length,
    new_legs: newLegs.length,
    total_voters: totalVoters ?? 0,
    unique_contributors: uniqueContributorIds.length,
    completed_relays: completedThisWeek.length,
    for_relays: newRelays.filter((r) => r.side === 'for').length,
    against_relays: newRelays.filter((r) => r.side === 'against').length,
  }

  const response: DigestResponse = {
    week_label: formatWeekLabel(weekStart),
    week_start_iso: weekStartISO,
    week_end_iso: weekEndISO,
    stats,
    featured_relay: featuredRelay,
    hottest_relay: hottestRelay,
    top_legs: topLegs,
    top_contributors: topContributors,
    by_category: byCategory,
    open_relays_count: openRelaysCount ?? 0,
  }

  return NextResponse.json(response)
}
