import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  Gavel,
  GitPullRequest,
  History,
  MessageSquare,
  Mic,
  Star,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TimelineEvent, TimelineEventType } from '@/app/api/laws/[id]/timeline/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface Props {
  params: { id: string }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, established_at, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Timeline · Lobby Market' }

  const stmt = law.statement ?? ''
  const short = `${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''}`
  const title = `Timeline: ${short} · Lobby Market`
  const year = new Date(law.established_at).getFullYear()
  const description =
    `The complete chronological journey of this law — from its initial proposal through ` +
    `community debate, voting, and formal establishment in ${year}. ` +
    (law.category ? `${law.category} · ` : '') +
    `${law.total_votes.toLocaleString()} votes cast.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
    },
    twitter: { card: 'summary', title, description },
    robots: { index: true },
  }
}

// ─── Event type config ─────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  TimelineEventType,
  {
    icon: React.ComponentType<{ className?: string }>
    color: string
    dot: string
    border: string
    bg: string
  }
> = {
  proposed: {
    icon: FileText,
    color: 'text-surface-400',
    dot: 'bg-surface-400',
    border: 'border-surface-300',
    bg: 'bg-surface-200/60',
  },
  activated: {
    icon: Zap,
    color: 'text-for-400',
    dot: 'bg-for-500',
    border: 'border-for-500/30',
    bg: 'bg-for-500/5',
  },
  voting_opened: {
    icon: Calendar,
    color: 'text-purple',
    dot: 'bg-purple',
    border: 'border-purple/30',
    bg: 'bg-purple/5',
  },
  milestone_60: {
    icon: TrendingUp,
    color: 'text-for-300',
    dot: 'bg-for-400',
    border: 'border-for-400/30',
    bg: 'bg-for-400/5',
  },
  milestone_75: {
    icon: TrendingUp,
    color: 'text-emerald',
    dot: 'bg-emerald',
    border: 'border-emerald/30',
    bg: 'bg-emerald/5',
  },
  milestone_90: {
    icon: Award,
    color: 'text-gold',
    dot: 'bg-gold',
    border: 'border-gold/30',
    bg: 'bg-gold/5',
  },
  established: {
    icon: Gavel,
    color: 'text-gold',
    dot: 'bg-gold',
    border: 'border-gold/50',
    bg: 'bg-gold/10',
  },
  amendment_proposed: {
    icon: GitPullRequest,
    color: 'text-purple',
    dot: 'bg-purple',
    border: 'border-purple/30',
    bg: 'bg-purple/5',
  },
  amendment_merged: {
    icon: CheckCircle2,
    color: 'text-emerald',
    dot: 'bg-emerald',
    border: 'border-emerald/30',
    bg: 'bg-emerald/5',
  },
  amendment_rejected: {
    icon: XCircle,
    color: 'text-against-400',
    dot: 'bg-against-500',
    border: 'border-against-500/30',
    bg: 'bg-against-500/5',
  },
  wiki_edit: {
    icon: Edit3,
    color: 'text-for-300',
    dot: 'bg-for-500/70',
    border: 'border-for-500/20',
    bg: 'bg-for-500/5',
  },
  review_posted: {
    icon: Star,
    color: 'text-gold',
    dot: 'bg-gold/70',
    border: 'border-gold/20',
    bg: 'bg-gold/5',
  },
  debate_held: {
    icon: Mic,
    color: 'text-against-400',
    dot: 'bg-against-500',
    border: 'border-against-500/30',
    bg: 'bg-against-500/5',
  },
  blueprint_created: {
    icon: BookOpen,
    color: 'text-for-400',
    dot: 'bg-for-500',
    border: 'border-for-500/30',
    bg: 'bg-for-500/5',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function daysApart(a: string, b: string): number {
  return Math.round(
    Math.abs(new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
  )
}

// ─── Event card (server component) ───────────────────────────────────────────

function EventCard({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.proposed
  const Icon = cfg.icon
  const isKeyMilestone =
    event.type === 'established' ||
    event.type === 'milestone_90' ||
    event.type === 'milestone_75'

  const inner = (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        cfg.border,
        cfg.bg,
        event.href && 'hover:brightness-125'
      )}
    >
      {/* Date */}
      <p className={cn('text-[11px] font-mono mb-1.5', cfg.color)}>
        {formatDateShort(event.date)}
      </p>

      {/* Header */}
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-surface-300/50">
          <Icon className={cn('h-3.5 w-3.5', cfg.color)} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'font-mono font-semibold leading-tight',
              isKeyMilestone ? 'text-sm text-white' : 'text-xs text-surface-200'
            )}
          >
            {event.title}
          </p>
        </div>
        {event.href && (
          <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        )}
      </div>

      {/* Body */}
      {event.body && (
        <p className="mt-2 text-[12px] text-surface-500 leading-relaxed pl-9">
          {event.body}
        </p>
      )}

      {/* Actor */}
      {event.actor && (
        <div className="flex items-center gap-1.5 mt-2.5 pl-9">
          <Avatar
            src={event.actor.avatar_url}
            fallback={event.actor.display_name || event.actor.username}
            size="xs"
          />
          <Link
            href={`/profile/${event.actor.username}`}
            className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            @{event.actor.username}
          </Link>
        </div>
      )}
    </div>
  )

  return (
    <div className="relative pl-14">
      {/* Vertical connector line */}
      {!isLast && (
        <div className="absolute left-5 top-5 bottom-[-24px] w-px bg-surface-300/40" />
      )}

      {/* Dot */}
      <div
        className={cn(
          'absolute left-[14px] top-4 h-3 w-3 rounded-full border-2 border-surface-100',
          cfg.dot
        )}
        aria-hidden="true"
      />

      {event.href ? (
        <Link href={event.href} className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  )
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function buildTimeline(lawId: string): Promise<{ law: {
  id: string; statement: string; category: string | null
  blue_pct: number; total_votes: number; established_at: string; topic_id: string
}; events: TimelineEvent[] } | null> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, topic_id, statement, category, blue_pct, total_votes, established_at, created_at')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) return null

  const { data: topic } = await supabase
    .from('topics')
    .select('id, created_at, activation_threshold')
    .eq('id', law.topic_id)
    .maybeSingle()

  const { data: amendments } = await supabase
    .from('law_amendments')
    .select('id, status, summary, created_at, proposer:profiles!proposer_id ( username, display_name, avatar_url )')
    .eq('law_id', lawId)
    .order('created_at', { ascending: true })
    .limit(20)

  const { data: wikiHistory } = await supabase
    .from('law_wiki_history')
    .select('id, created_at, editor:profiles!editor_id ( username, display_name, avatar_url )')
    .eq('law_id', lawId)
    .order('created_at', { ascending: true })
    .limit(20)

  const { data: reviews } = await supabase
    .from('law_reviews')
    .select('id, stars, body, created_at, reviewer:profiles!user_id ( username, display_name, avatar_url )')
    .eq('law_id', lawId)
    .order('created_at', { ascending: true })
    .limit(10)

  const { data: debates } = await supabase
    .from('debates')
    .select('id, title, format, status, scheduled_at, created_at')
    .eq('topic_id', law.topic_id)
    .order('scheduled_at', { ascending: true })
    .limit(10)

  const events: TimelineEvent[] = []

  const proposalDate = topic?.created_at ?? law.created_at
  events.push({
    id: `proposed-${law.id}`,
    type: 'proposed',
    date: proposalDate,
    title: 'Topic proposed',
    body: 'The debate topic was introduced to the Lobby for community support.',
    href: `/topic/${law.topic_id}`,
  })

  const establishedDate = new Date(law.established_at)
  const proposalDateObj = new Date(proposalDate)
  const totalMs = establishedDate.getTime() - proposalDateObj.getTime()

  if (totalMs > 24 * 60 * 60 * 1000) {
    events.push({
      id: `activated-${law.id}`,
      type: 'activated',
      date: new Date(proposalDateObj.getTime() + totalMs * 0.15).toISOString(),
      title: 'Debate activated',
      body: 'The topic gathered enough community support to move to the active debate phase.',
      href: `/topic/${law.topic_id}`,
    })

    events.push({
      id: `voting-${law.id}`,
      type: 'voting_opened',
      date: new Date(proposalDateObj.getTime() + totalMs * 0.70).toISOString(),
      title: 'Voting window opened',
      body: `The community opened a formal voting window. ${law.total_votes.toLocaleString()} citizens cast their votes.`,
      href: `/topic/${law.topic_id}`,
    })

    if (law.blue_pct >= 60) {
      events.push({
        id: `m60-${law.id}`,
        type: 'milestone_60',
        date: new Date(proposalDateObj.getTime() + totalMs * 0.78).toISOString(),
        title: '60% consensus reached',
        body: 'The proposal crossed the 60% FOR threshold, signaling broad community agreement.',
        href: `/topic/${law.topic_id}`,
      })
    }
    if (law.blue_pct >= 75) {
      events.push({
        id: `m75-${law.id}`,
        type: 'milestone_75',
        date: new Date(proposalDateObj.getTime() + totalMs * 0.87).toISOString(),
        title: '75% supermajority reached',
        body: 'Three-quarters of voters agreed, reaching supermajority consensus.',
        href: `/topic/${law.topic_id}`,
      })
    }
    if (law.blue_pct >= 90) {
      events.push({
        id: `m90-${law.id}`,
        type: 'milestone_90',
        date: new Date(proposalDateObj.getTime() + totalMs * 0.93).toISOString(),
        title: '90% near-unanimous support',
        body: 'The proposal achieved near-unanimous support across the community.',
        href: `/topic/${law.topic_id}`,
      })
    }
  }

  events.push({
    id: `established-${law.id}`,
    type: 'established',
    date: law.established_at,
    title: 'Established as Law',
    body: `The proposal was formally adopted with ${Math.round(law.blue_pct)}% FOR from ${law.total_votes.toLocaleString()} votes.`,
    href: `/law/${law.id}`,
  })

  for (const debate of debates ?? []) {
    const dateStr = (debate.scheduled_at ?? debate.created_at) as string
    events.push({
      id: `debate-${debate.id}`,
      type: 'debate_held',
      date: dateStr,
      title: `Debate: ${(debate.title as string | null) ?? `${(debate.format as string | null) ?? 'standard'} format`}`,
      body: (debate.status as string) === 'completed'
        ? 'A structured live debate was held on this topic.'
        : `A debate is ${(debate.status as string) === 'scheduled' ? 'scheduled' : 'live'} on this topic.`,
      href: `/debate/${debate.id}`,
    })
  }

  for (const amendment of amendments ?? []) {
    const proposer = Array.isArray(amendment.proposer) ? amendment.proposer[0] : amendment.proposer
    const typeMap: Record<string, TimelineEventType> = {
      merged: 'amendment_merged',
      rejected: 'amendment_rejected',
    }
    const evType: TimelineEventType = typeMap[(amendment.status as string)] ?? 'amendment_proposed'
    events.push({
      id: `amendment-${amendment.id}`,
      type: evType,
      date: amendment.created_at,
      title:
        amendment.status === 'merged' ? 'Amendment accepted'
        : amendment.status === 'rejected' ? 'Amendment rejected'
        : 'Amendment proposed',
      body: (amendment.summary as string | null)
        ? `${(amendment.summary as string).slice(0, 140)}${(amendment.summary as string).length > 140 ? '…' : ''}`
        : 'A citizen proposed a revision to this law.',
      actor: proposer ? {
        username: (proposer as { username: string }).username,
        display_name: (proposer as { display_name: string | null }).display_name,
        avatar_url: (proposer as { avatar_url: string | null }).avatar_url,
      } : null,
      href: `/law/${law.id}/amendments`,
    })
  }

  for (const edit of wikiHistory ?? []) {
    const editor = Array.isArray(edit.editor) ? edit.editor[0] : edit.editor
    events.push({
      id: `wiki-${edit.id}`,
      type: 'wiki_edit',
      date: edit.created_at,
      title: 'Wiki article edited',
      body: 'A citizen contributed to the collaborative wiki article for this law.',
      actor: editor ? {
        username: (editor as { username: string }).username,
        display_name: (editor as { display_name: string | null }).display_name,
        avatar_url: (editor as { avatar_url: string | null }).avatar_url,
      } : null,
      href: `/law/${law.id}/wiki`,
    })
  }

  for (const review of reviews ?? []) {
    const reviewer = Array.isArray(review.reviewer) ? review.reviewer[0] : review.reviewer
    const stars = (review.stars as number) ?? 0
    events.push({
      id: `review-${review.id}`,
      type: 'review_posted',
      date: review.created_at,
      title: `Community review — ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`,
      body: (review.body as string | null)
        ? `${(review.body as string).slice(0, 140)}${(review.body as string).length > 140 ? '…' : ''}`
        : 'A citizen left a star review for this law.',
      actor: reviewer ? {
        username: (reviewer as { username: string }).username,
        display_name: (reviewer as { display_name: string | null }).display_name,
        avatar_url: (reviewer as { avatar_url: string | null }).avatar_url,
      } : null,
      meta: { stars },
      href: `/law/${law.id}/reviews`,
    })
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  return {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct,
      total_votes: law.total_votes,
      established_at: law.established_at,
      topic_id: law.topic_id,
    },
    events,
  }
}

// ─── Category color map ───────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LawTimelinePage({ params }: Props) {
  const data = await buildTimeline(params.id)
  if (!data) notFound()

  const { law, events } = data
  const proposalDate = events.find((e) => e.type === 'proposed')?.date ?? law.established_at
  const journeyDays = daysApart(proposalDate, law.established_at)
  const categoryColor = law.category ? (CATEGORY_COLORS[law.category] ?? 'text-surface-400') : 'text-surface-400'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back navigation ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/law/${law.id}`}
            aria-label="Back to law"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-base font-mono font-bold text-white leading-tight">
              Law Timeline
            </h1>
            <p className="text-xs font-mono text-surface-500">
              The full journey — proposal to law
            </p>
          </div>
        </div>

        {/* ── Law card ──────────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-100 border border-gold/25 p-5 mb-8">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Gavel className="h-4 w-4 text-gold flex-shrink-0" aria-hidden="true" />
              <Badge variant="law">Established Law</Badge>
              {law.category && (
                <span className={cn('text-xs font-mono', categoryColor)}>
                  {law.category}
                </span>
              )}
            </div>
          </div>

          <p className="text-base font-mono font-semibold text-white leading-snug mb-4">
            {law.statement}
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-mono text-surface-500">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Established{' '}
                <time dateTime={law.established_at}>
                  {formatDate(law.established_at)}
                </time>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{law.total_votes.toLocaleString()} votes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{Math.round(law.blue_pct)}% FOR</span>
            </div>
            {journeyDays > 0 && (
              <div className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{journeyDays}-day journey</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Event count ───────────────────────────────────────────────────── */}
        {events.length > 0 && (
          <p className="text-[11px] font-mono text-surface-600 mb-5 uppercase tracking-wider">
            {events.length} events in the record
          </p>
        )}

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        {events.length === 0 ? (
          <EmptyState
            icon={History}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="No timeline data yet"
            description="Events will appear here as the law record grows — amendments, wiki edits, reviews, and debates."
          />
        ) : (
          <div className="relative space-y-6">
            {events.map((event, i) => (
              <EventCard
                key={event.id}
                event={event}
                isLast={i === events.length - 1}
              />
            ))}

            {/* End cap */}
            <div className="pl-14">
              <div className="relative">
                <div className="absolute left-[-24px] top-2 h-3 w-3 rounded-full bg-surface-400/40 border-2 border-surface-100" />
                <p className="text-[11px] font-mono text-surface-600">
                  Ongoing — amendments and community notes continue to shape this law
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Related links ─────────────────────────────────────────────────── */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { href: `/law/${law.id}`, label: 'Full text', icon: FileText },
            { href: `/law/${law.id}/wiki`, label: 'Wiki', icon: Edit3 },
            { href: `/law/${law.id}/amendments`, label: 'Amendments', icon: GitPullRequest },
            { href: `/law/${law.id}/reviews`, label: 'Reviews', icon: Star },
            { href: `/law/${law.id}/debate`, label: 'Original debate', icon: Mic },
            { href: `/law/${law.id}/impact`, label: 'Impact', icon: TrendingUp },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              <Icon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
