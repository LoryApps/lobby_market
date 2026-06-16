'use client'

/**
 * /coalitions/[id]/challenges — Coalition Challenge Board
 *
 * Formal inter-coalition debate challenges. Leaders and officers can:
 *   - Issue challenges to rival coalitions on specific topics
 *   - Accept or decline incoming challenges (with stance declaration)
 *   - View challenge history and win/loss outcomes
 *
 * Challenges create accountability: when a challenged coalition accepts,
 * both sides publicly declare their stance and members who argue on that
 * topic earn bonus influence toward the outcome.
 *
 * Distinct from:
 *   /coalitions/[id]/war-room    — internal tactical dashboard
 *   /coalitions/[id]/analytics  — historical metrics
 *   /debate/[id]                 — individual user debate challenges
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  BarChart2,
  Check,
  ChevronRight,
  Clock,
  Coins,
  Flame,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ChallengeWithDetails,
  ChallengesResponse,
} from '@/app/api/coalitions/[id]/challenges/route'

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

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d >= 1) return `${d}d left`
  if (h >= 1) return `${h}h left`
  return 'Expiring soon'
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Swords }> = {
  pending:  { label: 'Pending',  color: 'text-gold',          bg: 'bg-gold/10 border-gold/30',          icon: Clock   },
  accepted: { label: 'Active',   color: 'text-for-400',       bg: 'bg-for-500/10 border-for-500/30',    icon: Swords  },
  declined: { label: 'Declined', color: 'text-surface-500',   bg: 'bg-surface-200 border-surface-300',  icon: X       },
  expired:  { label: 'Expired',  color: 'text-surface-500',   bg: 'bg-surface-200 border-surface-300',  icon: Clock   },
  resolved: { label: 'Resolved', color: 'text-emerald',       bg: 'bg-emerald/10 border-emerald/30',    icon: Trophy  },
}

const STANCE_CONFIG = {
  for:     { label: 'FOR',     color: 'text-for-400',     bg: 'bg-for-500/10 border-for-500/20',     icon: ThumbsUp   },
  against: { label: 'AGAINST', color: 'text-against-400', bg: 'bg-against-500/10 border-against-500/20', icon: ThumbsDown },
  neutral: { label: 'NEUTRAL', color: 'text-surface-400', bg: 'bg-surface-200 border-surface-300',   icon: Shield     },
}

const TOPIC_STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Challenge card ────────────────────────────────────────────────────────────

interface ChallengeCardProps {
  challenge: ChallengeWithDetails
  coalitionId: string
  role: 'leader' | 'officer' | 'member' | null
  onRespond: (id: string, action: 'accept' | 'decline', stance?: string) => void
  responding: string | null
}

function ChallengeCard({ challenge, coalitionId, role, onRespond, responding }: ChallengeCardProps) {
  const [showRespondForm, setShowRespondForm] = useState(false)
  const [selectedStance, setSelectedStance] = useState<'for' | 'against' | 'neutral'>('for')

  const isSent     = challenge.challengerId === coalitionId
  const isReceived = challenge.challengedId === coalitionId
  const canRespond = isReceived && challenge.status === 'pending' && (role === 'leader' || role === 'officer')

  const statusCfg = STATUS_CONFIG[challenge.status] ?? STATUS_CONFIG.pending
  const StatusIcon = statusCfg.icon

  const challengerStanceCfg = challenge.challengerStance ? STANCE_CONFIG[challenge.challengerStance] : null
  const challengedStanceCfg = challenge.challengedStance ? STANCE_CONFIG[challenge.challengedStance] : null

  const winnerName = challenge.winnerId === challenge.challengerId
    ? challenge.challengerName
    : challenge.winnerId === challenge.challengedId
      ? challenge.challengedName
      : null

  const isLoading = responding === challenge.id

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300/60 overflow-hidden"
    >
      {/* Header row */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {/* Status badge */}
        <div className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-semibold flex-shrink-0 mt-0.5',
          statusCfg.bg,
          statusCfg.color
        )}>
          <StatusIcon className="h-3 w-3" />
          {statusCfg.label}
        </div>

        {/* Topic */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/topic/${challenge.topicId}`}
            className="text-sm font-medium text-white hover:text-for-300 transition-colors line-clamp-2 leading-snug"
          >
            {challenge.topicStatement}
          </Link>
          <div className="flex items-center gap-2 mt-1">
            {challenge.topicCategory && (
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                {challenge.topicCategory}
              </span>
            )}
            {TOPIC_STATUS_BADGE[challenge.topicStatus] && (
              <Badge variant={TOPIC_STATUS_BADGE[challenge.topicStatus]} size="xs">
                {challenge.topicStatus}
              </Badge>
            )}
          </div>
        </div>

        {/* Expiry (pending only) */}
        {challenge.status === 'pending' && (
          <span className="text-[10px] font-mono text-gold flex-shrink-0">
            {timeUntil(challenge.expiresAt)}
          </span>
        )}
      </div>

      {/* Matchup row */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          {/* Challenger side */}
          <div className={cn(
            'flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border',
            isSent ? 'bg-for-500/5 border-for-500/20' : 'bg-surface-200/60 border-surface-300/40'
          )}>
            <Swords className={cn('h-3.5 w-3.5 flex-shrink-0', isSent ? 'text-for-400' : 'text-surface-500')} />
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Challenger</p>
              <p className="text-xs font-semibold text-white truncate">{challenge.challengerName}</p>
            </div>
            {challengerStanceCfg && (
              <span className={cn(
                'ml-auto text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border',
                challengerStanceCfg.bg,
                challengerStanceCfg.color
              )}>
                {challengerStanceCfg.label}
              </span>
            )}
          </div>

          <div className="flex-shrink-0 text-surface-500 font-mono text-xs font-bold">VS</div>

          {/* Challenged side */}
          <div className={cn(
            'flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border',
            isReceived ? 'bg-against-500/5 border-against-500/20' : 'bg-surface-200/60 border-surface-300/40'
          )}>
            <Shield className={cn('h-3.5 w-3.5 flex-shrink-0', isReceived ? 'text-against-400' : 'text-surface-500')} />
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Challenged</p>
              <p className="text-xs font-semibold text-white truncate">{challenge.challengedName}</p>
            </div>
            {challengedStanceCfg && (
              <span className={cn(
                'ml-auto text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border',
                challengedStanceCfg.bg,
                challengedStanceCfg.color
              )}>
                {challengedStanceCfg.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Message */}
      {challenge.message && (
        <div className="mx-4 mb-3 px-3 py-2.5 rounded-xl bg-surface-200/60 border border-surface-300/40">
          <p className="text-xs text-surface-400 italic">&ldquo;{challenge.message}&rdquo;</p>
        </div>
      )}

      {/* Stake + winner */}
      <div className="px-4 pb-3 flex items-center gap-3">
        {challenge.stakeClout > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-gold">
            <Coins className="h-3.5 w-3.5" />
            <span>{challenge.stakeClout.toLocaleString()} Clout at stake</span>
          </div>
        )}
        {challenge.status === 'resolved' && winnerName && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald">
            <Trophy className="h-3.5 w-3.5" />
            <span>{winnerName} won</span>
          </div>
        )}
        <Link
          href={`/coalitions/rivalry/${challenge.challengerId}/vs/${challenge.challengedId}`}
          className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-purple transition-colors"
        >
          <Swords className="h-3 w-3" />
          Rivalry
          <ChevronRight className="h-3 w-3" />
        </Link>
        <div className="ml-auto flex items-center gap-1.5">
          <Avatar
            src={challenge.issuedByAvatarUrl}
            username={challenge.issuedByUsername}
            size="xs"
          />
          <span className="text-[10px] font-mono text-surface-500">
            issued by{' '}
            <Link href={`/profile/${challenge.issuedByUsername}`} className="text-surface-400 hover:text-white">
              @{challenge.issuedByUsername}
            </Link>{' '}
            {relativeTime(challenge.createdAt)}
          </span>
        </div>
      </div>

      {/* Respond form (received + pending + officer/leader) */}
      <AnimatePresence>
        {canRespond && !showRespondForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-4 flex items-center gap-2"
          >
            <Button
              size="sm"
              onClick={() => setShowRespondForm(true)}
              className="flex-1 bg-for-600/80 hover:bg-for-600 text-white border-for-500/30"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" /> Accept Challenge
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRespond(challenge.id, 'decline')}
              disabled={isLoading}
              className="flex-1 border border-surface-300/60 text-surface-400 hover:text-against-400 hover:border-against-500/30"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5 mr-1.5" />}
              Decline
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {canRespond && showRespondForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-4 space-y-3 overflow-hidden border-t border-surface-300/40 pt-3"
          >
            <p className="text-xs font-mono text-surface-400">Declare your coalition&apos;s stance to accept:</p>
            <div className="grid grid-cols-3 gap-2">
              {(['for', 'against', 'neutral'] as const).map((s) => {
                const cfg = STANCE_CONFIG[s]
                const Icon = cfg.icon
                return (
                  <button
                    key={s}
                    onClick={() => setSelectedStance(s)}
                    className={cn(
                      'flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-mono font-semibold transition-all',
                      selectedStance === s
                        ? cn(cfg.bg, cfg.color, 'ring-1 ring-current')
                        : 'bg-surface-200/60 border-surface-300/40 text-surface-500 hover:border-surface-400'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onRespond(challenge.id, 'accept', selectedStance)}
                disabled={isLoading}
                className="flex-1 bg-for-600/80 hover:bg-for-600 text-white"
              >
                {isLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <><Check className="h-3.5 w-3.5 mr-1.5" /> Confirm Accept</>
                }
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowRespondForm(false)}
                className="border border-surface-300/60 text-surface-400"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Issue challenge form ─────────────────────────────────────────────────────

interface IssueChallengeFormProps {
  coalitionId: string
  onClose: () => void
  onSuccess: () => void
}

function IssueChallengeForm({ coalitionId, onClose, onSuccess }: IssueChallengeFormProps) {
  const [topicQuery, setTopicQuery] = useState('')
  const [topicResults, setTopicResults] = useState<Array<{ id: string; statement: string; category: string | null; status: string }>>([])
  const [selectedTopic, setSelectedTopic] = useState<{ id: string; statement: string } | null>(null)
  const [rivalQuery, setRivalQuery] = useState('')
  const [allCoalitions, setAllCoalitions] = useState<Array<{ id: string; name: string }>>([])
  const [rivalResults, setRivalResults] = useState<Array<{ id: string; name: string }>>([])
  const [selectedRival, setSelectedRival] = useState<{ id: string; name: string } | null>(null)
  const [stance, setStance] = useState<'for' | 'against' | 'neutral'>('for')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const topicTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleTopicSearch(q: string) {
    setTopicQuery(q)
    setSelectedTopic(null)
    if (topicTimer.current) clearTimeout(topicTimer.current)
    if (!q.trim()) { setTopicResults([]); return }
    topicTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=topics&status=active`)
        if (!res.ok) return
        const data = await res.json()
        setTopicResults((data.results ?? []).slice(0, 6))
      } catch {}
    }, 300)
  }

  useEffect(() => {
    fetch('/api/coalitions?limit=100')
      .then((r) => r.json())
      .then((d) => {
        const list = (d.coalitions ?? [])
          .filter((c: { id: string; name: string }) => c.id !== coalitionId)
          .map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))
        setAllCoalitions(list)
      })
      .catch(() => {})
  }, [coalitionId])

  function handleRivalSearch(q: string) {
    setRivalQuery(q)
    setSelectedRival(null)
    if (!q.trim()) { setRivalResults([]); return }
    const lower = q.toLowerCase()
    setRivalResults(
      allCoalitions.filter((c) => c.name.toLowerCase().includes(lower)).slice(0, 6)
    )
  }

  async function handleSubmit() {
    if (!selectedTopic || !selectedRival) {
      setError('Select a topic and rival coalition first')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: selectedTopic.id,
          challengedId: selectedRival.id,
          stance,
          message: message.trim() || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? 'Failed to issue challenge')
        return
      }
      onSuccess()
    } catch {
      setError('Network error — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg rounded-3xl bg-surface-100 border border-surface-300/60 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-300/40">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/10 border border-against-500/20">
            <Swords className="h-4 w-4 text-against-400" />
          </div>
          <div>
            <h2 className="font-mono text-sm font-bold text-white">Issue Challenge</h2>
            <p className="text-[11px] text-surface-500">Challenge a rival coalition to a formal debate</p>
          </div>
          <button onClick={onClose} className="ml-auto text-surface-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Topic picker */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">
              Choose Topic
            </label>
            {selectedTopic ? (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-for-500/10 border border-for-500/20">
                <Flame className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white flex-1 line-clamp-2">{selectedTopic.statement}</p>
                <button onClick={() => { setSelectedTopic(null); setTopicQuery('') }} className="text-surface-500 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search active topics…"
                  value={topicQuery}
                  onChange={(e) => handleTopicSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500/40 transition-colors font-mono"
                />
                {topicResults.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full rounded-xl bg-surface-100 border border-surface-300/60 shadow-xl overflow-hidden">
                    {topicResults.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => { setSelectedTopic({ id: t.id, statement: t.statement }); setTopicResults([]) }}
                        className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-surface-200 text-left transition-colors"
                      >
                        <Flame className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs text-white line-clamp-1">{t.statement}</p>
                          {t.category && (
                            <p className="text-[10px] font-mono text-surface-500 mt-0.5">{t.category}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rival coalition picker */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">
              Challenge Rival
            </label>
            {selectedRival ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-against-500/10 border border-against-500/20">
                <Shield className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                <p className="text-xs text-white flex-1 font-semibold">{selectedRival.name}</p>
                <button onClick={() => { setSelectedRival(null); setRivalQuery('') }} className="text-surface-500 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search coalitions…"
                  value={rivalQuery}
                  onChange={(e) => handleRivalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-against-500/40 transition-colors font-mono"
                />
                {rivalResults.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full rounded-xl bg-surface-100 border border-surface-300/60 shadow-xl overflow-hidden">
                    {rivalResults.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedRival({ id: c.id, name: c.name }); setRivalResults([]) }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-surface-200 text-left transition-colors"
                      >
                        <Shield className="h-3.5 w-3.5 text-surface-500" />
                        <p className="text-xs text-white font-semibold">{c.name}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stance */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">
              Your Stance
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['for', 'against', 'neutral'] as const).map((s) => {
                const cfg = STANCE_CONFIG[s]
                const Icon = cfg.icon
                return (
                  <button
                    key={s}
                    onClick={() => setStance(s)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-mono font-semibold transition-all',
                      stance === s
                        ? cn(cfg.bg, cfg.color, 'ring-1 ring-current')
                        : 'bg-surface-200/60 border-surface-300/40 text-surface-500 hover:border-surface-400'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Optional message */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">
              Message <span className="font-normal text-surface-600">(optional, max 500 chars)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              placeholder="State your case or lay down the gauntlet…"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-surface-400 transition-colors font-mono resize-none"
            />
            <p className="text-[10px] font-mono text-surface-600 text-right">{message.length}/500</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-against-500/10 border border-against-500/30">
              <AlertCircle className="h-4 w-4 text-against-400 flex-shrink-0" />
              <p className="text-xs text-against-400">{error}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-surface-300/40 flex gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 border border-surface-300/60 text-surface-400"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !selectedTopic || !selectedRival}
            className="flex-1 bg-against-600/80 hover:bg-against-600 text-white border-against-500/30"
          >
            {submitting
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <><Swords className="h-4 w-4 mr-1.5" /> Issue Challenge</>
            }
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChallengeSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-4 flex-1" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-14 flex-1 rounded-xl" />
        <Skeleton className="h-14 w-8 rounded" />
        <Skeleton className="h-14 flex-1 rounded-xl" />
      </div>
      <Skeleton className="h-4 w-40" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'received' | 'sent' | 'history'

export default function CoalitionChallengesPage() {
  const { id: coalitionId } = useParams<{ id: string }>()

  const [data, setData] = useState<ChallengesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('received')
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [responding, setResponding] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/challenges`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load challenges')
    } finally {
      setLoading(false)
    }
  }, [coalitionId])

  useEffect(() => { load() }, [load])

  async function handleRespond(challengeId: string, action: 'accept' | 'decline', stance?: string) {
    setResponding(challengeId)
    try {
      const res = await fetch(`/api/coalition-challenges/${challengeId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, stance }),
      })
      if (res.ok) {
        await load()
        if (action === 'accept') setTab('sent')
      }
    } catch {}
    setResponding(null)
  }

  const canIssue = data?.currentUserRole === 'leader' || data?.currentUserRole === 'officer'

  const TAB_DATA = {
    received: data?.received ?? [],
    sent:     data?.sent ?? [],
    history:  data?.history ?? [],
  }

  const TAB_CONFIG: { id: Tab; label: string; icon: typeof Swords }[] = [
    { id: 'received', label: `Incoming (${data?.received.length ?? 0})`, icon: Shield },
    { id: 'sent',     label: `Sent (${data?.sent.length ?? 0})`,     icon: Swords },
    { id: 'history',  label: 'History',                                icon: Trophy },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back nav */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/coalitions/${coalitionId}`}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300/60 text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Back to coalition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-lg font-bold text-white truncate">
              Challenge Board
            </h1>
            {data && (
              <p className="text-xs text-surface-500 font-mono">{data.coalition.name}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/coalitions/clashes"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300/60 text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Global clashes"
              title="All coalition clashes"
            >
              <Globe className="h-4 w-4" />
            </Link>
            <Link
              href={`/coalitions/${coalitionId}/analytics`}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300/60 text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Coalition analytics"
            >
              <BarChart2 className="h-4 w-4" />
            </Link>
            <Link
              href={`/coalitions/${coalitionId}/war-room`}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300/60 text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="War room"
            >
              <Zap className="h-4 w-4" />
            </Link>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300/60 text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* How it works card */}
        <div className="mb-5 rounded-2xl bg-surface-100 border border-surface-300/60 p-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-against-500/10 border border-against-500/20 flex-shrink-0">
              <Swords className="h-4.5 w-4.5 text-against-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white font-mono mb-1">Coalition Challenges</h2>
              <p className="text-xs text-surface-400 leading-relaxed">
                Formally challenge a rival coalition to debate a specific topic.
                Both sides declare their public stance. When the topic resolves, the coalition whose stance matches the outcome wins — earning influence and updating the win record.
              </p>
            </div>
          </div>
          {canIssue && (
            <button
              onClick={() => setShowIssueForm(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-against-600/80 hover:bg-against-600 text-white text-sm font-mono font-semibold transition-colors border border-against-500/30"
            >
              <Plus className="h-4 w-4" />
              Issue Challenge
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 p-1 rounded-xl bg-surface-100 border border-surface-300/60">
          {TAB_CONFIG.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                  tab === t.id
                    ? 'bg-surface-200 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.id === 'received' ? 'In' : t.id === 'sent' ? 'Out' : 'Log'}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => <ChallengeSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-against-400" />
            <p className="text-sm text-surface-400">{error}</p>
            <button
              onClick={load}
              className="px-4 py-2 rounded-xl bg-surface-100 border border-surface-300 text-sm text-white hover:bg-surface-200 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : TAB_DATA[tab].length === 0 ? (
          <EmptyState
            icon={tab === 'received' ? Shield : tab === 'sent' ? Swords : Trophy}
            title={
              tab === 'received' ? 'No incoming challenges' :
              tab === 'sent'     ? 'No challenges issued' :
              'No challenge history yet'
            }
            description={
              tab === 'received' ? 'Rival coalitions have not challenged you yet.' :
              tab === 'sent'     ? canIssue ? 'Issue your first challenge to a rival coalition.' : 'No challenges have been sent.' :
              'Challenge history will appear here after challenges resolve.'
            }
            actions={canIssue && tab === 'sent' ? [{
              label: 'Issue Challenge',
              onClick: () => setShowIssueForm(true),
            }] : undefined}
          />
        ) : (
          <div className="space-y-3">
            {TAB_DATA[tab].map((challenge) => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                coalitionId={coalitionId}
                role={data?.currentUserRole ?? null}
                onRespond={handleRespond}
                responding={responding}
              />
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      <AnimatePresence>
        {showIssueForm && (
          <IssueChallengeForm
            coalitionId={coalitionId}
            onClose={() => setShowIssueForm(false)}
            onSuccess={() => {
              setShowIssueForm(false)
              setTab('sent')
              load()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
