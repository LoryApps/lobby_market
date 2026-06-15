import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Response types ────────────────────────────────────────────────────────────

export interface ActiveCampaign {
  stanceId: string
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicStatus: string
  stance: 'for' | 'against' | 'neutral'
  stanceStatement: string | null
  bluePct: number
  totalVotes: number
  declaredAt: string
}

export interface RecentPost {
  id: string
  content: string
  isPinned: boolean
  createdAt: string
  author: {
    username: string
    displayName: string | null
    avatarUrl: string | null
  } | null
}

export interface WarRoomContributor {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  coalitionRole: 'leader' | 'officer' | 'member'
  clout: number
  reputationScore: number
}

export interface WarRoomResponse {
  coalition: {
    id: string
    name: string
    description: string | null
    memberCount: number
    maxMembers: number
    wins: number
    losses: number
    influence: number
    isPublic: boolean
  }
  currentUserRole: 'leader' | 'officer' | 'member' | null
  activeCampaigns: ActiveCampaign[]
  resolvedCampaigns: ActiveCampaign[]
  recentPosts: RecentPost[]
  contributors: WarRoomContributor[]
  openSlots: number
  winRate: number | null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const coalitionId = params.id

  // ── Auth ──────────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  // ── Coalition info ────────────────────────────────────────────────────────
  const { data: coalition, error: coalErr } = await supabase
    .from('coalitions')
    .select(
      'id, name, description, member_count, max_members, wins, losses, coalition_influence, is_public',
    )
    .eq('id', coalitionId)
    .single()

  if (coalErr || !coalition) {
    return NextResponse.json({ error: 'Coalition not found' }, { status: 404 })
  }

  // ── Access check: private coalitions → members only ───────────────────────
  let currentUserRole: 'leader' | 'officer' | 'member' | null = null

  if (userId) {
    const { data: membership } = await supabase
      .from('coalition_members')
      .select('role')
      .eq('coalition_id', coalitionId)
      .eq('user_id', userId)
      .maybeSingle()

    if (membership) {
      currentUserRole = membership.role as 'leader' | 'officer' | 'member'
    }
  }

  if (!coalition.is_public && !currentUserRole) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Stances with topic info ───────────────────────────────────────────────
  const { data: stancesRaw } = await supabase
    .from('coalition_stances')
    .select(`
      id,
      topic_id,
      stance,
      statement,
      created_at,
      topic:topics (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .eq('coalition_id', coalitionId)
    .order('created_at', { ascending: false })
    .limit(30)

  const stances = (stancesRaw ?? []) as Array<{
    id: string
    topic_id: string
    stance: string
    statement: string | null
    created_at: string
    topic: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    } | null
  }>

  const mapStance = (s: (typeof stances)[number]): ActiveCampaign => ({
    stanceId: s.id,
    topicId: s.topic_id,
    topicStatement: s.topic?.statement ?? '(unknown)',
    topicCategory: s.topic?.category ?? null,
    topicStatus: s.topic?.status ?? 'unknown',
    stance: s.stance as 'for' | 'against' | 'neutral',
    stanceStatement: s.statement,
    bluePct: s.topic?.blue_pct ?? 50,
    totalVotes: s.topic?.total_votes ?? 0,
    declaredAt: s.created_at,
  })

  const activeCampaigns = stances
    .filter((s) =>
      s.topic && ['proposed', 'active', 'voting'].includes(s.topic.status),
    )
    .map(mapStance)

  const resolvedCampaigns = stances
    .filter((s) => s.topic && ['law', 'failed'].includes(s.topic.status))
    .slice(0, 5)
    .map(mapStance)

  // ── Recent posts ──────────────────────────────────────────────────────────
  const { data: postsRaw } = await supabase
    .from('coalition_posts')
    .select(`
      id,
      content,
      is_pinned,
      created_at,
      author:profiles!coalition_posts_author_id_fkey (
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('coalition_id', coalitionId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(5)

  const recentPosts: RecentPost[] = (postsRaw ?? []).map((p: {
    id: string
    content: string
    is_pinned: boolean
    created_at: string
    author: { username: string; display_name: string | null; avatar_url: string | null } | null
  }) => ({
    id: p.id,
    content: p.content,
    isPinned: p.is_pinned,
    createdAt: p.created_at,
    author: p.author
      ? {
          username: p.author.username,
          displayName: p.author.display_name,
          avatarUrl: p.author.avatar_url,
        }
      : null,
  }))

  // ── Contributors ──────────────────────────────────────────────────────────
  const { data: membersRaw } = await supabase
    .from('coalition_members')
    .select(`
      role,
      user_id,
      profile:profiles!coalition_members_user_id_fkey (
        id,
        username,
        display_name,
        avatar_url,
        clout,
        reputation_score
      )
    `)
    .eq('coalition_id', coalitionId)
    .order('role', { ascending: true })
    .limit(20)

  const contributors: WarRoomContributor[] = (membersRaw ?? [])
    .filter((m: { profile: unknown }) => m.profile)
    .map((m: {
      role: string
      user_id: string
      profile: {
        id: string
        username: string
        display_name: string | null
        avatar_url: string | null
        clout: number
        reputation_score: number
      } | null
    }) => ({
      userId: m.user_id,
      username: m.profile!.username,
      displayName: m.profile!.display_name,
      avatarUrl: m.profile!.avatar_url,
      coalitionRole: m.role as 'leader' | 'officer' | 'member',
      clout: m.profile!.clout ?? 0,
      reputationScore: m.profile!.reputation_score ?? 0,
    }))
    .sort((a: WarRoomContributor, b: WarRoomContributor) => {
      const roleOrder = { leader: 0, officer: 1, member: 2 }
      const rd = roleOrder[a.coalitionRole] - roleOrder[b.coalitionRole]
      if (rd !== 0) return rd
      return b.reputationScore - a.reputationScore
    })

  // ── Win rate ──────────────────────────────────────────────────────────────
  const totalGames = coalition.wins + coalition.losses
  const winRate =
    totalGames > 0 ? Math.round((coalition.wins / totalGames) * 100) : null

  return NextResponse.json({
    coalition: {
      id: coalition.id,
      name: coalition.name,
      description: coalition.description,
      memberCount: coalition.member_count,
      maxMembers: coalition.max_members,
      wins: coalition.wins,
      losses: coalition.losses,
      influence: Math.round(coalition.coalition_influence),
      isPublic: coalition.is_public,
    },
    currentUserRole,
    activeCampaigns,
    resolvedCampaigns,
    recentPosts,
    contributors,
    openSlots: Math.max(0, coalition.max_members - coalition.member_count),
    winRate,
  } satisfies WarRoomResponse)
}
