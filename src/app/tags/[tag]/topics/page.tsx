import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  Gavel,
  Scale,
  Tag,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { tag: string }
  searchParams?: { sort?: string; status?: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tag = decodeURIComponent(params.tag)
  return {
    title: `Topics about #${tag} · Lobby Market`,
    description: `Browse all civic debates tagged "${tag}" on Lobby Market — proposals, active debates, and established laws.`,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active:   'Active',
  voting:   'Voting',
  law:      'LAW',
  failed:   'Failed',
}

const STATUS_ICON: Record<string, typeof Zap> = {
  proposed: FileText,
  active:   Zap,
  voting:   Scale,
  law:      Gavel,
  failed:   FileText,
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

type SortKey = 'hot' | 'new' | 'top'
type StatusFilter = 'all' | 'active' | 'voting' | 'law' | 'proposed'

const SORT_OPTIONS: { id: SortKey; label: string; icon: typeof TrendingUp }[] = [
  { id: 'hot',  label: 'Hot',  icon: Flame },
  { id: 'new',  label: 'New',  icon: Clock },
  { id: 'top',  label: 'Top',  icon: TrendingUp },
]

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all',      label: 'All' },
  { id: 'active',   label: 'Active' },
  { id: 'voting',   label: 'Voting' },
  { id: 'law',      label: 'Law' },
  { id: 'proposed', label: 'Proposed' },
]

// ── Main ──────────────────────────────────────────────────────────────────────

export default async function TagTopicsPage({ params, searchParams }: PageProps) {
  const tag   = decodeURIComponent(params.tag)
  const sort  = (searchParams?.sort ?? 'hot') as SortKey
  const statusFilter = (searchParams?.status ?? 'all') as StatusFilter

  const supabase = await createClient()

  // Verify tag exists — check that at least one topic has this tag
  const { count } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .contains('tags', [tag])

  if (!count || count === 0) notFound()

  // Build query
  let query = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, view_count, feed_score, created_at')
    .contains('tags', [tag])
    .limit(60)

  // Status filter
  if (statusFilter === 'voting') {
    query = query.eq('status', 'voting')
  } else if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  } else {
    // Exclude failed from "All" view by default
    query = query.neq('status', 'failed')
  }

  // Sort
  if (sort === 'hot') {
    query = query.order('feed_score', { ascending: false, nullsFirst: false })
                 .order('total_votes', { ascending: false })
  } else if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('total_votes', { ascending: false })
  }

  const { data: topics } = await query

  const topicList = (topics ?? []) as {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    view_count: number
    feed_score: number | null
    created_at: string
  }[]

  // Summary counts per status
  const { data: statusCounts } = await supabase
    .from('topics')
    .select('status')
    .contains('tags', [tag])
    .neq('status', 'failed')

  const countByStatus = (statusCounts ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

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
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Tag className="h-4 w-4 text-surface-500" />
              <h1 className="text-lg font-bold text-white font-mono">
                #{tag} Topics
              </h1>
            </div>
            <p className="text-sm text-surface-500">
              {count?.toLocaleString()} debate{count !== 1 ? 's' : ''} tagged
            </p>
          </div>

          {/* Status summary pills */}
          <div className="flex flex-wrap gap-1.5 justify-end">
            {countByStatus.law ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-gold/10 text-gold border border-gold/30">
                {countByStatus.law} laws
              </span>
            ) : null}
            {countByStatus.active ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-for-600/10 text-for-400 border border-for-600/30">
                {countByStatus.active} active
              </span>
            ) : null}
            {countByStatus.voting ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple/10 text-purple border border-purple/30">
                {countByStatus.voting} voting
              </span>
            ) : null}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 mb-5">
          {/* Sort */}
          <div className="flex items-center gap-2">
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const active = sort === opt.id
              return (
                <Link
                  key={opt.id}
                  href={`/tags/${encodeURIComponent(tag)}/topics?sort=${opt.id}&status=${statusFilter}`}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                    active
                      ? 'bg-for-600/20 border-for-600/40 text-for-300'
                      : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {opt.label}
                </Link>
              )
            })}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_OPTIONS.map((opt) => (
              <Link
                key={opt.id}
                href={`/tags/${encodeURIComponent(tag)}/topics?sort=${sort}&status=${opt.id}`}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                  statusFilter === opt.id
                    ? 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {opt.label}
                {opt.id !== 'all' && countByStatus[opt.id === 'voting' ? 'voting' : opt.id]
                  ? ` (${countByStatus[opt.id === 'voting' ? 'voting' : opt.id]})`
                  : ''}
              </Link>
            ))}
          </div>
        </div>

        {/* Topic list */}
        {topicList.length === 0 ? (
          <EmptyState
            icon={<Tag className="h-8 w-8" />}
            title="No topics found"
            description={`No ${statusFilter !== 'all' ? statusFilter + ' ' : ''}debates tagged #${tag} yet.`}
            actions={[{ label: `All #${tag} topics`, href: `/tags/${encodeURIComponent(tag)}/topics` }]}
          />
        ) : (
          <div className="space-y-2">
            {topicList.map((topic) => {
              const StatusIcon = STATUS_ICON[topic.status] ?? FileText
              const forPct = Math.round(topic.blue_pct ?? 50)
              const agPct  = 100 - forPct
              const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'

              return (
                <Link
                  key={topic.id}
                  href={`/topic/${topic.id}`}
                  className="block rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-4 transition-all group"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
                        <StatusIcon className="h-3 w-3 mr-1" aria-hidden />
                        {STATUS_LABEL[topic.status] ?? topic.status}
                      </Badge>
                      {topic.category && (
                        <span className={cn('text-[11px] font-mono font-semibold', catColor)}>
                          {topic.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-surface-600">
                      <Users className="h-3 w-3" aria-hidden />
                      {topic.total_votes >= 1000
                        ? `${(topic.total_votes / 1000).toFixed(1)}K`
                        : topic.total_votes}
                      <span className="text-surface-700 ml-1">{relativeTime(topic.created_at)}</span>
                    </div>
                  </div>

                  {/* Statement */}
                  <p className="text-sm text-white font-medium leading-snug mb-3 line-clamp-2 group-hover:text-white/90 transition-colors">
                    {topic.statement}
                  </p>

                  {/* Vote bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-for-400 font-semibold">{forPct}% For</span>
                      <span className="text-against-400 font-semibold">{agPct}% Against</span>
                    </div>
                    <div className="relative h-1 rounded-full overflow-hidden bg-surface-300">
                      <div
                        className="absolute inset-y-0 left-0 bg-for-500 rounded-l-full"
                        style={{ width: `${forPct}%` }}
                      />
                      <div
                        className="absolute inset-y-0 right-0 bg-against-500 rounded-r-full"
                        style={{ width: `${agPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Chevron */}
                  <div className="flex justify-end mt-2">
                    <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" aria-hidden />
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Footer nav */}
        <div className="mt-8 flex items-center gap-3 flex-wrap">
          <Link
            href={`/tags/${encodeURIComponent(tag)}/laws`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-xs font-mono hover:bg-gold/20 transition-colors"
          >
            <Gavel className="h-3.5 w-3.5" />
            Established laws
          </Link>
          <Link
            href={`/tags/${encodeURIComponent(tag)}/arguments`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-for-600/10 border border-for-600/30 text-for-400 text-xs font-mono hover:bg-for-600/20 transition-colors"
          >
            <Zap className="h-3.5 w-3.5" />
            Arguments
          </Link>
          <Link
            href={`/tags/${encodeURIComponent(tag)}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 text-xs font-mono hover:text-white hover:border-surface-400 transition-colors"
          >
            <Tag className="h-3.5 w-3.5" />
            #{tag} overview
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
