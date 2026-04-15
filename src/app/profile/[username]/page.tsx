import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ProfilePage } from '@/components/profile/ProfilePage'
import type { VoteHistoryEntry } from '@/components/profile/VoteHistoryTimeline'
import type { DebateHistoryEntry } from '@/components/profile/DebateHistory'
import type {
  Profile,
  Topic,
  Law,
  Vote,
  VoteSide,
} from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

// ── Role display labels ────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

interface ProfilePageRouteProps {
  params: { username: string }
}

// ── Open Graph metadata ────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: ProfilePageRouteProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, bio, role, clout, total_votes')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return { title: 'Profile · Lobby Market' }
  }

  const displayName = profile.display_name || profile.username
  const roleLabel = ROLE_LABEL[profile.role] ?? profile.role
  const description = [
    `${roleLabel} on Lobby Market`,
    profile.bio ? profile.bio.slice(0, 120) : null,
    `${profile.total_votes.toLocaleString()} votes cast`,
    `${profile.clout.toLocaleString()} clout`,
  ]
    .filter(Boolean)
    .join(' · ')

  const title = `${displayName} (@${profile.username}) · Lobby Market`
  const ogImageUrl = `/api/og/profile/${encodeURIComponent(profile.username)}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      username: profile.username,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${displayName}'s profile on Lobby Market`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

export default async function ProfileUsernamePage({
  params,
}: ProfilePageRouteProps) {
  const supabase = await createClient()

  // Fetch profile by username
  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('username', params.username)
    .maybeSingle()) as { data: Profile | null }

  if (!profile) {
    notFound()
  }

  // Check if current user owns this profile
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isOwner = user?.id === profile.id

  // Check if the current viewer follows this profile
  let initialFollowing = false
  if (user && !isOwner) {
    const { data: followRow } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', profile.id)
      .maybeSingle()
    initialFollowing = !!followRow
  }

  // Fetch recent votes (50) along with topic statement for display
  const { data: votesRaw } = (await supabase
    .from('votes')
    .select('id, topic_id, side, created_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50)) as { data: Vote[] | null }

  const votes = votesRaw ?? []
  const voteTopicIds = Array.from(new Set(votes.map((v) => v.topic_id)))
  let voteTopics: Pick<Topic, 'id' | 'statement' | 'blue_pct'>[] = []
  if (voteTopicIds.length > 0) {
    const { data } = (await supabase
      .from('topics')
      .select('id, statement, blue_pct')
      .in('id', voteTopicIds)) as {
      data: Pick<Topic, 'id' | 'statement' | 'blue_pct'>[] | null
    }
    voteTopics = data ?? []
  }
  const voteTopicMap = new Map(voteTopics.map((t) => [t.id, t]))

  const voteHistory: VoteHistoryEntry[] = votes.map((v) => {
    const topic = voteTopicMap.get(v.topic_id)
    const winMargin = topic ? topic.blue_pct - 50 : null
    return {
      id: v.id,
      topic_id: v.topic_id,
      side: v.side as VoteSide,
      created_at: v.created_at,
      topic_statement: topic?.statement ?? null,
      win_margin: winMargin,
    }
  })

  // Fetch authored topics
  const { data: topicsRaw } = (await supabase
    .from('topics')
    .select('*')
    .eq('author_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(30)) as { data: Topic[] | null }
  const topics = topicsRaw ?? []

  // Fetch laws authored — join via topic_id
  const lawTopicIds = topics
    .filter((t) => t.status === 'law')
    .map((t) => t.id)
  let laws: Law[] = []
  if (lawTopicIds.length > 0) {
    const { data: lawsRaw } = (await supabase
      .from('laws')
      .select('*')
      .in('topic_id', lawTopicIds)
      .order('established_at', { ascending: false })) as {
      data: Law[] | null
    }
    laws = lawsRaw ?? []
  }

  // Fetch achievements catalog + earned set + debate participation — in parallel
  const [achievementsRes, earnedRes, participantsRes] = await Promise.all([
    supabase.from('achievements').select('*').order('tier', { ascending: true }),
    supabase.from('user_achievements').select('achievement_id').eq('user_id', profile.id),
    supabase
      .from('debate_participants')
      .select('debate_id, side, is_speaker, joined_at')
      .eq('user_id', profile.id)
      .order('joined_at', { ascending: false })
      .limit(30),
  ])

  const allAchievementsRaw = achievementsRes.data
  const earnedRaw = earnedRes.data
  const participantsRaw = participantsRes.data

  const allAchievements = allAchievementsRaw ?? []
  const earnedAchievementIds = (earnedRaw ?? []).map(
    (row) => row.achievement_id
  )

  // Build debate history
  const participants = participantsRaw ?? []
  let debateHistory: DebateHistoryEntry[] = []

  if (participants.length > 0) {
    const debateIds = Array.from(new Set(participants.map((p) => p.debate_id)))

    const { data: debatesRaw } = (await supabase
      .from('debates')
      .select('id, topic_id, title, type, status, scheduled_at, started_at, ended_at, blue_sway, red_sway')
      .in('id', debateIds)) as {
      data: {
        id: string
        topic_id: string
        title: string
        type: string
        status: string
        scheduled_at: string
        started_at: string | null
        ended_at: string | null
        blue_sway: number
        red_sway: number
      }[] | null
    }

    const debates = debatesRaw ?? []

    const topicIds = Array.from(new Set(debates.map((d) => d.topic_id)))
    const { data: debateTopicsRaw } = topicIds.length
      ? (await supabase
          .from('topics')
          .select('id, statement, category')
          .in('id', topicIds)) as {
          data: { id: string; statement: string; category: string | null }[] | null
        }
      : { data: [] as { id: string; statement: string; category: string | null }[] }

    const topicMap = new Map((debateTopicsRaw ?? []).map((t) => [t.id, t]))
    const debateMap = new Map(debates.map((d) => [d.id, d]))

    debateHistory = participants
      .map((p) => {
        const d = debateMap.get(p.debate_id)
        if (!d) return null
        const topic = topicMap.get(d.topic_id) ?? null
        return {
          debateId: d.id,
          title: d.title,
          topicStatement: topic?.statement ?? null,
          topicCategory: topic?.category ?? null,
          type: d.type as 'quick' | 'grand' | 'tribunal',
          status: d.status as 'scheduled' | 'live' | 'ended' | 'cancelled',
          side: p.side as 'blue' | 'red' | null,
          isSpeaker: p.is_speaker,
          scheduledAt: d.scheduled_at,
          endedAt: d.ended_at,
          blueSway: d.blue_sway,
          redSway: d.red_sway,
        } satisfies DebateHistoryEntry
      })
      .filter((e): e is DebateHistoryEntry => e !== null)
      // Sort: live first, then upcoming, then ended (most-recent first)
      .sort((a, b) => {
        const order = { live: 0, scheduled: 1, ended: 2, cancelled: 3 }
        const ao = order[a.status] ?? 4
        const bo = order[b.status] ?? 4
        if (ao !== bo) return ao - bo
        return new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      })
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="px-4 py-6 pb-24 md:pb-12">
        <ProfilePage
          profile={profile}
          isOwner={isOwner}
          voteHistory={voteHistory}
          topics={topics}
          laws={laws}
          allAchievements={allAchievements}
          earnedAchievementIds={earnedAchievementIds}
          initialFollowing={initialFollowing}
          viewerId={user?.id ?? null}
          debateHistory={debateHistory}
        />
      </main>
      <BottomNav />
    </div>
  )
}
