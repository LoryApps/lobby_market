'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  Mic,
  RefreshCw,
  Scale,
  ScrollText,
  ThumbsDown,
  ThumbsUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TMRDetailResponse, TMRProposal } from '@/app/api/ten-minute-rule/[id]/route'

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
  if (m < 60) return `${m}m remaining`
  if (h < 24) return `${h}h remaining`
  return `${Math.floor(h / 24)}d remaining`
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Gavel; bg: string }> = {
  seeking_opponent: { label: 'Seeking Opponent', color: 'text-gold',         icon: Users,         bg: 'bg-gold/10 border-gold/30' },
  ready_to_vote:   { label: 'Ready to Vote',    color: 'text-purple',        icon: Scale,         bg: 'bg-purple/10 border-purple/30' },
  voting:          { label: 'Voting Open',       color: 'text-for-400',       icon: Zap,           bg: 'bg-for-500/10 border-for-500/30' },
  passed:          { label: 'Bill Passed',       color: 'text-emerald',       icon: CheckCircle2,  bg: 'bg-emerald/10 border-emerald/30' },
  rejected:        { label: 'Rejected',          color: 'text-against-400',   icon: XCircle,       bg: 'bg-against-500/10 border-against-500/30' },
  withdrawn:       { label: 'Withdrawn',         color: 'text-surface-500',   icon: FileText,      bg: 'bg-surface-300/20 border-surface-300/30' },
}

const CAT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
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

function getCatStyle(cat: string) {
  return CAT_COLORS[cat] ?? { text: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-300/30' }
}

// ─── Opposition form ──────────────────────────────────────────────────────────

function OppositionForm({ proposalId, onSuccess }: { proposalId: string; onSuccess: () => void }) {
  const [speech, setSpeech] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const speechLen = speech.trim().length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (speechLen < 50 || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ten-minute-rule/${proposalId}/oppose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opposition_speech: speech.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit.')
      onSuccess()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        className="gap-2 w-full"
      >
        <Mic className="h-4 w-4 text-against-400" />
        Rise to Oppose This Bill
      </Button>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="bg-against-950/50 border border-against-500/30 rounded-xl p-4"
    >
      <h3 className="text-sm font-semibold text-against-400 mb-2 flex items-center gap-2">
        <Mic className="h-4 w-4" />
        Opposition Speech
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={speech}
          onChange={(e) => setSpeech(e.target.value)}
          maxLength={2000}
          rows={6}
          placeholder={
            'Mr Deputy Speaker,\n\n' +
            'I oppose this bill because...\n\n' +
            'I urge the House to vote against introduction.'
          }
          className={cn(
            'w-full bg-surface-200 border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-surface-500',
            'focus:outline-none focus:border-against-500 transition-colors resize-none font-mono leading-relaxed',
            speechLen > 0 && speechLen < 50 ? 'border-against-500' : 'border-surface-300',
          )}
        />
        <div className="flex items-center justify-between text-xs text-surface-500">
          <span>{speechLen}/2000 — min 50 chars</span>
        </div>
        {error && <p className="text-against-400 text-xs">{error}</p>}
        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={speechLen < 50 || loading}
            variant="against"
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            Submit Opposition
          </Button>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
        </div>
      </form>
    </motion.div>
  )
}

// ─── Vote panel ───────────────────────────────────────────────────────────────

function VotePanel({ proposal, onVoted }: { proposal: TMRProposal; onVoted: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = proposal.votes_for + proposal.votes_against
  const pct = total === 0 ? 0 : Math.round((proposal.votes_for / total) * 100)

  async function vote(side: 'for' | 'against') {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      // Toggle off if same
      if (proposal.user_vote === side) {
        await fetch(`/api/ten-minute-rule/${proposal.id}/vote`, { method: 'DELETE' })
      } else {
        const res = await fetch(`/api/ten-minute-rule/${proposal.id}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ side }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error)
        }
      }
      onVoted()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-surface-100 border border-surface-200 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-1">Vote on Introduction</h3>
      <p className="text-surface-400 text-xs mb-4">
        Should this bill be formally introduced into the chamber?
      </p>

      {/* Vote bar */}
      {total > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-for-400 font-mono font-bold">{pct}% FOR</span>
            <span className="text-surface-500 font-mono">{total} {total === 1 ? 'vote' : 'votes'}</span>
            <span className="text-against-400 font-mono font-bold">{100 - pct}% AGAINST</span>
          </div>
          <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-for-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Vote buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => vote('for')}
          disabled={busy}
          className={cn(
            'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all border',
            proposal.user_vote === 'for'
              ? 'bg-for-600 border-for-500 text-white ring-2 ring-for-400 ring-offset-1 ring-offset-surface-100'
              : 'bg-for-600/20 border-for-500/40 text-for-400 hover:bg-for-600/40',
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
          FOR Introduction
          {proposal.votes_for > 0 && (
            <span className="font-mono text-xs opacity-75">({proposal.votes_for})</span>
          )}
        </button>
        <button
          onClick={() => vote('against')}
          disabled={busy}
          className={cn(
            'flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all border',
            proposal.user_vote === 'against'
              ? 'bg-against-600 border-against-500 text-white ring-2 ring-against-400 ring-offset-1 ring-offset-surface-100'
              : 'bg-against-600/20 border-against-500/40 text-against-400 hover:bg-against-600/40',
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
          AGAINST
          {proposal.votes_against > 0 && (
            <span className="font-mono text-xs opacity-75">({proposal.votes_against})</span>
          )}
        </button>
      </div>

      {error && <p className="text-against-400 text-xs mt-2">{error}</p>}

      {proposal.voting_closes_at && (
        <div className="flex items-center gap-1 text-xs text-surface-500 mt-3">
          <Clock className="h-3 w-3" />
          {timeLeft(proposal.voting_closes_at)}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TMRDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<TMRDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ten-minute-rule/${id}`, {
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error('Proposal not found.')
      setData(await res.json())
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-4">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid md:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
          <div className="text-center py-12">
            <p className="text-against-400 text-sm mb-3">{error ?? 'Proposal not found.'}</p>
            <Button size="sm" variant="secondary" onClick={load}>Try again</Button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { proposal, topic_statement } = data
  const cfg = STATUS_CONFIG[proposal.status] ?? STATUS_CONFIG.seeking_opponent
  const StatusIcon = cfg.icon
  const catStyle = getCatStyle(proposal.category)

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6">
        {/* Back */}
        <Link
          href="/ten-minute-rule"
          className="inline-flex items-center gap-1 text-surface-400 hover:text-white text-sm mb-5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Ten Minute Rule
        </Link>

        {/* Status banner */}
        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium mb-4', cfg.bg, cfg.color)}>
          <StatusIcon className="h-4 w-4" />
          <span>{cfg.label}</span>
          {proposal.status === 'voting' && proposal.voting_closes_at && (
            <span className="ml-auto text-xs font-normal text-surface-400">
              {timeLeft(proposal.voting_closes_at)}
            </span>
          )}
        </div>

        {/* Title */}
        <div className="mb-5">
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white leading-snug flex-1">{proposal.title}</h1>
            <Badge
              variant="category"
              className={cn('shrink-0', catStyle.text, catStyle.bg, catStyle.border)}
              size="sm"
            >
              {proposal.category}
            </Badge>
          </div>
          {topic_statement && (
            <p className="text-surface-400 text-xs mt-2 flex items-center gap-1">
              <FileText className="h-3 w-3" />
              Related topic: {topic_statement}
            </p>
          )}
          <p className="text-surface-500 text-xs mt-1">{timeAgo(proposal.created_at)}</p>
        </div>

        {/* Speeches side by side */}
        <div className="grid md:grid-cols-2 gap-4 mb-5">
          {/* Proposal speech */}
          <div className="bg-for-950/30 border border-for-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <ThumbsUp className="h-4 w-4 text-for-400" />
              <span className="text-for-400 text-xs font-semibold uppercase tracking-wide">For Introduction</span>
            </div>
            {proposal.author && (
              <div className="flex items-center gap-2 mb-3">
                <Avatar src={proposal.author.avatar_url} username={proposal.author.username} size="xs" />
                <div>
                  <p className="text-white text-xs font-medium">
                    {proposal.author.display_name ?? proposal.author.username}
                  </p>
                  <p className="text-surface-500 text-xs">@{proposal.author.username}</p>
                </div>
              </div>
            )}
            <p className="text-surface-300 text-sm leading-relaxed whitespace-pre-line">
              {proposal.proposal_speech}
            </p>
          </div>

          {/* Opposition speech or CTA */}
          <div className={cn(
            'border rounded-xl p-4',
            proposal.opposition_speech
              ? 'bg-against-950/30 border-against-500/30'
              : 'bg-surface-200 border-surface-300 border-dashed flex flex-col items-center justify-center text-center min-h-[200px]',
          )}>
            {proposal.opposition_speech ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsDown className="h-4 w-4 text-against-400" />
                  <span className="text-against-400 text-xs font-semibold uppercase tracking-wide">Against Introduction</span>
                </div>
                {proposal.opponent && (
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar src={proposal.opponent.avatar_url} username={proposal.opponent.username} size="xs" />
                    <div>
                      <p className="text-white text-xs font-medium">
                        {proposal.opponent.display_name ?? proposal.opponent.username}
                      </p>
                      <p className="text-surface-500 text-xs">@{proposal.opponent.username}</p>
                    </div>
                  </div>
                )}
                <p className="text-surface-300 text-sm leading-relaxed whitespace-pre-line">
                  {proposal.opposition_speech}
                </p>
              </>
            ) : (
              <div className="space-y-2">
                <Users className="h-8 w-8 text-surface-500 mx-auto" />
                <p className="text-surface-400 text-sm font-medium">Seeking Opposition</p>
                <p className="text-surface-500 text-xs">
                  Any citizen may rise to speak against this bill.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          {proposal.status === 'seeking_opponent' && (
            <OppositionForm proposalId={proposal.id} onSuccess={load} />
          )}
          {proposal.status === 'voting' && (
            <VotePanel proposal={proposal} onVoted={load} />
          )}
          {proposal.status === 'passed' && (
            <div className="bg-emerald/10 border border-emerald/30 rounded-xl p-5 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald mx-auto mb-2" />
              <p className="text-emerald font-semibold text-sm mb-1">The House Approved Introduction</p>
              <p className="text-surface-400 text-xs mb-4">
                This bill passed with {proposal.votes_for} votes for introduction.
                The sponsor may now formally introduce it in the chamber.
              </p>
              <Link href="/bills/introduce">
                <Button className="gap-2">
                  <Gavel className="h-4 w-4" />
                  Introduce as a Formal Bill
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
          {proposal.status === 'rejected' && (
            <div className="bg-against-950/50 border border-against-500/30 rounded-xl p-5 text-center">
              <XCircle className="h-8 w-8 text-against-400 mx-auto mb-2" />
              <p className="text-against-400 font-semibold text-sm mb-1">The House Voted Against Introduction</p>
              <p className="text-surface-400 text-xs">
                {proposal.votes_against} voted against, {proposal.votes_for} voted for.
                The proposal has been archived in the parliamentary record.
              </p>
            </div>
          )}
          {(proposal.status === 'passed' || proposal.status === 'rejected') && (
            <div className="text-center">
              <Link
                href="/hansard"
                className="inline-flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors"
              >
                <ScrollText className="h-3 w-3" />
                View in the Hansard
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Refresh */}
        <div className="flex justify-center mt-6">
          <button
            onClick={load}
            className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
