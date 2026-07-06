import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageSquarePlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { RespondClient } from './RespondClient'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: arg } = await supabase
    .from('topic_arguments')
    .select('content, side, topics(statement)')
    .eq('id', params.id)
    .maybeSingle()

  if (!arg) return { title: 'Respond · Lobby Market' }

  const topic = arg.topics as unknown as { statement: string } | null
  const sideLabel = arg.side === 'blue' ? 'FOR' : 'AGAINST'
  const oppLabel = arg.side === 'blue' ? 'AGAINST' : 'FOR'
  const snippet = arg.content.slice(0, 80)

  return {
    title: topic
      ? `Respond ${oppLabel} to "${snippet}…" · Lobby Market`
      : `Respond to ${sideLabel} argument · Lobby Market`,
    description: topic
      ? `Write a direct ${oppLabel} response with AI strategy guidance on: ${topic.statement}`
      : undefined,
  }
}

export default async function RespondPage({ params }: Props) {
  const supabase = await createClient()

  const { data: arg } = await supabase
    .from('topic_arguments')
    .select('id, content, side, topic_id, user_id')
    .eq('id', params.id)
    .maybeSingle()

  if (!arg) notFound()

  const [topicRes, authorRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', arg.topic_id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('username, display_name, avatar_url')
      .eq('id', arg.user_id)
      .maybeSingle(),
  ])

  if (!topicRes.data) notFound()

  const topic = topicRes.data
  const author = authorRes.data

  const isFor = arg.side === 'blue'
  const oppSideLabel = isFor ? 'AGAINST' : 'FOR'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">
        {/* Page header */}
        <div className="mb-6">
          <Link
            href={`/arguments/${arg.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-5"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to argument
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 h-11 w-11 bg-surface-200 border border-surface-300 rounded-2xl flex items-center justify-center">
              <MessageSquarePlus className="h-5 w-5 text-surface-400" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                Respond {oppSideLabel}
              </h1>
              <p className="text-sm text-surface-500 mt-0.5 leading-snug">
                Write a direct counter-argument with AI strategy guidance.
              </p>
            </div>
          </div>
        </div>

        {/* Topic breadcrumb */}
        <Link
          href={`/topic/${topic.id}`}
          className="flex items-center gap-2 mb-6 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:bg-surface-200 transition-colors group"
        >
          <span className="text-xs font-mono text-surface-600 flex-shrink-0 uppercase tracking-wider">Topic</span>
          <span className="text-sm text-surface-400 group-hover:text-white transition-colors line-clamp-1 leading-snug">
            {topic.statement}
          </span>
        </Link>

        <RespondClient
          argument={{
            id: arg.id,
            content: arg.content,
            side: arg.side as 'blue' | 'red',
            topic_id: arg.topic_id,
            author: author
              ? {
                  username: author.username,
                  display_name: author.display_name,
                  avatar_url: author.avatar_url,
                }
              : null,
          }}
          topic={{
            id: topic.id,
            statement: topic.statement,
            category: topic.category,
            status: topic.status,
            blue_pct: topic.blue_pct,
            total_votes: topic.total_votes,
          }}
        />
      </main>

      <BottomNav />
    </div>
  )
}
