'use client'

/**
 * Bill Detail — /bills/[id]
 *
 * Shows the full detail of a civic bill: its reading timeline,
 * current stage, vote tallies, amendments, and sponsor info.
 * Citizens can vote FOR/AGAINST/ABSTAIN at Second and Third Reading.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Crown,
  FileText,
  Landmark,
  Loader2,
  Scale,
  ScrollText,
  Settings2,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Vote,
  XCircle,
  Clock,
  GitMerge,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { BillDetail as BillDetailType, BillAmendment } from '@/app/api/bills/[id]/route'

// ─── Stage config ──────────────────────────────────────────────────────────────

const STAGE_STEPS: Array<{ key: string; label: string; icon: React.ReactNode; dateKey: keyof BillDetailType }> = [
  { key: 'first_reading',   label: 'First Reading',   icon: <FileText    className="h-4 w-4" />, dateKey: 'first_reading_at' },
  { key: 'second_reading',  label: 'Second Reading',  icon: <Vote        className="h-4 w-4" />, dateKey: 'second_reading_at' },
  { key: 'committee_stage', label: 'Committee Stage', icon: <Users       className="h-4 w-4" />, dateKey: 'committee_at' },
  { key: 'report_stage',    label: 'Report Stage',    icon: <ScrollText  className="h-4 w-4" />, dateKey: 'report_at' },
  { key: 'third_reading',   label: 'Third Reading',   icon: <CheckCircle2 className="h-4 w-4" />, dateKey: 'third_reading_at' },
  { key: 'lords',           label: 'Lords',           icon: <Crown       className="h-4 w-4" />, dateKey: 'lords_at' },
  { key: 'royal_assent',    label: 'Royal Assent',    icon: <Trophy      className="h-4 w-4" />, dateKey: 'royal_assent_at' },
]

const STAGE_ORDER = ['first_reading','second_reading','committee_stage','report_stage','third_reading','lords','royal_assent']

const STAGE_DESCRIPTION: Record<string, string> = {
  first_reading:   'The bill is formally introduced to Parliament. No debate takes place — only the title is read.',
  second_reading:  'The general principles of the bill are debated. Citizens vote FOR or AGAINST the bill proceeding.',
  committee_stage: 'A select committee examines the bill line-by-line, hearing evidence and considering amendments.',
  report_stage:    'The full chamber considers the committee\'s amendments. Further changes may be proposed.',
  third_reading:   'The final opportunity for Parliament to approve or reject the amended bill. Only minor changes are allowed.',
  lords:           'The House of Lords scrutinises the bill, may propose amendments, or pass it without change.',
  royal_assent:    'The bill receives the ceremonial seal of civic authority and becomes law.',
  defeated:        'The bill was voted down and will not proceed further without reintroduction.',
  withdrawn:       'The bill\'s sponsor withdrew it before it could complete the reading process.',
}

const BILL_TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  government:      { label: 'Government Bill',      color: 'text-for-400 border-for-700/40 bg-for-900/20',         icon: <Landmark  className="h-3.5 w-3.5" /> },
  private_members: { label: 'Private Member\'s Bill', color: 'text-purple border-purple/40 bg-purple/10',           icon: <FileText  className="h-3.5 w-3.5" /> },
  opposition:      { label: 'Opposition Bill',      color: 'text-against-400 border-against-700/40 bg-against-900/20', icon: <Shield    className="h-3.5 w-3.5" /> },
  lords:           { label: "Lords' Bill",          color: 'text-gold border-gold/40 bg-gold/10',                  icon: <Crown     className="h-3.5 w-3.5" /> },
}

const AMENDMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  tabled:    { label: 'Tabled',    color: 'text-surface-400 border-surface-700/40 bg-surface-800/50' },
  accepted:  { label: 'Accepted',  color: 'text-emerald border-emerald/40 bg-emerald/10' },
  rejected:  { label: 'Rejected',  color: 'text-against-400 border-against-700/40 bg-against-900/20' },
  withdrawn: { label: 'Withdrawn', color: 'text-surface-400 border-surface-700/40 bg-surface-800/30' },
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

// ─── Reading Timeline ──────────────────────────────────────────────────────────

function ReadingTimeline({ bill }: { bill: BillDetailType }) {
  const currentIdx = STAGE_ORDER.indexOf(bill.stage)
  const isDefeated  = bill.stage === 'defeated' || bill.stage === 'withdrawn'

  return (
    <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 mb-4">
      <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <GitMerge className="h-4 w-4 text-for-400" />
        Reading Journey
      </h2>

      <div className="space-y-3">
        {STAGE_STEPS.map(({ key, label, icon, dateKey }, idx) => {
          const stageIdx   = STAGE_ORDER.indexOf(key)
          const isPast     = !isDefeated && stageIdx < currentIdx
          const isCurrent  = !isDefeated && key === bill.stage
          const dateValue  = bill[dateKey] as string | null

          return (
            <div key={key} className="flex items-start gap-3">
              {/* Connector line */}
              <div className="flex flex-col items-center">
                <div className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-colors',
                  isPast    ? 'bg-for-600 border-for-500 text-white'   :
                  isCurrent ? 'bg-for-500 border-for-400 text-white ring-2 ring-for-400/30' :
                              'bg-surface-800 border-surface-700 text-surface-500'
                )}>
                  {isPast ? <CheckCircle2 className="h-4 w-4" /> : icon}
                </div>
                {idx < STAGE_STEPS.length - 1 && (
                  <div className={cn(
                    'w-0.5 flex-1 mt-1',
                    isPast ? 'bg-for-600' : 'bg-surface-700'
                  )} style={{ height: '16px' }} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'text-sm font-medium',
                    isPast    ? 'text-for-300' :
                    isCurrent ? 'text-white' :
                                'text-surface-500'
                  )}>
                    {label}
                  </span>
                  {dateValue && (
                    <span className="text-[11px] text-surface-500">
                      {formatDate(dateValue)}
                    </span>
                  )}
                </div>
                {isCurrent && (
                  <p className="text-surface-400 text-xs mt-0.5 leading-relaxed">
                    {STAGE_DESCRIPTION[key]}
                  </p>
                )}
                {isCurrent && key === 'second_reading' && bill.debate_closes_at && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-gold">
                    <Clock className="h-3 w-3" />
                    Debate closes {formatDate(bill.debate_closes_at)}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Defeated/Withdrawn end state */}
        {isDefeated && (
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full flex items-center justify-center border-2 bg-against-900/30 border-against-700/50 text-against-400 shrink-0">
              <XCircle className="h-4 w-4" />
            </div>
            <div className="flex-1 pb-2">
              <span className="text-sm font-medium text-against-400">
                {bill.stage === 'defeated' ? 'Bill Defeated' : 'Bill Withdrawn'}
              </span>
              <p className="text-surface-500 text-xs mt-0.5">
                {STAGE_DESCRIPTION[bill.stage]}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Vote panel ────────────────────────────────────────────────────────────────

function VotePanel({
  bill,
  onVote,
  voting,
}: {
  bill: BillDetailType
  onVote: (position: 'for' | 'against' | 'abstain') => void
  voting: boolean
}) {
  const canVote = bill.stage === 'second_reading' || bill.stage === 'third_reading'
  if (!canVote) return null

  const total = bill.votes_for + bill.votes_against
  const forPct = total > 0 ? Math.round((bill.votes_for / total) * 100) : 50

  const reading = bill.stage === 'second_reading' ? '2nd Reading' : '3rd Reading'

  return (
    <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Vote className="h-4 w-4 text-for-400" />
          Your Vote — {reading}
        </h2>
        {bill.user_vote && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full border',
            bill.user_vote === 'for'     ? 'text-for-400 border-for-700/40 bg-for-900/20' :
            bill.user_vote === 'against' ? 'text-against-400 border-against-700/40 bg-against-900/20' :
                                           'text-surface-400 border-surface-700/40 bg-surface-800/50'
          )}>
            Voted: {bill.user_vote === 'for' ? 'For' : bill.user_vote === 'against' ? 'Against' : 'Abstain'}
          </span>
        )}
      </div>

      {/* Tally */}
      {total > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-for-400 font-medium">{bill.votes_for.toLocaleString()} For ({forPct}%)</span>
            <span className="text-against-400 font-medium">{bill.votes_against.toLocaleString()} Against ({100 - forPct}%)</span>
          </div>
          <div className="h-2 rounded-full bg-surface-700 overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-for-600 to-for-400 transition-all"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-against-400 to-against-600 transition-all"
              style={{ width: `${100 - forPct}%` }}
            />
          </div>
          <div className="text-surface-500 text-[11px] mt-1 text-center">
            {total.toLocaleString()} votes cast
          </div>
        </div>
      )}

      {/* Vote buttons */}
      <div className="grid grid-cols-3 gap-2">
        {(['for', 'against', 'abstain'] as const).map((pos) => (
          <button
            key={pos}
            onClick={() => onVote(pos)}
            disabled={voting}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-xs font-medium transition-all',
              bill.user_vote === pos
                ? pos === 'for'
                  ? 'bg-for-600 border-for-500 text-white'
                  : pos === 'against'
                  ? 'bg-against-600 border-against-500 text-white'
                  : 'bg-surface-700 border-surface-600 text-white'
                : 'border-surface-700/50 bg-surface-800/40 text-surface-400 hover:border-surface-600 hover:text-white'
            )}
          >
            {voting && bill.user_vote === pos ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : pos === 'for' ? (
              <ThumbsUp className="h-4 w-4" />
            ) : pos === 'against' ? (
              <ThumbsDown className="h-4 w-4" />
            ) : (
              <Scale className="h-4 w-4" />
            )}
            <span>{pos === 'for' ? 'For' : pos === 'against' ? 'Against' : 'Abstain'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Amendments ───────────────────────────────────────────────────────────────

function AmendmentCard({ amendment }: { amendment: BillAmendment }) {
  const statusConf = AMENDMENT_STATUS_CONFIG[amendment.status] ?? AMENDMENT_STATUS_CONFIG.tabled
  const total = amendment.votes_for + amendment.votes_against
  const forPct = total > 0 ? Math.round((amendment.votes_for / total) * 100) : null

  return (
    <div className="rounded-lg border border-surface-700/50 bg-surface-800/40 p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <span className="text-xs font-mono text-surface-500 mr-2">{amendment.clause_number}</span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', statusConf.color)}>
            {statusConf.label}
          </span>
        </div>
        {forPct !== null && (
          <span className="text-[11px] text-surface-500">{forPct}% for</span>
        )}
      </div>
      <p className="text-surface-300 text-xs leading-relaxed">{amendment.amendment}</p>
      {amendment.proposer && (
        <div className="flex items-center gap-1.5 mt-2">
          <Avatar src={amendment.proposer.avatar_url} username={amendment.proposer.username} size="xs" />
          <span className="text-surface-500 text-[11px]">
            {amendment.proposer.display_name ?? amendment.proposer.username}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Sponsor controls ─────────────────────────────────────────────────────────

const NEXT_STAGE_LABEL: Record<string, string> = {
  first_reading:   'Second Reading',
  second_reading:  'Committee Stage',
  committee_stage: 'Report Stage',
  report_stage:    'Third Reading',
  third_reading:   'Lords Consideration',
  lords:           'Royal Assent',
}

function SponsorControls({
  bill,
  onAdvance,
  advancing,
}: {
  bill: BillDetailType
  onAdvance: (action: string) => void
  advancing: boolean
}) {
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)

  const isTerminal   = ['royal_assent', 'defeated', 'withdrawn'].includes(bill.stage)
  const isLords      = bill.stage === 'lords'
  const isReadingVote = bill.stage === 'second_reading' || bill.stage === 'third_reading'

  // Determine vote outcome label if at a reading stage
  const total    = bill.votes_for + bill.votes_against
  const forPct   = total > 0 ? bill.votes_for / total : 0.5
  const passesByVote = total > 0 && forPct > 0.5

  const nextLabel = NEXT_STAGE_LABEL[bill.stage] ?? 'Next Stage'

  if (isTerminal) return null

  return (
    <div className="rounded-xl border border-for-700/40 bg-for-950/20 p-4 mb-4">
      <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-for-400" />
        Sponsor Controls
      </h2>

      {/* Vote outcome hint at reading stages */}
      {isReadingVote && total > 0 && (
        <div className={cn(
          'rounded-lg border px-3 py-2 text-xs mb-3 flex items-center gap-2',
          passesByVote
            ? 'border-emerald/30 bg-emerald/10 text-emerald'
            : 'border-against-700/40 bg-against-900/20 text-against-400'
        )}>
          {passesByVote ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          {passesByVote
            ? `Bill passes with ${Math.round(forPct * 100)}% in favour — advancing will move it to ${nextLabel}.`
            : `Bill currently fails with ${Math.round(forPct * 100)}% in favour — advancing will defeat the bill.`}
        </div>
      )}

      {isReadingVote && total === 0 && (
        <div className="rounded-lg border border-surface-700/40 bg-surface-800/40 px-3 py-2 text-xs mb-3 text-surface-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-gold" />
          No votes yet. Advancing will move the bill to {nextLabel} regardless.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {/* Lords-stage has pass/reject instead of generic advance */}
        {isLords ? (
          <>
            <button
              onClick={() => onAdvance('lords_pass')}
              disabled={advancing}
              className="flex items-center justify-center gap-2 rounded-lg bg-gold/10 border border-gold/40 text-gold text-sm font-medium px-4 py-2.5 hover:bg-gold/20 transition-colors disabled:opacity-50"
            >
              {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
              Lords Pass — Grant Royal Assent
            </button>
            <button
              onClick={() => onAdvance('lords_reject')}
              disabled={advancing}
              className="flex items-center justify-center gap-2 rounded-lg bg-against-900/20 border border-against-700/40 text-against-400 text-sm font-medium px-4 py-2.5 hover:bg-against-900/40 transition-colors disabled:opacity-50"
            >
              {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Lords Reject — Bill Defeated
            </button>
          </>
        ) : (
          <button
            onClick={() => onAdvance('advance')}
            disabled={advancing}
            className="flex items-center justify-center gap-2 rounded-lg bg-for-600/20 border border-for-600/40 text-for-300 text-sm font-medium px-4 py-2.5 hover:bg-for-600/30 transition-colors disabled:opacity-50"
          >
            {advancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {isReadingVote && total > 0 && !passesByVote
              ? 'Close Vote — Bill Defeated'
              : `Advance to ${nextLabel}`}
          </button>
        )}

        {/* Withdraw */}
        {confirmWithdraw ? (
          <div className="flex gap-2">
            <button
              onClick={() => { onAdvance('withdraw'); setConfirmWithdraw(false) }}
              disabled={advancing}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-surface-800 border border-against-700/40 text-against-400 text-xs font-medium px-3 py-2 hover:bg-against-900/30 transition-colors disabled:opacity-50"
            >
              Confirm Withdraw
            </button>
            <button
              onClick={() => setConfirmWithdraw(false)}
              className="flex-1 flex items-center justify-center rounded-lg bg-surface-800 border border-surface-700 text-surface-400 text-xs font-medium px-3 py-2 hover:border-surface-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmWithdraw(true)}
            className="text-xs text-surface-500 hover:text-surface-300 text-center py-1 transition-colors"
          >
            Withdraw this bill
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BillDetail({ billId }: { billId: string }) {
  const [bill, setBill] = useState<BillDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBill = useCallback(async () => {
    try {
      const res = await fetch(`/api/bills/${billId}`)
      if (!res.ok) throw new Error('Bill not found')
      const data: BillDetailType = await res.json()
      setBill(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bill')
    } finally {
      setLoading(false)
    }
  }, [billId])

  useEffect(() => { fetchBill() }, [fetchBill])

  const handleAdvance = useCallback(async (action: string) => {
    setAdvancing(true)
    try {
      const res = await fetch(`/api/bills/${billId}/advance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? 'Failed to advance bill')
      }
      const result = await res.json() as {
        stage: string; status: string
        second_reading_at: string | null; committee_at: string | null
        report_at: string | null; third_reading_at: string | null
        lords_at: string | null; royal_assent_at: string | null
        defeated_at: string | null
      }
      setBill((prev) => prev ? { ...prev, ...result } : prev)
    } catch (err) {
      console.error(err)
    } finally {
      setAdvancing(false)
    }
  }, [billId])

  const handleVote = useCallback(async (position: 'for' | 'against' | 'abstain') => {
    if (!bill) return
    const reading = bill.stage === 'second_reading' ? 'second_reading' : 'third_reading'

    setVoting(true)
    try {
      const res = await fetch(`/api/bills/${billId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reading, position }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? 'Failed to vote')
      }
      const result = await res.json() as { votes_for: number; votes_against: number }
      setBill((prev) => prev ? {
        ...prev,
        votes_for: result.votes_for,
        votes_against: result.votes_against,
        user_vote: position,
      } : prev)
    } catch (err) {
      console.error(err)
    } finally {
      setVoting(false)
    }
  }, [bill, billId])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 flex flex-col">
        <TopBar />
        <main className="flex-1 pb-24 max-w-2xl mx-auto w-full px-4 pt-4">
          <Skeleton className="h-4 w-20 rounded mb-4" />
          <Skeleton className="h-7 w-4/5 rounded mb-2" />
          <SkeletonText lines={3} className="mb-6" />
          <Skeleton className="h-48 w-full rounded-xl mb-4" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !bill) {
    return (
      <div className="min-h-screen bg-surface-950 flex flex-col">
        <TopBar />
        <main className="flex-1 pb-24 flex items-center justify-center">
          <div className="text-center">
            <XCircle className="h-10 w-10 text-against-500 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">Bill Not Found</p>
            <p className="text-surface-400 text-sm mb-4">{error}</p>
            <Link href="/bills" className="text-for-400 text-sm hover:underline">
              View all bills
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const typeConf = BILL_TYPE_CONFIG[bill.bill_type] ?? BILL_TYPE_CONFIG.government
  const isEnacted  = bill.stage === 'royal_assent'
  const isDefeated = bill.stage === 'defeated' || bill.stage === 'withdrawn'

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <TopBar />

      <main className="flex-1 pb-24">
        <div className="max-w-2xl mx-auto px-4 pt-4">

          {/* Back */}
          <Link
            href="/bills"
            className="inline-flex items-center gap-1.5 text-surface-400 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All Bills
          </Link>

          {/* Title block */}
          <div className={cn(
            'rounded-xl border p-5 mb-4',
            isEnacted  ? 'border-gold/40 bg-gold/5 ring-1 ring-gold/10' :
            isDefeated ? 'border-surface-700/50 bg-surface-900' :
                         'border-surface-700/50 bg-surface-900'
          )}>
            {/* Type + Category badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className={cn('text-xs px-2 py-0.5 rounded border font-medium flex items-center gap-1', typeConf.color)}>
                {typeConf.icon}
                {typeConf.label}
              </span>
              <span className="text-xs px-2 py-0.5 rounded border border-surface-700/50 text-surface-400 bg-surface-800/50">
                {bill.category}
              </span>
              {isEnacted && (
                <span className="text-xs px-2 py-0.5 rounded border border-gold/40 text-gold bg-gold/10 font-medium flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  Enacted
                </span>
              )}
              {isDefeated && (
                <span className="text-xs px-2 py-0.5 rounded border border-against-700/40 text-against-400 bg-against-900/20 font-medium">
                  {bill.stage === 'defeated' ? 'Defeated' : 'Withdrawn'}
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-white mb-2 leading-snug">
              {bill.short_title}
            </h1>
            <p className="text-surface-400 text-sm leading-relaxed mb-4">
              {bill.long_title}
            </p>

            {/* Sponsor */}
            {bill.sponsor ? (
              <div className="flex items-center gap-2 border-t border-surface-800 pt-3">
                <Avatar
                  src={bill.sponsor.avatar_url}
                  username={bill.sponsor.username}
                  size="sm"
                />
                <div>
                  <div className="text-sm font-medium text-white">
                    {bill.sponsor.display_name ?? bill.sponsor.username}
                  </div>
                  <div className="text-[11px] text-surface-500">Bill Sponsor · {relativeTime(bill.first_reading_at)}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 border-t border-surface-800 pt-3">
                <div className="h-8 w-8 rounded-full bg-for-900/40 flex items-center justify-center">
                  <Landmark className="h-4 w-4 text-for-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">The Government</div>
                  <div className="text-[11px] text-surface-500">Introduced {relativeTime(bill.first_reading_at)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Sponsor controls (only visible to the bill sponsor / elders) */}
          {bill.is_sponsor && !isEnacted && !isDefeated && (
            <SponsorControls bill={bill} onAdvance={handleAdvance} advancing={advancing} />
          )}

          {/* Vote panel (only at 2nd/3rd reading) */}
          <VotePanel bill={bill} onVote={handleVote} voting={voting} />

          {/* Reading timeline */}
          <ReadingTimeline bill={bill} />

          {/* Amendments */}
          {bill.amendments.length > 0 && (
            <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 mb-4">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-gold" />
                Amendments ({bill.amendments.length})
              </h2>
              <div className="space-y-2">
                {bill.amendments.map((amendment) => (
                  <AmendmentCard key={amendment.id} amendment={amendment} />
                ))}
              </div>
            </div>
          )}

          {/* Related links */}
          <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 mb-4">
            <h2 className="text-sm font-semibold text-white mb-3">Parliamentary System</h2>
            <div className="space-y-2">
              {[
                { href: '/bills', label: 'All Bills', desc: 'Full bill register', icon: <ScrollText className="h-4 w-4 text-for-400" /> },
                { href: '/committees', label: 'Select Committees', desc: 'Committee scrutiny', icon: <Users className="h-4 w-4 text-purple" /> },
                { href: '/lords', label: 'House of Lords', desc: 'Lords chamber', icon: <Crown className="h-4 w-4 text-gold" /> },
                { href: '/divisions', label: 'Division Bell', desc: 'Formal recorded votes', icon: <Scale className="h-4 w-4 text-for-400" /> },
              ].map(({ href, label, desc, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between rounded-lg border border-surface-700/40 bg-surface-800/40 px-3 py-2.5 hover:border-surface-600 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    {icon}
                    <div>
                      <div className="text-sm text-white group-hover:text-for-200 transition-colors">{label}</div>
                      <div className="text-[11px] text-surface-500">{desc}</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
