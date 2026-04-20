import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface DiscoverUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  bio: string | null
}

export interface DiscoverCategory {
  name: string
  active_count: number
  voting_count: number
  law_count: number
  top_for_pct: number | null
}

export interface DiscoverDebate {
  id: string
  topic_id: string
  topic_statement: string
  scheduled_at: string
  rsvp_count: number
  debate_type: string
}

export interface DiscoverLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string
}

export interface DiscoverTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  feed_score: number
}

export interface DiscoverData {
  suggested_users: DiscoverUser[]
  categories: DiscoverCategory[]
  upcoming_debates: DiscoverDebate[]
  recent_laws: DiscoverLaw[]
  hot_topics: DiscoverTopic[]
  following_count: number
}

const CATEGORIES = [
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
]

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Suggested users ──────────────────────────────────────────────────────────
  let alreadyFollowingIds: string[] = []
  let currentUserId: string | null = null

  if (user) {
    currentUserId = user.id
    const { data: follows } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .limit(500)
    alreadyFollowingIds = (follows ?? []).map((f) => f.following_id)
  }

  const excludeIds = currentUserId
    ? [currentUserId, ...alreadyFollowingIds]
    : alreadyFollowingIds

  let usersQuery = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, bio')
    .order('reputation_score', { ascending: false })
    .gt('total_votes', 0)
    .limit(excludeIds.length + 12)

  if (excludeIds.length > 0) {
    usersQuery = usersQuery.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data: usersData } = await usersQuery
  const suggested_users = ((usersData ?? []) as DiscoverUser[]).slice(0, 8)

  const following_count = alreadyFollowingIds.length

  // ── Category stats ───────────────────────────────────────────────────────────
  const { data: topicsData } = await supabase
    .from('topics')
    .select('category, status, blue_pct')
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .not('category', 'is', null)

  const categoryMap = new Map<string, DiscoverCategory>()
  for (const cat of CATEGORIES) {
    categoryMap.set(cat, {
      name: cat,
      active_count: 0,
      voting_count: 0,
      law_count: 0,
      top_for_pct: null,
    })
  }

  for (const t of topicsData ?? []) {
    const cat = t.category as string
    const entry = categoryMap.get(cat)
    if (!entry) continue
    if (t.status === 'active' || t.status === 'proposed') entry.active_count++
    if (t.status === 'voting') entry.voting_count++
    if (t.status === 'law') entry.law_count++
    if (t.blue_pct != null) {
      entry.top_for_pct =
        entry.top_for_pct == null ? t.blue_pct : (entry.top_for_pct + t.blue_pct) / 2
    }
  }

  const categories = Array.from(categoryMap.values())
    .sort((a, b) => b.active_count + b.voting_count - (a.active_count + a.voting_count))

  // ── Upcoming debates ─────────────────────────────────────────────────────────
  const now = new Date().toISOString()
  const { data: debatesData } = await supabase
    .from('debates')
    .select('id, topic_id, scheduled_at, type')
    .in('status', ['scheduled', 'live'])
    .gte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(8)

  const debateIds = (debatesData ?? []).map((d) => d.id)
  const debateTopicIds = Array.from(new Set((debatesData ?? []).map((d) => d.topic_id)))

  const [rsvpRes, debateTopicsRes] = await Promise.all([
    debateIds.length
      ? supabase
          .from('debate_rsvps')
          .select('debate_id')
          .in('debate_id', debateIds)
      : Promise.resolve({ data: [] }),
    debateTopicIds.length
      ? supabase
          .from('topics')
          .select('id, statement')
          .in('id', debateTopicIds)
      : Promise.resolve({ data: [] }),
  ])

  const rsvpCounts = new Map<string, number>()
  for (const r of (rsvpRes.data ?? [])) {
    const key = (r as { debate_id: string }).debate_id
    rsvpCounts.set(key, (rsvpCounts.get(key) ?? 0) + 1)
  }

  const debateTopicMap = new Map(
    ((debateTopicsRes.data ?? []) as { id: string; statement: string }[]).map((t) => [t.id, t.statement])
  )

  const upcoming_debates: DiscoverDebate[] = ((debatesData ?? []) as {
    id: string
    topic_id: string
    scheduled_at: string
    type: string
  }[])
    .map((d) => ({
      id: d.id,
      topic_id: d.topic_id,
      topic_statement: debateTopicMap.get(d.topic_id) ?? 'Untitled',
      scheduled_at: d.scheduled_at,
      rsvp_count: rsvpCounts.get(d.id) ?? 0,
      debate_type: d.type ?? 'oxford',
    }))
    .sort((a, b) => b.rsvp_count - a.rsvp_count)
    .slice(0, 4)

  // ── Recent laws ──────────────────────────────────────────────────────────────
  const { data: lawsData } = await supabase
    .from('laws')
    .select('id, statement, category, total_votes, blue_pct, established_at')
    .eq('is_active', true)
    .order('established_at', { ascending: false })
    .limit(4)

  const recent_laws: DiscoverLaw[] = ((lawsData ?? []) as {
    id: string
    statement: string
    category: string | null
    total_votes: number
    blue_pct: number
    established_at: string
  }[]).map((l) => ({
    id: l.id,
    statement: l.statement,
    category: l.category,
    total_votes: l.total_votes,
    blue_pct: l.blue_pct,
    established_at: l.established_at,
  }))

  // ── Hot topics ───────────────────────────────────────────────────────────────
  const { data: hotData } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, feed_score')
    .in('status', ['active', 'voting'])
    .order('feed_score', { ascending: false })
    .limit(6)

  const hot_topics: DiscoverTopic[] = (hotData ?? []) as DiscoverTopic[]

  return NextResponse.json({
    suggested_users,
    categories,
    upcoming_debates,
    recent_laws,
    hot_topics,
    following_count,
  } satisfies DiscoverData)
}
