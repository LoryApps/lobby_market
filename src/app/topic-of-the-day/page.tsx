import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TopicOfTheDayClient } from './TopicOfTheDayClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpotlightArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
}

export interface SpotlightTopic {
  id: string
  statement: string
  description: string | null
  category: string | null
  scope: string | null
  status: string
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  created_at: string
  updated_at: string
  for_arg: SpotlightArgument | null
  against_arg: SpotlightArgument | null
  author_username: string | null
  author_display_name: string | null
  // Today's selection ordinal (1-based day of year)
  day_ordinal: number
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient()
  const topic = await fetchSpotlightTopic(supabase)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })

  if (!topic) {
    return {
      title: `Topic of the Day · Lobby Market`,
      description: `The civic debate the Lobby is focused on today.`,
    }
  }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Topic of the Day: ${topic.statement.slice(0, 60)}${topic.statement.length > 60 ? '…' : ''} · Lobby Market`
  const description = `Today's civic spotlight — ${forPct}% FOR · ${(topic.total_votes ?? 0).toLocaleString()} votes · ${topic.category ?? 'General'} · ${today}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [
        {
          url: `/api/og/topic/${topic.id}`,
          width: 1200,
          height: 630,
          alt: topic.statement,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/topic/${topic.id}`],
    },
  }
}

// ─── Spotlight selection ───────────────────────────────────────────────────────

async function fetchSpotlightTopic(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<SpotlightTopic | null> {
  // Get top active/voting topics by vote count
  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, description, category, scope, status, blue_pct, total_votes, voting_ends_at, created_at, updated_at, author_id')
    .in('status', ['active', 'voting'])
    .order('total_votes', { ascending: false })
    .limit(10)

  if (!topics || topics.length === 0) return null

  // Deterministic daily selection: day of year mod count
  const now = new Date()
  const start = new Date(now.getUTCFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / 86_400_000)
  const idx = dayOfYear % topics.length
  const topic = topics[idx]

  // Fetch top FOR (blue) and AGAINST (red) arguments in parallel
  const [forRes, againstRes] = await Promise.all([
    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, profiles!user_id(username, display_name, avatar_url)')
      .eq('topic_id', topic.id)
      .eq('side', 'blue')
      .order('upvotes', { ascending: false })
      .limit(1),
    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, profiles!user_id(username, display_name, avatar_url)')
      .eq('topic_id', topic.id)
      .eq('side', 'red')
      .order('upvotes', { ascending: false })
      .limit(1),
  ])

  type RawArg = {
    id: string
    content: string
    side: string
    upvotes: number
    profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
  }

  function mapArg(raw: RawArg | null | undefined): SpotlightArgument | null {
    if (!raw) return null
    const p = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles
    return {
      id: raw.id,
      content: raw.content,
      side: raw.side as 'blue' | 'red',
      upvotes: raw.upvotes ?? 0,
      author_username: p?.username ?? null,
      author_display_name: p?.display_name ?? null,
      author_avatar_url: p?.avatar_url ?? null,
    }
  }

  const forArgRaw = ((forRes.data ?? []) as RawArg[])[0]
  const againstArgRaw = ((againstRes.data ?? []) as RawArg[])[0]

  return {
    ...topic,
    blue_pct: topic.blue_pct ?? 50,
    total_votes: topic.total_votes ?? 0,
    for_arg: mapArg(forArgRaw),
    against_arg: mapArg(againstArgRaw),
    author_username: null,
    author_display_name: null,
    day_ordinal: dayOfYear,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TopicOfTheDayPage() {
  const supabase = await createClient()
  const topic = await fetchSpotlightTopic(supabase)

  if (!topic) notFound()

  return <TopicOfTheDayClient topic={topic} />
}
