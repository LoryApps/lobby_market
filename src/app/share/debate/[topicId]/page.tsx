import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  Gavel,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Zap,
  FileText,
  ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { SharePanel } from '@/components/ui/SharePanel'
import { cn } from '@/lib/utils/cn'
import type { Profile } from '@/lib/supabase/types'

const BASE_URL = 'https://lobby.market'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SnapshotArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  author: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'> | null
  source_url: string | null
}

interface PageProps {
  params: { topicId: string }
}

// ─── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Established Law',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function StatusIcon({ status }: { status: string }) {
  const cls = 'h-3.5 w-3.5 flex-shrink-0'
  switch (status) {
    case 'law':    return <Gavel    className={cn(cls, 'text-emerald')}       aria-hidden="true" />
    case 'voting': return <Scale    className={cn(cls, 'text-purple')}        aria-hidden="true" />
    case 'active': return <Zap      className={cn(cls, 'text-for-400')}       aria-hidden="true" />
    default:       return <FileText className={cn(cls, 'text-surface-500')}   aria-hidden="true" />
  }
}

// ─── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes')
    .eq('id', params.topicId)
    .maybeSingle()

  if (!topic) return { title: 'Debate Snapshot · Lobby Market' }

  const forPct  = Math.round(topic.blue_pct ?? 50)
  const against = 100 - forPct
  const votes   = (topic.total_votes ?? 0).toLocaleString()
  const title   = `The Debate: ${topic.statement}`
  const description =
    `${forPct}% For · ${against}% Against · ${votes} votes cast on Lobby Market. See the best arguments and cast your own vote.`
  const ogImageUrl = `${BASE_URL}/api/og/topic-snapshot/${params.topicId}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: topic.statement }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

// ─── Vote bar ───────────────────────────────────────────────────────────────────

function VoteBar({ forPct, totalVotes }: { forPct: number; totalVotes: number }) {
  const against = 100 - forPct
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-for-400 font-bold">{Math.round(forPct)}% FOR</span>
        <span className="text-surface-500">{totalVotes.toLocaleString()} votes</span>
        <span className="text-against-400 font-bold">{Math.round(against)}% AGAINST</span>
      </div>
      <div className="relative h-2.5 rounded-full overflow-hidden bg-surface-300" role="meter" aria-valuenow={forPct} aria-valuemin={0} aria-valuemax={100} aria-label={`${forPct}% voted for`}>
        <div
          className="absolute inset-y-0 left-0 bg-for-500 rounded-l-full transition-all"
          style={{ width: `${forPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-against-500 rounded-r-full transition-all"
          style={{ width: `${against}%` }}
        />
      </div>
    </div>
  )
}

// ─── Argument card ──────────────────────────────────────────────────────────────

function ArgumentCard({ arg, isFor }: { arg: SnapshotArgument | null; isFor: boolean }) {
  const side = isFor ? 'FOR'    : 'AGAINST'
  const Icon = isFor ? ThumbsUp : ThumbsDown

  if (!arg) {
    return (
      <div className={cn(
        'rounded-2xl border p-6 flex flex-col gap-3 h-full min-h-[180px]',
        isFor
          ? 'bg-for-500/[0.04] border-for-500/20'
          : 'bg-against-500/[0.04] border-against-500/20',
      )}>
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', isFor ? 'text-for-400' : 'text-against-400')} aria-hidden="true" />
          <span className={cn('text-xs font-mono font-bold tracking-widest uppercase', isFor ? 'text-for-400' : 'text-against-400')}>
            {side}
          </span>
        </div>
        <p className="text-sm text-surface-600 italic font-mono">
          No {side} arguments yet. Be the first.
        </p>
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-2xl border p-5 flex flex-col gap-4 h-full',
      isFor
        ? 'bg-for-500/[0.06] border-for-500/25'
        : 'bg-against-500/[0.06] border-against-500/25',
    )}>
      {/* Side label */}
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', isFor ? 'text-for-400' : 'text-against-400')} aria-hidden="true" />
        <span className={cn('text-xs font-mono font-bold tracking-widest uppercase', isFor ? 'text-for-400' : 'text-against-400')}>
          {side}
        </span>
        <span className="ml-auto text-xs font-mono text-surface-500">
          ▲ {arg.upvotes ?? 0}
        </span>
      </div>

      {/* Argument text */}
      <blockquote className="flex-1 text-sm sm:text-base text-surface-200 font-mono leading-relaxed">
        &ldquo;{arg.content}&rdquo;
      </blockquote>

      {/* Footer: author + optional citation */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-surface-300/40">
        {arg.author ? (
          <Link
            href={`/profile/${arg.author.username}`}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            aria-label={`View profile of ${arg.author.display_name ?? arg.author.username}`}
          >
            <Avatar
              src={arg.author.avatar_url}
              fallback={arg.author.display_name ?? arg.author.username}
              size="xs"
            />
            <span className="text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors truncate max-w-[120px]">
              @{arg.author.username}
            </span>
          </Link>
        ) : (
          <span className="text-[11px] font-mono text-surface-600">Anonymous</span>
        )}

        {arg.source_url && (
          <a
            href={arg.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-1 text-[11px] font-mono hover:opacity-80 transition-opacity',
              isFor ? 'text-for-400/70' : 'text-against-400/70',
            )}
            aria-label="View source citation"
          >
            <ExternalLink className="h-3 w-3" />
            Source
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default async function DebateSnapshotPage({ params }: PageProps) {
  const supabase = await createClient()

  // Load topic
  const { data: topicRaw, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, description, category, status, blue_pct, total_votes, created_at, author_id')
    .eq('id', params.topicId)
    .single()

  if (topicErr || !topicRaw) {
    notFound()
  }

  // Load top arguments per side + their authors in one pass
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('id, side, content, upvotes, created_at, user_id, source_url')
    .eq('topic_id', params.topicId)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(40)

  const args = argsRaw ?? []
  const topFor     = args.find((a) => a.side === 'blue') ?? null
  const topAgainst = args.find((a) => a.side === 'red')  ?? null
  const forCount   = args.filter((a) => a.side === 'blue').length
  const againstCount = args.filter((a) => a.side === 'red').length

  // Hydrate authors
  const authorIds = Array.from(
    new Set([topFor?.user_id, topAgainst?.user_id].filter(Boolean) as string[])
  )
  const profileMap = new Map<string, Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url' | 'role'>>()
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)
    for (const p of profiles ?? []) profileMap.set(p.id, p)
  }

  function hydrateArg(raw: typeof args[number] | null): SnapshotArgument | null {
    if (!raw) return null
    return {
      id: raw.id,
      content: raw.content,
      side: raw.side as 'blue' | 'red',
      upvotes: raw.upvotes ?? 0,
      created_at: raw.created_at,
      author: profileMap.get(raw.user_id) ?? null,
      source_url: (raw as { source_url?: string | null }).source_url ?? null,
    }
  }

  const forArg     = hydrateArg(topFor)
  const againstArg = hydrateArg(topAgainst)

  const topic = topicRaw as {
    id: string
    statement: string
    description: string | null
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    created_at: string
    author_id: string
  }

  const forPct    = Math.round(topic.blue_pct ?? 50)
  const totalVotes = topic.total_votes ?? 0
  const statusLabel = STATUS_LABEL[topic.status] ?? topic.status
  const statusBadge = STATUS_BADGE[topic.status] ?? 'proposed'

  const shareUrl  = `${BASE_URL}/share/debate/${topic.id}`
  const shareText = `The Debate: "${topic.statement}" — ${forPct}% For vs ${100 - forPct}% Against. Where do you stand?`

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12" id="main-content">

        {/* ── Back nav ─────────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={`/topic/${topic.id}`}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-mono text-surface-500',
              'hover:text-surface-300 transition-colors'
            )}
          >
            ← View full topic
          </Link>
          <span className="text-surface-600">·</span>
          <span className="text-xs font-mono text-surface-600">Debate Snapshot</span>
        </div>

        {/* ── Header card ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300/60 bg-surface-100 p-6 mb-6">

          {/* Status + category */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Badge variant={statusBadge} className="flex items-center gap-1.5">
              <StatusIcon status={topic.status} />
              {statusLabel}
            </Badge>
            {topic.category && (
              <span className="text-xs font-mono text-surface-500 px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300">
                {topic.category}
              </span>
            )}
          </div>

          {/* Topic statement */}
          <h1 className="text-xl sm:text-2xl font-mono font-bold text-white leading-snug mb-4">
            {topic.statement}
          </h1>

          {/* Vote bar */}
          <VoteBar forPct={forPct} totalVotes={totalVotes} />

          {/* Argument counts */}
          <p className="mt-3 text-xs font-mono text-surface-500">
            {forCount + againstCount} arguments total · {forCount} FOR · {againstCount} AGAINST
          </p>
        </div>

        {/* ── Arguments ────────────────────────────────────────────────────── */}
        <section aria-label="Best arguments for each side">
          <h2 className="text-sm font-mono font-bold text-surface-400 uppercase tracking-widest mb-4">
            Best Arguments
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ArgumentCard arg={forArg}     isFor={true}  />
            <ArgumentCard arg={againstArg} isFor={false} />
          </div>
        </section>

        {/* ── All arguments link ────────────────────────────────────────────── */}
        {(forCount + againstCount) > 2 && (
          <Link
            href={`/topic/${topic.id}#arguments`}
            className={cn(
              'mt-4 flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl',
              'border border-surface-300/60 bg-surface-100 text-surface-500 text-sm font-mono',
              'hover:bg-surface-200 hover:text-white transition-colors'
            )}
          >
            View all {forCount + againstCount} arguments
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <div className="mt-8 rounded-2xl border border-surface-300/60 bg-surface-100 p-6 text-center space-y-4">
          <div>
            <p className="text-base font-mono font-bold text-white mb-1">
              Where do you stand?
            </p>
            <p className="text-sm font-mono text-surface-500">
              Your vote shapes the consensus. Join {totalVotes.toLocaleString()} others who already weighed in.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/topic/${topic.id}`}
              className={cn(
                'inline-flex items-center gap-2 px-6 py-3 rounded-xl',
                'bg-for-600 hover:bg-for-500 text-white font-mono font-bold text-sm',
                'transition-colors w-full sm:w-auto justify-center'
              )}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              Vote &amp; Argue
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <SharePanel
              url={shareUrl}
              text={shareText}
              topicId={topic.id}
            />
          </div>
        </div>

        {/* ── Footer note ──────────────────────────────────────────────────── */}
        <p className="mt-6 text-center text-xs font-mono text-surface-600">
          Debate Snapshot · Lobby Market — The People&apos;s Consensus Engine
        </p>

      </main>

      <BottomNav />
    </div>
  )
}
