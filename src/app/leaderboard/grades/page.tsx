'use client'

/**
 * /leaderboard/grades — Argument Quality Leaderboard
 *
 * Ranks debaters by their average AI argument grade (A–F / 1–10).
 * Built on the persistent ai_score + ai_grade columns added in Ch. 34.
 *
 * Three views:
 *   By Grade    — sorted by average AI score (requires ≥2 graded args)
 *   By Volume   — sorted by most AI-graded arguments
 *   Platform    — aggregate grade distribution + category quality table
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Brain,
  CheckCircle2,
  ChevronRight,
  Crown,
  Layers,
  Medal,
  RefreshCw,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  GradeDebater,
  GradeDistribution,
  CategoryQuality,
  GradesLeaderboardResponse,
} from '@/app/api/leaderboard/grades/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtScore(s: number): string {
  return s.toFixed(1)
}

function rankMedal(rank: number): string | null {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return null
}

const GRADE_STYLE: Record<string, { text: string; bg: string; border: string; bar: string }> = {
  A: {
    text: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    bar: 'bg-emerald',
  },
  B: {
    text: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-500',
  },
  C: {
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    bar: 'bg-gold',
  },
  D: {
    text: 'text-against-400',
    bg: 'bg-against-900/30',
    border: 'border-against-500/30',
    bar: 'bg-against-500',
  },
  F: {
    text: 'text-surface-500',
    bg: 'bg-surface-200/60',
    border: 'border-surface-400/30',
    bar: 'bg-surface-400',
  },
}

function gradeFromScore(avg: number): string {
  if (avg >= 9) return 'A+'
  if (avg >= 8.5) return 'A'
  if (avg >= 7.5) return 'B+'
  if (avg >= 7) return 'B'
  if (avg >= 6) return 'C+'
  if (avg >= 5) return 'C'
  if (avg >= 4) return 'D'
  return 'F'
}

function gradeKey(avg: number): string {
  if (avg >= 7.5) return 'A'
  if (avg >= 6) return 'B'
  if (avg >= 4.5) return 'C'
  if (avg >= 3) return 'D'
  return 'F'
}

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  person: { label: 'Citizen', color: 'text-surface-500' },
  debator: { label: 'Debator', color: 'text-for-400' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  elder: { label: 'Elder', color: 'text-gold' },
  lawmaker: { label: 'Lawmaker', color: 'text-for-300' },
  senator: { label: 'Senator', color: 'text-purple' },
}

const CAT_ICON: Record<string, string> = {
  Economics: '📈',
  Politics: '🏛️',
  Technology: '💻',
  Science: '🔬',
  Ethics: '⚖️',
  Philosophy: '🧠',
  Culture: '🎭',
  Health: '❤️',
  Environment: '🌿',
  Education: '🎓',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DebaterRow({
  debater,
  showVolume,
}: {
  debater: GradeDebater
  showVolume: boolean
}) {
  const medal = rankMedal(debater.rank)
  const gKey = gradeKey(debater.avg_score)
  const style = GRADE_STYLE[gKey] ?? GRADE_STYLE['C']
  const avgLabel = gradeFromScore(debater.avg_score)
  const role = ROLE_BADGE[debater.role] ?? ROLE_BADGE['person']

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <Link
        href={`/profile/${debater.username}`}
        className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-surface-400/80 hover:bg-surface-200/60 transition-all group"
      >
        {/* Rank */}
        <div className="w-7 flex-shrink-0 text-center">
          {medal ? (
            <span className="text-base leading-none">{medal}</span>
          ) : (
            <span className="text-xs font-mono text-surface-500 font-semibold">
              #{debater.rank}
            </span>
          )}
        </div>

        {/* Avatar */}
        <Avatar
          src={debater.avatar_url}
          fallback={debater.display_name || debater.username}
          size="sm"
        />

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-white truncate">
              {debater.display_name || debater.username}
            </span>
            <span className={cn('text-[10px] font-mono hidden sm:inline', role.color)}>
              {role.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-mono text-surface-500">@{debater.username}</span>
            <span className="text-[10px] font-mono text-surface-600">·</span>
            <span className="text-[11px] font-mono text-surface-500">
              {debater.graded_count} {debater.graded_count === 1 ? 'grade' : 'grades'}
            </span>
          </div>
        </div>

        {/* Grade badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!showVolume && (
            <span className="text-[11px] font-mono text-surface-500 hidden sm:inline">
              {fmtScore(debater.avg_score)}/10
            </span>
          )}
          <div
            className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center border font-mono font-bold text-sm',
              style.bg,
              style.border,
              style.text
            )}
          >
            {showVolume ? debater.graded_count : avgLabel}
          </div>
        </div>

        <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

function GradeBar({ dist }: { dist: GradeDistribution[] }) {
  return (
    <div className="space-y-2">
      {dist.map((d) => {
        const style = GRADE_STYLE[d.grade] ?? GRADE_STYLE['C']
        return (
          <div key={d.grade} className="flex items-center gap-3">
            <div
              className={cn(
                'w-7 h-7 rounded-md flex items-center justify-center border font-mono font-bold text-xs flex-shrink-0',
                style.bg,
                style.border,
                style.text
              )}
            >
              {d.grade}
            </div>
            <div className="flex-1 bg-surface-300 rounded-full h-2 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', style.bar)}
                style={{ width: `${d.pct}%` }}
              />
            </div>
            <div className="w-16 text-right">
              <span className="text-xs font-mono text-surface-400">{d.count.toLocaleString()}</span>
              <span className="text-[10px] font-mono text-surface-600 ml-1">({d.pct}%)</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CategoryRow({ cat }: { cat: CategoryQuality }) {
  const gKey = gradeKey(cat.avg_score)
  const style = GRADE_STYLE[gKey] ?? GRADE_STYLE['C']
  const avgLabel = gradeFromScore(cat.avg_score)
  const icon = CAT_ICON[cat.category] ?? '📋'

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-200/40 border border-surface-300/40">
      <span className="text-base leading-none w-6 text-center flex-shrink-0">{icon}</span>
      <span className="flex-1 text-xs font-mono text-white font-medium truncate">
        {cat.category}
      </span>
      <span className="text-[10px] font-mono text-surface-500 hidden sm:inline">
        {cat.graded_count} graded
      </span>
      <div
        className={cn(
          'h-6 px-2 rounded-md flex items-center justify-center border font-mono font-bold text-xs flex-shrink-0',
          style.bg,
          style.border,
          style.text
        )}
      >
        {avgLabel}
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface-100 border border-surface-300/40">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'grade' | 'volume' | 'platform'

export default function GradesLeaderboardPage() {
  const [data, setData] = useState<GradesLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<Tab>('grade')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/leaderboard/grades')
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as GradesLeaderboardResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const rows = tab === 'grade'
    ? (data?.topByGrade ?? [])
    : tab === 'volume'
    ? (data?.topByVolume ?? [])
    : []

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Back to Leaderboard"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-mono font-bold text-white flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple" />
              Argument Quality
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              AI-graded argument rankings — who argues best?
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-surface-400', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Platform stats strip */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-4 gap-2 mb-6"
          >
            {[
              {
                label: 'Graded',
                value: data.platformStats.total_graded.toLocaleString(),
                icon: CheckCircle2,
                color: 'text-emerald',
                bg: 'bg-emerald/5',
                border: 'border-emerald/20',
              },
              {
                label: 'Avg Grade',
                value: data.platformStats.avg_platform_grade,
                icon: Star,
                color: 'text-gold',
                bg: 'bg-gold/5',
                border: 'border-gold/20',
              },
              {
                label: 'Debaters',
                value: data.platformStats.debaters_qualified.toLocaleString(),
                icon: Trophy,
                color: 'text-purple',
                bg: 'bg-purple/5',
                border: 'border-purple/20',
              },
              {
                label: '% Graded',
                value: `${data.platformStats.pct_graded}%`,
                icon: BarChart2,
                color: 'text-for-400',
                bg: 'bg-for-500/5',
                border: 'border-for-500/20',
              },
            ].map(({ label, value, icon: Icon, color, bg, border }) => (
              <div
                key={label}
                className={cn('rounded-xl p-3 border text-center', bg, border)}
              >
                <Icon className={cn('h-3.5 w-3.5 mx-auto mb-1', color)} />
                <p className="text-sm font-mono font-bold text-white leading-none">{value}</p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-surface-200 rounded-xl border border-surface-300">
          {(
            [
              { id: 'grade', label: 'By Grade', icon: Crown },
              { id: 'volume', label: 'By Volume', icon: Layers },
              { id: 'platform', label: 'Platform', icon: BarChart2 },
            ] as { id: Tab; label: string; icon: typeof Crown }[]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                tab === id
                  ? 'bg-surface-100 text-white border border-surface-300'
                  : 'text-surface-500 hover:text-white'
              )}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={Zap}
                iconColor="text-against-400"
                iconBg="bg-against-900/30"
                iconBorder="border-against-500/30"
                title="Couldn't load rankings"
                description="Refresh to try again."
                actions={[{ label: 'Retry', onClick: load }]}
                size="sm"
              />
            </motion.div>
          ) : tab === 'platform' ? (
            <motion.div
              key="platform"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Grade distribution */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="h-4 w-4 text-for-400" />
                  <h2 className="text-sm font-mono font-semibold text-white">Grade Distribution</h2>
                </div>
                {(data?.gradeDistribution ?? []).length === 0 ? (
                  <p className="text-xs font-mono text-surface-500 text-center py-4">
                    No graded arguments yet.
                  </p>
                ) : (
                  <GradeBar dist={data?.gradeDistribution ?? []} />
                )}
                <p className="text-[10px] font-mono text-surface-600 mt-3 text-center">
                  Based on {(data?.platformStats.total_graded ?? 0).toLocaleString()} AI-graded arguments
                </p>
              </div>

              {/* Category quality */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-mono font-semibold text-white">Quality by Category</h2>
                </div>
                {(data?.categoryQuality ?? []).length === 0 ? (
                  <p className="text-xs font-mono text-surface-500 text-center py-4">
                    No category data yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data?.categoryQuality.map((cat) => (
                      <CategoryRow key={cat.category} cat={cat} />
                    ))}
                  </div>
                )}
              </div>

              {/* How grades work */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="h-4 w-4 text-purple" />
                  <h2 className="text-sm font-mono font-semibold text-white">How Grades Work</h2>
                </div>
                <div className="space-y-2">
                  {[
                    { grade: 'A', range: '8.5–10', desc: 'Exceptional — clear, well-evidenced, highly persuasive' },
                    { grade: 'B', range: '7–8.4', desc: 'Strong — logically sound with good supporting points' },
                    { grade: 'C', range: '5–6.9', desc: 'Adequate — makes the case but lacks depth or evidence' },
                    { grade: 'D', range: '3–4.9', desc: 'Weak — thin reasoning or significant logical gaps' },
                    { grade: 'F', range: '1–2.9', desc: 'Poor — does not meaningfully advance the debate' },
                  ].map(({ grade, range, desc }) => {
                    const style = GRADE_STYLE[grade]
                    return (
                      <div key={grade} className="flex items-start gap-3">
                        <div
                          className={cn(
                            'h-6 w-6 rounded-md flex items-center justify-center border font-mono font-bold text-xs flex-shrink-0 mt-0.5',
                            style.bg,
                            style.border,
                            style.text
                          )}
                        >
                          {grade}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-surface-500 font-semibold">{range}</span>
                          </div>
                          <p className="text-[11px] font-mono text-surface-400 mt-0.5">{desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-surface-300">
                  <p className="text-[10px] font-mono text-surface-600 text-center">
                    Grades are assigned by Claude after you run the AI critique on your argument.{' '}
                    <Link href="/coach" className="text-for-400 hover:underline">
                      Practice in the Argument Coach →
                    </Link>
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {rows.length === 0 ? (
                <EmptyState
                  icon={Medal}
                  iconColor="text-gold"
                  iconBg="bg-gold/10"
                  iconBorder="border-gold/30"
                  title="No ranked debaters yet"
                  description={`Debaters need at least 2 AI-graded arguments to appear here. ${tab === 'grade' ? 'Run the AI critique on your arguments to get graded.' : ''}`}
                  actions={[
                    { label: 'Practice in Coach', href: '/coach', variant: 'primary' },
                    { label: 'Debate now', href: '/', variant: 'secondary' },
                  ]}
                  size="md"
                />
              ) : (
                <div className="space-y-2">
                  {/* Column header */}
                  <div className="flex items-center gap-3 px-4 pb-1">
                    <div className="w-7 text-[10px] font-mono text-surface-600 text-center">Rank</div>
                    <div className="w-8 flex-shrink-0" />
                    <div className="flex-1 text-[10px] font-mono text-surface-600 uppercase tracking-wide">
                      Debater
                    </div>
                    <div className="text-[10px] font-mono text-surface-600 uppercase tracking-wide pr-7">
                      {tab === 'grade' ? 'Avg Grade' : 'Graded'}
                    </div>
                  </div>

                  {rows.map((debater) => (
                    <DebaterRow
                      key={debater.user_id}
                      debater={debater}
                      showVolume={tab === 'volume'}
                    />
                  ))}

                  {rows.length >= 50 && (
                    <p className="text-center text-xs font-mono text-surface-600 pt-2 pb-1">
                      Showing top 50 · Keep arguing to climb the ranks
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        <div className="mt-8 rounded-2xl bg-purple/5 border border-purple/20 p-5 text-center">
          <Brain className="h-8 w-8 text-purple mx-auto mb-3" />
          <p className="text-sm font-mono font-semibold text-white mb-1">
            Improve your grade
          </p>
          <p className="text-xs font-mono text-surface-500 mb-4">
            Use the AI Argument Coach to practice and get feedback before posting.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/coach"
              className="px-4 py-2 rounded-lg bg-purple/20 border border-purple/30 text-purple text-xs font-mono font-semibold hover:bg-purple/30 transition-colors"
            >
              Open Coach
            </Link>
            <Link
              href="/top-arguments"
              className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-xs font-mono hover:text-white hover:border-surface-400 transition-colors"
            >
              Top Arguments
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
