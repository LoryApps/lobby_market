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
