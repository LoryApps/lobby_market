'use client'

/**
 * /wiki — The Civic Wiki Portal
 *
 * A Wikipedia-style gateway into the Lobby Market's collective knowledge base.
 * Every topic has an editable wiki article; this portal surfaces the best,
 * most recently edited, and most contributed-to articles — plus who's writing them.
 *
 * Distinct from:
 *   /topic/[id]         — individual topic page (wiki is one section within it)
 *   /topic/wiki/recent  — raw chronological list of all recent wiki edits
 *   /leaderboard/wiki   — ranking table of top contributors
 *   /almanac            — curated civic reference content
 *
 * This is the *entry point* — a portal that makes the wiki's breadth visible
 * and invites both readers and editors.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock,
  Edit3,
  ExternalLink,
  FileEdit,
  Gavel,
  Globe,
  Hash,
  History,
  Info,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { WikiPortalResponse, WikiFeaturedArticle, WikiRecentEdit, WikiContributor, WikiCategoryStats } from '@/app/api/wiki/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  Science:     { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Ethics:      { text: 'text-for-300',      bg: 'bg-for-300/10',      border: 'border-for-300/30' },
  Philosophy:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  Culture:     { text: 'text-against-300',  bg: 'bg-against-400/10',  border: 'border-against-400/30' },
  Health:      { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Education:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
}

function catStyle(category: string | null) {
  return category ? (CATEGORY_STYLE[category] ?? { text: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' }) : { text: 'text-surface-400', bg: 'bg-surface-200', border: 'border-surface-300' }
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500' },
  active:   { label: 'Active',   color: 'text-for-400' },
  voting:   { label: 'Voting',   color: 'text-purple' },
  law:      { label: 'LAW',      color: 'text-gold' },
  failed:   { label: 'Failed',   color: 'text-surface-600' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function roleColor(role: string): string {
  switch (role) {
    case 'elder': return 'text-gold'
    case 'troll_catcher': return 'text-emerald'
    case 'debator': return 'text-for-400'
    default: return 'text-surface-500'
  }
}

// ─── Featured Article ─────────────────────────────────────────────────────────

function FeaturedArticle({ article }: { article: WikiFeaturedArticle }) {
  const statusCfg = STATUS_CONFIG[article.status] ?? { label: article.status, color: 'text-surface-500' }
  const cs = catStyle(article.category)
  const forPct = Math.round(article.blue_pct)
  const againstPct = 100 - forPct

  // Truncate description to ~400 chars for the preview
  const preview = article.description.length > 400
    ? article.description.slice(0, 400).trimEnd() + '…'
    : article.description

  // Strip markdown for plain preview
  const plainPreview = preview
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[\[(.+?)\]\]/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/^[-*]\s/gm, '')
    .trim()

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl bg-surface-100 border border-for-500/20 overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-surface-300/60 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-gold flex-shrink-0" aria-hidden="true" />
        <span className="text-xs font-mono font-semibold text-gold uppercase tracking-widest">
          Featured Article
        </span>
      </div>

      <div className="p-5">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide', statusCfg.color)}>
            {statusCfg.label}
          </span>
          {article.category && (
            <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded-full border', cs.text, cs.bg, cs.border)}>
              {article.category}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-600">
            {article.view_count.toLocaleString()} views · {article.total_votes.toLocaleString()} votes
          </span>
        </div>

        {/* Title */}
        <h2 className="font-mono text-base sm:text-lg font-bold text-white leading-snug mb-3">
          {article.statement}
        </h2>

        {/* Wiki preview */}
        <p className="text-sm font-mono text-surface-400 leading-relaxed mb-4 line-clamp-4">
          {plainPreview}
        </p>

        {/* Vote bar */}
        <div className="mb-4">
          <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
              style={{ width: `${forPct}%` }}
              aria-label={`${forPct}% FOR`}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-for-400">{forPct}% FOR</span>
            <span className="text-[10px] font-mono text-against-400">{againstPct}% AGAINST</span>
          </div>
        </div>

        {/* Editor attribution + CTA */}
        <div className="flex items-center justify-between gap-3">
          {article.editor ? (
            <div className="flex items-center gap-2 text-xs font-mono text-surface-500 min-w-0">
              <Avatar
                fallback={article.editor.username}
                src={article.editor.avatar_url}
                size="xs"
                aria-hidden="true"
              />
              <span className="truncate">
                by{' '}
                <Link
                  href={`/profile/${article.editor.username}`}
                  className={cn('hover:underline', roleColor(article.editor.role))}
                >
                  @{article.editor.username}
                </Link>
                {' · '}{timeAgo(article.description_updated_at)}
              </span>
            </div>
          ) : (
            <span className="text-xs font-mono text-surface-600">
              Edited {timeAgo(article.description_updated_at)}
            </span>
          )}
          <Link
            href={`/topic/${article.id}`}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-colors"
          >
            Read article
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Recent Edit Row ──────────────────────────────────────────────────────────

function RecentEditRow({ edit, index }: { edit: WikiRecentEdit; index: number }) {
  const statusCfg = STATUS_CONFIG[edit.status] ?? { label: edit.status, color: 'text-surface-500' }
  const cs = catStyle(edit.category)

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <Link
        href={`/topic/${edit.id}`}
        className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200/50 transition-colors group"
        aria-label={`${edit.statement} — edited ${timeAgo(edit.description_updated_at)}`}
      >
        {/* Edit icon */}
        <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 group-hover:border-surface-400 flex items-center justify-center mt-0.5 transition-colors">
          <FileEdit className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors" aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={cn('text-[10px] font-mono uppercase tracking-wide', statusCfg.color)}>
              {statusCfg.label}
            </span>
            {edit.category && (
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full border', cs.text, cs.bg, cs.border)}>
                {edit.category}
              </span>
            )}
          </div>

          {/* Statement */}
          <p className="text-sm font-mono text-white leading-snug mb-1 line-clamp-1 group-hover:text-white/90">
            {edit.statement}
          </p>

          {/* Preview */}
          <p className="text-[11px] font-mono text-surface-600 line-clamp-1">
            {edit.description_preview || 'No preview available'}
          </p>
        </div>

        {/* Meta */}
        <div className="flex-shrink-0 text-right">
          {edit.editor ? (
            <div className="flex items-center gap-1.5 justify-end mb-1">
              <Avatar
                fallback={edit.editor.username}
                src={edit.editor.avatar_url}
                size="xs"
                aria-hidden="true"
              />
              <span className={cn('text-[10px] font-mono', roleColor(edit.editor.role))}>
                @{edit.editor.username}
              </span>
            </div>
          ) : null}
          <p className="text-[10px] font-mono text-surface-600 flex items-center gap-1 justify-end">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {timeAgo(edit.description_updated_at)}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Contributor Card ─────────────────────────────────────────────────────────

function ContributorCard({ contributor, rank }: { contributor: WikiContributor; rank: number }) {
  const rankColors = ['text-gold', 'text-surface-400', 'text-against-500']
  const rankColor = rankColors[rank] ?? 'text-surface-600'

  return (
    <Link
      href={`/profile/${contributor.username}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200/50 transition-colors group"
      aria-label={`@${contributor.username} — ${contributor.edit_count} edits`}
    >
      {/* Rank */}
      <span className={cn('text-sm font-mono font-bold w-5 text-center flex-shrink-0', rankColor)}>
        #{rank + 1}
      </span>

      <Avatar
        fallback={contributor.username}
        src={contributor.avatar_url}
        size="sm"
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono font-semibold text-white truncate group-hover:text-white/90">
          {contributor.display_name ?? `@${contributor.username}`}
        </p>
        <p className={cn('text-[11px] font-mono', roleColor(contributor.role))}>
          @{contributor.username}
        </p>
      </div>

      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-mono font-bold text-emerald">
          {contributor.edit_count}
        </p>
        <p className="text-[10px] font-mono text-surface-600">edits</p>
      </div>
    </Link>
  )
}

// ─── Category Bar ─────────────────────────────────────────────────────────────

function CategoryBar({ stat, maxCount }: { stat: WikiCategoryStats; maxCount: number }) {
  const cs = catStyle(stat.category)
  const widthPct = maxCount > 0 ? Math.round((stat.article_count / maxCount) * 100) : 0

  return (
    <Link
      href={`/categories/${encodeURIComponent(stat.category)}`}
      className="group hover:opacity-90 transition-opacity"
      aria-label={`${stat.category}: ${stat.article_count} articles, ${stat.pct_covered}% coverage`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={cn('text-xs font-mono font-semibold', cs.text)}>{stat.category}</span>
        <span className="text-[11px] font-mono text-surface-500">
          {stat.article_count} article{stat.article_count !== 1 ? 's' : ''} · {stat.pct_covered}% covered
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface-300 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', cs.bg.replace('/10', '/60'))}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Featured skeleton */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2 w-full rounded-full mt-4" />
      </div>

      {/* Recent skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WikiPortalPage() {
  const [data, setData] = useState<WikiPortalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/wiki', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch')
      const json: WikiPortalResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const maxCategoryCount = Math.max(...(data?.category_stats ?? []).map((c) => c.article_count), 1)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mt-0.5">
              <BookOpen className="h-5 w-5 text-for-400" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-mono font-bold text-white">Civic Wiki</h1>
                <button
                  onClick={() => setShowInfo((v) => !v)}
                  aria-label="About the Civic Wiki"
                  className="text-surface-600 hover:text-surface-400 transition-colors"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <p className="text-sm font-mono text-surface-500">
                The community-edited knowledge base for every civic debate.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                disabled={loading}
                aria-label="Refresh wiki data"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Info panel */}
          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 mb-3 text-xs font-mono text-surface-500 leading-relaxed space-y-2">
                  <p>
                    Every debate topic on Lobby Market has a wiki article — a community-edited description
                    that provides context, background, and analysis. Like Wikipedia, anyone can contribute.
                  </p>
                  <p>
                    Use <code className="bg-surface-200 px-1 py-0.5 rounded text-surface-300">[[topic name]]</code> syntax inside any topic&apos;s wiki
                    editor to create wiki links between related debates. The{' '}
                    <Link href="/topic/graph" className="text-for-400 hover:underline">Topic Network</Link> visualises these connections.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <Link href="/topic/wiki/recent" className="flex items-center gap-1 text-for-400 hover:underline">
                      <History className="h-3 w-3" aria-hidden="true" /> Recent changes
                    </Link>
                    <Link href="/leaderboard/wiki" className="flex items-center gap-1 text-for-400 hover:underline">
                      <Users className="h-3 w-3" aria-hidden="true" /> Top editors
                    </Link>
                    <Link href="/topic/graph" className="flex items-center gap-1 text-for-400 hover:underline">
                      <Globe className="h-3 w-3" aria-hidden="true" /> Knowledge graph
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats strip */}
          {!loading && data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-3 gap-3 mb-5"
              role="list"
              aria-label="Wiki statistics"
            >
              {[
                { label: 'Articles', value: data.total_articles.toLocaleString(), icon: BookOpen, color: 'text-for-400' },
                { label: 'Coverage', value: `${data.coverage_pct}%`, icon: Globe, color: 'text-emerald' },
                { label: 'Topics', value: data.total_topics.toLocaleString(), icon: Hash, color: 'text-purple' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-2.5 text-center" role="listitem">
                  <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} aria-hidden="true" />
                  <div className="text-base font-mono font-bold text-white">{value}</div>
                  <div className="text-[10px] font-mono text-surface-600 uppercase tracking-wide">{label}</div>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* ── Loading / Error states ── */}
        {loading && <PageSkeleton />}

        {error && !loading && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-against-500/10 border border-against-500/30 flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-against-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-white font-mono text-sm font-semibold mb-1">Couldn&apos;t load the wiki portal</p>
              <p className="text-surface-500 font-mono text-xs">Something went wrong. Try again in a moment.</p>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-8">

            {/* ── Featured Article ── */}
            {data.featured ? (
              <section aria-labelledby="featured-heading">
                <div className="flex items-center justify-between mb-3">
                  <h2 id="featured-heading" className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                    Featured Article
                  </h2>
                  <Link
                    href="/topic/wiki/recent"
                    className="text-[11px] font-mono text-surface-500 hover:text-for-400 flex items-center gap-1 transition-colors"
                  >
                    Browse all
                    <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
                <FeaturedArticle article={data.featured} />
              </section>
            ) : (
              <section>
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
                  <BookOpen className="h-10 w-10 text-surface-600 mx-auto mb-3" aria-hidden="true" />
                  <p className="text-sm font-mono text-surface-400 font-semibold mb-1">No wiki articles yet</p>
                  <p className="text-xs font-mono text-surface-600 mb-4">
                    Be the first to write a wiki article for a debate topic.
                  </p>
                  <Link
                    href="/topics"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-500 transition-colors"
                  >
                    Browse topics
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </section>
            )}

            {/* ── Recent Changes ── */}
            {data.recent_edits.length > 0 && (
              <section aria-labelledby="recent-heading">
                <div className="flex items-center justify-between mb-3">
                  <h2 id="recent-heading" className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest flex items-center gap-2">
                    <History className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
                    Recent Changes
                  </h2>
                  <Link
                    href="/topic/wiki/recent"
                    className="text-[11px] font-mono text-surface-500 hover:text-for-400 flex items-center gap-1 transition-colors"
                  >
                    View all
                    <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
                <div className="space-y-2" role="list" aria-label="Recent wiki edits">
                  {data.recent_edits.map((edit, i) => (
                    <div key={edit.id} role="listitem">
                      <RecentEditRow edit={edit} index={i} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Two-column: Contributors + Categories ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              {/* Top Contributors */}
              {data.top_contributors.length > 0 && (
                <section aria-labelledby="contributors-heading">
                  <div className="flex items-center justify-between mb-3">
                    <h2 id="contributors-heading" className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-emerald" aria-hidden="true" />
                      Top Editors
                    </h2>
                    <Link
                      href="/leaderboard/wiki"
                      className="text-[11px] font-mono text-surface-500 hover:text-emerald flex items-center gap-1 transition-colors"
                    >
                      Full board
                      <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="space-y-2" role="list" aria-label="Top wiki contributors">
                    {data.top_contributors.map((c, i) => (
                      <div key={c.id} role="listitem">
                        <ContributorCard contributor={c} rank={i} />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Category Coverage */}
              {data.category_stats.length > 0 && (
                <section aria-labelledby="categories-heading">
                  <div className="flex items-center justify-between mb-3">
                    <h2 id="categories-heading" className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-purple" aria-hidden="true" />
                      Categories
                    </h2>
                    <Link
                      href="/categories"
                      className="text-[11px] font-mono text-surface-500 hover:text-purple flex items-center gap-1 transition-colors"
                    >
                      Browse
                      <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3" role="list" aria-label="Wiki coverage by category">
                    {data.category_stats.map((stat) => (
                      <div key={stat.category} role="listitem">
                        <CategoryBar stat={stat} maxCount={maxCategoryCount} />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* ── Quick Links ── */}
            <section aria-labelledby="quicklinks-heading">
              <h2 id="quicklinks-heading" className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
                Explore
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { href: '/topic/wiki/recent', label: 'Recent Edits',     sublabel: 'Latest wiki changes',           icon: History,     color: 'text-for-400' },
                  { href: '/leaderboard/wiki',  label: 'Wiki Leaderboard', sublabel: 'Most prolific editors',         icon: TrendingUp,  color: 'text-gold' },
                  { href: '/topic/graph',       label: 'Topic Network',    sublabel: 'Knowledge graph visualization', icon: Globe,       color: 'text-purple' },
                  { href: '/sources',           label: 'Source Library',   sublabel: 'Most cited external sources',   icon: BookOpen,    color: 'text-emerald' },
                  { href: '/law',               label: 'Established Laws', sublabel: 'Debates that became law',       icon: Gavel,       color: 'text-gold' },
                  { href: '/topic/create',      label: 'Propose a Topic',  sublabel: 'Start a new civic debate',      icon: Edit3,       color: 'text-for-400' },
                ].map(({ href, label, sublabel, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex flex-col gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200/50 transition-colors group"
                  >
                    <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
                    <div>
                      <p className="text-xs font-mono font-semibold text-white group-hover:text-white/90">{label}</p>
                      <p className="text-[11px] font-mono text-surface-600 leading-snug">{sublabel}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* ── Search CTA ── */}
            <Link
              href="/search?tab=topics"
              className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-surface-100 border border-surface-300 hover:border-for-500/40 hover:bg-surface-200/50 transition-colors group"
              aria-label="Search all wiki articles"
            >
              <div className="h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 group-hover:border-for-500/30 flex items-center justify-center flex-shrink-0 transition-colors">
                <Search className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-mono font-semibold text-white">Search all articles</p>
                <p className="text-xs font-mono text-surface-500">Find any debate topic in the Civic Wiki</p>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-for-400 ml-auto flex-shrink-0 transition-colors" aria-hidden="true" />
            </Link>

          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
