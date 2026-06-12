import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  FileText,
  Gavel,
  Scale,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicEntry {
  id: string
  statement: string
  category: string | null
  status: string
  blue_votes: number
  red_votes: number
  total_votes: number
  blue_pct: number
  created_at: string
  scope: string
}

type StatusFilter = 'all' | 'proposed' | 'active' | 'voting' | 'law' | 'failed'

interface PageProps {
  params: { username: string }
  searchParams: { status?: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  proposed: { label: 'Proposed', color: 'text-surface-400', bg: 'bg-surface-300/40', border: 'border-surface-400/30', icon: FileText },
  active:   { label: 'Active',   color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     icon: Zap },
  voting:   { label: 'Voting',   color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30',      icon: Scale },
  law:      { label: 'LAW',      color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        icon: Gavel },
  failed:   { label: 'Failed',   color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', icon: FileText },
}

const CAT_COLOR: Record<string, string> = {
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

const FILTER_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'law',      label: 'Laws' },
  { id: 'active',   label: 'Active' },
  { id: 'voting',   label: 'Voting' },
  { id: 'proposed', label: 'Proposed' },
  { id: 'failed',   label: 'Failed' },
]

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Topics · Lobby Market' }

  const displayName = profile.display_name ?? profile.username
  const title = `${displayName}'s Topics · Lobby Market`
  const description = `All topics authored by ${displayName} on Lobby Market — from proposed debates to established laws.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/profile/${params.username}/topics`,
      images: [{ url: `${BASE_URL}/api/og/profile/${params.username}`, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = 'neutral',
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'for' | 'against' | 'gold' | 'emerald' | 'purple' | 'neutral'
}) {
  const accentClass = {
    for:     'text-for-400',
    against: 'text-against-400',
    gold:    'text-gold',
    emerald: 'text-emerald',
    purple:  'text-purple',
    neutral: 'text-white',
  }[accent]

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex flex-col gap-1">
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{label}</span>
      <span className={cn('text-2xl font-black font-mono leading-none', accentClass)}>{value}</span>
      {sub && <span className="text-[10px] font-mono text-surface-600">{sub}</span>}
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({ topic }: { topic: TopicEntry }) {
  const cfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const StatusIcon = cfg.icon
  const catColor = CAT_COLOR[topic.category ?? ''] ?? 'text-surface-500'
  const bluePct = topic.total_votes > 0 ? Math.round(topic.blue_pct) : 50
  const redPct = 100 - bluePct

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group flex flex-col gap-2 rounded-2xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 hover:bg-surface-200 transition-colors"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-white leading-snug flex-1 group-hover:text-for-200 transition-colors">
          {topic.statement}
        </p>
        <ChevronRight className="w-4 h-4 text-surface-500 shrink-0 mt-0.5 group-hover:text-surface-300 transition-colors" />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border', cfg.color, cfg.bg, cfg.border)}>
          <StatusIcon className="w-2.5 h-2.5" />
          {cfg.label}
        </span>
        {topic.category && (
          <span className={cn('text-[10px] font-mono', catColor)}>{topic.category}</span>
        )}
        {topic.scope !== 'global' && (
          <span className="text-[10px] font-mono text-surface-500">{topic.scope}</span>
        )}
        <span className="text-[10px] font-mono text-surface-500 ml-auto">{formatDate(topic.created_at)}</span>
      </div>

      {/* Vote bar */}
      {topic.total_votes > 0 && (
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
            <div className="bg-for-500 h-full rounded-l-full" style={{ width: `${bluePct}%` }} />
            <div className="bg-against-500 h-full rounded-r-full" style={{ width: `${redPct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-for-400 shrink-0">{bluePct}% FOR</span>
          <span className="text-[10px] font-mono text-surface-500 shrink-0">
            {topic.total_votes.toLocaleString()} votes
          </span>
        </div>
      )}
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileTopicsPage({ params, searchParams }: PageProps) {
  const supabase = await createClient()

  // 1. Look up profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, total_votes')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  // 2. Fetch all authored topics
  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_votes, red_votes, total_votes, blue_pct, created_at, scope')
    .eq('author_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const allTopics: TopicEntry[] = (topicsRaw ?? []) as TopicEntry[]

  // 3. Apply status filter
  const statusFilter = (searchParams.status ?? 'all') as StatusFilter
  const filteredTopics = statusFilter === 'all'
    ? allTopics
    : allTopics.filter((t) => t.status === statusFilter)

  // 4. Compute stats
  const totalAuthored = allTopics.length
  const lawCount     = allTopics.filter((t) => t.status === 'law').length
  const activeCount  = allTopics.filter((t) => t.status === 'active' || t.status === 'voting').length
  const totalVotesGenerated = allTopics.reduce((sum, t) => sum + (t.total_votes ?? 0), 0)

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4 space-y-5">

        {/* Back link */}
        <Link
          href={`/profile/${params.username}`}
          className="inline-flex items-center gap-1.5 text-surface-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to profile
        </Link>

        {/* Profile header */}
        <div className="flex items-center gap-3">
          <Avatar src={profile.avatar_url} username={profile.username} size="md" />
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{displayName}</h1>
            <p className="text-sm text-surface-400 font-mono">@{profile.username} · Topics Authored</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Topics" value={totalAuthored} accent="neutral" />
          <StatCard label="Laws" value={lawCount} sub="established" accent="gold" />
          <StatCard
            label="Active / Voting"
            value={activeCount}
            accent="emerald"
          />
          <StatCard
            label="Votes Generated"
            value={totalVotesGenerated.toLocaleString()}
            sub="across all topics"
            accent="for"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map((tab) => {
            const count = tab.id === 'all'
              ? allTopics.length
              : allTopics.filter((t) => t.status === tab.id).length
            const isActive = statusFilter === tab.id
            return (
              <Link
                key={tab.id}
                href={tab.id === 'all'
                  ? `/profile/${params.username}/topics`
                  : `/profile/${params.username}/topics?status=${tab.id}`}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-mono font-bold border transition-colors',
                  isActive
                    ? 'bg-for-500/20 text-for-300 border-for-500/50'
                    : 'bg-surface-100 text-surface-400 border-surface-300 hover:text-white hover:border-surface-400'
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1 opacity-60">{count}</span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Topic list */}
        {filteredTopics.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={statusFilter === 'all' ? 'No topics authored yet' : `No ${statusFilter} topics`}
            description={
              statusFilter === 'all'
                ? `${displayName} hasn't proposed any topics yet.`
                : `${displayName} has no topics with status "${statusFilter}".`
            }
          />
        ) : (
          <div className="space-y-3">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-surface-500 uppercase tracking-widest">
                {statusFilter === 'all' ? 'All Topics' : FILTER_TABS.find((t) => t.id === statusFilter)?.label ?? statusFilter}
                {' '}— {filteredTopics.length}
              </span>
              {lawCount > 0 && statusFilter === 'all' && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-gold">
                  <Gavel className="w-3 h-3" />
                  {lawCount} law{lawCount !== 1 ? 's' : ''} established
                </span>
              )}
            </div>

            {filteredTopics.map((topic) => (
              <TopicRow key={topic.id} topic={topic} />
            ))}
          </div>
        )}

        {/* Footer link back to profile */}
        <div className="flex items-center justify-center pt-4">
          <Link
            href={`/profile/${params.username}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <Users className="w-4 h-4" />
            View full profile
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
