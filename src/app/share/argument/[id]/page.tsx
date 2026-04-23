import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  ChevronUp,
  Gavel,
  MessageSquare,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://lobby.market'

interface PageProps {
  params: { id: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

function StatusIcon({ status }: { status: string }) {
  const cls = 'h-3.5 w-3.5 flex-shrink-0'
  switch (status) {
    case 'law':    return <Gavel className={cn(cls, 'text-gold')} aria-hidden />
    case 'voting': return <Scale className={cn(cls, 'text-purple')} aria-hidden />
    case 'active': return <Zap className={cn(cls, 'text-for-400')} aria-hidden />
    default:       return null
  }
}

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

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: arg } = await supabase
    .from('topic_arguments')
    .select('content, side, upvotes, user_id, topic_id')
    .eq('id', params.id)
    .single()

  if (!arg) return { title: 'Argument · Lobby Market' }

  const [topicRes, profileRes] = await Promise.all([
    supabase.from('topics').select('statement, category, status').eq('id', arg.topic_id).single(),
    supabase.from('profiles').select('username, display_name').eq('id', arg.user_id).maybeSingle(),
  ])

  const topic = topicRes.data
  const author = profileRes.data

  const sideLabel = arg.side === 'blue' ? 'FOR' : 'AGAINST'
  const authorName = author?.display_name || (author?.username ? `@${author.username}` : null)
  const snippet = arg.content.slice(0, 120).trim()

  const title = topic
    ? `${sideLabel}: "${snippet}${snippet.length < arg.content.length ? '…' : ''}" · Lobby Market`
    : `Argument · Lobby Market`

  const description = topic
    ? `${sideLabel} argument on "${topic.statement}"${authorName ? ` by ${authorName}` : ''}. ${arg.upvotes} upvotes.`
    : snippet

  const ogImageUrl = `${BASE_URL}/api/og/argument/${params.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/share/argument/${params.id}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ArgumentSharePage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: arg } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, created_at, user_id, topic_id')
    .eq('id', params.id)
    .single()

  if (!arg) notFound()

  const [topicRes, profileRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', arg.topic_id)
      .single(),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', arg.user_id)
      .maybeSingle(),
  ])

  const topic = topicRes.data
  const author = profileRes.data

  if (!topic) notFound()

  const isFor = arg.side === 'blue'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideBg = isFor ? 'bg-for-500/10' : 'bg-against-500/10'
  const sideBorder = isFor ? 'border-for-500/30' : 'border-against-500/30'
  const sideBgDeep = isFor ? 'bg-for-500/6' : 'bg-against-500/6'
  const sideBorderDeep = isFor ? 'border-for-500/20' : 'border-against-500/20'
  const sideGradient = isFor
    ? 'from-for-700 to-for-500'
    : 'from-against-700 to-against-500'

  const statusBadge = STATUS_BADGE[topic.status] ?? 'proposed'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-12">

        {/* ── Side badge header ──────────────────────────────────────── */}
        <div className="flex items-center justify-center mb-8">
          <div
            className={cn(
              'inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border text-sm font-mono font-bold uppercase tracking-widest',
              sideBg,
              sideBorder,
              sideColor
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-4 w-4 flex-shrink-0" aria-hidden />
            ) : (
              <ThumbsDown className="h-4 w-4 flex-shrink-0" aria-hidden />
            )}
            {sideLabel} argument
          </div>
        </div>

        {/* ── Argument quote card ────────────────────────────────────── */}
        <div
          className={cn(
            'rounded-3xl border p-6 mb-6 relative overflow-hidden',
            'bg-surface-100',
            sideBorder
          )}
        >
          {/* Ambient glow */}
          <div
            className={cn(
              'absolute inset-0 opacity-40 pointer-events-none',
              sideBgDeep
            )}
            aria-hidden
          />

          {/* Quote mark */}
          <div
            className={cn('text-5xl leading-none font-serif mb-3 select-none', sideColor)}
            aria-hidden
          >
            &ldquo;
          </div>

          {/* Argument text */}
          <blockquote
            className="relative z-10 text-white text-lg font-medium leading-relaxed whitespace-pre-wrap mb-4"
            cite={`${BASE_URL}/arguments/${arg.id}`}
          >
            {arg.content}
          </blockquote>

          {/* Closing quote */}
          <div
            className={cn('text-5xl leading-none font-serif text-right select-none', sideColor)}
            aria-hidden
          >
            &rdquo;
          </div>

          {/* Stats row */}
          <div className={cn('flex items-center gap-4 pt-4 mt-2 border-t', sideBorderDeep)}>
            <div className="flex items-center gap-1.5">
              <ChevronUp className="h-4 w-4 text-emerald" aria-hidden />
              <span className="text-sm font-mono font-bold text-emerald">{arg.upvotes}</span>
              <span className="text-xs font-mono text-surface-600">upvotes</span>
            </div>
            <span className="text-xs font-mono text-surface-600 ml-auto">
              {relativeTime(arg.created_at)}
            </span>
          </div>
        </div>

        {/* ── Author ────────────────────────────────────────────────── */}
        {author && (
          <Link
            href={`/profile/${author.username}`}
            className={cn(
              'flex items-center gap-3 p-4 rounded-2xl border border-surface-300',
              'bg-surface-100 hover:bg-surface-200 transition-colors mb-6'
            )}
          >
            <Avatar
              src={author.avatar_url}
              fallback={author.display_name || author.username}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {author.display_name || author.username}
              </p>
              <p className="text-xs font-mono text-surface-500">
                @{author.username} · {ROLE_LABEL[author.role] ?? author.role}
              </p>
            </div>
            {author.role && author.role !== 'person' && (
              <Badge variant={author.role as 'debator' | 'troll_catcher' | 'elder' | 'person'}>
                {ROLE_LABEL[author.role] ?? author.role}
              </Badge>
            )}
          </Link>
        )}

        {/* ── Topic context card ────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300 overflow-hidden mb-6">
          <div className="bg-surface-100 px-4 py-2.5 border-b border-surface-300">
            <span className="text-xs font-mono font-semibold text-surface-600 uppercase tracking-wider">
              On the topic
            </span>
          </div>

          <div className="p-4">
            {/* Status + category */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant={statusBadge} className="flex items-center gap-1 text-[10px]">
                <StatusIcon status={topic.status} />
                {STATUS_LABEL[topic.status] ?? topic.status}
              </Badge>
              {topic.category && (
                <span className="text-[10px] font-mono text-surface-500 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full">
                  {topic.category}
                </span>
              )}
            </div>

            {/* Statement */}
            <p className="text-sm font-medium text-white leading-snug mb-4">
              {topic.statement}
            </p>

            {/* Vote split bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-for-400 font-bold">{forPct}% For</span>
                <span className="text-surface-600">
                  {(topic.total_votes ?? 0).toLocaleString()} votes
                </span>
                <span className="text-against-400 font-bold">{againstPct}% Against</span>
              </div>
              <div className="flex h-2 w-full rounded-full overflow-hidden bg-surface-300">
                <div
                  className={cn('h-full bg-gradient-to-r rounded-l-full', sideGradient)}
                  style={{ width: `${forPct}%` }}
                  aria-hidden
                />
              </div>
            </div>

            {/* Side highlight */}
            <div
              className={cn(
                'mt-4 flex items-center gap-3 p-3 rounded-xl border',
                sideBgDeep,
                sideBorderDeep
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-full flex-shrink-0',
                  sideBg
                )}
              >
                {isFor ? (
                  <ThumbsUp className={cn('h-3.5 w-3.5', sideColor)} aria-hidden />
                ) : (
                  <ThumbsDown className={cn('h-3.5 w-3.5', sideColor)} aria-hidden />
                )}
              </div>
              <p className={cn('text-xs font-mono font-semibold', sideColor)}>
                This argument argues {sideLabel}
                {isFor
                  ? ` — aligns with ${forPct}% of voters`
                  : ` — aligns with ${againstPct}% of voters`}
              </p>
            </div>
          </div>
        </div>

        {/* ── CTAs ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/topic/${topic.id}`}
            className={cn(
              'flex items-center justify-center gap-2 py-3.5 rounded-xl font-mono font-bold text-sm transition-all',
              isFor
                ? 'bg-for-600 hover:bg-for-500 text-white'
                : 'bg-against-600 hover:bg-against-500 text-white'
            )}
          >
            <MessageSquare className="h-4 w-4" aria-hidden />
            Join the debate
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>

          <Link
            href={`/arguments/${arg.id}`}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-sm text-surface-500 hover:text-white bg-surface-200 border border-surface-300 hover:border-surface-400 transition-all"
          >
            View full argument thread
          </Link>
        </div>

        {/* ── Brand footer ──────────────────────────────────────────── */}
        <div className="mt-10 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <span className="text-white font-bold text-lg tracking-wider">LOBBY</span>
            <span className="text-surface-500 font-bold text-lg tracking-wider">MARKET</span>
          </div>
          <div className="flex h-0.5 w-24">
            <div className="flex-1 bg-for-500 rounded-l-full" />
            <div className="flex-1 bg-against-500 rounded-r-full" />
          </div>
          <p className="text-xs font-mono text-surface-600 mt-1">
            The people&apos;s consensus engine
          </p>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
