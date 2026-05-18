'use client'

/**
 * /arguments/style-compare — Civic Argument Style Matchup
 *
 * Compare your rhetorical DNA fingerprint with any other citizen.
 * Shows a side-by-side radar of all 6 style dimensions, a compatibility
 * score, shared strengths, contrasting traits, and how many debates you've
 * both argued on.
 *
 * Distinct from:
 *   /arguments/dna      — your personal argument fingerprint
 *   /compare-users      — vote overlap and alignment
 *   /duel               — live head-to-head argument game
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Brain,
  ChevronRight,
  Cpu,
  ExternalLink,
  GitCompare,
  Loader2,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  User,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DnaCompareResponse, DnaProfile } from '@/app/api/arguments/dna/compare/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const DIMENSIONS = [
  { key: 'empirical', label: 'Empirical',  color: 'bg-for-500',      text: 'text-for-400',      desc: 'Data, research, evidence' },
  { key: 'moral',     label: 'Moral',      color: 'bg-purple',       text: 'text-purple',        desc: 'Rights, values, ethics' },
  { key: 'economic',  label: 'Economic',   color: 'bg-gold',         text: 'text-gold',          desc: 'Cost, benefit, markets' },
  { key: 'social',    label: 'Social',     color: 'bg-emerald',      text: 'text-emerald',       desc: 'Community, people, culture' },
  { key: 'visionary', label: 'Visionary',  color: 'bg-against-400',  text: 'text-against-300',   desc: 'Future, progress, change' },
  { key: 'pragmatic', label: 'Pragmatic',  color: 'bg-surface-400',  text: 'text-surface-300',   desc: 'Solutions, what works' },
]

const COMPATIBILITY_LABELS = [
  { min: 80, label: 'Kindred Spirits',  color: 'text-emerald',     desc: 'Your rhetorical styles are nearly identical.' },
  { min: 60, label: 'Aligned Thinkers', color: 'text-for-400',     desc: 'Strong overlap — you argue from similar foundations.' },
  { min: 40, label: 'Complementary',    color: 'text-gold',        desc: 'Different emphases but shared civic values.' },
  { min: 20, label: 'Contrasting',      color: 'text-against-300', desc: 'Your styles diverge — healthy friction ahead.' },
  { min: 0,  label: 'Rhetorical Rivals', color: 'text-against-400', desc: 'Maximum contrast — expect sharp debates.' },
]

function getCompatibilityLabel(score: number) {
  return COMPATIBILITY_LABELS.find((c) => score >= c.min) ?? COMPATIBILITY_LABELS[COMPATIBILITY_LABELS.length - 1]
}

// ─── Hexagon Radar Chart ──────────────────────────────────────────────────────

function RadarChart({
  me,
  them,
  size = 220,
}: {
  me: Record<string, number>
  them: Record<string, number>
  size?: number
}) {
  const cx = size / 2
  const cy = size / 2
  const r = (size / 2) * 0.82

  const dims = DIMENSIONS.map((d, i) => {
    const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2
    return {
      ...d,
      angle,
      axisX: cx + r * Math.cos(angle),
      axisY: cy + r * Math.sin(angle),
    }
  })

  function toXY(scores: Record<string, number>, dim: (typeof dims)[0]) {
    const val = Math.min(100, scores[dim.key] ?? 0) / 100
    return {
      x: cx + r * val * Math.cos(dim.angle),
      y: cy + r * val * Math.sin(dim.angle),
    }
  }

  function polygon(scores: Record<string, number>) {
    return dims.map((d) => {
      const p = toXY(scores, d)
      return `${p.x},${p.y}`
    }).join(' ')
  }

  // Grid rings at 25, 50, 75, 100%
  const rings = [0.25, 0.5, 0.75, 1.0]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
      {/* Grid rings */}
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={dims.map((d) => {
            const rx = cx + r * ring * Math.cos(d.angle)
            const ry = cy + r * ring * Math.sin(d.angle)
            return `${rx},${ry}`
          }).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}

      {/* Axis lines */}
      {dims.map((d) => (
        <line
          key={d.key}
          x1={cx}
          y1={cy}
          x2={d.axisX}
          y2={d.axisY}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}

      {/* "Them" polygon */}
      <polygon
        points={polygon(them)}
        fill="rgba(239,68,68,0.1)"
        stroke="rgba(239,68,68,0.55)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* "Me" polygon */}
      <polygon
        points={polygon(me)}
        fill="rgba(59,130,246,0.12)"
        stroke="rgba(59,130,246,0.7)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Dimension labels */}
      {dims.map((d) => {
        const lx = cx + (r + 20) * Math.cos(d.angle)
        const ly = cy + (r + 20) * Math.sin(d.angle)
        return (
          <text
            key={d.key}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fontFamily="monospace"
            fill="rgba(255,255,255,0.5)"
          >
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Stat bar ─────────────────────────────────────────────────────────────────

function StatBar({
  label,
  myScore,
  theirScore,
  color,
  text,
}: {
  label: string
  myScore: number
  theirScore: number
  color: string
  text: string
}) {
  const diff = myScore - theirScore
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className={cn('font-semibold', text)}>{label}</span>
        <span className="text-surface-500">
          {myScore > 0 || theirScore > 0 ? (
            <>
              <span className="text-for-400">{myScore}%</span>
              {' vs '}
              <span className="text-against-400">{theirScore}%</span>
              {diff !== 0 && (
                <span className={cn('ml-1 font-semibold', diff > 0 ? 'text-for-400' : 'text-against-400')}>
                  ({diff > 0 ? '+' : ''}{diff}pp)
                </span>
              )}
            </>
          ) : (
            <span className="text-surface-600">No data</span>
          )}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-300/40 overflow-hidden">
        {/* Them */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-against-500/40"
          style={{ width: `${Math.min(100, theirScore)}%` }}
        />
        {/* Me */}
        <div
          className={cn('absolute left-0 top-0 h-full rounded-full', color)}
          style={{ width: `${Math.min(100, myScore)}%`, opacity: 0.85 }}
        />
      </div>
    </div>
  )
}

// ─── Profile card ─────────────────────────────────────────────────────────────

function ProfileCard({ profile, side }: { profile: DnaProfile; side: 'me' | 'them' }) {
  const isMe = side === 'me'
  return (
    <div className={cn(
      'flex flex-col items-center gap-2 p-4 rounded-2xl border',
      isMe
        ? 'bg-for-500/5 border-for-500/20'
        : 'bg-against-500/5 border-against-500/20'
    )}>
      <Avatar
        src={profile.avatarUrl}
        fallback={profile.displayName || profile.username}
        size="lg"
        className={cn('ring-2', isMe ? 'ring-for-500/40' : 'ring-against-500/40')}
      />
      <div className="text-center min-w-0">
        <Link
          href={`/profile/${profile.username}`}
          className="text-sm font-mono font-semibold text-white hover:text-for-400 transition-colors truncate block"
        >
          {profile.displayName ?? `@${profile.username}`}
        </Link>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5">@{profile.username}</p>
      </div>
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
        profile.archetypeBadge
      )}>
        {profile.archetypeName}
      </span>
      <div className="text-center">
        <p className="text-[11px] font-mono text-surface-500">{profile.archetypeTagline}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 w-full mt-1">
        {[
          { label: 'Args', value: profile.totalArguments },
          { label: 'FOR', value: profile.forCount },
          { label: 'vs', value: profile.againstCount },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-sm font-mono font-bold text-white">{value}</p>
            <p className="text-[9px] font-mono text-surface-600">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Search / Input ───────────────────────────────────────────────────────────

interface UserSuggestion {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  argument_count: number
}

function UserSearch({ onSelect }: { onSelect: (username: string) => void }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (query.length < 2) { setSuggestions([]); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/users/suggest?q=${encodeURIComponent(query)}&limit=6`)
        if (res.ok) setSuggestions(await res.json())
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    }, 280)
  }, [query])

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username…"
          className="w-full h-11 bg-surface-100 border border-surface-300 rounded-xl pl-10 pr-4 text-sm font-mono text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20 transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full mt-1 left-0 right-0 z-30 rounded-xl bg-surface-100 border border-surface-300 shadow-xl overflow-hidden"
          >
            {suggestions.map((u) => (
              <button
                key={u.id}
                onClick={() => { onSelect(u.username); setSuggestions([]); setQuery('') }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-200 transition-colors text-left"
              >
                <Avatar src={u.avatar_url} fallback={u.display_name || u.username} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-white truncate">
                    {u.display_name ?? u.username}
                  </p>
                  <p className="text-[11px] font-mono text-surface-500">
                    @{u.username} · {u.argument_count} arguments
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-600 flex-shrink-0" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function StyleCompareInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<DnaCompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [targetUsername, setTargetUsername] = useState(searchParams.get('user') ?? '')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (username: string) => {
    if (!username) return
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const res = await fetch(`/api/arguments/dna/compare?username=${encodeURIComponent(username)}`)
      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Failed to load comparison')
        return
      }
      setData(await res.json())
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (targetUsername) load(targetUsername)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(username: string) {
    setTargetUsername(username)
    router.replace(`/arguments/style-compare?user=${encodeURIComponent(username)}`, { scroll: false })
    load(username)
  }

  async function share() {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* fallback */ }
  }

  const compat = data ? getCompatibilityLabel(data.compatibilityScore) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Link href="/arguments/dna" className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              My DNA
            </Link>
            <span className="text-surface-600">/</span>
            <span className="text-xs font-mono text-surface-400">Style Matchup</span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-purple/10 border border-purple/30">
                <GitCompare className="h-6 w-6 text-purple" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Style Matchup</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Compare argument DNA with any citizen
                </p>
              </div>
            </div>

            {data && (
              <button
                onClick={share}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                {copied ? <><X className="h-3 w-3 text-emerald" /><span className="text-emerald">Copied</span></> : <><Share2 className="h-3 w-3" />Share</>}
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <UserSearch onSelect={handleSelect} />
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-52 rounded-2xl" />
              <Skeleton className="h-52 rounded-2xl" />
            </div>
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="p-5 rounded-2xl bg-against-500/10 border border-against-500/20 text-center">
            <p className="font-mono text-sm text-against-400">{error}</p>
            {error.includes('not found') && (
              <p className="font-mono text-xs text-surface-500 mt-2">
                Try searching for a different username.
              </p>
            )}
          </div>
        )}

        {/* Empty state */}
        {!data && !loading && !error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 space-y-4"
          >
            <div className="flex items-center justify-center h-16 w-16 mx-auto rounded-2xl bg-purple/10 border border-purple/20">
              <Brain className="h-8 w-8 text-purple" />
            </div>
            <div>
              <h2 className="font-mono text-base font-bold text-white">Find a citizen to compare</h2>
              <p className="font-mono text-sm text-surface-500 mt-1 max-w-sm mx-auto">
                Search for any user to compare how you argue — your shared strengths, contrasting styles, and rhetorical compatibility.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center text-xs font-mono text-surface-500 pt-2">
              <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-for-400" /> 6 style dimensions</span>
              <span className="flex items-center gap-1"><Trophy className="h-3 w-3 text-gold" /> Compatibility score</span>
              <span className="flex items-center gap-1"><Swords className="h-3 w-3 text-against-400" /> Shared debates</span>
            </div>
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {data && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* Profile cards */}
              <div className="grid grid-cols-2 gap-4">
                {data.me ? (
                  <ProfileCard profile={data.me} side="me" />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border border-surface-300 bg-surface-100 text-center">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-surface-200 border border-surface-300">
                      <User className="h-5 w-5 text-surface-500" />
                    </div>
                    <p className="text-xs font-mono text-surface-500">
                      <Link href="/login" className="text-for-400 hover:underline">Sign in</Link> to compare your DNA
                    </p>
                  </div>
                )}
                <ProfileCard profile={data.them} side="them" />
              </div>

              {/* Compatibility score */}
              {data.me && compat && (
                <div className={cn(
                  'p-4 rounded-2xl border text-center space-y-2',
                  'bg-surface-100 border-surface-300'
                )}>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">Rhetorical Compatibility</p>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-mono text-4xl font-bold text-white">{data.compatibilityScore}</span>
                    <span className="font-mono text-xl text-surface-500">/100</span>
                  </div>
                  <p className={cn('font-mono text-sm font-semibold', compat.color)}>
                    {compat.label}
                  </p>
                  <p className="font-mono text-xs text-surface-500">{compat.desc}</p>

                  {/* Score bar */}
                  <div className="relative h-2 rounded-full bg-surface-300/40 overflow-hidden mt-3">
                    <motion.div
                      className={cn(
                        'absolute left-0 top-0 h-full rounded-full',
                        data.compatibilityScore >= 60 ? 'bg-emerald' :
                        data.compatibilityScore >= 40 ? 'bg-gold' : 'bg-against-500'
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${data.compatibilityScore}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>

                  {data.commonDebateCount > 0 && (
                    <p className="text-[11px] font-mono text-surface-500 mt-1">
                      Both argued on <span className="text-white font-semibold">{data.commonDebateCount}</span> shared debate{data.commonDebateCount !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Radar chart */}
              <div className="p-5 rounded-2xl border border-surface-300 bg-surface-100">
                <h3 className="font-mono text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-purple" />
                  Style Radar
                </h3>

                <div className="flex items-center justify-center mb-4">
                  <RadarChart
                    me={data.me?.styleScores ?? {}}
                    them={data.them.styleScores}
                    size={240}
                  />
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 text-[11px] font-mono text-surface-500">
                  {data.me && (
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-0.5 rounded bg-for-400" />
                      You
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-3 h-0.5 rounded bg-against-400" />
                    @{data.them.username}
                  </span>
                </div>
              </div>

              {/* Dimension bars */}
              {data.me && (
                <div className="p-5 rounded-2xl border border-surface-300 bg-surface-100 space-y-4">
                  <h3 className="font-mono text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-gold" />
                    Dimension Breakdown
                  </h3>
                  {DIMENSIONS.map((dim) => (
                    <StatBar
                      key={dim.key}
                      label={dim.label}
                      myScore={data.me!.styleScores[dim.key] ?? 0}
                      theirScore={data.them.styleScores[dim.key] ?? 0}
                      color={dim.color}
                      text={dim.text}
                    />
                  ))}
                  <p className="text-[10px] font-mono text-surface-600 pt-1">
                    Blue bar = you · Red bar = @{data.them.username}
                  </p>
                </div>
              )}

              {/* Shared strengths and contrasting traits */}
              {data.me && (data.sharedStrengths.length > 0 || data.contrastingTraits.length > 0) && (
                <div className="grid grid-cols-2 gap-4">
                  {data.sharedStrengths.length > 0 && (
                    <div className="p-4 rounded-2xl border border-emerald/20 bg-emerald/5">
                      <h4 className="font-mono text-xs font-semibold text-emerald mb-2 flex items-center gap-1.5">
                        <ThumbsUp className="h-3 w-3" /> Shared Strengths
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {data.sharedStrengths.map((s) => {
                          const d = DIMENSIONS.find((d) => d.key === s)
                          return (
                            <span key={s} className={cn('text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald/10 border border-emerald/20', d?.text ?? 'text-emerald')}>
                              {d?.label ?? s}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {data.contrastingTraits.length > 0 && (
                    <div className="p-4 rounded-2xl border border-against-500/20 bg-against-500/5">
                      <h4 className="font-mono text-xs font-semibold text-against-400 mb-2 flex items-center gap-1.5">
                        <ThumbsDown className="h-3 w-3" /> Contrasting Traits
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {data.contrastingTraits.map((s) => {
                          const d = DIMENSIONS.find((d) => d.key === s)
                          return (
                            <span key={s} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-against-500/10 border border-against-500/20 text-against-400">
                              {d?.label ?? s}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Top categories comparison */}
              {(data.me?.topCategories.length ?? 0) > 0 || data.them.topCategories.length > 0 ? (
                <div className="p-5 rounded-2xl border border-surface-300 bg-surface-100">
                  <h3 className="font-mono text-sm font-bold text-white mb-4">Top Debate Categories</h3>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    {data.me && (
                      <div>
                        <p className="text-for-400 font-semibold mb-2">You</p>
                        {data.me.topCategories.map((c) => (
                          <div key={c.category} className="flex items-center justify-between py-1 border-b border-surface-300/40">
                            <span className="text-surface-400">{c.category}</span>
                            <span className="text-white font-semibold">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div>
                      <p className="text-against-400 font-semibold mb-2">@{data.them.username}</p>
                      {data.them.topCategories.map((c) => (
                        <div key={c.category} className="flex items-center justify-between py-1 border-b border-surface-300/40">
                          <span className="text-surface-400">{c.category}</span>
                          <span className="text-white font-semibold">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Action row */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href={`/duel?opponent=${data.them.username}`}
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-against-500/10 border border-against-500/20 hover:border-against-500/40 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">Argument Duel</p>
                    <p className="text-[11px] font-mono text-surface-500">Go head-to-head</p>
                  </div>
                  <Swords className="h-4 w-4 text-against-400 group-hover:text-against-300 transition-colors" />
                </Link>

                <Link
                  href={`/profile/${data.them.username}`}
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">View Profile</p>
                    <p className="text-[11px] font-mono text-surface-500">@{data.them.username}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                </Link>
              </div>

              {/* Compare another */}
              <div className="pt-2 text-center">
                <button
                  onClick={() => { setData(null); setTargetUsername(''); router.replace('/arguments/style-compare', { scroll: false }); }}
                  className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1.5 mx-auto"
                >
                  <RefreshCw className="h-3 w-3" />
                  Compare with someone else
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}

export default function StyleComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-28">
          <Skeleton className="h-12 w-64 mb-6" />
          <Skeleton className="h-11 rounded-xl mb-4" />
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Skeleton className="h-52 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
          </div>
        </main>
        <BottomNav />
      </div>
    }>
      <StyleCompareInner />
    </Suspense>
  )
}
