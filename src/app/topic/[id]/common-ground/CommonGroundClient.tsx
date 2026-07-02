'use client'

/**
 * /topic/[id]/common-ground — Where Both Sides Meet
 *
 * Surfaces arguments from both FOR and AGAINST camps that acknowledge the
 * other side, shared vocabulary, and the overall debate's civility level.
 *
 * Distinct from:
 *   /synthesis     — AI-generated synthesis narrative
 *   /frames        — ideological lens breakdown
 *   /versus        — raw best FOR vs AGAINST
 *   /cross-examine — structured rebuttal view
 *   /steelman      — best charitable reading of each side
 *
 * This page is DATA-DRIVEN: it analyzes the actual text of real community
 * arguments to find concession language, shared vocabulary, and bridge phrases.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Handshake,
  Hash,
  Info,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CommonGroundResponse, NuancedArgument, SharedTheme } from '@/app/api/topics/[id]/common-ground/route'

// ─── Score Display ─────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const label =
    score >= 70 ? 'Strong Common Ground'
    : score >= 45 ? 'Moderate Common Ground'
    : score >= 20 ? 'Limited Common Ground'
    : 'Highly Polarised'

  const color =
    score >= 70 ? 'text-emerald'
    : score >= 45 ? 'text-gold'
    : score >= 20 ? 'text-for-400'
    : 'text-against-400'

  const bgColor =
    score >= 70 ? 'bg-emerald/20 border-emerald/30'
    : score >= 45 ? 'bg-gold/20 border-gold/30'
    : score >= 20 ? 'bg-for-500/20 border-for-500/30'
    : 'bg-against-500/20 border-against-500/30'

  const segments = 10
  const filledSegments = Math.round((score / 100) * segments)

  return (
    <div className={cn('rounded-2xl border p-6 text-center', bgColor)}>
      <div className={cn('text-6xl font-black tabular-nums mb-1', color)}>{score}</div>
      <div className="text-xs text-surface-600 mb-4">/ 100 Common Ground Score</div>
      <div className="flex items-center justify-center gap-1 mb-3">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-2 flex-1 rounded-full transition-all',
              i < filledSegments ? (
                score >= 70 ? 'bg-emerald'
                : score >= 45 ? 'bg-gold'
                : score >= 20 ? 'bg-for-400'
                : 'bg-against-400'
              ) : 'bg-surface-300',
            )}
          />
        ))}
      </div>
      <div className={cn('text-sm font-semibold', color)}>{label}</div>
    </div>
  )
}

// ─── Nuanced Argument Card ─────────────────────────────────────────────────────

function NuancedArgCard({ arg }: { arg: NuancedArgument }) {
  const isFor = arg.side === 'blue'
  const [expanded, setExpanded] = useState(false)

  // Highlight concession phrases in the content
  function highlight(text: string, phrases: string[]) {
    if (!phrases.length) return text
    // Build a regex from the phrases (escape special chars)
    const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const re = new RegExp(`(${escaped.join('|')})`, 'gi')
    const parts = text.split(re)
    return parts.map((part, i) =>
      re.test(part) ? (
        <mark key={i} className="bg-gold/25 text-gold rounded px-0.5 not-italic">
          {part}
        </mark>
      ) : (
        part
      ),
    )
  }

  const preview = arg.content.slice(0, 200)
  const isLong = arg.content.length > 200
  const displayContent = expanded || !isLong ? arg.content : preview + '…'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border bg-surface-100 overflow-hidden',
        isFor ? 'border-for-500/30' : 'border-against-500/30',
      )}
    >
      {/* Side badge + nuance score */}
      <div
        className={cn(
          'px-4 py-2 flex items-center justify-between',
          isFor ? 'bg-for-500/10' : 'bg-against-500/10',
        )}
      >
        <Badge
          variant={isFor ? 'for' : 'against'}
          size="sm"
          className="font-semibold"
        >
          {isFor ? 'FOR' : 'AGAINST'}
        </Badge>
        <div className="flex items-center gap-2 text-xs text-surface-600">
          <Sparkles className="h-3 w-3 text-gold" />
          <span className="text-gold font-medium">{arg.nuance_score}% nuanced</span>
          <span>·</span>
          <ThumbsUp className="h-3 w-3" />
          <span>{arg.upvotes}</span>
          {arg.ai_grade && (
            <>
              <span>·</span>
              <span
                className={cn(
                  'font-bold',
                  arg.ai_grade.startsWith('A') ? 'text-emerald'
                  : arg.ai_grade.startsWith('B') ? 'text-for-400'
                  : 'text-gold',
                )}
              >
                {arg.ai_grade}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <p className="text-sm text-surface-800 leading-relaxed">
          {highlight(displayContent, arg.highlighted_phrases)}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-surface-600 hover:text-white underline"
          >
            {expanded ? 'Show less' : 'Read full argument'}
          </button>
        )}

        {/* Concession phrases detected */}
        {arg.highlighted_phrases.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {arg.highlighted_phrases.map((phrase) => (
              <span
                key={phrase}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 text-gold text-xs"
              >
                <Sparkles className="h-2.5 w-2.5 flex-shrink-0" />
                {phrase}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Author */}
      {arg.author && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <Avatar
            src={arg.author.avatar_url}
            username={arg.author.username}
            size="xs"
          />
          <Link
            href={`/profile/${arg.author.username}`}
            className="text-xs text-surface-600 hover:text-white transition-colors"
          >
            {arg.author.display_name ?? arg.author.username}
          </Link>
        </div>
      )}
    </motion.div>
  )
}

// ─── Shared Themes ─────────────────────────────────────────────────────────────

function SharedThemeCloud({ themes }: { themes: SharedTheme[] }) {
  if (!themes.length) return null

  const max = Math.max(...themes.map((t) => t.total))

  return (
    <div className="flex flex-wrap gap-2">
      {themes.map((theme) => {
        const size = Math.max(0.75, (theme.total / max) * 1.25)
        return (
          <div
            key={theme.phrase}
            style={{ fontSize: `${size}rem` }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-200 border border-surface-300 text-surface-700 hover:border-gold/40 hover:text-gold transition-colors cursor-default"
            title={`FOR: ${theme.for_count}× · AGAINST: ${theme.against_count}×`}
          >
            <Hash className="h-3 w-3 flex-shrink-0 opacity-60" />
            {theme.phrase}
          </div>
        )
      })}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      <Skeleton className="h-6 w-32" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function CommonGroundClient() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<CommonGroundResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'nuanced' | 'themes'>('nuanced')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/common-ground`)
      if (!res.ok) throw new Error('Failed to load')
      const json: CommonGroundResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load common ground analysis.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const topic = data?.topic

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Back */}
        <Link
          href={`/topic/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-surface-600 hover:text-white mb-5 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to topic
        </Link>

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald/15 border border-emerald/30 flex items-center justify-center">
            <Handshake className="h-5 w-5 text-emerald" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Common Ground</h1>
            <p className="text-xs text-surface-600 mt-0.5">
              Where both sides meet — nuanced arguments, shared vocabulary, and bridge language
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex-shrink-0 p-1.5 rounded-lg text-surface-600 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Topic statement */}
        {topic && (
          <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 mb-6">
            <p className="text-sm text-surface-800 leading-relaxed">{topic.statement}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-surface-600">
              {topic.category && <span className="text-gold">{topic.category}</span>}
              <span className="text-for-400">{Math.round(topic.blue_pct ?? 50)}% FOR</span>
              <span>·</span>
              <span>{(topic.total_votes ?? 0).toLocaleString()} votes</span>
            </div>
          </div>
        )}

        {loading && <LoadingSkeleton />}

        {error && (
          <EmptyState
            icon={Scale}
            title="Couldn't load analysis"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Score Gauge */}
              <ScoreGauge score={data.common_ground_score} />

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                  <div className="text-2xl font-bold text-for-400">
                    {data.nuance_for_pct}%
                  </div>
                  <div className="text-xs text-surface-600 mt-0.5 flex items-center justify-center gap-1">
                    <ThumbsUp className="h-3 w-3 text-for-400" />
                    FOR nuanced
                  </div>
                </div>
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                  <div className="text-2xl font-bold text-gold">
                    {data.shared_themes.length}
                  </div>
                  <div className="text-xs text-surface-600 mt-0.5 flex items-center justify-center gap-1">
                    <Hash className="h-3 w-3 text-gold" />
                    shared themes
                  </div>
                </div>
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                  <div className="text-2xl font-bold text-against-400">
                    {data.nuance_against_pct}%
                  </div>
                  <div className="text-xs text-surface-600 mt-0.5 flex items-center justify-center gap-1">
                    <ThumbsDown className="h-3 w-3 text-against-400" />
                    AGAINST nuanced
                  </div>
                </div>
              </div>

              {/* Info callout */}
              <div className="flex items-start gap-2.5 rounded-xl bg-surface-200/60 border border-surface-300 px-4 py-3">
                <Info className="h-4 w-4 text-surface-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-surface-600 leading-relaxed">
                  Arguments score as &quot;nuanced&quot; when they contain concession language —
                  phrases like <em className="text-gold not-italic">&quot;however&quot;</em>,{' '}
                  <em className="text-gold not-italic">&quot;to be fair&quot;</em>, or{' '}
                  <em className="text-gold not-italic">&quot;while valid&quot;</em> that acknowledge
                  the opposing view. Shared themes are vocabulary both sides use independently.
                </p>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 bg-surface-200 rounded-xl p-1">
                {([
                  { id: 'nuanced', label: 'Nuanced Arguments', icon: Sparkles },
                  { id: 'themes', label: 'Shared Themes', icon: Hash },
                ] as const).map(({ id: tabId, label, icon: Icon }) => (
                  <button
                    key={tabId}
                    onClick={() => setActiveTab(tabId)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                      activeTab === tabId
                        ? 'bg-surface-100 text-white shadow-sm'
                        : 'text-surface-600 hover:text-white',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Nuanced Arguments Tab */}
              {activeTab === 'nuanced' && (
                <motion.div
                  key="nuanced"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  {data.nuanced_for.length === 0 && data.nuanced_against.length === 0 ? (
                    <EmptyState
                      icon={Handshake}
                      title="No nuanced arguments detected yet"
                      description="As more community members write thoughtful arguments that acknowledge the other side, they'll appear here."
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* FOR column */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <ThumbsUp className="h-4 w-4 text-for-400" />
                          <span className="text-sm font-semibold text-for-400">
                            FOR — Acknowledging Doubts
                          </span>
                          <span className="text-xs text-surface-600 ml-auto">
                            {data.nuanced_for.length} found
                          </span>
                        </div>
                        {data.nuanced_for.length === 0 ? (
                          <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                            <p className="text-xs text-surface-600">
                              No nuanced FOR arguments yet
                            </p>
                          </div>
                        ) : (
                          data.nuanced_for.map((arg) => (
                            <NuancedArgCard key={arg.id} arg={arg} />
                          ))
                        )}
                      </div>

                      {/* AGAINST column */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <ThumbsDown className="h-4 w-4 text-against-400" />
                          <span className="text-sm font-semibold text-against-400">
                            AGAINST — Acknowledging Merits
                          </span>
                          <span className="text-xs text-surface-600 ml-auto">
                            {data.nuanced_against.length} found
                          </span>
                        </div>
                        {data.nuanced_against.length === 0 ? (
                          <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
                            <p className="text-xs text-surface-600">
                              No nuanced AGAINST arguments yet
                            </p>
                          </div>
                        ) : (
                          data.nuanced_against.map((arg) => (
                            <NuancedArgCard key={arg.id} arg={arg} />
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* CTA: encourage nuanced writing */}
                  <div className="rounded-xl bg-emerald/10 border border-emerald/20 px-4 py-3 flex items-center gap-3">
                    <Zap className="h-5 w-5 text-emerald flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-emerald">
                        Want to appear on this page?
                      </p>
                      <p className="text-xs text-surface-600 mt-0.5">
                        Write a nuanced argument that acknowledges the other side&apos;s valid concerns.
                        Arguments with bridge language get featured here.
                      </p>
                    </div>
                    <Link
                      href={`/topic/${id}/argue`}
                      className="flex-shrink-0 ml-auto px-3 py-1.5 rounded-lg bg-emerald text-black text-xs font-semibold hover:bg-emerald/90 transition-colors"
                    >
                      Argue
                    </Link>
                  </div>
                </motion.div>
              )}

              {/* Shared Themes Tab */}
              {activeTab === 'themes' && (
                <motion.div
                  key="themes"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5"
                >
                  {data.shared_themes.length === 0 ? (
                    <EmptyState
                      icon={Hash}
                      title="No shared themes yet"
                      description="As the debate grows, vocabulary common to both sides will surface here."
                    />
                  ) : (
                    <>
                      <div className="rounded-xl bg-surface-100 border border-surface-300 p-5">
                        <h3 className="text-sm font-semibold text-white mb-1">
                          Vocabulary Both Sides Share
                        </h3>
                        <p className="text-xs text-surface-600 mb-4">
                          These concepts appear in arguments from BOTH camps — a sign that
                          both sides are reasoning about the same things, even if they reach
                          different conclusions. Larger = more frequently mentioned.
                        </p>
                        <SharedThemeCloud themes={data.shared_themes} />
                      </div>

                      {/* Theme breakdown table */}
                      <div className="rounded-xl bg-surface-100 border border-surface-300 overflow-hidden">
                        <div className="px-4 py-3 border-b border-surface-300 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-gold" />
                          <span className="text-sm font-semibold text-white">Theme Breakdown</span>
                        </div>
                        <div className="divide-y divide-surface-300">
                          {data.shared_themes.slice(0, 12).map((theme) => {
                            const total = theme.for_count + theme.against_count
                            const forPct = Math.round((theme.for_count / total) * 100)
                            return (
                              <div key={theme.phrase} className="px-4 py-2.5 flex items-center gap-3">
                                <Hash className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
                                <span className="text-sm text-surface-800 flex-1 min-w-0 truncate">
                                  {theme.phrase}
                                </span>
                                {/* Mini FOR/AGAINST bar */}
                                <div className="flex items-center gap-1 w-24 flex-shrink-0">
                                  <div className="h-1.5 flex-1 rounded-full overflow-hidden bg-surface-300 flex">
                                    <div
                                      className="h-full bg-for-400 transition-all"
                                      style={{ width: `${forPct}%` }}
                                    />
                                    <div
                                      className="h-full bg-against-400 transition-all"
                                      style={{ width: `${100 - forPct}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="text-xs text-surface-600 w-6 text-right flex-shrink-0">
                                  {total}×
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* Footer nav */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-surface-300">
                {[
                  { href: `/topic/${id}/synthesis`, label: 'Synthesis', icon: Sparkles },
                  { href: `/topic/${id}/frames`, label: 'Frames', icon: Users },
                  { href: `/topic/${id}/versus`, label: 'Head-to-Head', icon: Scale },
                  { href: `/topic/${id}/cross-examine`, label: 'Cross-Examine', icon: MessageSquare },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs text-surface-700 hover:text-white transition-colors"
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </Link>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
