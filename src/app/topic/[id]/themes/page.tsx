'use client'

/**
 * /topic/[id]/themes — Debate Themes
 *
 * Clusters all arguments on a topic into civic themes (Individual Freedom,
 * Economic Impact, Evidence & Data, etc.) and shows the FOR/AGAINST split
 * within each theme. Answers: "How is this debate being argued?"
 *
 * Distinct from:
 *   /topic/[id]/arguments    — raw argument list
 *   /arguments/common-threads — platform-wide theme browser
 *   /topic/[id]/argument-graph — network graph of replies
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gavel,
  Layers,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ThemesResponse, DebateTheme, ThemeArgument } from '@/app/api/topics/[id]/themes/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Law',
  failed: 'Failed',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'active' || status === 'voting') return <Zap className="h-3 w-3" />
  if (status === 'law') return <Gavel className="h-3 w-3" />
  return <Scale className="h-3 w-3" />
}

// ─── Mini argument card ────────────────────────────────────────────────────────

function MiniArgCard({ arg }: { arg: ThemeArgument }) {
  const isFor = arg.side === 'blue'
  return (
    <Link
      href={`/arguments/${arg.id}`}
      className={cn(
        'block rounded-xl border p-3 transition-colors group',
        isFor
          ? 'border-for-500/20 bg-for-500/5 hover:border-for-500/40 hover:bg-for-500/10'
          : 'border-against-500/20 bg-against-500/5 hover:border-against-500/40 hover:bg-against-500/10'
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            'flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center',
            isFor ? 'bg-for-500/20' : 'bg-against-500/20'
          )}
        >
          {isFor
            ? <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
            : <ThumbsDown className="h-2.5 w-2.5 text-against-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-surface-600 leading-relaxed line-clamp-3 group-hover:text-surface-500 transition-colors">
            {arg.content}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={cn(
              'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded',
              isFor ? 'text-for-400 bg-for-500/10' : 'text-against-400 bg-against-500/10'
            )}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            {arg.ai_grade && (
              <span className="text-[10px] font-mono text-gold bg-gold/10 px-1.5 py-0.5 rounded">
                Grade {arg.ai_grade}
              </span>
            )}
            {arg.upvotes > 0 && (
              <span className="text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
                <ThumbsUp className="h-2.5 w-2.5" />
                {arg.upvotes}
              </span>
            )}
            <ExternalLink className="h-2.5 w-2.5 text-surface-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Theme card ────────────────────────────────────────────────────────────────

function ThemeCard({
  theme,
  rank,
  isExpanded,
  onToggle,
}: {
  theme: DebateTheme
  rank: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const forPct = theme.for_pct
  const againstPct = 100 - forPct

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.05 }}
      className={cn('rounded-2xl border overflow-hidden', theme.border)}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className={cn(
          'w-full text-left px-4 py-4 flex items-start gap-3 transition-colors',
          theme.bg,
          'hover:brightness-110'
        )}
      >
        {/* Rank badge */}
        <div className="flex-shrink-0 h-7 w-7 rounded-full bg-surface-200 border border-surface-300 flex items-center justify-center mt-0.5">
          <span className="text-[10px] font-mono font-bold text-surface-500">
            {rank + 1}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <h3 className={cn('text-sm font-mono font-bold', theme.textColor)}>
              {theme.label}
            </h3>
            <span className="text-[10px] font-mono text-surface-500">
              {theme.total} argument{theme.total !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-surface-500 font-mono mb-3 leading-relaxed">
            {theme.description}
          </p>

          {/* FOR / AGAINST split bar */}
          <div className="space-y-1.5">
            <div className="flex h-2 rounded-full overflow-hidden bg-surface-300">
              <div
                className="bg-for-500 transition-all duration-700"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="bg-against-500 flex-1 transition-all duration-700"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-for-400">
                <ThumbsUp className="inline h-2.5 w-2.5 mr-0.5" />
                {forPct}% FOR ({theme.for_count})
              </span>
              <span className="text-against-400">
                {againstPct}% AGAINST ({theme.against_count})
                <ThumbsDown className="inline h-2.5 w-2.5 ml-0.5" />
              </span>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 text-surface-500 mt-1">
          {isExpanded
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />
          }
        </div>
      </button>

      {/* Expanded argument list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 bg-surface-100 space-y-2.5 border-t border-surface-300">
              {/* Top FOR argument */}
              {theme.top_for && (
                <div>
                  <div className="text-[10px] font-mono text-for-400 uppercase tracking-widest mb-1.5">
                    Top FOR argument
                  </div>
                  <MiniArgCard arg={theme.top_for} />
                </div>
              )}

              {/* Top AGAINST argument */}
              {theme.top_against && (
                <div>
                  <div className="text-[10px] font-mono text-against-400 uppercase tracking-widest mb-1.5">
                    Top AGAINST argument
                  </div>
                  <MiniArgCard arg={theme.top_against} />
                </div>
              )}

              {/* More arguments */}
              {theme.arguments.length > 2 && (
                <div>
                  <div className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1.5">
                    More in this theme
                  </div>
                  <div className="space-y-2">
                    {theme.arguments.slice(2, 5).map((arg) => (
                      <MiniArgCard key={arg.id} arg={arg} />
                    ))}
                  </div>
                </div>
              )}

              {/* Browse all link */}
              <Link
                href={`/arguments/common-threads?thread=${theme.id}`}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-mono mt-3 transition-colors',
                  theme.color,
                  'hover:opacity-80'
                )}
              >
                <Layers className="h-3.5 w-3.5" />
                Browse all &ldquo;{theme.label}&rdquo; arguments platform-wide
                <ArrowUpRight className="h-3.5 w-3.5 ml-auto" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="flex justify-between">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-2.5 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-4 flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function TopicThemesPage() {
  const params = useParams()
  const topicId = params?.id as string

  const [data, setData] = useState<ThemesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!topicId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/themes`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load themes')
      const json = (await res.json()) as ThemesResponse
      setData(json)
      // Auto-expand top 2 themes
      if (json.themes.length > 0) {
        setExpandedThemes(new Set(json.themes.slice(0, 2).map((t) => t.id)))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    void load()
  }, [load])

  function toggleTheme(id: string) {
    setExpandedThemes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const topic = data
  const statusLabel = topic ? STATUS_LABEL[topic.topic_status] ?? topic.topic_status : null
  const forPct = topic ? Math.round(topic.topic_blue_pct) : 50
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        {/* Back nav */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={topicId ? `/topic/${topicId}` : '/'}
            className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white font-mono transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to debate
          </Link>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Topic header */}
        {topic ? (
          <div className="mb-6 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant={topic.topic_status === 'law' ? 'gold' : topic.topic_status === 'active' ? 'for' : 'default'}
                className="flex items-center gap-1 font-mono text-[10px]"
              >
                <StatusIcon status={topic.topic_status} />
                {statusLabel}
              </Badge>
            </div>
            <h1 className="text-lg font-mono font-bold text-white leading-tight">
              {topic.topic_statement}
            </h1>
            {/* Vote bar */}
            <div className="space-y-1.5">
              <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
                <div className="bg-for-500 transition-all" style={{ width: `${forPct}%` }} />
                <div className="bg-against-500 flex-1" />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-surface-500">
                <span className="text-for-400">{forPct}% FOR</span>
                <span className="text-against-400">{againstPct}% AGAINST</span>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="mb-6 space-y-3">
            <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /></div>
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ) : null}

        {/* Section header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <Layers className="h-4 w-4 text-purple" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-bold text-white">
              Debate Themes
            </h2>
            <p className="text-xs font-mono text-surface-500">
              How the community is arguing this topic
            </p>
          </div>
          {data && (
            <div className="ml-auto text-right">
              <div className="text-xs font-mono font-bold text-white">
                {data.total_arguments}
              </div>
              <div className="text-[10px] font-mono text-surface-500">
                arguments
              </div>
            </div>
          )}
        </div>

        {/* Stats row */}
        {data && data.themes.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-2.5 text-center">
              <div className="text-lg font-mono font-bold text-white">{data.themes.length}</div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Themes active</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-2.5 text-center">
              <div className="text-lg font-mono font-bold text-for-400">
                {data.themes[0]?.label.split(' ')[0]}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Dominant theme</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-2.5 text-center">
              <div className="text-lg font-mono font-bold text-surface-500">
                {data.uncategorized_count}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Uncategorized</div>
            </div>
          </div>
        )}

        {/* Theme overview bar */}
        {data && data.themes.length > 0 && (
          <div className="mb-5 rounded-2xl border border-surface-300 bg-surface-100 p-4">
            <div className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">
              Theme distribution
            </div>
            <div className="space-y-2">
              {data.themes.slice(0, 6).map((theme) => {
                const pct = data.total_arguments > 0
                  ? Math.round((theme.total / data.total_arguments) * 100)
                  : 0
                return (
                  <button
                    key={theme.id}
                    onClick={() => toggleTheme(theme.id)}
                    className="w-full flex items-center gap-2.5 group text-left"
                  >
                    <span className={cn('text-xs font-mono w-36 flex-shrink-0 truncate transition-colors group-hover:text-white', theme.textColor)}>
                      {theme.label}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', theme.bg.replace('/10', '/70').replace('bg-', 'bg-'))}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-surface-500 w-10 text-right flex-shrink-0">
                      {theme.total}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Theme cards */}
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <MessageSquare className="h-8 w-8 text-against-400 mx-auto mb-2" />
            <p className="text-sm font-mono text-against-300 mb-3">{error}</p>
            <button
              onClick={() => void load()}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1.5 mx-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : data && data.themes.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No themes detected yet"
            description="As arguments are added to this debate, they'll be automatically grouped into civic themes."
          />
        ) : (
          <div className="space-y-3">
            {(data?.themes ?? []).map((theme, i) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                rank={i}
                isExpanded={expandedThemes.has(theme.id)}
                onToggle={() => toggleTheme(theme.id)}
              />
            ))}
          </div>
        )}

        {/* Explainer */}
        {data && data.themes.length > 0 && (
          <div className="mt-8 rounded-2xl border border-surface-300 bg-surface-100 p-4">
            <div className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2">
              How themes work
            </div>
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              Arguments are classified into civic themes by analysing the language used.
              An argument about &ldquo;economic cost&rdquo; lands in <span className="text-gold">Economic Impact</span>;
              one about &ldquo;individual rights&rdquo; goes in <span className="text-for-400">Individual Freedom</span>.
              The FOR/AGAINST split within each theme shows whether a given angle is used more
              to support or oppose the debate.
            </p>
            <div className="mt-3 flex gap-3 flex-wrap">
              <Link
                href={topicId ? `/topic/${topicId}/arguments` : '/'}
                className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
              >
                <MessageSquare className="h-3 w-3" />
                All arguments
              </Link>
              <Link
                href="/arguments/common-threads"
                className="text-xs font-mono text-purple hover:text-purple/80 transition-colors flex items-center gap-1"
              >
                <Layers className="h-3 w-3" />
                Platform-wide themes
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
