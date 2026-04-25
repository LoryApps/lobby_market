import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  BarChart2,
  Clock,
  Flame,
  Gavel,
  Link2,
  MessageSquare,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
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

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Established Law',
  failed: 'Failed',
  continued: 'Continued',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
}

const SCOPE_LABEL: Record<string, string> = {
  local: 'Local',
  national: 'National',
  global: 'Global',
}

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

function StatusIcon({ status }: { status: string }) {
  const cls = 'h-3.5 w-3.5 flex-shrink-0'
  switch (status) {
    case 'law':    return <Gavel className={cn(cls, 'text-gold')} aria-hidden="true" />
    case 'voting': return <Scale className={cn(cls, 'text-purple')} aria-hidden="true" />
    case 'active': return <Zap className={cn(cls, 'text-for-400')} aria-hidden="true" />
    case 'failed': return <ThumbsDown className={cn(cls, 'text-surface-500')} aria-hidden="true" />
    default:       return <Flame className={cn(cls, 'text-surface-500')} aria-hidden="true" />
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

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'ended'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'ending soon'
  if (h < 24) return `${h}h remaining`
  return `${d}d remaining`
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: { id: string }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes, description')
    .eq('id', params.id)
    .maybeSingle()

  if (!topic) return { title: 'Topic · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const votes = topic.total_votes ?? 0

  const statusLabel = STATUS_LABEL[topic.status] ?? topic.status
  const title = `${topic.statement} · Lobby Market`
  const description = topic.description
    ? `${topic.description.slice(0, 140)}${topic.description.length > 140 ? '…' : ''} · ${forPct}% For / ${againstPct}% Against · ${votes.toLocaleString()} votes`
    : `${statusLabel} · ${forPct}% For / ${againstPct}% Against · ${votes.toLocaleString()} votes cast on Lobby Market`

  const ogImageUrl = `${BASE_URL}/api/og/topic/${params.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/share/topic/${params.id}`,
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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function TopicSharePage({ params }: PageProps) {
  const supabase = await createClient()

  const [topicRes, argsRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, description, category, scope, status, blue_pct, blue_votes, red_votes, total_votes, author_id, created_at, voting_ends_at, chain_depth, view_count')
      .eq('id', params.id)
      .maybeSingle(),
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', params.id),
  ])

  const topic = topicRes.data
  if (!topic) notFound()

  const argCount = argsRes.count ?? 0

  const { data: author } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('id', topic.author_id)
    .maybeSingle()

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const totalVotes = topic.total_votes ?? 0
  const statusBadge = STATUS_BADGE[topic.status] ?? 'proposed'
  const isLaw = topic.status === 'law'
  const isVoting = topic.status === 'voting'
  const isActive = topic.status === 'active'
  const isVotable = isActive || isVoting

  // Glow color derived from majority side
  const majorityIsFor = forPct >= 50
  const ambientGlow = isLaw
    ? 'rgba(201,168,76,0.08)'
    : majorityIsFor
      ? 'rgba(59,130,246,0.08)'
      : 'rgba(239,68,68,0.08)'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-12">

        {/* ── Header label ──────────────────────────────────────────── */}
        <div className="flex items-center justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-surface-300 bg-surface-100 text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            Shared topic
          </div>
        </div>

        {/* ── Main topic card ────────────────────────────────────────── */}
        <div
          className="rounded-3xl border border-surface-300 overflow-hidden mb-5"
          style={{ background: `linear-gradient(135deg, #0d0f14 0%, #111318 100%)` }}
        >
          {/* Ambient glow overlay */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{ background: ambientGlow }}
            aria-hidden="true"
          />

          <div className="relative p-6">
            {/* Status + category + scope */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Badge variant={statusBadge} className="flex items-center gap-1">
                <StatusIcon status={topic.status} />
                {STATUS_LABEL[topic.status] ?? topic.status}
              </Badge>
              {topic.category && (
                <span className="text-xs font-mono text-surface-500 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full">
                  {topic.category}
                </span>
              )}
              {topic.scope && topic.scope !== 'national' && (
                <span className="text-xs font-mono text-surface-600 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full">
                  {SCOPE_LABEL[topic.scope] ?? topic.scope}
                </span>
              )}
              {topic.chain_depth > 0 && (
                <span className="text-xs font-mono text-purple/80 bg-purple/10 border border-purple/20 px-2 py-0.5 rounded-full">
                  Chain ×{topic.chain_depth + 1}
                </span>
              )}
            </div>

            {/* Statement */}
            <h1 className="text-xl font-bold text-white leading-snug mb-4">
              {topic.statement}
            </h1>

            {/* Description if present */}
            {topic.description && (
              <p className="text-sm text-surface-400 leading-relaxed mb-5 line-clamp-3">
                {topic.description}
              </p>
            )}

            {/* Vote split bar */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-for-400">{forPct}% For</span>
                <span className="text-surface-500">
                  {totalVotes.toLocaleString()} votes
                </span>
                <span className="font-bold text-against-400">{againstPct}% Against</span>
              </div>
              <div className="relative h-3 w-full rounded-full overflow-hidden bg-surface-300">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 to-for-500"
                  style={{ width: `${forPct}%` }}
                  aria-label={`${forPct}% voted for`}
                />
                <div
                  className="absolute inset-y-0 right-0 bg-gradient-to-l from-against-700 to-against-500"
                  style={{ width: `${againstPct}%` }}
                  aria-hidden="true"
                />
              </div>
              {/* Vote counts below bar */}
              <div className="flex items-center justify-between text-[11px] font-mono text-surface-600">
                <span>{(topic.blue_votes ?? 0).toLocaleString()} for</span>
                <span>{(topic.red_votes ?? 0).toLocaleString()} against</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-surface-200/60 border border-surface-300">
                <BarChart2 className="h-4 w-4 text-surface-500" aria-hidden="true" />
                <span className="text-sm font-bold font-mono text-white">
                  {totalVotes.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-surface-600 text-center">votes</span>
              </div>
              <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-surface-200/60 border border-surface-300">
                <MessageSquare className="h-4 w-4 text-surface-500" aria-hidden="true" />
                <span className="text-sm font-bold font-mono text-white">
                  {argCount.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-surface-600 text-center">
                  {argCount === 1 ? 'argument' : 'arguments'}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-surface-200/60 border border-surface-300">
                <Users className="h-4 w-4 text-surface-500" aria-hidden="true" />
                <span className="text-sm font-bold font-mono text-white">
                  {(topic.view_count ?? 0).toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-surface-600 text-center">views</span>
              </div>
            </div>

            {/* Voting deadline */}
            {isVoting && topic.voting_ends_at && (
              <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-purple/10 border border-purple/20">
                <Clock className="h-3.5 w-3.5 text-purple flex-shrink-0" aria-hidden="true" />
                <span className="text-xs font-mono text-purple/80">
                  Voting closes · {timeUntil(topic.voting_ends_at)}
                </span>
              </div>
            )}

            {/* Law banner */}
            {isLaw && (
              <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-gold/10 border border-gold/20">
                <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0" aria-hidden="true" />
                <span className="text-xs font-mono text-gold/80">
                  This topic reached consensus and became law
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Author ────────────────────────────────────────────────── */}
        {author && (
          <Link
            href={`/profile/${author.username}`}
            className="flex items-center gap-3 p-4 rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors mb-5"
          >
            <Avatar
              src={author.avatar_url}
              fallback={author.display_name || author.username}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {author.display_name || author.username}
              </p>
              <p className="text-xs font-mono text-surface-500">
                @{author.username} · proposed {relativeTime(topic.created_at)}
              </p>
            </div>
            {author.role && author.role !== 'person' && (
              <span className="text-[10px] font-mono text-surface-400 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full flex-shrink-0">
                {ROLE_LABEL[author.role] ?? author.role}
              </span>
            )}
          </Link>
        )}

        {/* ── CTAs ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {isVotable ? (
            <Link
              href={`/topic/${topic.id}`}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-mono font-bold text-sm bg-for-600 hover:bg-for-500 text-white transition-all"
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              Vote on this topic
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : isLaw ? (
            <Link
              href={`/law`}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-mono font-bold text-sm bg-gold/80 hover:bg-gold text-black transition-all"
            >
              <Gavel className="h-4 w-4" aria-hidden="true" />
              View in Law Codex
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <Link
              href={`/topic/${topic.id}`}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-mono font-bold text-sm bg-for-600 hover:bg-for-500 text-white transition-all"
            >
              Read the debate
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}

          {argCount > 0 && (
            <Link
              href={`/topic/${topic.id}#arguments`}
              className="flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-sm text-surface-500 hover:text-white bg-surface-200 border border-surface-300 hover:border-surface-400 transition-all"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Read {argCount.toLocaleString()} {argCount === 1 ? 'argument' : 'arguments'}
            </Link>
          )}

          <Link
            href="/"
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-sm text-surface-600 hover:text-surface-400 transition-colors"
          >
            Explore Lobby Market
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
