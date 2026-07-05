import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AMAScheduleCalendar } from '@/components/ama/AMAScheduleCalendar'
import { cn } from '@/lib/utils/cn'
import type { AMASession, AMAHost } from '@/app/api/ama/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'AMA Schedule · Lobby Market',
  description:
    'Browse upcoming expert AMA sessions by date. See when civic experts are hosting, plan your participation, and RSVP to sessions in your areas of interest.',
  openGraph: {
    title: 'AMA Schedule · Lobby Market',
    description:
      'Monthly calendar of all upcoming expert Ask Me Anything sessions. Find out when top civic voices are taking questions.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'AMA Schedule · Lobby Market',
    description: 'When are the experts taking questions? Browse the full AMA calendar.',
  },
}

interface SessionWithHost extends AMASession {
  host: AMAHost | null
}

export default async function AMASchedulePage() {
  const supabase = await createClient()

  const now = new Date()
  const twoMonthsLater = new Date(now)
  twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2)

  // Fetch upcoming and live sessions for the next 2 months
  const { data: rows } = await supabase
    .from('ama_sessions')
    .select('*')
    .in('status', ['upcoming', 'live'])
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', twoMonthsLater.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(200)

  const sessions: SessionWithHost[] = []

  if (rows && rows.length > 0) {
    const hostIds = [...new Set(rows.map((r) => r.host_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', hostIds)

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? [])

    // Check current user RSVP status
    const { data: { user } } = await supabase.auth.getUser()
    let rsvpedSessionIds = new Set<string>()

    if (user) {
      const { data: rsvps } = await supabase
        .from('debate_rsvps')
        .select('debate_id')
        .eq('user_id', user.id)

      // Use ama_rsvps if it exists, otherwise skip
      const { data: amaRsvps } = await supabase
        .from('ama_rsvps')
        .select('session_id')
        .eq('user_id', user.id)

      if (amaRsvps) {
        rsvpedSessionIds = new Set(amaRsvps.map((r) => r.session_id))
      }
    }

    for (const row of rows) {
      sessions.push({
        ...row,
        host: profileMap.get(row.host_id) ?? null,
        user_rsvped: rsvpedSessionIds.has(row.id),
      } as SessionWithHost)
    }
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
              <CalendarDays className="h-4 w-4 text-purple flex-shrink-0" />
              <h1 className="font-mono text-xl font-bold text-white">AMA Schedule</h1>
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              {sessions.length} upcoming session{sessions.length !== 1 ? 's' : ''} · next 60 days
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/ama/request"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                'bg-purple/20 border border-purple/30 text-purple hover:bg-purple/30 transition-colors',
              )}
            >
              Request AMA
            </Link>
          </div>
        </div>

        {/* ── Calendar ── */}
        <AMAScheduleCalendar
          sessions={sessions}
          initialYear={now.getFullYear()}
          initialMonth={now.getMonth()}
        />
      </main>

      <BottomNav />
    </div>
  )
}
