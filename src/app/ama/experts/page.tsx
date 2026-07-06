import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AMAExpertsGrid } from '@/components/ama/AMAExpertsGrid'
import { cn } from '@/lib/utils/cn'
import type { AMAHost } from '@/app/api/ama/route'
import type { ExpertWithStats } from '@/components/ama/AMAExpertsGrid'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'AMA Experts · Lobby Market',
  description:
    'Browse civic experts who host Ask Me Anything sessions. Filter by category, view session history, and RSVP to upcoming sessions.',
  openGraph: {
    title: 'AMA Experts · Lobby Market',
    description:
      'Discover civic experts by category. See who has hosted AMA sessions, their answers given, and when they\'re hosting next.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'AMA Experts · Lobby Market',
    description: 'Browse civic experts who host Ask Me Anything sessions by category.',
  },
}

export default async function AMAExpertsPage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('ama_sessions')
    .select('host_id, status, answer_count, question_count, rsvp_count, category, scheduled_at')
    .in('status', ['ended', 'upcoming', 'live'])
    .order('scheduled_at', { ascending: false })
    .limit(500)

  const experts: ExpertWithStats[] = []

  if (rows && rows.length > 0) {
    type HostStats = {
      totalSessions: number
      endedSessions: number
      upcomingSessions: number
      totalAnswers: number
      totalQuestions: number
      totalRsvps: number
      categories: Set<string>
      lastSessionAt: string | null
      nextSessionAt: string | null
    }

    const hostMap = new Map<string, HostStats>()

    for (const row of rows) {
      if (!hostMap.has(row.host_id)) {
        hostMap.set(row.host_id, {
          totalSessions: 0,
          endedSessions: 0,
          upcomingSessions: 0,
          totalAnswers: 0,
          totalQuestions: 0,
          totalRsvps: 0,
          categories: new Set(),
          lastSessionAt: null,
          nextSessionAt: null,
        })
      }
      const stats = hostMap.get(row.host_id)!
      stats.totalSessions++
      if (row.status === 'ended') {
        stats.endedSessions++
        if (!stats.lastSessionAt || row.scheduled_at > stats.lastSessionAt) {
          stats.lastSessionAt = row.scheduled_at
        }
      }
      if (row.status === 'upcoming' || row.status === 'live') {
        stats.upcomingSessions++
        if (!stats.nextSessionAt || row.scheduled_at < stats.nextSessionAt) {
          stats.nextSessionAt = row.scheduled_at
        }
      }
      stats.totalAnswers += row.answer_count ?? 0
      stats.totalQuestions += row.question_count ?? 0
      stats.totalRsvps += row.rsvp_count ?? 0
      if (row.category) stats.categories.add(row.category)
    }

    const hostIds = [...hostMap.keys()]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', hostIds)

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? [])

    for (const [hostId, stats] of hostMap.entries()) {
      const profile = profileMap.get(hostId)
      if (!profile) continue
      experts.push({
        host: profile as AMAHost,
        totalSessions: stats.totalSessions,
        endedSessions: stats.endedSessions,
        upcomingSessions: stats.upcomingSessions,
        totalAnswers: stats.totalAnswers,
        totalQuestions: stats.totalQuestions,
        totalRsvps: stats.totalRsvps,
        categories: [...stats.categories],
        lastSessionAt: stats.lastSessionAt,
        nextSessionAt: stats.nextSessionAt,
      })
    }

    experts.sort((a, b) => {
      if (b.endedSessions !== a.endedSessions) return b.endedSessions - a.endedSessions
      return b.totalRsvps - a.totalRsvps
    })
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-5 pb-24 md:pb-8 space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Link
            href="/ama"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to AMA"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple flex-shrink-0" />
              <h1 className="font-mono text-xl font-bold text-white">AMA Experts</h1>
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              {experts.length} expert{experts.length !== 1 ? 's' : ''} · browse by category
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/ama/schedule"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                'bg-surface-200 border border-surface-300 text-surface-400 hover:bg-surface-300 hover:text-white transition-colors',
              )}
            >
              Schedule
            </Link>
          </div>
        </div>

        {/* ── Grid ── */}
        <AMAExpertsGrid experts={experts} />
      </main>

      <BottomNav />
    </div>
  )
}
