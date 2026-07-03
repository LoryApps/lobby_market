import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { QuestionThreadClient } from './QuestionThreadClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('topic_questions')
    .select('content, topic_id, is_answered, answer_count, topics!inner(statement, category)')
    .eq('id', params.id)
    .maybeSingle()

  if (!data) return { title: 'Question · Lobby Market' }

  const snippet = data.content.slice(0, 100) + (data.content.length > 100 ? '…' : '')
  const topic = (data as { topics?: { statement?: string; category?: string | null } }).topics
  const topicLabel = topic?.statement
    ? ` on "${topic.statement.slice(0, 50)}${topic.statement.length > 50 ? '…' : ''}"`
    : ''
  const title = `Q: ${snippet} · Lobby Market`
  const description = `Civic question${topicLabel} — ${data.answer_count} answer${data.answer_count !== 1 ? 's' : ''}${data.is_answered ? ' · Answered' : ''}. Read the community's best responses on Lobby Market.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function QuestionThreadPage({ params }: Props) {
  const supabase = await createClient()

  // Verify question exists
  const { data: question } = await supabase
    .from('topic_questions')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!question) notFound()

  return <QuestionThreadClient questionId={params.id} />
}
