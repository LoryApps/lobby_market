'use client'

/**
 * /law/[id]/common-ground — Where Both Sides Agreed
 *
 * Retrospective analysis of the founding debate's constructive moments:
 * arguments from both camps that acknowledged the other side, shared
 * vocabulary invoked by FOR and AGAINST alike, and the civic concepts
 * that bridged the divide.
 *
 * Distinct from:
 *   /dissent      — who voted against and why
 *   /mandate      — how decisively the law passed
 *   /audit        — democratic legitimacy check
 *   /synthesis    — AI narrative combining both views
 *   /blocs        — group voting patterns
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Handshake,
  Hash,
  Info,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawCommonGroundResponse, NuancedArgument, SharedTheme, ConsensusPoint } from '@/app/api/laws/[id]/common-ground/route'

// ─── Score Gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const label =
    score >= 60 ? 'Strong Common Ground'
    : score >= 35 ? 'Moderate Common Ground'
    : score >= 15 ? 'Limited Common Ground'
    : 'Highly Polarised'

  const color =
    score >= 60 ? 'text-emerald'
    : score >= 35 ? 'text-gold'
    : score >= 15 ? 'text-for-400'
    : 'text-against-400'

  const bgBorder =
    score >= 60 ? 'bg-emerald/10 border-emerald/30'
    : score >= 35 ? 'bg-gold/10 border-gold/30'
    : score >= 15 ? 'bg-for-500/10 border-for-500/30'
    : 'bg-against-500/10 border-against-500/30'

  const barColor =
    score >= 60 ? 'bg-emerald'
    : score >= 35 ? 'bg-gold'
    : score >= 15 ? 'bg-for-400'
    : 'bg-against-400'

  const segments = 10
  const filled = Math.round((score / 100) * segments)

  return (
    <div className={cn('rounded-2xl border p-6 text-center', bgBorder)}>
      <div className={cn('text-6xl font-black tabular-nums mb-1', color)}>{score}</div>
      <div className="text-xs text-surface-600 mb-4">/ 100 Common Ground Score</div>
      <div className="flex items-center justify-center gap-1 mb-3">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn('h-2 flex-1 rounded-full transition-all', i < filled ? barColor : 'bg-surface-300')}
          />
        ))}
      </div>
      <div className={cn('text-sm font-semibold', color)}>{label}</div>
    </div>
  )
}

// ─── Nuanced Argument Card ────────────────────────────────────────────────────

function NuancedArgCard({ arg }: { arg: NuancedArgument }) {
  const isFor = arg.side === 'blue'
  const [expanded, setExpanded] = useState(false)
  const preview = arg.content.slice(0, 200)
  const needsExpand = arg.content.length > 200

  function highlightConcessions(text: string, phrases: string[]): React.ReactNode {
    if (phrases.length === 0) return text
    const result = text
    const highlighted: Array<string | React.ReactElement> = []
    let remaining = text

    for (const phrase of phrases.slice(0, 3)) {
      const idx = remaining.toLowerCase().indexOf(phrase.toLowerCase())
      if (idx === -1) continue
      if (idx > 0) highlighted.push(remaining.slice(0, idx))
      highlighted.push(
        <mark key={phrase} className="bg-gold/20 text-gold rounded px-0.5 not-italic">
          {remaining.slice(idx, idx + phrase.length)}
        </mark>
      )
      remaining = remaining.slice(idx + phrase.length)
    }
    highlighted.push(remaining)
    return highlighted.length > 1 ? <>{highlighted}</> : result
  }

  const displayText = needsExpand && !expanded ? `${preview}…` : arg.content

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 flex flex-col gap-3',
        isFor
          ? 'border-for-500/20 bg-for-500/5'
          : 'border-against-500/20 bg-against-500/5',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar
            src={arg.author?.avatar_url ?? null}
            username={arg.author?.username ?? 'anon'}
            size={28}
          />
          <Link
            href={`/profile/${arg.author?.username ?? ''}`}
            className="text-sm font-medium text-surface-900 hover:text-for-400 truncate transition-colors"
          >
            {arg.author?.display_name ?? arg.author?.username ?? 'Anonymous'}
          </Link>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant={isFor ? 'for' : 'against'}
            size="sm"
          >
            {isFor ? 'FOR' : 'AGAINST'}
          </Badge>
          {arg.ai_grade && (
            <Badge variant="outline" size="sm">{arg.ai_grade}</Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-800 leading-relaxed">
        {highlightConcessions(displayText, arg.highlighted_phrases)}
      </p>

      {needsExpand && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-for-400 hover:text-for-300 transition-colors self-start"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 text-xs text-surface-500">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3" />
          {arg.upvotes}
        </span>
        {arg.highlighted_phrases.length > 0 && (
          <span className="flex items-center gap-1 text-gold">
            <Sparkles className="h-3 w-3" />
            {arg.highlighted_phrases.length} bridge phrase{arg.highlighted_phrases.length !== 1 ? 's' : ''}
          </span>
        )}
        <Link
          href={`/arguments/${arg.id}`}
          className="ml-auto hover:text-for-400 transition-colors"
        >
          View full →
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Shared Theme Pill ────────────────────────────────────────────────────────

function SharedThemePill({ theme }: { theme: SharedTheme }) {
  const totalMax = theme.for_count + theme.against_count
  const forWidth = Math.round((theme.for_count / totalMax) * 100)

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-surface-900 capitalize truncate">
          {theme.phrase}
        </span>
        <span className="text-xs text-surface-500 shrink-0">{theme.total}×</span>
      </div>
      <div className="flex rounded-full overflow-hidden h-1.5">
        <div className="bg-for-500 transition-all" style={{ width: `${forWidth}%` }} />
        <div className="bg-against-500 transition-all" style={{ width: `${100 - forWidth}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-surface-500">
        <span className="text-for-400">{theme.for_count} FOR</span>
        <span className="text-against-400">{theme.against_count} AGAINST</span>
      </div>
    </div>
  )
}

// ─── Consensus Point ──────────────────────────────────────────────────────────

function ConsensusPointCard({ point }: { point: ConsensusPoint }) {
  const color =
    point.bridge_strength === 'strong' ? 'text-emerald border-emerald/30 bg-emerald/5'
    : point.bridge_strength === 'moderate' ? 'text-gold border-gold/30 bg-gold/5'
    : 'text-for-400 border-for-500/20 bg-for-500/5'

  const label =
    point.bridge_strength === 'strong' ? 'Strong Bridge'
    : point.bridge_strength === 'moderate' ? 'Moderate Bridge'
    : 'Weak Bridge'

  return (
    <div className={cn('rounded-xl border p-3 flex items-center justify-between gap-3', color)}>
      <div className="flex items-center gap-2 min-w-0">
        <Handshake className="h-4 w-4 shrink-0 opacity-70" />
        <span className="text-sm font-semibold capitalize truncate">{point.concept}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] opacity-70">{label}</span>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-for-400">{point.for_endorsers}×</span>
          <span className="opacity-40">/</span>
          <span className="text-against-400">{point.against_endorsers}×</span>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-4 pt-4 pb-24">
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-6 w-40" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

interface Props {
  lawId: string
  statement: string
  category: string | null
  bluePct: number
  totalVotes: number
  establishedAt: string | null
}

export function LawCommonGroundClient({
  lawId,
  statement,
  category,
  bluePct,
  totalVotes,
  establishedAt,
}: Props) {
  const [data, setData] = useState<LawCommonGroundResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'for' | 'against'>('for')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/common-ground`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as LawCommonGroundResponse
      setData(json)
    } catch {
      setError('Could not load common ground data.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  const year = establishedAt ? new Date(establishedAt).getFullYear() : null

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-28">
        {/* Back + header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href={`/law/${lawId}`}
            className="p-2 rounded-full bg-surface-200 hover:bg-surface-300 transition-colors"
            aria-label="Back to law"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-surface-900 leading-tight flex items-center gap-2">
              <Handshake className="h-5 w-5 text-emerald shrink-0" />
              Common Ground
            </h1>
            <p className="text-xs text-surface-500 truncate">{statement}</p>
          </div>
        </div>

        {/* Meta bar */}
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <Badge variant="for" size="sm">{forPct}% FOR</Badge>
          <Badge variant="against" size="sm">{againstPct}% AGAINST</Badge>
          {category && <Badge variant="outline" size="sm">{category}</Badge>}
          {year && <Badge variant="outline" size="sm">Est. {year}</Badge>}
          <span className="text-xs text-surface-500">{totalVotes.toLocaleString()} voters</span>
        </div>

        {loading && <PageSkeleton />}

        {!loading && error && (
          <EmptyState
            icon={Info}
            title="Could not load"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {!loading && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-6"
            >
              {/* Score gauge */}
              <ScoreGauge score={data.common_ground_score} />

              {/* Legitimacy note */}
              <p className="text-sm text-surface-600 italic text-center px-2">
                {data.legitimacy_note}
              </p>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-for-500/20 bg-for-500/5 p-4 text-center">
                  <div className="text-2xl font-black text-for-400 mb-1">{data.nuance_for_pct}%</div>
                  <div className="text-xs text-surface-600">FOR args with bridge language</div>
                </div>
                <div className="rounded-xl border border-against-500/20 bg-against-500/5 p-4 text-center">
                  <div className="text-2xl font-black text-against-400 mb-1">{data.nuance_against_pct}%</div>
                  <div className="text-xs text-surface-600">AGAINST args with bridge language</div>
                </div>
              </div>

              {/* Consensus concepts */}
              {data.consensus_points.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-surface-700 mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold" />
                    Shared Civic Values ({data.consensus_points.length})
                  </h2>
                  <div className="flex flex-col gap-2">
                    {data.consensus_points.map((pt) => (
                      <ConsensusPointCard key={pt.concept} point={pt} />
                    ))}
                  </div>
                </section>
              )}

              {/* Shared vocabulary */}
              {data.shared_themes.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-surface-700 mb-3 flex items-center gap-2">
                    <Hash className="h-4 w-4 text-for-400" />
                    Shared Vocabulary ({data.shared_themes.length} phrases)
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    {data.shared_themes.map((theme) => (
                      <SharedThemePill key={theme.phrase} theme={theme} />
                    ))}
                  </div>
                </section>
              )}

              {/* Nuanced arguments — tabbed FOR / AGAINST */}
              {(data.nuanced_for.length > 0 || data.nuanced_against.length > 0) && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-surface-700 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-surface-500" />
                      Constructive Arguments
                    </h2>
                    <div className="flex rounded-lg overflow-hidden border border-surface-300 text-xs">
                      <button
                        onClick={() => setActiveTab('for')}
                        className={cn(
                          'px-3 py-1.5 transition-colors',
                          activeTab === 'for'
                            ? 'bg-for-500/20 text-for-300 font-medium'
                            : 'text-surface-500 hover:text-surface-700',
                        )}
                      >
                        FOR ({data.nuanced_for.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('against')}
                        className={cn(
                          'px-3 py-1.5 transition-colors',
                          activeTab === 'against'
                            ? 'bg-against-500/20 text-against-300 font-medium'
                            : 'text-surface-500 hover:text-surface-700',
                        )}
                      >
                        AGAINST ({data.nuanced_against.length})
                      </button>
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {activeTab === 'for' && (
                      <motion.div
                        key="for"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        className="flex flex-col gap-3"
                      >
                        {data.nuanced_for.length === 0 ? (
                          <EmptyState
                            icon={ThumbsUp}
                            title="No nuanced FOR arguments"
                            description="The FOR side argued their position without acknowledging the other side."
                          />
                        ) : (
                          data.nuanced_for.map((arg) => <NuancedArgCard key={arg.id} arg={arg} />)
                        )}
                      </motion.div>
                    )}
                    {activeTab === 'against' && (
                      <motion.div
                        key="against"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        className="flex flex-col gap-3"
                      >
                        {data.nuanced_against.length === 0 ? (
                          <EmptyState
                            icon={ThumbsDown}
                            title="No nuanced AGAINST arguments"
                            description="The AGAINST side argued their position without acknowledging the other side."
                          />
                        ) : (
                          data.nuanced_against.map((arg) => <NuancedArgCard key={arg.id} arg={arg} />)
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              )}

              {/* Empty state when no arguments at all */}
              {data.nuanced_for.length === 0 && data.nuanced_against.length === 0 && data.shared_themes.length === 0 && (
                <EmptyState
                  icon={Handshake}
                  title="No common ground data yet"
                  description="This law doesn't have enough founding arguments to analyse for common ground."
                />
              )}

              {/* Footer nav */}
              <div className="flex items-center justify-between pt-2 border-t border-surface-200 text-xs text-surface-500">
                <Link href={`/law/${lawId}/dissent`} className="hover:text-against-400 flex items-center gap-1 transition-colors">
                  <ThumbsDown className="h-3.5 w-3.5" /> Dissent
                </Link>
                <Link href={`/law/${lawId}/synthesis`} className="hover:text-for-400 flex items-center gap-1 transition-colors">
                  <Sparkles className="h-3.5 w-3.5" /> Synthesis
                </Link>
                <Link href={`/law/${lawId}/arguments`} className="hover:text-for-400 flex items-center gap-1 transition-colors">
                  <MessageSquare className="h-3.5 w-3.5" /> All Arguments
                </Link>
                <button
                  onClick={load}
                  className="hover:text-surface-700 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
