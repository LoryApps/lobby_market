import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { TopicArgumentsClient } from './TopicArgumentsClient'
import type { TopicArgumentWithAuthor, Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Arguments · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Arguments: ${topic.statement.slice(0, 70)} · Lobby Market`
  const description = `${forPct}% For · ${100 - forPct}% Against · ${(topic.total_votes ?? 0).toLocaleString()} votes · Browse all arguments, sorted by quality, upvotes, and recency.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/topic/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function TopicArgumentsPage({ params }: Props) {
  const supabase = await createClient()

  const [topicResult, userResult] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.auth.getUser(),
  ])

  if (!topicResult.data) notFound()

  const topic = topicResult.data
  const currentUserId = userResult.data.user?.id ?? null

  // Fetch all arguments for the topic, sorted by top (server default)
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select('*')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  const args = rawArgs ?? []

  // Batch-fetch author profiles
  const userIds = Array.from(new Set(args.map((a) => a.user_id)))
  const profileMap = new Map<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>>()

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds)

    for (const p of profiles ?? []) {
      profileMap.set(p.id, p)
    }
  }

  // Fetch which arguments the current user has upvoted
  const upvotedSet = new Set<string>()
  if (currentUserId && args.length > 0) {
    const { data: myVotes } = await supabase
      .from('topic_argument_votes')
      .select('argument_id')
      .in('argument_id', args.map((a) => a.id))
      .eq('user_id', currentUserId)

    for (const v of myVotes ?? []) {
      upvotedSet.add(v.argument_id)
    }
  }

  const enrichedArgs: TopicArgumentWithAuthor[] = args.map((a) => ({
    id: a.id,
    topic_id: a.topic_id,
    user_id: a.user_id,
    side: a.side as 'blue' | 'red',
    content: a.content,
    upvotes: a.upvotes ?? 0,
    source_url: a.source_url ?? null,
    ai_score: a.ai_score ?? null,
    ai_grade: a.ai_grade ?? null,
    created_at: a.created_at,
    author: profileMap.get(a.user_id) ?? null,
    has_upvoted: upvotedSet.has(a.id),
  }))

  const total_for_args = args.filter((a) => a.side === 'blue').length
  const total_against_args = args.filter((a) => a.side === 'red').length

  const topicSummary = {
    id: topic.id,
    statement: topic.statement,
    category: topic.category ?? null,
    status: topic.status,
    blue_pct: topic.blue_pct ?? 50,
    total_votes: topic.total_votes ?? 0,
    total_for_args,
    total_against_args,
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <TopicArgumentsClient
        topic={topicSummary}
        initialArguments={enrichedArgs}
        currentUserId={currentUserId}
      />
      <BottomNav />
    </div>
  )
}
