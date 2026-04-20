'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  BookOpen,
  Check,
  Cpu,
  FlaskConical,
  Gavel,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  Mic,
  Music2,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DiscoverData, DiscoverUser, DiscoverCategory, DiscoverDebate, DiscoverLaw, DiscoverTopic } from '@/app/api/discover/route'

// ─── Category icons and colors ────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: typeof Globe
  color: string
  bg: string
  border: string
  href: string
}> = {
  Politics:    { icon: Landmark,      color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30',      href: '/categories/Politics' },
  Economics:   { icon: TrendingUp,    color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30',          href: '/categories/Economics' },
  Technology:  { icon: Cpu,           color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30',        href: '/categories/Technology' },
  Science:     { icon: FlaskConical,  color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30',       href: '/categories/Science' },
  Ethics:      { icon: Scale,         color: 'text-for-300',       bg: 'bg-for-400/10',       border: 'border-for-400/30',       href: '/categories/Ethics' },
  Philosophy:  { icon: BookOpen,      color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30',        href: '/categories/Philosophy' },
  Culture:     { icon: Music2,        color: 'text-against-400',   bg: 'bg-against-500/10',   border: 'border-against-500/30',   href: '/categories/Culture' },
  Health:      { icon: Heart,         color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30',       href: '/categories/Health' },
  Education:   { icon: GraduationCap, color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30',          href: '/categories/Education' },
  Environment: { icon: Leaf,          color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30',       href: '/categories/Environment' },
}

function getCategoryConfig(name: string) {
  return CATEGORY_CONFIG[name] ?? {
    icon: Globe,
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    href: `/categories/${encodeURIComponent(name)}`,
  }
}

// ─── Role display ─────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  elder:         { label: 'Elder',         color: 'text-gold' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  debator:       { label: 'Debator',       color: 'text-for-400' },
  person:        { label: 'Member',        color: 'text-surface-500' },
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relTime(iso: string): string {
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

function futureRelTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Now'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 60) return `in ${m}m`
  if (h < 24) return `in ${h}h`
  return `in ${d}d`
}

// ─── Follow button ────────────────────────────────────────────────────────────

function FollowButton({ userId, initialFollowing }: { userId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing)
  const [busy, setBusy] = useState(false)

  const toggle = useCallback(async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/follow', {
        method: following ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ following_id: userId }),
      })
      if (res.ok) setFollowing((f) => !f)
    } catch {
      // ignore
    } finally {
      setBusy(false)
    }
  }, [following, userId])

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={following ? 'Unfollow user' : 'Follow user'}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all',
        following
          ? 'bg-surface-300 text-surface-400 hover:bg-against-500/20 hover:text-against-400 border border-surface-400'
          : 'bg-for-600 hover:bg-for-500 text-white border border-for-500'
      )}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : following ? (
        <Check className="h-3 w-3" aria-hidden="true" />
      ) : (
        <UserPlus className="h-3 w-3" aria-hidden="true" />
      )}
      {following ? 'Following' : 'Follow'}
    </button>
  )
}

// ─── User card ────────────────────────────────────────────────────────────────

function UserCard({ user, index }: { user: DiscoverUser; index: number }) {
  const roleConf = ROLE_CONFIG[user.role] ?? ROLE_CONFIG.person

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
    >
      <Link href={`/profile/${user.username}`} className="flex-shrink-0">
        <Avatar
          src={user.avatar_url}
          fallback={user.display_name ?? user.username}
          size="md"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${user.username}`}
          className="group flex items-baseline gap-2 min-w-0"
        >
          <span className="font-mono font-semibold text-sm text-white group-hover:text-for-300 transition-colors truncate">
            {user.display_name ?? user.username}
          </span>
          <span className="text-xs font-mono text-surface-500 truncate flex-shrink-0">
            @{user.username}
          </span>
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-[10px] font-mono', roleConf.color)}>{roleConf.label}</span>
          <span className="text-[10px] font-mono text-surface-600">·</span>
          <span className="text-[10px] font-mono text-surface-500">
            {user.total_votes.toLocaleString()} votes
          </span>
          {user.clout > 0 && (
            <>
              <span className="text-[10px] font-mono text-surface-600">·</span>
              <span className="text-[10px] font-mono text-gold">
                {user.clout.toLocaleString()} clout
              </span>
            </>
          )}
        </div>
        {user.bio && (
          <p className="text-[11px] font-mono text-surface-500 mt-1 line-clamp-1">
            {user.bio}
          </p>
        )}
      </div>
      <FollowButton userId={user.id} initialFollowing={false} />
    </motion.div>
  )
}

// ─── Category tile ────────────────────────────────────────────────────────────

function CategoryTile({ cat, index }: { cat: DiscoverCategory; index: number }) {
  const conf = getCategoryConfig(cat.name)
  const Icon = conf.icon
  const total = cat.active_count + cat.voting_count + cat.law_count

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        href={conf.href}
        className={cn(
          'flex flex-col gap-3 p-4 rounded-2xl border transition-all hover:scale-[1.02]',
          'bg-surface-100',
          conf.border,
          'hover:border-opacity-60'
        )}
      >
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', conf.bg)}>
          <Icon className={cn('h-4 w-4', conf.color)} aria-hidden="true" />
        </div>
        <div>
          <p className="font-mono font-semibold text-sm text-white">{cat.name}</p>
          <p className="text-[10px] font-mono text-surface-500 mt-0.5">
            {total} topic{total !== 1 ? 's' : ''}
            {cat.voting_count > 0 && (
              <span className="ml-1 text-purple">· {cat.voting_count} voting</span>
            )}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({ debate, index }: { debate: DiscoverDebate; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Link
        href={`/debate/${debate.id}`}
        className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-purple/40 hover:bg-surface-100 transition-all group"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple/10 border border-purple/30 flex-shrink-0">
          <Mic className="h-4 w-4 text-purple" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white line-clamp-1 group-hover:text-purple transition-colors">
            {debate.topic_statement}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono text-purple font-medium">
              {futureRelTime(debate.scheduled_at)}
            </span>
            {debate.rsvp_count > 0 && (
              <>
                <span className="text-[10px] font-mono text-surface-600">·</span>
                <span className="text-[10px] font-mono text-surface-500">
                  {debate.rsvp_count} RSVP{debate.rsvp_count !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-purple transition-colors flex-shrink-0" aria-hidden="true" />
      </Link>
    </motion.div>
  )
}

// ─── Law row ──────────────────────────────────────────────────────────────────

function LawRow({ law, index }: { law: DiscoverLaw; index: number }) {
  const forPct = Math.round(law.blue_pct ?? 50)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Link
        href={`/law/${law.id}`}
        className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/40 transition-all group"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold/10 border border-gold/30 flex-shrink-0">
          <Gavel className="h-4 w-4 text-gold" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white line-clamp-1 group-hover:text-gold transition-colors">
            {law.statement}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {law.category && (
              <span className="text-[10px] font-mono text-surface-600">{law.category}</span>
            )}
            <span className="text-[10px] font-mono text-for-400">{forPct}% consensus</span>
            <span className="text-[10px] font-mono text-surface-600">·</span>
            <span className="text-[10px] font-mono text-surface-500">{relTime(law.established_at)}</span>
          </div>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-gold transition-colors flex-shrink-0" aria-hidden="true" />
      </Link>
    </motion.div>
  )
}

// ─── Hot topic row ────────────────────────────────────────────────────────────

function HotTopicRow({ topic, index }: { topic: DiscoverTopic; index: number }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const isVoting = topic.status === 'voting'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all group"
      >
        {/* Mini vote bar */}
        <div className="flex-shrink-0 w-1.5 h-12 rounded-full overflow-hidden bg-surface-300 mt-0.5">
          <div
            className={cn('w-full rounded-full', isVoting ? 'bg-purple' : 'bg-for-500')}
            style={{ height: `${forPct}%` }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white line-clamp-2 leading-snug group-hover:text-for-300 transition-colors">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {isVoting ? (
              <span className="text-[10px] font-mono text-purple font-semibold uppercase tracking-wide">
                Voting
              </span>
            ) : (
              <span className="text-[10px] font-mono text-for-400 font-semibold">Active</span>
            )}
            {topic.category && (
              <>
                <span className="text-[10px] font-mono text-surface-600">·</span>
                <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
              </>
            )}
            <span className="text-[10px] font-mono text-surface-600">·</span>
            <span className="text-[10px] font-mono text-surface-500">
              {topic.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right mt-0.5">
          <span className={cn('text-sm font-bold font-mono', isVoting ? 'text-purple' : 'text-for-400')}>
            {forPct}%
          </span>
          <p className="text-[9px] font-mono text-surface-600">FOR</p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DiscoverSkeleton() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  href,
  linkLabel = 'See all',
}: {
  icon: typeof Globe
  iconColor: string
  iconBg: string
  title: string
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('h-3 w-3', iconColor)} aria-hidden="true" />
        </div>
        <h2 className="text-sm font-mono font-bold text-white uppercase tracking-widest">
          {title}
        </h2>
      </div>
      {href && (
        <Link
          href={href}
          className="text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors flex items-center gap-1"
        >
          {linkLabel}
          <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [data, setData] = useState<DiscoverData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/discover')
      if (!res.ok) throw new Error('Failed')
      const json = await res.json() as DiscoverData
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-for-500/10 border border-for-500/30">
                <Sparkles className="h-5 w-5 text-for-400" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Discover</h1>
                <p className="text-xs font-mono text-surface-500">
                  People, categories, debates, and laws
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/search"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono"
            >
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              Search
            </Link>
            {!loading && (
              <button
                onClick={load}
                aria-label="Refresh discover feed"
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DiscoverSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-12 text-center space-y-3"
            >
              <Globe className="h-8 w-8 text-surface-500 mx-auto" aria-hidden="true" />
              <p className="font-mono text-white font-semibold">Failed to load</p>
              <p className="text-sm font-mono text-surface-500">Something went wrong fetching discover data.</p>
              <button
                onClick={load}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try again
              </button>
            </motion.div>
          ) : data ? (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">

              {/* ── Suggested people ── */}
              {data.suggested_users.length > 0 && (
                <section aria-label="Suggested people to follow">
                  <SectionHeader
                    icon={Users}
                    iconColor="text-for-400"
                    iconBg="bg-for-500/10"
                    title="People to Follow"
                    href="/leaderboard"
                    linkLabel="View leaderboard"
                  />
                  {data.following_count === 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-3 rounded-xl bg-for-500/5 border border-for-500/20 px-4 py-3 flex items-center gap-2.5"
                    >
                      <Zap className="h-4 w-4 text-for-400 flex-shrink-0" aria-hidden="true" />
                      <p className="text-xs font-mono text-for-300">
                        Follow people to power up your{' '}
                        <Link href="/network" className="underline hover:text-for-200 transition-colors">
                          Network feed
                        </Link>
                        .
                      </p>
                    </motion.div>
                  )}
                  <div className="space-y-2">
                    {data.suggested_users.map((user, i) => (
                      <UserCard key={user.id} user={user} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Hot topics ── */}
              {data.hot_topics.length > 0 && (
                <section aria-label="Hot topics">
                  <SectionHeader
                    icon={TrendingUp}
                    iconColor="text-against-400"
                    iconBg="bg-against-500/10"
                    title="Hot Right Now"
                    href="/"
                    linkLabel="See feed"
                  />
                  <div className="space-y-2">
                    {data.hot_topics.map((topic, i) => (
                      <HotTopicRow key={topic.id} topic={topic} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Categories ── */}
              {data.categories.length > 0 && (
                <section aria-label="Browse by category">
                  <SectionHeader
                    icon={Globe}
                    iconColor="text-surface-400"
                    iconBg="bg-surface-200"
                    title="Browse Categories"
                    href="/categories"
                    linkLabel="All categories"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {data.categories.map((cat, i) => (
                      <CategoryTile key={cat.name} cat={cat} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Upcoming debates ── */}
              {data.upcoming_debates.length > 0 && (
                <section aria-label="Upcoming debates">
                  <SectionHeader
                    icon={Mic}
                    iconColor="text-purple"
                    iconBg="bg-purple/10"
                    title="Upcoming Debates"
                    href="/debate/calendar"
                    linkLabel="View calendar"
                  />
                  <div className="space-y-2">
                    {data.upcoming_debates.map((debate, i) => (
                      <DebateCard key={debate.id} debate={debate} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Recent laws ── */}
              {data.recent_laws.length > 0 && (
                <section aria-label="Recently established laws">
                  <SectionHeader
                    icon={Gavel}
                    iconColor="text-gold"
                    iconBg="bg-gold/10"
                    title="New Laws"
                    href="/law"
                    linkLabel="The Codex"
                  />
                  <div className="space-y-2">
                    {data.recent_laws.map((law, i) => (
                      <LawRow key={law.id} law={law} index={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Explore more ── */}
              <section aria-label="More to explore">
                <SectionHeader
                  icon={BarChart2}
                  iconColor="text-surface-400"
                  iconBg="bg-surface-200"
                  title="More to Explore"
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { href: '/trending', label: 'Trending', icon: TrendingUp, color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
                    { href: '/arguments', label: 'Arguments', icon: Scale, color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
                    { href: '/debate', label: 'Debates', icon: Mic, color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
                    { href: '/law', label: 'The Codex', icon: Gavel, color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
                    { href: '/predictions', label: 'Predictions', icon: Zap, color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
                    { href: '/leaderboard', label: 'Leaderboard', icon: BarChart2, color: 'text-for-300', bg: 'bg-for-400/10', border: 'border-for-400/30' },
                  ].map(({ href, label, icon: Icon, color, bg, border }) => (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-2.5 p-3.5 rounded-xl border transition-all hover:scale-[1.02]',
                        'bg-surface-100',
                        border
                      )}
                    >
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0', bg)}>
                        <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden="true" />
                      </div>
                      <span className="font-mono text-sm font-medium text-white">{label}</span>
                    </Link>
                  ))}
                </div>
              </section>

            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
