'use client'

/**
 * /ten-minute-rule — The Parliamentary Ten Minute Rule
 *
 * A formal procedure borrowed from Westminster: any citizen can rise and
 * propose a bill using a brief speech. An opponent may respond. The House
 * then votes on whether the bill should be formally introduced.
 *
 * Distinct from:
 *   /bills            — formally introduced bills in full reading stages
 *   /bills/introduce  — where a passed TMR proposal goes next
 *   /edm              — Early Day Motions (non-voting notices)
 *   /oral-questions   — departmental questions, not bill introduction
 *
 * Stages:
 *   seeking_opponent → proposal submitted, opponent needed
 *   voting           → both speeches in, House votes
 *   passed           → may be introduced as a formal Bill
 *   rejected         → the House voted against introduction
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileText,
  Gavel,
  Mic,
  Plus,
  RefreshCw,
  Scale,
  ScrollText,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TMRProposal, TMRListResponse, TMRStats } from '@/app/api/ten-minute-rule/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function timeLeft(iso: string | null): string {
  if (!iso) return '—'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const m = Math.round(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 60) return `${m}m left`
  if (h < 24) return `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

function forPct(p: TMRProposal): number {
  const total = p.votes_for + p.votes_against
  if (total === 0) return 0
  return Math.round((p.votes_for / total) * 100)
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Gavel }> = {
  seeking_opponent: { label: 'Seeking Opponent', color: 'text-gold',         icon: Users },
  ready_to_vote:   { label: 'Ready to Vote',    color: 'text-purple',        icon: Scale },
  voting:          { label: 'Voting Open',       color: 'text-for-400',       icon: Zap },
  passed:          { label: 'Passed',            color: 'text-emerald',       icon: CheckCircle2 },
  rejected:        { label: 'Rejected',          color: 'text-against-400',   icon: XCircle },
  withdrawn:       { label: 'Withdrawn',         color: 'text-surface-500',   icon: FileText },
}

// ─── Category colour ──────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Proposal card ────────────────────────────────────────────────────────────

function ProposalCard({ proposal }: { proposal: TMRProposal }) {
  const cfg = STATUS_CONFIG[proposal.status] ?? STATUS_CONFIG.seeking_opponent
  const StatusIcon = cfg.icon
  const pct = forPct(proposal)
  const total = proposal.votes_for + proposal.votes_against
  const catColor = CAT_COLORS[proposal.category] ?? 'text-surface-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-surface-100 border rounded-xl p-4 hover:border-surface-300 transition-colors',
        proposal.status === 'passed'   && 'border-emerald/40',
        proposal.status === 'rejected' && 'border-against-500/30',
        proposal.status === 'voting'   && 'border-for-500/40',
        !['passed','rejected','voting'].includes(proposal.status) && 'border-surface-200',
      )}
    >
      <Link href={`/ten-minute-rule/${proposal.id}`} className="block">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
              {proposal.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={cn('text-xs font-medium', catColor)}>{proposal.category}</span>
              <span className="text-surface-500 text-xs">·</span>
              <span className="text-surface-500 text-xs">{timeAgo(proposal.created_at)}</span>
            </div>
          </div>
          <div className={cn('flex items-center gap-1 text-xs font-medium shrink-0', cfg.color)}>
            <StatusIcon className="h-3.5 w-3.5" />
            <span>{cfg.label}</span>
          </div>
        </div>

        {/* Speech preview */}
        <p className="text-surface-400 text-xs leading-relaxed line-clamp-2 mb-3">
          {proposal.proposal_speech}
        </p>

        {/* Vote bar (only if voting or decided) */}
        {(proposal.status === 'voting' || proposal.status === 'passed' || proposal.status === 'rejected') && total > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-for-400 font-mono">{pct}% FOR</span>
              <span className="text-surface-500 font-mono">{total} votes</span>
              {proposal.status === 'voting' && (
                <span className="text-surface-400">{timeLeft(proposal.voting_closes_at)}</span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  pct >= 50 ? 'bg-for-500' : 'bg-against-500',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar
              src={proposal.author?.avatar_url ?? null}
              username={proposal.author?.username ?? '?'}
              size="xs"
            />
            <span className="text-surface-400 text-xs">
              @{proposal.author?.username ?? 'unknown'}
            </span>
            {proposal.opponent && (
              <>
                <span className="text-surface-600 text-xs">vs</span>
                <Avatar
                  src={proposal.opponent.avatar_url}
                  username={proposal.opponent.username}
                  size="xs"
                />
                <span className="text-surface-400 text-xs">
                  @{proposal.opponent.username}
                </span>
              </>
            )}
          </div>
          <ArrowRight className="h-4 w-4 text-surface-500" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: TMRStats }) {
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {[
        { label: 'Seeking Opponent', value: stats.seeking_opponent, color: 'text-gold' },
        { label: 'Vote Open',        value: stats.voting,           color: 'text-for-400' },
        { label: 'Passed',           value: stats.passed,           color: 'text-emerald' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-surface-100 border border-surface-200 rounded-xl p-3 text-center">
          <p className={cn('text-xl font-bold font-mono', color)}>{value}</p>
          <p className="text-surface-500 text-xs mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'all',              label: 'All' },
  { id: 'seeking_opponent', label: 'Seeking Opponent' },
  { id: 'voting',           label: 'Voting' },
  { id: 'passed',           label: 'Passed' },
  { id: 'rejected',         label: 'Rejected' },
] as const

type TabId = (typeof TABS)[number]['id']

// ─── Main component ───────────────────────────────────────────────────────────

export function TenMinuteRuleClient() {
  const router = useRouter()
  const [proposals, setProposals] = useState<TMRProposal[]>([])
  const [stats, setStats] = useState<TMRStats>({ total: 0, voting: 0, passed: 0, seeking_opponent: 0 })
  const [tab, setTab] = useState<TabId>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (currentTab: TabId) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)

    try {
      const status = currentTab === 'all' ? 'all' : currentTab
      const res = await fetch(`/api/ten-minute-rule?status=${status}&limit=30`, {
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error(await res.text())
      const data: TMRListResponse = await res.json()
      setProposals(data.proposals)
      setStats(data.stats)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(tab) }, [tab, load])

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        {/* Hero */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ScrollText className="h-5 w-5 text-for-400" />
            <h1 className="text-xl font-bold text-white">Ten Minute Rule</h1>
          </div>
          <p className="text-surface-400 text-sm leading-relaxed">
            Any citizen may rise and propose legislation. Make your pitch, find an opponent, and let the
            House vote on whether your bill should be formally introduced.
          </p>
        </div>

        {/* Stats */}
        <StatsBar stats={stats} />

        {/* Propose CTA */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                  tab === t.id
                    ? 'bg-for-600 text-white'
                    : 'bg-surface-200 text-surface-400 hover:bg-surface-300 hover:text-white',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => load(tab)}
              className="p-1.5 rounded-lg bg-surface-200 text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <Button
              size="sm"
              onClick={() => router.push('/ten-minute-rule/propose')}
              className="gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Propose
            </Button>
          </div>
        </div>

        {/* List */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl mb-3" />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div key="err" className="text-center py-12">
              <p className="text-against-400 text-sm mb-3">{error}</p>
              <Button size="sm" variant="secondary" onClick={() => load(tab)}>
                Try again
              </Button>
            </motion.div>
          ) : proposals.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No proposals yet"
              description={tab === 'all'
                ? 'Be the first to use the Ten Minute Rule and propose a bill.'
                : `No proposals with status "${tab}" yet.`}
              action={
                <Button onClick={() => router.push('/ten-minute-rule/propose')}>
                  Make the First Proposal
                </Button>
              }
            />
          ) : (
            <motion.div key="list" className="space-y-3">
              {proposals.map((p) => (
                <ProposalCard key={p.id} proposal={p} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Explainer */}
        <div className="mt-8 bg-surface-100 border border-surface-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Mic className="h-4 w-4 text-for-400" />
            How the Ten Minute Rule Works
          </h2>
          <ol className="space-y-2 text-sm text-surface-400">
            <li className="flex gap-2">
              <span className="text-for-400 font-bold shrink-0">1.</span>
              <span>Any citizen proposes a bill with a written speech explaining why it should be introduced.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-against-400 font-bold shrink-0">2.</span>
              <span>Any other citizen may volunteer to speak against the proposal — the two speeches appear side by side.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gold font-bold shrink-0">3.</span>
              <span>Once both speeches are in, a 24-hour vote opens. Citizens vote FOR or AGAINST formal introduction.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald font-bold shrink-0">4.</span>
              <span>If &gt;50% vote FOR, the proposal passes and the author can introduce it as a formal Bill in the chamber.</span>
            </li>
          </ol>
          <div className="mt-4 pt-4 border-t border-surface-200">
            <Link
              href="/bills"
              className="flex items-center gap-1 text-xs text-for-400 hover:text-for-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View Bills that have been introduced
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
