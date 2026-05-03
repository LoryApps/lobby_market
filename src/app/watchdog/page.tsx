'use client'

/**
 * /watchdog — The Civic Watchdog
 *
 * Surfaces laws that are under active community pressure:
 *   - Pending amendments (community proposals to modify a law)
 *   - Active reopen petitions (attempts to put a law back to a vote)
 *   - Contested laws (established with a narrow margin, < 57% FOR)
 *
 * Distinct from /amendments (full amendment listing) and /petitions
 * (full petition listing) — the Watchdog is a curated alert surface
 * focused on the most pressured laws right now.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  ExternalLink,
  Eye,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  WatchdogResponse,
  WatchdogAmendment,
  WatchdogPetition,
  ContestedLaw,
} from '@/app/api/watchdog/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Education:   'text-purple',
  Environment: 'text-emerald',
}

function categoryColor(cat: string | null): string {
  return cat ? (CATEGORY_COLORS[cat] ?? 'text-surface-500') : 'text-surface-500'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function expiresIn(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d left`
  return `${h}h left`
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
  color,
  href,
}: {
  icon: typeof Shield
  title: string
  count: number
  color: string
  href?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg border', color.replace('text-', 'bg-').replace(/text-[\w-]+/, '') + '/10 border-' + color.replace('text-', '').replace(/\/\d+/, '') + '/30')}>
          <Icon className={cn('h-3.5 w-3.5', color)} />
        </div>
        <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
          {title}
        </h2>
        <span className={cn('text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full', color.replace('text-', 'bg-') + '/10', color)}>
          {count}
        </span>
      </div>
      {href && count > 3 && (
        <Link
          href={href}
          className="text-[11px] font-mono text-surface-500 hover:text-white flex items-center gap-1 transition-colors"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

// ─── Amendment card ───────────────────────────────────────────────────────────

function AmendmentCard({ a }: { a: WatchdogAmendment }) {
  const [expanded, setExpanded] = useState(false)
  const totalVotes = a.for_count + a.against_count

  return (
    <motion.div
      layout
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      <div className="p-4">
        {/* Law reference */}
        {a.law && (
          <Link
            href={`/law/${a.law.id}`}
            className="group inline-flex items-center gap-1 text-[11px] font-mono text-gold hover:text-gold/80 mb-2 transition-colors"
          >
            <Gavel className="h-3 w-3" aria-hidden="true" />
            <span className="truncate max-w-[260px]">{a.law.statement}</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
          </Link>
        )}

        {/* Amendment title */}
        <p className="text-sm font-semibold text-white leading-snug mb-2">{a.title}</p>

        {/* Expanded body */}
        <AnimatePresence>
          {expanded && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-surface-500 leading-relaxed mb-3 overflow-hidden"
            >
              {a.body}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap">
          {a.proposer && (
            <div className="flex items-center gap-1.5">
              <Avatar
                src={a.proposer.avatar_url}
                fallback={a.proposer.display_name || a.proposer.username}
                size="xs"
              />
              <Link
                href={`/profile/${a.proposer.username}`}
                className="text-[11px] text-surface-500 hover:text-white transition-colors"
              >
                @{a.proposer.username}
              </Link>
            </div>
          )}
          <span className="text-[11px] text-surface-600">{relativeTime(a.created_at)}</span>
          <span className="text-[11px] font-mono text-against-400">
            <Clock className="h-3 w-3 inline mr-0.5" />
            {expiresIn(a.expires_at)}
          </span>
        </div>
      </div>

      {/* Support bar + actions */}
      <div className="border-t border-surface-300 px-4 py-3">
        {/* Vote bar */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-for-500 rounded-full transition-all"
              style={{ width: `${a.support_pct}%` }}
            />
          </div>
          <span className={cn('text-[11px] font-mono font-semibold', a.support_pct >= 60 ? 'text-emerald' : 'text-surface-500')}>
            {a.support_pct}%
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[11px] text-surface-500">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3 text-for-400" />
              {a.for_count.toLocaleString()} for
            </span>
            <span className="flex items-center gap-1">
              <ThumbsDown className="h-3 w-3 text-against-400" />
              {a.against_count.toLocaleString()} against
            </span>
            {totalVotes > 0 && (
              <span className="text-surface-600">{totalVotes} total</span>
            )}
          </div>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors"
            aria-expanded={expanded}
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3" />Less</>
            ) : (
              <><ChevronDown className="h-3 w-3" />Read</>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Petition card ────────────────────────────────────────────────────────────

function PetitionCard({ p }: { p: WatchdogPetition }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      layout
      className="rounded-2xl bg-surface-100 border border-against-500/20 overflow-hidden"
    >
      <div className="p-4">
        {/* Law reference */}
        {p.law && (
          <Link
            href={`/law/${p.law.id}`}
            className="group inline-flex items-center gap-1 text-[11px] font-mono text-gold hover:text-gold/80 mb-2 transition-colors"
          >
            <Gavel className="h-3 w-3" aria-hidden="true" />
            <span className="truncate max-w-[260px]">{p.law.statement}</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
          </Link>
        )}

        {/* Case summary */}
        <p className={cn('text-xs text-surface-400 leading-relaxed', expanded ? '' : 'line-clamp-2')}>
          {p.case_for_repeal}
        </p>
        {p.case_for_repeal.length > 100 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-[11px] text-surface-500 hover:text-white transition-colors mt-1"
            aria-expanded={expanded}
          >
            {expanded ? 'Collapse' : 'Read more'}
          </button>
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 flex-wrap mt-3">
          {p.requester && (
            <div className="flex items-center gap-1.5">
              <Avatar
                src={p.requester.avatar_url}
                fallback={p.requester.display_name || p.requester.username}
                size="xs"
              />
              <Link
                href={`/profile/${p.requester.username}`}
                className="text-[11px] text-surface-500 hover:text-white transition-colors"
              >
                @{p.requester.username}
              </Link>
            </div>
          )}
          <span className="text-[11px] text-surface-600">{relativeTime(p.created_at)}</span>
          <span className="text-[11px] font-mono text-against-400">
            <Clock className="h-3 w-3 inline mr-0.5" />
            {expiresIn(p.expires_at)}
          </span>
        </div>
      </div>

      {/* Consent progress */}
      <div className="border-t border-surface-300 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-against-500 rounded-full transition-all"
              style={{ width: `${Math.min(p.consent_pct, 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-against-400">
            {p.consent_pct}%
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-surface-500">
          <Users className="h-3 w-3" />
          {p.consent_count.toLocaleString()} / {p.total_original_voters.toLocaleString()} original voters
        </div>
      </div>
    </motion.div>
  )
}

// ─── Contested law card ───────────────────────────────────────────────────────

function ContestedCard({ l }: { l: ContestedLaw }) {
  const hasActivity = l.amendment_count > 0 || l.petition_count > 0

  return (
    <Link
      href={`/law/${l.id}`}
      className="block rounded-2xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/10 border border-against-500/20">
          <Scale className="h-3.5 w-3.5 text-against-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug mb-1 group-hover:text-for-300 transition-colors line-clamp-2">
            {l.statement}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {l.category && (
              <span className={cn('text-[11px] font-mono', categoryColor(l.category))}>
                {l.category}
              </span>
            )}
            <span className="text-[11px] text-surface-600">
              {l.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-lg font-mono font-bold text-against-400">
            {l.blue_pct.toFixed(0)}%
          </div>
          <div className="text-[10px] font-mono text-surface-600">for</div>
        </div>
      </div>

      {/* Pressure indicators */}
      {hasActivity && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-300">
          {l.amendment_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-for-500/10 text-for-400 border border-for-500/20">
              <Edit3 className="h-2.5 w-2.5" />
              {l.amendment_count} amendment{l.amendment_count !== 1 ? 's' : ''}
            </span>
          )}
          {l.petition_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-against-500/10 text-against-400 border border-against-500/20">
              <Flame className="h-2.5 w-2.5" />
              {l.petition_count} petition{l.petition_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingCards() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Section = 'amendments' | 'petitions' | 'contested'

export default function WatchdogPage() {
  const [data, setData] = useState<WatchdogResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('amendments')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/watchdog')
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const stats = data?.stats ?? { active_amendments: 0, active_petitions: 0, contested_count: 0 }

  const SECTIONS: { id: Section; label: string; icon: typeof Shield; count: number; color: string }[] = [
    { id: 'amendments', label: 'Amendments', icon: Edit3, count: stats.active_amendments, color: 'text-for-400' },
    { id: 'petitions',  label: 'Petitions',  icon: Flame,  count: stats.active_petitions,  color: 'text-against-400' },
    { id: 'contested',  label: 'Contested',  icon: Scale,  count: stats.contested_count,   color: 'text-gold' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
              <Eye className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Watchdog</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Laws under community pressure
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh watchdog data"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                'rounded-2xl p-4 text-left transition-all border',
                activeSection === s.id
                  ? 'bg-surface-200 border-surface-400'
                  : 'bg-surface-100 border-surface-300 hover:border-surface-400'
              )}
            >
              <s.icon className={cn('h-4 w-4 mb-2', s.color)} />
              <div className={cn('font-mono text-xl font-bold', loading ? 'text-surface-500' : s.color)}>
                {loading ? '—' : s.count}
              </div>
              <div className="text-[11px] font-mono text-surface-500 mt-0.5">{s.label}</div>
            </button>
          ))}
        </div>

        {/* Alert banner when no pressure */}
        {!loading && data && stats.active_amendments === 0 && stats.active_petitions === 0 && (
          <div className="rounded-2xl bg-emerald/5 border border-emerald/20 p-5 mb-6 flex items-start gap-3">
            <Shield className="h-5 w-5 text-emerald flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">All laws are stable</p>
              <p className="text-xs text-surface-500 mt-0.5">
                No active amendments or petitions right now. Check back after new laws are established.
              </p>
            </div>
          </div>
        )}

        {/* Section content */}
        <AnimatePresence mode="wait">
          {activeSection === 'amendments' && (
            <motion.div
              key="amendments"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <SectionHeader
                icon={Edit3}
                title="Active Amendments"
                count={stats.active_amendments}
                color="text-for-400"
                href="/amendments"
              />
              {loading ? (
                <LoadingCards />
              ) : (data?.amendments ?? []).length === 0 ? (
                <EmptyState
                  icon={Edit3}
                  title="No active amendments"
                  description="No one has proposed amendments to established laws yet."
                />
              ) : (
                <div className="space-y-3">
                  {(data?.amendments ?? []).map((a) => (
                    <AmendmentCard key={a.id} a={a} />
                  ))}
                </div>
              )}
              <Link
                href="/amendments"
                className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-surface-300 text-sm text-surface-500 hover:text-white hover:border-surface-400 transition-colors font-mono"
              >
                View all amendments <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          )}

          {activeSection === 'petitions' && (
            <motion.div
              key="petitions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <SectionHeader
                icon={Flame}
                title="Reopen Petitions"
                count={stats.active_petitions}
                color="text-against-400"
                href="/petitions"
              />
              {loading ? (
                <LoadingCards />
              ) : (data?.petitions ?? []).length === 0 ? (
                <EmptyState
                  icon={Flame}
                  title="No active petitions"
                  description="No laws are currently being petitioned for reopening."
                />
              ) : (
                <div className="space-y-3">
                  {(data?.petitions ?? []).map((p) => (
                    <PetitionCard key={p.id} p={p} />
                  ))}
                </div>
              )}
              <Link
                href="/petitions"
                className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-surface-300 text-sm text-surface-500 hover:text-white hover:border-surface-400 transition-colors font-mono"
              >
                View all petitions <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          )}

          {activeSection === 'contested' && (
            <motion.div
              key="contested"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <SectionHeader
                icon={Scale}
                title="Narrowly Established Laws"
                count={stats.contested_count}
                color="text-gold"
              />
              <p className="text-xs text-surface-500 mb-4 font-mono">
                Laws that passed with less than 57% support — the most fragile consensus.
              </p>
              {loading ? (
                <LoadingCards />
              ) : (data?.contested ?? []).length === 0 ? (
                <EmptyState
                  icon={Scale}
                  title="No contested laws"
                  description="All established laws have strong consensus behind them."
                />
              ) : (
                <div className="space-y-3">
                  {(data?.contested ?? []).map((l) => (
                    <ContestedCard key={l.id} l={l} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context footer */}
        <div className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-gold" />
            <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">How the Watchdog works</h3>
          </div>
          <div className="space-y-2 text-xs text-surface-500 leading-relaxed">
            <p>
              <span className="text-for-400 font-semibold">Amendments</span> are community proposals to refine or extend an existing law.
              An amendment needs 60% support with at least 20 votes to be ratified.
            </p>
            <p>
              <span className="text-against-400 font-semibold">Reopen petitions</span> challenge a law directly.
              If enough original voters sign, the topic goes back to a full community vote.
            </p>
            <p>
              <span className="text-gold font-semibold">Contested laws</span> passed with a narrow margin.
              They represent the thinnest consensus and are most vulnerable to future reversal.
            </p>
          </div>
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-surface-300">
            <Link
              href="/amendments"
              className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <Edit3 className="h-3 w-3" /> All amendments
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href="/petitions"
              className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <Flame className="h-3 w-3" /> All petitions
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href="/law"
              className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <Zap className="h-3 w-3" /> The Codex
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
