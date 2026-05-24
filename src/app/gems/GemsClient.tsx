'use client'

/**
 * /gems — Civic Gems
 *
 * Surfaces underrated content that deserves more attention:
 *   • Hidden Debates — active topics with thoughtful arguments but low visibility
 *   • Rising Arguments — fresh, high-quality arguments gaining traction
 *   • Rising Voices — citizens with strong track records but small followings
 *   • Quiet Laws — recently established laws that slipped under the radar
 *
 * Distinct from:
 *   /trending        — sorts by raw engagement (popular, not hidden)
 *   /surge          — topics approaching thresholds (quantity, not quality)
 *   /groundswell    — dormant topics waking up (volume, not quality)
 *   /discover       — personalised recommendations
 *   /spotlight      — platform-curated weekly highlights (not underrated)
 *
 * Gems answers: "What's great but not yet famous?"
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  Gem,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { GemsResponse, GemTopic, GemArgument, GemProfile, GemLaw } from '@/app/api/gems/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

const GRADE_STYLE: Record<string, string> = {
  A: 'text-emerald bg-emerald/10 border-emerald/30',
  B: 'text-for-400 bg-for-500/10 border-for-500/30',
  C: 'text-gold bg-gold/10 border-gold/30',
  D: 'text-against-400 bg-against-500/10 border-against-500/30',
  F: 'text-surface-500 bg-surface-300/20 border-surface-400/30',
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

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  iconBorder,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  iconBorder: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={cn('flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border', iconBg, iconBorder)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <h2 className="font-mono text-base font-bold text-white">{title}</h2>
        <p className="text-xs font-mono text-surface-500 mt-0.5 leading-snug">{description}</p>
      </div>
    </div>
  )
}

// ─── Hidden debate card ───────────────────────────────────────────────────────

function HiddenDebateCard({ topic }: { topic: GemTopic }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'

  return (
    <Link
      href={`/topic/${topic.id}`}
      className="block group rounded-2xl border border-surface-300 bg-surface-100 hover:border-gold/40 hover:bg-surface-200 transition-all duration-200 p-4"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          {topic.category && (
            <span className={cn('text-[10px] font-mono uppercase tracking-wider mb-1.5 block', catColor)}>
              {topic.category}
            </span>
          )}
          <p className="text-sm font-mono text-white leading-snug line-clamp-3 group-hover:text-gold/90 transition-colors">
            {topic.statement}
          </p>
        </div>
        <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm" className="flex-shrink-0 mt-0.5" />
      </div>

      {/* Vote bar */}
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden mb-2">
        <div
          className="h-full bg-for-500 rounded-full transition-all"
          style={{ width: `${topic.blue_pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span className="text-for-400">{forPct}% for</span>
        <span className="flex items-center gap-1">
          <Zap className="h-2.5 w-2.5" />
          {topic.total_votes.toLocaleString()} votes
        </span>
        <span className="text-against-400">{againstPct}% against</span>
      </div>

      <div className="mt-2 pt-2 border-t border-surface-300 flex items-center justify-between">
        <span className="text-[10px] font-mono text-surface-600">{relativeTime(topic.created_at)}</span>
        <span className="text-[10px] font-mono text-gold group-hover:text-gold/80 flex items-center gap-0.5">
          Explore <ChevronRight className="h-2.5 w-2.5" />
        </span>
      </div>
    </Link>
  )
}

// ─── Rising argument card ─────────────────────────────────────────────────────

function RisingArgumentCard({ arg }: { arg: GemArgument }) {
  const isFor = arg.side === 'blue'
  const catColor = CATEGORY_COLOR[arg.topic_category ?? ''] ?? 'text-surface-500'

  return (
    <Link
      href={`/arguments/${arg.id}`}
      className="block group rounded-2xl border border-surface-300 bg-surface-100 hover:border-surface-400 transition-all duration-200 p-4"
    >
      {/* Author row */}
      <div className="flex items-center gap-2 mb-3">
        <Avatar src={arg.avatar_url} username={arg.username} size="sm" />
        <div className="min-w-0">
          <p className="text-xs font-mono font-semibold text-white truncate">
            {arg.display_name ?? arg.username}
          </p>
          <p className="text-[10px] font-mono text-surface-600 truncate">@{arg.username}</p>
        </div>
        <div className={cn(
          'ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
          isFor
            ? 'bg-for-500/15 border-for-500/30 text-for-400'
            : 'bg-against-500/15 border-against-500/30 text-against-400'
        )}>
          {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </div>
      </div>

      {/* Argument text */}
      <p className="text-sm text-white/90 leading-relaxed line-clamp-3 mb-3">
        &ldquo;{arg.content}&rdquo;
      </p>

      {/* Topic ref */}
      <div className="rounded-lg bg-surface-200 border border-surface-300 px-3 py-2 mb-3">
        {arg.topic_category && (
          <span className={cn('text-[9px] font-mono uppercase tracking-wider mb-0.5 block', catColor)}>
            {arg.topic_category}
          </span>
        )}
        <p className="text-[11px] font-mono text-surface-400 line-clamp-2 leading-snug">
          {arg.topic_statement}
        </p>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
            {arg.upvotes}
          </span>
          {arg.ai_grade && (
            <span className={cn('px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold', GRADE_STYLE[arg.ai_grade] ?? GRADE_STYLE.C)}>
              {arg.ai_grade}
            </span>
          )}
        </div>
        <span>{relativeTime(arg.created_at)}</span>
      </div>
    </Link>
  )
}

// ─── Rising voice card ────────────────────────────────────────────────────────

function RisingVoiceCard({ profile }: { profile: GemProfile }) {
  return (
    <Link
      href={`/profile/${profile.username}`}
      className="block group rounded-2xl border border-surface-300 bg-surface-100 hover:border-purple/40 transition-all duration-200 p-4"
    >
      <div className="flex items-center gap-3">
        <Avatar src={profile.avatar_url} username={profile.username} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-white truncate group-hover:text-purple transition-colors">
            {profile.display_name ?? profile.username}
          </p>
          <p className="text-[10px] font-mono text-surface-500 truncate">@{profile.username}</p>
          {profile.civic_archetype && (
            <p className="text-[10px] font-mono text-purple/80 truncate mt-0.5">{profile.civic_archetype}</p>
          )}
        </div>
        <UserPlus className="h-4 w-4 text-surface-600 group-hover:text-purple transition-colors flex-shrink-0" />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-surface-300">
        <div className="text-center">
          <div className="text-sm font-mono font-bold text-white">{profile.total_arguments}</div>
          <div className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">args</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-mono font-bold text-emerald">{profile.reputation_score.toFixed(0)}</div>
          <div className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">rep</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-mono font-bold text-purple">{profile.followers_count}</div>
          <div className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">followers</div>
        </div>
      </div>
    </Link>
  )
}

// ─── Quiet law card ───────────────────────────────────────────────────────────

function QuietLawCard({ law }: { law: GemLaw }) {
  const forPct = Math.round(law.blue_pct)
  const catColor = CATEGORY_COLOR[law.category ?? ''] ?? 'text-surface-500'

  return (
    <Link
      href={`/law/${law.id}`}
      className="block group rounded-2xl border border-gold/20 bg-surface-100 hover:border-gold/50 transition-all duration-200 p-4"
    >
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-gold/10 border border-gold/30 mt-0.5">
          <Gavel className="h-3.5 w-3.5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          {law.category && (
            <span className={cn('text-[10px] font-mono uppercase tracking-wider mb-1 block', catColor)}>
              {law.category}
            </span>
          )}
          <p className="text-sm font-mono text-white leading-snug line-clamp-3 group-hover:text-gold/90 transition-colors">
            {law.statement}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span className="text-gold">Established Law</span>
        <span className="flex items-center gap-1">
          <Users className="h-2.5 w-2.5" />
          {law.total_votes.toLocaleString()} votes · {forPct}% for
        </span>
      </div>

      <div className="mt-2 pt-2 border-t border-surface-300 flex items-center justify-between">
        <span className="text-[10px] font-mono text-surface-600">{relativeTime(law.established_at)}</span>
        <span className="text-[10px] font-mono text-gold group-hover:text-gold/80 flex items-center gap-0.5">
          Read law <ChevronRight className="h-2.5 w-2.5" />
        </span>
      </div>
    </Link>
  )
}

// ─── Skeleton states ──────────────────────────────────────────────────────────

function GemsSkeleton() {
  return (
    <div className="space-y-8">
      {[...Array(4)].map((_, i) => (
        <div key={i}>
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[...Array(4)].map((_, j) => (
              <Skeleton key={j} className="h-32 rounded-2xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function GemsClient() {
  const [data, setData] = useState<GemsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const fetchedAt = useRef<number>(0)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/gems', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load gems')
      const json = (await res.json()) as GemsResponse
      setData(json)
      fetchedAt.current = Date.now()
    } catch {
      setError('Could not load Civic Gems. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const hasContent = data && (
    data.hiddenDebates.length > 0 ||
    data.risingArguments.length > 0 ||
    data.risingVoices.length > 0 ||
    data.quietLaws.length > 0
  )

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
                <Gem className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Civic Gems</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">Great content that deserves more attention</p>
              </div>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-400',
                'hover:bg-surface-300 hover:text-white transition-all duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              aria-label="Refresh gems"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>

          <p className="text-sm font-mono text-surface-400 leading-relaxed max-w-2xl">
            The Lobby is big. Some of the best debates, arguments, and citizens fly under the radar.
            Gems finds what&apos;s worth your attention — hidden debates with real engagement,
            rising voices building their civic record, and laws that quietly changed the Codex.
          </p>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <GemsSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={Gem}
                title="Couldn't load gems"
                description={error}
                action={{ label: 'Try again', onClick: () => load() }}
              />
            </motion.div>
          ) : !hasContent ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={Sparkles}
                title="No gems yet"
                description="Check back as the platform grows — gems appear once there's enough activity to surface quality hidden content."
                action={{ label: 'Browse topics', href: '/' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10"
            >

              {/* ── Hidden Debates ── */}
              {data.hiddenDebates.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  <SectionHeader
                    icon={Flame}
                    iconColor="text-for-400"
                    iconBg="bg-for-500/10"
                    iconBorder="border-for-500/30"
                    title="Hidden Debates"
                    description="Active topics with real engagement — not yet on everyone's radar."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.hiddenDebates.map((topic) => (
                      <HiddenDebateCard key={topic.id} topic={topic} />
                    ))}
                  </div>
                  <div className="mt-3 text-center">
                    <Link
                      href="/trending"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                    >
                      See all trending topics <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </motion.section>
              )}

              {/* ── Rising Arguments ── */}
              {data.risingArguments.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <SectionHeader
                    icon={Zap}
                    iconColor="text-purple"
                    iconBg="bg-purple/10"
                    iconBorder="border-purple/30"
                    title="Rising Arguments"
                    description="Fresh, compelling arguments gaining upvotes — join the conversation."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.risingArguments.map((arg) => (
                      <RisingArgumentCard key={arg.id} arg={arg} />
                    ))}
                  </div>
                  <div className="mt-3 text-center">
                    <Link
                      href="/pulse"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-purple transition-colors"
                    >
                      Live argument feed <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </motion.section>
              )}

              {/* ── Rising Voices ── */}
              {data.risingVoices.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <SectionHeader
                    icon={Users}
                    iconColor="text-emerald"
                    iconBg="bg-emerald/10"
                    iconBorder="border-emerald/30"
                    title="Rising Voices"
                    description="Citizens building strong civic records — worth following before they blow up."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.risingVoices.map((profile) => (
                      <RisingVoiceCard key={profile.id} profile={profile} />
                    ))}
                  </div>
                  <div className="mt-3 text-center">
                    <Link
                      href="/leaderboard"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-emerald transition-colors"
                    >
                      Full leaderboard <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </motion.section>
              )}

              {/* ── Quiet Laws ── */}
              {data.quietLaws.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <SectionHeader
                    icon={Gavel}
                    iconColor="text-gold"
                    iconBg="bg-gold/10"
                    iconBorder="border-gold/30"
                    title="Quiet Laws"
                    description="Recently established laws that didn't make front page — but they're real and binding."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.quietLaws.map((law) => (
                      <QuietLawCard key={law.id} law={law} />
                    ))}
                  </div>
                  <div className="mt-3 text-center">
                    <Link
                      href="/law"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-gold transition-colors"
                    >
                      Browse the full Codex <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </motion.section>
              )}

              {/* Footer callout */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-2xl border border-gold/20 bg-gold/5 p-5 flex items-start gap-3"
              >
                <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-xl bg-gold/15 border border-gold/30">
                  <Gem className="h-4 w-4 text-gold" />
                </div>
                <div>
                  <p className="text-sm font-mono font-semibold text-gold mb-0.5">
                    Help surface more gems
                  </p>
                  <p className="text-xs font-mono text-surface-400 leading-relaxed">
                    Write strong arguments, vote on topics you care about, and follow rising voices.
                    The more you engage, the more the algorithm can find hidden quality for everyone.
                  </p>
                  <div className="flex items-center gap-3 mt-2.5">
                    <Link href="/arguments" className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1">
                      Write an argument <ExternalLink className="h-3 w-3" />
                    </Link>
                    <span className="text-surface-600">·</span>
                    <Link href="/discover" className="text-xs font-mono text-purple hover:text-purple/80 transition-colors flex items-center gap-1">
                      Discover topics <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>
      <BottomNav />
    </div>
  )
}
