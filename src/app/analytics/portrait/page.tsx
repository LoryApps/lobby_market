'use client'

/**
 * /analytics/portrait — Civic Portrait
 *
 * A single-screen visual identity card that synthesises everything about
 * a user's civic persona: their vote DNA, personality type, dominant
 * categories, accuracy tier, clout, and civic voice label — all in a
 * shareable "civic passport" format.
 *
 * Distinct from:
 *   /analytics/dna          — argument style breakdown
 *   /analytics/fingerprint  — deviation from platform consensus
 *   /analytics/compass      — ideological alignment map
 *   /analytics/sentiment    — emotional tone analysis
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Coins,
  Copy,
  Check,
  Flame,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { PortraitData, PortraitCategory } from '@/app/api/analytics/portrait/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, { text: string; bar: string; bg: string }> = {
  Economics:   { text: 'text-gold',         bar: 'bg-gold',         bg: 'bg-gold/10' },
  Politics:    { text: 'text-for-400',      bar: 'bg-for-500',      bg: 'bg-for-500/10' },
  Technology:  { text: 'text-purple',       bar: 'bg-purple',       bg: 'bg-purple/10' },
  Science:     { text: 'text-emerald',      bar: 'bg-emerald',      bg: 'bg-emerald/10' },
  Ethics:      { text: 'text-for-300',      bar: 'bg-for-400',      bg: 'bg-for-300/10' },
  Philosophy:  { text: 'text-purple',       bar: 'bg-purple',       bg: 'bg-purple/10' },
  Culture:     { text: 'text-against-300',  bar: 'bg-against-400',  bg: 'bg-against-400/10' },
  Health:      { text: 'text-emerald',      bar: 'bg-emerald',      bg: 'bg-emerald/10' },
  Environment: { text: 'text-emerald',      bar: 'bg-emerald',      bg: 'bg-emerald/10' },
  Education:   { text: 'text-gold',         bar: 'bg-gold',         bg: 'bg-gold/10' },
}

function catColor(cat: string) {
  return CATEGORY_COLOR[cat] ?? { text: 'text-surface-400', bar: 'bg-surface-400', bg: 'bg-surface-200' }
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; color: string; Icon: typeof Shield }> = {
  admin:        { label: 'Admin',        color: 'text-gold',     Icon: Shield },
  moderator:    { label: 'Moderator',    color: 'text-emerald',  Icon: Shield },
  senator:      { label: 'Senator',      color: 'text-purple',   Icon: Star },
  representative: { label: 'Rep.',       color: 'text-for-400',  Icon: Star },
  citizen:      { label: 'Citizen',      color: 'text-surface-400', Icon: Shield },
}

function roleInfo(role: string) {
  return ROLE_CONFIG[role] ?? ROLE_CONFIG.citizen
}

// ─── Accuracy tier config ─────────────────────────────────────────────────────

const ACCURACY_TIER: Record<string, { color: string; ring: string }> = {
  Oracle:     { color: 'text-gold',        ring: 'border-gold/60' },
  Sharp:      { color: 'text-emerald',     ring: 'border-emerald/60' },
  Aligned:    { color: 'text-for-400',     ring: 'border-for-500/60' },
  Contrarian: { color: 'text-against-400', ring: 'border-against-500/60' },
}

// ─── Civic voice badge ────────────────────────────────────────────────────────

const VOICE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  Mainstream: { color: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Independent:{ color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Contrarian: { color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Outlier:    { color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Uncharted:  { color: 'text-surface-400', bg: 'bg-surface-200',    border: 'border-surface-300' },
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PortraitSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 flex flex-col items-center gap-3">
        <Skeleton className="h-20 w-20 rounded-full" />
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-48 mt-2" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-14 mb-2" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-3 w-24 mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mb-3">
            <Skeleton className="h-3 w-32 mb-1.5" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Category bars ────────────────────────────────────────────────────────────

function CategoryBars({ categories }: { categories: PortraitCategory[] }) {
  if (categories.length === 0) return null
  const max = Math.max(...categories.map((c) => c.count))

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.3 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5">
        <BarChart2 className="h-3.5 w-3.5" />
        Dominant Arenas
      </div>
      <div className="space-y-3.5">
        {categories.map((cat, i) => {
          const cc = catColor(cat.category)
          const barWidth = max > 0 ? (cat.count / max) * 100 : 0
          return (
            <div key={cat.category}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={cn('text-sm font-medium', cc.text)}>{cat.category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-for-400">{cat.for_pct}% for</span>
                  <span className="text-[10px] font-mono text-surface-500">{cat.count}v</span>
                </div>
              </div>
              <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.6, delay: 0.35 + i * 0.06, ease: 'easeOut' }}
                  className={cn('absolute inset-y-0 left-0 rounded-full', cc.bar)}
                />
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── DNA bar ─────────────────────────────────────────────────────────────────

function VoteDNABar({ forPct }: { forPct: number }) {
  const againstPct = 100 - forPct
  return (
    <div>
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 to-for-400 rounded-full"
        />
      </div>
      <div className="flex justify-between text-[11px] font-mono mt-1.5">
        <span className="text-for-400">FOR {forPct}%</span>
        <span className="text-against-400">{againstPct}% AGAINST</span>
      </div>
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  icon: Icon,
  color = 'text-white',
  delay = 0,
}: {
  label: string
  value: string | number
  icon: typeof TrendingUp
  color?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-1"
    >
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 uppercase tracking-wider">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn('text-2xl font-bold font-mono', color)}>{value}</div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CivicPortraitPage() {
  const router = useRouter()
  const [data, setData] = useState<PortraitData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/portrait', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load portrait')
      const json: PortraitData = await res.json()
      setData(json)
    } catch {
      setError('Failed to load your civic portrait.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  function handleCopy() {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-lg mx-auto pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-300 sticky top-0 bg-surface-50/95 backdrop-blur z-10">
          <button
            onClick={() => router.push('/analytics')}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-surface-200 transition-colors text-surface-500 hover:text-white"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold font-mono text-white truncate">Civic Portrait</h1>
            <p className="text-[11px] text-surface-500 font-mono">Your civic identity, synthesised</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono"
            >
              {copied ? (
                <><Check className="h-3.5 w-3.5 text-emerald" />Copied</>
              ) : (
                <><Copy className="h-3.5 w-3.5" />Share</>
              )}
            </button>
          </div>
        </div>

        {loading && <PortraitSkeleton />}

        {!loading && error && (
          <div className="px-4 pt-8">
            <EmptyState
              icon={Scale}
              title="Portrait unavailable"
              description={error}
              action={{ label: 'Retry', onClick: load }}
            />
          </div>
        )}

        {!loading && data && (
          <AnimatePresence>
            <div className="px-4 pt-4 space-y-4">

              {/* ── Identity card ───────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
              >
                {/* Top accent strip: FOR/AGAINST gradient */}
                <div
                  className="h-1 w-full"
                  style={{
                    background: `linear-gradient(to right, #2563eb ${data.for_pct}%, #dc2626 ${data.for_pct}%)`,
                  }}
                />

                <div className="p-6 flex flex-col items-center text-center gap-3">
                  <Link href={`/profile/${data.username}`}>
                    <Avatar
                      src={data.avatar_url}
                      fallback={data.display_name || data.username}
                      size="lg"
                      className="ring-2 ring-surface-400 ring-offset-2 ring-offset-surface-100"
                    />
                  </Link>

                  <div>
                    <Link
                      href={`/profile/${data.username}`}
                      className="text-xl font-bold text-white hover:text-for-300 transition-colors"
                    >
                      {data.display_name || data.username}
                    </Link>
                    <p className="text-xs font-mono text-surface-500 mt-0.5">@{data.username}</p>
                  </div>

                  {/* Role + member since */}
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    {(() => {
                      const { label, color } = roleInfo(data.role)
                      return (
                        <span className={cn('text-xs font-mono font-bold uppercase tracking-wider', color)}>
                          {label}
                        </span>
                      )
                    })()}
                    <span className="text-surface-600 text-xs">·</span>
                    <span className="text-xs font-mono text-surface-500">
                      Since {memberSince(data.member_since)}
                    </span>
                    {data.days_active > 0 && (
                      <>
                        <span className="text-surface-600 text-xs">·</span>
                        <span className="text-xs font-mono text-surface-500">
                          {data.days_active}d in the Lobby
                        </span>
                      </>
                    )}
                  </div>

                  {/* Persona label */}
                  <div className="mt-1 flex flex-col items-center gap-1.5">
                    <span className="text-2xl font-black font-mono text-white tracking-tight">
                      {data.vote_persona}
                    </span>
                    <p className="text-xs text-surface-500 max-w-xs leading-relaxed">
                      {data.vote_persona_desc}
                    </p>
                  </div>

                  {/* Civic voice badge */}
                  {(() => {
                    const vc = VOICE_CONFIG[data.civic_voice] ?? VOICE_CONFIG.Uncharted
                    return (
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold border',
                        vc.color, vc.bg, vc.border,
                      )}>
                        <Sparkles className="h-3 w-3" />
                        {data.civic_voice} Voice
                      </span>
                    )
                  })()}

                  {/* Vote DNA bar */}
                  <div className="w-full mt-2">
                    <VoteDNABar forPct={data.for_pct} />
                  </div>
                </div>
              </motion.div>

              {/* ── Stats grid ──────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  label="Votes"
                  value={data.total_votes.toLocaleString()}
                  icon={Vote}
                  color="text-for-400"
                  delay={0.1}
                />
                <StatTile
                  label="Clout"
                  value={data.clout.toLocaleString()}
                  icon={Coins}
                  color="text-gold"
                  delay={0.15}
                />
                <StatTile
                  label="Streak"
                  value={data.vote_streak}
                  icon={Flame}
                  color={data.vote_streak >= 7 ? 'text-gold' : data.vote_streak >= 3 ? 'text-for-400' : 'text-surface-400'}
                  delay={0.2}
                />
                <StatTile
                  label="Arguments"
                  value={data.total_arguments}
                  icon={MessageSquare}
                  color="text-purple"
                  delay={0.25}
                />
              </div>

              {/* ── Accuracy card ────────────────────────────────────────── */}
              {data.accuracy !== null ? (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.28 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                    <Target className="h-3.5 w-3.5" />
                    Prediction Accuracy
                  </div>
                  <div className="flex items-center gap-5">
                    {(() => {
                      const at = ACCURACY_TIER[data.accuracy_tier ?? ''] ?? { color: 'text-surface-400', ring: 'border-surface-500' }
                      return (
                        <>
                          <div className={cn(
                            'flex-shrink-0 h-20 w-20 rounded-full border-4 flex flex-col items-center justify-center',
                            at.ring,
                          )}>
                            <span className={cn('text-2xl font-bold font-mono', at.color)}>
                              {data.accuracy}%
                            </span>
                          </div>
                          <div>
                            <div className={cn('text-xl font-bold', at.color)}>
                              {data.accuracy_tier}
                            </div>
                            <p className="text-xs text-surface-500 mt-1">
                              Voted with the eventual majority on {data.accuracy}% of {data.resolved_votes} resolved topics.
                            </p>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.28 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                    <Target className="h-3.5 w-3.5" />
                    Prediction Accuracy
                  </div>
                  <p className="text-sm text-surface-500">
                    Accuracy unlocks once {Math.max(0, 5 - data.resolved_votes)} more of your topics resolve to law or failure.
                  </p>
                </motion.div>
              )}

              {/* ── Category bars ────────────────────────────────────────── */}
              {data.top_categories.length > 0 && (
                <CategoryBars categories={data.top_categories} />
              )}

              {/* ── Civic voice description card ──────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.36 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                  <Zap className="h-3.5 w-3.5" />
                  Civic Voice
                </div>
                <p className="text-sm text-surface-300 leading-relaxed">{data.civic_voice_desc}</p>
                {data.dominant_category && (
                  <p className="text-xs text-surface-500 mt-2">
                    Your most active arena: <span className={catColor(data.dominant_category).text}>{data.dominant_category}</span>
                  </p>
                )}
              </motion.div>

              {/* ── Quick links ───────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.4 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 divide-y divide-surface-300 overflow-hidden"
              >
                {[
                  { label: 'Vote DNA', href: '/analytics', icon: Scale },
                  { label: 'Argument DNA', href: '/analytics/dna', icon: MessageSquare },
                  { label: 'Civic Fingerprint', href: '/analytics/fingerprint', icon: Sparkles },
                  { label: 'Category Mastery', href: '/analytics/category-mastery', icon: BarChart2 },
                  { label: 'Full Profile', href: `/profile/${data.username}`, icon: TrendingUp },
                ].map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
                      <span className="text-sm font-mono text-surface-300 group-hover:text-white transition-colors">{label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
                  </Link>
                ))}
              </motion.div>

            </div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
