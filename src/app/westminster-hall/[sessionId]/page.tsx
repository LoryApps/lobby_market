import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SessionDetailClient } from './SessionDetailClient'
import type { WHSessionDetail } from '@/app/api/westminster-hall/sessions/[id]/route'

interface SessionPageProps {
  params: { sessionId: string }
}

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  requested:  'Requested',
  approved:   'Approved',
  scheduled:  'Scheduled',
  live:       'Live Now',
  concluded:  'Concluded',
  withdrawn:  'Withdrawn',
}

export async function generateMetadata({ params }: SessionPageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('westminster_hall_sessions')
    .select('title, motion, status, category, scheduled_at, support_count, speech_count')
    .eq('id', params.sessionId)
    .single()

  if (!session) {
    return { title: 'Westminster Hall · Lobby Market' }
  }

  const statusLabel = STATUS_LABEL[session.status] ?? session.status
  const title = `${session.title} · Westminster Hall`
  const descParts = [
    `${statusLabel}${session.category ? ` · ${session.category}` : ''}`,
    session.motion,
    `${session.support_count} supporters · ${session.speech_count} speeches`,
  ]
  const description = descParts.join(' — ')

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      ...(session.scheduled_at ? { publishedTime: session.scheduled_at } : {}),
      tags: [session.category ?? 'debate', 'westminster hall', 'civic discussion'].filter(Boolean),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function SessionDetailPage({ params }: SessionPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: row, error } = await supabase
    .from('westminster_hall_sessions')
    .select(`
      id, title, motion, status, scheduled_at, duration_mins,
      started_at, concluded_at, support_count, support_threshold,
      speech_count, category, created_at,
      requester:profiles!westminster_hall_sessions_requester_id_fkey(
        id, username, display_name, avatar_url, role
      ),
      topic:topics!westminster_hall_sessions_topic_id_fkey(
        id, statement, category, status, blue_pct, total_votes
      )
    `)
    .eq('id', params.sessionId)
    .single()

  if (error || !row) {
    notFound()
  }

  const { data: speechRows } = await supabase
    .from('westminster_hall_speeches')
    .select(`
      id, session_id, content, hear_count, order_num, created_at,
      speaker:profiles!westminster_hall_speeches_speaker_id_fkey(
        id, username, display_name, avatar_url, role, clout
      )
    `)
    .eq('session_id', params.sessionId)
    .order('created_at', { ascending: true })
    .limit(100)

  let heardIds = new Set<string>()
  let userSupported = false
  if (user) {
    const [hearRes, supportRes] = await Promise.all([
      supabase
        .from('westminster_hall_hear_votes')
        .select('speech_id')
        .eq('user_id', user.id),
      supabase
        .from('westminster_hall_supporters')
        .select('session_id')
        .eq('user_id', user.id)
        .eq('session_id', params.sessionId)
        .maybeSingle(),
    ])
    heardIds = new Set((hearRes.data ?? []).map((r: { speech_id: string }) => r.speech_id))
    userSupported = !!supportRes.data
  }

  const speeches = (speechRows ?? []).map((s) => ({
    ...s,
    speaker: Array.isArray(s.speaker) ? s.speaker[0] : s.speaker,
    user_heard: heardIds.has(s.id),
  }))

  const session: WHSessionDetail = {
    ...(row as Omit<WHSessionDetail, 'speeches' | 'user_supported' | 'requester' | 'topic'>),
    requester: Array.isArray(row.requester) ? row.requester[0] : row.requester,
    topic: Array.isArray(row.topic) ? (row.topic[0] ?? null) : row.topic,
    speeches: speeches as WHSessionDetail['speeches'],
    user_supported: userSupported,
  }

  const BASE_URL = 'https://lobby.market'
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: session.title,
    description: session.motion,
    ...(session.scheduled_at ? { startDate: session.scheduled_at } : {}),
    ...(session.concluded_at ? { endDate: session.concluded_at } : {}),
    eventStatus: session.status === 'live'
      ? 'https://schema.org/EventLive'
      : session.status === 'concluded'
        ? 'https://schema.org/EventCompleted'
        : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    url: `${BASE_URL}/westminster-hall/${params.sessionId}`,
    organizer: { '@type': 'Organization', name: 'Lobby Market', url: BASE_URL },
    ...(session.topic ? {
      about: { '@type': 'Thing', name: session.topic.statement },
    } : {}),
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Lobby Market', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Westminster Hall', item: `${BASE_URL}/westminster-hall` },
        { '@type': 'ListItem', position: 3, name: session.title, item: `${BASE_URL}/westminster-hall/${params.sessionId}` },
      ],
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <SessionDetailClient
        session={session}
        currentUserId={user?.id ?? null}
      />
    </>
  )
}
