import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { TopicTimelineClient } from '@/components/topic/TopicTimelineClient'
import type { TopicTimelineData } from '@/app/api/topics/[id]/timeline/route'

interface Props {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status')
    .eq('id', params.id)
    .single()

  if (!topic) return { title: 'Timeline · Lobby Market' }

  return {
    title: `Timeline · ${topic.statement.slice(0, 60)} · Lobby Market`,
    description: `Full debate history for this ${topic.category ?? ''} topic — argument activity, status milestones, and top voices.`,
  }
}

type TopicRow = {
  id: string
  statement: string
  category: string | null
  scope: string
  status: string
  blue_pct: number
  total_votes: number
  support_count: number
  activation_threshold: number
  voting_ends_at: string | null
  created_at: string
  updated_at: string
}

export default async function TopicTimelinePage({ params }: Props) {
  const supabase = await createClient()

  const { data: rawTopic } = await supabase
    .from('topics')
    .select(
      'id, statement, category, scope, status, blue_pct, total_votes, ' +
      'support_count, activation_threshold, voting_ends_at, created_at, updated_at'
    )
    .eq('id', params.id)
    .single()

  if (!rawTopic) notFound()
  const topic = rawTopic as unknown as TopicRow

  // Fetch arguments with author profiles
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select(
      'id, side, content, upvotes, created_at, ' +
      'profiles!topic_arguments_user_id_fkey(username, display_name, avatar_url, role)'
    )
    .eq('topic_id', params.id)
    .order('created_at', { ascending: true })
    .limit(500)

  type ArgRow = {
    id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    created_at: string
    profiles: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  }
  const args = (argRows ?? []) as unknown as ArgRow[]

  // Build argument buckets
  const bucketMap = new Map<string, { date: string; for_count: number; against_count: number; total: number }>()
  for (const arg of args) {
    const date = arg.created_at.slice(0, 10)
    const b = bucketMap.get(date) ?? { date, for_count: 0, against_count: 0, total: 0 }
    if (arg.side === 'blue') b.for_count++
    else b.against_count++
    b.total++
    bucketMap.set(date, b)
  }
  const argument_buckets = Array.from(bucketMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  const forArgs = [...args].filter((a) => a.side === 'blue').sort((a, b) => b.upvotes - a.upvotes)
  const againstArgs = [...args].filter((a) => a.side === 'red').sort((a, b) => b.upvotes - a.upvotes)

  function toArg(a: (typeof args)[number]) {
    return {
      id: a.id,
      side: a.side as 'blue' | 'red',
      content: a.content,
      upvotes: a.upvotes,
      created_at: a.created_at,
      author: a.profiles
        ? {
            username: a.profiles.username,
            display_name: a.profiles.display_name,
            avatar_url: a.profiles.avatar_url,
            role: a.profiles.role,
          }
        : null,
    }
  }

  // Build milestones
  type Milestone = TopicTimelineData['milestones'][number]
  const milestones: Milestone[] = []

  milestones.push({
    type: 'proposed',
    label: 'Proposed',
    date: topic.created_at,
    description: 'Topic submitted to the Lobby for community review',
  })

  if (topic.status !== 'proposed') {
    const firstArgDate = args.length > 0 ? args[0].created_at : null
    const activationDate = firstArgDate ?? topic.updated_at
    if (activationDate && activationDate !== topic.created_at) {
      milestones.push({
        type: 'activated',
        label: 'Activated',
        date: activationDate,
        description: `Reached ${topic.activation_threshold} supports and entered active debate`,
      })
    }
  }

  if (topic.status === 'voting' || topic.status === 'law' || topic.status === 'failed') {
    if (topic.voting_ends_at) {
      milestones.push({
        type: 'voting',
        label: 'Voting Phase',
        date: topic.voting_ends_at,
        description: 'Community entered the final voting phase',
      })
    }
  }

  if (topic.status === 'law') {
    milestones.push({
      type: 'law',
      label: 'Established as Law',
      date: topic.updated_at,
      description: `Passed with ${Math.round(topic.blue_pct)}% majority`,
    })
  }

  if (topic.status === 'failed') {
    milestones.push({
      type: 'failed',
      label: 'Failed',
      date: topic.updated_at,
      description: `Did not reach supermajority — ${Math.round(topic.blue_pct)}% FOR`,
    })
  }

  if (topic.status === 'voting' && topic.voting_ends_at) {
    const endsAt = new Date(topic.voting_ends_at)
    if (endsAt > new Date()) {
      milestones.push({
        type: 'voting_ends',
        label: 'Voting Closes',
        date: topic.voting_ends_at,
        description: 'Final deadline for community votes',
      })
    }
  }

  milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const startMs = new Date(topic.created_at).getTime()
  const endMs =
    topic.status === 'law' || topic.status === 'failed'
      ? new Date(topic.updated_at).getTime()
      : Date.now()
  const debate_days = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)))

  const timelineData: TopicTimelineData = {
    topic,
    milestones,
    argument_buckets,
    top_for: forArgs.slice(0, 5).map(toArg),
    top_against: againstArgs.slice(0, 5).map(toArg),
    total_arguments: args.length,
    debate_days,
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/topic/${topic.id}`}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to topic
          </Link>
          <span className="text-surface-600" aria-hidden="true">/</span>
          <span className="text-sm font-mono text-surface-500">Timeline</span>
        </div>

        {/* Topic title */}
        <div className="mb-6">
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-1">
            {topic.category ?? 'Topic'} · Debate History
          </p>
          <h1 className="font-mono text-xl sm:text-2xl font-bold text-white leading-snug">
            {topic.statement}
          </h1>
        </div>

        <TopicTimelineClient data={timelineData} topicId={topic.id} />
      </main>

      <BottomNav />
    </div>
  )
}
