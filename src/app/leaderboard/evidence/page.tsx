'use client'

/**
 * /leaderboard/evidence — Evidence Hall of Fame
 *
 * Three ranked views:
 *   Contributors — users who submitted the most upvoted evidence
 *   Best Topics  — topics with the highest AI-assessed evidence quality
 *   Top Sources  — domains most trusted by the community (by upvotes)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Crown,
  ExternalLink,
  Globe,
  Medal,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  EvidenceContributor,
  EvidenceLeaderboardResponse,
  EvidenceQualityTopic,
  TrustedDomain,
} from '@/app/api/leaderboard/evidence/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const ROLE_COLOR: Record<string, string> = {
  elder: 'text-gold',
  debator: 'text-for-400',
  troll_catcher: 'text-emerald',
  person: 'text-surface-500',
}

const ROLE_LABEL: Record<string, string> = {
  elder: 'Elder',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  person: 'Citizen',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Medal helpers ─────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gold/20 border border-gold/40 flex-shrink-0">
        <Crown className="h-3.5 w-3.5 text-gold" />
      </div>
    )
  if (rank === 2)
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-surface-300/60 border border-surface-400/60 flex-shrink-0">
        <Medal className="h-3.5 w-3.5 text-surface-300" />
      </div>
    )
  if (rank === 3)
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-against-500/10 border border-against-500/30 flex-shrink-0">
        <Medal className="h-3.5 w-3.5 text-against-400" />
      </div>
    )
  return (
    <span className="flex items-center justify-center h-7 w-7 text-xs font-mono font-bold text-surface-500 flex-shrink-0">
      {rank}
    </span>
  )
}

// ─── Quality score bar ─────────────────────────────────────────────────────────

function QualityBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = Math.round((score / max) * 100)
  const color =
    score >= 8 ? 'bg-emerald' : score >= 6 ? 'bg-for-500' : score >= 4 ? 'bg-gold' : 'bg-against-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono font-bold text-white w-5 text-right">{score}</span>
    </div>
  )
}

// ─── Row components ────────────────────────────────────────────────────────────

function ContributorRow({ c }: { c: EvidenceContributor }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
    >
      <RankBadge rank={c.rank} />

      <Link
        href={`/profile/${c.username}`}
        className="flex items-center gap-2.5 flex-1 min-w-0"
        onClick={(e) => e.stopPropagation()}
      >
        <Avatar
          src={c.avatar_url}
          username={c.username}
          size="sm"
          className="flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-white truncate">
            {c.display_name ?? c.username}
          </p>
          <p className={cn('text-xs font-mono', ROLE_COLOR[c.role] ?? 'text-surface-500')}>
            {ROLE_LABEL[c.role] ?? 'Citizen'}
          </p>
        </div>
      </Link>

      {/* Stats */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="hidden sm:flex flex-col items-end">
          <div className="flex items-center gap-1">
            <BookOpen className="h-3 w-3 text-surface-500" />
            <span className="text-xs font-mono text-surface-400">{fmtNum(c.submissions)}</span>
          </div>
          <span className="text-[10px] font-mono text-surface-600 mt-0.5">submitted</span>
        </div>

        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-for-400" />
            <span className="text-xs font-mono font-bold text-white">{fmtNum(c.total_upvotes)}</span>
          </div>
          <span className="text-[10px] font-mono text-surface-600 mt-0.5">upvotes</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 ml-2">
          {c.for_count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono bg-for-500/10 text-for-400 border border-for-500/20">
              <ThumbsUp className="h-2.5 w-2.5" />
              {c.for_count}
            </span>
          )}
          {c.against_count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono bg-against-500/10 text-against-400 border border-against-500/20">
              <ThumbsDown className="h-2.5 w-2.5" />
              {c.against_count}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function QualityTopicRow({ t }: { t: EvidenceQualityTopic }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
    >
      <RankBadge rank={t.rank} />

      <div className="flex-1 min-w-0">
        <Link
          href={`/topic/${t.id}?tab=evidence`}
          className="text-sm font-mono font-semibold text-white hover:text-for-300 transition-colors line-clamp-2 leading-snug"
        >
          {t.statement}
        </Link>

        {t.key_claim && (
          <p className="text-xs font-mono text-surface-400 mt-1 line-clamp-2 leading-relaxed">
            {t.key_claim}
          </p>
        )}

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {t.category && (
            <span className={cn('text-[11px] font-mono font-medium', CATEGORY_COLOR[t.category] ?? 'text-surface-500')}>
              {t.category}
            </span>
          )}
          <Badge variant={STATUS_BADGE[t.status] ?? 'proposed'} size="sm">
            {t.status === 'law' ? 'LAW' : t.status}
          </Badge>
          <span className="text-[11px] font-mono text-surface-500">
            {t.evidence_count} sources
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 w-28">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono text-surface-500">Quality</span>
          <Sparkles className="h-3 w-3 text-emerald" />
        </div>
        <QualityBar score={t.quality_score} />
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] font-mono text-surface-500">Balance</span>
        </div>
        <QualityBar
          score={10 - t.bias_score}
          max={10}
        />
      </div>
    </motion.div>
  )
}

function DomainRow({ d }: { d: TrustedDomain }) {
  const forPct = d.total_submissions > 0 ? Math.round((d.for_count / d.total_submissions) * 100) : 0
  const againstPct = d.total_submissions > 0 ? Math.round((d.against_count / d.total_submissions) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
    >
      <RankBadge rank={d.rank} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
          <a
            href={`https://${d.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono font-semibold text-white hover:text-for-300 transition-colors truncate"
          >
            {d.domain}
          </a>
          <ExternalLink className="h-3 w-3 text-surface-600 flex-shrink-0" />
        </div>

        {/* Bias bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
            <div className="h-full bg-for-500" style={{ width: `${forPct}%` }} />
            <div className="h-full bg-against-500" style={{ width: `${againstPct}%` }} />
          </div>
          <span
            className={cn(
              'text-[10px] font-mono flex-shrink-0',
              d.bias_label === 'FOR-leaning'
                ? 'text-for-400'
                : d.bias_label === 'AGAINST-leaning'
                ? 'text-against-400'
                : 'text-surface-500'
            )}
          >
            {d.bias_label}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 text-right">
        <div className="flex items-center gap-1 justify-end">
          <ThumbsUp className="h-3 w-3 text-for-400" />
          <span className="text-sm font-mono font-bold text-white">{fmtNum(d.total_upvotes)}</span>
        </div>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5">
          {fmtNum(d.total_submissions)} submitted
        </p>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300"
        >
          <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-8 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab config ────────────────────────────────────────────────────────────────

type Tab = 'contributors' | 'topics' | 'domains'

const TABS: { id: Tab; label: string; icon: typeof Users; color: string }[] = [
  { id: 'contributors', label: 'Contributors', icon: Users, color: 'text-for-400' },
  { id: 'topics', label: 'Best Topics', icon: Sparkles, color: 'text-emerald' },
  { id: 'domains', label: 'Top Sources', icon: Globe, color: 'text-purple' },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function EvidenceLeaderboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('contributors')
  const [data, setData] = useState<EvidenceLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/evidence', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as EvidenceLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load the evidence leaderboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
              <BookOpen className="h-4.5 w-4.5 text-emerald" />
            </div>
            <div>
              <h1 className="text-lg font-mono font-bold text-white leading-tight">
                Evidence Leaderboard
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Best contributors, sources &amp; documented topics
              </p>
            </div>
          </div>

          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors flex-shrink-0 disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-400', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Platform stats strip */}
        {data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-3 gap-2 mb-6"
          >
            {[
              {
                label: 'submissions',
                value: fmtNum(data.platformStats.total_submissions),
                icon: BookOpen,
                color: 'text-emerald',
              },
              {
                label: 'contributors',
                value: fmtNum(data.platformStats.total_contributors),
                icon: Users,
                color: 'text-for-400',
              },
              {
                label: 'avg quality',
                value: `${data.platformStats.avg_quality_score}/10`,
                icon: Sparkles,
                color: 'text-gold',
              },
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5 text-center"
                >
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Icon className={cn('h-3.5 w-3.5', stat.color)} />
                    <span className="text-base font-mono font-bold text-white">{stat.value}</span>
                  </div>
                  <p className="text-[10px] font-mono text-surface-500">{stat.label}</p>
                </div>
              )
            })}
          </motion.div>
        )}

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Evidence leaderboard views"
          className="flex items-center gap-1 rounded-xl bg-surface-200 border border-surface-300 p-1 mb-5"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-mono font-semibold transition-all',
                  isActive
                    ? 'bg-surface-50 border border-surface-400 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', isActive ? tab.color : '')} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* ── Contributors ── */}
              {activeTab === 'contributors' && (
                <>
                  {data?.topContributors.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No evidence yet"
                      description="Be the first to submit evidence on a topic debate."
                      actions={[{ label: 'Browse topics', href: '/', variant: 'primary' }]}
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg bg-surface-200/50 border border-surface-300 px-4 py-2.5 mb-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-for-400" />
                          <span className="text-xs font-mono font-semibold text-white">
                            {data?.topContributors.length} contributors
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-surface-500">
                          Ranked by total upvotes received
                        </span>
                      </div>
                      {data?.topContributors.map((c) => (
                        <ContributorRow key={c.user_id} c={c} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── Best Topics ── */}
              {activeTab === 'topics' && (
                <>
                  {data?.topQualityTopics.length === 0 ? (
                    <EmptyState
                      icon={Sparkles}
                      title="No analysed topics yet"
                      description="Topics need at least 3 evidence submissions to receive an AI quality score."
                      actions={[{ label: 'Browse topics', href: '/', variant: 'primary' }]}
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg bg-surface-200/50 border border-surface-300 px-4 py-2.5 mb-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-emerald" />
                          <span className="text-xs font-mono font-semibold text-white">
                            {data?.topQualityTopics.length} high-quality topics
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-surface-500">
                          Ranked by AI quality score ≥6
                        </span>
                      </div>
                      {data?.topQualityTopics.map((t) => (
                        <QualityTopicRow key={t.id} t={t} />
                      ))}
                    </div>
                  )}

                  {/* Legend */}
                  <div className="mt-6 rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-2.5">
                    <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                      Score legend
                    </p>
                    {[
                      { range: '8–10', label: 'Excellent', color: 'bg-emerald' },
                      { range: '6–7', label: 'Good', color: 'bg-for-500' },
                      { range: '4–5', label: 'Fair', color: 'bg-gold' },
                      { range: '0–3', label: 'Weak', color: 'bg-against-500' },
                    ].map((item) => (
                      <div key={item.range} className="flex items-center gap-2.5">
                        <div className={cn('h-2 w-6 rounded-full flex-shrink-0', item.color)} />
                        <span className="text-xs font-mono text-surface-300">{item.range}</span>
                        <span className="text-xs font-mono text-surface-500">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* ── Top Sources ── */}
              {activeTab === 'domains' && (
                <>
                  {data?.trustedDomains.length === 0 ? (
                    <EmptyState
                      icon={Globe}
                      title="No sources yet"
                      description="Evidence with external URLs will appear here once upvoted."
                      actions={[{ label: 'Browse topics', href: '/', variant: 'primary' }]}
                    />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg bg-surface-200/50 border border-surface-300 px-4 py-2.5 mb-4">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-purple" />
                          <span className="text-xs font-mono font-semibold text-white">
                            {data?.trustedDomains.length} trusted domains
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-surface-500">
                          Ranked by community upvotes
                        </span>
                      </div>
                      {data?.trustedDomains.map((d) => (
                        <DomainRow key={d.domain} d={d} />
                      ))}
                    </div>
                  )}

                  {/* Bias bar legend */}
                  <div className="mt-6 rounded-xl border border-surface-300 bg-surface-100 p-4">
                    <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-3">
                      Bias bar legend
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-1.5 w-8 rounded-full bg-for-500" />
                      <span className="text-xs font-mono text-surface-400">FOR evidence</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-8 rounded-full bg-against-500" />
                      <span className="text-xs font-mono text-surface-400">AGAINST evidence</span>
                    </div>
                    <p className="text-[11px] font-mono text-surface-600 mt-3">
                      Labelled &ldquo;FOR-leaning&rdquo; when &gt;60% of that domain&rsquo;s cited articles support the FOR side.
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Full leaderboard link */}
        {!loading && !error && data && (
          <div className="mt-8">
            <Link
              href="/leaderboard"
              className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-200/50 px-4 py-3.5 hover:bg-surface-200 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-300 flex-shrink-0">
                  <Trophy className="h-4 w-4 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-mono font-semibold text-white">Full Leaderboard</p>
                  <p className="text-xs font-mono text-surface-500 mt-0.5">
                    Top voters, lawmakers, predictors &amp; more
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors flex-shrink-0" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
