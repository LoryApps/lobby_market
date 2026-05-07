import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, BarChart2, Gavel, GitCompare, Tag, TrendingUp, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { TagFollowButton } from '@/components/ui/TagFollowButton'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 60

interface PageProps {
  params: { tag: string }
  searchParams?: { sort?: string; status?: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tag = decodeURIComponent(params.tag)
  const ogImageUrl = `/api/og/tag/${encodeURIComponent(tag)}`
  return {
    title: `#${tag} · Lobby Market`,
    description: `All civic debates tagged "${tag}" on Lobby Market — browse, vote, and argue.`,
    openGraph: {
      title: `#${tag} · Lobby Market`,
      description: `Every debate tagged "${tag}" — from proposals to established laws.`,
      type: 'website',
      siteName: 'Lobby Market',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `#${tag} debates on Lobby Market` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `#${tag} · Lobby Market`,
      description: `Debates tagged "${tag}" on Lobby Market.`,
      images: [ogImageUrl],
    },
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
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
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

const CATEGORY_PILL: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-against-500/10 text-against-300 border-against-500/30',
  Philosophy:  'bg-for-500/5 text-for-300 border-for-500/20',
  Culture:     'bg-gold/10 text-gold border-gold/30',
  Health:      'bg-against-500/10 text-against-300 border-against-500/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-purple/10 text-purple border-purple/30',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TagPage({ params, searchParams }: PageProps) {
  const tag = decodeURIComponent(params.tag).toLowerCase()
  const sort = searchParams?.sort ?? 'top'
  const statusFilter = searchParams?.status ?? null

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Fetch topics + follow status in parallel ──────────────────────────────
  const [topicsRes, followRes, countRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, tags, created_at, voting_ends_at')
      .contains('tags', [tag])
      .limit(200),
    user
      ? supabase
          .from('user_tag_follows')
          .select('tag')
          .eq('user_id', user.id)
          .eq('tag', tag)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('user_tag_follows')
      .select('user_id', { count: 'exact', head: true })
      .eq('tag', tag),
  ])

  const allTagTopics = topicsRes.data ?? []
  const initialFollowing = !!followRes.data
  const followerCount = countRes.count ?? 0

  // ── Aggregate sentiment ────────────────────────────────────────────────────
  const votedTopics = allTagTopics.filter((t) => (t.total_votes ?? 0) > 0)
  const totalVotesAcrossTag = votedTopics.reduce((sum, t) => sum + (t.total_votes ?? 0), 0)

  // Weighted average FOR% (weighted by vote count so high-volume topics count more)
  const weightedForPct =
    totalVotesAcrossTag > 0
      ? Math.round(
          votedTopics.reduce((sum, t) => sum + (t.blue_pct ?? 50) * (t.total_votes ?? 0), 0) /
            totalVotesAcrossTag,
        )
      : 50

  const lawCount = allTagTopics.filter((t) => t.status === 'law').length
  const activeCount = allTagTopics.filter((t) => t.status === 'active' || t.status === 'voting').length
  const proposedCount = allTagTopics.filter((t) => t.status === 'proposed').length

  // ── Related tags ──────────────────────────────────────────────────────────
  // Count co-occurrence of every other tag across all topics carrying this tag
  const coTagCounts = new Map<string, number>()
  for (const topic of allTagTopics) {
    const topicTags: string[] = (topic as { tags?: string[] }).tags ?? []
    for (const t of topicTags) {
      if (t !== tag) {
        coTagCounts.set(t, (coTagCounts.get(t) ?? 0) + 1)
      }
    }
  }
  const relatedTags = Array.from(coTagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t)

  // ── Category breakdown ────────────────────────────────────────────────────
  const catCounts = new Map<string, number>()
  for (const topic of allTagTopics) {
    if (topic.category) {
      catCounts.set(topic.category, (catCounts.get(topic.category) ?? 0) + 1)
    }
  }
  const categoryBreakdown = Array.from(catCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // ── Filtered + sorted list for display ────────────────────────────────────
  let topics = [...allTagTopics]

  if (statusFilter) {
    topics = topics.filter((t) =>
      statusFilter === 'active' ? t.status === 'active' || t.status === 'voting' : t.status === statusFilter,
    )
  }

  if (sort === 'new') {
    topics.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else if (sort === 'hot') {
    topics.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
  } else {
    topics.sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
  }

  topics = topics.slice(0, 50)

  // Sort options as links
  const sorts = [
    { key: 'top', label: 'Top' },
    { key: 'new', label: 'New' },
    { key: 'hot', label: 'Hot' },
  ]

  const statusFilters = [
    { key: null, label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'voting', label: 'Voting' },
    { key: 'law', label: 'LAW' },
    { key: 'proposed', label: 'Proposed' },
    { key: 'failed', label: 'Failed' },
  ]

  function href(s: string | null, st: string | null = statusFilter) {
    const p = new URLSearchParams()
    if (s && s !== 'top') p.set('sort', s)
    if (st) p.set('status', st)
    const qs = p.toString()
    return `/tags/${encodeURIComponent(tag)}${qs ? `?${qs}` : ''}`
  }

  const forPctDisplay = weightedForPct
  const againstPctDisplay = 100 - forPctDisplay
  const leanLabel =
    forPctDisplay >= 60
      ? 'Mostly FOR'
      : forPctDisplay <= 40
        ? 'Mostly AGAINST'
        : 'Contested'
  const leanColor =
    forPctDisplay >= 60
      ? 'text-for-400'
      : forPctDisplay <= 40
        ? 'text-against-400'
        : 'text-surface-400'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back + header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/tags"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All tags
          </Link>
          <Link
            href={`/tags/compare?a=${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-purple transition-colors"
          >
            <GitCompare className="h-3.5 w-3.5" />
            Compare
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Tag className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">#{tag}</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {allTagTopics.length} debate{allTagTopics.length !== 1 ? 's' : ''}
                {lawCount > 0 && (
                  <span className="text-gold ml-2">· {lawCount} law{lawCount !== 1 ? 's' : ''}</span>
                )}
                {activeCount > 0 && (
                  <span className="text-emerald ml-2">· {activeCount} live</span>
                )}
              </p>
            </div>
          </div>

          <TagFollowButton
            tag={tag}
            initialFollowing={initialFollowing}
            initialCount={followerCount}
          />
        </div>

        {/* ── Sentiment + stats panel ───────────────────────────────────── */}
        {allTagTopics.length > 0 && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6 space-y-4">
            {/* Weighted sentiment */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-surface-500">
                  Consensus sentiment
                  {totalVotesAcrossTag > 0 && (
                    <span className="ml-2 text-surface-600">
                      across {totalVotesAcrossTag.toLocaleString()} votes
                    </span>
                  )}
                </span>
                <span className={cn('text-xs font-mono font-semibold', leanColor)}>
                  {leanLabel}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full overflow-hidden bg-surface-300 flex">
                <div
                  className="h-full bg-gradient-to-r from-for-600 to-for-400 transition-all"
                  style={{ width: `${forPctDisplay}%` }}
                  aria-label={`${forPctDisplay}% in favour`}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono">
                <span className="text-for-400 font-semibold">{forPctDisplay}% FOR</span>
                <span className="text-against-400 font-semibold">{againstPctDisplay}% AGAINST</span>
              </div>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-xl bg-surface-200/50 border border-surface-300 px-3 py-2.5 text-center">
                <p className="font-mono text-lg font-bold text-white">{allTagTopics.length}</p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">Debates</p>
              </div>
              <div className="rounded-xl bg-surface-200/50 border border-surface-300 px-3 py-2.5 text-center">
                <p className="font-mono text-lg font-bold text-gold">{lawCount}</p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">Laws</p>
              </div>
              <div className="rounded-xl bg-surface-200/50 border border-surface-300 px-3 py-2.5 text-center">
                <p className="font-mono text-lg font-bold text-emerald">{activeCount}</p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">Live</p>
              </div>
              <div className="rounded-xl bg-surface-200/50 border border-surface-300 px-3 py-2.5 text-center">
                <p className="font-mono text-lg font-bold text-surface-300">{proposedCount}</p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">Proposed</p>
              </div>
            </div>

            {/* Category breakdown */}
            {categoryBreakdown.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-surface-500 mb-2 uppercase tracking-wider">
                  Categories
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {categoryBreakdown.map(([cat, count]) => (
                    <Link
                      key={cat}
                      href={`/categories/${cat.toLowerCase()}`}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border transition-opacity hover:opacity-80',
                        CATEGORY_PILL[cat] ?? 'bg-surface-200 text-surface-400 border-surface-300',
                      )}
                    >
                      <BarChart2 className="h-2.5 w-2.5" aria-hidden />
                      {cat}
                      <span className="opacity-60">({count})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Related tags ──────────────────────────────────────────────── */}
        {relatedTags.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
              Related tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {relatedTags.map((t) => (
                <Link
                  key={t}
                  href={`/tags/${encodeURIComponent(t)}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs border bg-surface-200/50 text-surface-400 border-surface-300 hover:text-white hover:border-surface-400 transition-colors"
                >
                  #{t}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Filter / sort bar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-5 flex-wrap">
          {/* Sort */}
          <div className="flex items-center gap-1">
            {sorts.map((s) => (
              <Link
                key={s.key}
                href={href(s.key)}
                className={cn(
                  'px-3 py-1 rounded-full font-mono text-xs border transition-all',
                  sort === s.key
                    ? 'bg-for-500/20 text-for-300 border-for-500/40'
                    : 'bg-surface-200/50 text-surface-500 border-surface-300 hover:text-surface-300',
                )}
              >
                {s.label}
              </Link>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 flex-wrap">
            {statusFilters.map((sf) => (
              <Link
                key={sf.key ?? 'all'}
                href={href(sort, sf.key)}
                className={cn(
                  'px-2.5 py-1 rounded-full font-mono text-xs border transition-all',
                  statusFilter === sf.key
                    ? 'bg-surface-300 text-white border-surface-400'
                    : 'bg-surface-200/50 text-surface-600 border-surface-300 hover:text-surface-400',
                )}
              >
                {sf.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Topics ────────────────────────────────────────────────────── */}
        {topics.length === 0 ? (
          <EmptyState
            icon={Tag}
            title={statusFilter ? `No ${statusFilter} debates tagged "${tag}"` : `No debates tagged "${tag}"`}
            description="This tag has no matching debates yet — they'll appear here automatically."
            actions={[{ label: 'Browse all tags', href: '/tags' }]}
          />
        ) : (
          <div className="space-y-3">
            {topics.map((topic) => {
              const forPct = Math.round(topic.blue_pct ?? 50)
              const againstPct = 100 - forPct
              const tags: string[] = (topic as { tags?: string[] }).tags ?? []

              return (
                <Link
                  key={topic.id}
                  href={`/topic/${topic.id}`}
                  className="group block bg-surface-100/50 hover:bg-surface-100 border border-surface-200 hover:border-surface-300 rounded-xl p-4 transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
                        {STATUS_LABEL[topic.status] ?? topic.status}
                      </Badge>
                      {topic.category && (
                        <span className={cn('font-mono text-xs', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
                          {topic.category}
                        </span>
                      )}
                    </div>
                    <span className="text-surface-600 font-mono text-xs flex-shrink-0">
                      {relativeTime(topic.created_at)}
                    </span>
                  </div>

                  <p className="text-surface-200 font-mono text-sm leading-relaxed group-hover:text-white transition-colors line-clamp-2 mb-3">
                    {topic.statement}
                  </p>

                  {/* Vote bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-for-400">{forPct}% FOR</span>
                      <span className="text-surface-500">{(topic.total_votes ?? 0).toLocaleString()} votes</span>
                      <span className="text-against-400">{againstPct}% AGAINST</span>
                    </div>
                    <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all"
                        style={{ width: `${forPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Tags (show others besides current tag) */}
                  {tags.length > 1 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {tags.slice(0, 5).map((t) => (
                        <span
                          key={t}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
                            t === tag
                              ? 'bg-for-500/20 text-for-300 border-for-500/30'
                              : 'bg-surface-200/50 text-surface-500 border-surface-300',
                          )}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="flex items-center gap-3 mt-3 text-surface-600 text-[10px] font-mono">
                    {topic.status === 'law' && (
                      <span className="flex items-center gap-1 text-gold">
                        <Gavel className="h-3 w-3" />
                        Established Law
                      </span>
                    )}
                    {(topic.status === 'active' || topic.status === 'voting') && (
                      <span className="flex items-center gap-1 text-emerald">
                        <Zap className="h-3 w-3" />
                        Live
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {(topic.view_count ?? 0).toLocaleString()} views
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
