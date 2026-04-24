import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { BriefVotePanel } from './BriefVotePanel'
import { TopicAIBrief } from '@/components/topic/TopicAIBrief'
import type { Topic, Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

interface BriefPageProps {
  params: { id: string }
}

// ── Argument rows from DB ─────────────────────────────────────────────────────

interface BriefArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: BriefPageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, total_votes, blue_pct')
    .eq('id', params.id)
    .single()

  if (!topic) return { title: 'Reading Brief · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const description =
    `Informed voter's brief for: ${topic.statement} · ` +
    `${forPct}% For / ${againstPct}% Against · ` +
    `${(topic.total_votes ?? 0).toLocaleString()} votes cast`

  const title = `Brief: ${topic.statement.slice(0, 80)} · Lobby Market`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/topic/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/topic/${params.id}`],
    },
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Established Law',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
  archived: 'proposed',
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncateWords(text: string, max: number): string {
  const words = text.split(/\s+/)
  if (words.length <= max) return text
  return words.slice(0, max).join(' ') + '…'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function VoteBar({ forPct, totalVotes }: { forPct: number; totalVotes: number }) {
  const against = 100 - forPct
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="text-center">
          <div className="font-mono text-2xl font-bold text-for-400">{Math.round(forPct)}%</div>
          <div className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">For</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Scale className="h-4 w-4 text-surface-500" />
          <div className="text-[10px] font-mono text-surface-600">
            {(totalVotes ?? 0).toLocaleString()} votes
          </div>
        </div>
        <div className="text-center">
          <div className="font-mono text-2xl font-bold text-against-400">{Math.round(against)}%</div>
          <div className="text-[11px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">Against</div>
        </div>
      </div>
      <div className="h-3 w-full rounded-full overflow-hidden bg-surface-300 flex">
        <div
          className="h-full bg-for-500 transition-all duration-500"
          style={{ width: `${forPct}%` }}
        />
        <div
          className="h-full bg-against-500 transition-all duration-500"
          style={{ width: `${against}%` }}
        />
      </div>
    </div>
  )
}

function ArgumentCard({ arg, position }: { arg: BriefArgument; position: number }) {
  const isFor = arg.side === 'blue'
  return (
    <div
      className={cn(
        'py-4 border-b last:border-0',
        isFor ? 'border-surface-300' : 'border-surface-300'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Position number */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-mono font-bold mt-0.5',
            isFor
              ? 'bg-for-600/20 text-for-400 border border-for-600/30'
              : 'bg-against-600/20 text-against-400 border border-against-600/30'
          )}
        >
          {position}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-700 leading-relaxed">{arg.content}</p>

          <div className="flex items-center gap-3 mt-2">
            {arg.author && (
              <Link
                href={`/profile/${arg.author.username}`}
                className="flex items-center gap-1.5 group"
              >
                <Avatar
                  src={arg.author.avatar_url}
                  fallback={arg.author.display_name || arg.author.username}
                  size="xs"
                />
                <span className="text-[11px] font-mono text-surface-500 group-hover:text-surface-300 transition-colors truncate max-w-[120px]">
                  @{arg.author.username}
                </span>
              </Link>
            )}
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-600">
              <ThumbsUp className="h-3 w-3" aria-hidden />
              {arg.upvotes}
            </span>
            <span className="text-[11px] font-mono text-surface-600 ml-auto">
              {relativeTime(arg.created_at)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeading({
  side,
  count,
}: {
  side: 'for' | 'against'
  count: number
}) {
  const isFor = side === 'for'
  return (
    <div
      className={cn(
        'flex items-center gap-2 mb-1 pb-3 border-b',
        isFor ? 'border-for-600/30' : 'border-against-600/30'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center h-7 w-7 rounded-lg',
          isFor ? 'bg-for-600/15 border border-for-600/30' : 'bg-against-600/15 border border-against-600/30'
        )}
      >
        {isFor ? (
          <ThumbsUp className="h-3.5 w-3.5 text-for-400" aria-hidden />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5 text-against-400" aria-hidden />
        )}
      </div>
      <div>
        <h2
          className={cn(
            'font-mono text-sm font-bold uppercase tracking-wider',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          {isFor ? 'The Case For' : 'The Case Against'}
        </h2>
        <p className="text-[10px] font-mono text-surface-500">
          {count} argument{count !== 1 ? 's' : ''} · top by upvotes
        </p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TopicBriefPage({ params }: BriefPageProps) {
  const supabase = await createClient()

  // Fetch topic
  const { data: topicRaw, error: topicError } = await supabase
    .from('topics')
    .select('*')
    .eq('id', params.id)
    .single()

  if (topicError || !topicRaw) notFound()

  const topic = topicRaw as Topic

  // Fetch top arguments (up to 6 per side)
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, created_at, user_id')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30)

  const rawArgs = argsRaw ?? []

  // Batch-fetch authors
  const userIds = Array.from(new Set(rawArgs.map((a: { user_id: string }) => a.user_id)))
  const { data: profiles } = userIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', userIds)
    : { data: [] }

  const profileMap = new Map<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>>()
  for (const p of profiles ?? []) {
    profileMap.set(p.id, p)
  }

  const allArgs: BriefArgument[] = rawArgs.map((a: {
    id: string
    content: string
    side: string
    upvotes: number
    created_at: string
    user_id: string
  }) => ({
    id: a.id,
    content: a.content,
    side: a.side as 'blue' | 'red',
    upvotes: a.upvotes,
    created_at: a.created_at,
    author: profileMap.get(a.user_id) ?? null,
  }))

  const forArgs = allArgs.filter((a) => a.side === 'blue').slice(0, 5)
  const againstArgs = allArgs.filter((a) => a.side === 'red').slice(0, 5)

  const forPct = topic.blue_pct ?? 50
  const totalVotes = topic.total_votes ?? 0
  const isVotable = topic.status === 'active' || topic.status === 'voting'
  const hasContext = !!topic.description?.trim()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-14" id="main-content">

        {/* ── Back navigation ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-7">
          <Link
            href={`/topic/${params.id}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Reading Brief</p>
            <p className="text-[10px] font-mono text-surface-600 mt-0.5">Informed voter&apos;s guide</p>
          </div>
          <Link
            href={`/topic/${params.id}`}
            className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
            aria-label="View full topic page"
          >
            Full page
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* ── Status strip ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
            {STATUS_LABEL[topic.status] ?? topic.status}
          </Badge>
          {topic.category && (
            <Link
              href={`/topic/categories/${topic.category.toLowerCase()}`}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-surface-200 border border-surface-300 text-surface-500 hover:text-surface-300 hover:border-surface-400 transition-colors"
            >
              {topic.category}
            </Link>
          )}
          {topic.scope && topic.scope !== 'Global' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-surface-200 border border-surface-300 text-surface-500">
              {topic.scope}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-600">
            <Users className="h-3 w-3" aria-hidden />
            {totalVotes.toLocaleString()} votes
          </span>
        </div>

        {/* ── Topic statement ──────────────────────────────────────────────── */}
        <h1 className="font-mono text-2xl font-bold text-white leading-tight mb-6">
          {topic.statement}
        </h1>

        {/* ── Vote split bar ───────────────────────────────────────────────── */}
        <VoteBar forPct={forPct} totalVotes={totalVotes} />

        {/* ── AI Debate Brief ─────────────────────────────────────────────── */}
        <TopicAIBrief topicId={params.id} className="mt-6 mb-8" />

        {/* ── Context / Wiki ───────────────────────────────────────────────── */}
        {hasContext ? (
          <section className="mb-8" aria-labelledby="context-heading">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-surface-300">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 border border-surface-300">
                <BookOpen className="h-3.5 w-3.5 text-surface-500" aria-hidden />
              </div>
              <div>
                <h2
                  id="context-heading"
                  className="font-mono text-sm font-bold uppercase tracking-wider text-surface-400"
                >
                  Background
                </h2>
                <p className="text-[10px] font-mono text-surface-600">Community-written context</p>
              </div>
            </div>
            <div className="prose prose-sm prose-invert max-w-none">
              <p className="text-sm text-surface-600 leading-relaxed whitespace-pre-line">
                {truncateWords(topic.description ?? '', 200)}
              </p>
            </div>
            {(topic.description?.split(/\s+/).length ?? 0) > 200 && (
              <Link
                href={`/topic/${params.id}`}
                className="inline-flex items-center gap-1 mt-2 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Read full context
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </section>
        ) : (
          <div className="mb-8 rounded-2xl border border-dashed border-surface-400 p-5 text-center">
            <BookOpen className="h-5 w-5 text-surface-600 mx-auto mb-2" aria-hidden />
            <p className="text-sm font-mono text-surface-500">No background context yet.</p>
            <Link
              href={`/topic/${params.id}`}
              className="inline-flex items-center gap-1 mt-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Be the first to add context
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* ── Arguments FOR ───────────────────────────────────────────────── */}
        <section className="mb-6 rounded-2xl bg-surface-100 border border-surface-300 p-5" aria-label="Arguments for">
          <SectionHeading side="for" count={forArgs.length} />
          {forArgs.length > 0 ? (
            <div>
              {forArgs.map((arg, i) => (
                <ArgumentCard key={arg.id} arg={arg} position={i + 1} />
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <ThumbsUp className="h-5 w-5 text-surface-600 mx-auto mb-2" aria-hidden />
              <p className="text-sm font-mono text-surface-500">No FOR arguments yet.</p>
              <Link
                href={`/topic/${params.id}#arguments`}
                className="inline-flex items-center gap-1 mt-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Be the first to argue for this
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
          {allArgs.filter((a) => a.side === 'blue').length > 5 && (
            <Link
              href={`/topic/${params.id}#arguments`}
              className="block text-center mt-3 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              + {allArgs.filter((a) => a.side === 'blue').length - 5} more FOR arguments
            </Link>
          )}
        </section>

        {/* ── Arguments AGAINST ───────────────────────────────────────────── */}
        <section className="mb-8 rounded-2xl bg-surface-100 border border-surface-300 p-5" aria-label="Arguments against">
          <SectionHeading side="against" count={againstArgs.length} />
          {againstArgs.length > 0 ? (
            <div>
              {againstArgs.map((arg, i) => (
                <ArgumentCard key={arg.id} arg={arg} position={i + 1} />
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <ThumbsDown className="h-5 w-5 text-surface-600 mx-auto mb-2" aria-hidden />
              <p className="text-sm font-mono text-surface-500">No AGAINST arguments yet.</p>
              <Link
                href={`/topic/${params.id}#arguments`}
                className="inline-flex items-center gap-1 mt-1 text-[11px] font-mono text-against-400 hover:text-against-300 transition-colors"
              >
                Be the first to argue against this
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
          {allArgs.filter((a) => a.side === 'red').length > 5 && (
            <Link
              href={`/topic/${params.id}#arguments`}
              className="block text-center mt-3 text-[11px] font-mono text-against-400 hover:text-against-300 transition-colors"
            >
              + {allArgs.filter((a) => a.side === 'red').length - 5} more AGAINST arguments
            </Link>
          )}
        </section>

        {/* ── Divider + vote CTA ──────────────────────────────────────────── */}
        <div className="border-t border-surface-300 pt-8">
          <div className="text-center mb-4">
            <p className="font-mono text-sm font-semibold text-white">Now you&apos;re briefed.</p>
            <p className="text-xs font-mono text-surface-500 mt-1">
              {isVotable
                ? 'Cast your vote below — it counts toward consensus.'
                : 'This topic is not currently open for voting.'}
            </p>
          </div>

          <BriefVotePanel
            topicId={params.id}
            isVotable={isVotable}
            topicHref={`/topic/${params.id}`}
          />
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-[10px] font-mono text-surface-600">
          Lobby Market · Community consensus engine
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
