'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  BarChart2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Flame,
  Gavel,
  Globe,
  MessageSquare,
  Printer,
  Share2,
  ThumbsUp,
  Vote,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ARCHETYPE_CONFIG, type ArchetypeId } from '@/lib/config/archetypes'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CVProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  total_arguments: number
  blue_vote_count: number
  red_vote_count: number
  vote_streak: number
  civic_archetype: string | null
  created_at: string
}

interface LawTopic {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number | null
  created_at: string
}

interface TopArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  topics: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

interface EarnedAchievement {
  earned_at: string
  achievements: {
    slug: string
    name: string
    description: string
    icon: string
    tier: string
  } | null
}

interface CVData {
  profile: CVProfile
  laws: LawTopic[]
  topicsAuthored: number
  topArguments: TopArgument[]
  achievements: EarnedAchievement[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

const TIER_COLORS: Record<string, string> = {
  legendary: 'text-gold border-gold/40 bg-gold/10',
  epic:      'text-purple border-purple/40 bg-purple/10',
  rare:      'text-for-400 border-for-500/40 bg-for-500/10',
  common:    'text-surface-500 border-surface-400/40 bg-surface-300/20',
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-emerald',
  Ethics:      'text-purple',
  Science:     'text-for-300',
  Philosophy:  'text-against-400',
  Culture:     'text-gold',
  Environment: 'text-emerald',
  Health:      'text-against-300',
  Education:   'text-for-500',
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function CVSection({ title, icon: Icon, children, className }: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2 pb-2 border-b border-surface-300/50">
        <Icon className="h-4 w-4 text-surface-500" aria-hidden="true" />
        <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest">
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl bg-surface-200/60 border border-surface-300/50">
      <span className={cn('text-lg font-mono font-bold tabular-nums', color ?? 'text-white')}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CivicCVSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex items-start gap-4">
        <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CivicCVClient({ username }: { username: string }) {
  const [data, setData] = useState<CVData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cv/${username}`)
      if (!res.ok) throw new Error('Not found')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Could not load civic CV.')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => { load() }, [load])

  async function handleShare() {
    const url = `${window.location.origin}/cv/${username}`
    if (navigator.share) {
      await navigator.share({ title: `${username}'s Civic CV · Lobby Market`, url })
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="relative min-h-screen bg-surface-100">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-8 print:px-0 print:py-0 print:space-y-6">
        {/* Back + actions bar */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={`/profile/${username}`}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
            aria-label="Back to profile"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to profile
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-surface-400 border border-surface-300/50 hover:border-surface-400/70 hover:text-white transition-all"
              aria-label="Print CV"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all bg-for-600/20 border-for-600/40 text-for-400 hover:bg-for-600/30"
              aria-label="Share CV"
            >
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.span key="check" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
                    <Check className="h-3.5 w-3.5" />
                  </motion.span>
                ) : (
                  <motion.span key="share" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
                    <Share2 className="h-3.5 w-3.5" />
                  </motion.span>
                )}
              </AnimatePresence>
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>

        {loading && <CivicCVSkeleton />}

        {error && (
          <div className="text-center py-16 text-surface-500">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{error}</p>
          </div>
        )}

        {data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* ── Header ────────────────────────────────────────────────── */}
            <header className="space-y-4">
              {/* Identity */}
              <div className="flex items-start gap-4">
                <Avatar
                  src={data.profile.avatar_url}
                  fallback={data.profile.display_name || data.profile.username}
                  size="lg"
                  className="h-20 w-20 flex-shrink-0 ring-2 ring-surface-300/50"
                />
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    {data.profile.display_name || data.profile.username}
                  </h1>
                  <p className="text-sm text-surface-500 font-mono">@{data.profile.username}</p>

                  {data.profile.civic_archetype && ARCHETYPE_CONFIG[data.profile.civic_archetype as ArchetypeId] && (
                    <div className="mt-2 inline-flex items-center gap-1.5">
                      {(() => {
                        const cfg = ARCHETYPE_CONFIG[data.profile.civic_archetype as ArchetypeId]
                        const Icon = cfg.icon
                        return (
                          <span className={cn('flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-full border', cfg.color, cfg.bgColor, cfg.borderColor)}>
                            <Icon className="h-3 w-3" aria-hidden="true" />
                            {cfg.name}
                          </span>
                        )
                      })()}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-3 text-xs text-surface-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" aria-hidden="true" />
                      Member since {formatDate(data.profile.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" aria-hidden="true" />
                      {ROLE_LABELS[data.profile.role] ?? data.profile.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bio */}
              {data.profile.bio && (
                <p className="text-sm text-surface-500 leading-relaxed border-l-2 border-surface-300/50 pl-3 italic">
                  {data.profile.bio}
                </p>
              )}

              {/* Links to profile */}
              <div className="flex items-center gap-2 text-[11px] font-mono text-surface-600 print:hidden">
                <Link href={`/profile/${data.profile.username}`} className="flex items-center gap-1 hover:text-white transition-colors">
                  lobby.market/profile/{data.profile.username}
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
                <span>·</span>
                <Link href={`/u/${data.profile.username}`} className="flex items-center gap-1 hover:text-white transition-colors">
                  lobby.market/u/{data.profile.username}
                  <ExternalLink className="h-2.5 w-2.5" />
                </Link>
              </div>
            </header>

            {/* ── Core stats ────────────────────────────────────────────── */}
            <CVSection title="Civic Stats" icon={BarChart2}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatPill label="Clout" value={data.profile.clout} color="text-gold" />
                <StatPill label="Votes Cast" value={data.profile.total_votes} />
                <StatPill label="Arguments" value={data.profile.total_arguments} color="text-for-400" />
                <StatPill
                  label="Laws Authored"
                  value={data.laws.length}
                  color={data.laws.length > 0 ? 'text-emerald' : undefined}
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatPill label="Topics Proposed" value={data.topicsAuthored} />
                <StatPill label="Vote Streak" value={`${data.profile.vote_streak}d`} color="text-against-400" />
                <StatPill
                  label="For"
                  value={data.profile.blue_vote_count}
                  color="text-for-400"
                />
                <StatPill
                  label="Against"
                  value={data.profile.red_vote_count}
                  color="text-against-400"
                />
              </div>

              {/* Vote alignment bar */}
              {data.profile.total_votes > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-surface-500">
                    <span className="text-for-400">
                      For {Math.round((data.profile.blue_vote_count / data.profile.total_votes) * 100)}%
                    </span>
                    <span>Vote alignment</span>
                    <span className="text-against-400">
                      Against {Math.round((data.profile.red_vote_count / data.profile.total_votes) * 100)}%
                    </span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-for-500 h-full transition-all"
                      style={{ width: `${(data.profile.blue_vote_count / data.profile.total_votes) * 100}%` }}
                    />
                    <div className="bg-against-500 h-full flex-1" />
                  </div>
                </div>
              )}
            </CVSection>

            {/* ── Legislative record ────────────────────────────────────── */}
            {data.laws.length > 0 && (
              <CVSection title="Legislative Record" icon={Gavel}>
                <p className="text-[11px] text-surface-600 font-mono">
                  Topics authored by @{data.profile.username} that achieved consensus and became law.
                </p>
                <div className="space-y-2.5">
                  {data.laws.map((law) => {
                    const forPct = Math.round(law.blue_pct ?? 50)
                    const catColor = CATEGORY_COLORS[law.category ?? ''] ?? 'text-surface-500'
                    return (
                      <Link
                        key={law.id}
                        href={`/topic/${law.id}`}
                        className="group flex items-start gap-3 p-3.5 rounded-xl bg-surface-200/50 border border-surface-300/40 hover:border-gold/40 hover:bg-gold/5 transition-all"
                      >
                        <Gavel className="h-4 w-4 text-gold mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white leading-snug group-hover:text-gold transition-colors">
                            {law.statement}
                          </p>
                          <div className="mt-1.5 flex items-center gap-3 text-[11px] font-mono text-surface-500">
                            {law.category && (
                              <span className={catColor}>{law.category}</span>
                            )}
                            <span className="flex items-center gap-1">
                              <Vote className="h-2.5 w-2.5" aria-hidden="true" />
                              {law.total_votes.toLocaleString()} votes
                            </span>
                            <span className="text-for-400">{forPct}% consensus</span>
                          </div>
                        </div>
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-[10px] font-mono font-semibold text-gold flex-shrink-0">
                          LAW
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </CVSection>
            )}

            {/* ── Top arguments ─────────────────────────────────────────── */}
            {data.topArguments.length > 0 && (
              <CVSection title="Argument Portfolio" icon={MessageSquare}>
                <p className="text-[11px] text-surface-600 font-mono">
                  Highest-impact arguments by upvote count.
                </p>
                <div className="space-y-2.5">
                  {data.topArguments.map((arg, i) => {
                    const isFor = arg.side === 'blue'
                    return (
                      <div
                        key={arg.id}
                        className={cn(
                          'p-3.5 rounded-xl border space-y-2',
                          isFor
                            ? 'bg-for-500/5 border-for-500/20'
                            : 'bg-against-500/5 border-against-500/20'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-white leading-snug flex-1 min-w-0">
                            "{arg.content}"
                          </p>
                          <span
                            className={cn(
                              'flex items-center gap-1 text-xs font-mono font-semibold flex-shrink-0 px-2 py-0.5 rounded-full border',
                              isFor
                                ? 'text-for-400 bg-for-500/10 border-for-500/30'
                                : 'text-against-400 bg-against-500/10 border-against-500/30'
                            )}
                            aria-label={`${arg.upvotes} upvotes`}
                          >
                            <ThumbsUp className="h-2.5 w-2.5" aria-hidden="true" />
                            {arg.upvotes}
                          </span>
                        </div>

                        {arg.topics && (
                          <Link
                            href={`/topic/${arg.topics.id}`}
                            className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                          >
                            <ChevronRight className="h-2.5 w-2.5" aria-hidden="true" />
                            <span className="truncate">{arg.topics.statement}</span>
                            {arg.topics.status === 'law' && (
                              <span className="text-gold flex-shrink-0">· LAW</span>
                            )}
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CVSection>
            )}

            {/* ── Achievements ─────────────────────────────────────────── */}
            {data.achievements.length > 0 && (
              <CVSection title="Achievements" icon={Award}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {data.achievements.map((ea, i) => {
                    if (!ea.achievements) return null
                    const { name, description, tier } = ea.achievements
                    const tierClass = TIER_COLORS[tier] ?? TIER_COLORS.common
                    return (
                      <div
                        key={i}
                        className={cn(
                          'flex items-start gap-2.5 p-3 rounded-xl border',
                          tierClass
                        )}
                      >
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold">{name}</p>
                          <p className="text-[11px] opacity-70 mt-0.5 leading-snug">{description}</p>
                          <p className="text-[10px] font-mono opacity-50 mt-1">
                            {formatDate(ea.earned_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CVSection>
            )}

            {/* ── Print footer ─────────────────────────────────────────── */}
            <footer className="hidden print:block text-center text-[10px] text-surface-600 pt-4 border-t border-surface-300/30 font-mono">
              lobby.market/cv/{data.profile.username} · Generated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </footer>

            {/* ── CTA ──────────────────────────────────────────────────── */}
            <div className="print:hidden flex flex-col items-center gap-3 pt-4 border-t border-surface-300/30 text-center">
              <p className="text-xs text-surface-500">
                Want your own Civic CV? Your record builds automatically as you vote, debate, and propose topics.
              </p>
              <Link
                href="/"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600/20 border border-for-600/40 text-for-400 text-sm font-mono font-semibold hover:bg-for-600/30 transition-all"
              >
                <Flame className="h-4 w-4" aria-hidden="true" />
                Go to the Feed
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
