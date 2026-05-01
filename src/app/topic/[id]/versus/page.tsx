import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VersusClient } from './VersusClient'
import type { Topic, Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Versus · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `FOR vs AGAINST: ${topic.statement.slice(0, 60)} · Lobby Market`
  const description = `The strongest case FOR and AGAINST this debate — ${forPct}% For · ${100 - forPct}% Against · ${(topic.total_votes ?? 0).toLocaleString()} votes.`

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
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export interface VersusArgument {
  id: string
  content: string
  upvotes: number
  side: 'blue' | 'red'
  source_url: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface VersusData {
  topic: Pick<Topic, 'id' | 'statement' | 'category' | 'status' | 'blue_pct' | 'total_votes'>
  forArg: VersusArgument | null
  againstArg: VersusArgument | null
  totalArguments: number
  currentUserId: string | null
}

export default async function VersusPage({ params }: PageProps) {
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

  const topic = topicResult.data as Pick<Topic, 'id' | 'statement' | 'category' | 'status' | 'blue_pct' | 'total_votes'>
  const currentUserId = userResult.data.user?.id ?? null

  // Fetch top arguments for both sides
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select('id, side, content, upvotes, source_url, user_id, created_at')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  const args = rawArgs ?? []
  const totalArguments = args.length

  const topForRaw = args.find((a) => a.side === 'blue') ?? null
  const topAgainstRaw = args.find((a) => a.side === 'red') ?? null

  // Batch-fetch author profiles
  const authorIds = [topForRaw?.user_id, topAgainstRaw?.user_id].filter(Boolean) as string[]
  const profileMap = new Map<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>>()

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)

    for (const p of profiles ?? []) {
      profileMap.set(p.id, p)
    }
  }

  function enrich(raw: typeof topForRaw): VersusArgument | null {
    if (!raw) return null
    return {
      id: raw.id,
      content: raw.content,
      upvotes: raw.upvotes ?? 0,
      side: raw.side as 'blue' | 'red',
      source_url: raw.source_url ?? null,
      created_at: raw.created_at,
      author: profileMap.get(raw.user_id) ?? null,
    }
  }

  const versusData: VersusData = {
    topic,
    forArg: enrich(topForRaw),
    againstArg: enrich(topAgainstRaw),
    totalArguments,
    currentUserId,
  }

  return <VersusClient data={versusData} />
}
