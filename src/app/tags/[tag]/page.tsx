import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Gavel, Tag, TrendingUp, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 60

interface PageProps {
  params: { tag: string }
  searchParams?: { sort?: string; status?: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tag = decodeURIComponent(params.tag)
  return {
    title: `#${tag} · Lobby Market`,
    description: `All civic debates tagged "${tag}" on Lobby Market — browse, vote, and argue.`,
    openGraph: {
      title: `#${tag} · Lobby Market`,
      description: `Every debate tagged "${tag}" — from proposals to established laws.`,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `#${tag} · Lobby Market`,
      description: `Debates tagged "${tag}" on Lobby Market.`,
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TagPage({ params, searchParams }: PageProps) {
  const tag = decodeURIComponent(params.tag).toLowerCase()
  const sort = searchParams?.sort ?? 'top'
  const statusFilter = searchParams?.status ?? null

  const supabase = await createClient()

  let query = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, view_count, tags, created_at, voting_ends_at')
    .contains('tags', [tag])

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'hot') {
    query = query.order('view_count', { ascending: false })
  } else {
    query = query.order('total_votes', { ascending: false })
  }

  const { data, error } = await query.limit(50)

  if (error) {
    console.error('[/tags/[tag]]', error)
  }

  const topics = data ?? []
  if (!topics.length && !error) {
    // Tag exists but no topics — show empty state gracefully, don't 404
  }

  const lawCount = topics.filter((t) => t.status === 'law').length
  const activeCount = topics.filter((t) => t.status === 'active' || t.status === 'voting').length

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
    { key: 'failed', label: 'Failed' },
  ]

  function href(s: string | null, st: string | null = statusFilter) {
    const p = new URLSearchParams()
    if (s && s !== 'top') p.set('sort', s)
    if (st) p.set('status', st)
    const qs = p.toString()
    return `/tags/${encodeURIComponent(tag)}${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back + header ────────────────────────────────────────────── */}
        <Link
          href="/tags"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All tags
        </Link>

        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Tag className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">#{tag}</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {topics.length} debate{topics.length !== 1 ? 's' : ''}
                {lawCount > 0 && (
                  <span className="text-gold ml-2">· {lawCount} law{lawCount !== 1 ? 's' : ''}</span>
                )}
                {activeCount > 0 && (
                  <span className="text-emerald ml-2">· {activeCount} live</span>
                )}
              </p>
            </div>
          </div>
        </div>

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
          <div className="flex items-center gap-1">
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
            title={`No debates tagged "${tag}"`}
            description="This tag has no matching debates yet — they'll appear here automatically."
            action={{ label: 'Browse all tags', href: '/tags' }}
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

                  {/* Tags */}
                  {tags.length > 1 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {tags.slice(0, 4).map((t) => (
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
