import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpotlightArgument {
  id: string
  content: string
  side: 'for' | 'against' | null
  upvotes: number
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface SpotlightDebate {
  id: string
  title: string
  status: string
  debate_type: string
  participant_count: number
  message_count: number
  scheduled_at: string | null
  topic: {
    id: string
    statement: string
    category: string | null
  } | null
}

export interface SpotlightTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
}

export interface SpotlightUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  total_arguments: number
  vote_streak: number
}

export interface SpotlightLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string
}

export interface PlatformSnapshot {
  total_topics: number
  active_topics: number
  laws_established: number
  total_votes: number
  live_debates: number
  week_votes: number
  week_laws: number
  week_arguments: number
}

export interface SpotlightData {
  argument_of_week: SpotlightArgument | null
  debate_of_week: SpotlightDebate | null
  closest_call: SpotlightTopic | null
  rising_star: SpotlightUser | null
  newest_law: SpotlightLaw | null
  hottest_topic: SpotlightTopic | null
  snapshot: PlatformSnapshot
  generated_at: string
}

// ─── GET /api/spotlight ───────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    argRes,
    debateRes,
    closestRes,
    lawRes,
    hottestRes,
    statsRes,
    weekVotesRes,
    weekLawsRes,
    weekArgsRes,
    liveDebatesRes,
    risingRes,
  ] = await Promise.all([
    // 1. Argument of the week: most upvoted argument created in last 7 days
    supabase
      .from('topic_arguments')
      .select(
        `id, content, side, upvotes, created_at,
         topic:topic_id(id, statement, category, status, blue_pct, total_votes),
         author:user_id(id, username, display_name, avatar_url, role)`
      )
      .gte('created_at', weekAgo)
      .gt('upvotes', 0)
      .order('upvotes', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 2. Debate of the week: most participants + messages this week
    supabase
      .from('debates')
      .select(
        `id, title, status, debate_type, participant_count, message_count, scheduled_at,
         topic:topic_id(id, statement, category)`
      )
      .gte('created_at', weekAgo)
      .neq('status', 'cancelled')
      .order('participant_count', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 3. Closest call: active/voting topic closest to 50% with most votes
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
      .in('status', ['active', 'voting'])
      .gt('total_votes', 10)
      .order('total_votes', { ascending: false })
      .limit(100),

    // 4. Newest law
    supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at')
      .order('established_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 5. Hottest topic: most viewed this week
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
      .in('status', ['active', 'voting', 'proposed'])
      .gte('created_at', weekAgo)
      .order('view_count', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // 6. Platform totals
    supabase.from('topics').select('id', { count: 'exact', head: true }),

    // 7. Week votes count
    supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo),

    // 8. Week laws count
    supabase
      .from('laws')
      .select('id', { count: 'exact', head: true })
      .gte('established_at', weekAgo),

    // 9. Week arguments count
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo),

    // 10. Live debates
    supabase
      .from('debates')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'live'),

    // 11. Rising star: highest reputation_score user who joined in the last 30 days
    supabase
      .from('profiles')
      .select(
        'id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, total_arguments, vote_streak'
      )
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .gt('total_votes', 3)
      .order('reputation_score', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Derive closest call from top-100 active topics (pick the one nearest 50%)
  const activeTopics = (closestRes.data ?? []) as SpotlightTopic[]
  let closestCall: SpotlightTopic | null = null
  let minDist = Infinity
  for (const t of activeTopics) {
    const dist = Math.abs(t.blue_pct - 50)
    if (dist < minDist) {
      minDist = dist
      closestCall = t
    }
  }

  // Active topics + law counts for snapshot
  const activeTotalRes = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .in('status', ['active', 'voting'])
  const lawsCount = await supabase
    .from('laws')
    .select('id', { count: 'exact', head: true })
  const totalVotesRes = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })

  const snapshot: PlatformSnapshot = {
    total_topics: statsRes.count ?? 0,
    active_topics: activeTotalRes.count ?? 0,
    laws_established: lawsCount.count ?? 0,
    total_votes: totalVotesRes.count ?? 0,
    live_debates: liveDebatesRes.count ?? 0,
    week_votes: weekVotesRes.count ?? 0,
    week_laws: weekLawsRes.count ?? 0,
    week_arguments: weekArgsRes.count ?? 0,
  }

  const data: SpotlightData = {
    argument_of_week: (argRes.data as SpotlightArgument | null) ?? null,
    debate_of_week: (debateRes.data as SpotlightDebate | null) ?? null,
    closest_call: closestCall,
    rising_star: (risingRes.data as SpotlightUser | null) ?? null,
    newest_law: (lawRes.data as SpotlightLaw | null) ?? null,
    hottest_topic: (hottestRes.data as SpotlightTopic | null) ?? null,
    snapshot,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(data)
}
