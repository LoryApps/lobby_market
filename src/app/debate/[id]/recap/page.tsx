import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DebateRecap } from '@/components/debate/DebateRecap'
import type {
  Debate,
  DebateWithTopic,
  DebateParticipant,
  DebateParticipantWithProfile,
  Profile,
  Topic,
} from '@/lib/supabase/types'

interface RecapPageProps {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: RecapPageProps) {
  const supabase = await createClient()
  const { data: debate } = await supabase
    .from('debates')
    .select('title')
    .eq('id', params.id)
    .single()

  return {
    title: debate ? `Recap: ${debate.title}` : 'Debate Recap',
  }
}

export default async function DebateRecapPage({ params }: RecapPageProps) {
  const supabase = await createClient()

  const { data: debateRaw, error } = await supabase
    .from('debates')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !debateRaw || debateRaw.status !== 'ended') {
    notFound()
  }

  const [topicRes, creatorRes, participantsRes, messagesRes, reactionsRes] =
    await Promise.all([
      supabase
        .from('topics')
        .select('id, statement, category')
        .eq('id', debateRaw.topic_id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .eq('id', debateRaw.creator_id)
        .maybeSingle(),
      supabase
        .from('debate_participants')
        .select('*')
        .eq('debate_id', params.id),
      supabase
        .from('debate_messages')
        .select('id, side, is_argument, upvotes, user_id, content, created_at')
        .eq('debate_id', params.id),
      supabase
        .from('debate_reactions')
        .select('emoji')
        .eq('debate_id', params.id),
    ])

  const participantRows = (participantsRes.data ?? []) as DebateParticipant[]
  const messageRows = messagesRes.data ?? []

  // Hydrate participant profiles
  const userIds = Array.from(new Set(participantRows.map((p) => p.user_id)))
  let profileMap = new Map<
    string,
    Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>
  >()
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds)
    profileMap = new Map((profiles ?? []).map((p) => [p.id, p] as const))
  }

  const participants: DebateParticipantWithProfile[] = participantRows.map(
    (p) => ({ ...p, profile: profileMap.get(p.user_id) ?? null })
  )

  const topic = topicRes.data as Pick<
    Topic,
    'id' | 'statement' | 'category'
  > | null
  const creator = creatorRes.data as Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
  > | null

  const debate: DebateWithTopic = {
    ...(debateRaw as Debate),
    topic,
    creator,
  }

  // Hydrate top arguments with author profiles
  const topArgumentRows = messageRows
    .filter((m) => m.is_argument)
    .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))
    .slice(0, 5)

  const argAuthorIds = Array.from(
    new Set(topArgumentRows.map((m) => m.user_id))
  )
  let argProfileMap = new Map<
    string,
    { username: string; display_name: string | null; avatar_url: string | null }
  >()
  if (argAuthorIds.length > 0) {
    const { data: argProfiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', argAuthorIds)
    argProfileMap = new Map(
      (argProfiles ?? []).map((p) => [
        p.id,
        { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url },
      ] as const)
    )
  }

  const topMessages = topArgumentRows.map((m) => ({
    id: m.id as string,
    content: m.content as string,
    side: m.side as 'blue' | 'red' | null,
    upvotes: (m.upvotes ?? 0) as number,
    author: argProfileMap.get(m.user_id as string) ?? null,
  }))

  // Reaction emoji counts
  const reactionCounts: Record<string, number> = {}
  for (const r of reactionsRes.data ?? []) {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] ?? 0) + 1
  }

  // Message stats
  const msgs = messageRows
  const messageStats = {
    blue: msgs.filter((m) => m.side === 'blue').length,
    red: msgs.filter((m) => m.side === 'red').length,
    neutral: msgs.filter((m) => !m.side).length,
    total: msgs.length,
  }

  const blueSpeaker =
    participants.find((p) => p.side === 'blue' && p.is_speaker) ?? null
  const redSpeaker =
    participants.find((p) => p.side === 'red' && p.is_speaker) ?? null

  return (
    <DebateRecap
      debate={debate}
      blueSpeaker={blueSpeaker}
      redSpeaker={redSpeaker}
      topMessages={topMessages}
      reactionCounts={reactionCounts}
      messageStats={messageStats}
      totalParticipants={participants.length}
    />
  )
}
