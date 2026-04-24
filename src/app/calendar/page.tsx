import type { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, Gavel, Mic, Plus, Vote } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { CivicCalendar } from '@/components/calendar/CivicCalendar'
import type { CivicEvent } from '@/components/calendar/CivicCalendar'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Civic Calendar · Lobby Market',
  description:
    'See all upcoming debates, topic voting windows, and recently established laws on a monthly calendar.',
  openGraph: {
    title: 'Civic Calendar · Lobby Market',
    description: 'Every debate, vote deadline, and law in one place.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Calendar · Lobby Market',
    description: 'Upcoming debates, voting windows, and new laws — all on one calendar.',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowPlusMonths(n: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + n)
  return d.toISOString()
}

function nowMinusDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
}: {
  icon: typeof Calendar
  iconColor: string
  iconBg: string
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3">
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <p className="text-lg font-mono font-bold text-white">{value}</p>
        <p className="text-xs font-mono text-surface-500">{label}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CivicCalendarPage() {
  const supabase = await createClient()

  const now = new Date()
  const initialYear = now.getFullYear()
  const initialMonth = now.getMonth()

  const threeMonthsOut = nowPlusMonths(3)
  const thirtyDaysAgo = nowMinusDays(30)

  // Fetch all data in parallel
  const [debatesRes, votingTopicsRes, lawsRes] = await Promise.all([
    // Upcoming and live debates
    supabase
      .from('debates')
      .select('id, title, type, status, scheduled_at, topic_id')
      .in('status', ['scheduled', 'live'])
      .gte('scheduled_at', nowMinusDays(1))
      .lte('scheduled_at', threeMonthsOut)
      .order('scheduled_at', { ascending: true })
      .limit(200),

    // Topics currently in voting phase (voting_ends_at within next 30 days)
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, voting_ends_at')
      .eq('status', 'voting')
      .not('voting_ends_at', 'is', null)
      .lte('voting_ends_at', threeMonthsOut)
      .order('voting_ends_at', { ascending: true })
      .limit(100),

    // Recently established laws (last 30 days)
    supabase
      .from('laws')
      .select('id, statement, category, established_at')
      .eq('is_active', true)
      .gte('established_at', thirtyDaysAgo)
      .order('established_at', { ascending: false })
      .limit(100),
  ])

  const debates = debatesRes.data ?? []
  const votingTopics = votingTopicsRes.data ?? []
  const laws = lawsRes.data ?? []

  // Build unified event list
  const events: CivicEvent[] = []

  for (const d of debates) {
    events.push({
      id: `debate-${d.id}`,
      type: 'debate',
      title: d.title,
      href: `/debate/${d.id}`,
      at: d.scheduled_at,
      category: null,
      debateType: d.type === 'grand' ? 'Grand Debate' : d.type === 'tribunal' ? 'Tribunal' : 'Quick Debate',
    })
  }

  for (const t of votingTopics) {
    const topic = t as {
      id: string
      statement: string
      category: string | null
      blue_pct: number
      voting_ends_at: string | null
    }
    if (!topic.voting_ends_at) continue
    events.push({
      id: `vote-end-${topic.id}`,
      type: 'vote_end',
      title: topic.statement,
      href: `/topic/${topic.id}`,
      at: topic.voting_ends_at,
      category: topic.category,
      votePct: Math.round(topic.blue_pct),
    })
  }

  for (const law of laws) {
    const l = law as {
      id: string
      statement: string
      category: string | null
      established_at: string
    }
    events.push({
      id: `law-${l.id}`,
      type: 'law',
      title: l.statement,
      href: `/law/${l.id}`,
      at: l.established_at,
      category: l.category,
    })
  }

  // Sort all events chronologically
  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  // Upcoming counts (next 7 days)
  const sevenDaysOut = new Date()
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)
  const upcomingDebates = debates.filter(
    (d) => new Date(d.scheduled_at) <= sevenDaysOut
  ).length
  const upcomingVotes = votingTopics.filter(
    (t) => {
      const topic = t as { voting_ends_at: string | null }
      return topic.voting_ends_at && new Date(topic.voting_ends_at) <= sevenDaysOut
    }
  ).length
  const recentLaws = laws.length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-for-500/10 border border-for-500/20 flex-shrink-0">
              <Calendar className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="text-2xl font-mono font-bold text-white">Civic Calendar</h1>
              <p className="text-sm text-surface-500 mt-0.5 font-mono">
                Debates, voting windows &amp; new laws
              </p>
            </div>
          </div>

          <Link
            href="/debate/create"
            className={cn(
              'hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg flex-shrink-0',
              'bg-purple/10 border border-purple/30 text-purple',
              'hover:bg-purple/20 transition-colors text-xs font-mono font-medium'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            Schedule Debate
          </Link>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard
            icon={Mic}
            iconColor="text-purple"
            iconBg="bg-purple/10 border border-purple/20"
            label="Debates this week"
            value={upcomingDebates}
          />
          <StatCard
            icon={Vote}
            iconColor="text-gold"
            iconBg="bg-gold/10 border border-gold/20"
            label="Votes closing"
            value={upcomingVotes}
          />
          <StatCard
            icon={Gavel}
            iconColor="text-emerald"
            iconBg="bg-emerald/10 border border-emerald/20"
            label="Laws (30d)"
            value={recentLaws}
          />
        </div>

        {/* Calendar */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 sm:p-6">
          <CivicCalendar
            events={events}
            initialYear={initialYear}
            initialMonth={initialMonth}
          />
        </div>

        {/* Quick links */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/debate/calendar"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors text-xs font-mono"
          >
            <Mic className="h-3.5 w-3.5" />
            Debate Calendar (with RSVP)
          </Link>
          <Link
            href="/law"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors text-xs font-mono"
          >
            <Gavel className="h-3.5 w-3.5" />
            Law Codex
          </Link>
          <Link
            href="/senate"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors text-xs font-mono"
          >
            <Vote className="h-3.5 w-3.5" />
            Live Senate Floor
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
