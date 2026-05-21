import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ChevronUp,
  ExternalLink,
  Link2,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

// ─── Grade display config ─────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { text: string; bg: string; border: string; label: string }> = {
  A: { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      label: 'Exceptional' },
  B: { text: 'text-for-300',      bg: 'bg-for-500/10',      border: 'border-for-500/30',      label: 'Strong' },
  C: { text: 'text-gold',         bg: 'bg-gold/10',          border: 'border-gold/30',          label: 'Adequate' },
  D: { text: 'text-against-300',  bg: 'bg-against-500/10',   border: 'border-against-500/30',   label: 'Weak' },
  F: { text: 'text-against-400',  bg: 'bg-against-600/10',   border: 'border-against-600/30',   label: 'Poor' },
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

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function avgGrade(grades: (string | null)[]): string | null {
  const gradeOrder = ['A', 'B', 'C', 'D', 'F']
  const valid = grades.filter((g): g is string => g !== null && gradeOrder.includes(g))
  if (valid.length === 0) return null
  const avg = valid.reduce((sum, g) => sum + gradeOrder.indexOf(g), 0) / valid.length
  return gradeOrder[Math.round(avg)]
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

interface PageProps {
  params: { username: string }
  searchParams: { side?: string; category?: string; sort?: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, total_arguments')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Arguments · Lobby Market' }

  const displayName = profile.display_name ?? profile.username
  const count = (profile as { total_arguments?: number }).total_arguments ?? 0
  const title = `${displayName}'s Arguments · Lobby Market`
  const description = `${count} civic argument${count === 1 ? '' : 's'} by ${displayName} — their complete case history on Lobby Market debates.`
  const ogImage = `${BASE_URL}/api/og/profile/${profile.username}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileArgumentsPage({ params, searchParams }: PageProps) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  const side = searchParams.side === 'for' ? 'blue' : searchParams.side === 'against' ? 'red' : null
  const category = searchParams.category && searchParams.category !== 'All' ? searchParams.category : null
  const sort = (searchParams.sort as 'upvotes' | 'new' | 'grade') ?? 'upvotes'

  // Build base query — join topic for category/status context
  let query = supabase
    .from('topic_arguments')
    .select(`
      id,
      side,
      content,
      upvotes,
      source_url,
      ai_grade,
      ai_score,
      created_at,
      topic:topics ( id, statement, category, status )
    `)
    .eq('user_id', profile.id)

  if (side) query = query.eq('side', side)

  // Category filter applied post-fetch (join filter)
  const { data: rawArgs } = await query.order('upvotes', { ascending: false }).limit(200)

  type ArgRow = {
    id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    source_url: string | null
    ai_grade: string | null
    ai_score: number | null
    created_at: string
    topic: { id: string; statement: string; category: string | null; status: string } | null
  }

  let args = (rawArgs as ArgRow[] | null) ?? []

  if (category) {
    args = args.filter((a) => a.topic?.category === category)
  }

  // Sort
  if (sort === 'new') {
    args = [...args].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else if (sort === 'grade') {
    const gradeOrder = ['A', 'B', 'C', 'D', 'F']
    args = [...args].sort((a, b) => {
      const ai = a.ai_grade ? gradeOrder.indexOf(a.ai_grade) : 99
      const bi = b.ai_grade ? gradeOrder.indexOf(b.ai_grade) : 99
      return ai - bi
    })
  }

  // Stats (from unfiltered set for accuracy)
  const { data: allArgs } = await supabase
    .from('topic_arguments')
    .select('side, upvotes, ai_grade')
    .eq('user_id', profile.id)

  const all = (allArgs as { side: string; upvotes: number; ai_grade: string | null }[] | null) ?? []
  const totalUpvotes = all.reduce((s, a) => s + a.upvotes, 0)
  const forCount = all.filter((a) => a.side === 'blue').length
  const againstCount = all.filter((a) => a.side === 'red').length
  const computedAvgGrade = avgGrade(all.map((a) => a.ai_grade))

  const displayName = profile.display_name ?? profile.username

  // Filter link builder
  function filterHref(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams()
    const merged = {
      side: searchParams.side,
      category: searchParams.category,
      sort: searchParams.sort,
      ...overrides,
    }
    if (merged.side && merged.side !== 'all') p.set('side', merged.side)
    if (merged.category && merged.category !== 'All') p.set('category', merged.category)
    if (merged.sort && merged.sort !== 'upvotes') p.set('sort', merged.sort)
    const qs = p.toString()
    return `/profile/${profile.username}/arguments${qs ? `?${qs}` : ''}`
  }

  const activeSide = searchParams.side ?? 'all'
  const activeCategory = searchParams.category ?? 'All'
  const activeSort = sort

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Back link */}
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-2 text-surface-500 hover:text-white transition-colors text-sm font-mono mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar src={profile.avatar_url} fallback={displayName} size="lg" />
          <div className="min-w-0">
            <h1 className="font-mono text-2xl font-bold text-white truncate">{displayName}</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              @{profile.username} · Argument Portfolio
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className="font-mono text-xl font-bold text-white">{all.length}</div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">arguments</div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className="font-mono text-xl font-bold text-for-400">{forCount}</div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">FOR</div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className="font-mono text-xl font-bold text-against-400">{againstCount}</div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">AGAINST</div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            {computedAvgGrade ? (
              <>
                <div className={cn('font-mono text-xl font-bold', GRADE_CONFIG[computedAvgGrade]?.text ?? 'text-white')}>
                  {computedAvgGrade}
                </div>
                <div className="text-[10px] font-mono text-surface-500 mt-0.5">avg grade</div>
              </>
            ) : (
              <>
                <div className="font-mono text-xl font-bold text-surface-500">{totalUpvotes}</div>
                <div className="text-[10px] font-mono text-surface-500 mt-0.5">upvotes</div>
              </>
            )}
          </div>
        </div>

        {/* Total upvotes if avg grade is shown */}
        {computedAvgGrade && (
          <div className="mb-6 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-mono text-surface-500">Total upvotes received</span>
            <span className="text-sm font-mono font-semibold text-white">
              <ChevronUp className="h-3.5 w-3.5 text-emerald inline mr-0.5" />
              {totalUpvotes.toLocaleString()}
            </span>
          </div>
        )}

        {/* Side filter */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {[
            { id: 'all', label: 'All Arguments' },
            { id: 'for', label: 'FOR', color: 'text-for-400' },
            { id: 'against', label: 'AGAINST', color: 'text-against-400' },
          ].map((opt) => (
            <Link
              key={opt.id}
              href={filterHref({ side: opt.id === 'all' ? undefined : opt.id })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors',
                activeSide === opt.id || (opt.id === 'all' && activeSide === 'all')
                  ? opt.id === 'for'
                    ? 'bg-for-500/20 text-for-300 border-for-500/40'
                    : opt.id === 'against'
                      ? 'bg-against-500/20 text-against-300 border-against-500/40'
                      : 'bg-surface-300 text-white border-surface-400'
                  : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-300'
              )}
            >
              {opt.id === 'for' && <ThumbsUp className="h-3 w-3 inline mr-1" />}
              {opt.id === 'against' && <ThumbsDown className="h-3 w-3 inline mr-1" />}
              {opt.label}
            </Link>
          ))}
        </div>

        {/* Sort + Category row */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {/* Sort */}
          <div className="flex items-center gap-1.5 rounded-lg border border-surface-300 bg-surface-200 p-1">
            {[
              { id: 'upvotes', label: 'Top' },
              { id: 'new', label: 'New' },
              { id: 'grade', label: 'Grade' },
            ].map((opt) => (
              <Link
                key={opt.id}
                href={filterHref({ sort: opt.id })}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-mono transition-colors',
                  activeSort === opt.id
                    ? 'bg-surface-400 text-white'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* Category scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                href={filterHref({ category: cat })}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-mono border whitespace-nowrap transition-colors flex-shrink-0',
                  activeCategory === cat
                    ? 'bg-surface-300 text-white border-surface-400'
                    : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-300'
                )}
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs font-mono text-surface-600 mb-4">
          {args.length} argument{args.length !== 1 ? 's' : ''}
          {activeSide !== 'all' ? ` · ${activeSide === 'for' ? 'FOR' : 'AGAINST'}` : ''}
          {activeCategory !== 'All' ? ` · ${activeCategory}` : ''}
        </p>

        {/* Argument list */}
        {args.length === 0 ? (
          <EmptyState
            title="No arguments found"
            description={
              activeSide !== 'all' || activeCategory !== 'All'
                ? 'Try removing some filters to see more arguments.'
                : `${displayName} has not posted any arguments yet.`
            }
            action={
              activeSide !== 'all' || activeCategory !== 'All'
                ? { label: 'Clear filters', href: `/profile/${profile.username}/arguments` }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {args.map((arg) => {
              const topic = arg.topic
              const gradeCfg = arg.ai_grade ? GRADE_CONFIG[arg.ai_grade] : null
              const statusBadge = topic?.status ? (STATUS_BADGE[topic.status] ?? 'proposed') : 'proposed'
              const statusLabel = topic?.status ? (STATUS_LABEL[topic.status] ?? topic.status) : ''

              return (
                <Link
                  key={arg.id}
                  href={`/arguments/${arg.id}`}
                  className={cn(
                    'block rounded-xl border bg-surface-100 p-4',
                    'hover:bg-surface-200/60 hover:border-surface-400 transition-colors group',
                    arg.side === 'blue' ? 'border-for-500/20' : 'border-against-500/20'
                  )}
                >
                  {/* Top row: side + grade + upvotes */}
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Side pill */}
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                          arg.side === 'blue'
                            ? 'bg-for-500/10 text-for-400 border-for-500/30'
                            : 'bg-against-500/10 text-against-400 border-against-500/30'
                        )}
                      >
                        {arg.side === 'blue'
                          ? <ThumbsUp className="h-2.5 w-2.5" />
                          : <ThumbsDown className="h-2.5 w-2.5" />
                        }
                        {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
                      </span>

                      {/* Grade badge */}
                      {gradeCfg && arg.ai_grade && (
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                            gradeCfg.bg,
                            gradeCfg.border,
                            gradeCfg.text
                          )}
                          title={`AI Grade: ${arg.ai_grade} — ${gradeCfg.label}`}
                        >
                          {arg.ai_grade}
                        </span>
                      )}

                      {/* Source indicator */}
                      {arg.source_url && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-surface-500">
                          <Link2 className="h-2.5 w-2.5" />
                          cited
                        </span>
                      )}
                    </div>

                    {/* Upvotes + date */}
                    <div className="flex items-center gap-2 flex-shrink-0 text-[11px] font-mono text-surface-500">
                      <span className="flex items-center gap-0.5">
                        <ChevronUp className="h-3 w-3 text-emerald" />
                        {arg.upvotes}
                      </span>
                      <span>{relativeTime(arg.created_at)}</span>
                    </div>
                  </div>

                  {/* Content preview */}
                  <p className="text-sm font-mono text-surface-300 leading-relaxed mb-3 line-clamp-3">
                    {arg.content}
                  </p>

                  {/* Topic context */}
                  {topic && (
                    <div className="flex items-start gap-2">
                      <ExternalLink className="h-3 w-3 text-surface-600 flex-shrink-0 mt-0.5" />
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="text-[11px] font-mono text-surface-600 truncate">
                          {topic.statement.length > 70
                            ? topic.statement.slice(0, 70) + '…'
                            : topic.statement}
                        </span>
                        <Badge variant={statusBadge} className="text-[9px] px-1.5 py-0 flex-shrink-0">
                          {statusLabel}
                        </Badge>
                        {topic.category && (
                          <span className="text-[10px] font-mono text-surface-600 flex-shrink-0">
                            {topic.category}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}

        {/* Footer link to full argument page */}
        {args.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300 text-center">
            <p className="text-sm font-mono text-surface-600">
              Showing up to 200 arguments · Click any card to see full details
            </p>
            <Link
              href={`/profile/${profile.username}`}
              className="text-sm font-mono text-surface-500 hover:text-for-400 transition-colors mt-2 inline-block"
            >
              ← Back to {displayName}&apos;s profile
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
