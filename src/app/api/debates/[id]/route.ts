import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  DebateMessage,
  DebateMessageWithAuthor,
  DebateParticipant,
  DebateParticipantWithProfile,
  Profile,
} from '@/lib/supabase/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: debate, error: debateError } = await supabase
    .from('debates')
    .select('*')
    .eq('id', params.id)
    .single()

  if (debateError || !debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  const [topicRes, creatorRes, participantRes, messageRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes')
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
  ])

  const participantRows = (participantRes.data ?? []) as DebateParticipant[]
  const messageRows = ((messageRes.data ?? []) as DebateMessage[])
    .slice()
    .reverse()

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
    profileMap = new Map((profiles ?? []).map((p) => [p.id, p] as const))
  }

  const participants: DebateParticipantWithProfile[] = participantRows.map(
    (p) => ({
      ...p,
      profile: profileMap.get(p.user_id) ?? null,
    })
  )

  const messages: DebateMessageWithAuthor[] = messageRows.map((m) => ({
    ...m,
    author: profileMap.get(m.user_id) ?? null,
  }))

  return NextResponse.json({
    debate: {
      ...debate,
      topic: topicRes.data,
      creator: creatorRes.data,
    },
    participants,
    messages,
  })
}
