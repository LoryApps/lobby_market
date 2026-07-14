'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  ExternalLink,
  FileText,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  Music2,
  Plus,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CommitteeDetail, CommitteeInquiry } from '@/app/api/committees/[id]/route'
import type { InquiryDetail, EvidenceEntry } from '@/app/api/committees/[id]/inquiries/route'

// ── Icon map ───────────────────────────────────────────────────────────────

const AREA_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Politics: Landmark, Economics: TrendingUp, Technology: Cpu,
  Science: FlaskConical, Ethics: Scale, Philosophy: BookOpen,
  Culture: Music2, Health: Heart, Environment: Leaf, Education: GraduationCap,
}
const AREA_COLOR: Record<string, string> = {
  Politics: 'text-for-400', Economics: 'text-gold', Technology: 'text-purple',
  Science: 'text-emerald', Ethics: 'text-against-400', Philosophy: 'text-for-300',
  Culture: 'text-pink-400', Health: 'text-red-400', Environment: 'text-emerald',
  Education: 'text-amber-400',
}
const AREA_BG: Record<string, string> = {
  Politics: 'bg-for-500/10', Economics: 'bg-gold/10', Technology: 'bg-purple/10',
  Science: 'bg-emerald/10', Ethics: 'bg-against-500/10', Philosophy: 'bg-for-500/5',
  Culture: 'bg-pink-500/10', Health: 'bg-red-500/10', Environment: 'bg-emerald/10',
  Education: 'bg-amber-500/10',
}
const AREA_BORDER: Record<string, string> = {
  Politics: 'border-for-500/30', Economics: 'border-gold/30', Technology: 'border-purple/30',
  Science: 'border-emerald/30', Ethics: 'border-against-500/30', Philosophy: 'border-for-500/20',
  Culture: 'border-pink-500/30', Health: 'border-red-500/30', Environment: 'border-emerald/30',
  Education: 'border-amber-500/30',
}

const STATUS_CONFIG = {
  open:     { label: 'Open', color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  closed:   { label: 'Closed', color: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/20' },
  reported: { label: 'Reported', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
}

const POSITION_CONFIG = {
  for:     { label: 'FOR', color: 'text-for-400', Icon: ThumbsUp },
  against: { label: 'AGAINST', color: 'text-against-400', Icon: ThumbsDown },
  neutral: { label: 'NEUTRAL', color: 'text-surface-400', Icon: Scale },
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Evidence card ──────────────────────────────────────────────────────────

function EvidenceCard({ item }: { item: EvidenceEntry }) {
  const pos = POSITION_CONFIG[item.position]
  const PosIcon = pos.Icon
  return (
    <div className="flex gap-3 p-4 rounded-xl bg-surface-200/50 border border-surface-300/50">
      <Avatar
        src={item.author?.avatar_url ?? null}
        fallback={item.author?.display_name || item.author?.username || '?'}
        size="sm"
        className="flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <Link href={`/profile/${item.author?.username}`} className="text-xs font-mono font-semibold text-white hover:text-for-400 transition-colors">
            {item.author?.display_name || `@${item.author?.username}`}
          </Link>
          <span className={cn('flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full border', pos.color, `bg-${pos.color.replace('text-', '')}/10`, `border-${pos.color.replace('text-', '')}/30`)}>
            <PosIcon className="h-2.5 w-2.5" />
            {pos.label}
          </span>
          <span className="ml-auto text-[10px] font-mono text-surface-500 flex-shrink-0">{relativeTime(item.created_at)}</span>
        </div>
        <p className="text-xs text-surface-300 leading-relaxed">{item.summary}</p>
        {(item.argument_id || item.topic_id) && (
          <div className="mt-2 flex gap-2">
            {item.argument_id && (
              <Link href={`/arguments/${item.argument_id}`} className="text-[10px] font-mono text-for-400 hover:text-for-300 flex items-center gap-1">
                <ExternalLink className="h-2.5 w-2.5" />View argument
              </Link>
            )}
            {item.topic_id && (
              <Link href={`/topic/${item.topic_id}`} className="text-[10px] font-mono text-for-400 hover:text-for-300 flex items-center gap-1">
                <ExternalLink className="h-2.5 w-2.5" />View topic
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inquiry panel ──────────────────────────────────────────────────────────

function InquiryPanel({
  inquiry,
  committeeId,
  onClose,
}: {
  inquiry: CommitteeInquiry
  committeeId: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<InquiryDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [showSubmit, setShowSubmit] = useState(false)
  const [summary, setSummary] = useState('')
  const [position, setPosition] = useState<'for' | 'against' | 'neutral'>('neutral')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    async function loadDetail() {
      try {
        const res = await fetch(`/api/committees/${committeeId}/inquiries?inquiry=${inquiry.id}`)
        if (res.ok) setDetail(await res.json())
      } finally {
        setLoadingDetail(false)
      }
    }
    loadDetail()
  }, [committeeId, inquiry.id])

  async function submitEvidence() {
    if (summary.trim().length < 20) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/committees/${committeeId}/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiry_id: inquiry.id, summary, position }),
      })
      if (res.ok) {
        setSubmitted(true)
        setShowSubmit(false)
        const json = await res.json()
        setDetail((prev) => prev ? {
          ...prev,
          evidence: [json.evidence, ...prev.evidence],
          evidence_count: prev.evidence_count + 1,
          user_has_submitted: true,
        } : prev)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const status = STATUS_CONFIG[inquiry.status]

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-5 border-b border-surface-300/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={cn('text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border', status.color, status.bg, status.border)}>
              {status.label}
            </span>
            {inquiry.topic_statement && (
              <Link href={`/topic/${inquiry.topic_id}`} className="text-[10px] font-mono text-surface-500 hover:text-for-400 transition-colors flex items-center gap-1">
                <ExternalLink className="h-2.5 w-2.5" />
                {inquiry.topic_statement.slice(0, 60)}{inquiry.topic_statement.length > 60 ? '…' : ''}
              </Link>
            )}
          </div>
          <h3 className="font-mono text-sm font-bold text-white">{inquiry.title}</h3>
          <p className="text-xs text-surface-400 mt-1 leading-relaxed">{inquiry.terms}</p>
        </div>
        <button onClick={onClose} className="flex-shrink-0 text-surface-500 hover:text-white transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-surface-300/30 bg-surface-200/30">
        <span className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
          <FileText className="h-3.5 w-3.5" />
          {detail?.evidence_count ?? inquiry.evidence_count} evidence submissions
        </span>
        <span className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
          <Clock className="h-3.5 w-3.5" />
          Opened {relativeTime(inquiry.opened_at)}
        </span>
      </div>

      {/* Evidence list */}
      <div className="p-5">
        {loadingDetail ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
          </div>
        ) : !detail || detail.evidence.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-8 w-8 text-surface-600 mx-auto mb-3" />
            <p className="text-sm font-mono font-semibold text-surface-400">No evidence submitted yet</p>
            <p className="text-xs text-surface-500 mt-1">Be the first to submit evidence to this inquiry.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {detail.evidence.map((item) => <EvidenceCard key={item.id} item={item} />)}
          </div>
        )}

        {/* Submit evidence */}
        {inquiry.status === 'open' && !submitted && !(detail?.user_has_submitted) && (
          <div className="mt-4">
            {!showSubmit ? (
              <button
                onClick={() => setShowSubmit(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-surface-400/40 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Submit your evidence
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3 p-4 rounded-xl bg-surface-200/50 border border-surface-300/50"
              >
                <div>
                  <label className="block text-xs font-mono font-semibold text-surface-400 mb-2">Your position</label>
                  <div className="flex gap-2">
                    {(['for', 'against', 'neutral'] as const).map((pos) => {
                      const cfg = POSITION_CONFIG[pos]
                      const PosIcon = cfg.Icon
                      return (
                        <button
                          key={pos}
                          onClick={() => setPosition(pos)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                            position === pos
                              ? pos === 'for' ? 'bg-for-500/20 border-for-500/40 text-for-400'
                                : pos === 'against' ? 'bg-against-500/20 border-against-500/40 text-against-400'
                                : 'bg-surface-300 border-surface-400 text-white'
                              : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white'
                          )}
                        >
                          <PosIcon className="h-3 w-3" />
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono font-semibold text-surface-400 mb-2">
                    Evidence summary <span className="font-normal text-surface-600">(min 20 chars)</span>
                  </label>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Summarise the evidence you are submitting to this inquiry…"
                    rows={3}
                    className="w-full rounded-xl bg-surface-200 border border-surface-300 text-white text-xs font-mono p-3 resize-none placeholder-surface-600 focus:outline-none focus:ring-2 focus:ring-for-500/40 transition-colors"
                  />
                  <p className="text-[10px] font-mono text-surface-600 mt-1">{summary.length} / 20 minimum</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowSubmit(false)}
                    className="px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitEvidence}
                    disabled={submitting || summary.trim().length < 20}
                    className="px-4 py-1.5 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-colors disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin inline" /> : 'Submit Evidence'}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {(submitted || detail?.user_has_submitted) && inquiry.status === 'open' && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-emerald/10 border border-emerald/30">
            <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
            <p className="text-xs font-mono text-emerald">Your evidence has been submitted to this inquiry.</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export function CommitteeDetailClient({ slug }: { slug: string }) {
  const [committee, setCommittee] = useState<CommitteeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [activeInquiry, setActiveInquiry] = useState<CommitteeInquiry | null>(null)
  const [tab, setTab] = useState<'inquiries' | 'reports' | 'remit'>('inquiries')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/committees/${slug}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(res.status === 404 ? 'Committee not found' : `HTTP ${res.status}`)
      setCommittee(await res.json())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load committee')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  async function toggleMembership() {
    if (!committee) return
    setJoining(true)
    try {
      const method = committee.user_is_member ? 'DELETE' : 'POST'
      await fetch(`/api/committees/${committee.id}/join`, { method })
      setCommittee((prev) => prev ? {
        ...prev,
        user_is_member: !prev.user_is_member,
        member_count: prev.member_count + (prev.user_is_member ? -1 : 1),
      } : prev)
    } finally {
      setJoining(false)
    }
  }

  const area = committee?.policy_area ?? 'Politics'
  const Icon = AREA_ICON[area] ?? Scale

  const RECOMMENDATION_CONFIG: Record<string, { color: string; label: string }> = {
    for:     { color: 'text-for-400',     label: 'Recommends FOR' },
    against: { color: 'text-against-400', label: 'Recommends AGAINST' },
    neutral: { color: 'text-surface-400', label: 'Neutral' },
    hold:    { color: 'text-gold',        label: 'Hold' },
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <div className="max-w-3xl mx-auto w-full px-4 py-6">
          <Skeleton className="h-6 w-48 mb-6" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  if (error || !committee) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 flex items-center justify-center p-8">
          <EmptyState
            icon={Scale}
            title={error ?? 'Committee not found'}
            description="The committee you're looking for doesn't exist."
            action={{ label: 'Browse all committees', href: '/committees' }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const openInquiries = committee.inquiries.filter((i) => i.status === 'open')
  const closedInquiries = committee.inquiries.filter((i) => i.status !== 'open')

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      {/* Header */}
      <div className={cn('border-b border-surface-300/50', AREA_BG[area], 'bg-opacity-30')}>
        <div className="max-w-3xl mx-auto px-4 py-5">
          {/* Back */}
          <Link href="/committees" className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4">
            <ArrowLeft className="h-3.5 w-3.5" />
            Select Committees
          </Link>

          <div className="flex items-start gap-4">
            <div className={cn(
              'flex items-center justify-center h-14 w-14 rounded-2xl flex-shrink-0',
              AREA_BG[area], `border ${AREA_BORDER[area]}`
            )}>
              <Icon className={cn('h-7 w-7', AREA_COLOR[area])} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="font-mono text-lg font-bold text-white leading-tight">{committee.name}</h1>
                  <p className={cn('text-xs font-mono mt-0.5', AREA_COLOR[area])}>{committee.policy_area} · Select Committee</p>
                </div>
                <button
                  onClick={toggleMembership}
                  disabled={joining}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-mono font-semibold border transition-all flex-shrink-0',
                    committee.user_is_member
                      ? 'bg-for-500/20 border-for-500/40 text-for-400 hover:bg-against-500/20 hover:border-against-500/40 hover:text-against-400'
                      : 'bg-for-600 border-for-600 text-white hover:bg-for-500'
                  )}
                >
                  {joining ? (
                    <Loader2 className="h-3 w-3 animate-spin inline" />
                  ) : committee.user_is_member ? (
                    <><Check className="h-3 w-3 inline mr-1" />Following</>
                  ) : 'Follow Committee'}
                </button>
              </div>

              {/* Chair */}
              {committee.chair && (
                <Link href={`/profile/${committee.chair.username}`} className="inline-flex items-center gap-2 mt-3 group">
                  <Avatar
                    src={committee.chair.avatar_url}
                    fallback={committee.chair.display_name || committee.chair.username}
                    size="xs"
                  />
                  <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                    Chair: <span className="font-semibold">{committee.chair.display_name || `@${committee.chair.username}`}</span>
                  </span>
                </Link>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                  <Users className="h-3.5 w-3.5" />
                  {committee.member_count.toLocaleString()} followers
                </span>
                <span className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                  <FileText className="h-3.5 w-3.5" />
                  {committee.inquiry_count} inquiries
                </span>
                {openInquiries.length > 0 && (
                  <Badge variant="custom" className="bg-emerald/10 border-emerald/30 text-emerald text-[10px] font-mono">
                    {openInquiries.length} open
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-300/50 bg-surface-100/80 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex gap-1">
            {(['inquiries', 'reports', 'remit'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-4 py-3 text-xs font-mono font-semibold border-b-2 transition-all capitalize',
                  tab === t
                    ? cn('border-for-500 text-for-400')
                    : 'border-transparent text-surface-500 hover:text-white'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 pb-20 md:pb-8">
        <div className="max-w-3xl mx-auto px-4 py-5">
          {/* Inquiries tab */}
          {tab === 'inquiries' && (
            <div className="space-y-4">
              {committee.inquiries.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  iconColor={AREA_COLOR[area]}
                  iconBg={AREA_BG[area]}
                  iconBorder={AREA_BORDER[area]}
                  title="No inquiries yet"
                  description="This committee has not yet opened any formal inquiries. Check back soon."
                />
              ) : (
                <>
                  {openInquiries.length > 0 && (
                    <div>
                      <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-3">
                        Open Inquiries
                      </h2>
                      <div className="space-y-3">
                        {openInquiries.map((inq) => (
                          <div key={inq.id}>
                            <button
                              onClick={() => setActiveInquiry(activeInquiry?.id === inq.id ? null : inq)}
                              className={cn(
                                'w-full flex items-start gap-3 p-4 rounded-2xl border text-left transition-all',
                                activeInquiry?.id === inq.id
                                  ? 'bg-for-500/10 border-for-500/30'
                                  : 'bg-surface-100 border-surface-300 hover:border-for-500/30 hover:bg-for-500/5'
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Badge variant="custom" className="bg-emerald/10 border-emerald/30 text-emerald text-[10px] font-mono">
                                    Open
                                  </Badge>
                                  <span className="text-[10px] font-mono text-surface-500">
                                    {inq.evidence_count} submissions
                                  </span>
                                </div>
                                <p className="text-sm font-mono font-semibold text-white">{inq.title}</p>
                                <p className="text-xs text-surface-400 mt-1 leading-relaxed line-clamp-2">{inq.terms}</p>
                              </div>
                              {activeInquiry?.id === inq.id
                                ? <ChevronUp className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1" />
                                : <ChevronDown className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1" />
                              }
                            </button>

                            <AnimatePresence>
                              {activeInquiry?.id === inq.id && (
                                <div className="mt-2">
                                  <InquiryPanel
                                    inquiry={inq}
                                    committeeId={committee.id}
                                    onClose={() => setActiveInquiry(null)}
                                  />
                                </div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {closedInquiries.length > 0 && (
                    <div>
                      <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-3 mt-6">
                        Past Inquiries
                      </h2>
                      <div className="space-y-2">
                        {closedInquiries.map((inq) => {
                          const s = STATUS_CONFIG[inq.status]
                          return (
                            <button
                              key={inq.id}
                              onClick={() => setActiveInquiry(activeInquiry?.id === inq.id ? null : inq)}
                              className={cn(
                                'w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                                activeInquiry?.id === inq.id
                                  ? 'bg-surface-200 border-surface-400'
                                  : 'bg-surface-100 border-surface-300 hover:border-surface-400'
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={cn('text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full border', s.color, s.bg, s.border)}>
                                    {s.label}
                                  </span>
                                </div>
                                <p className="text-xs font-mono font-semibold text-white">{inq.title}</p>
                              </div>
                              {activeInquiry?.id === inq.id
                                ? <ChevronUp className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                                : <ChevronDown className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                              }
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Reports tab */}
          {tab === 'reports' && (
            <div>
              {committee.recent_reports.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  iconColor={AREA_COLOR[area]}
                  iconBg={AREA_BG[area]}
                  iconBorder={AREA_BORDER[area]}
                  title="No published reports yet"
                  description="Committee reports in this policy area will appear here once published."
                  action={{ label: 'Browse all committee reports', href: '/committee-reports' }}
                />
              ) : (
                <div className="space-y-3">
                  {committee.recent_reports.map((report) => {
                    const rec = RECOMMENDATION_CONFIG[report.recommendation] ?? { color: 'text-surface-400', label: report.recommendation }
                    return (
                      <Link
                        key={report.id}
                        href={`/reports/${report.id}`}
                        className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
                      >
                        <FileText className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono font-semibold text-white leading-tight">{report.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn('text-[10px] font-mono', rec.color)}>{rec.label}</span>
                            <span className="text-[10px] font-mono text-surface-500">{relativeTime(report.created_at)}</span>
                          </div>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-0.5" />
                      </Link>
                    )
                  })}
                  <Link href="/committee-reports" className="flex items-center justify-center gap-1.5 py-2 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors">
                    View all reports →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Remit tab */}
          {tab === 'remit' && (
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
              <h2 className="font-mono text-sm font-bold text-white mb-3">Terms of Reference</h2>
              <p className="text-sm text-surface-300 leading-relaxed">{committee.remit}</p>
              <div className="mt-4 pt-4 border-t border-surface-300/40">
                <p className="text-xs font-mono text-surface-500">
                  Select Committees are permanent standing bodies. They hold the government to account in their policy domain,
                  take evidence from witnesses, and publish formal findings. Any citizen may submit evidence to an open inquiry.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
