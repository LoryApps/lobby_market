'use client'

/**
 * /for-you — Personalized Recommendations Hub
 *
 * A curated "For You" feed that surfaces the most relevant civic actions
 * based on the user's category preferences, voting history, and social graph.
 *
 * Sections:
 *   1. Topics to Vote On — unvoted topics in preferred categories
 *   2. People to Follow — high-rep users not yet followed
 *   3. Coalitions to Join — recruiting coalitions in preferred categories
 *   4. Upcoming Debates — debates in the next 72h in preferred categories
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Calendar,
  Check,
  FileText,
  Flame,
  Gavel,
  Loader2,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
  UserPlus,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ForYouResponse,
  ForYouTopic,
  ForYouPerson,
  ForYouCoalition,
  ForYouDebate,
} from '@/app/api/for-you/route'

// ─── Category colour palette (matches the rest of the app) ────────────────────

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

function getCatStyle(cat: string | null) {
  return cat && CAT_COLOR[cat]
    ? CAT_COLOR[cat]
    : { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

const STATUS_ICON: Record<string, typeof FileText> = {
  proposed: FileText,
  active: Zap,
  voting: Scale,
  law: Gavel,
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatDebateTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffH = Math.floor(diffMs / 3_600_000)
  if (diffH < 1) return 'Starting soon'
  if (diffH < 24) return `In ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `In ${diffD}d`
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  href,
}: {
  icon: typeof Sparkles
  iconColor: string
  title: string
  subtitle?: string
  href?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2.5">
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg', iconColor.replace('text-', 'bg-') + '/10')}>
          <Icon className={cn('h-3.5 w-3.5', iconColor)} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-mono font-semibold text-white">{title}</h2>
          {subtitle && (
            <p className="text-xs text-surface-500">{subtitle}</p>
          )}
        </div>
      </div>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-0.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          See all
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({ topic }: { topic: ForYouTopic }) {
  const catStyle = getCatStyle(topic.category)
  const Icon = STATUS_ICON[topic.status] ?? FileText
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block p-4 rounded-xl',
        'bg-surface-100 border border-surface-300',
        'hover:border-for-500/30 hover:bg-surface-100/80 transition-colors group'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center', catStyle.bg, catStyle.border, 'border')}>
          <Icon className={cn('h-4 w-4', catStyle.text)} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-400 transition-colors">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {topic.category && (
              <span className={cn('text-xs font-mono', catStyle.text)}>{topic.category}</span>
            )}
            <Badge variant={(topic.status === 'law' ? 'law' : topic.status === 'voting' ? 'active' : topic.status === 'active' ? 'active' : 'proposed') as 'proposed' | 'active' | 'law' | 'failed'}>
              {topic.status === 'voting' ? 'Voting' : topic.status}
            </Badge>
            <span className="text-xs text-surface-600">{topic.total_votes.toLocaleString()} votes</span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right min-w-[36px]">
          <div className="text-xs font-mono text-for-400">{forPct}%</div>
          <div className="text-xs font-mono text-against-400">{againstPct}%</div>
        </div>
      </div>
      {/* Vote bar */}
      <div className="mt-3 h-1 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="h-full bg-for-500 rounded-full transition-all"
          style={{ width: `${forPct}%` }}
        />
      </div>
    </Link>
  )
}

// ─── Person card ──────────────────────────────────────────────────────────────

function PersonCard({ person }: { person: ForYouPerson }) {
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleFollow(e: React.MouseEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      if (following) {
        await fetch('/api/follow', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: person.id }),
        })
        setFollowing(false)
      } else {
        await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: person.id }),
        })
        setFollowing(true)
      }
    } catch {
      // best-effort
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn(
      'flex items-center gap-3 p-3.5 rounded-xl',
      'bg-surface-100 border border-surface-300',
      'hover:border-surface-400 transition-colors group'
    )}>
      <Link href={`/profile/${person.username}`} className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar
          src={person.avatar_url}
          fallback={person.display_name || person.username}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors truncate">
            {person.display_name || person.username}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-surface-500">@{person.username}</span>
            <span className="text-surface-600 text-xs">·</span>
            <div className="flex items-center gap-1 text-xs text-gold">
              <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" />
              <span>{person.clout.toLocaleString()}</span>
            </div>
          </div>
          {person.bio && (
            <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{person.bio}</p>
          )}
        </div>
      </Link>
      <button
        onClick={handleFollow}
        disabled={busy}
        aria-label={following ? `Unfollow @${person.username}` : `Follow @${person.username}`}
        className={cn(
          'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
          'border transition-all duration-150 disabled:opacity-50',
          following
            ? 'bg-for-600/20 border-for-600/50 text-for-400 hover:bg-against-500/10 hover:border-against-500/40 hover:text-against-400'
            : 'bg-surface-300 border-surface-400 text-white hover:bg-for-600 hover:border-for-600'
        )}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : following ? (
          <>
            <Check className="h-3 w-3" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="h-3 w-3" />
            Follow
          </>
        )}
      </button>
    </div>
  )
}

// ─── Coalition card ───────────────────────────────────────────────────────────

function CoalitionCard({ coalition }: { coalition: ForYouCoalition }) {
  const catStyle = getCatStyle(coalition.category)

  return (
    <Link
      href={`/coalitions/${coalition.id}`}
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl',
        'bg-surface-100 border border-surface-300',
        'hover:border-purple/30 hover:bg-surface-100/80 transition-colors group'
      )}
    >
      <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-purple/10 border border-purple/30 flex items-center justify-center">
        <Users className="h-4 w-4 text-purple" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white group-hover:text-purple transition-colors line-clamp-1">
          {coalition.name}
        </p>
        {coalition.description && (
          <p className="text-xs text-surface-500 mt-0.5 line-clamp-2 leading-relaxed">
            {coalition.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-surface-500">
            <Users className="h-3 w-3" aria-hidden="true" />
            <span>{coalition.member_count.toLocaleString()} members</span>
          </div>
          {coalition.category && (
            <span className={cn('text-xs font-mono', catStyle.text)}>{coalition.category}</span>
          )}
          <span className="text-xs font-mono text-gold flex items-center gap-1">
            <TrendingUp className="h-3 w-3" aria-hidden="true" />
            {coalition.clout_total.toLocaleString()}
          </span>
        </div>
      </div>
      <ArrowRight className="flex-shrink-0 h-4 w-4 text-surface-500 group-hover:text-purple transition-colors mt-0.5" aria-hidden="true" />
    </Link>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({ debate }: { debate: ForYouDebate }) {
  const catStyle = getCatStyle(debate.topic_category)
  const timeLabel = formatDebateTime(debate.scheduled_at)

  return (
    <Link
      href={`/debate/${debate.id}`}
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl',
        'bg-surface-100 border border-surface-300',
        'hover:border-against-500/30 hover:bg-surface-100/80 transition-colors group'
      )}
    >
      <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-against-500/10 border border-against-500/20 flex items-center justify-center">
        <Mic className="h-4 w-4 text-against-400" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white group-hover:text-against-300 transition-colors line-clamp-2 leading-snug">
          {debate.topic_statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <div className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold border',
            'bg-against-500/10 border-against-500/30 text-against-400'
          )}>
            <Calendar className="h-2.5 w-2.5" aria-hidden="true" />
            {timeLabel}
          </div>
          {debate.topic_category && (
            <span className={cn('text-xs font-mono', catStyle.text)}>
              {debate.topic_category}
            </span>
          )}
          {debate.rsvp_count > 0 && (
            <span className="text-xs text-surface-500">
              {debate.rsvp_count} RSVPs
            </span>
          )}
        </div>
        {debate.host_username && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <Avatar
              src={debate.host_avatar_url}
              fallback={debate.host_display_name || debate.host_username}
              size="xs"
            />
            <span className="text-xs text-surface-500 truncate">
              Hosted by {debate.host_display_name || `@${debate.host_username}`}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300">
          <Skeleton className="flex-shrink-0 h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Preference chips ─────────────────────────────────────────────────────────

function PreferenceChips({ categories }: { categories: string[] }) {
  if (categories.length === 0) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-1">
      <span className="text-xs text-surface-600 font-mono">Tuned for:</span>
      {categories.slice(0, 5).map((cat) => {
        const s = getCatStyle(cat)
        return (
          <span
            key={cat}
            className={cn('px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border', s.bg, s.border, s.text)}
          >
            {cat}
          </span>
        )
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ForYouPage() {
  const [data, setData] = useState<ForYouResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/for-you', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json() as ForYouResponse
        setData(json)
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const hasTopics    = (data?.topics.length ?? 0) > 0
  const hasPeople    = (data?.people.length ?? 0) > 0
  const hasCoalitions = (data?.coalitions.length ?? 0) > 0
  const hasDebates   = (data?.debates.length ?? 0) > 0
  const isEmpty      = !loading && data && !hasTopics && !hasPeople && !hasCoalitions && !hasDebates

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-xl bg-for-500/10 border border-for-500/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-for-400" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-mono font-bold text-white">For You</h1>
            </div>
            {data && <PreferenceChips categories={data.categoryPreferences} />}
            {!loading && (!data?.categoryPreferences || data.categoryPreferences.length === 0) && (
              <p className="text-xs text-surface-500">
                Complete your{' '}
                <Link href="/onboarding" className="text-for-400 hover:underline">calibration quiz</Link>{' '}
                for personalised recommendations.
              </p>
            )}
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh recommendations"
            className={cn(
              'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg',
              'bg-surface-200 border border-surface-300',
              'text-surface-500 hover:text-white hover:bg-surface-300',
              'transition-colors disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {loading && (
          <div className="space-y-8">
            {[3, 4, 3, 3].map((rows, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-7 w-7 rounded-lg" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <SectionSkeleton rows={rows} />
              </div>
            ))}
          </div>
        )}

        {isEmpty && (
          <EmptyState
            icon={Sparkles}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/20"
            title="Your Lobby is quiet"
            description="Cast some votes and follow a few citizens to unlock personalised recommendations."
            action={{ label: 'Explore topics', href: '/topics' }}
          />
        )}

        {!loading && data && (
          <motion.div
            className="space-y-8"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            {/* ── Topics to Vote On ─────────────────────────────────────── */}
            {hasTopics && (
              <section aria-labelledby="topics-heading">
                <SectionHeader
                  icon={Flame}
                  iconColor="text-for-400"
                  title="Topics to Vote On"
                  subtitle={
                    data.categoryPreferences.length > 0
                      ? `In your preferred categories`
                      : `Trending across the Lobby`
                  }
                  href="/topics"
                />
                <div className="space-y-2" id="topics-heading">
                  {data.topics.map((topic) => (
                    <TopicCard key={topic.id} topic={topic} />
                  ))}
                </div>
              </section>
            )}

            {/* ── People to Follow ──────────────────────────────────────── */}
            {hasPeople && (
              <section aria-labelledby="people-heading">
                <SectionHeader
                  icon={UserPlus}
                  iconColor="text-for-400"
                  title="People to Follow"
                  subtitle="High-reputation citizens you haven't connected with yet"
                  href="/search?tab=people"
                />
                <div className="space-y-2" id="people-heading">
                  {data.people.map((person) => (
                    <PersonCard key={person.id} person={person} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Coalitions to Join ────────────────────────────────────── */}
            {hasCoalitions && (
              <section aria-labelledby="coalitions-heading">
                <SectionHeader
                  icon={Users}
                  iconColor="text-purple"
                  title="Coalitions to Join"
                  subtitle="Recruiting alliances that match your civic outlook"
                  href="/coalitions/recruit"
                />
                <div className="space-y-2" id="coalitions-heading">
                  {data.coalitions.map((coalition) => (
                    <CoalitionCard key={coalition.id} coalition={coalition} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Upcoming Debates ──────────────────────────────────────── */}
            {hasDebates && (
              <section aria-labelledby="debates-heading">
                <SectionHeader
                  icon={Mic}
                  iconColor="text-against-400"
                  title="Upcoming Debates"
                  subtitle="Live debates starting in the next 72 hours"
                  href="/debate/calendar"
                />
                <div className="space-y-2" id="debates-heading">
                  {data.debates.map((debate) => (
                    <DebateCard key={debate.id} debate={debate} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Explore more ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Link
                href="/categories"
                className={cn(
                  'flex items-center gap-2.5 p-4 rounded-xl',
                  'bg-surface-100 border border-surface-300',
                  'hover:border-for-500/30 transition-colors group'
                )}
              >
                <div className="h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/20 flex items-center justify-center flex-shrink-0">
                  <Flame className="h-4 w-4 text-for-400" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors">Browse</p>
                  <p className="text-xs text-surface-500">All categories</p>
                </div>
              </Link>
              <Link
                href="/search"
                className={cn(
                  'flex items-center gap-2.5 p-4 rounded-xl',
                  'bg-surface-100 border border-surface-300',
                  'hover:border-purple/30 transition-colors group'
                )}
              >
                <div className="h-8 w-8 rounded-lg bg-purple/10 border border-purple/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-purple" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-purple transition-colors">Search</p>
                  <p className="text-xs text-surface-500">Topics, laws, people</p>
                </div>
              </Link>
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
