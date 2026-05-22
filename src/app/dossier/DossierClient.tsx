'use client'

/**
 * /dossier — The Civic Dossier
 *
 * A compact, shareable civic identity card showing who you are on the platform:
 *   - Identity: name, archetype, role, member since
 *   - Core stats: votes, arguments, laws contributed to, streak
 *   - Prediction track record
 *   - Category fingerprint: which civic areas you engage in most
 *   - FOR/AGAINST lean across all your votes
 *
 * Can be viewed for any user via ?username= query param.
 * Defaults to the currently logged-in user.
 *
 * Distinct from:
 *   /analytics     — deep multi-tab stats dashboard
 *   /report-card   — letter-graded academic-style assessment
 *   /manifesto     — AI-generated political declaration
 *   /fingerprint   — uniqueness vs platform consensus
 *   /profile/[u]   — full public profile with tabs
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Flame,
  Gavel,
  Globe,
  Scale,
  Share2,
  Target,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { ARCHETYPE_CONFIG, type ArchetypeId } from '@/lib/config/archetypes'
import { cn } from '@/lib/utils/cn'
import type { DossierData, DossierCategory } from '@/app/api/dossier/route'

// ─── Category colors ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, { bar: string; text: string; bg: string }> = {
  Economics:   { bar: 'bg-gold',         text: 'text-gold',         bg: 'bg-gold/10' },
  Politics:    { bar: 'bg-for-500',      text: 'text-for-400',      bg: 'bg-for-500/10' },
  Technology:  { bar: 'bg-purple',       text: 'text-purple',       bg: 'bg-purple/10' },
  Science:     { bar: 'bg-emerald',      text: 'text-emerald',      bg: 'bg-emerald/10' },
  Ethics:      { bar: 'bg-against-500',  text: 'text-against-400',  bg: 'bg-against-500/10' },
  Philosophy:  { bar: 'bg-purple',       text: 'text-purple',       bg: 'bg-purple/10' },
  Culture:     { bar: 'bg-gold',         text: 'text-gold',         bg: 'bg-gold/10' },
  Environment: { bar: 'bg-emerald',      text: 'text-emerald',      bg: 'bg-emerald/10' },
  Health:      { bar: 'bg-emerald',      text: 'text-emerald',      bg: 'bg-emerald/10' },
  Education:   { bar: 'bg-for-400',      text: 'text-for-400',      bg: 'bg-for-500/10' },
}

function catStyle(name: string) {
  return CAT_COLOR[name] ?? { bar: 'bg-surface-400', text: 'text-surface-400', bg: 'bg-surface-300/30' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMemberSince(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    citizen: 'Citizen',
    senator: 'Senator',
    admin: 'Admin',
    moderator: 'Moderator',
  }
  return map[role] ?? role
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="rounded-2xl bg-surface-200/60 border border-surface-300/60 p-4 flex flex-col items-center text-center gap-1.5">
      <Icon className={cn('h-5 w-5', color)} />
      <p className="text-xl font-mono font-bold text-white leading-none">
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </p>
      <p className="text-[11px] text-surface-500 font-mono uppercase tracking-wide leading-tight">
        {label}
      </p>
    </div>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({ cat, maxPct }: { cat: DossierCategory; maxPct: number }) {
  const style = catStyle(cat.name)
  const widthPct = maxPct > 0 ? (cat.pct / maxPct) * 100 : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={cn('font-semibold', style.text)}>{cat.name}</span>
        <span className="text-surface-500 font-mono">{cat.voteCount} votes</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', style.bar)}
            initial={{ width: 0 }}
            animate={{ width: `${widthPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <span className="text-[11px] text-surface-500 font-mono w-8 text-right">{cat.pct}%</span>
      </div>
      <div className="flex items-center gap-1 text-[10px]">
        <span className="text-for-400 font-mono">{cat.forPct}% FOR</span>
        <span className="text-surface-600">·</span>
        <span className="text-against-400 font-mono">{100 - cat.forPct}% AGAINST</span>
      </div>
    </div>
  )
}

// ─── FOR/AGAINST lean indicator ───────────────────────────────────────────────

function LeanBar({ forBias }: { forBias: number }) {
  const isFor = forBias >= 50
  const againstPct = 100 - forBias

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-for-400 font-semibold">FOR {forBias}%</span>
        <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex">
        <motion.div
          className="bg-for-500 h-full"
          initial={{ width: 0 }}
          animate={{ width: `${forBias}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className="bg-against-500 h-full"
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <p className="text-center text-[11px] text-surface-500 font-mono">
        {isFor
          ? `Leans ${forBias >= 70 ? 'strongly ' : ''}FOR`
          : `Leans ${againstPct >= 70 ? 'strongly ' : ''}AGAINST`}
      </p>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

function DossierInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const targetUsername = searchParams.get('username')

  const [dossier, setDossier] = useState<DossierData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = targetUsername
        ? `/api/dossier?username=${encodeURIComponent(targetUsername)}`
        : '/api/dossier'
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        throw new Error(await res.text())
      }
      const data: DossierData = await res.json()
      if (mountedRef.current) setDossier(data)
    } catch (e) {
      if (mountedRef.current) setError(e instanceof Error ? e.message : 'Failed to load dossier')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [targetUsername, router])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [load])

  async function handleShare() {
    if (!dossier) return
    const url = `${window.location.origin}/profile/${dossier.username}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: do nothing silently
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !dossier) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
          <EmptyState
            icon={FileText}
            title="Dossier unavailable"
            description={error ?? 'Could not load civic dossier.'}
            action={{ label: 'Try again', onClick: load }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const archConfig =
    dossier.archetype && dossier.archetype in ARCHETYPE_CONFIG
      ? ARCHETYPE_CONFIG[dossier.archetype as ArchetypeId]
      : null

  const maxCatPct = dossier.topCategories[0]?.pct ?? 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* ── Back nav ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="h-9 w-9 flex items-center justify-center rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </button>
          <div>
            <h1 className="text-sm font-mono font-bold text-white tracking-wide uppercase">
              Civic Dossier
            </h1>
            <p className="text-xs text-surface-500 font-mono">
              {dossier.isOwnProfile ? 'Your civic identity' : `@${dossier.username}'s civic record`}
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* ── Identity card ────────────────────────────────────────── */}
          <div className="rounded-3xl bg-surface-100 border border-surface-300 overflow-hidden">
            {/* Header strip */}
            <div className="h-1.5 bg-gradient-to-r from-for-600 via-purple to-against-600" />

            <div className="p-6">
              {/* Profile row */}
              <div className="flex items-start gap-4 mb-5">
                <Avatar
                  src={dossier.avatarUrl}
                  fallback={dossier.displayName || dossier.username}
                  size="xl"
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-white leading-tight truncate">
                    {dossier.displayName || dossier.username}
                  </h2>
                  <p className="text-sm text-surface-500 font-mono mb-2">@{dossier.username}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {/* Archetype badge */}
                    {archConfig && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border',
                          archConfig.color,
                          archConfig.bgColor,
                          archConfig.borderColor
                        )}
                      >
                        <archConfig.icon className="h-3 w-3" />
                        {archConfig.name}
                      </span>
                    )}
                    {/* Role badge */}
                    {dossier.role !== 'citizen' && (
                      <Badge variant="outline" size="sm">
                        {roleLabel(dossier.role)}
                      </Badge>
                    )}
                    {/* Member since */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono text-surface-500 bg-surface-200 border border-surface-300">
                      Since {formatMemberSince(dossier.memberSince)}
                    </span>
                  </div>
                </div>

                {/* Share button */}
                <button
                  onClick={handleShare}
                  aria-label="Copy profile link"
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                    copied
                      ? 'bg-emerald/10 border-emerald/40 text-emerald'
                      : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-surface-400 hover:text-white'
                  )}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Share'}
                </button>
              </div>

              {/* ── Core stats grid ─────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                <StatTile icon={Vote} label="Votes Cast" value={dossier.totalVotes} color="text-for-400" />
                <StatTile icon={FileText} label="Arguments" value={dossier.totalArguments} color="text-purple" />
                <StatTile icon={Gavel} label="Laws Shaped" value={dossier.lawsContributed} color="text-gold" />
                <StatTile icon={Flame} label="Day Streak" value={dossier.voteStreak} color="text-against-400" />
              </div>

              {/* Secondary stats row */}
              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3.5 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
                    <Zap className="h-4 w-4 text-gold" />
                  </div>
                  <div>
                    <p className="text-lg font-mono font-bold text-white">
                      <AnimatedNumber value={dossier.clout} />
                    </p>
                    <p className="text-[11px] text-surface-500 font-mono uppercase tracking-wide">Clout</p>
                  </div>
                </div>
                <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3.5 flex items-center gap-3">
                  {dossier.predictionAccuracy !== null ? (
                    <>
                      <div className="h-9 w-9 rounded-lg bg-emerald/10 border border-emerald/30 flex items-center justify-center flex-shrink-0">
                        <Target className="h-4 w-4 text-emerald" />
                      </div>
                      <div>
                        <p className="text-lg font-mono font-bold text-white">
                          {dossier.predictionAccuracy}%
                        </p>
                        <p className="text-[11px] text-surface-500 font-mono uppercase tracking-wide">
                          Prediction Acc.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-9 w-9 rounded-lg bg-surface-300/40 border border-surface-400/20 flex items-center justify-center flex-shrink-0">
                        <Target className="h-4 w-4 text-surface-500" />
                      </div>
                      <div>
                        <p className="text-sm font-mono font-semibold text-surface-500">No predictions</p>
                        <p className="text-[11px] text-surface-600 font-mono">yet</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── FOR/AGAINST lean ────────────────────────────────── */}
              <div className="rounded-xl bg-surface-200/40 border border-surface-300/60 p-4 mb-5">
                <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5" />
                  Vote Alignment
                </p>
                <LeanBar forBias={dossier.forBias} />
              </div>

              {/* ── Category fingerprint ────────────────────────────── */}
              {dossier.topCategories.length > 0 ? (
                <div className="rounded-xl bg-surface-200/40 border border-surface-300/60 p-4 mb-5">
                  <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <BarChart2 className="h-3.5 w-3.5" />
                    Civic Fingerprint
                  </p>
                  <div className="space-y-3.5">
                    {dossier.topCategories.map((cat) => (
                      <CategoryBar key={cat.name} cat={cat} maxPct={maxCatPct} />
                    ))}
                  </div>
                </div>
              ) : null}

              {/* ── Action row ──────────────────────────────────────── */}
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/profile/${dossier.username}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600/20 border border-for-600/40 text-for-400 text-xs font-mono font-semibold hover:bg-for-600/30 transition-colors"
                >
                  <Users className="h-3.5 w-3.5" />
                  Full Profile
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </Link>
                {dossier.isOwnProfile && (
                  <>
                    <Link
                      href="/analytics"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-xs font-mono font-semibold hover:border-surface-400 hover:text-white transition-colors"
                    >
                      <BarChart2 className="h-3.5 w-3.5" />
                      Analytics
                    </Link>
                    <Link
                      href="/report-card"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-xs font-mono font-semibold hover:border-surface-400 hover:text-white transition-colors"
                    >
                      <Award className="h-3.5 w-3.5" />
                      Report Card
                    </Link>
                    <Link
                      href="/impact"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 text-xs font-mono font-semibold hover:border-surface-400 hover:text-white transition-colors"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      My Impact
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Quick stats footnote ─────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-surface-600 font-mono">
            <span>{dossier.memberDays} days on the Lobby</span>
            {dossier.predictionAccuracy !== null && (
              <>
                <span>·</span>
                <span>
                  {dossier.predictionsCorrect}/{dossier.predictionsTotal} predictions correct
                </span>
              </>
            )}
            <span>·</span>
            <button
              onClick={handleShare}
              className="flex items-center gap-1 text-for-500 hover:text-for-400 transition-colors"
            >
              <Share2 className="h-3 w-3" />
              Share dossier
            </button>
          </div>
        </motion.div>
      </main>

      <BottomNav />
    </div>
  )
}

export function DossierClient() {
  return (
    <Suspense fallback={null}>
      <DossierInner />
    </Suspense>
  )
}
