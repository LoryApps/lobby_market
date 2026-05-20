import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Gavel,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
  FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { CIVIC_SERIES, getSeriesBySlug } from '@/lib/config/series'
import { cn } from '@/lib/utils/cn'
import type { SeriesTopicEntry } from '@/app/api/series/[slug]/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: { slug: string }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const series = getSeriesBySlug(params.slug)
  if (!series) return { title: 'Series · Lobby Market' }

  return {
    title: `${series.title} · Civic Series · Lobby Market`,
    description: series.description,
    openGraph: {
      title: `${series.title} · Civic Series · Lobby Market`,
      description: series.subtitle,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `${series.title} · Civic Series`,
      description: series.subtitle,
    },
  }
}

// ─── generateStaticParams ─────────────────────────────────────────────────────

export function generateStaticParams() {
  return CIVIC_SERIES.map((s) => ({ slug: s.slug }))
}

// ─── Accent configs (mirrors series page) ────────────────────────────────────

const ACCENT_CONFIG = {
  blue: {
    border: 'border-for-500/30',
    bg: 'bg-for-500/5',
    text: 'text-for-400',
    badge: 'bg-for-500/15 text-for-400 border-for-500/30',
    bar: 'bg-for-500',
    numberBg: 'bg-for-500/10 border-for-500/30 text-for-400',
  },
  red: {
    border: 'border-against-500/30',
    bg: 'bg-against-500/5',
    text: 'text-against-400',
    badge: 'bg-against-500/15 text-against-400 border-against-500/30',
    bar: 'bg-against-500',
    numberBg: 'bg-against-500/10 border-against-500/30 text-against-400',
  },
  gold: {
    border: 'border-gold/30',
    bg: 'bg-gold/5',
    text: 'text-gold',
    badge: 'bg-gold/15 text-gold border-gold/30',
    bar: 'bg-gold',
    numberBg: 'bg-gold/10 border-gold/30 text-gold',
  },
  emerald: {
    border: 'border-emerald/30',
    bg: 'bg-emerald/5',
    text: 'text-emerald',
    badge: 'bg-emerald/15 text-emerald border-emerald/30',
    bar: 'bg-emerald',
    numberBg: 'bg-emerald/10 border-emerald/30 text-emerald',
  },
  purple: {
    border: 'border-purple/30',
    bg: 'bg-purple/5',
    text: 'text-purple',
    badge: 'bg-purple/15 text-purple border-purple/30',
    bar: 'bg-purple',
    numberBg: 'bg-purple/10 border-purple/30 text-purple',
  },
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Law',
  failed: 'Failed',
}

type BadgeVariant = 'proposed' | 'active' | 'law' | 'failed'

const STATUS_BADGE_VARIANT: Record<string, BadgeVariant> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  index,
  accentCfg,
}: {
  topic: SeriesTopicEntry
  index: number
  accentCfg: typeof ACCENT_CONFIG['blue']
}) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const isLaw = topic.status === 'law'

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group flex gap-4 rounded-2xl border p-5 transition-all duration-200',
        'border-surface-300 bg-surface-100',
        'hover:border-surface-400 hover:bg-surface-200/50'
      )}
    >
      {/* Step number */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border text-sm font-mono font-bold',
          accentCfg.numberBg
        )}
        aria-label={`Topic ${index + 1}`}
      >
        {index + 1}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Category + status row */}
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {topic.category && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">
              {topic.category}
            </span>
          )}
          <Badge variant={STATUS_BADGE_VARIANT[topic.status] ?? 'proposed'}>
            {isLaw ? (
              <span className="flex items-center gap-1">
                <Gavel className="h-2.5 w-2.5" />
                {STATUS_LABEL[topic.status]}
              </span>
            ) : (
              STATUS_LABEL[topic.status] ?? topic.status
            )}
          </Badge>
        </div>

        {/* Statement */}
        <p className="text-sm font-medium text-white leading-snug mb-3 group-hover:text-surface-600 transition-colors">
          {topic.statement}
        </p>

        {/* Vote bar */}
        {topic.total_votes > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
              <span className="flex items-center gap-1 text-for-400">
                <ThumbsUp className="h-2.5 w-2.5" />
                {forPct}%
              </span>
              <span className="text-surface-600 flex items-center gap-1">
                <Users className="h-2.5 w-2.5" />
                {topic.total_votes.toLocaleString()} votes
              </span>
              <span className="flex items-center gap-1 text-against-400">
                {againstPct}%
                <ThumbsDown className="h-2.5 w-2.5" />
              </span>
            </div>
            <div className="relative h-1.5 rounded-full overflow-hidden bg-against-900/40">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                style={{ width: `${forPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer: author + action */}
        <div className="flex items-center justify-between">
          {topic.author ? (
            <div className="flex items-center gap-1.5">
              <Avatar
                src={topic.author.avatar_url}
                fallback={topic.author.display_name ?? topic.author.username}
                size="xs"
              />
              <span className="text-[11px] font-mono text-surface-500 truncate max-w-[120px]">
                {topic.author.display_name ?? topic.author.username}
              </span>
            </div>
          ) : (
            <span />
          )}

          <span className={cn('flex items-center gap-1 text-[11px] font-mono transition-colors', accentCfg.text)}>
            {topic.total_votes === 0 ? 'Be first to vote' : 'Read & vote'}
            <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SeriesDetailPage({ params }: PageProps) {
  const series = getSeriesBySlug(params.slug)
  if (!series) notFound()

  const cfg = ACCENT_CONFIG[series.accent]

  // Fetch topics for this series
  const supabase = await createClient()

  let topicsQuery = supabase
    .from('topics')
    .select(
      `id, statement, category, status, blue_pct, total_votes, created_at,
       author:profiles!topics_author_id_fkey(username, display_name, avatar_url)`
    )

  const statuses = series.statuses ?? ['proposed', 'active', 'voting', 'law', 'failed']
  topicsQuery = topicsQuery.in('status', statuses)

  if (series.categories.length > 0) {
    topicsQuery = topicsQuery.in('category', series.categories)
  }

  if (series.minVotes) {
    topicsQuery = topicsQuery.gte('total_votes', series.minVotes)
  }

  if (params.slug === 'most-contested') {
    topicsQuery = topicsQuery.order('total_votes', { ascending: false }).limit(50)
  } else {
    topicsQuery = topicsQuery.order('total_votes', { ascending: false }).limit(series.limit * 3)
  }

  const { data } = await topicsQuery

  let topics = (data ?? []) as unknown as SeriesTopicEntry[]

  // Apply keyword filter
  if (series.keywords && series.keywords.length > 0) {
    const kw = series.keywords.map((k) => k.toLowerCase())
    const filtered = topics.filter((t) => {
      const stmt = t.statement.toLowerCase()
      return kw.some((k) => stmt.includes(k))
    })
    if (filtered.length >= 3) topics = filtered
  }

  // Sort "most contested"
  if (params.slug === 'most-contested') {
    topics = topics
      .slice()
      .sort((a, b) => Math.abs((a.blue_pct ?? 50) - 50) - Math.abs((b.blue_pct ?? 50) - 50))
  }

  topics = topics.slice(0, series.limit)

  const lawCount = topics.filter((t) => t.status === 'law').length
  const activeCount = topics.filter((t) => t.status === 'active').length
  const totalVotes = topics.reduce((sum, t) => sum + (t.total_votes ?? 0), 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back ── */}
        <Link
          href="/series"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All series
        </Link>

        {/* ── Hero card ── */}
        <div className={cn('rounded-3xl border p-6 mb-6', cfg.border, cfg.bg)}>
          <div className="flex items-start gap-4">
            <div className={cn('flex items-center justify-center h-12 w-12 rounded-2xl border flex-shrink-0 bg-surface-100', cfg.border)}>
              <BookOpen className={cn('h-6 w-6', cfg.text)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn('text-[10px] font-mono font-bold uppercase tracking-widest mb-1', cfg.text)}>
                Civic Series · {topics.length} topics
              </div>
              <h1 className="font-mono text-2xl font-bold text-white leading-tight mb-1">
                {series.title}
              </h1>
              <p className={cn('text-sm font-mono mb-3', cfg.text)}>
                {series.subtitle}
              </p>
              <p className="text-sm font-mono text-surface-400 leading-relaxed">
                {series.description}
              </p>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-surface-300/40">
            <div className="text-center">
              <div className="text-lg font-mono font-bold text-white">{topics.length}</div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Topics</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-mono font-bold text-white">{totalVotes.toLocaleString()}</div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Total votes</div>
            </div>
            <div className="text-center">
              <div className={cn('text-lg font-mono font-bold', lawCount > 0 ? 'text-gold' : 'text-white')}>
                {lawCount > 0 ? `${lawCount} law${lawCount > 1 ? 's' : ''}` : `${activeCount} active`}
              </div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                {lawCount > 0 ? 'Established' : 'Ongoing'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Topics list ── */}
        {topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-surface-300 bg-surface-100">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-surface-200 border border-surface-300 mb-4">
              <FileText className="h-6 w-6 text-surface-500" />
            </div>
            <p className="text-surface-500 text-sm font-mono mb-1">No topics yet in this series.</p>
            <p className="text-surface-600 text-xs font-mono">Topics are added as the community debates them.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-surface-300" />
              <span className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-widest">
                {topics.length} debate{topics.length !== 1 ? 's' : ''}
              </span>
              <div className="h-px flex-1 bg-surface-300" />
            </div>

            <div className="space-y-3">
              {topics.map((topic, i) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  index={i}
                  accentCfg={cfg}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Next steps ── */}
        <div className="mt-10 rounded-2xl border border-surface-300 bg-surface-100 px-5 py-5">
          <p className="text-xs font-mono font-semibold text-white mb-3">Explore more</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/series"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <BookOpen className="h-3 w-3" />
              All series
            </Link>
            {series.categories.length > 0 && (
              <Link
                href={`/categories/${series.categories[0].toLowerCase()}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Scale className="h-3 w-3" />
                {series.categories[0]} category
              </Link>
            )}
            <Link
              href="/laws"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <Gavel className="h-3 w-3" />
              Law Codex
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
