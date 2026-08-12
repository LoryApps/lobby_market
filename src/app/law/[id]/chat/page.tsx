import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LawChatClient } from './LawChatClient'
import type { Law } from '@/lib/supabase/types'
import type { LawChatMessage } from '@/app/api/laws/[id]/chat/route'

export const dynamic = 'force-dynamic'

interface LawChatPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: LawChatPageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category')
    .eq('id', params.id)
    .single()

  if (!law) return { title: 'Law Chat · Lobby Market' }

  return {
    title: `Chat: ${law.statement.slice(0, 60)} · Lobby Market`,
    description: `Live discussion about the law: ${law.statement}`,
    openGraph: {
      title: 'Law Chat · Lobby Market',
      description: `Join the live conversation about: ${law.statement}`,
      type: 'website',
      siteName: 'Lobby Market',
    },
    robots: { index: false },
  }
}

export default async function LawChatPage({ params }: LawChatPageProps) {
  const supabase = await createClient()

  const [lawResult, userResult] = await Promise.all([
    supabase.from('laws').select('*').eq('id', params.id).single(),
    supabase.auth.getUser(),
  ])

  if (lawResult.error || !lawResult.data) notFound()

  const law = lawResult.data as Law
  const currentUserId = userResult.data.user?.id ?? null

  // Fetch initial messages server-side for instant display
  const { data: rawMessages } = await supabase
    .from('law_chat_messages')
    .select(
      `id, law_id, user_id, content, created_at,
       author:profiles!law_chat_messages_user_id_fkey(
         id, username, display_name, avatar_url, role
       )`
    )
    .eq('law_id', params.id)
    .order('created_at', { ascending: true })
    .limit(100)

  const initialMessages: LawChatMessage[] = (rawMessages ?? []).map((row) => ({
    id: row.id,
    law_id: row.law_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
    author: Array.isArray(row.author) ? (row.author[0] ?? null) : (row.author ?? null),
  }))

  return (
    <LawChatClient
      law={law}
      initialMessages={initialMessages}
      currentUserId={currentUserId}
    />
  )
}
