import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  BarChart2,
  BookOpen,
  Calendar,
  Check,
  Gavel,
  MessageSquare,
  Scale,
  Scroll,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { SharePanel } from '@/components/ui/SharePanel'
import { cn } from '@/lib/utils/cn'
import type { Law, Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://lobby.market'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const m = Math.floor(diff / 2_592_000_000) // months
  const y = Math.floor(diff / 31_536_000_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d} days ago`
  if (m < 12) return `${m} month${m !== 1 ? 's' : ''} ago`
  return `${y} year${y !== 1 ? 's' : ''} ago`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: { id: string }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('statement, category, total_votes, blue_pct, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Proclamation · Lobby Market' }

  const forPct = Math.round(law.blue_pct ?? 50)
  const votes = (law.total_votes ?? 0).toLocaleString()
  const title = `LAW: ${law.statement}`
  const description = `Established by ${votes} votes · ${forPct}% consensus${law.category ? ` · ${law.category}` : ''} · Lobby Market`
  const ogImageUrl = `${BASE_URL}/api/og/law/${params.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      publishedTime: law.established_at,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: law.statement }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

// ─── Ornamental divider ───────────────────────────────────────────────────────

function GoldDivider() {
  return (
    <div className="flex items-center gap-3 my-5" aria-hidden="true">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-gold/40" />
      <Gavel className="h-3.5 w-3.5 text-gold/60 flex-shrink-0" />
      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-gold/40" />
    </div>
  )
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: string
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-gold/5 border border-gold/15">
      <Icon className="h-4 w-4 text-gold/70" aria-hidden="true" />
      <span className="text-base font-bold font-mono text-white tabular-nums">{value}</span>
      <span className="text-[10px] font-mono text-surface-500 text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LawSharePage({ params }: PageProps) {
  const supabase = await createClient()

  // Fetch law
  const { data: lawRaw } = await supabase
    .from('laws')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!lawRaw) notFound()
  const law = lawRaw as Law

  // Fetch original topic (for author + argument count + view count)
  const [topicRes, argCountRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, author_id, view_count, blue_votes, red_votes')
      .eq('id', law.topic_id)
      .maybeSingle(),
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .eq('topic_id', law.topic_id),
  ])

  const topic = topicRes.data
  const argCount = argCountRes.count ?? 0

  // Fetch author profile
  let author: Pick<Profile, 'username' | 'display_name' | 'avatar_url' | 'role'> | null = null
  if (topic?.author_id) {
    const { data } = await supabase
      .from('profiles')
      .select('username, display_name, avatar_url, role')
      .eq('id', topic.author_id)
      .maybeSingle()
    author = data
  }

  const forPct = Math.round(law.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const totalVotes = law.total_votes ?? 0
  const shareUrl = `${BASE_URL}/share/law/${law.id}`
  const shareText = `"${law.statement}" — ${forPct}% consensus, ${totalVotes.toLocaleString()} votes. Now law on Lobby Market.`

  const ROLE_LABEL: Record<string, string> = {
    person: 'Citizen',
    debator: 'Debator',
    troll_catcher: 'Troll Catcher',
    elder: 'Elder',
    lawmaker: 'Lawmaker',
    senator: 'Senator',
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-lg mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Breadcrumb ────────────────────────────────────────────── */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] font-mono text-surface-600 mb-5">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <Link href="/law" className="hover:text-white transition-colors">Law Codex</Link>
          <span>/</span>
          <span className="text-surface-400 truncate max-w-[180px]">
            {law.statement.length > 30 ? law.statement.slice(0, 30) + '…' : law.statement}
          </span>
        </nav>

        {/* ── Proclamation card ─────────────────────────────────────── */}
        <article
          className={cn(
            'relative rounded-3xl border-2 border-gold/30 bg-surface-100 overflow-hidden',
            'shadow-[0_0_60px_-12px_rgba(255,196,0,0.15)]',
          )}
          aria-label="Law proclamation"
        >
          {/* Gold shimmer strip at top */}
          <div className="h-1 w-full bg-gradient-to-r from-gold/0 via-gold to-gold/0" />

          <div className="p-6 pb-5">

            {/* ── Header row ──────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                {/* Gold gavel seal */}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/10 border border-gold/30 flex-shrink-0">
                  <Gavel className="h-5 w-5 text-gold" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase text-gold">
                      ESTABLISHED LAW
                    </span>
                  </div>
                  {law.category && (
                    <span className="text-[10px] font-mono text-surface-500">
                      {law.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Share panel */}
              <SharePanel
                url={shareUrl}
                text={shareText}
                className="flex-shrink-0"
              />
            </div>

            {/* ── Statement ───────────────────────────────────────── */}
            <blockquote className="mb-4">
              <p className="text-xl font-bold text-white leading-snug tracking-tight">
                {law.statement}
              </p>
            </blockquote>

            {/* ── Establishment date ──────────────────────────────── */}
            <div className="flex items-center gap-1.5 text-xs font-mono text-gold/70 mb-1">
              <Calendar className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              <span>Established {formatDate(law.established_at)}</span>
              <span className="text-surface-600">·</span>
              <span className="text-surface-500">{relativeTime(law.established_at)}</span>
            </div>

            <GoldDivider />

            {/* ── Vote breakdown ──────────────────────────────────── */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-for-400">
                  <ThumbsUp className="h-3 w-3 inline mr-1 align-[-1px]" aria-hidden="true" />
                  {forPct}% For
                </span>
                <span className="text-surface-500">
                  {totalVotes.toLocaleString()} votes
                </span>
                <span className="font-bold text-against-400">
                  {againstPct}% Against
                </span>
              </div>

              {/* Vote bar */}
              <div
                className="relative h-3.5 w-full rounded-full overflow-hidden bg-surface-300"
                role="meter"
                aria-valuenow={forPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${forPct}% voted for`}
              >
                {/* Gold FOR bar for laws */}
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold/80 via-gold to-gold/90 rounded-l-full"
                  style={{ width: `${forPct}%` }}
                />
                <div
                  className="absolute inset-y-0 right-0 bg-against-700/60 rounded-r-full"
                  style={{ width: `${againstPct}%` }}
                  aria-hidden="true"
                />
              </div>

              {/* FOR/AGAINST counts */}
              {topic && (
                <div className="flex items-center justify-between text-[11px] font-mono text-surface-600">
                  <span>{(topic.blue_votes ?? 0).toLocaleString()} for</span>
                  <span>{(topic.red_votes ?? 0).toLocaleString()} against</span>
                </div>
              )}
            </div>

            {/* ── Stats grid ──────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              <StatCell
                icon={BarChart2}
                value={totalVotes.toLocaleString()}
                label="votes cast"
              />
              <StatCell
                icon={MessageSquare}
                value={argCount.toLocaleString()}
                label={argCount === 1 ? 'argument' : 'arguments'}
              />
              <StatCell
                icon={Users}
                value={`${(topic?.view_count ?? 0).toLocaleString()}`}
                label="views"
              />
            </div>

            {/* ── Consensus stamp ─────────────────────────────────── */}
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold/8 border border-gold/20 mb-4">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 flex-shrink-0">
                <Check className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              </div>
              <p className="text-xs font-mono text-gold/80 leading-relaxed">
                This proposal reached democratic consensus and was enshrined as law by the Lobby.
              </p>
            </div>

            {/* ── Body preview ────────────────────────────────────── */}
            {law.body_markdown && (
              <div className="rounded-xl bg-surface-200/60 border border-surface-300 px-4 py-3 mb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Scroll className="h-3 w-3 text-surface-500" aria-hidden="true" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">
                    Law text preview
                  </span>
                </div>
                <p className="text-xs font-mono text-surface-400 leading-relaxed line-clamp-3">
                  {law.body_markdown
                    .replace(/^#{1,6}\s+/gm, '')
                    .replace(/\*\*/g, '')
                    .replace(/\n+/g, ' ')
                    .trim()
                    .slice(0, 280)}…
                </p>
              </div>
            )}

            {/* ── Proposed by ─────────────────────────────────────── */}
            {author && (
              <Link
                href={`/profile/${author.username}`}
                className="flex items-center gap-3 p-3.5 rounded-2xl border border-surface-300 bg-surface-200/40 hover:bg-surface-200 transition-colors mb-4"
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
                  <p className="text-[11px] font-mono text-surface-500">
                    @{author.username} · original author
                  </p>
                </div>
                {author.role && author.role !== 'person' && (
                  <span className="text-[10px] font-mono text-surface-400 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full flex-shrink-0">
                    {ROLE_LABEL[author.role] ?? author.role}
                  </span>
                )}
              </Link>
            )}
          </div>

          {/* Gold shimmer strip at bottom */}
          <div className="h-px w-full bg-gradient-to-r from-gold/0 via-gold/30 to-gold/0" />
        </article>

        {/* ── CTAs ──────────────────────────────────────────────────── */}
        <div className="mt-5 flex flex-col gap-3">
          <Link
            href={`/law/${law.id}`}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-mono font-bold text-sm bg-gold/80 hover:bg-gold text-black transition-all"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Read the full law
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>

          {argCount > 0 && (
            <Link
              href={`/topic/${law.topic_id}#arguments`}
              className="flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-sm text-surface-400 hover:text-white bg-surface-200 border border-surface-300 hover:border-surface-400 transition-all"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              See {argCount.toLocaleString()} {argCount === 1 ? 'argument' : 'arguments'} that shaped this law
            </Link>
          )}

          <Link
            href="/law"
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-sm text-surface-500 hover:text-surface-400 transition-colors"
          >
            <Scale className="h-4 w-4" aria-hidden="true" />
            Browse the Law Codex
          </Link>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-mono text-xs text-surface-600 hover:text-surface-400 transition-colors"
          >
            Explore Lobby Market
          </Link>
        </div>

        {/* ── Brand footer ──────────────────────────────────────────── */}
        <div className="mt-10 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-1">
            <span className="text-white font-bold text-lg tracking-wider">LOBBY</span>
            <span className="text-surface-500 font-bold text-lg tracking-wider">MARKET</span>
          </div>
          <div className="flex h-0.5 w-24">
            <div className="flex-1 bg-gold rounded-l-full" />
            <div className="flex-1 bg-surface-400 rounded-r-full" />
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
