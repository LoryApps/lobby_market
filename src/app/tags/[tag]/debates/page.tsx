import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Eye,
  Mic,
  Radio,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
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
    title: `Debates about #${tag} · Lobby Market`,
    description: `Live and upcoming civic debates tagged "${tag}" on Lobby Market — watch, RSVP, and take part.`,
    openGraph: {
      title: `#${tag} Debates · Lobby Market`,
      description: `Scheduled and live debates on topics tagged "${tag}".`,
      type: 'website',
      siteName: 'Lobby Market',
    },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDebateDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const absDiff = Math.abs(diff)
  const mins = Math.round(absDiff / 60_000)
  const hours = Math.round(absDiff / 3_600_000)
  const days = Math.round(absDiff / 86_400_000)

  if (diff > 0) {
    // future
    if (mins < 60) return `in ${mins}m`
    if (hours < 24) return `in ${hours}h`
    if (days < 7) return `in ${days}d`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } else {
    // past
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 30) return `${days}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  quick:     { label: 'Quick',    color: 'text-for-300',    bg: 'bg-for-500/10',    border: 'border-for-500/25'    },
  grand:     { label: 'Grand',    color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/25'       },
  tribunal:  { label: 'Tribunal', color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/25' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  scheduled: { label: 'Upcoming',  color: 'text-surface-400', dot: 'bg-surface-400', bg: 'bg-surface-300/30' },
  live:      { label: 'LIVE',      color: 'text-emerald',     dot: 'bg-emerald',     bg: 'bg-emerald/10'     },
  ended:     { label: 'Ended',     color: 'text-surface-500', dot: 'bg-surface-600', bg: 'bg-surface-200/50' },
  cancelled: { label: 'Cancelled', color: 'text-surface-600', dot: 'bg-surface-700', bg: 'bg-surface-200/30' },
}

interface TagDebate {
  id: string
  title: string
  description: string | null
  type: string
  status: string
  scheduled_at: string
  started_at: string | null
  ended_at: string | null
  viewer_count: number
  blue_sway: number
  red_sway: number
  topic: {
    id: string
    statement: string
    category: string | null
  } | null
  creator: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
  rsvp_count: number
  participant_count: number
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ── Debate card ───────────────────────────────────────────────────────────────

function DebateCard({ debate }: { debate: TagDebate }) {
  const type = TYPE_CONFIG[debate.type] ?? TYPE_CONFIG.quick
  const statusCfg = STATUS_CONFIG[debate.status] ?? STATUS_CONFIG.scheduled
  const isLive = debate.status === 'live'
  const isEnded = debate.status === 'ended'
  const catColor = debate.topic?.category ? (CATEGORY_COLOR[debate.topic.category] ?? 'text-surface-500') : 'text-surface-500'

  return (
    <Link
      href={`/debate/${debate.id}`}
      className={cn(
        'block rounded-2xl border transition-all duration-150 group',
        'bg-surface-100 hover:bg-surface-100/80',
        isLive
          ? 'border-emerald/30 hover:border-emerald/50 shadow-[0_0_0_1px_rgba(16,185,129,0.1)]'
          : 'border-surface-300 hover:border-surface-400',
      )}
    >
      <div className="p-4">
        {/* Status + type row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            {/* Live pulse */}
            {isLive && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
              </span>
            )}
            <span className={cn('text-xs font-mono font-semibold px-2 py-0.5 rounded-full border', statusCfg.color, statusCfg.bg)}>
              {statusCfg.label}
            </span>
            <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded-full border', type.color, type.bg, type.border)}>
              {type.label}
            </span>
          </div>

          {/* Scheduled / elapsed time */}
          <span className="text-[11px] font-mono text-surface-500 flex items-center gap-1">
            {isLive ? (
              <>
                <Eye className="h-3 w-3" />
                {debate.viewer_count.toLocaleString()} watching
              </>
            ) : isEnded ? (
              <>
                <Clock className="h-3 w-3" />
                {formatDebateDate(debate.ended_at ?? debate.scheduled_at)}
              </>
            ) : (
              <>
                <Calendar className="h-3 w-3" />
                {formatDebateDate(debate.scheduled_at)}
              </>
            )}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-white leading-snug mb-1 group-hover:text-for-300 transition-colors">
          {debate.title}
        </h3>

        {/* Topic reference */}
        {debate.topic && (
          <p className={cn('text-[11px] font-mono mb-2.5 line-clamp-1', catColor)}>
            {debate.topic.category && <span className="mr-1">{debate.topic.category} ·</span>}
            <span className="text-surface-500">{debate.topic.statement}</span>
          </p>
        )}

        {/* Sway bar (only for live/ended) */}
        {(isLive || isEnded) && (
          <div className="mb-2.5">
            <div className="flex h-1 rounded-full overflow-hidden bg-surface-300">
              <div
                className="bg-for-500 transition-all duration-500"
                style={{ width: `${debate.blue_sway}%` }}
              />
              <div
                className="bg-against-500 transition-all duration-500"
                style={{ width: `${100 - debate.blue_sway}%` }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] font-mono text-for-400">{debate.blue_sway}% FOR</span>
              <span className="text-[10px] font-mono text-against-400">{100 - debate.blue_sway}% AGAINST</span>
            </div>
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
            {debate.participant_count > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {debate.participant_count} debater{debate.participant_count !== 1 ? 's' : ''}
              </span>
            )}
            {!isLive && !isEnded && debate.rsvp_count > 0 && (
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-gold" />
                {debate.rsvp_count} RSVP{debate.rsvp_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-surface-600">
            {!isLive && !isEnded && formatFullDate(debate.scheduled_at)}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TagDebatesPage({ params, searchParams }: PageProps) {
  const tag = decodeURIComponent(params.tag).toLowerCase()
  const statusFilter = searchParams?.status ?? 'all'

  const supabase = await createClient()

  // Verify tag exists
  const { count: tagTopicCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .contains('tags', [tag])

  if (!tagTopicCount || tagTopicCount === 0) notFound()

  // Get topic IDs for this tag
  const { data: tagTopics } = await supabase
    .from('topics')
    .select('id')
    .contains('tags', [tag])
    .limit(200)

  const topicIds = (tagTopics ?? []).map((t) => t.id)

  if (topicIds.length === 0) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12">
          <EmptyState
            icon={Mic}
            title={`No debates tagged #${tag}`}
            description="Debates on topics with this tag will appear here."
            actions={[{ label: `Browse #${tag} topics`, href: `/tags/${encodeURIComponent(tag)}/topics` }]}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  // Fetch debates for these topics
  let debateQuery = supabase
    .from('debates')
    .select('id, title, description, type, status, scheduled_at, started_at, ended_at, viewer_count, blue_sway, red_sway, topic_id, creator_id')
    .in('topic_id', topicIds)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: false })
    .limit(80)

  if (statusFilter !== 'all') {
    const statusMap: Record<string, string> = {
      live: 'live',
      upcoming: 'scheduled',
      ended: 'ended',
    }
    const mapped = statusMap[statusFilter]
    if (mapped) debateQuery = debateQuery.eq('status', mapped)
  }

  const { data: rawDebates } = await debateQuery
  const debates = rawDebates ?? []

  // Fetch topics and creators in parallel
  const allTopicIds = Array.from(new Set(debates.map((d) => d.topic_id)))
  const allCreatorIds = Array.from(new Set(debates.map((d) => d.creator_id)))

  const [topicsRes, creatorsRes] = await Promise.all([
    allTopicIds.length
      ? supabase
          .from('topics')
          .select('id, statement, category')
          .in('id', allTopicIds)
      : Promise.resolve({ data: [] }),
    allCreatorIds.length
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', allCreatorIds)
      : Promise.resolve({ data: [] }),
  ])

  const topicMap = new Map((topicsRes.data ?? []).map((t) => [t.id, t]))
  const creatorMap = new Map((creatorsRes.data ?? []).map((c) => [c.id, c]))

  // Fetch RSVP + participant counts
  const debateIds = debates.map((d) => d.id)
  const [rsvpRes, participantRes] = await Promise.all([
    debateIds.length
      ? supabase
          .from('debate_rsvps')
          .select('debate_id')
          .in('debate_id', debateIds)
      : Promise.resolve({ data: [] }),
    debateIds.length
      ? supabase
          .from('debate_participants')
          .select('debate_id')
          .in('debate_id', debateIds)
      : Promise.resolve({ data: [] }),
  ])

  const rsvpCounts = new Map<string, number>()
  for (const r of rsvpRes.data ?? []) {
    rsvpCounts.set(r.debate_id, (rsvpCounts.get(r.debate_id) ?? 0) + 1)
  }
  const participantCounts = new Map<string, number>()
  for (const p of participantRes.data ?? []) {
    participantCounts.set(p.debate_id, (participantCounts.get(p.debate_id) ?? 0) + 1)
  }

  // Compose full debate objects
  const fullDebates: TagDebate[] = debates.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    type: d.type,
    status: d.status,
    scheduled_at: d.scheduled_at,
    started_at: d.started_at,
    ended_at: d.ended_at,
    viewer_count: d.viewer_count ?? 0,
    blue_sway: d.blue_sway ?? 50,
    red_sway: d.red_sway ?? 50,
    topic: topicMap.get(d.topic_id) ?? null,
    creator: creatorsMap(creatorMap, d.creator_id),
    rsvp_count: rsvpCounts.get(d.id) ?? 0,
    participant_count: participantCounts.get(d.id) ?? 0,
  }))

  // Sort: live first, then upcoming (soonest first), then ended (most recent first)
  fullDebates.sort((a, b) => {
    const order: Record<string, number> = { live: 0, scheduled: 1, ended: 2 }
    const ao = order[a.status] ?? 3
    const bo = order[b.status] ?? 3
    if (ao !== bo) return ao - bo
    if (a.status === 'scheduled') {
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    }
    return new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
  })

  const liveCount = fullDebates.filter((d) => d.status === 'live').length
  const upcomingCount = fullDebates.filter((d) => d.status === 'scheduled').length
  const endedCount = fullDebates.filter((d) => d.status === 'ended').length

  const STATUS_FILTERS = [
    { id: 'all',      label: `All (${debates.length})`,       color: 'text-surface-400' },
    { id: 'live',     label: `Live${liveCount > 0 ? ` (${liveCount})` : ''}`,         color: 'text-emerald' },
    { id: 'upcoming', label: `Upcoming (${upcomingCount})`,   color: 'text-for-400'    },
    { id: 'ended',    label: `Ended (${endedCount})`,         color: 'text-surface-500' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12">

        {/* Back */}
        <Link
          href={`/tags/${encodeURIComponent(tag)}`}
          className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          #{tag}
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mic className="h-4 w-4 text-purple" />
              <h1 className="text-lg font-bold text-white font-mono">
                #{tag} Debates
              </h1>
            </div>
            <p className="text-sm text-surface-500">
              {debates.length} debate{debates.length !== 1 ? 's' : ''} ·{' '}
              <Link
                href={`/tags/${encodeURIComponent(tag)}/topics`}
                className="hover:text-for-400 transition-colors"
              >
                {tagTopicCount} topic{tagTopicCount !== 1 ? 's' : ''}
              </Link>
              {' '}tagged #{tag}
            </p>
          </div>

          {liveCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald/10 border border-emerald/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
              </span>
              <span className="text-xs font-mono font-semibold text-emerald">
                {liveCount} LIVE
              </span>
            </div>
          )}
        </div>

        {/* Status filter tabs */}
        <div
          className="flex items-center gap-1.5 mb-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          aria-label="Filter debates by status"
        >
          {STATUS_FILTERS.map((sf) => (
            <Link
              key={sf.id}
              href={`/tags/${encodeURIComponent(tag)}/debates${sf.id !== 'all' ? `?status=${sf.id}` : ''}`}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-all',
                statusFilter === sf.id
                  ? sf.id === 'live'
                    ? 'bg-emerald/15 text-emerald border-emerald/40'
                    : sf.id === 'upcoming'
                      ? 'bg-for-500/15 text-for-300 border-for-500/30'
                      : 'bg-surface-300 text-white border-surface-400'
                  : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-300 hover:border-surface-400',
              )}
            >
              {sf.label}
            </Link>
          ))}
        </div>

        {/* Debate list */}
        {fullDebates.length === 0 ? (
          <EmptyState
            icon={Radio}
            title={
              statusFilter === 'live' ? 'No live debates right now'
              : statusFilter === 'upcoming' ? 'No upcoming debates'
              : statusFilter === 'ended' ? 'No ended debates'
              : `No debates tagged #${tag}`
            }
            description={
              statusFilter !== 'all'
                ? 'Try viewing all debates or check back later.'
                : 'When topics tagged with this tag get scheduled debates, they\'ll appear here.'
            }
            actions={statusFilter !== 'all' ? [{ label: 'View all debates', href: `/tags/${encodeURIComponent(tag)}/debates` }] : []}
          />
        ) : (
          <div className="space-y-3">
            {fullDebates.map((debate) => (
              <DebateCard key={debate.id} debate={debate} />
            ))}

            {/* Footer CTA */}
            <div className="pt-2 text-center">
              <Link
                href="/debate"
                className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-purple transition-colors"
              >
                <Mic className="h-3.5 w-3.5" />
                Browse all debates
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

// ── Helper to handle creator lookup ──────────────────────────────────────────

function creatorsMap(
  map: Map<string, { id: string; username: string; display_name: string | null; avatar_url: string | null }>,
  id: string,
) {
  return map.get(id) ?? null
}
