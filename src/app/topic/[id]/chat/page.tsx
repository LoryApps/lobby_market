import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopicChatClient } from './TopicChatClient'
import type { Topic } from '@/lib/supabase/types'
import type { ChatMessage } from '@/app/api/topic-chat/[topicId]/route'

export const dynamic = 'force-dynamic'

interface ChatPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: ChatPageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category')
    .eq('id', params.id)
    .single()

  if (!topic) return { title: 'Chat · Lobby Market' }

  return {
    title: `Chat: ${topic.statement.slice(0, 60)} · Lobby Market`,
    description: `Live discussion about: ${topic.statement}`,
    openGraph: {
      title: `Live Chat · Lobby Market`,
      description: `Join the live conversation about: ${topic.statement}`,
      type: 'website',
      siteName: 'Lobby Market',
    },
    robots: { index: false },
  }
}

export default async function TopicChatPage({ params }: ChatPageProps) {
  const supabase = await createClient()

  const [topicResult, userResult] = await Promise.all([
    supabase
      .from('topics')
      .select('*')
      .eq('id', params.id)
      .single(),
    supabase.auth.getUser(),
  ])

  if (topicResult.error || !topicResult.data) notFound()

  const topic = topicResult.data as Topic
  const currentUserId = userResult.data.user?.id ?? null

  // Fetch initial messages server-side for instant display
  const { data: rawMessages } = await supabase
    .from('topic_chat_messages')
    .select(
      `id, topic_id, user_id, content, created_at,
       author:profiles!topic_chat_messages_user_id_fkey(
         id, username, display_name, avatar_url, role
       )`
    )
    .eq('topic_id', params.id)
    .order('created_at', { ascending: true })
    .limit(100)

  const initialMessages: ChatMessage[] = (rawMessages ?? []).map((row) => ({
    id: row.id,
    topic_id: row.topic_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    author: Array.isArray(row.author) ? (row.author[0] ?? null) : (row.author ?? null),
  }))

  return (
    <TopicChatClient
      topic={topic}
      initialMessages={initialMessages}
      currentUserId={currentUserId}
    />
  )
}
