'use client'

/**
 * /oath — The Civic Oath
 *
 * A one-time ceremony where a citizen chooses a core civic value and
 * formally pledges to participate in good faith.  The oath timestamp
 * and chosen value are stored permanently on the profile.
 *
 * Three states:
 *   1. loading   — fetch status from /api/oath
 *   2. ceremony  — value picker + oath text + pledge button (unauthenticated
 *                  users see a prompt to sign in)
 *   3. certificate — animated reveal shown after taking (or if already taken)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Flame,
  Gavel,
  Heart,
  Loader2,
  Scale,
  Scroll,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { OathStatus } from '@/app/api/oath/route'

// ─── Value definitions ─────────────────────────────────────────────────────────

type OathValue = 'truth' | 'justice' | 'liberty' | 'community' | 'progress'

interface ValueDef {
  id: OathValue
  label: string
  tagline: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  ring: string
  glow: string
  bg: string
}

const VALUES: ValueDef[] = [
  {
    id: 'truth',
    label: 'Truth',
    tagline: 'Evidence before belief',
    icon: Star,
    color: 'text-gold',
    ring: 'ring-gold/60',
    glow: 'shadow-[0_0_24px_rgba(234,179,8,0.35)]',
    bg: 'bg-gold/10 border-gold/30',
  },
  {
    id: 'justice',
    label: 'Justice',
    tagline: 'Fair process for all',
    icon: Scale,
    color: 'text-for-300',
    ring: 'ring-for-400/60',
    glow: 'shadow-[0_0_24px_rgba(96,165,250,0.35)]',
    bg: 'bg-for-500/10 border-for-500/30',
  },
  {
    id: 'liberty',
    label: 'Liberty',
    tagline: 'Freedom as a first principle',
    icon: Shield,
    color: 'text-against-300',
    ring: 'ring-against-400/60',
    glow: 'shadow-[0_0_24px_rgba(248,113,113,0.35)]',
    bg: 'bg-against-500/10 border-against-500/30',
  },
  {
    id: 'community',
    label: 'Community',
    tagline: 'The common good before self',
    icon: Heart,
    color: 'text-emerald',
    ring: 'ring-emerald/60',
    glow: 'shadow-[0_0_24px_rgba(52,211,153,0.35)]',
    bg: 'bg-emerald/10 border-emerald/30',
  },
  {
    id: 'progress',
    label: 'Progress',
    tagline: 'Always improving, never finished',
    icon: TrendingUp,
    color: 'text-purple',
    ring: 'ring-purple/60',
    glow: 'shadow-[0_0_24px_rgba(167,139,250,0.35)]',
    bg: 'bg-purple/10 border-purple/30',
  },
]

const VALUE_MAP = Object.fromEntries(VALUES.map((v) => [v.id, v])) as Record<OathValue, ValueDef>

// ─── Oath text ────────────────────────────────────────────────────────────────

const OATH_LINES: string[] = [
  'I enter this civic space in good faith.',
  'I will reason from evidence, not from reflex.',
  'I will engage with arguments I disagree with — not dismiss them.',
  'I will change my mind when the case demands it.',
  'I will hold my beliefs with conviction and my opponents with respect.',
  'I pledge this, guided by the value of',
]

// ─── Certificate component ────────────────────────────────────────────────────

function OathCertificate({
  oathAt,
  value,
  rollCount,
}: {
  oathAt: string
  value: OathValue
  rollCount: number
}) {
  const def = VALUE_MAP[value]
  const Icon = def.icon
  const date = new Date(oathAt)
  const formatted = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-lg mx-auto"
    >
      {/* Glow */}
      <div
        className={cn(
          'relative rounded-2xl border p-8 text-center space-y-6 overflow-hidden',
          def.bg,
          def.glow,
        )}
      >
        {/* Corner ornaments */}
        <div className="absolute top-3 left-3 h-6 w-6 border-t-2 border-l-2 border-surface-400/40 rounded-tl" />
        <div className="absolute top-3 right-3 h-6 w-6 border-t-2 border-r-2 border-surface-400/40 rounded-tr" />
        <div className="absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-surface-400/40 rounded-bl" />
        <div className="absolute bottom-3 right-3 h-6 w-6 border-b-2 border-r-2 border-surface-400/40 rounded-br" />

        {/* Seal */}
        <div className="flex justify-center">
          <motion.div
            initial={{ rotate: -15, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'h-20 w-20 rounded-full flex items-center justify-center border-2',
              def.bg,
              'border-current',
              def.color,
            )}
          >
            <Icon className={cn('h-9 w-9', def.color)} />
          </motion.div>
        </div>

        {/* Header */}
        <div>
          <p className="text-[11px] font-mono tracking-[0.2em] uppercase text-surface-500 mb-1">
            Lobby Market
          </p>
          <h2 className="text-2xl font-bold text-white tracking-tight">Civic Oath</h2>
          <p className="text-[11px] font-mono tracking-[0.15em] uppercase text-surface-500 mt-0.5">
            Certificate of Commitment
          </p>
        </div>

        {/* Oath statement */}
        <div className="border-t border-b border-surface-300/30 py-5 space-y-1.5">
          <p className="text-sm text-surface-400 italic">
            &ldquo;I enter this civic space in good faith, guided by the value of&rdquo;
          </p>
          <p className={cn('text-3xl font-bold tracking-tight', def.color)}>{def.label}</p>
          <p className="text-xs text-surface-500 italic">&ldquo;{def.tagline}&rdquo;</p>
        </div>

        {/* Date + roll number */}
        <div className="space-y-1">
          <p className="text-sm text-surface-400">Pledged on {formatted}</p>
          {rollCount > 0 && (
            <p className="text-xs font-mono text-surface-600">
              Oath Roll No.&thinsp;{rollCount.toLocaleString()}
            </p>
          )}
        </div>

        {/* Lobby seal */}
        <div className="flex items-center justify-center gap-2 text-surface-600">
          <Gavel className="h-3.5 w-3.5" />
          <span className="text-[10px] font-mono tracking-widest uppercase">Lobby Market · Civic Record</span>
          <Gavel className="h-3.5 w-3.5" />
        </div>
      </div>

      {/* CTA links */}
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <Link
          href="/profile/me"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm text-white hover:bg-surface-300 transition-colors"
        >
          <Users className="h-4 w-4 text-surface-500" />
          View Profile
        </Link>
        <Link
          href="/charter"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm text-surface-600 hover:bg-surface-300 hover:text-white transition-colors"
        >
          <Scroll className="h-4 w-4" />
          Civic Charter
        </Link>
        <Link
          href="/floor"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600/20 border border-for-500/30 text-sm text-for-300 hover:bg-for-600/30 transition-colors"
        >
          <Flame className="h-4 w-4" />
          Join a Debate
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

type Phase = 'loading' | 'pick' | 'read' | 'certificate'

export function OathClient() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [selected, setSelected] = useState<OathValue | null>(null)
  const [pledging, setPledging] = useState(false)
  const [oathData, setOathData] = useState<OathStatus | null>(null)
  const [rollCount, setRollCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch status ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/oath')
      .then((r) => r.json())
      .then((data: OathStatus & { error?: string }) => {
        if (data.error) {
          // Unauthenticated — show ceremony anyway, gate at pledge
          setPhase('pick')
          return
        }
        setOathData(data)
        setRollCount(data.roll_count)
        if (data.taken && data.oath_value) {
          setSelected(data.oath_value as OathValue)
          setPhase('certificate')
        } else {
          setPhase('pick')
        }
      })
      .catch(() => setPhase('pick'))
  }, [])

  // ── Pledge ──────────────────────────────────────────────────────────────────
  const handlePledge = useCallback(async () => {
    if (!selected || pledging) return
    setPledging(true)
    setError(null)

    try {
      const res = await fetch('/api/oath', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: selected }),
      })
      const data: OathStatus & { error?: string } = await res.json()

      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setPledging(false)
        return
      }

      setOathData(data)
      if (data.roll_count) setRollCount(data.roll_count)
      setPhase('certificate')
    } catch {
      setError('Network error. Please try again.')
      setPledging(false)
    }
  }, [selected, pledging])

  const def = selected ? VALUE_MAP[selected] : null

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 flex flex-col items-center px-4 pb-24 pt-6">
        {/* Back link */}
        <div className="w-full max-w-2xl mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </div>

        <AnimatePresence mode="wait">
          {/* ── Loading ───────────────────────────────────────────────────── */}
          {phase === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-24"
            >
              <Loader2 className="h-7 w-7 animate-spin text-surface-500" />
            </motion.div>
          )}

          {/* ── Pick value ───────────────────────────────────────────────── */}
          {phase === 'pick' && (
            <motion.div
              key="pick"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-2xl space-y-8"
            >
              {/* Header */}
              <div className="text-center space-y-3">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="mx-auto h-16 w-16 rounded-2xl bg-surface-200 border border-surface-300 flex items-center justify-center"
                >
                  <Scroll className="h-8 w-8 text-gold" />
                </motion.div>
                <h1 className="text-3xl font-bold text-white tracking-tight">The Civic Oath</h1>
                <p className="text-surface-400 text-sm max-w-md mx-auto leading-relaxed">
                  A one-time commitment to good-faith civic participation. Choose the value that
                  guides your engagement, then speak the oath.
                </p>
              </div>

              {/* Value picker */}
              <div className="space-y-2">
                <p className="text-xs font-mono tracking-widest uppercase text-surface-600 text-center mb-4">
                  Choose your guiding value
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {VALUES.map((v, i) => {
                    const Icon = v.icon
                    const isSelected = selected === v.id
                    return (
                      <motion.button
                        key={v.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.06, duration: 0.35 }}
                        onClick={() => setSelected(v.id)}
                        className={cn(
                          'relative flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200',
                          isSelected
                            ? cn('ring-2', v.ring, v.bg, v.glow)
                            : 'bg-surface-100 border-surface-300 hover:bg-surface-200 hover:border-surface-400',
                        )}
                      >
                        <div
                          className={cn(
                            'flex-shrink-0 h-10 w-10 rounded-xl border flex items-center justify-center transition-colors',
                            isSelected ? cn(v.bg, 'border-current', v.color) : 'bg-surface-200 border-surface-300 text-surface-500',
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className={cn('font-semibold text-sm', isSelected ? v.color : 'text-white')}>
                            {v.label}
                          </p>
                          <p className="text-xs text-surface-500 mt-0.5">{v.tagline}</p>
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            className="absolute top-3 right-3"
                          >
                            <CheckCircle2 className={cn('h-4 w-4', v.color)} />
                          </motion.div>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* CTA */}
              <div className="flex justify-center">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={!selected}
                  onClick={() => setPhase('read')}
                  className={cn(
                    'flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-200',
                    selected
                      ? cn('text-white shadow-lg', def?.glow)
                      : 'bg-surface-200 text-surface-600 cursor-not-allowed',
                    selected && def?.bg.replace('/10', '/30'),
                    selected && 'border border-current',
                    selected && def?.color,
                  )}
                >
                  <BookOpen className="h-4 w-4" />
                  Read the Oath
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Read oath ────────────────────────────────────────────────── */}
          {phase === 'read' && def && selected && (
            <motion.div
              key="read"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-lg space-y-8"
            >
              {/* Seal */}
              <div className="flex justify-center">
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    'h-20 w-20 rounded-full border-2 flex items-center justify-center',
                    def.bg,
                    'border-current',
                    def.color,
                    def.glow,
                  )}
                >
                  <def.icon className={cn('h-9 w-9', def.color)} />
                </motion.div>
              </div>

              {/* Oath text */}
              <div className="space-y-3 text-center">
                {OATH_LINES.map((line, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.12, duration: 0.4 }}
                    className={cn(
                      'text-base leading-relaxed',
                      i === OATH_LINES.length - 1
                        ? 'text-surface-400'
                        : 'text-white',
                    )}
                  >
                    {line}
                    {i === OATH_LINES.length - 1 && (
                      <>
                        {' '}
                        <span className={cn('font-bold', def.color)}>{def.label}</span>.
                      </>
                    )}
                  </motion.p>
                ))}
              </div>

              {/* Divider */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="border-t border-surface-300/50"
              />

              {/* Error */}
              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-against-400 text-center"
                >
                  {error}
                </motion.p>
              )}

              {/* Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.95, duration: 0.4 }}
                className="flex flex-col items-center gap-3"
              >
                <button
                  onClick={handlePledge}
                  disabled={pledging}
                  className={cn(
                    'flex items-center gap-2.5 px-10 py-3.5 rounded-xl font-bold text-base transition-all duration-200',
                    'border shadow-lg',
                    def.bg,
                    'border-current',
                    def.color,
                    def.glow,
                    pledging && 'opacity-70 cursor-wait',
                    !pledging && 'hover:scale-[1.02] active:scale-[0.98]',
                  )}
                >
                  {pledging ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Zap className="h-5 w-5" />
                  )}
                  I Solemnly Pledge
                </button>

                <button
                  onClick={() => { setPhase('pick'); setError(null) }}
                  className="text-sm text-surface-500 hover:text-surface-400 transition-colors"
                >
                  Change value
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ── Certificate ──────────────────────────────────────────────── */}
          {phase === 'certificate' && oathData?.oath_value && oathData.oath_at && (
            <motion.div
              key="certificate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-lg space-y-6"
            >
              {/* Confetti-style sparkle header */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-center justify-center gap-2 text-gold"
              >
                <Award className="h-5 w-5" />
                <span className="text-sm font-semibold tracking-wide">Oath Taken</span>
                <Sparkles className="h-4 w-4" />
              </motion.div>

              <OathCertificate
                oathAt={oathData.oath_at}
                value={oathData.oath_value as OathValue}
                rollCount={rollCount}
              />

              {/* Roll stat */}
              {rollCount > 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-center text-xs text-surface-600 font-mono"
                >
                  {rollCount.toLocaleString()} citizens have taken the Civic Oath
                </motion.p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
