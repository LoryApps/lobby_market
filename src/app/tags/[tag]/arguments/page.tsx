import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  Star,
  Tag,
  ThumbsUp,
  ThumbsDown,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { tag: string }
  searchParams?: { sort?: string; side?: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const tag = decodeURIComponent(params.tag)
  return {
    title: `Arguments about #${tag} · Lobby Market`,
    description: `Browse community FOR and AGAINST arguments on debates tagged "${tag}" on Lobby Market.`,
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

const STATUS_PILL: Record<string, string> = {
  proposed: 'text-surface-500 border-surface-500/40 bg-surface-500/10',
  active:   'text-for-400 border-for-500/40 bg-for-500/10',
  voting:   'text-purple border-purple/40 bg-purple/10',
  law:      'text-gold border-gold/40 bg-gold/10',
  failed:   'text-against-400 border-against-500/40 bg-against-500/10',
}

const GRADE_STYLE: Record<string, string> = {
  A: 'text-emerald border-emerald/40 bg-emerald/10',
  B: 'text-for-400 border-for-500/40 bg-for-500/10',
  C: 'text-gold border-gold/40 bg-gold/10',
  D: 'text-against-400 border-against-500/40 bg-against-500/10',
  F: 'text-against-400 border-against-500/60 bg-against-500/20',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TagArgumentsPage({ params, searchParams }: PageProps) {
  const tag  = decodeURIComponent(params.tag).toLowerCase()
  const sort = searchParams?.sort ?? 'top'
  const side = searchParams?.side ?? 'all'

  const supabase = await createClient()

  // Verify the tag exists
  const { count: topicCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .contains('tags', [tag])

  if (!topicCount) notFound()

  // Fetch topic IDs + basic topic info for this tag
  const { data: taggedTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .contains('tags', [tag])
    .limit(500)

  const taggedTopicsList = taggedTopics ?? []
  const topicIds = taggedTopicsList.map((t) => t.id)
  const topicMap = new Map(taggedTopicsList.map((t) => [t.id, t]))

  // Fetch arguments for these topics
  let argsQuery = supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id, side, content, upvotes, ai_score, ai_grade, created_at')
    .in('topic_id', topicIds)

  if (side === 'blue' || side === 'red') {
    argsQuery = argsQuery.eq('side', side)
  }

  if (sort === 'new') {
    argsQuery = argsQuery.order('created_at', { ascending: false })
  } else {
    argsQuery = argsQuery.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
  }

  const { data: rawArgs } = await argsQuery.limit(50)
  const args = rawArgs ?? []

  // Fetch authors
  const authorIds = [...new Set(args.map((a) => a.user_id))]
  const { data: profiles } = authorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .in('id', authorIds)
    : { data: [] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  const enriched = args.map((a) => ({
    ...a,
    author: profileMap.get(a.user_id) ?? null,
    topic:  topicMap.get(a.topic_id)  ?? null,
  }))

  // Count totals for filter tabs
  const [totalAll, totalFor, totalAgainst] = await Promise.all([
    topicIds.length
      ? supabase.from('topic_arguments').select('id', { count: 'exact', head: true }).in('topic_id', topicIds).then(r => r.count ?? 0)
      : Promise.resolve(0),
    topicIds.length
      ? supabase.from('topic_arguments').select('id', { count: 'exact', head: true }).in('topic_id', topicIds).eq('side', 'blue').then(r => r.count ?? 0)
      : Promise.resolve(0),
    topicIds.length
      ? supabase.from('topic_arguments').select('id', { count: 'exact', head: true }).in('topic_id', topicIds).eq('side', 'red').then(r => r.count ?? 0)
      : Promise.resolve(0),
  ])

  function href(s: string = sort, f: string = side) {
    const p = new URLSearchParams()
    if (s !== 'top') p.set('sort', s)
    if (f !== 'all') p.set('side', f)
    const qs = p.toString()
    return `/tags/${encodeURIComponent(tag)}/arguments${qs ? `?${qs}` : ''}`
  }

  const sideOpts = [
    { id: 'all',  label: 'All',     count: totalAll,     icon: MessageSquare },
    { id: 'blue', label: 'For',     count: totalFor,     icon: ThumbsUp      },
    { id: 'red',  label: 'Against', count: totalAgainst, icon: ThumbsDown    },
  ]

  const sortOpts = [
    { id: 'top', label: 'Top', icon: Star  },
    { id: 'new', label: 'New', icon: Clock },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Breadcrumb ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6 text-xs font-mono text-surface-500">
          <Link href="/tags" className="hover:text-surface-300 transition-colors">
            Tags
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={`/tags/${encodeURIComponent(tag)}`} className="hover:text-surface-300 transition-colors">
            #{tag}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-surface-300">Arguments</span>
        </div>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <MessageSquare className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                #{tag} Arguments
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {totalAll} argument{totalAll !== 1 ? 's' : ''} across {taggedTopicsList.length} debate{taggedTopicsList.length !== 1 ? 's' : ''}
                {totalFor > 0 && (
                  <span className="text-for-400 ml-2">· {totalFor} for</span>
                )}
                {totalAgainst > 0 && (
                  <span className="text-against-400 ml-2">· {totalAgainst} against</span>
                )}
              </p>
            </div>
          </div>

          <Link
            href={`/tags/${encodeURIComponent(tag)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all flex-shrink-0"
          >
            <Tag className="h-3.5 w-3.5" />
            Debates
          </Link>
        </div>

        {/* ── Filter + sort ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
          <div className="flex items-center gap-1">
            {sideOpts.map((f) => (
              <Link
                key={f.id}
                href={href(sort, f.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs border transition-all',
                  side === f.id
                    ? f.id === 'blue'
                      ? 'bg-for-500/20 text-for-400 border-for-500/40'
                      : f.id === 'red'
                        ? 'bg-against-500/20 text-against-400 border-against-500/40'
                        : 'bg-surface-300/40 text-white border-surface-400'
                    : 'bg-surface-200/50 text-surface-500 border-surface-300 hover:text-surface-300',
                )}
              >
                <f.icon className="h-3 w-3" />
                {f.label}
                {f.count > 0 && (
                  <span className={cn('opacity-60', side === f.id ? 'opacity-80' : '')}>
                    {f.count}
                  </span>
                )}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {sortOpts.map((s) => (
              <Link
                key={s.id}
                href={href(s.id, side)}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-mono text-xs border transition-all',
                  sort === s.id
                    ? 'bg-surface-300/40 text-white border-surface-400'
                    : 'bg-surface-200/50 text-surface-500 border-surface-300 hover:text-surface-300',
                )}
              >
                <s.icon className="h-3 w-3" />
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {/* ── Arguments list ────────────────────────────────────────────── */}
        {enriched.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={
              side === 'blue'
                ? `No FOR arguments tagged "${tag}"`
                : side === 'red'
                  ? `No AGAINST arguments tagged "${tag}"`
                  : `No arguments tagged "${tag}" yet`
            }
            description="Arguments are posted on individual debate pages and surface here automatically."
            actions={[
              { label: `Browse #${tag} debates`, href: `/tags/${encodeURIComponent(tag)}` },
              { label: 'All arguments',           href: '/arguments' },
            ]}
          />
        ) : (
          <div className="space-y-3">
            {enriched.map((arg) => {
              const topic  = arg.topic
              const author = arg.author
              const isFor  = arg.side === 'blue'

              return (
                <Link
                  key={arg.id}
                  href={`/arguments/${arg.id}`}
                  className="group block bg-surface-100/50 hover:bg-surface-100 border border-surface-200 hover:border-surface-300 rounded-xl p-4 transition-all"
                >
                  {/* Side badge + grade + time */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
                        isFor
                          ? 'bg-for-500/10 text-for-400 border-for-500/30'
                          : 'bg-against-500/10 text-against-400 border-against-500/30',
                      )}>
                        {isFor
                          ? <ThumbsUp className="h-2.5 w-2.5" />
                          : <ThumbsDown className="h-2.5 w-2.5" />
                        }
                        {isFor ? 'For' : 'Against'}
                      </span>

                      {arg.ai_grade && (
                        <span className={cn(
                          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono border',
                          GRADE_STYLE[arg.ai_grade] ?? 'bg-surface-200 text-surface-500 border-surface-300',
                        )}>
                          <Zap className="h-2 w-2" />
                          {arg.ai_grade}
                        </span>
                      )}

                      {topic?.status && (
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border',
                          STATUS_PILL[topic.status] ?? 'bg-surface-200 text-surface-500 border-surface-300',
                        )}>
                          {topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-surface-600">
                      {relativeTime(arg.created_at)}
                    </span>
                  </div>

                  {/* Content */}
                  <p className="font-mono text-sm text-white leading-relaxed mb-2 line-clamp-3 group-hover:text-surface-100 transition-colors">
                    {arg.content}
                  </p>

                  {/* Topic reference */}
                  {topic && (
                    <p className="text-[11px] font-mono text-surface-500 mb-3 line-clamp-1">
                      re: {topic.statement}
                    </p>
                  )}

                  {/* Footer: author + upvotes */}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    {author ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          src={author.avatar_url}
                          username={author.username}
                          size={20}
                          className="flex-shrink-0"
                        />
                        <span className="font-mono text-xs text-surface-400 truncate">
                          {author.display_name ?? author.username}
                        </span>
                        {author.clout > 0 && (
                          <span className="font-mono text-[10px] text-gold/70 flex-shrink-0">
                            {author.clout.toLocaleString()} clout
                          </span>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-600 flex-shrink-0">
                      <ThumbsUp className="h-3 w-3" />
                      <span>{arg.upvotes}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* ── Bottom links ──────────────────────────────────────────────── */}
        {enriched.length > 0 && (
          <div className="mt-6 pt-5 border-t border-surface-200 flex items-center justify-between text-xs font-mono text-surface-500">
            <Link
              href={`/tags/${encodeURIComponent(tag)}`}
              className="flex items-center gap-1.5 hover:text-surface-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to #{tag} debates
            </Link>
            <Link
              href="/arguments"
              className="flex items-center gap-1.5 hover:text-surface-300 transition-colors"
            >
              All arguments
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
