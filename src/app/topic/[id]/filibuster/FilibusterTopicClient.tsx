'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Gavel,
  Loader2,
  Mic,
  MinusCircle,
  Scale,
  ThumbsUp,
  X,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { FilibusterEntry, FilibusterGrounds, FilibusterStatus } from '@/app/api/filibuster/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function timeRemaining(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m remaining`
  return `${m}m remaining`
}

const GROUNDS_OPTIONS: { value: FilibusterGrounds; label: string; desc: string }[] = [
  { value: 'insufficient_debate', label: 'Insufficient Debate', desc: 'Not enough arguments have been raised on both sides' },
  { value: 'missing_evidence', label: 'Missing Evidence', desc: 'Key evidence or sources are absent from the debate' },
  { value: 'procedural', label: 'Procedural Objection', desc: 'The topic was not properly vetted or the vote was rushed' },
  { value: 'rights_concern', label: 'Rights Concern', desc: 'Potential rights implications have not been fully explored' },
  { value: 'constitutional', label: 'Constitutional Question', desc: 'The topic raises unresolved constitutional issues' },
]

const STATUS_CONFIG: Record<FilibusterStatus, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  active: { label: 'Active', color: 'text-gold border-gold/40 bg-gold/10', icon: Mic },
  overridden: { label: 'Cloture Invoked', color: 'text-against-400 border-against-500/40 bg-against-500/10', icon: Gavel },
  extended: { label: 'Debate Extended', color: 'text-emerald border-emerald/40 bg-emerald/10', icon: Check },
  lapsed: { label: 'Lapsed', color: 'text-surface-500 border-surface-400/40 bg-surface-300/10', icon: MinusCircle },
  withdrawn: { label: 'Withdrawn', color: 'text-surface-500 border-surface-400/40 bg-surface-300/10', icon: X },
}

function progressWidth(current: number, total: number): number {
  return Math.min(100, Math.round((Math.max(0, current) / Math.max(1, total)) * 100))
}

// ─── Topic Filibuster Client ──────────────────────────────────────────────────

interface TopicInfo {
  id: string
  statement: string
  status: string
  category: string | null
  blue_pct: number | null
  total_votes: number | null
}

interface Props {
  topic: TopicInfo
}

export function FilibusterTopicClient({ topic }: Props) {
  const router = useRouter()
  const [filibuster, setFilibuster] = useState<FilibusterEntry | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [filing, setFiling] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formSpeech, setFormSpeech] = useState('')
  const [formGrounds, setFormGrounds] = useState<FilibusterGrounds>('insufficient_debate')
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/topics/${topic.id}/filibuster`)
      if (res.ok) {
        const json = await res.json()
        setFilibuster(json.filibuster ?? null)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [topic.id])

  useEffect(() => {
    load()
  }, [load])

  const handleVote = useCallback(async (vote: 'cloture' | 'second') => {
    if (!filibuster) return
    setVoting(true)
    try {
      const res = await fetch(`/api/filibuster/${filibuster.id}/cloture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Failed')
      }
      const json = await res.json()
      setFilibuster((prev) =>
        prev
          ? {
              ...prev,
              cloture_count: json.cloture_count ?? prev.cloture_count,
              second_count: json.second_count ?? prev.second_count,
              status: json.status ?? prev.status,
              user_vote: vote,
            }
          : prev,
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed')
    } finally {
      setVoting(false)
    }
  }, [filibuster])

  const handleFile = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (formTitle.trim().length < 10) {
      setFormError('Title must be at least 10 characters.')
      return
    }
    if (formSpeech.trim().length < 150) {
      setFormError(`Speech must be at least 150 characters (currently ${formSpeech.trim().length}).`)
      return
    }
    setFiling(true)
    try {
      const res = await fetch('/api/filibuster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: topic.id,
          title: formTitle.trim(),
          speech: formSpeech.trim(),
          grounds: formGrounds,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to file')
      await load()
      setShowForm(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to file filibuster')
    } finally {
      setFiling(false)
    }
  }, [formTitle, formSpeech, formGrounds, topic.id, load])

  const canFilibuster = topic.status === 'voting' || topic.status === 'active'

  return (
    <div className="min-h-screen bg-surface-100 pb-24">
      {/* Back nav */}
      <div className="sticky top-0 z-40 bg-surface-100/90 backdrop-blur-sm border-b border-surface-300/40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <ChevronRight className="h-4 w-4 text-surface-500" />
          <span className="text-sm font-semibold text-white">Filibuster</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5">
        {/* Topic pill */}
        <Link
          href={`/topic/${topic.id}`}
          className="mb-4 flex items-center gap-2 text-xs text-for-400 hover:text-for-300 transition-colors group"
        >
          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate font-medium">{topic.statement}</span>
          <ArrowRight className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </Link>

        {/* Page title */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
            <Mic className="h-4 w-4 text-gold" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Civic Filibuster</h1>
            <p className="text-[11px] text-surface-500">
              Demand more debate time on this {topic.status} topic
            </p>
          </div>
        </div>

        {/* Explanation */}
        <div className="mb-5 p-3 rounded-xl bg-gold/5 border border-gold/20">
          <p className="text-xs text-surface-400 leading-relaxed">
            A filibuster is a parliamentary tool that halts a rushed vote and demands extended debate.
            File a filibuster with a substantive speech explaining why the community needs more time.
            Others can vote <span className="text-against-400 font-semibold">Cloture</span> (force the vote)
            or <span className="text-emerald font-semibold">Second</span> your filibuster (extend debate by{' '}
            48 hours).
          </p>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : filibuster ? (
          <ActiveFilibuster
            filibuster={filibuster}
            onVote={handleVote}
            voting={voting}
          />
        ) : (
          <div>
            {canFilibuster ? (
              <>
                <EmptyState
                  icon={Mic}
                  iconColor="text-gold"
                  iconBg="bg-gold/10"
                  iconBorder="border-gold/20"
                  title="No active filibuster"
                  description="This topic has no pending filibuster. If you believe the community needs more time to debate before the vote closes, file one now."
                  size="sm"
                />

                {!showForm ? (
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold/10 border border-gold/30 text-sm font-semibold text-gold hover:bg-gold/20 transition-colors"
                  >
                    <Mic className="h-4 w-4" />
                    File a Filibuster
                  </button>
                ) : (
                  <FilibusterForm
                    title={formTitle}
                    speech={formSpeech}
                    grounds={formGrounds}
                    error={formError}
                    filing={filing}
                    onTitleChange={setFormTitle}
                    onSpeechChange={setFormSpeech}
                    onGroundsChange={setFormGrounds}
                    onSubmit={handleFile}
                    onCancel={() => { setShowForm(false); setFormError(null) }}
                  />
                )}
              </>
            ) : (
              <EmptyState
                icon={Scale}
                iconColor="text-surface-400"
                iconBg="bg-surface-300/10"
                iconBorder="border-surface-300/20"
                title="Filibuster not available"
                description={`Filibusters can only be filed on topics in the voting or active phase. This topic is currently ${topic.status}.`}
                action={{ label: 'View topic', href: `/topic/${topic.id}`, icon: ArrowRight }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Active Filibuster View ───────────────────────────────────────────────────

function ActiveFilibuster({
  filibuster: f,
  onVote,
  voting,
}: {
  filibuster: FilibusterEntry
  onVote: (v: 'cloture' | 'second') => void
  voting: boolean
}) {
  const statusCfg = STATUS_CONFIG[f.status]
  const StatusIcon = statusCfg.icon
  const isActive = f.status === 'active'

  const clotureProgress = progressWidth(f.cloture_count, f.cloture_threshold)
  const secondProgress = progressWidth(f.second_count, f.second_threshold)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-gold/30 bg-gold/5 overflow-hidden"
    >
      {/* Status banner */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <span
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border',
            statusCfg.color,
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {statusCfg.label}
        </span>
        {isActive && (
          <span className="flex items-center gap-1.5 text-xs text-surface-400">
            <Clock className="h-3.5 w-3.5" />
            {timeRemaining(f.expires_at)}
          </span>
        )}
      </div>

      {/* Filibusterer */}
      {f.filibuster_user && (
        <div className="px-4 pb-3 flex items-center gap-2.5">
          <Avatar
            src={f.filibuster_user.avatar_url}
            fallback={f.filibuster_user.display_name ?? f.filibuster_user.username}
            size="sm"
          />
          <div>
            <Link
              href={`/profile/${f.filibuster_user.username}`}
              className="text-xs font-semibold text-white hover:text-for-300 transition-colors"
            >
              {f.filibuster_user.display_name ?? f.filibuster_user.username}
            </Link>
            <p className="text-[10px] text-surface-500">{relativeTime(f.created_at)}</p>
          </div>
        </div>
      )}

      {/* Title + grounds */}
      <div className="px-4 pb-2">
        <h2 className="text-sm font-bold text-white mb-1.5">{f.title}</h2>
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border border-surface-400/30 text-surface-400">
          {f.grounds.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Speech */}
      <div className="px-4 pb-4">
        <p className="text-sm text-surface-300 leading-relaxed whitespace-pre-wrap">{f.speech}</p>
      </div>

      {/* Vote progress */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-4 border-t border-surface-300/30 pt-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-against-400 font-mono">CLOTURE</span>
            <span className="text-xs text-surface-400 font-mono">
              {f.cloture_count} / {f.cloture_threshold}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-300/50 overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-against-500 transition-all duration-700"
              style={{ width: `${clotureProgress}%` }}
            />
          </div>
          <p className="text-[10px] text-surface-500">Force the vote to proceed</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-emerald font-mono">SECOND</span>
            <span className="text-xs text-surface-400 font-mono">
              {f.second_count} / {f.second_threshold}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-300/50 overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-emerald transition-all duration-700"
              style={{ width: `${secondProgress}%` }}
            />
          </div>
          <p className="text-[10px] text-surface-500">Extend debate +{f.extend_hours}h</p>
        </div>
      </div>

      {/* Vote buttons */}
      {isActive && (
        <div className="px-4 pb-4 flex gap-3">
          <button
            onClick={() => onVote('cloture')}
            disabled={voting || f.user_vote === 'cloture'}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all',
              f.user_vote === 'cloture'
                ? 'bg-against-500/20 border-against-500/50 text-against-300 cursor-default'
                : 'bg-against-500/10 border-against-500/30 text-against-400 hover:bg-against-500/20',
            )}
          >
            {voting && f.user_vote !== 'cloture' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : f.user_vote === 'cloture' ? (
              <Check className="h-4 w-4" />
            ) : (
              <Gavel className="h-4 w-4" />
            )}
            {f.user_vote === 'cloture' ? 'Voted Cloture' : 'Invoke Cloture'}
          </button>

          <button
            onClick={() => onVote('second')}
            disabled={voting || f.user_vote === 'second'}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all',
              f.user_vote === 'second'
                ? 'bg-emerald/20 border-emerald/50 text-emerald cursor-default'
                : 'bg-emerald/10 border-emerald/30 text-emerald/70 hover:bg-emerald/20',
            )}
          >
            {voting && f.user_vote !== 'second' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : f.user_vote === 'second' ? (
              <Check className="h-4 w-4" />
            ) : (
              <ThumbsUp className="h-4 w-4" />
            )}
            {f.user_vote === 'second' ? 'Seconded' : 'Second It'}
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── File Filibuster Form ─────────────────────────────────────────────────────

interface FormProps {
  title: string
  speech: string
  grounds: FilibusterGrounds
  error: string | null
  filing: boolean
  onTitleChange: (v: string) => void
  onSpeechChange: (v: string) => void
  onGroundsChange: (v: FilibusterGrounds) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
}

function FilibusterForm({
  title,
  speech,
  grounds,
  error,
  filing,
  onTitleChange,
  onSpeechChange,
  onGroundsChange,
  onSubmit,
  onCancel,
}: FormProps) {
  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={onSubmit}
      className="mt-4 space-y-4 rounded-xl border border-gold/30 bg-surface-200/50 p-4"
    >
      <div>
        <h3 className="text-sm font-bold text-white mb-1">File a Filibuster</h3>
        <p className="text-xs text-surface-500">
          State your case for why the community needs more debate time before this vote closes.
        </p>
      </div>

      {/* Grounds */}
      <div>
        <label className="block text-xs font-semibold text-surface-300 mb-2">
          Grounds for filibuster
        </label>
        <div className="grid grid-cols-1 gap-1.5">
          {GROUNDS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onGroundsChange(opt.value)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-lg border text-xs transition-all',
                grounds === opt.value
                  ? 'bg-gold/15 border-gold/40 text-white'
                  : 'bg-surface-300/20 border-surface-300/40 text-surface-400 hover:border-surface-400/60',
              )}
            >
              <span className="font-semibold block">{opt.label}</span>
              <span className="text-[10px] text-surface-500">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-semibold text-surface-300 mb-1.5">
          Filibuster title
          <span className="ml-1 text-surface-500 font-normal">(10–120 chars)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          maxLength={120}
          placeholder="e.g. The rights implications have not been fully debated"
          className="w-full px-3 py-2 rounded-lg bg-surface-300/30 border border-surface-300/60 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40 transition-colors"
          required
        />
        <p className="mt-0.5 text-[10px] text-surface-500 text-right">{title.length}/120</p>
      </div>

      {/* Speech */}
      <div>
        <label className="block text-xs font-semibold text-surface-300 mb-1.5">
          Filibuster speech
          <span className="ml-1 text-surface-500 font-normal">(min 150 chars)</span>
        </label>
        <textarea
          value={speech}
          onChange={(e) => onSpeechChange(e.target.value)}
          maxLength={3000}
          rows={6}
          placeholder="Make the substantive case for why the community needs more time to debate this topic before the vote closes. Explain what arguments or evidence are missing, what questions remain unanswered, or why the debate has been one-sided..."
          className="w-full px-3 py-2.5 rounded-lg bg-surface-300/30 border border-surface-300/60 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40 transition-colors resize-none leading-relaxed"
          required
        />
        <div className="mt-0.5 flex items-center justify-between">
          <p className={cn('text-[10px]', speech.trim().length < 150 ? 'text-against-400' : 'text-emerald')}>
            {speech.trim().length}/150 min
          </p>
          <p className="text-[10px] text-surface-500">{speech.length}/3000</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-against-500/10 border border-against-500/30">
          <AlertTriangle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-against-300">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-surface-300/60 text-sm text-surface-400 hover:text-white hover:bg-surface-300/30 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={filing}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold/15 border border-gold/40 text-sm font-semibold text-gold hover:bg-gold/25 transition-colors disabled:opacity-60"
        >
          {filing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Filing…
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" /> File Filibuster
            </>
          )}
        </button>
      </div>
    </motion.form>
  )
}
