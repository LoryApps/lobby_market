import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Gavel,
  MessageSquare,
  Scale,
  ThumbsDown,
  ThumbsUp,
  ChevronUp,
  Clock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type {
  TranscriptResponse,
  TranscriptArgument,
  TranscriptReply,
} from '@/app/api/topics/[id]/transcript/route'

export const dynamic = 'force-dynamic'

interface TranscriptPageProps {
  params: { id: string }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: TranscriptPageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .single()

  if (!topic) return { title: 'Debate Transcript · Lobby Market' }

  const stmt: string = topic.statement ?? ''
  const forPct = Math.round(topic.blue_pct ?? 50)
  const title = `Transcript: ${stmt.slice(0, 70)}${stmt.length > 70 ? '…' : ''} · Lobby Market`
  const description = `Full debate transcript — ${forPct}% For / ${100 - forPct}% Against · ${topic.total_votes?.toLocaleString() ?? 0} votes cast${topic.category ? ` · ${topic.category}` : ''}`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: 'Lobby Market' },
    twitter: { card: 'summary', title, description },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url }
}

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

// ─── Role colours ─────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  person: 'text-surface-500',
  debator: 'text-for-400',
  troll_catcher: 'text-emerald',
  elder: 'text-gold',
}

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

// ─── Reply row ────────────────────────────────────────────────────────────────

function ReplyRow({ reply }: { reply: TranscriptReply }) {
  return (
    <div className="flex gap-3 pl-4 border-l-2 border-surface-300/60">
      <Avatar
        src={reply.author?.avatar_url ?? null}
        fallback={reply.author?.display_name || reply.author?.username || '?'}
        size="xs"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {reply.author ? (
            <Link
              href={`/profile/${reply.author.username}`}
              className="text-xs font-semibold text-white hover:text-for-300 transition-colors"
            >
              {reply.author.display_name || reply.author.username}
            </Link>
          ) : (
            <span className="text-xs font-semibold text-surface-500">Anonymous</span>
          )}
          {reply.author?.role && reply.author.role !== 'person' && (
            <span className={cn('text-[10px] font-mono uppercase tracking-wider', ROLE_COLOR[reply.author.role])}>
              {ROLE_LABEL[reply.author.role] ?? reply.author.role}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-600">{relativeTime(reply.created_at)}</span>
        </div>
        <p className="text-sm text-surface-400 leading-relaxed">{reply.content}</p>
      </div>
    </div>
  )
}

// ─── Argument entry ───────────────────────────────────────────────────────────

function ArgumentEntry({
  arg,
  index,
  side,
}: {
  arg: TranscriptArgument
  index: number
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 transition-colors',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/35'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/35'
      )}
    >
      {/* Speaker header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Side marker */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full text-xs font-mono font-bold mt-0.5',
            isFor
              ? 'bg-for-600/20 text-for-400 ring-1 ring-for-500/30'
              : 'bg-against-600/20 text-against-400 ring-1 ring-against-500/30'
          )}
        >
          {isFor ? 'F' : 'A'}
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {arg.author ? (
              <Link
                href={`/profile/${arg.author.username}`}
                className="flex items-center gap-1.5 group"
              >
                <Avatar
                  src={arg.author.avatar_url ?? null}
                  fallback={arg.author.display_name || arg.author.username}
                  size="xs"
                />
                <span className="text-sm font-semibold text-white group-hover:text-for-300 transition-colors">
                  {arg.author.display_name || arg.author.username}
                </span>
              </Link>
            ) : (
              <span className="text-sm font-semibold text-surface-500">Anonymous</span>
            )}

            {arg.author?.role && arg.author.role !== 'person' && (
              <span className={cn('text-[10px] font-mono uppercase tracking-wider', ROLE_COLOR[arg.author.role])}>
                {ROLE_LABEL[arg.author.role] ?? arg.author.role}
              </span>
            )}

            <span
              className={cn(
                'ml-auto text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full',
                isFor
                  ? 'bg-for-500/15 text-for-400'
                  : 'bg-against-500/15 text-against-400'
              )}
            >
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-0.5 text-[10px] font-mono text-surface-600">
            <span>{relativeTime(arg.created_at)}</span>
            <span className="flex items-center gap-1">
              <ChevronUp className="h-3 w-3" />
              {arg.upvotes}
            </span>
            {arg.replies.length > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {arg.replies.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-200 leading-relaxed mb-3 pl-10">
        {arg.content}
      </p>

      {/* Citation */}
      {arg.source_url && (
        <div className="pl-10 mb-3">
          <a
            href={arg.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald hover:text-emerald/80 transition-colors"
          >
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
            <span className="truncate max-w-xs">{hostnameOf(arg.source_url)}</span>
          </a>
        </div>
      )}

      {/* Replies */}
      {arg.replies.length > 0 && (
        <div className="pl-10 space-y-3 mt-3 pt-3 border-t border-surface-300/40">
          {arg.replies.map((r) => (
            <ReplyRow key={r.id} reply={r} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TranscriptPage({ params }: TranscriptPageProps) {
  const supabase = await createClient()

  // Fetch topic for existence check
  const { data: topicCheck } = await supabase
    .from('topics')
    .select('id')
    .eq('id', params.id)
    .maybeSingle()

  if (!topicCheck) {
    notFound()
  }

  // Fetch transcript data
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/topics/${params.id}/transcript`,
    { cache: 'no-store' }
  )

  let data: TranscriptResponse | null = null
  if (res.ok) {
    data = (await res.json()) as TranscriptResponse
  }

  // Fallback: fetch topic + args directly from Supabase if fetch fails
  if (!data) {
    const [topicRes, argsRes] = await Promise.all([
      supabase
        .from('topics')
        .select('id, statement, description, category, status, blue_pct, total_votes, created_at, updated_at, voting_ends_at')
        .eq('id', params.id)
        .single(),
      supabase
        .from('topic_arguments')
        .select('id, user_id, side, content, upvotes, source_url, created_at')
        .eq('topic_id', params.id)
        .order('upvotes', { ascending: false })
        .limit(80),
    ])

    if (!topicRes.data) notFound()

    const topic = topicRes.data
    const args = (argsRes.data ?? []) as Array<{
      id: string; user_id: string; side: string;
      content: string; upvotes: number;
      source_url: string | null; created_at: string
    }>

    const userIds = Array.from(new Set(args.map((a) => a.user_id)))
    const { data: profiles } = userIds.length
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role')
          .in('id', userIds)
      : { data: [] }

    const profileMap = new Map(((profiles ?? []) as Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }>).map((p) => [p.id, p]))

    const enriched: TranscriptArgument[] = args.map((a) => ({
      id: a.id,
      side: a.side as 'blue' | 'red',
      content: a.content,
      upvotes: a.upvotes,
      source_url: a.source_url,
      created_at: a.created_at,
      author: profileMap.get(a.user_id) ?? null,
      replies: [],
    }))

    const for_args = enriched.filter((a) => a.side === 'blue')
    const against_args = enriched.filter((a) => a.side === 'red')

    const maxLen = Math.max(for_args.length, against_args.length)
    const interleaved: TranscriptArgument[] = []
    for (let i = 0; i < maxLen; i++) {
      if (i < for_args.length) interleaved.push(for_args[i])
      if (i < against_args.length) interleaved.push(against_args[i])
    }

    data = {
      topic: topic as TranscriptResponse['topic'],
      for_args,
      against_args,
      total_for: for_args.length,
      total_against: against_args.length,
      interleaved,
    }
  }

  const { topic, for_args, against_args, interleaved } = data
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const totalArgs = for_args.length + against_args.length
  const hasCitations = [...for_args, ...against_args].some((a) => a.source_url)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* ── Back link ─────────────────────────────────────────────────── */}
        <Link
          href={`/topic/${params.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to topic
        </Link>

        {/* ── Header card ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 mb-8">
          {/* Title row */}
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-xl bg-surface-200 border border-surface-300">
              <BookOpen className="h-5 w-5 text-surface-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
                  {STATUS_LABEL[topic.status] ?? topic.status}
                </Badge>
                {topic.category && (
                  <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                    {topic.category}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-white leading-snug">
                {topic.statement}
              </h1>
            </div>
          </div>

          {/* Description */}
          {topic.description && (
            <p className="text-sm text-surface-400 leading-relaxed mb-4 pl-15">
              {topic.description}
            </p>
          )}

          {/* Vote split bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="flex items-center gap-1 text-for-400">
                <ThumbsUp className="h-3 w-3" />
                FOR {forPct}%
              </span>
              <span className="text-surface-600">
                {topic.total_votes.toLocaleString()} votes cast
              </span>
              <span className="flex items-center gap-1 text-against-400">
                AGAINST {againstPct}%
                <ThumbsDown className="h-3 w-3" />
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-surface-300 flex">
              <div
                className="h-full bg-gradient-to-r from-for-600 to-for-400 transition-all"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="h-full bg-against-500 flex-1 transition-all"
              />
            </div>
          </div>

          {/* Meta stats */}
          <div className="flex items-center gap-4 text-xs font-mono text-surface-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" />
              {totalArgs} argument{totalArgs !== 1 ? 's' : ''}
              {' '}({for_args.length} for · {against_args.length} against)
            </span>
            {hasCitations && (
              <span className="flex items-center gap-1.5 text-emerald">
                <ExternalLink className="h-3.5 w-3.5" />
                Includes citations
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Opened {formatDate(topic.created_at)}
            </span>
            {topic.status === 'law' && (
              <span className="flex items-center gap-1.5 text-emerald">
                <Gavel className="h-3.5 w-3.5" />
                Established as Law
              </span>
            )}
          </div>
        </div>

        {/* ── Empty state ────────────────────────────────────────────────── */}
        {totalArgs === 0 && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-12 text-center">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 mx-auto mb-4">
              <MessageSquare className="h-7 w-7 text-surface-500" />
            </div>
            <h2 className="font-mono text-lg font-bold text-white mb-2">No arguments yet</h2>
            <p className="text-sm font-mono text-surface-500 mb-4 max-w-sm mx-auto">
              This debate is waiting for its first voice. Be the one to open the discourse.
            </p>
            <Link
              href={`/topic/${params.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
            >
              Make the first argument
            </Link>
          </div>
        )}

        {/* ── Interleaved transcript ─────────────────────────────────────── */}
        {totalArgs > 0 && (
          <>
            {/* Section label */}
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-surface-300" />
              <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                Debate Transcript
              </span>
              <div className="h-px flex-1 bg-surface-300" />
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-6">
              <span className="flex items-center gap-1.5 text-xs font-mono text-for-400">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-for-600/20 text-for-400 ring-1 ring-for-500/30 text-[9px] font-bold">F</span>
                FOR arguments
              </span>
              <span className="flex items-center gap-1.5 text-xs font-mono text-against-400">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-against-600/20 text-against-400 ring-1 ring-against-500/30 text-[9px] font-bold">A</span>
                AGAINST arguments
              </span>
            </div>

            {/* Interleaved argument list */}
            <div className="space-y-4">
              {interleaved.map((arg) => {
                const side = arg.side === 'blue' ? 'for' : 'against'
                const sideList = side === 'for' ? for_args : against_args
                const localIndex = sideList.findIndex((a) => a.id === arg.id)
                return (
                  <ArgumentEntry
                    key={arg.id}
                    arg={arg}
                    index={localIndex}
                    side={side}
                  />
                )
              })}
            </div>

            {/* Summary footer */}
            <div className="mt-10 pt-6 border-t border-surface-300">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl bg-for-500/10 border border-for-500/20 p-4 text-center">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-for-400 mb-1">FOR</p>
                  <p className="text-2xl font-mono font-bold text-white">{forPct}%</p>
                  <p className="text-xs font-mono text-surface-500 mt-1">
                    {for_args.length} argument{for_args.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="rounded-xl bg-against-500/10 border border-against-500/20 p-4 text-center">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-against-400 mb-1">AGAINST</p>
                  <p className="text-2xl font-mono font-bold text-white">{againstPct}%</p>
                  <p className="text-xs font-mono text-surface-500 mt-1">
                    {against_args.length} argument{against_args.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="text-center space-y-3">
                <p className="text-xs font-mono text-surface-500">
                  Transcript generated from {totalArgs} community argument{totalArgs !== 1 ? 's' : ''}.
                  {topic.status === 'law'
                    ? ' This topic has been established as Law by the community.'
                    : topic.status === 'failed'
                    ? ' This topic did not achieve consensus.'
                    : ' The debate is still ongoing.'}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    href={`/topic/${params.id}`}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 rounded-xl',
                      'bg-surface-200 border border-surface-300 text-white text-sm font-mono font-medium',
                      'hover:bg-surface-300 transition-colors'
                    )}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to topic
                  </Link>
                  <Link
                    href={`/topic/${params.id}/voters`}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 rounded-xl',
                      'bg-for-600/10 border border-for-500/30 text-for-400 text-sm font-mono font-medium',
                      'hover:bg-for-600/20 transition-colors'
                    )}
                  >
                    <Scale className="h-4 w-4" />
                    See voters
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
