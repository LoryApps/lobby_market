'use client'

/**
 * /law/wiki — Law Codex Wiki Hub
 *
 * Landing page for the collaborative Law Codex wiki. Shows:
 *   • Coverage stats (how many laws have wiki articles)
 *   • Category breakdown by coverage percentage
 *   • Top wiki contributors
 *   • Quick links to recent edits and laws needing articles
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BookOpen,
  Edit3,
  Gavel,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawWikiStats, WikiCategoryBreakdown, TopContributor } from '@/app/api/law/wiki/stats/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function coverageColor(pct: number): string {
  if (pct >= 75) return 'text-emerald'
  if (pct >= 40) return 'text-gold'
  return 'text-against-400'
}

function coverageBg(pct: number): string {
  if (pct >= 75) return 'bg-emerald'
  if (pct >= 40) return 'bg-gold'
  return 'bg-against-400'
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof BookOpen
  color: string
}) {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-100 p-4">
      <div className={cn('flex items-center gap-2 mb-2', color)}>
        <Icon className="h-4 w-4" />
        <span className="text-xs font-mono uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-mono font-bold text-white">{value}</p>
      {sub && <p className="text-xs font-mono text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function CategoryRow({ cat }: { cat: WikiCategoryBreakdown }) {
  const barWidth = Math.max(4, cat.coverage_pct)
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-36 shrink-0">
        <p className="text-sm font-mono text-white truncate">{cat.category}</p>
        <p className="text-xs font-mono text-surface-500">
          {cat.with_wiki}/{cat.total} laws
        </p>
      </div>
      <div className="flex-1 h-2 rounded-full bg-surface-200 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', coverageBg(cat.coverage_pct))}
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className={cn('w-10 text-right text-sm font-mono font-bold shrink-0', coverageColor(cat.coverage_pct))}>
        {cat.coverage_pct}%
      </span>
    </div>
  )
}

function ContributorCard({ contributor, rank }: { contributor: TopContributor; rank: number }) {
  return (
    <Link
      href={`/profile/${contributor.username}`}
      className="flex items-center gap-3 p-3 rounded-xl border border-surface-200 bg-surface-100 hover:bg-surface-200 transition-colors"
    >
      <div className="relative shrink-0">
        <Avatar
          src={contributor.avatar_url}
          username={contributor.username}
          size="sm"
        />
        {rank <= 3 && (
          <div className={cn(
            'absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-bold',
            rank === 1 ? 'bg-gold text-black' : rank === 2 ? 'bg-surface-400 text-white' : 'bg-amber-700 text-white'
          )}>
            {rank}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono font-medium text-white truncate">
          {contributor.display_name ?? contributor.username}
        </p>
        <p className="text-xs font-mono text-surface-500">
          {contributor.edit_count} edit{contributor.edit_count !== 1 ? 's' : ''} ·{' '}
          {contributor.chars_contributed.toLocaleString()} chars added
        </p>
      </div>
      <Badge variant="outline" className="shrink-0 text-xs font-mono text-surface-400">
        #{rank}
      </Badge>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawWikiHubPage() {
  const [stats, setStats] = useState<LawWikiStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/law/wiki/stats')
      if (!res.ok) throw new Error('Failed to load wiki stats')
      setStats(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <BookOpen className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Law Codex Wiki</h1>
              <p className="text-sm font-mono text-surface-500">Community knowledge base for established laws</p>
            </div>
          </div>
          <p className="text-surface-400 text-sm font-mono leading-relaxed max-w-2xl">
            Every law passed through civic consensus deserves a rich article — context, history, real-world impact, and debate analysis.
            Help document the laws you care about.
          </p>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-3 mt-5">
            <Link
              href="/law/wiki/recent"
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-for-500/10 border border-for-500/30 text-for-400 hover:bg-for-500/20 transition-colors text-sm font-mono"
            >
              <Edit3 className="h-4 w-4" />
              Recent Edits
            </Link>
            <Link
              href="/law/wiki/missing"
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-gold/10 border border-gold/30 text-gold hover:bg-gold/20 transition-colors text-sm font-mono"
            >
              <PenLine className="h-4 w-4" />
              Laws Needing Articles
            </Link>
            <Link
              href="/law"
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors text-sm font-mono"
            >
              <Gavel className="h-4 w-4" />
              Browse Codex
            </Link>
          </div>
        </motion.div>

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="mb-8 rounded-xl border border-surface-200 bg-surface-100 p-6 text-center">
            <p className="text-surface-500 font-mono text-sm mb-3">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 mx-auto text-sm font-mono text-for-400 hover:text-for-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : stats ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
              <StatCard
                label="Coverage"
                value={`${stats.coverage_pct}%`}
                sub={`${stats.laws_with_wiki} of ${stats.total_laws} laws`}
                icon={TrendingUp}
                color={coverageColor(stats.coverage_pct)}
              />
              <StatCard
                label="Total Edits"
                value={stats.total_edits.toLocaleString()}
                sub={`${stats.editors_count} contributor${stats.editors_count !== 1 ? 's' : ''}`}
                icon={Edit3}
                color="text-for-400"
              />
              <StatCard
                label="Avg Length"
                value={`${stats.avg_wiki_length.toLocaleString()} ch`}
                sub="per wiki article"
                icon={Sparkles}
                color="text-purple"
              />
              <StatCard
                label="Uncovered"
                value={(stats.total_laws - stats.laws_with_wiki).toLocaleString()}
                sub="laws need articles"
                icon={PenLine}
                color="text-gold"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* ── Category breakdown ─────────────────────────────────── */}
              <section>
                <h2 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Coverage by Category
                </h2>
                <div className="rounded-xl border border-surface-200 bg-surface-100 divide-y divide-surface-200/60">
                  {stats.categories.slice(0, 10).map((cat) => (
                    <div key={cat.category} className="px-4">
                      <CategoryRow cat={cat} />
                    </div>
                  ))}
                  {stats.categories.length === 0 && (
                    <p className="px-4 py-6 text-center text-surface-500 font-mono text-sm">No category data yet</p>
                  )}
                </div>

                {/* CTA to fill gaps */}
                <Link
                  href="/law/wiki/missing"
                  className="mt-3 flex items-center justify-between gap-2 w-full px-4 py-3 rounded-xl border border-gold/20 bg-gold/5 hover:bg-gold/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <PenLine className="h-4 w-4 text-gold" />
                    <span className="text-sm font-mono text-gold">
                      {stats.total_laws - stats.laws_with_wiki} laws still need articles
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gold" />
                </Link>
              </section>

              {/* ── Top contributors ───────────────────────────────────── */}
              <section>
                <h2 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Top Contributors
                </h2>
                {stats.top_contributors.length === 0 ? (
                  <div className="rounded-xl border border-surface-200 bg-surface-100 p-8 text-center">
                    <Users className="h-8 w-8 text-surface-600 mx-auto mb-3" />
                    <p className="text-surface-500 font-mono text-sm">No contributors yet</p>
                    <p className="text-surface-600 font-mono text-xs mt-1">Be the first to edit a law wiki!</p>
                    <Link
                      href="/law/wiki/missing"
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-mono text-for-400 hover:text-for-300"
                    >
                      <PenLine className="h-3.5 w-3.5" />
                      Start contributing
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {stats.top_contributors.map((c, i) => (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                      >
                        <ContributorCard contributor={c} rank={i + 1} />
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* How it works */}
                <div className="mt-4 rounded-xl border border-surface-200 bg-surface-100 p-4">
                  <h3 className="font-mono text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                    How wiki editing works
                  </h3>
                  <ul className="space-y-1.5 text-xs font-mono text-surface-500">
                    <li className="flex items-start gap-2">
                      <span className="text-for-400 mt-0.5">1.</span>
                      Browse any established law in the Codex
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-for-400 mt-0.5">2.</span>
                      Click the Wiki tab to view or edit its article
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-for-400 mt-0.5">3.</span>
                      Write in Markdown — context, history, impact
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-for-400 mt-0.5">4.</span>
                      Earn Clout for every accepted edit
                    </li>
                  </ul>
                </div>
              </section>
            </div>
          </>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
