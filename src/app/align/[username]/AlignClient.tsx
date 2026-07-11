'use client'

/**
 * /align/[username] — Civic Vote Alignment Analysis
 *
 * Shows how well the current user's voting positions match another user's.
 * Useful for:
 *   • Deciding whether to delegate your vote to them
 *   • Finding your civic "twin" or discovering principled opponents
 *   • Understanding cross-category agreement patterns
 *
 * Data comes from /api/delegation/alignment?delegate_id=xxx
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Crown,
  RefreshCw,
  Scale,
  Swords,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { AlignmentResponse, CategoryAlignment } from '@/app/api/delegation/alignment/route'

// ─── Category colors (matching platform palette) ──────────────────────────────

const CAT_STYLE: Record<string, { bar: string; text: string; bg: string }> = {
  Economics:   { bar: 'bg-gold',       text: 'text-gold',        bg: 'bg-gold/10'       },
  Politics:    { bar: 'bg-for-500',    text: 'text-for-400',     bg: 'bg-for-500/10'    },
  Technology:  { bar: 'bg-purple',     text: 'text-purple',      bg: 'bg-purple/10'     },
  Science:     { bar: 'bg-emerald',    text: 'text-emerald',     bg: 'bg-emerald/10'    },
  Ethics:      { bar: 'bg-against-400',text: 'text-against-400', bg: 'bg-against-500/10'},
  Philosophy:  { bar: 'bg-purple',     text: 'text-purple',      bg: 'bg-purple/10'     },
  Culture:     { bar: 'bg-gold',       text: 'text-gold',        bg: 'bg-gold/10'       },
  Health:      { bar: 'bg-emerald',    text: 'text-emerald',     bg: 'bg-emerald/10'    },
  Environment: { bar: 'bg-emerald',    text: 'text-emerald',     bg: 'bg-emerald/10'    },
  Education:   { bar: 'bg-for-500',    text: 'text-for-400',     bg: 'bg-for-500/10'    },
  Uncategorised: { bar: 'bg-surface-400', text: 'text-surface-400', bg: 'bg-surface-300/40' },
}

function getCatStyle(cat: string) {
  return CAT_STYLE[cat] ?? CAT_STYLE['Uncategorised']
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function alignmentLabel(pct: number): { label: string; icon: typeof CheckCircle2; color: string } {
  if (pct >= 80) return { label: 'Civic Twin',    icon: CheckCircle2, color: 'text-emerald' }
  if (pct >= 65) return { label: 'Strong Ally',   icon: ThumbsUp,     color: 'text-for-400' }
  if (pct >= 50) return { label: 'Fellow Traveller', icon: TrendingUp, color: 'text-for-300' }
  if (pct >= 35) return { label: 'Mixed Accord',  icon: Scale,        color: 'text-gold'    }
  if (pct >= 20) return { label: 'Principled Rival', icon: Swords,    color: 'text-against-300' }
  return          { label: 'Opposing View',        icon: XCircle,     color: 'text-against-400' }
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({ cat }: { cat: CategoryAlignment }) {
  const style = getCatStyle(cat.category)
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-mono font-medium', style.text)}>{cat.category}</span>
        <span className="text-surface-400 font-mono tabular-nums">
          {cat.pct}% <span className="text-surface-600 font-normal">· {cat.total} shared</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', style.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${cat.pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
    </motion.div>
  )
}

// ─── Big dial ─────────────────────────────────────────────────────────────────

function AlignmentDial({ pct, animating }: { pct: number; animating: boolean }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (pct / 100) * circumference

  const ringColor =
    pct >= 75 ? '#34d399' :
    pct >= 50 ? '#3b82f6' :
    pct >= 30 ? '#f59e0b' :
                '#f87171'

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative inline-flex items-center justify-center">
        <svg width={128} height={128} className="-rotate-90">
          {/* Track */}
          <circle
            cx={64} cy={64} r={radius}
            strokeWidth={10}
            stroke="rgb(var(--surface-300,51,51,68))"
            fill="none"
            className="stroke-surface-300"
          />
          {/* Fill */}
          <motion.circle
            cx={64} cy={64} r={radius}
            strokeWidth={10}
            stroke={ringColor}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: animating ? circumference : strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-mono font-bold tabular-nums text-white leading-none">
            {pct}%
          </span>
          <span className="text-[10px] text-surface-500 font-mono uppercase tracking-wider mt-0.5">
            aligned
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AlignSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="flex justify-center">
        <Skeleton className="h-32 w-32 rounded-full" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Profile types ────────────────────────────────────────────────────────────

interface TargetProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_votes: number
  civic_archetype: string | null
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlignClient({ username }: { username: string }) {
  const router = useRouter()
  const [profile, setProfile] = useState<TargetProfile | null>(null)
  const [alignment, setAlignment] = useState<AlignmentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [animating, setAnimating] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAnimating(true)
    try {
      // Look up target profile
      const supabase = createClient()
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout, total_votes, civic_archetype')
        .eq('username', username)
        .maybeSingle()

      if (!profileData) {
        setError(`No user found with username @${username}.`)
        return
      }
      setProfile(profileData as TargetProfile)

      // Fetch alignment data
      const res = await fetch(`/api/delegation/alignment?delegate_id=${profileData.id}`)
      if (res.status === 400) {
        setError("You can't compare alignment with yourself.")
        return
      }
      if (!res.ok) {
        if (res.status === 401) {
          setError('Sign in to view your vote alignment with other citizens.')
        } else {
          setError('Could not load alignment data. Try again.')
        }
        return
      }

      const data = await res.json() as AlignmentResponse
      setAlignment(data)
      // Kick off animation once data is ready
      requestAnimationFrame(() => setAnimating(false))
    } catch {
      setError('Could not load alignment data. Try again.')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => { load() }, [load])

  const verdict = alignment ? alignmentLabel(alignment.alignment_pct) : null
  const VerdictIcon = verdict?.icon ?? CheckCircle2

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back button + header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white font-mono">Civic Alignment</h1>
            <p className="text-xs text-surface-500">Vote-by-vote position comparison</p>
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

        {loading && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
            <AlignSkeleton />
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-8 text-center space-y-4">
            <XCircle className="h-10 w-10 text-against-400 mx-auto" />
            <p className="text-sm text-against-300">{error}</p>
            {error.includes('Sign in') && (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-for-400 hover:text-for-300"
              >
                Sign in <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}

        {!loading && !error && profile && alignment && (
          <div className="space-y-5">

            {/* Profile card */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-4">
                <Link href={`/profile/${profile.username}`}>
                  <Avatar
                    src={profile.avatar_url}
                    fallback={profile.display_name || profile.username}
                    size="lg"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/profile/${profile.username}`}
                    className="font-bold text-white hover:text-for-300 transition-colors"
                  >
                    {profile.display_name || `@${profile.username}`}
                  </Link>
                  <p className="text-xs text-surface-500">@{profile.username}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant={profile.role as 'person'}>
                      {profile.role}
                    </Badge>
                    <span className="text-xs text-gold font-mono">{profile.clout.toLocaleString()} clout</span>
                    <span className="text-xs text-surface-500">{profile.total_votes.toLocaleString()} votes</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Alignment dial + verdict */}
            <AnimatePresence>
              {alignment.topics_in_common === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center space-y-3"
                >
                  <Scale className="h-10 w-10 text-surface-500 mx-auto" />
                  <div>
                    <p className="font-semibold text-white mb-1">No shared votes yet</p>
                    <p className="text-sm text-surface-500">
                      You and @{profile.username} haven&apos;t voted on any of the same topics.
                      Vote more to build alignment data.
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
                >
                  {/* Dial */}
                  <div className="flex flex-col items-center gap-4 mb-6">
                    <AlignmentDial pct={alignment.alignment_pct} animating={animating} />

                    {/* Verdict */}
                    {verdict && (
                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <div className={cn('flex items-center gap-1.5', verdict.color)}>
                          <VerdictIcon className="h-4 w-4" />
                          <span className="text-sm font-bold font-mono">{verdict.label}</span>
                        </div>
                        <p className="text-xs text-surface-400">
                          Based on <span className="text-white font-semibold">{alignment.topics_in_common}</span> topics you&apos;ve both voted on
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Interpretation */}
                  <div className={cn(
                    'rounded-xl p-3.5 border text-sm leading-relaxed mb-5',
                    alignment.alignment_pct >= 75
                      ? 'bg-emerald/10 border-emerald/30 text-emerald'
                      : alignment.alignment_pct >= 50
                        ? 'bg-for-500/10 border-for-500/30 text-for-300'
                        : alignment.alignment_pct >= 30
                          ? 'bg-gold/10 border-gold/30 text-gold'
                          : 'bg-against-500/10 border-against-500/30 text-against-300',
                  )}>
                    {alignment.alignment_pct >= 75 &&
                      `You and @${profile.username} vote identically on ${alignment.alignment_pct}% of shared topics. Delegating your vote to them would closely mirror your own positions.`}
                    {alignment.alignment_pct >= 50 && alignment.alignment_pct < 75 &&
                      `You agree with @${profile.username} on the majority of shared topics. There's broad overlap, though some meaningful differences remain.`}
                    {alignment.alignment_pct >= 30 && alignment.alignment_pct < 50 &&
                      `You and @${profile.username} have mixed agreement — you share some positions, but also hold distinctly different views on many topics.`}
                    {alignment.alignment_pct < 30 &&
                      `You and @${profile.username} disagree on most shared topics. Delegating your vote to them would likely produce results opposite to your own positions.`}
                  </div>

                  {/* Category breakdown */}
                  {alignment.categories.length > 0 && (
                    <div className="space-y-4">
                      <p className="text-[11px] text-surface-500 uppercase tracking-wider font-mono font-medium">
                        Alignment by Category
                      </p>
                      <div className="space-y-3">
                        {alignment.categories.map((cat) => (
                          <CategoryBar key={cat.category} cat={cat} />
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/delegate`}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                  'bg-for-600/80 border border-for-600/50 text-white',
                  'hover:bg-for-600 transition-colors text-sm font-semibold font-mono',
                )}
              >
                <UserCheck className="h-4 w-4" />
                Delegate Vote
              </Link>
              <Link
                href={`/profile/${profile.username}`}
                className={cn(
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                  'bg-surface-200 border border-surface-300 text-white',
                  'hover:bg-surface-300 transition-colors text-sm font-semibold font-mono',
                )}
              >
                <Users className="h-4 w-4" />
                View Profile
              </Link>
            </div>

            {/* Stats footer */}
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: 'Shared Topics',
                  value: alignment.topics_in_common,
                  icon: BarChart2,
                  color: 'text-for-400',
                },
                {
                  label: 'Their Clout',
                  value: profile.clout,
                  icon: Crown,
                  color: 'text-gold',
                },
                {
                  label: 'Their Votes',
                  value: profile.total_votes,
                  icon: Zap,
                  color: 'text-purple',
                },
              ].map(({ label, value, icon: Icon, color }) => (
                <div
                  key={label}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-3.5 flex flex-col items-center gap-1 text-center"
                >
                  <Icon className={cn('h-4 w-4', color)} />
                  <span className={cn('text-lg font-mono font-bold tabular-nums', color)}>
                    {value.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-surface-500">{label}</span>
                </div>
              ))}
            </div>

            {/* Delegate leaderboard link */}
            <Link
              href="/leaderboard/delegates"
              className="flex items-center justify-between w-full p-4 rounded-xl bg-purple/5 border border-purple/20 hover:border-purple/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-purple/10 border border-purple/20 flex items-center justify-center flex-shrink-0">
                  <Users className="h-4 w-4 text-purple" />
                </div>
                <div>
                  <p className="text-sm font-mono font-semibold text-white group-hover:text-purple transition-colors">
                    Top Trusted Delegates
                  </p>
                  <p className="text-[11px] font-mono text-surface-600">
                    Browse the most trusted voices in the Lobby
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-purple transition-colors" />
            </Link>

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
