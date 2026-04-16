import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ProfilePage } from '@/components/profile/ProfilePage'
import type { VoteHistoryEntry } from '@/components/profile/VoteHistoryTimeline'
import type { ProfileArgumentEntry } from '@/components/profile/ProfileArguments'
import type { VoteCategoryBreakdown } from '@/components/profile/VoteDnaPanel'
import type {
  Profile,
  Topic,
  Law,
  Achievement,
  UserAchievement,
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
  let voteTopics: Pick<Topic, 'id' | 'statement' | 'blue_pct' | 'category'>[] = []
  if (voteTopicIds.length > 0) {
    const { data } = (await supabase
      .from('topics')
      .select('id, statement, blue_pct, category')
      .in('id', voteTopicIds)) as {
      data: Pick<Topic, 'id' | 'statement' | 'blue_pct' | 'category'>[] | null
    }
    voteTopics = data ?? []
  }
  const voteTopicMap = new Map(voteTopics.map((t) => [t.id, t]))

  // Compute category breakdown from the 50 most recent votes
  const categoryMap = new Map<string, { total: number; blue: number; red: number }>()
  for (const v of votes) {
    const topic = voteTopicMap.get(v.topic_id)
    const cat = topic?.category ?? 'Other'
    const existing = categoryMap.get(cat) ?? { total: 0, blue: 0, red: 0 }
    existing.total += 1
    if ((v.side as string) === 'blue') existing.blue += 1
    else existing.red += 1
    categoryMap.set(cat, existing)
  }
  const voteCategoryBreakdown: VoteCategoryBreakdown[] = Array.from(
    categoryMap.entries()
  ).map(([category, counts]) => ({ category, ...counts }))

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

  // Fetch achievements catalog + earned set
  const { data: allAchievementsRaw } = (await supabase
    .from('achievements')
    .select('*')
    .order('tier', { ascending: true })) as {
    data: Achievement[] | null
  }
  const allAchievements = allAchievementsRaw ?? []

  const { data: earnedRaw } = (await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', profile.id)) as {
    data: Pick<UserAchievement, 'achievement_id'>[] | null
  }
  const earnedAchievementIds = (earnedRaw ?? []).map(
    (row) => row.achievement_id
  )

  // Fetch arguments posted by this user, sorted by upvotes desc
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('id, side, content, upvotes, created_at, topic_id')
    .eq('user_id', profile.id)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  const argRows = argsRaw ?? []

  // Enrich with topic info
  const argTopicIds = Array.from(new Set(argRows.map((a) => a.topic_id)))
  const argTopicMap = new Map<
    string,
    { statement: string; status: string; category: string | null }
  >()
  if (argTopicIds.length > 0) {
    const { data: argTopics } = await supabase
      .from('topics')
      .select('id, statement, status, category')
      .in('id', argTopicIds)
    for (const t of argTopics ?? []) {
      argTopicMap.set(t.id, {
        statement: t.statement,
        status: t.status,
        category: t.category ?? null,
      })
    }
  }

  const profileArguments: ProfileArgumentEntry[] = argRows.map((a) => {
    const topic = argTopicMap.get(a.topic_id)
    return {
      id: a.id,
      side: a.side as 'blue' | 'red',
      content: a.content,
      upvotes: a.upvotes,
      created_at: a.created_at,
      topic_id: a.topic_id,
      topic_statement: topic?.statement ?? null,
      topic_status: topic?.status ?? null,
      topic_category: topic?.category ?? null,
    }
  })

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
          profileArguments={profileArguments}
          initialFollowing={initialFollowing}
          viewerId={user?.id ?? null}
          voteCategoryBreakdown={voteCategoryBreakdown}
        />
      </main>
      <BottomNav />
    </div>
  )
}
