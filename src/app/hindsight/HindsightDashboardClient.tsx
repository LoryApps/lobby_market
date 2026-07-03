'use client'

/**
 * /hindsight — Community Hindsight Dashboard
 *
 * Platform-wide retrospective: after topics resolve (law or failed), citizens
 * reflect on whether the community made the right call.  This page aggregates
 * all hindsight votes to reveal collective wisdom, regret, and controversy.
 *
 * Distinct from:
 *   /topic/[id]/hindsight  — per-topic hindsight page
 *   /topic/[id]/autopsy    — forensic debate analysis
 *   /topic/[id]/legacy     — long-term impact
 *   /wisdom                — Elder Council argument feed
 *
 * This is the only platform-level hindsight dashboard.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  Brain,
  ChevronRight,
  Clock,
  Gavel,
  RotateCcw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  HindsightDashboardResponse,
  HindsightTopicSummary,
  HindsightCategoryStat,
  HindsightRecentEntry,
} from '@/app/api/hindsight/route'

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

function wisdomLabel(score: number): { label: string; color: string; emoji: string } {
  if (score >= 85) return { label: 'Collective Wisdom', color: 'text-emerald', emoji: '🏛️' }
  if (score >= 70) return { label: 'Generally Right', color: 'text-for-400', emoji: '✅' }
  if (score >= 55) return { label: 'Leaning Right', color: 'text-for-300', emoji: '📈' }
  if (score >= 45) return { label: 'Split Verdict', color: 'text-gold', emoji: '⚖️' }
  if (score >= 30) return { label: 'Some Regret', color: 'text-against-400', emoji: '🤔' }
  return { label: 'Deep Regret', color: 'text-against-300', emoji: '😔' }
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-purple',
  Other: 'text-surface-500',
}

const ROLE_COLOR: Record<string, string> = {
  elder: 'text-gold',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  senator: 'text-purple',
  person: 'text-surface-500',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WisdomMeter({ score }: { score: number }) {
  const { label, color, emoji } = wisdomLabel(score)
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center w-36 h-36">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 144 144">
          <circle
            cx="72" cy="72" r="60"
            fill="none"
            stroke="currentColor"
            className="text-surface-300"
            strokeWidth="12"
          />
          <circle
            cx="72" cy="72" r="60"
            fill="none"
            stroke="currentColor"
            className={score >= 50 ? 'text-for-500' : 'text-against-500'}
            strokeWidth="12"
            strokeDasharray={`${(score / 100) * 376.99} 376.99`}
            strokeLinecap="round"
          />
        </svg>
        <div className="flex flex-col items-center">
          <span className="text-3xl font-mono font-bold text-white">{score}%</span>
          <span className="text-xs font-mono text-surface-500">wisdom</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-lg">{emoji}</span>
        <span className={cn('text-sm font-mono font-semibold', color)}>{label}</span>
      </div>
    </div>
  )
}

function TopicCard({
  topic,
  mode,
}: {
  topic: HindsightTopicSummary
  mode: 'vindicated' | 'regretted' | 'contested'
}) {
  const pct = mode === 'regretted' ? topic.wrong_pct : mode === 'vindicated' ? topic.right_pct : topic.right_pct
  const isLaw = topic.status === 'law'

  return (
    <Link
      href={`/topic/${topic.id}/hindsight`}
      className="group block rounded-xl border border-surface-300/60 bg-surface-200/40 hover:border-surface-400/60 hover:bg-surface-200/60 transition-all p-3.5 gap-2"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant={isLaw ? 'law' : 'failed'}>
            {isLaw ? (
              <span className="flex items-center gap-0.5"><Gavel className="h-2.5 w-2.5" />LAW</span>
            ) : (
              <span className="flex items-center gap-0.5"><XCircle className="h-2.5 w-2.5" />FAILED</span>
            )}
          </Badge>
          {topic.category && (
            <span className={cn('text-[10px] font-mono', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
              {topic.category}
            </span>
          )}
        </div>
        <div className={cn(
          'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold flex-shrink-0',
          mode === 'regretted'
            ? 'bg-against-500/15 text-against-400 border border-against-500/30'
            : mode === 'vindicated'
            ? 'bg-emerald/15 text-emerald border border-emerald/30'
            : 'bg-gold/15 text-gold border border-gold/30',
        )}>
          {mode === 'regretted' ? (
            <><ThumbsDown className="h-2.5 w-2.5" />{pct}% wrong</>
          ) : mode === 'vindicated' ? (
            <><ThumbsUp className="h-2.5 w-2.5" />{pct}% right</>
          ) : (
            <><Scale className="h-2.5 w-2.5" />{pct}/{topic.wrong_pct} split</>
          )}
        </div>
      </div>

      <p className="text-sm font-mono text-white/90 leading-snug line-clamp-2 mb-2 group-hover:text-white transition-colors">
        {topic.statement}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Right/Wrong bar */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-emerald tabular-nums">{topic.right_count}</span>
            <div className="w-16 h-1 bg-surface-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald rounded-full"
                style={{ width: `${topic.right_pct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-against-400 tabular-nums">{topic.wrong_count}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
          <Users className="h-2.5 w-2.5" />
          {topic.hindsight_total} reflections
        </div>
      </div>
    </Link>
  )
}

function CategoryBar({ cat }: { cat: HindsightCategoryStat }) {
  const color = CATEGORY_COLOR[cat.category] ?? 'text-surface-500'
  return (
    <div className="flex items-center gap-3">
      <span className={cn('text-xs font-mono w-24 flex-shrink-0 truncate', color)}>
        {cat.category}
      </span>
      <div className="flex-1 relative h-5 bg-surface-300/60 rounded overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full bg-emerald/40 rounded-l"
          style={{ width: `${cat.wisdom_score}%` }}
        />
        <div
          className="absolute right-0 top-0 h-full bg-against-500/30 rounded-r"
          style={{ width: `${cat.wisdom_score < 100 ? 100 - cat.wisdom_score : 0}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-semibold text-white">
          {cat.wisdom_score}% right
        </span>
      </div>
      <span className="text-[10px] font-mono text-surface-500 w-8 text-right flex-shrink-0">
        {cat.total}
      </span>
    </div>
  )
}

function RecentEntry({ entry }: { entry: HindsightRecentEntry }) {
  const isRight = entry.verdict === 'right'
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-surface-300/40 last:border-0">
      <Link href={`/profile/${entry.username}`} className="flex-shrink-0">
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size="xs"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <Link
            href={`/profile/${entry.username}`}
            className={cn('text-xs font-mono font-semibold hover:underline', ROLE_COLOR[entry.role] ?? 'text-surface-500')}
          >
            @{entry.username}
          </Link>
          <div className={cn(
            'flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
            isRight
              ? 'text-emerald bg-emerald/10 border-emerald/30'
              : 'text-against-400 bg-against-500/10 border-against-500/30',
          )}>
            {isRight ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
            {isRight ? 'Right call' : 'Wrong call'}
          </div>
          <span className="text-[10px] font-mono text-surface-500">{relativeTime(entry.created_at)}</span>
        </div>
        <Link
          href={`/topic/${entry.topic_id}/hindsight`}
          className="text-xs font-mono text-surface-600 hover:text-surface-400 line-clamp-1 transition-colors"
        >
          {entry.topic_statement}
        </Link>
        {entry.note && (
          <p className="text-xs font-mono text-surface-500 mt-0.5 line-clamp-1 italic">
            &ldquo;{entry.note}&rdquo;
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type ActiveTab = 'regretted' | 'vindicated' | 'contested'

const TABS: { id: ActiveTab; label: string; icon: typeof ThumbsDown; color: string }[] = [
  { id: 'regretted',  label: 'Most Regretted',  icon: ThumbsDown,  color: 'text-against-400' },
  { id: 'vindicated', label: 'Most Vindicated',  icon: ThumbsUp,    color: 'text-emerald'      },
  { id: 'contested',  label: 'Most Contested',   icon: Scale,       color: 'text-gold'         },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function HindsightDashboardClient() {
  const [data, setData] = useState<HindsightDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('regretted')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/hindsight', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load hindsight data')
      const json = await res.json() as HindsightDashboardResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const activeTopics =
    activeTab === 'regretted'
      ? data?.most_regretted ?? []
      : activeTab === 'vindicated'
      ? data?.most_vindicated ?? []
      : data?.most_contested ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <RotateCcw className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Community Hindsight</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Were we right? Collective reflection on resolved civic debates
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <EmptyState
            icon={XCircle}
            title="Failed to load hindsight data"
            description={error}
            actions={[{ label: 'Retry', onClick: load }]}
          />
        ) : !data ? null : (
          <div className="space-y-8">

            {/* Platform-wide stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: 'Total Reflections',
                  value: data.platform.total_hindsight_votes.toLocaleString(),
                  icon: Brain,
                  color: 'text-purple',
                  bg: 'bg-purple/10',
                  border: 'border-purple/30',
                },
                {
                  label: 'Topics Reviewed',
                  value: data.platform.total_topics_with_hindsight.toLocaleString(),
                  icon: BarChart2,
                  color: 'text-for-400',
                  bg: 'bg-for-500/10',
                  border: 'border-for-500/30',
                },
                {
                  label: 'Said "Right Call"',
                  value: data.platform.right_count.toLocaleString(),
                  icon: ThumbsUp,
                  color: 'text-emerald',
                  bg: 'bg-emerald/10',
                  border: 'border-emerald/30',
                },
                {
                  label: 'Said "Wrong Call"',
                  value: data.platform.wrong_count.toLocaleString(),
                  icon: ThumbsDown,
                  color: 'text-against-400',
                  bg: 'bg-against-500/10',
                  border: 'border-against-500/30',
                },
              ].map(({ label, value, icon: Icon, color, bg, border }) => (
                <div
                  key={label}
                  className={cn('rounded-xl border p-4 flex flex-col gap-2', bg, border)}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', color)} />
                    <span className="text-xs font-mono text-surface-500">{label}</span>
                  </div>
                  <span className={cn('text-2xl font-mono font-bold', color)}>{value}</span>
                </div>
              ))}
            </div>

            {/* Wisdom meter + category breakdown */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

              {/* Wisdom meter */}
              <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Sparkles className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-mono font-bold text-white">Platform Wisdom Score</h2>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <WisdomMeter score={data.platform.wisdom_score} />
                  <div className="w-full grid grid-cols-2 gap-3 mt-2">
                    <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-emerald/10 border border-emerald/20">
                      <span className="text-xl font-mono font-bold text-emerald">
                        {data.platform.right_count}
                      </span>
                      <span className="text-[10px] font-mono text-surface-500">Right call votes</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 p-3 rounded-lg bg-against-500/10 border border-against-500/20">
                      <span className="text-xl font-mono font-bold text-against-400">
                        {data.platform.wrong_count}
                      </span>
                      <span className="text-[10px] font-mono text-surface-500">Wrong call votes</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Category breakdown */}
              <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-6">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart2 className="h-4 w-4 text-for-400" />
                  <h2 className="text-sm font-mono font-bold text-white">Wisdom by Category</h2>
                </div>
                {data.categories.length === 0 ? (
                  <p className="text-xs font-mono text-surface-500 text-center py-8">
                    No category data yet
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {data.categories.slice(0, 8).map((cat) => (
                      <CategoryBar key={cat.category} cat={cat} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Topic tabs */}
            <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 overflow-hidden">
              {/* Tab bar */}
              <div className="flex border-b border-surface-300/60">
                {TABS.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-mono font-semibold transition-all',
                        isActive
                          ? cn('border-b-2 border-current -mb-px', tab.color)
                          : 'text-surface-500 hover:text-surface-400',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.id === 'regretted' ? 'Regretted' : tab.id === 'vindicated' ? 'Vindicated' : 'Contested'}</span>
                    </button>
                  )
                })}
              </div>

              {/* Tab description */}
              <div className={cn(
                'px-4 py-2.5 text-[11px] font-mono border-b border-surface-300/40',
                activeTab === 'regretted' ? 'text-against-400/80' : activeTab === 'vindicated' ? 'text-emerald/80' : 'text-gold/80',
              )}>
                {activeTab === 'regretted' && 'Resolved topics where the community most regrets the outcome — highest % of "wrong call" reflections'}
                {activeTab === 'vindicated' && 'Resolved topics where the community feels most confident — highest % of "right call" reflections'}
                {activeTab === 'contested' && 'Resolved topics where citizens remain most divided in hindsight — closest to a 50/50 split'}
              </div>

              {/* Topic grid */}
              <div className="p-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                  >
                    {activeTopics.length === 0 ? (
                      <EmptyState
                        icon={Brain}
                        title="No reflections yet"
                        description="Visit resolved topics and cast your hindsight vote to get started."
                        actions={[{
                          label: 'Browse Resolved Topics',
                          href: '/topics?status=law',
                        }]}
                      />
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {activeTopics.map((topic) => (
                          <TopicCard key={topic.id} topic={topic} mode={activeTab} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Recent activity */}
            <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300/60">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-surface-500" />
                  <h2 className="text-sm font-mono font-bold text-white">Recent Reflections</h2>
                </div>
                <Link
                  href="/topics?status=law"
                  className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  Cast yours <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="px-4 py-1">
                {data.recent.length === 0 ? (
                  <div className="py-8 text-center text-xs font-mono text-surface-500">
                    No recent hindsight votes yet
                  </div>
                ) : (
                  data.recent.map((entry, i) => (
                    <RecentEntry key={`${entry.topic_id}-${entry.username}-${i}`} entry={entry} />
                  ))
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="rounded-xl border border-purple/30 bg-purple/5 p-6 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-mono font-bold text-white mb-1">
                  Add your voice to the retrospective
                </h3>
                <p className="text-xs font-mono text-surface-500">
                  Visit any resolved topic and tell the community: was the right call made?
                  Your wisdom shapes the platform&apos;s collective self-reflection.
                </p>
              </div>
              <Link
                href="/topics?status=law"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple/20 border border-purple/40 text-purple text-sm font-mono font-semibold hover:bg-purple/30 transition-colors flex-shrink-0"
              >
                Browse Laws
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
