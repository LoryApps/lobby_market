'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  Loader2,
  MessageSquare,
  Scale,
  Shield,
  Star,
  ThumbsUp,
  Users,
  Vote,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { NominationDetail, NominationEndorser } from '@/app/api/civic-nominations/[id]/route'
import type { CivicRole } from '@/app/api/civic-nominations/route'

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  CivicRole,
  {
    label: string
    shortLabel: string
    icon: typeof Crown
    color: string
    bg: string
    border: string
    description: string
    powers: string[]
  }
> = {
  grand_council: {
    label: 'Grand Council Member',
    shortLabel: 'Council',
    icon: Crown,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'Voting members of the top-20 governance body that proposes and ratifies platform-wide civic motions.',
    powers: [
      'Propose and second civic motions',
      'Vote on platform-wide resolutions',
      'Convene emergency civic assemblies',
    ],
  },
  tribunal_judge: {
    label: 'Tribunal Judge',
    shortLabel: 'Tribunal',
    icon: Gavel,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    description: 'Civic judges who review challenged arguments and deliver peer verdicts on quality and accuracy.',
    powers: [
      'Adjudicate argument challenge verdicts',
      'Issue quality rulings on disputed content',
      'Recommend sanctions for bad-faith argumentation',
    ],
  },
  fact_checker: {
    label: 'Platform Fact Checker',
    shortLabel: 'Fact Checker',
    icon: Shield,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description: 'Verified fact-checkers who can flag misleading claims and attach evidence assessments to arguments.',
    powers: [
      'Flag factually contested arguments',
      'Attach sourced evidence assessments',
      'Request tribunal review for severe violations',
    ],
  },
  debate_moderator: {
    label: 'Debate Moderator',
    shortLabel: 'Moderator',
    icon: Scale,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    description: 'Licensed moderators who facilitate live debates, ensure format rules are followed, and maintain decorum.',
    powers: [
      'Officiate scheduled live debates',
      'Enforce time limits and speaking order',
      'Issue warnings for format violations',
    ],
  },
  assembly_rapporteur: {
    label: 'Assembly Rapporteur',
    shortLabel: 'Rapporteur',
    icon: Users,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    description: 'Citizens Assembly facilitators who synthesize deliberation sessions and draft formal recommendations.',
    powers: [
      'Facilitate Citizens Assembly sessions',
      'Draft assembly recommendations',
      'Present findings to the Grand Council',
    ],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function futureRelTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 24) return `${h}h remaining`
  return `${d}d remaining`
}

function StatPill({ icon: Icon, label, value, color }: {
  icon: typeof Flame
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300">
      <Icon className={cn('h-4 w-4', color)} />
      <p className={cn('text-lg font-bold font-mono tabular-nums', color)}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-[10px] font-mono text-surface-500 text-center">{label}</p>
    </div>
  )
}

function EndorserRow({ endorser }: { endorser: NominationEndorser }) {
  return (
    <Link
      href={`/profile/${endorser.username}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200 transition-colors"
    >
      <Avatar src={endorser.avatar_url} fallback={endorser.display_name ?? endorser.username} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {endorser.display_name ?? endorser.username}
        </p>
        <p className="text-[11px] font-mono text-surface-500">
          @{endorser.username}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs font-mono text-gold">{Math.round(endorser.clout).toLocaleString()}</p>
        <p className="text-[10px] font-mono text-surface-500">{relTime(endorser.endorsed_at)}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-500 shrink-0" />
    </Link>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  nominationId: string
}

export function NominationDetailClient({ nominationId }: Props) {
  const router = useRouter()
  const [detail, setDetail] = useState<NominationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [endorsing, setEndorsing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/civic-nominations/${nominationId}`, { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 404) {
          router.replace('/civic-nominations')
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const data: NominationDetail = await res.json()
      setDetail(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nomination')
    } finally {
      setLoading(false)
    }
  }, [nominationId, router])

  useEffect(() => { load() }, [load])

  const handleEndorse = useCallback(async () => {
    if (!detail) return
    setEndorsing(true)
    try {
      const method = detail.user_has_endorsed ? 'DELETE' : 'POST'
      const res = await fetch(`/api/civic-nominations/${nominationId}/endorse`, { method })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setToast(body.error ?? 'Action failed')
        setTimeout(() => setToast(null), 3000)
        return
      }
      const endorsed = !detail.user_has_endorsed
      setDetail((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          user_has_endorsed: endorsed,
          endorsement_count: prev.endorsement_count + (endorsed ? 1 : -1),
          pct_complete: Math.min(
            100,
            Math.round(((prev.endorsement_count + (endorsed ? 1 : -1)) / prev.endorsement_target) * 100)
          ),
        }
      })
      setToast(endorsed ? 'Endorsement recorded' : 'Endorsement removed')
      setTimeout(() => setToast(null), 2500)
    } catch {
      setToast('Something went wrong')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setEndorsing(false)
    }
  }, [detail, nominationId, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <Skeleton className="h-6 w-36 mb-6" />
          <Skeleton className="h-32 w-full rounded-2xl mb-4" />
          <Skeleton className="h-48 w-full rounded-2xl mb-4" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 flex flex-col items-center justify-center min-h-[60vh]">
          <XCircle className="h-10 w-10 text-against-400 mb-3" />
          <p className="text-white font-mono mb-2">Nomination not found</p>
          <p className="text-surface-500 text-sm mb-6">{error}</p>
          <Link href="/civic-nominations" className="text-for-400 hover:text-for-300 text-sm font-mono transition-colors">
            ← Back to Nominations
          </Link>
        </main>
        <BottomNav />
      </div>
    )
  }

  const cfg = ROLE_CONFIG[detail.role]
  const RoleIcon = cfg.icon
  const nominee = detail.nominee
  const nominator = detail.nominator
  const isOpen = detail.status === 'open'
  const isElected = detail.status === 'elected'

  const statusConfig = {
    open:     { label: 'Open',    color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
    elected:  { label: 'Elected', color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
    declined: { label: 'Declined',color: 'text-surface-500',  bg: 'bg-surface-300/30',  border: 'border-surface-400/30' },
    expired:  { label: 'Expired', color: 'text-surface-500',  bg: 'bg-surface-300/30',  border: 'border-surface-400/30' },
  }[detail.status]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-surface-200 border border-surface-400 text-sm text-white font-mono shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back nav ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/civic-nominations"
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Nominations
          </Link>
          <span className="text-surface-600">/</span>
          <span className="text-sm text-surface-400 truncate">{cfg.label}</span>
        </div>

        {/* ── Role header card ──────────────────────────────────────────────── */}
        <div className={cn('rounded-2xl border p-5 mb-4', cfg.bg, cfg.border)}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl border', cfg.bg, cfg.border)}>
                <RoleIcon className={cn('h-5 w-5', cfg.color)} />
              </div>
              <div>
                <h1 className={cn('text-lg font-bold font-mono', cfg.color)}>{cfg.label}</h1>
                <p className="text-xs text-surface-500 font-mono">Civic Role Nomination</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn('text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border', statusConfig.color, statusConfig.bg, statusConfig.border)}>
                {statusConfig.label}
              </span>
              {isOpen && (
                <span className="text-[10px] font-mono text-surface-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {futureRelTime(detail.closes_at)}
                </span>
              )}
            </div>
          </div>

          <p className="text-sm text-surface-400 mb-4">{cfg.description}</p>

          {/* Powers list */}
          <div className="space-y-1.5">
            {cfg.powers.map((power) => (
              <div key={power} className="flex items-start gap-2">
                <Check className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', cfg.color)} />
                <span className="text-xs text-surface-400">{power}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Endorsement progress ─────────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-gold" />
              <span className="text-sm font-semibold text-white">Endorsement Progress</span>
            </div>
            {isElected && (
              <div className="flex items-center gap-1.5 text-gold">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-mono font-bold">ELECTED</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-3 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', isElected ? 'bg-gold' : cfg.color.replace('text-', 'bg-'))}
                initial={{ width: 0 }}
                animate={{ width: `${detail.pct_complete}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span className={cn('text-sm font-bold font-mono tabular-nums shrink-0', cfg.color)}>
              {detail.endorsement_count}/{detail.endorsement_target}
            </span>
          </div>

          <p className="text-xs text-surface-500">
            {detail.pct_complete}% of required endorsements · {detail.endorsement_count} citizen{detail.endorsement_count !== 1 ? 's' : ''} have endorsed this nomination
          </p>

          {/* Endorse button */}
          {isOpen && !detail.user_is_nominee && (
            <motion.div layout className="mt-4">
              <Button
                onClick={handleEndorse}
                disabled={endorsing}
                variant={detail.user_has_endorsed ? 'ghost' : 'primary'}
                className={cn(
                  'w-full flex items-center justify-center gap-2',
                  detail.user_has_endorsed
                    ? 'border border-surface-400 hover:border-against-500/60 hover:text-against-400'
                    : ''
                )}
              >
                {endorsing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : detail.user_has_endorsed ? (
                  <>
                    <X className="h-4 w-4" />
                    Remove Endorsement
                  </>
                ) : (
                  <>
                    <ThumbsUp className="h-4 w-4" />
                    Endorse This Nomination
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {isOpen && detail.user_is_nominee && (
            <p className="mt-4 text-center text-xs text-surface-500 font-mono italic">
              You cannot endorse your own nomination
            </p>
          )}
        </div>

        {/* ── Nominee profile ───────────────────────────────────────────────── */}
        {nominee && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">
            <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-4">Nominee</h2>
            <Link
              href={`/profile/${nominee.username}`}
              className="flex items-center gap-4 mb-5 group"
            >
              <Avatar
                src={nominee.avatar_url}
                fallback={nominee.display_name ?? nominee.username}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white group-hover:text-for-300 transition-colors">
                  {nominee.display_name ?? nominee.username}
                </p>
                <p className="text-sm text-surface-500 font-mono">@{nominee.username}</p>
                <p className="text-xs text-surface-600 mt-0.5">
                  Member since {new Date(nominee.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors shrink-0" />
            </Link>

            {/* Civic stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatPill icon={Vote} label="Total Votes" value={nominee.total_votes ?? 0} color="text-for-400" />
              <StatPill icon={MessageSquare} label="Arguments" value={nominee.argument_count ?? 0} color="text-purple" />
              <StatPill icon={Star} label="Clout" value={Math.round(nominee.clout ?? 0)} color="text-gold" />
              <StatPill icon={Flame} label="Streak" value={`${nominee.vote_streak ?? 0}d`} color="text-against-400" />
            </div>

            {/* Quick links */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Link
                href={`/profile/${nominee.username}`}
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400"
              >
                <Users className="h-3.5 w-3.5" />
                Profile
              </Link>
              <Link
                href={`/profile/${nominee.username}/positions`}
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Positions
              </Link>
              <Link
                href={`/profile/${nominee.username}/arguments`}
                className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Arguments
              </Link>
            </div>
          </div>
        )}

        {/* ── Nomination reason ─────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">
          <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-3">
            Nomination Statement
          </h2>
          <blockquote className="text-sm text-surface-300 leading-relaxed border-l-2 border-surface-500 pl-4 italic">
            {detail.reason}
          </blockquote>

          {nominator && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-300">
              <span className="text-[11px] font-mono text-surface-500">Nominated by</span>
              <Link
                href={`/profile/${nominator.username}`}
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <Avatar
                  src={nominator.avatar_url}
                  fallback={nominator.display_name ?? nominator.username}
                  size="xs"
                />
                <span className="text-xs font-mono text-surface-400 hover:text-white transition-colors">
                  {nominator.display_name ?? nominator.username}
                </span>
              </Link>
              <span className="text-[11px] font-mono text-surface-600">
                · {relTime(detail.created_at)}
              </span>
            </div>
          )}
        </div>

        {/* ── Endorsers ─────────────────────────────────────────────────────── */}
        {detail.endorsers.length > 0 && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden mb-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-semibold text-white">
                  Endorsers
                </h2>
              </div>
              <span className="text-xs font-mono text-surface-500">
                {detail.endorsement_count} total
              </span>
            </div>
            <div className="divide-y divide-surface-300">
              {detail.endorsers.map((endorser) => (
                <EndorserRow key={endorser.id} endorser={endorser} />
              ))}
            </div>
            {detail.endorsement_count > detail.endorsers.length && (
              <div className="px-4 py-3 text-center border-t border-surface-300">
                <p className="text-xs text-surface-500 font-mono">
                  +{detail.endorsement_count - detail.endorsers.length} more endorsers
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Footer nav ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-surface-300">
          <Link
            href="/civic-nominations"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <Crown className="h-4 w-4" />
            All nominations
          </Link>
          <Link
            href="/civic-elections"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <Scale className="h-4 w-4" />
            Civic elections
          </Link>
          <Link
            href="/accountability"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <Shield className="h-4 w-4" />
            Accountability
          </Link>
        </div>

        <p className="text-center text-[10px] font-mono text-surface-600 mt-6">
          Nomination closes {new Date(detail.closes_at).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
          })} · Lobby Market
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
