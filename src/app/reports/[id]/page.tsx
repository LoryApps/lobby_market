import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ReportDetailClient } from './ReportDetailClient'

interface ReportPageProps {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

const RECOMMENDATION_LABEL: Record<string, string> = {
  for: 'Recommends: FOR',
  against: 'Recommends: AGAINST',
  hold: 'Recommends: HOLD',
  neutral: 'No Recommendation',
}

export async function generateMetadata({ params }: ReportPageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: report } = await supabase
    .from('civic_committee_reports')
    .select('title, summary, category, recommendation, created_at, profiles!civic_committee_reports_author_id_fkey(display_name, username)')
    .eq('id', params.id)
    .eq('status', 'published')
    .single()

  if (!report) return { title: 'Committee Report · Lobby Market' }

  const profile = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles
  const author = profile?.display_name ?? profile?.username ?? 'Anonymous'
  const recLabel = RECOMMENDATION_LABEL[report.recommendation] ?? ''
  const description = [report.summary.slice(0, 140), recLabel, `by ${author}`].filter(Boolean).join(' · ')

  return {
    title: `${report.title} · Lobby Market`,
    description,
    openGraph: {
      title: `${report.title} · Lobby Market`,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      publishedTime: report.created_at,
    },
    twitter: {
      card: 'summary',
      title: `${report.title} · Lobby Market`,
      description,
    },
  }
}

export default async function ReportPage({ params }: ReportPageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: report } = await supabase
    .from('civic_committee_reports')
    .select('*, profiles!civic_committee_reports_author_id_fkey(id, username, display_name, avatar_url, role)')
    .eq('id', params.id)
    .single()

  if (!report) notFound()
  if (report.status !== 'published' && report.author_id !== user?.id) notFound()

  // Increment view count (best-effort)
  await supabase
    .from('civic_committee_reports')
    .update({ view_count: report.view_count + 1 })
    .eq('id', params.id)

  const profile = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles

  // Topic statement if linked
  let topicStatement: string | null = null
  if (report.topic_id) {
    const { data: topic } = await supabase
      .from('topics')
      .select('statement')
      .eq('id', report.topic_id)
      .single()
    topicStatement = topic?.statement ?? null
  }

  // User endorsement status
  let userEndorsed = false
  if (user) {
    const { data: endorsement } = await supabase
      .from('civic_report_endorsements')
      .select('report_id')
      .eq('report_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()
    userEndorsed = !!endorsement
  }

  return (
    <ReportDetailClient
      report={{
        id: report.id,
        author_id: report.author_id,
        hearing_id: report.hearing_id,
        topic_id: report.topic_id,
        title: report.title,
        summary: report.summary,
        content: report.content,
        category: report.category,
        recommendation: report.recommendation as 'for' | 'against' | 'neutral' | 'hold',
        status: report.status as 'draft' | 'published' | 'archived',
        endorsement_count: report.endorsement_count,
        view_count: report.view_count,
        tags: report.tags ?? [],
        created_at: report.created_at,
        published_at: report.published_at,
        author: profile
          ? {
              id: profile.id,
              username: profile.username,
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
              role: profile.role,
            }
          : null,
        topic_statement: topicStatement,
        user_endorsed: userEndorsed,
      }}
      currentUserId={user?.id ?? null}
    />
  )
}
