'use client'

/**
 * /ambassador — Civic Ambassador Program
 *
 * Every citizen gets a personal referral link. Share it with anyone who
 * cares about civic debate — when they sign up AND cast their first vote
 * (a "conversion"), you earn +50 Clout and climb the Ambassador tier ladder.
 *
 * Tiers (by converted recruits):
 *   0        Recruit
 *   1–4      Ambassador
 *   5–9      Active Recruiter
 *   10–19    Community Builder
 *   20–49    Movement Maker
 *   50+      Civic Champion
 *
 * Distinct from:
 *   /coalitions — formal alliances with charters
 *   /invite     — coalition member invites (not platform referrals)
 *   /clout      — general Clout wallet/ledger
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  ClipboardCheck,
  Crown,
  Flame,
  Globe,
  Link2,
  RefreshCw,
  Share2,
  Sparkles,
  ThumbsUp,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { AmbassadorStats, AmbassadorRecruit } from '@/app/api/ambassador/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<string, {
  icon: typeof Crown
  bg: string
  border: string
  glow: string
  badge: string
}> = {
  'Civic Champion':    { icon: Crown,    bg: 'bg-gold/10',      border: 'border-gold/40',      glow: 'shadow-gold/20',     badge: 'bg-gold/20 text-gold border-gold/40' },
  'Movement Maker':   { icon: Sparkles, bg: 'bg-purple/10',    border: 'border-purple/40',    glow: 'shadow-purple/20',   badge: 'bg-purple/20 text-purple border-purple/40' },
  'Community Builder':{ icon: Users,    bg: 'bg-emerald/10',   border: 'border-emerald/40',   glow: 'shadow-emerald/20',  badge: 'bg-emerald/20 text-emerald border-emerald/40' },
  'Active Recruiter': { icon: Zap,      bg: 'bg-for-500/10',   border: 'border-for-500/40',   glow: 'shadow-for-500/20',  badge: 'bg-for-500/20 text-for-300 border-for-500/40' },
  'Ambassador':        { icon: Award,   bg: 'bg-surface-200',  border: 'border-surface-400',  glow: '',                   badge: 'bg-surface-300/40 text-surface-300 border-surface-400' },
  'Recruit':           { icon: UserPlus,bg: 'bg-surface-200',  border: 'border-surface-300',  glow: '',                   badge: 'bg-surface-300/30 text-surface-500 border-surface-300' },
}

// ─── Role label ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person:        'Citizen',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  elder:         'Elder',
  senator:       'Senator',
  lawmaker:      'Lawmaker',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7)  return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
  delay = 0,
}: {
  label: string
  value: number
  icon: typeof Users
  color: string
  sub?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center"
    >
      <Icon className={cn('h-4 w-4 mx-auto mb-2', color)} />
      <div className={cn('text-2xl font-mono font-bold', color)}>
        <AnimatedNumber value={value} />
      </div>
      <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">{label}</div>
      {sub && <div className="text-[10px] font-mono text-surface-600 mt-0.5">{sub}</div>}
    </motion.div>
  )
}

// ─── Recruit row ──────────────────────────────────────────────────────────────

function RecruitRow({ recruit, idx }: { recruit: AmbassadorRecruit; idx: number }) {
  const converted = recruit.status === 'converted'
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: idx * 0.04 }}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-200/40 transition-colors"
    >
      <Avatar
        src={recruit.avatar_url}
        fallback={recruit.display_name || recruit.username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/profile/${recruit.username}`}
            className="text-sm font-mono font-semibold text-white hover:text-for-400 transition-colors truncate"
          >
            {recruit.display_name || recruit.username}
          </Link>
          <span className="text-[10px] font-mono text-surface-600">
            {ROLE_LABEL[recruit.role] ?? recruit.role}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] font-mono text-surface-500">
          <span>{recruit.total_votes.toLocaleString()} votes</span>
          <span className="text-surface-600">·</span>
          <span>{relDate(recruit.joined_at)}</span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        {converted ? (
          <div className="flex items-center gap-1 text-emerald">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-[11px] font-mono font-semibold">+50 Clout</span>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-surface-600">Pending vote</span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Progress bar to next tier ────────────────────────────────────────────────

function TierProgress({
  converts,
  nextAt,
  color,
}: {
  converts: number
  nextAt: number
  color: string
}) {
  const barColor = color
    .replace('text-', 'bg-')
    .replace('gold', 'gold')
    .replace('purple', 'purple')
    .replace('emerald', 'emerald')
    .replace('for-400', 'for-500')
    .replace('surface-300', 'surface-400')
    .replace('surface-500', 'surface-400')

  const pct = Math.min(100, (converts / nextAt) * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-mono text-surface-500">
          {converts} / {nextAt} conversions to next tier
        </span>
        <span className="text-[11px] font-mono text-surface-500">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </div>
  )
}

// ─── Share actions ────────────────────────────────────────────────────────────

function SharePanel({ url, code }: { url: string; code: string }) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function nativeShare() {
    if (!navigator.share) return
    navigator.share({
      title: 'Join me on Lobby Market',
      text: 'Come debate civic issues, vote on policies, and help write the law. Use my link to get started.',
      url,
    })
  }

  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  return (
    <div className="space-y-3">
      {/* URL display */}
      <div className="flex items-center gap-2 rounded-xl bg-surface-200/60 border border-surface-300 p-3">
        <Link2 className="h-4 w-4 text-surface-500 flex-shrink-0" />
        <span className="flex-1 text-sm font-mono text-white truncate">{url}</span>
        <button
          onClick={copyLink}
          className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors',
            copied
              ? 'bg-emerald/20 text-emerald border border-emerald/30'
              : 'bg-surface-300 text-white hover:bg-surface-400'
          )}
        >
          {copied ? (
            <><ClipboardCheck className="h-3.5 w-3.5" /> Copied</>
          ) : (
            <><Clipboard className="h-3.5 w-3.5" /> Copy</>
          )}
        </button>
      </div>

      {/* Action row */}
      <div className="flex gap-2">
        <button
          onClick={copyLink}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm font-mono font-semibold transition-colors"
        >
          <Clipboard className="h-4 w-4" />
          Copy Link
        </button>
        {canShare && (
          <button
            onClick={nativeShare}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 border border-surface-300 text-white text-sm font-mono font-semibold transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        )}
      </div>

      {/* Code pill */}
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
        <Globe className="h-3.5 w-3.5" />
        Your code: <span className="text-white font-semibold">{code}</span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AmbassadorPage() {
  const router = useRouter()
  const [data, setData] = useState<AmbassadorStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ambassador')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as AmbassadorStats)
    } catch {
      setError('Could not load your ambassador stats.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const tierConfig = data ? (TIER_CONFIG[data.tier] ?? TIER_CONFIG['Recruit']) : null
  const TierIcon = tierConfig?.icon ?? Award

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-for-400" />
              <h1 className="font-mono text-2xl font-bold text-white">Ambassador Program</h1>
            </div>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Recruit citizens, earn Clout
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && <PageSkeleton />}

        {error && !loading && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <p className="text-sm font-mono text-against-300">{error}</p>
            <button onClick={load} className="mt-3 text-xs font-mono text-against-400 hover:text-against-300 underline">Try again</button>
          </div>
        )}

        {data && !loading && (
          <AnimatePresence>
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >

              {/* ── Tier hero card ──────────────────────────────────────── */}
              <div className={cn(
                'rounded-2xl border p-5',
                tierConfig?.bg,
                tierConfig?.border,
                data.tier !== 'Recruit' ? 'shadow-lg ' + tierConfig?.glow : ''
              )}>
                <div className="flex items-start gap-4">
                  {/* Tier badge */}
                  <div className={cn(
                    'flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-2xl border',
                    tierConfig?.bg,
                    tierConfig?.border,
                  )}>
                    <TierIcon className={cn('h-6 w-6', data.tier_color)} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn('text-lg font-mono font-bold', data.tier_color)}>
                        {data.tier}
                      </span>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                        tierConfig?.badge
                      )}>
                        {data.times_converted} converted
                      </span>
                    </div>
                    <p className="text-xs font-mono text-surface-500 leading-relaxed">
                      {data.tier === 'Civic Champion'
                        ? 'You have reached the highest Ambassador tier. Your civic legacy grows with every recruit.'
                        : `Reach ${data.next_tier} by converting ${data.next_tier_at! - data.times_converted} more recruit${data.next_tier_at! - data.times_converted !== 1 ? 's' : ''}.`
                      }
                    </p>

                    {/* Progress bar */}
                    {data.next_tier_at !== null && data.next_tier_at > 0 && (
                      <div className="mt-3">
                        <TierProgress
                          converts={data.times_converted}
                          nextAt={data.next_tier_at}
                          color={data.tier_color}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Total Clout earned */}
                {data.clout_earned > 0 && (
                  <div className="mt-4 pt-4 border-t border-surface-300/40 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-gold" />
                    <span className="text-sm font-mono text-gold font-semibold">
                      {data.clout_earned.toLocaleString()} Clout earned from referrals
                    </span>
                  </div>
                )}
              </div>

              {/* ── Stats grid ──────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Signed Up"  value={data.times_signed_up}  icon={UserPlus}  color="text-for-400"  delay={0.05} />
                <StatCard label="Converted"  value={data.times_converted}  icon={CheckCircle2} color="text-emerald" delay={0.1}
                  sub={data.times_signed_up > 0 ? `${data.conversion_rate}% rate` : undefined}
                />
                <StatCard label="Clout Earned" value={data.clout_earned}  icon={Zap}       color="text-gold"    delay={0.15} />
                <StatCard label="Clicks"     value={data.times_clicked}    icon={Globe}     color="text-purple"  delay={0.2} />
              </div>

              {/* ── Your referral link ──────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Link2 className="h-4 w-4 text-for-400" />
                  <h2 className="text-sm font-mono font-semibold text-white">Your Referral Link</h2>
                </div>
                <SharePanel url={data.referral_url} code={data.code} />
              </motion.div>

              {/* ── How it works ────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.3 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-mono font-semibold text-white">How It Works</h2>
                </div>
                <div className="space-y-3">
                  {[
                    {
                      step: '01',
                      icon: Link2,
                      color: 'text-for-400',
                      bg: 'bg-for-500/10',
                      title: 'Share your link',
                      desc: 'Copy your unique referral URL and share it anywhere — social media, forums, chats.',
                    },
                    {
                      step: '02',
                      icon: UserPlus,
                      color: 'text-purple',
                      bg: 'bg-purple/10',
                      title: 'They sign up',
                      desc: 'When someone creates an account via your link, they\'re logged as your recruit.',
                    },
                    {
                      step: '03',
                      icon: ThumbsUp,
                      color: 'text-emerald',
                      bg: 'bg-emerald/10',
                      title: 'First vote = Clout',
                      desc: 'The moment your recruit casts their first vote, you earn +50 Clout automatically.',
                    },
                    {
                      step: '04',
                      icon: Trophy,
                      color: 'text-gold',
                      bg: 'bg-gold/10',
                      title: 'Climb the tiers',
                      desc: 'Reach 5, 10, 20, 50 conversions to unlock Ambassador tiers and showcase your impact.',
                    },
                  ].map((s) => {
                    const Icon = s.icon
                    return (
                      <div key={s.step} className="flex items-start gap-3">
                        <div className={cn('flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg', s.bg)}>
                          <Icon className={cn('h-3.5 w-3.5', s.color)} />
                        </div>
                        <div>
                          <p className="text-sm font-mono font-semibold text-white">{s.title}</p>
                          <p className="text-xs font-mono text-surface-500 mt-0.5 leading-relaxed">{s.desc}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>

              {/* ── Recruits list ────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.35 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
              >
                <div className="px-5 pt-5 pb-3 border-b border-surface-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-surface-500" />
                      <h2 className="text-sm font-mono font-semibold text-white">
                        Your Recruits
                      </h2>
                    </div>
                    {data.recruits.length > 0 && (
                      <span className="text-xs font-mono text-surface-500">
                        {data.recruits.length} total
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-surface-500 mt-1">
                    Citizens who signed up via your referral link
                  </p>
                </div>

                {data.recruits.length === 0 ? (
                  <div className="px-5 py-8">
                    <EmptyState
                      icon={UserPlus}
                      title="No recruits yet"
                      description="Share your referral link to start building your civic network."
                    />
                  </div>
                ) : (
                  <div className="divide-y divide-surface-300">
                    {data.recruits.map((r, i) => (
                      <RecruitRow key={r.id} recruit={r} idx={i} />
                    ))}
                  </div>
                )}
              </motion.div>

              {/* ── Tier ladder ──────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.4 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
              >
                <div className="px-5 pt-5 pb-3 border-b border-surface-300">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-surface-500" />
                    <h2 className="text-sm font-mono font-semibold text-white">Ambassador Tiers</h2>
                  </div>
                </div>
                <div className="divide-y divide-surface-300">
                  {[
                    { tier: 'Civic Champion',    converts: '50+',  clout: '2500+',  color: 'text-gold',        icon: Crown    },
                    { tier: 'Movement Maker',    converts: '20–49', clout: '1000+', color: 'text-purple',      icon: Sparkles },
                    { tier: 'Community Builder', converts: '10–19', clout: '500+',  color: 'text-emerald',     icon: Users    },
                    { tier: 'Active Recruiter',  converts: '5–9',   clout: '250+',  color: 'text-for-400',     icon: Zap      },
                    { tier: 'Ambassador',         converts: '1–4',  clout: '50+',   color: 'text-surface-300', icon: Award    },
                    { tier: 'Recruit',            converts: '0',    clout: '0',     color: 'text-surface-500', icon: UserPlus },
                  ].map((row) => {
                    const Icon = row.icon
                    const isCurrent = row.tier === data.tier
                    return (
                      <div
                        key={row.tier}
                        className={cn(
                          'flex items-center gap-3 px-5 py-3.5',
                          isCurrent && 'bg-surface-200/50'
                        )}
                      >
                        <Icon className={cn('h-4 w-4 flex-shrink-0', row.color)} />
                        <div className="flex-1 min-w-0">
                          <span className={cn('text-sm font-mono font-semibold', row.color)}>{row.tier}</span>
                          {isCurrent && (
                            <span className="ml-2 text-[10px] font-mono bg-for-500/20 text-for-300 border border-for-500/30 px-1.5 py-0.5 rounded-full">
                              current
                            </span>
                          )}
                        </div>
                        <div className="text-right text-xs font-mono text-surface-500">
                          <div>{row.converts} converts</div>
                          <div className="text-gold">{row.clout} Clout</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>

              {/* ── Footer links ──────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex flex-wrap gap-2"
              >
                {[
                  { href: '/clout',    label: 'Clout Wallet',    color: 'text-gold border-gold/30 bg-gold/5 hover:bg-gold/10' },
                  { href: '/profile/me', label: 'My Profile',   color: 'text-for-400 border-for-500/30 bg-for-500/5 hover:bg-for-500/10' },
                  { href: '/leaderboard', label: 'Leaderboard', color: 'text-purple border-purple/30 bg-purple/5 hover:bg-purple/10' },
                ].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors',
                      l.color
                    )}
                  >
                    {l.label}
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                ))}
              </motion.div>

            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
