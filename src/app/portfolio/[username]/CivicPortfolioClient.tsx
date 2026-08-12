'use client'

/**
 * /portfolio/[username] — Civic Portfolio
 *
 * A visually striking, shareable showcase of a user's best civic contributions.
 * Focused on impact and quality, not raw statistics.
 *
 * Distinct from:
 *   /cv/[username]       — formal CV style, chronological record
 *   /passport/[username] — compact identity card
 *   /card/[username]     — minimal bio link card
 *   /profile/[username]  — full activity profile with all tabs
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Flame,
  Gavel,
  Globe,
  Loader2,
  MessageSquare,
  Scale,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { ARCHETYPE_CONFIG, type ArchetypeId } from '@/lib/config/archetypes'
import { cn } from '@/lib/utils/cn'
import type {
  PortfolioData,
  PortfolioArgument,
  PortfolioLaw,
  PortfolioAchievement,
} from '@/app/api/portfolio/[username]/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const ROLE_BADGE: Record<string, string> = {
  elder: 'border-gold/40 text-gold bg-gold/10',
  senator: 'border-purple/40 text-purple bg-purple/10',
  lawmaker: 'border-gold/60 text-gold bg-gold/20',
  debator: 'border-for-500/40 text-for-300 bg-for-500/10',
  troll_catcher: 'border-emerald/40 text-emerald bg-emerald/10',
  person: 'border-surface-400 text-surface-500 bg-surface-300/20',
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-against-300',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

const CAT_BG: Record<string, string> = {
  Economics: 'bg-gold/10 border-gold/25',
  Politics: 'bg-for-500/10 border-for-500/25',
  Technology: 'bg-purple/10 border-purple/25',
  Science: 'bg-emerald/10 border-emerald/25',
  Ethics: 'bg-against-500/10 border-against-500/25',
  Philosophy: 'bg-for-300/10 border-for-300/25',
  Culture: 'bg-against-300/10 border-against-300/25',
  Health: 'bg-emerald/10 border-emerald/25',
  Environment: 'bg-emerald/10 border-emerald/25',
  Education: 'bg-for-400/10 border-for-400/25',
}

const TIER_COLOR: Record<string, string> = {
  platinum: 'text-surface-200 bg-surface-300/20 border-surface-400',
  gold: 'text-gold bg-gold/10 border-gold/30',
  silver: 'text-surface-300 bg-surface-300/10 border-surface-400',
  bronze: 'text-amber-600 bg-amber-600/10 border-amber-600/30',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function truncate(s: string, len: number) {
  return s.length <= len ? s : s.slice(0, len).trimEnd() + '…'
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  accent: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-200 border border-surface-300 p-4 text-center">
      <Icon className={cn('h-5 w-5', accent)} aria-hidden />
      <p className={cn('text-2xl font-bold tabular-nums font-mono', accent)}>
        {typeof value === 'number' ? fmtNum(value) : value}
      </p>
      <p className="text-xs text-surface-500 leading-tight">{label}</p>
    </div>
  )
}

// ─── Argument card ─────────────────────────────────────────────────────────────

function ArgumentCard({ arg, index }: { arg: PortfolioArgument; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = arg.content.length > 200
  const sideCls =
    arg.side === 'blue'
      ? { border: 'border-for-500/30', accent: 'text-for-400', bg: 'from-for-500/5' }
      : { border: 'border-against-500/30', accent: 'text-against-400', bg: 'from-against-500/5' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={cn(
        'rounded-2xl border bg-gradient-to-b to-surface-200 p-4 space-y-3',
        sideCls.border,
        sideCls.bg,
      )}
    >
      {/* Side + grade row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={arg.side === 'blue' ? 'for' : 'against'} className="text-xs gap-1">
          {arg.side === 'blue' ? (
            <ThumbsUp className="w-2.5 h-2.5" />
          ) : (
            <ThumbsDown className="w-2.5 h-2.5" />
          )}
          {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
        </Badge>
        {arg.ai_grade && (
          <span
            className={cn(
              'text-xs font-mono font-bold px-1.5 py-0.5 rounded',
              arg.ai_grade === 'A'
                ? 'text-emerald bg-emerald/10'
                : arg.ai_grade === 'B'
                  ? 'text-for-300 bg-for-500/10'
                  : 'text-gold bg-gold/10',
            )}
          >
            {arg.ai_grade}
          </span>
        )}
        {arg.topic?.category && (
          <span className={cn('text-xs font-medium', CAT_COLOR[arg.topic.category] ?? 'text-surface-500')}>
            {arg.topic.category}
          </span>
        )}
        <span className="ml-auto text-xs text-surface-500">{relTime(arg.created_at)}</span>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-800 leading-relaxed">
        {isLong && !expanded ? truncate(arg.content, 200) : arg.content}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-surface-500 hover:text-surface-400 transition-colors"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {/* Topic context */}
      {arg.topic && (
        <Link
          href={`/topic/${arg.topic.id}`}
          className="block rounded-xl bg-surface-300/40 border border-surface-300/60 hover:bg-surface-300/60 p-2.5 transition-colors group"
        >
          <div className="flex items-start gap-1.5">
            <Scale className="w-3 h-3 text-surface-500 shrink-0 mt-0.5" />
            <p className="text-xs text-surface-500 leading-snug group-hover:text-surface-400 transition-colors flex-1">
              {truncate(arg.topic.statement, 100)}
            </p>
            <ExternalLink className="w-3 h-3 text-surface-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 pt-0.5">
        <span className="flex items-center gap-1 text-xs text-gold">
          <Zap className="w-3.5 h-3.5" />
          <span className="font-mono tabular-nums font-semibold">{fmtNum(arg.upvotes)}</span>
          <span className="text-surface-500">upvotes</span>
        </span>
        {arg.ai_score !== null && (
          <span className="flex items-center gap-1 text-xs text-purple">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums font-semibold">{arg.ai_score}/10</span>
            <span className="text-surface-500">AI</span>
          </span>
        )}
        <Link href={`/topic/${arg.topic?.id}#arg-${arg.id}`} className="ml-auto">
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
            View <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law, index }: { law: PortfolioLaw; index: number }) {
  const forPct = Math.round(law.blue_pct ?? 50)
  const userSide = law.user_voted

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        href={`/topic/${law.id}`}
        className="block rounded-xl border border-gold/20 bg-gold/5 hover:bg-gold/10 p-4 transition-colors group space-y-2.5"
      >
        <div className="flex items-start gap-2">
          <Gavel className="w-4 h-4 text-gold shrink-0 mt-0.5" />
          <p className="text-sm text-surface-800 leading-snug group-hover:text-white transition-colors flex-1">
            {truncate(law.statement, 100)}
          </p>
          <ExternalLink className="w-3.5 h-3.5 text-surface-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {law.category && (
            <span className={cn('text-xs font-medium', CAT_COLOR[law.category] ?? 'text-surface-500')}>
              {law.category}
            </span>
          )}
          <span className="text-xs text-surface-500">{fmtNum(law.total_votes)} votes</span>
          <div className="flex-1 h-0.5 bg-surface-300 rounded-full overflow-hidden min-w-[40px]">
            <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
          </div>
          <span className="text-xs font-mono text-for-400">{forPct}%</span>
          {userSide && (
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded border',
                userSide === 'for'
                  ? 'text-for-300 bg-for-500/10 border-for-500/30'
                  : 'text-against-300 bg-against-500/10 border-against-500/30',
              )}
            >
              Voted {userSide === 'for' ? 'FOR' : 'AGAINST'}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Achievement chip ─────────────────────────────────────────────────────────

function AchievementChip({ ach }: { ach: PortfolioAchievement }) {
  const tierCls = TIER_COLOR[ach.tier] ?? TIER_COLOR.bronze

  return (
    <div
      title={ach.description}
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2',
        tierCls,
      )}
    >
      <span className="text-lg leading-none" role="img" aria-label={ach.name}>
        {ach.icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-tight truncate">{ach.name}</p>
        <p className="text-[10px] opacity-70 capitalize">{ach.tier}</p>
      </div>
      {ach.tier === 'platinum' && (
        <Trophy className="w-3.5 h-3.5 ml-auto shrink-0 opacity-60" />
      )}
    </div>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({
  category,
  voteCount,
  argCount,
  maxTotal,
}: {
  category: string
  voteCount: number
  argCount: number
  maxTotal: number
}) {
  const total = voteCount + argCount
  const width = maxTotal > 0 ? Math.max(4, (total / maxTotal) * 100) : 0

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          'text-xs font-medium w-20 shrink-0 truncate',
          CAT_COLOR[category] ?? 'text-surface-500',
        )}
      >
        {category}
      </span>
      <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn(
            'h-full rounded-full',
            CAT_BG[category]?.includes('gold') ? 'bg-gold/60' : 'bg-for-500/60',
          )}
        />
      </div>
      <div className="text-xs text-surface-500 w-20 shrink-0 text-right tabular-nums">
        {voteCount > 0 && (
          <span className="text-for-400">{fmtNum(voteCount)}v </span>
        )}
        {argCount > 0 && (
          <span className="text-purple">{fmtNum(argCount)}a</span>
        )}
      </div>
    </div>
  )
}

// ─── Share button ─────────────────────────────────────────────────────────────

function ShareButton({ username }: { username: string }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = `${window.location.origin}/portfolio/${username}`
    if (navigator.share) {
      try {
        await navigator.share({ title: `${username}'s Civic Portfolio · Lobby Market`, url })
        return
      } catch {
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1.5">
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald" /> Copied!
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5" /> Share
        </>
      )}
    </Button>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function PortfolioSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-3xl bg-surface-200 border border-surface-300 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      </div>
      {/* Sections */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CivicPortfolioClient({ username }: { username: string }) {
  const [data, setData] = useState<PortfolioData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/portfolio/${username}`)
      if (!res.ok) throw new Error('not found')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => { load() }, [load])

  const profile = data?.profile
  const archetypeKey = profile?.civic_archetype as ArchetypeId | undefined
  const archetype = archetypeKey ? ARCHETYPE_CONFIG[archetypeKey] : undefined

  const maxCatTotal = Math.max(
    1,
    ...(data?.categoryBreakdown ?? []).map((c) => c.vote_count + c.argument_count),
  )

  return (
    <div className="min-h-screen bg-surface-100 pb-28">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-6">

        {/* ─── Back nav ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <Link
            href={profile ? `/profile/${profile.username}` : '/'}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Profile
          </Link>
          {profile && <ShareButton username={profile.username} />}
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PortfolioSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={<BarChart2 className="w-8 h-8 text-surface-600" />}
                title="Portfolio not found"
                description="This user's portfolio couldn't be loaded."
                action={
                  <Button variant="ghost" size="sm" onClick={load}>
                    Try again
                  </Button>
                }
              />
            </motion.div>
          ) : data && profile ? (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

              {/* ─── Hero ─────────────────────────────────────────────────── */}
              <section
                className={cn(
                  'rounded-3xl border p-6 space-y-5',
                  archetype
                    ? `${archetype.borderColor} bg-gradient-to-br from-surface-200 to-surface-100`
                    : 'border-surface-300 bg-surface-200',
                )}
              >
                {/* Avatar + identity */}
                <div className="flex items-start gap-4">
                  <Link href={`/profile/${profile.username}`}>
                    <Avatar
                      src={profile.avatar_url}
                      username={profile.username}
                      size="lg"
                      className="h-20 w-20 ring-2 ring-surface-300"
                    />
                  </Link>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/profile/${profile.username}`}
                        className="text-xl font-bold text-white hover:text-surface-200 transition-colors"
                      >
                        {profile.display_name ?? profile.username}
                      </Link>
                    </div>
                    <p className="text-sm text-surface-500">@{profile.username}</p>
                    {profile.bio && (
                      <p className="text-sm text-surface-400 leading-relaxed line-clamp-2">
                        {profile.bio}
                      </p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'text-xs px-2 py-0.5 rounded-full border font-medium',
                          ROLE_BADGE[profile.role] ?? ROLE_BADGE.person,
                        )}
                      >
                        {ROLE_LABEL[profile.role] ?? profile.role}
                      </span>
                      {archetype && (
                        <span className={cn('text-xs font-medium', archetype.color)}>
                          {archetype.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stat grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatTile icon={Vote} label="Votes Cast" value={profile.total_votes} accent="text-for-400" />
                  <StatTile icon={MessageSquare} label="Arguments" value={profile.total_arguments} accent="text-purple" />
                  <StatTile icon={Zap} label="Clout" value={profile.clout} accent="text-gold" />
                  <StatTile icon={Flame} label="Day Streak" value={profile.vote_streak ?? 0} accent="text-against-300" />
                </div>

                {/* Impact highlights */}
                {(data.stats.totalUpvotesReceived > 0 || data.stats.lawsSupported > 0 || data.stats.avgArgumentScore !== null) && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {data.stats.totalUpvotesReceived > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gold bg-gold/10 border border-gold/25 rounded-full px-3 py-1.5">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {fmtNum(data.stats.totalUpvotesReceived)} upvotes received
                      </div>
                    )}
                    {data.stats.lawsSupported > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gold bg-gold/10 border border-gold/25 rounded-full px-3 py-1.5">
                        <Gavel className="w-3.5 h-3.5" />
                        {data.stats.lawsSupported} law{data.stats.lawsSupported !== 1 ? 's' : ''} supported
                      </div>
                    )}
                    {data.stats.avgArgumentScore !== null && (
                      <div className="flex items-center gap-1.5 text-xs text-purple bg-purple/10 border border-purple/25 rounded-full px-3 py-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        {data.stats.avgArgumentScore}/10 avg. AI score
                      </div>
                    )}
                    {data.stats.topCategory && (
                      <div
                        className={cn(
                          'flex items-center gap-1.5 text-xs rounded-full px-3 py-1.5',
                          CAT_BG[data.stats.topCategory] ?? 'bg-surface-300/40 border-surface-400',
                          CAT_COLOR[data.stats.topCategory] ?? 'text-surface-400',
                        )}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        {data.stats.topCategory} specialist
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ─── Top Arguments ──────────────────────────────────────── */}
              {data.topArguments.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-surface-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple" />
                      Best Arguments
                    </h2>
                    <Link
                      href={`/profile/${username}/arguments`}
                      className="text-xs text-surface-500 hover:text-surface-400 transition-colors flex items-center gap-0.5"
                    >
                      All <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  {data.topArguments.slice(0, 3).map((arg, i) => (
                    <ArgumentCard key={arg.id} arg={arg} index={i} />
                  ))}
                </section>
              )}

              {/* ─── Laws ───────────────────────────────────────────────── */}
              {data.laws.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-surface-400 flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-gold" />
                    Laws Voted On
                  </h2>
                  {data.laws.slice(0, 4).map((law, i) => (
                    <LawCard key={law.id} law={law} index={i} />
                  ))}
                </section>
              )}

              {/* ─── Achievements ───────────────────────────────────────── */}
              {data.achievements.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-surface-400 flex items-center gap-2">
                      <Award className="w-4 h-4 text-gold" />
                      Achievements
                    </h2>
                    <Link
                      href={`/profile/${username}/achievements`}
                      className="text-xs text-surface-500 hover:text-surface-400 transition-colors flex items-center gap-0.5"
                    >
                      All <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.achievements.slice(0, 6).map((ach) => (
                      <AchievementChip key={ach.slug} ach={ach} />
                    ))}
                  </div>
                </section>
              )}

              {/* ─── Category Breakdown ─────────────────────────────────── */}
              {data.categoryBreakdown.length > 0 && (
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold text-surface-400 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-for-400" />
                    Engagement by Category
                    <span className="text-xs text-surface-600 font-normal">(v = votes, a = arguments)</span>
                  </h2>
                  <div className="rounded-2xl bg-surface-200 border border-surface-300 p-4 space-y-3">
                    {data.categoryBreakdown.map((cat) => (
                      <CategoryBar
                        key={cat.category}
                        category={cat.category}
                        voteCount={cat.vote_count}
                        argCount={cat.argument_count}
                        maxTotal={maxCatTotal}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* ─── Empty state ─────────────────────────────────────────── */}
              {data.topArguments.length === 0 && data.laws.length === 0 && data.achievements.length === 0 && (
                <EmptyState
                  icon={<Trophy className="w-8 h-8 text-surface-600" />}
                  title="Portfolio coming soon"
                  description="This user hasn't made any civic contributions yet. Start voting and arguing to build your portfolio."
                />
              )}

              {/* ─── Footer CTA ──────────────────────────────────────────── */}
              <div className="rounded-2xl border border-surface-300 bg-surface-200/50 px-4 py-4 flex items-center gap-3">
                <Scale className="w-5 h-5 text-for-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-surface-500 leading-relaxed">
                    View {profile.display_name ?? profile.username}&apos;s full civic record — debates,
                    laws, and community activity.
                  </p>
                </div>
                <Link href={`/profile/${profile.username}`} className="shrink-0">
                  <Button variant="ghost" size="sm" className="gap-1.5 whitespace-nowrap text-xs">
                    Full Profile <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>

            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
