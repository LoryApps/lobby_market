import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DebateArena } from '@/components/debate/DebateArena'
import type {
  Debate,
  DebateWithTopic,
  DebateParticipant,
  DebateParticipantWithProfile,
  DebateMessage,
  DebateMessageWithAuthor,
  Profile,
  Topic,
} from '@/lib/supabase/types'

interface DebatePageProps {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  live: 'Live Now',
  ended: 'Ended',
  cancelled: 'Cancelled',
}

const TYPE_LABEL: Record<string, string> = {
  oxford: 'Oxford Debate',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
}

export async function generateMetadata({ params }: DebatePageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: debate } = await supabase
    .from('debates')
    .select('title, description, type, status, scheduled_at, topic_id, viewer_count')
    .eq('id', params.id)
    .single()

  if (!debate) {
    return { title: 'Debate · Lobby Market' }
  }

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category')
    .eq('id', debate.topic_id)
    .single()

  const title = debate.title ?? 'Untitled Debate'
  const statusLabel = STATUS_LABEL[debate.status] ?? debate.status
  const typeLabel = TYPE_LABEL[debate.type] ?? debate.type

  const descriptionParts = [
    `${typeLabel} · ${statusLabel}`,
    topic?.statement ? `On: ${topic.statement}` : null,
    debate.description ?? null,
  ].filter(Boolean)

  const description = descriptionParts.join(' — ')
  const fullTitle = `${title} · Lobby Market`
  const ogImageUrl = `/api/og/debate/${params.id}`

  return {
    title: fullTitle,
    description,
    openGraph: {
      title: fullTitle,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      publishedTime: debate.scheduled_at,
      tags: topic?.category ? [topic.category, 'debate'] : ['debate'],
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [ogImageUrl],
    },
  }
}

export default async function DebatePage({ params }: DebatePageProps) {
  const supabase = await createClient()

  const { data: debate, error } = await supabase
    .from('debates')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !debate) {
    notFound()
  }

  const [
    topicRes,
    creatorRes,
    participantRes,
    messageRes,
    currentUserRes,
  ] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category')
      .eq('id', debate.topic_id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', debate.creator_id)
      .maybeSingle(),
    supabase
      .from('debate_participants')
      .select('*')
      .eq('debate_id', params.id)
      .order('joined_at', { ascending: true }),
    supabase
      .from('debate_messages')
      .select('*')
      .eq('debate_id', params.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.auth.getUser(),
  ])

  const participantRows = (participantRes.data ?? []) as DebateParticipant[]
  const messageRows = (messageRes.data ?? []) as DebateMessage[]

  // Hydrate profiles for participants and message authors in one batch
  const userIds = Array.from(
    new Set<string>([
      ...participantRows.map((p) => p.user_id),
      ...messageRows.map((m) => m.user_id),
    ])
  )

  let profileMap = new Map<
    string,
    Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>
  >()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds)
    profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p] as const)
    )
  }

  const participants: DebateParticipantWithProfile[] = participantRows.map(
    (p) => ({
      ...p,
      profile: profileMap.get(p.user_id) ?? null,
    })
  )

  const messages: DebateMessageWithAuthor[] = messageRows
    .slice()
    .reverse()
    .map((m) => ({
      ...m,
      author: profileMap.get(m.user_id) ?? null,
    }))

  const topic = topicRes.data as Pick<
    Topic,
    'id' | 'statement' | 'category'
  > | null
  const creator = creatorRes.data as Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
  > | null

  const debateWithTopic: DebateWithTopic = {
    ...(debate as Debate),
    topic,
    creator,
  }

  return (
    <DebateArena
      initialDebate={debateWithTopic}
      initialParticipants={participants}
      initialMessages={messages}
      currentUserId={currentUserRes.data.user?.id ?? null}
    />
  )
}
