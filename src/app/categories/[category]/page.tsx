import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Gavel,
  Scale,
  Zap,
  FileText,
  Clock,
  Flame,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

// ─── Canonical category map ───────────────────────────────────────────────────

const CANONICAL_CATEGORIES: Record<string, string> = {
  economics: 'Economics',
  politics: 'Politics',
  technology: 'Technology',
  science: 'Science',
  ethics: 'Ethics',
  philosophy: 'Philosophy',
  culture: 'Culture',
  health: 'Health',
  environment: 'Environment',
  education: 'Education',
}

const CATEGORY_COLOR: Record<string, { badge: string; bar: string; text: string }> = {
  Economics: { badge: 'text-gold bg-gold/10 border-gold/30', bar: 'bg-gold', text: 'text-gold' },
  Politics: { badge: 'text-for-400 bg-for-500/10 border-for-500/30', bar: 'bg-for-500', text: 'text-for-400' },
  Technology: { badge: 'text-purple bg-purple/10 border-purple/30', bar: 'bg-purple', text: 'text-purple' },
  Science: { badge: 'text-emerald bg-emerald/10 border-emerald/30', bar: 'bg-emerald', text: 'text-emerald' },
  Ethics: { badge: 'text-against-400 bg-against-500/10 border-against-500/30', bar: 'bg-against-500', text: 'text-against-400' },
  Philosophy: { badge: 'text-for-300 bg-for-500/10 border-for-500/20', bar: 'bg-for-400', text: 'text-for-300' },
  Culture: { badge: 'text-gold bg-gold/10 border-gold/20', bar: 'bg-gold', text: 'text-gold' },
  Health: { badge: 'text-against-300 bg-against-500/10 border-against-500/30', bar: 'bg-against-400', text: 'text-against-300' },
  Environment: { badge: 'text-emerald bg-emerald/10 border-emerald/30', bar: 'bg-emerald', text: 'text-emerald' },
  Education: { badge: 'text-purple bg-purple/10 border-purple/30', bar: 'bg-purple', text: 'text-purple' },
}

interface PageProps {
  params: { category: string }
  searchParams: { status?: string; sort?: string }
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
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_BADGE: Record<
  string,
  'proposed' | 'active' | 'law' | 'failed'
> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const name = CANONICAL_CATEGORIES[params.category.toLowerCase()]
  if (!name) return { title: 'Category · Lobby Market' }

  return {
    title: `${name} · Lobby Market`,
    description: `Browse all ${name} debates, laws, and proposals on Lobby Market.`,
    openGraph: {
      title: `${name} Debates · Lobby Market`,
      description: `Explore ${name} topics — proposed, active, and established as law.`,
      type: 'website',
      siteName: 'Lobby Market',
    },
  }
}

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { id: 'top', label: 'Top', icon: TrendingUp },
  { id: 'new', label: 'New', icon: Clock },
  { id: 'hot', label: 'Hot', icon: Flame },
] as const

const STATUS_FILTERS = [
  { id: null, label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'voting', label: 'Voting' },
  { id: 'law', label: 'LAW' },
  { id: 'proposed', label: 'Proposed' },
  { id: 'failed', label: 'Failed' },
] as const

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const name = CANONICAL_CATEGORIES[params.category.toLowerCase()]
  if (!name) notFound()

  const statusFilter = searchParams.status ?? null
  const sort = searchParams.sort ?? 'top'
  const colors = CATEGORY_COLOR[name] ?? CATEGORY_COLOR.Politics

  const supabase = await createClient()

  let query = supabase
    .from('topics')
    .select(
      'id, statement, description, category, status, blue_pct, blue_votes, red_votes, total_votes, created_at, feed_score, view_count'
    )
    .eq('category', name)

  if (statusFilter) {
    query = query.eq('status', statusFilter as 'proposed' | 'active' | 'voting' | 'law' | 'failed')
  } else {
    query = query.in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
  }

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'hot') {
    query = query
      .order('total_votes', { ascending: false })
      .order('created_at', { ascending: false })
  } else {
    query = query
      .order('feed_score', { ascending: false })
      .order('created_at', { ascending: false })
  }

  query = query.limit(50)

  const { data: topics } = await query
  const rows = topics ?? []

  // Stats for header
  const allTopics = await supabase
    .from('topics')
    .select('status, total_votes')
    .eq('category', name)
    .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])

  const allRows = allTopics.data ?? []
  const totalLaws = allRows.filter((t) => t.status === 'law').length
  const totalActive = allRows.filter(
    (t) => t.status === 'active' || t.status === 'voting'
  ).length
  const totalVotes = allRows.reduce((s, t) => s + (t.total_votes ?? 0), 0)

  // Build filter URL helper
  function filterUrl(newStatus: string | null, newSort?: string) {
    const p = new URLSearchParams()
    if (newStatus) p.set('status', newStatus)
    if (newSort ?? sort !== 'top') p.set('sort', newSort ?? sort)
    const qs = p.toString()
    return `/categories/${params.category}${qs ? `?${qs}` : ''}`
  }

  function sortUrl(newSort: string) {
    const p = new URLSearchParams()
    if (statusFilter) p.set('status', statusFilter)
    if (newSort !== 'top') p.set('sort', newSort)
    const qs = p.toString()
    return `/categories/${params.category}${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Breadcrumb ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6 text-xs font-mono text-surface-500">
          <Link href="/categories" className="hover:text-white transition-colors">
            Categories
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span className={colors.text}>{name}</span>
        </div>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4 mb-6">
          <Link
            href="/categories"
            aria-label="Back to categories"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0 mt-1"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-2xl font-bold text-white">{name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="font-mono text-xs text-surface-500 flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {allRows.length} topics
              </span>
              {totalActive > 0 && (
                <span className="font-mono text-xs text-emerald flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5" />
                  {totalActive} active
                </span>
              )}
              {totalLaws > 0 && (
                <span className="font-mono text-xs text-gold flex items-center gap-1">
                  <Gavel className="h-3.5 w-3.5" />
                  {totalLaws} law{totalLaws !== 1 ? 's' : ''}
                </span>
              )}
              {totalVotes > 0 && (
                <span className="font-mono text-xs text-surface-500 flex items-center gap-1">
                  <BarChart2 className="h-3.5 w-3.5" />
                  {totalVotes.toLocaleString()} votes cast
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Filters ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Status filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map(({ id, label }) => {
              const isActive = statusFilter === id
              return (
                <Link
                  key={label}
                  href={filterUrl(id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-colors border',
                    isActive
                      ? 'bg-surface-300 text-white border-surface-400'
                      : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400'
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-surface-500">
              Sort:
            </span>
            {SORT_OPTIONS.map(({ id, label, icon: Icon }) => {
              const isActive = sort === id
              return (
                <Link
                  key={id}
                  href={sortUrl(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-colors border',
                    isActive
                      ? 'bg-surface-300 text-white border-surface-400'
                      : 'bg-surface-100 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400'
                  )}
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>

        {/* ── Topics list ────────────────────────────────────────────── */}
        {rows.length === 0 ? (
          <EmptyState
            icon={Scale}
            title={`No ${name.toLowerCase()} topics yet`}
            description="Be the first to propose a debate in this category."
            actions={[{ label: 'Propose a topic', href: '/' }]}
          />
        ) : (
          <div className="space-y-3">
            {rows.map((topic) => {
              const forPct = Math.round(topic.blue_pct ?? 50)
              const againstPct = 100 - forPct
              const badgeVariant = STATUS_BADGE[topic.status] ?? 'proposed'

              return (
                <Link
                  key={topic.id}
                  href={`/topic/${topic.id}`}
                  className={cn(
                    'group flex flex-col gap-3 p-4 rounded-xl',
                    'bg-surface-100 border border-surface-300',
                    'hover:border-surface-400 transition-all duration-150',
                    topic.status === 'law' && 'border-gold/30 hover:border-gold/50'
                  )}
                >
                  {/* Statement + badge */}
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-mono text-sm text-white leading-snug flex-1 min-w-0 line-clamp-3">
                      {topic.statement}
                    </p>
                    <Badge variant={badgeVariant} className="flex-shrink-0 mt-0.5">
                      {STATUS_LABEL[topic.status] ?? topic.status}
                    </Badge>
                  </div>

                  {/* Description if available */}
                  {topic.description && (
                    <p className="font-mono text-[11px] text-surface-500 line-clamp-2 leading-relaxed">
                      {topic.description}
                    </p>
                  )}

                  {/* Vote bar + stats */}
                  {(topic.total_votes ?? 0) > 0 && (
                    <div className="space-y-1.5">
                      {/* Bar */}
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
                        <div
                          className="h-full bg-for-500 rounded-l-full"
                          style={{ width: `${forPct}%` }}
                        />
                        <div
                          className="h-full bg-against-500 rounded-r-full"
                          style={{ width: `${againstPct}%` }}
                        />
                      </div>
                      {/* Labels */}
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="text-for-400 font-semibold">{forPct}% For</span>
                        <span className="text-surface-500">
                          {(topic.total_votes ?? 0).toLocaleString()} votes
                        </span>
                        <span className="text-against-400 font-semibold">{againstPct}% Against</span>
                      </div>
                    </div>
                  )}

                  {/* Footer: time */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-surface-500">
                      {relativeTime(topic.created_at)}
                    </span>
                    <ChevronRight
                      className="h-3.5 w-3.5 text-surface-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-hidden="true"
                    />
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* ── Bottom CTA ─────────────────────────────────────────────── */}
        {rows.length > 0 && (
          <div className="mt-8 text-center">
            <p className="font-mono text-xs text-surface-500">
              Showing {rows.length} {name.toLowerCase()} topic{rows.length !== 1 ? 's' : ''}.{' '}
              <Link href="/categories" className="text-for-400 hover:text-for-300 transition-colors">
                Browse other categories
              </Link>
            </p>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
