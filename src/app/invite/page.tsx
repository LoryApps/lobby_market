'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Share2,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ReferralStats } from '@/app/api/referrals/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

// ─── Share targets ────────────────────────────────────────────────────────────

function getShareTargets(link: string) {
  const text = encodeURIComponent(
    'Join me on Lobby Market — where civic debates shape tomorrow\'s laws. Vote, argue, and hold power accountable. 🏛️'
  )
  const url = encodeURIComponent(link)
  return [
    {
      label: 'Twitter / X',
      href: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      color: 'text-[#1DA1F2]',
      bg: 'bg-[#1DA1F2]/10',
      border: 'border-[#1DA1F2]/30',
    },
    {
      label: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      color: 'text-[#0077B5]',
      bg: 'bg-[#0077B5]/10',
      border: 'border-[#0077B5]/30',
    },
    {
      label: 'WhatsApp',
      href: `https://wa.me/?text=${text}%20${url}`,
      color: 'text-[#25D366]',
      bg: 'bg-[#25D366]/10',
      border: 'border-[#25D366]/30',
    },
  ]
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
      <div className={cn('flex items-center gap-1.5', color)}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-2xl font-mono font-bold text-white tabular-nums">{value}</span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function InvitePage() {
  const router = useRouter()
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/referrals')
      if (res.status === 401) {
        router.push('/login?next=/invite')
        return
      }
      if (res.ok) {
        const data = (await res.json()) as ReferralStats
        setStats(data)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  async function handleCopy() {
    if (!stats?.invite_link) return
    await navigator.clipboard.writeText(stats.invite_link).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareTargets = stats ? getShareTargets(stats.invite_link) : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-xl mx-auto px-4 pt-6 pb-24">
        {/* Back */}
        <Link
          href="/profile/me"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          My Profile
        </Link>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30">
              <UserPlus className="h-5 w-5 text-gold" aria-hidden />
            </div>
            <div>
              <h1 className="text-lg font-mono font-bold text-white">Invite Citizens</h1>
              <p className="text-xs text-surface-500 font-mono">
                Grow the civic debate. Earn Clout for every friend who joins.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Invite link card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-gold/20 bg-gold/5 p-4 mb-5"
        >
          <p className="text-[10px] font-mono font-semibold text-gold uppercase tracking-wider mb-2">
            Your Invite Link
          </p>

          {loading ? (
            <Skeleton className="h-9 rounded-xl" />
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 truncate">
                {stats?.invite_link ?? 'lobby.market/invite/…'}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? 'Copied!' : 'Copy invite link'}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-colors flex-shrink-0',
                  copied
                    ? 'bg-emerald/20 text-emerald border border-emerald/30'
                    : 'bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30',
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {copied ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      className="flex items-center gap-1"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Copied
                    </motion.span>
                  ) : (
                    <motion.span
                      key="copy"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.7, opacity: 0 }}
                      className="flex items-center gap-1"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            </div>
          )}

          <p className="mt-2 text-[10px] font-mono text-surface-600">
            Earn <span className="text-gold font-semibold">+50 Clout</span> for every friend who joins and casts their first vote.
          </p>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-3 gap-3 mb-5"
        >
          {loading ? (
            <>
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </>
          ) : (
            <>
              <StatCard
                icon={Users}
                label="Clicks"
                value={stats?.total_clicks ?? 0}
                color="text-for-400"
              />
              <StatCard
                icon={UserPlus}
                label="Joined"
                value={stats?.total_signups ?? 0}
                color="text-emerald"
              />
              <StatCard
                icon={Zap}
                label="Clout"
                value={stats?.clout_earned ?? 0}
                color="text-gold"
              />
            </>
          )}
        </motion.div>

        {/* Share on social */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-5"
        >
          <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
            Share On
          </p>
          <div className="flex flex-col gap-2">
            {loading
              ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-11 rounded-xl" />)
              : shareTargets.map((t) => (
                  <a
                    key={t.label}
                    href={t.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors',
                      'bg-surface-200 hover:bg-surface-300',
                      t.border,
                    )}
                  >
                    <Share2 className={cn('h-4 w-4 flex-shrink-0', t.color)} aria-hidden />
                    <span className="text-sm font-mono font-semibold text-white">
                      Share on {t.label}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-surface-500 ml-auto" aria-hidden />
                  </a>
                ))}
          </div>
        </motion.div>

        {/* Recent activity */}
        {!loading && stats && stats.recent.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
              Recent Invites
            </p>
            <div className="flex flex-col gap-1.5">
              {stats.recent.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-200/60 border border-surface-300/40"
                >
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full flex-shrink-0',
                      r.completed ? 'bg-emerald' : 'bg-surface-500',
                    )}
                    aria-label={r.completed ? 'Signed up' : 'Clicked'}
                  />
                  <span className="text-xs font-mono text-surface-500 flex-1">
                    {r.completed ? 'Friend joined' : 'Link clicked'}
                  </span>
                  <span className="text-[10px] font-mono text-surface-600 flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden />
                    {relTime(r.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {!loading && stats && stats.recent.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center py-8"
          >
            <Sparkles className="h-8 w-8 text-surface-600 mx-auto mb-3" aria-hidden />
            <p className="text-sm font-mono text-surface-500">No invites sent yet.</p>
            <p className="text-xs font-mono text-surface-600 mt-1">
              Share your link above and start earning Clout.
            </p>
          </motion.div>
        )}

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-6 rounded-2xl border border-surface-300/60 bg-surface-200/40 p-4"
        >
          <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
            How It Works
          </p>
          <ol className="flex flex-col gap-3">
            {[
              { n: 1, icon: Copy, text: 'Copy your unique invite link above.' },
              { n: 2, icon: Share2, text: 'Share it with friends on social media or message them directly.' },
              { n: 3, icon: UserPlus, text: 'When a friend signs up via your link, the visit is logged.' },
              { n: 4, icon: Trophy, text: 'They cast their first vote → you earn 50 Clout automatically.' },
            ].map(({ n, icon: Icon, text }) => (
              <li key={n} className="flex items-start gap-3">
                <div className="flex items-center justify-center h-5 w-5 rounded-full bg-for-600/20 text-for-400 text-[10px] font-mono font-bold flex-shrink-0 mt-0.5">
                  {n}
                </div>
                <div className="flex items-start gap-2">
                  <Icon className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden />
                  <span className="text-xs font-mono text-surface-400">{text}</span>
                </div>
              </li>
            ))}
          </ol>
        </motion.div>

        {/* Preview link */}
        {stats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 flex justify-center"
          >
            <Link
              href={`/invite/${stats.invite_code}`}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              Preview your invite page
            </Link>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
