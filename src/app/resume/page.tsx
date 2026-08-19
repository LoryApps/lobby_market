'use client'

/**
 * /resume — Civic Resume
 *
 * A shareable, professional-style one-page summary of the logged-in user's
 * civic contributions on Lobby Market. Modelled on a career résumé but for
 * democratic participation:
 *
 *  - Civic identity (archetype, role, member since)
 *  - Key stats (votes, arguments, clout, streak)
 *  - Category breakdown (where they vote and lean)
 *  - Top arguments (most upvoted contributions)
 *  - Law contributions (topics they voted on that became law)
 *  - Achievements (badges earned)
 *  - Debate record
 *  - Prediction accuracy
 *
 * Distinct from /passport (identity card) and /analytics (personal stats hub).
 * The resume is the "LinkedIn profile" equivalent — designed to share with
 * others to show civic credibility.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Coins,
  Download,
  Flame,
  Gavel,
  Globe,
  Link2,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Share2,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { ResumeData, ResumeCategoryBreakdown } from '@/app/api/resume/route'

// ─── Colour helpers ───────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30'      },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30'        },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30'     },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
}

function catStyle(cat: string | null) {
  return cat && CATEGORY_COLOR[cat]
    ? CATEGORY_COLOR[cat]
    : { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

const TIER_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  legendary: { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/40'        },
  epic:      { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/40'      },
  rare:      { text: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/40'     },
  common:    { text: 'text-surface-600', bg: 'bg-surface-200/60', border: 'border-surface-300/60' },
}

function tierStyle(tier: string | null) {
  return tier && TIER_STYLE[tier.toLowerCase()]
    ? TIER_STYLE[tier.toLowerCase()]
    : TIER_STYLE.common
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function fmtClout(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max).trim()}…`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  value,
  label,
  color = 'text-surface-600',
}: {
  icon: React.ComponentType<{ className?: string }>
  value: string | number
  label: string
  color?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200">
      <Icon className={cn('h-4 w-4', color)} />
      <span className={cn('text-xl font-bold font-mono tabular-nums', color)}>{value}</span>
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
    </div>
  )
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 border border-surface-300">
        <Icon className="h-3.5 w-3.5 text-surface-600" />
      </div>
      <h2 className="text-sm font-mono font-bold text-surface-600 uppercase tracking-widest">{title}</h2>
      <div className="flex-1 h-px bg-surface-200" />
    </div>
  )
}

function CategoryBar({ cat }: { cat: ResumeCategoryBreakdown }) {
  const style = catStyle(cat.category)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={cn('text-xs font-mono font-semibold', style.text)}>{cat.category}</span>
        <span className="text-[10px] font-mono text-surface-500 tabular-nums">{cat.votes} votes</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-200 overflow-hidden">
        <div className="h-full flex">
          <div
            className="bg-for-500 rounded-l-full"
            style={{ width: `${cat.pct_for}%` }}
          />
          <div
            className="bg-against-500 rounded-r-full flex-1"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-mono text-for-400 tabular-nums">{cat.pct_for}% For</span>
        <span className="text-[10px] font-mono text-against-400 tabular-nums">{100 - cat.pct_for}% Against</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResumePage() {
  const router = useRouter()
  const [data, setData] = useState<ResumeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/resume')
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error('Failed')
      const json: ResumeData = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  async function copyLink() {
    const url = `${window.location.origin}/passport/${data?.profile.username}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // silent fail
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-12">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-12">
          <EmptyState
            icon={BookOpen}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/20"
            title="Resume not available"
            description="We couldn't load your civic resume. Please try again."
            action={{ label: 'Retry', onClick: load }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const { profile, topArguments, lawContributions, categoryBreakdown, achievements, debateStats, predictionsAccuracy, topicsProposed } = data
  const archetype = profile.civic_archetype
  const winRate = debateStats.total_debates > 0
    ? Math.round((debateStats.debates_won / debateStats.total_debates) * 100)
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Nav bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Analytics
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-surface-200 border border-surface-300 text-surface-600 hover:text-white hover:border-surface-400 transition-all"
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald" /> : <Link2 className="h-3.5 w-3.5" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <Link
              href={`/passport/${profile.username}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-for-600/20 border border-for-600/40 text-for-400 hover:bg-for-600/30 transition-all"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Link>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-6"
        >

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="rounded-2xl bg-surface-100 border border-surface-200 p-5">
            <div className="flex items-start gap-4">
              <Avatar
                src={profile.avatar_url}
                fallback={profile.display_name || profile.username}
                size="lg"
                className="ring-2 ring-surface-300 ring-offset-2 ring-offset-surface-100 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-white leading-tight">
                  {profile.display_name || profile.username}
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  @{profile.username}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="outline" size="sm" className="font-mono capitalize text-for-400 border-for-500/40 bg-for-500/10">
                    {profile.role}
                  </Badge>
                  {archetype && (
                    <Badge variant="outline" size="sm" className="font-mono text-purple border-purple/40 bg-purple/10">
                      {archetype}
                    </Badge>
                  )}
                  <span className="text-[11px] font-mono text-surface-500">
                    Member since {memberSince(profile.member_since)}
                  </span>
                </div>

                {profile.bio && (
                  <p className="mt-3 text-sm text-surface-600 leading-relaxed">
                    {truncate(profile.bio, 200)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Key stats ────────────────────────────────────────────────────── */}
          <div>
            <SectionHeader title="Civic Stats" icon={BarChart2} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill icon={Vote}    value={profile.total_votes.toLocaleString()} label="Votes cast"    color="text-for-400" />
              <StatPill icon={Coins}   value={fmtClout(profile.clout)}              label="Clout"         color="text-gold" />
              <StatPill icon={MessageSquare} value={profile.total_arguments.toLocaleString()} label="Arguments" color="text-purple" />
              <StatPill icon={Flame}   value={profile.vote_streak}                  label="Day streak"    color="text-against-400" />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <StatPill icon={Users}   value={profile.followers_count.toLocaleString()} label="Followers" color="text-emerald" />
              <StatPill icon={TrendingUp} value={topicsProposed.toLocaleString()}    label="Proposed"      color="text-for-300" />
              {predictionsAccuracy !== null ? (
                <StatPill icon={Target} value={`${predictionsAccuracy}%`}            label="Accuracy"      color="text-gold" />
              ) : (
                <StatPill icon={Mic}   value={debateStats.total_debates}             label="Debates"       color="text-purple" />
              )}
            </div>
          </div>

          {/* ── Category breakdown ────────────────────────────────────────────── */}
          {categoryBreakdown.length > 0 && (
            <div>
              <SectionHeader title="Policy Focus" icon={Globe} />
              <div className="rounded-xl bg-surface-100 border border-surface-200 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categoryBreakdown.map((cat) => (
                  <CategoryBar key={cat.category} cat={cat} />
                ))}
              </div>
            </div>
          )}

          {/* ── Top arguments ─────────────────────────────────────────────────── */}
          {topArguments.length > 0 && (
            <div>
              <SectionHeader title="Top Arguments" icon={MessageSquare} />
              <div className="space-y-3">
                {topArguments.map((arg, i) => {
                  const cs = catStyle(arg.topic_category)
                  return (
                    <motion.div
                      key={arg.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link href={`/topic/${arg.topic_id}`} className="block">
                        <div className="rounded-xl bg-surface-100 border border-surface-200 p-4 hover:border-surface-300 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              'flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center mt-0.5',
                              arg.side === 'blue'
                                ? 'bg-for-500/10 border border-for-500/30'
                                : 'bg-against-500/10 border border-against-500/30'
                            )}>
                              {arg.side === 'blue'
                                ? <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                                : <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-surface-700 leading-relaxed">
                                {truncate(arg.content, 140)}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                {arg.topic_category && (
                                  <span className={cn('text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border', cs.text, cs.bg, cs.border)}>
                                    {arg.topic_category}
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-surface-500 truncate">
                                  {truncate(arg.topic_statement, 60)}
                                </span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-1 text-xs font-mono text-gold">
                              <Star className="h-3 w-3" />
                              {arg.upvotes}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Law contributions ─────────────────────────────────────────────── */}
          {lawContributions.length > 0 && (
            <div>
              <SectionHeader title="Law Contributions" icon={Gavel} />
              <div className="space-y-2">
                {lawContributions.map((law) => {
                  const cs = catStyle(law.category)
                  const votedFor = law.user_voted === 'blue'
                  return (
                    <Link key={law.law_id} href={`/topic/${law.law_id}`}>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-200 hover:border-gold/30 hover:bg-gold/5 transition-all">
                        <div className="flex-shrink-0 h-7 w-7 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
                          <Gavel className="h-3.5 w-3.5 text-gold" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-surface-700 truncate">
                            {law.statement}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {law.category && (
                              <span className={cn('text-[10px] font-mono font-semibold', cs.text)}>
                                {law.category}
                              </span>
                            )}
                            <span className={cn(
                              'text-[10px] font-mono',
                              votedFor ? 'text-for-400' : 'text-against-400'
                            )}>
                              Voted {votedFor ? 'FOR' : 'AGAINST'}
                            </span>
                          </div>
                        </div>
                        <ArrowUpRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Debate record ─────────────────────────────────────────────────── */}
          {debateStats.total_debates > 0 && (
            <div>
              <SectionHeader title="Debate Record" icon={Mic} />
              <div className="rounded-xl bg-surface-100 border border-surface-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <div className="text-3xl font-bold font-mono text-white tabular-nums">
                      {debateStats.total_debates}
                    </div>
                    <div className="text-xs font-mono text-surface-500 mt-1 uppercase tracking-wider">Debates</div>
                  </div>
                  <div className="h-12 w-px bg-surface-300" />
                  <div className="text-center">
                    <div className="text-3xl font-bold font-mono text-emerald tabular-nums">
                      {debateStats.debates_won}
                    </div>
                    <div className="text-xs font-mono text-surface-500 mt-1 uppercase tracking-wider">Wins</div>
                  </div>
                  <div className="h-12 w-px bg-surface-300" />
                  <div className="text-center">
                    <div className="text-3xl font-bold font-mono text-gold tabular-nums">
                      {winRate !== null ? `${winRate}%` : '—'}
                    </div>
                    <div className="text-xs font-mono text-surface-500 mt-1 uppercase tracking-wider">Win rate</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Achievements ──────────────────────────────────────────────────── */}
          {achievements.length > 0 && (
            <div>
              <SectionHeader title="Achievements" icon={Trophy} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {achievements.map((ach) => {
                  const ts = tierStyle(ach.tier)
                  return (
                    <div
                      key={ach.id}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border',
                        ts.bg,
                        ts.border,
                      )}
                    >
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', ts.bg, 'border', ts.border)}>
                        <Award className={cn('h-4 w-4', ts.text)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm font-semibold leading-tight', ts.text)}>
                          {ach.title}
                        </p>
                        {ach.tier && (
                          <span className={cn('text-[10px] font-mono uppercase tracking-wider', ts.text, 'opacity-70')}>
                            {ach.tier}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <Link
                href="/achievements"
                className="flex items-center gap-1.5 mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                View all achievements <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* ── Footer links ─────────────────────────────────────────────────── */}
          <div className="pt-2 border-t border-surface-200">
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/profile/${profile.username}`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                Full profile <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/analytics"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                Analytics <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/achievements"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                Achievements <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href={`/passport/${profile.username}`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                Civic Passport <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

        </motion.div>
      </main>

      <BottomNav />
    </div>
  )
}
