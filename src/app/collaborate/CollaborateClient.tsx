'use client'

/**
 * /collaborate — Civic Collaboration Hub
 *
 * Aggregates open opportunities across the platform where your voice is
 * needed: debates to join, topics that need arguments, coalitions
 * recruiting, relay chains to continue, and wiki pages to write.
 *
 * Distinct from:
 *   /discover     — algorithmic topic discovery
 *   /feed         — personalised topic feed
 *   /debate       — debate listing
 *   /coalitions   — coalition browser
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  ChevronRight,
  GitMerge,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CollaborateResponse, CollabDebate, CollabTopic, CollabCoalition, CollabRelay, CollabWikiTopic } from '@/app/api/collaborate/route'

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = 'debates' | 'argue' | 'coalitions' | 'relays' | 'wiki'

const TABS: { id: Tab; label: string; icon: typeof Mic; color: string; count: (d: CollaborateResponse) => number }[] = [
  {
    id: 'debates',
    label: 'Debates',
    icon: Mic,
    color: 'text-purple',
    count: (d) => d.debates.length,
  },
  {
    id: 'argue',
    label: 'Argue This',
    icon: MessageSquare,
    color: 'text-for-400',
    count: (d) => d.topics_needing_args.length,
  },
  {
    id: 'coalitions',
    label: 'Coalitions',
    icon: Building2,
    color: 'text-emerald',
    count: (d) => d.coalitions.length,
  },
  {
    id: 'relays',
    label: 'Relays',
    icon: GitMerge,
    color: 'text-gold',
    count: (d) => d.relays.length,
  },
  {
    id: 'wiki',
    label: 'Write Wiki',
    icon: BookOpen,
    color: 'text-against-400',
    count: (d) => d.wiki_topics.length,
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-for-500/10 text-for-400 border-for-500/30',
  voting: 'bg-purple/10 text-purple border-purple/30',
  law: 'bg-gold/10 text-gold border-gold/30',
  proposed: 'bg-surface-300/30 text-surface-500 border-surface-400/30',
  scheduled: 'bg-purple/10 text-purple border-purple/30',
  live: 'bg-against-500/10 text-against-400 border-against-500/30',
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'TBD'
  const d = new Date(iso)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const h = Math.floor(diff / 3_600_000)
  if (diff <= 0) return 'Live now'
  if (h < 1) return `in ${Math.floor(diff / 60_000)}m`
  if (h < 24) return `in ${h}h`
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DebateCard({ d }: { d: CollabDebate }) {
  const isLive = d.status === 'live'
  return (
    <Link
      href={`/debate/${d.id}`}
      className="group flex flex-col gap-2.5 p-4 rounded-2xl bg-surface-100 border border-surface-300/60 hover:border-purple/40 hover:bg-surface-200/60 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border', isLive ? 'bg-against-500/10 text-against-400 border-against-500/30 animate-pulse' : 'bg-purple/10 text-purple border-purple/30')}>
          {isLive ? 'Live' : 'Upcoming'}
        </span>
        <span className="text-[10px] font-mono text-surface-500 flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {fmtDate(d.scheduled_at)}
        </span>
      </div>

      <p className="text-sm font-medium text-white leading-snug line-clamp-2">
        {d.topic_statement ?? 'Open debate'}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-surface-500">
          {d.topic_category && (
            <span className="px-2 py-0.5 rounded-full bg-surface-300/40 text-surface-400">
              {d.topic_category}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {d.participant_count} joined
            {d.open_spots != null && d.open_spots > 0 && (
              <span className="ml-1 text-emerald font-semibold">· {d.open_spots} spots open</span>
            )}
          </span>
        </div>
        <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-purple transition-colors" />
      </div>
    </Link>
  )
}

function ArgueTopicCard({ t }: { t: CollabTopic }) {
  const forPct = Math.round(t.blue_pct)
  const againstPct = 100 - forPct
  return (
    <Link
      href={`/topic/${t.id}/argue`}
      className="group flex flex-col gap-2.5 p-4 rounded-2xl bg-surface-100 border border-surface-300/60 hover:border-for-500/40 hover:bg-surface-200/60 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        {t.category && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-for-500/10 text-for-400 border border-for-500/30">
            {t.category}
          </span>
        )}
        <span className="text-[10px] font-mono text-surface-500 ml-auto">
          {t.total_votes.toLocaleString()} votes · {t.argument_count} arg{t.argument_count !== 1 ? 's' : ''}
        </span>
      </div>

      <p className="text-sm font-medium text-white leading-snug line-clamp-2">{t.statement}</p>

      {/* Vote bar */}
      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden flex">
          <div className="bg-for-500 h-full transition-all" style={{ width: `${forPct}%` }} />
          <div className="bg-against-500 h-full transition-all" style={{ width: `${againstPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-for-400 flex items-center gap-0.5">
            <ThumbsUp className="h-2.5 w-2.5" /> {forPct}%
          </span>
          <span className="text-surface-500">
            {t.votes_per_arg} votes / arg
          </span>
          <span className="text-against-400 flex items-center gap-0.5">
            {againstPct}% <ThumbsDown className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <span className="text-[11px] font-semibold text-for-400 group-hover:text-for-300 transition-colors flex items-center gap-1">
          Write an argument <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  )
}

function CoalitionCard({ c }: { c: CollabCoalition }) {
  return (
    <Link
      href={`/coalitions/${c.id}`}
      className="group flex flex-col gap-2.5 p-4 rounded-2xl bg-surface-100 border border-surface-300/60 hover:border-emerald/40 hover:bg-surface-200/60 transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald/10 border border-emerald/30 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-emerald" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{c.name}</p>
          <p className="text-[11px] text-surface-500">Led by @{c.creator_username}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-emerald transition-colors flex-shrink-0" />
      </div>

      {c.description && (
        <p className="text-[12px] text-surface-500 line-clamp-2 leading-snug">{c.description}</p>
      )}

      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-3 text-surface-500">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {c.member_count}/{c.max_members} members
          </span>
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-gold" />
            {c.coalition_influence.toLocaleString()} influence
          </span>
        </div>
        <span className="font-semibold text-emerald">
          {c.open_spots} spot{c.open_spots !== 1 ? 's' : ''} open
        </span>
      </div>

      {/* Capacity bar */}
      <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="h-full bg-emerald/70 rounded-full transition-all"
          style={{ width: `${Math.min(100, (c.member_count / c.max_members) * 100)}%` }}
        />
      </div>
    </Link>
  )
}

function RelayCard({ r }: { r: CollabRelay }) {
  const isFor = r.side === 'for'
  const sideColor = isFor ? 'text-for-400 border-for-500/30 bg-for-500/10' : 'text-against-400 border-against-500/30 bg-against-500/10'
  return (
    <Link
      href={`/relay/${r.id}`}
      className="group flex flex-col gap-2.5 p-4 rounded-2xl bg-surface-100 border border-surface-300/60 hover:border-gold/40 hover:bg-surface-200/60 transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border', sideColor)}>
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        <span className="text-[10px] font-mono text-surface-500">
          Started {relTime(r.created_at)}
        </span>
      </div>

      <p className="text-sm font-medium text-white leading-snug line-clamp-2">
        {r.topic_statement ?? 'Open relay'}
      </p>

      {/* Leg progress */}
      <div className="space-y-1.5">
        <div className="flex gap-1">
          {Array.from({ length: r.max_legs }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 h-2 rounded-sm',
                i < r.leg_count
                  ? isFor
                    ? 'bg-for-500'
                    : 'bg-against-500'
                  : 'bg-surface-300',
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-surface-500">
            {r.leg_count}/{r.max_legs} legs · by @{r.starter_username}
          </span>
          <span className="font-semibold text-gold">
            {r.slots_remaining} slot{r.slots_remaining !== 1 ? 's' : ''} left
          </span>
        </div>
      </div>
    </Link>
  )
}

function WikiTopicCard({ t }: { t: CollabWikiTopic }) {
  return (
    <Link
      href={`/topic/${t.id}/wiki`}
      className="group flex flex-col gap-2.5 p-4 rounded-2xl bg-surface-100 border border-surface-300/60 hover:border-against-400/40 hover:bg-surface-200/60 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border', t.has_description ? 'bg-gold/10 text-gold border-gold/30' : 'bg-against-500/10 text-against-400 border-against-500/30')}>
          {t.has_description ? `${t.word_count} words — needs work` : 'No wiki yet'}
        </span>
        <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
          {t.total_votes.toLocaleString()} votes
        </span>
      </div>

      <p className="text-sm font-medium text-white leading-snug line-clamp-2">{t.statement}</p>

      <div className="flex items-center justify-between">
        {t.category && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-300/40 text-surface-500">
            {t.category}
          </span>
        )}
        <span className="text-[11px] font-semibold text-against-400 group-hover:text-against-300 transition-colors flex items-center gap-1 ml-auto">
          Write wiki <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CollaborateClient() {
  const [data, setData] = useState<CollaborateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('debates')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/collaborate')
      if (!res.ok) throw new Error('Failed to load opportunities')
      const json: CollaborateResponse = await res.json()
      setData(json)
      // Auto-select first non-empty tab
      if (!showRefresh) {
        for (const t of TABS) {
          if (t.count(json) > 0) {
            setTab(t.id)
            break
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ── Render ─────────────────────────────────────────────────────────────────

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-16 pb-28">
        {/* Header */}
        <div className="py-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Collaborate</h1>
            <p className="mt-1 text-sm text-surface-500">
              Find where your voice is needed most across the Lobby.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh opportunities"
            className="mt-1 p-2 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 text-surface-500 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Tabs */}
        {!loading && data && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
            {TABS.map((t) => {
              const count = t.count(data)
              const isActive = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-all border',
                    isActive
                      ? 'bg-surface-200 border-surface-400 text-white'
                      : 'bg-surface-100/60 border-surface-300/60 text-surface-500 hover:text-surface-300 hover:border-surface-400',
                  )}
                >
                  <t.icon className={cn('h-3.5 w-3.5', isActive ? t.color : 'text-surface-600')} />
                  {t.label}
                  {count > 0 && (
                    <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full', isActive ? 'bg-surface-300/60 text-white' : 'bg-surface-300/40 text-surface-500')}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="py-12 text-center">
            <p className="text-surface-500 text-sm mb-3">{error}</p>
            <button
              onClick={() => load()}
              className="text-xs font-semibold text-for-400 hover:text-for-300 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {/* Debates */}
              {tab === 'debates' && (
                <div className="space-y-3">
                  {data.debates.length === 0 ? (
                    <EmptyState
                      icon={Mic}
                      iconColor="text-purple"
                      title="No open debates"
                      description="Check back soon — debates are scheduled regularly."
                      action={{ label: 'Browse debates', href: '/debate' }}
                    />
                  ) : (
                    data.debates.map((d) => <DebateCard key={d.id} d={d} />)
                  )}
                  <Link
                    href="/debate"
                    className="flex items-center justify-center gap-1.5 p-3 rounded-xl text-xs font-semibold text-surface-500 hover:text-white border border-dashed border-surface-400/40 hover:border-surface-500 transition-colors mt-2"
                  >
                    View all debates <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Topics needing args */}
              {tab === 'argue' && (
                <div className="space-y-3">
                  <p className="text-[12px] text-surface-500 mb-1">
                    These topics have the most votes per argument — your contribution stands out most here.
                  </p>
                  {data.topics_needing_args.length === 0 ? (
                    <EmptyState
                      icon={MessageSquare}
                      iconColor="text-for-400"
                      title="All topics well-argued"
                      description="The community has been busy. Browse all topics to find debates."
                      action={{ label: 'Browse topics', href: '/topics' }}
                    />
                  ) : (
                    data.topics_needing_args.map((t) => <ArgueTopicCard key={t.id} t={t} />)
                  )}
                  <Link
                    href="/topics"
                    className="flex items-center justify-center gap-1.5 p-3 rounded-xl text-xs font-semibold text-surface-500 hover:text-white border border-dashed border-surface-400/40 hover:border-surface-500 transition-colors mt-2"
                  >
                    Browse all topics <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Coalitions */}
              {tab === 'coalitions' && (
                <div className="space-y-3">
                  {data.coalitions.length === 0 ? (
                    <EmptyState
                      icon={Building2}
                      iconColor="text-emerald"
                      title="No coalitions recruiting"
                      description="All coalitions are full. Start your own to recruit members."
                      action={{ label: 'Create a coalition', href: '/coalitions/create' }}
                    />
                  ) : (
                    data.coalitions.map((c) => <CoalitionCard key={c.id} c={c} />)
                  )}
                  <Link
                    href="/coalitions/recruit"
                    className="flex items-center justify-center gap-1.5 p-3 rounded-xl text-xs font-semibold text-surface-500 hover:text-white border border-dashed border-surface-400/40 hover:border-surface-500 transition-colors mt-2"
                  >
                    See all recruiting coalitions <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Relays */}
              {tab === 'relays' && (
                <div className="space-y-3">
                  <p className="text-[12px] text-surface-500 mb-1">
                    Civic relays are collaborative argument chains. Add your leg to continue the case.
                  </p>
                  {data.relays.length === 0 ? (
                    <EmptyState
                      icon={GitMerge}
                      iconColor="text-gold"
                      title="No open relays"
                      description="Start a civic relay to build a collaborative argument with others."
                      action={{ label: 'Browse relays', href: '/relay' }}
                    />
                  ) : (
                    data.relays.map((r) => <RelayCard key={r.id} r={r} />)
                  )}
                  <Link
                    href="/relay"
                    className="flex items-center justify-center gap-1.5 p-3 rounded-xl text-xs font-semibold text-surface-500 hover:text-white border border-dashed border-surface-400/40 hover:border-surface-500 transition-colors mt-2"
                  >
                    Browse all relays <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Wiki */}
              {tab === 'wiki' && (
                <div className="space-y-3">
                  <p className="text-[12px] text-surface-500 mb-1">
                    These high-vote topics have thin or no wiki content. Help the community understand the context.
                  </p>
                  {data.wiki_topics.length === 0 ? (
                    <EmptyState
                      icon={BookOpen}
                      iconColor="text-against-400"
                      title="Wikis are well-written"
                      description="The community has documented the major topics. Browse all to find more."
                      action={{ label: 'Browse topics', href: '/topics' }}
                    />
                  ) : (
                    data.wiki_topics.map((t) => <WikiTopicCard key={t.id} t={t} />)
                  )}
                  <Link
                    href="/wiki"
                    className="flex items-center justify-center gap-1.5 p-3 rounded-xl text-xs font-semibold text-surface-500 hover:text-white border border-dashed border-surface-400/40 hover:border-surface-500 transition-colors mt-2"
                  >
                    Browse wiki <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Contribution tip */}
        {data && !loading && (
          <div className="mt-8 p-4 rounded-2xl bg-surface-100/60 border border-surface-300/40">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-gold flex-shrink-0" />
              <p className="text-xs font-semibold text-white">Contribution Tip</p>
            </div>
            <p className="text-[12px] text-surface-500 leading-relaxed">
              {tab === 'debates' && 'Debate participants earn Clout and improve their debate record. Structured formats award bonus reputation for well-reasoned arguments.'}
              {tab === 'argue' && 'Arguments on high-vote topics earn the most upvotes and Clout. Aim for under 250 words with a clear claim and supporting evidence.'}
              {tab === 'coalitions' && 'Joining an established coalition gives you access to collective Clout, stances, and coalition debates. Active members earn shared wins.'}
              {tab === 'relays' && 'Each leg you add to a relay is permanently attributed to you. Complete relays with 5/5 legs earn bonus Clout when the community votes them compelling.'}
              {tab === 'wiki' && 'Wiki editors earn reputation points and are listed as contributors on topic pages. Good wikis reference sources and cover both FOR and AGAINST perspectives.'}
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
