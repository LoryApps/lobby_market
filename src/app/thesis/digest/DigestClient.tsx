'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BookOpen,
  CircleDot,
  RefreshCw,
  Scale,
  Scroll,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DigestResponse, DigestThesis, TopForecaster } from '@/app/api/thesis/digest/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  economics: 'text-gold border-gold/40 bg-gold/10',
  politics: 'text-for-400 border-for-500/40 bg-for-500/10',
  technology: 'text-purple border-purple/40 bg-purple/10',
  science: 'text-emerald border-emerald/40 bg-emerald/10',
  ethics: 'text-against-400 border-against-500/40 bg-against-500/10',
  philosophy: 'text-surface-400 border-surface-400/40 bg-surface-300/20',
  culture: 'text-pink-400 border-pink-500/40 bg-pink-500/10',
  health: 'text-green-400 border-green-500/40 bg-green-500/10',
  environment: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
  education: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
}

function catColor(cat: string) {
  return CAT_COLORS[cat] ?? 'text-surface-400 border-surface-300/40 bg-surface-200/40'
}

function agreeRatio(t: DigestThesis) {
  const total = t.agree_count + t.disagree_count
  return total > 0 ? Math.round((t.agree_count / total) * 100) : 50
}

// ─── Thesis Row ───────────────────────────────────────────────────────────────

function ThesisRow({
  thesis,
  rank,
  accent,
}: {
  thesis: DigestThesis
  rank?: number
  accent?: string
}) {
  const total = thesis.agree_count + thesis.disagree_count
  const agrPct = agreeRatio(thesis)

  return (
    <Link href={`/thesis/${thesis.id}`} className="block group">
      <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/40 hover:border-surface-400/60 transition-colors">
        {rank !== undefined && (
          <span
            className={cn(
              'flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold mt-0.5',
              accent ?? 'bg-surface-300 text-surface-500'
            )}
          >
            {rank}
          </span>
        )}

        <div className="flex-1 min-w-0 space-y-2">
          {/* Author row */}
          <div className="flex items-center gap-2">
            {thesis.author && (
              <>
                <Avatar
                  src={thesis.author.avatar_url}
                  fallback={thesis.author.display_name || thesis.author.username}
                  size="xs"
                />
                <span className="text-[11px] text-surface-500 truncate">
                  @{thesis.author.username}
                </span>
              </>
            )}
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 capitalize', catColor(thesis.category))}>
              {thesis.category}
            </Badge>
          </div>

          {/* Statement */}
          <p className="text-sm text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            "{thesis.statement}"
          </p>

          {/* Engagement bar */}
          {total > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px]">
                <ThumbsUp className="h-3 w-3 text-for-400" />
                <span className="text-for-400 font-mono">{thesis.agree_count}</span>
                <div className="flex-1 h-1 rounded-full bg-surface-300/60 overflow-hidden">
                  <div
                    className="h-full bg-for-500 rounded-full"
                    style={{ width: `${agrPct}%` }}
                  />
                </div>
                <span className="text-against-400 font-mono">{thesis.disagree_count}</span>
                <ThumbsDown className="h-3 w-3 text-against-400" />
              </div>
            </div>
          )}
        </div>

        <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </Link>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  color,
  children,
  empty,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  children: React.ReactNode
  empty?: boolean
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <h2 className={cn('text-sm font-semibold', color)}>{title}</h2>
      </div>
      {empty ? (
        <EmptyState
          icon={BookOpen}
          title="Nothing yet this week"
          description="Check back as more civic theses are published and resolved."
        />
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  )
}

// ─── Forecaster Row ───────────────────────────────────────────────────────────

function ForecasterRow({ user, rank }: { user: TopForecaster; rank: number }) {
  return (
    <Link href={`/profile/${user.username}`} className="block group">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/40 hover:border-surface-400/60 transition-colors">
        <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-xs font-mono font-bold text-gold">
          {rank}
        </span>
        <Avatar
          src={user.avatar_url}
          fallback={user.display_name || user.username}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {user.display_name || `@${user.username}`}
          </p>
          <p className="text-[11px] text-surface-500">
            {user.vindicated_count} vindicated · {user.accuracy_pct}% accuracy
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-mono text-gold">{user.accuracy_pct}%</p>
          <p className="text-[10px] text-surface-600">{user.total_resolved} resolved</p>
        </div>
      </div>
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DigestSkeleton() {
  return (
    <div className="space-y-8 px-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-4 w-36" />
          {[...Array(3)].map((_, j) => (
            <Skeleton key={j} className="h-20 rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function DigestClient() {
  const [digest, setDigest] = useState<DigestResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/thesis/digest', { cache: 'no-store' })
      if (res.ok) setDigest(await res.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <TopBar />
      <main className="flex-1 pt-14 pb-24">
        {/* Header */}
        <div className="px-4 pt-5 pb-4 border-b border-surface-200/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Scroll className="h-4 w-4 text-gold" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-gold">
                  Thesis Digest
                </span>
              </div>
              <h1 className="text-xl font-bold text-white">
                {loading ? (
                  <Skeleton className="h-6 w-48" />
                ) : (
                  digest?.week_label ?? 'This Week'
                )}
              </h1>
              <p className="text-xs text-surface-500 mt-0.5">
                The best civic predictions, vindicated or contested
              </p>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh digest"
              className="p-2 rounded-lg bg-surface-200/60 border border-surface-300/40 hover:border-surface-400/60 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4 text-surface-400', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Stats bar */}
          {!loading && digest && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 mt-3 text-[11px] text-surface-500"
            >
              <div className="flex items-center gap-1">
                <Scroll className="h-3 w-3" />
                <span><span className="text-white font-mono">{digest.stats.total_published_week}</span> published</span>
              </div>
              <div className="flex items-center gap-1">
                <Trophy className="h-3 w-3 text-gold" />
                <span><span className="text-gold font-mono">{digest.stats.total_vindicated_week}</span> vindicated</span>
              </div>
              <div className="flex items-center gap-1">
                <CircleDot className="h-3 w-3 text-for-400" />
                <span><span className="text-for-400 font-mono">{digest.stats.total_active}</span> live</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Body */}
        <div className="px-4 pt-5 space-y-8">
          {loading ? (
            <DigestSkeleton />
          ) : !digest ? (
            <EmptyState
              icon={Scroll}
              title="Digest unavailable"
              description="Could not load the weekly thesis digest. Try again."
            />
          ) : (
            <>
              {/* Vindicated */}
              <Section
                title="Vindicated This Week"
                icon={Trophy}
                color="text-gold"
                empty={digest.vindicated.length === 0}
              >
                {digest.vindicated.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <ThesisRow thesis={t} rank={i + 1} accent="bg-gold/10 text-gold" />
                  </motion.div>
                ))}
              </Section>

              {/* Most Agreed */}
              <Section
                title="Most Agreed This Week"
                icon={ThumbsUp}
                color="text-for-400"
                empty={digest.most_agreed.length === 0}
              >
                {digest.most_agreed.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <ThesisRow thesis={t} rank={i + 1} accent="bg-for-500/10 text-for-400" />
                  </motion.div>
                ))}
              </Section>

              {/* Controversial */}
              <Section
                title="Most Contested"
                icon={Scale}
                color="text-purple"
                empty={digest.controversial.length === 0}
              >
                {digest.controversial.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <ThesisRow thesis={t} rank={i + 1} accent="bg-purple/10 text-purple" />
                  </motion.div>
                ))}
              </Section>

              {/* Rising */}
              <Section
                title="Rising Theses"
                icon={TrendingUp}
                color="text-emerald"
                empty={digest.rising.length === 0}
              >
                {digest.rising.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <ThesisRow thesis={t} rank={i + 1} accent="bg-emerald/10 text-emerald" />
                  </motion.div>
                ))}
              </Section>

              {/* Top Forecasters */}
              <Section
                title="Top Forecasters"
                icon={Award}
                color="text-gold"
                empty={digest.top_forecasters.length === 0}
              >
                {digest.top_forecasters.map((f, i) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <ForecasterRow user={f} rank={i + 1} />
                  </motion.div>
                ))}
              </Section>

              {/* CTA */}
              <div className="border border-surface-300/40 rounded-2xl p-5 bg-surface-200/40 text-center space-y-3">
                <Sparkles className="h-6 w-6 text-gold mx-auto" />
                <p className="text-sm font-semibold text-white">
                  Have a civic prediction?
                </p>
                <p className="text-xs text-surface-500">
                  Publish a thesis and stake your reputation on it.
                  The community will agree or disagree — and history will judge.
                </p>
                <Link
                  href="/thesis"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600/80 hover:bg-for-600 text-white text-sm font-semibold transition-colors"
                >
                  <Scroll className="h-4 w-4" />
                  Write a Thesis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Back link */}
              <div className="flex justify-center">
                <Link
                  href="/thesis"
                  className="text-xs text-surface-500 hover:text-surface-400 transition-colors flex items-center gap-1"
                >
                  <ArrowRight className="h-3 w-3 rotate-180" />
                  All theses
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
