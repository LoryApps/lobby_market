import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  Mic,
  Radio,
  Tag,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { tag: string }
  searchParams?: { status?: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tag = decodeURIComponent(params.tag)
  return {
    title: `AMA Sessions about #${tag} · Lobby Market`,
    description: `Browse Ask Me Anything sessions related to civic debates tagged "${tag}" on Lobby Market.`,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_CONFIG = {
  upcoming: {
    label: 'Upcoming',
    pill: 'bg-for-500/10 text-for-400 border-for-500/30',
    dot: 'bg-for-400',
  },
  live: {
    label: 'Live Now',
    pill: 'bg-against-500/10 text-against-300 border-against-500/30',
    dot: 'bg-against-400 animate-pulse',
  },
  ended: {
    label: 'Ended',
    pill: 'bg-surface-300/20 text-surface-500 border-surface-400/30',
    dot: 'bg-surface-500',
  },
  cancelled: {
    label: 'Cancelled',
    pill: 'bg-surface-300/10 text-surface-600 border-surface-500/20',
    dot: 'bg-surface-600',
  },
}

const CATEGORY_PILL: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-against-500/10 text-against-300 border-against-500/30',
  Philosophy:  'bg-for-500/5 text-for-300 border-for-500/20',
  Culture:     'bg-gold/10 text-gold border-gold/30',
  Health:      'bg-against-500/10 text-against-300 border-against-500/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-purple/10 text-purple border-purple/30',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TagAMAPage({ params, searchParams }: PageProps) {
  const tag    = decodeURIComponent(params.tag).toLowerCase()
  const status = searchParams?.status ?? 'all'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verify the tag exists
  const { count: topicCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .contains('tags', [tag])

  if (!topicCount) notFound()

  // Determine top categories for this tag
  const { data: taggedTopics } = await supabase
    .from('topics')
    .select('category')
    .contains('tags', [tag])
    .limit(500)

  const catCounts = new Map<string, number>()
  for (const topic of taggedTopics ?? []) {
    if (topic.category) {
      catCounts.set(topic.category, (catCounts.get(topic.category) ?? 0) + 1)
    }
  }
  const topCategories = Array.from(catCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat)

  // Fetch AMA sessions in those categories
  type AMASessions = {
    id: string
    host_id: string
    title: string
    description: string | null
    category: string | null
    scheduled_at: string
    started_at: string | null
    ended_at: string | null
    status: 'upcoming' | 'live' | 'ended' | 'cancelled'
    question_count: number
    answer_count: number
    rsvp_count: number
    created_at: string
  }[]

  let sessions: AMASessions = []
  let totalCount = 0

  if (topCategories.length > 0) {
    let query = supabase
      .from('ama_sessions')
      .select('*', { count: 'exact' })
      .in('category', topCategories)
      .order('scheduled_at', { ascending: false })

    if (status !== 'all') {
      query = query.eq('status', status)
    } else {
      query = query.in('status', ['upcoming', 'live', 'ended'])
    }

    query = query.limit(30)

    const { data: rows, count } = await query
    sessions = (rows ?? []) as AMASessions
    totalCount = count ?? 0
  }

  // Fetch host profiles
  const hostIds = [...new Set(sessions.map((s) => s.host_id))]
  const { data: profiles } = hostIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .in('id', hostIds)
    : { data: [] }
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  // Fetch user RSVPs
  let rsvpedIds = new Set<string>()
  if (user && sessions.length > 0) {
    const sessionIds = sessions.map((s) => s.id)
    const { data: rsvps } = await supabase
      .from('ama_rsvps')
      .select('session_id')
      .eq('user_id', user.id)
      .in('session_id', sessionIds)
    rsvpedIds = new Set((rsvps ?? []).map((r) => r.session_id))
  }

  const enriched = sessions.map((s) => ({
    ...s,
    host: profileMap.get(s.host_id) ?? null,
    user_rsvped: rsvpedIds.has(s.id),
  }))

  // Group by status for display ordering: live first, then upcoming, then ended
  const live     = enriched.filter((s) => s.status === 'live')
  const upcoming = enriched.filter((s) => s.status === 'upcoming')
  const ended    = enriched.filter((s) => s.status === 'ended')

  const statusOpts = [
    { id: 'all',      label: 'All' },
    { id: 'live',     label: 'Live' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'ended',    label: 'Past' },
  ]

  function statusHref(s: string) {
    if (s === 'all') return `/tags/${encodeURIComponent(tag)}/ama`
    return `/tags/${encodeURIComponent(tag)}/ama?status=${s}`
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Breadcrumb ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6 text-xs font-mono text-surface-500">
          <Link href="/tags" className="hover:text-surface-300 transition-colors">
            Tags
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/tags/${encodeURIComponent(tag)}`} className="hover:text-surface-300 transition-colors">
            #{tag}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-surface-300">AMA Sessions</span>
        </div>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <Mic className="h-5 w-5 text-purple" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                #{tag} AMAs
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {totalCount} session{totalCount !== 1 ? 's' : ''}
                {live.length > 0 && (
                  <span className="text-against-300 ml-2">· {live.length} live</span>
                )}
                {upcoming.length > 0 && (
                  <span className="text-for-400 ml-2">· {upcoming.length} upcoming</span>
                )}
              </p>
            </div>
          </div>

          <Link
            href={`/tags/${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all flex-shrink-0"
          >
            <Tag className="h-3.5 w-3.5" />
            Debates
          </Link>
        </div>

        {/* ── Category context ──────────────────────────────────────────── */}
        {topCategories.length > 0 && (
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="text-xs font-mono text-surface-600">Matched via:</span>
            {topCategories.map((cat) => (
              <span
                key={cat}
                className={cn(
                  'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono border',
                  CATEGORY_PILL[cat] ?? 'bg-surface-200 text-surface-400 border-surface-300',
                )}
              >
                {cat}
              </span>
            ))}
          </div>
        )}

        {/* ── Status filter ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-6 flex-wrap">
          {statusOpts.map((opt) => (
            <Link
              key={opt.id}
              href={statusHref(opt.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs border transition-all',
                status === opt.id
                  ? 'bg-surface-300/40 text-white border-surface-400'
                  : 'bg-surface-200/50 text-surface-500 border-surface-300 hover:text-surface-300',
              )}
            >
              {opt.label}
            </Link>
          ))}
        </div>

        {/* ── Sessions list ─────────────────────────────────────────────── */}
        {enriched.length === 0 ? (
          <EmptyState
            icon={Mic}
            title={`No AMA sessions for #${tag} yet`}
            description={
              topCategories.length === 0
                ? `We could not find civic categories for "${tag}" — try a more specific tag.`
                : `No ${status !== 'all' ? status + ' ' : ''}AMA sessions in the ${topCategories.join(', ')} categories.`
            }
            actions={[
              { label: `Browse #${tag} debates`, href: `/tags/${encodeURIComponent(tag)}` },
              { label: 'All AMA sessions', href: '/ama' },
            ]}
          />
        ) : (
          <div className="space-y-4">
            {/* Live sessions first */}
            {live.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Radio className="h-3.5 w-3.5 text-against-400 animate-pulse" />
                  <span className="text-xs font-mono font-semibold text-against-300 uppercase tracking-wider">
                    Live Now
                  </span>
                </div>
                <div className="space-y-3">
                  {live.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      rsvped={session.user_rsvped}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming */}
            {upcoming.length > 0 && (
              <section>
                {(live.length > 0) && (
                  <div className="flex items-center gap-2 mb-3 mt-5">
                    <CalendarDays className="h-3.5 w-3.5 text-for-400" />
                    <span className="text-xs font-mono font-semibold text-for-400 uppercase tracking-wider">
                      Upcoming
                    </span>
                  </div>
                )}
                <div className="space-y-3">
                  {upcoming.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      rsvped={session.user_rsvped}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Past */}
            {ended.length > 0 && (
              <section>
                {(live.length > 0 || upcoming.length > 0) && (
                  <div className="flex items-center gap-2 mb-3 mt-5">
                    <MessageSquare className="h-3.5 w-3.5 text-surface-500" />
                    <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                      Past Sessions
                    </span>
                  </div>
                )}
                <div className="space-y-3">
                  {ended.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      rsvped={session.user_rsvped}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Bottom links ──────────────────────────────────────────────── */}
        {enriched.length > 0 && (
          <div className="mt-6 pt-5 border-t border-surface-200 flex items-center justify-between text-xs font-mono text-surface-500">
            <Link
              href={`/tags/${encodeURIComponent(tag)}`}
              className="flex items-center gap-1.5 hover:text-surface-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to #{tag} debates
            </Link>
            <Link
              href="/ama"
              className="flex items-center gap-1.5 hover:text-surface-300 transition-colors"
            >
              All AMA sessions
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}

// ── Session card ──────────────────────────────────────────────────────────────

type SessionCardSession = {
  id: string
  title: string
  description: string | null
  category: string | null
  scheduled_at: string
  started_at: string | null
  ended_at: string | null
  status: 'upcoming' | 'live' | 'ended' | 'cancelled'
  question_count: number
  answer_count: number
  rsvp_count: number
  host: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
}

function SessionCard({
  session,
  rsvped,
}: {
  session: SessionCardSession
  rsvped: boolean
}) {
  const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.ended

  return (
    <Link
      href={`/ama/${session.id}`}
      className="group block bg-surface-100/50 hover:bg-surface-100 border border-surface-200 hover:border-surface-300 rounded-xl p-4 transition-all"
    >
      {/* Status + category */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono border',
            cfg.pill,
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
            {cfg.label}
          </span>

          {session.category && (
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border',
              CATEGORY_PILL[session.category] ?? 'bg-surface-200 text-surface-400 border-surface-300',
            )}>
              {session.category}
            </span>
          )}
        </div>

        {rsvped && (
          <span className="text-[10px] font-mono text-for-400/70 flex items-center gap-1">
            <span>✓</span> RSVP&apos;d
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-mono text-sm font-semibold text-white leading-snug mb-1.5 group-hover:text-surface-100 transition-colors line-clamp-2">
        {session.title}
      </h3>

      {/* Description */}
      {session.description && (
        <p className="text-xs font-mono text-surface-500 mb-3 line-clamp-2 leading-relaxed">
          {session.description}
        </p>
      )}

      {/* Host + time + stats */}
      <div className="flex items-center justify-between gap-3 mt-1 flex-wrap">
        {session.host ? (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar
              src={session.host.avatar_url}
              username={session.host.username}
              size={20}
              className="flex-shrink-0"
            />
            <span className="font-mono text-xs text-surface-400 truncate">
              {session.host.display_name ?? session.host.username}
            </span>
            {session.host.clout > 0 && (
              <span className="font-mono text-[10px] text-gold/60 flex-shrink-0">
                {session.host.clout.toLocaleString()} clout
              </span>
            )}
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3 text-[10px] font-mono text-surface-600 flex-shrink-0">
          {session.status === 'upcoming' && (
            <span className="flex items-center gap-1 text-for-400/70">
              <CalendarDays className="h-3 w-3" />
              {formatDate(session.scheduled_at)}
            </span>
          )}
          {session.status === 'ended' && session.ended_at && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {relativeTime(session.ended_at)}
            </span>
          )}
          {session.rsvp_count > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {session.rsvp_count}
            </span>
          )}
          {session.question_count > 0 && (
            <span className="flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              {session.question_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
