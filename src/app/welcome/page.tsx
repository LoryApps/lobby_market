'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { WelcomeResponse } from '@/app/api/welcome/route'

// ─── Accent map ───────────────────────────────────────────────────────────────

const ACCENT: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  gold:    { text: 'text-gold',      bg: 'bg-gold/10',       border: 'border-gold/30',      glow: 'bg-gold/6'       },
  for:     { text: 'text-for-400',   bg: 'bg-for-500/10',    border: 'border-for-500/30',   glow: 'bg-for-500/6'    },
  emerald: { text: 'text-emerald',   bg: 'bg-emerald/10',    border: 'border-emerald/25',   glow: 'bg-emerald/6'    },
  purple:  { text: 'text-purple',    bg: 'bg-purple/10',     border: 'border-purple/25',    glow: 'bg-purple/6'     },
  against: { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', glow: 'bg-against-500/6' },
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ bluePct }: { bluePct: number }) {
  const red = Math.round(100 - bluePct)
  const blue = Math.round(bluePct)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-for-400 w-7 text-right tabular-nums">{blue}%</span>
      <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
        <div className="h-full bg-for-500 rounded-full" style={{ width: `${bluePct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-7 tabular-nums">{red}%</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WelcomePage() {
  const router = useRouter()
  const [data, setData] = useState<WelcomeResponse | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    fetch('/api/welcome')
      .then(async (res) => {
        if (res.status === 401) {
          router.replace('/login')
          return
        }
        if (res.ok) {
          const json = (await res.json()) as WelcomeResponse
          setData(json)
        }
        setAuthChecked(true)
      })
      .catch(() => setAuthChecked(true))
  }, [router])

  const accent = data?.archetype?.accent ?? 'for'
  const ac = ACCENT[accent] ?? ACCENT.for

  // Reusable motion helpers
  const up = (delay: number) =>
    ({
      initial: { opacity: 0, y: 18 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.55, delay, ease: [0.25, 0.46, 0.45, 0.94] },
    }) as const

  const fadeIn = (delay: number) =>
    ({
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.5, delay },
    }) as const

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center px-4 pb-20 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <motion.div
          {...fadeIn(0.3)}
          className={cn(
            'absolute top-[-80px] left-1/2 -translate-x-1/2 w-[560px] h-[400px] rounded-full blur-[120px] opacity-40',
            ac.glow,
          )}
        />
        <motion.div
          {...fadeIn(0.6)}
          className="absolute bottom-0 right-1/3 w-72 h-72 bg-against-500/4 rounded-full blur-3xl"
        />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto pt-14">
        {/* Wordmark */}
        <motion.div {...fadeIn(0.25)} className="text-center mb-12">
          <span className="text-[11px] font-mono tracking-[0.35em] text-surface-500 uppercase">
            Lobby Market
          </span>
        </motion.div>

        {/* ── Archetype reveal ── */}
        <div className="text-center mb-10">
          <motion.p {...up(0.5)} className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-4">
            Your civic identity
          </motion.p>

          {data ? (
            <>
              <motion.h1 {...up(0.85)} className={cn('text-[2rem] font-bold leading-tight mb-2', ac.text)}>
                {data.archetype.name}
              </motion.h1>
              <motion.p {...up(1.15)} className="text-sm font-mono text-surface-400 italic mb-5">
                &ldquo;{data.archetype.tagline}&rdquo;
              </motion.p>
              <motion.p {...up(1.45)} className="text-sm text-surface-400 leading-relaxed">
                {data.archetype.description}
              </motion.p>
            </>
          ) : (
            <div className="space-y-3 animate-pulse">
              <div className="h-9 w-52 bg-surface-300 rounded-lg mx-auto" />
              <div className="h-4 w-40 bg-surface-300 rounded mx-auto" />
              <div className="h-4 w-64 bg-surface-300 rounded mx-auto" />
              <div className="h-4 w-56 bg-surface-300 rounded mx-auto" />
            </div>
          )}
        </div>

        {/* ── Interest categories ── */}
        {authChecked && (
          <motion.div {...up(1.9)} className="mb-10">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3 text-center">
              Your interests
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {data?.categories && data.categories.length > 0 ? (
                data.categories.map((cat, i) => (
                  <motion.span
                    key={cat}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.9 + i * 0.08, duration: 0.3, ease: 'easeOut' }}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-mono border',
                      i === 0
                        ? cn(ac.bg, ac.border, ac.text)
                        : 'bg-surface-200 border-surface-400 text-surface-400',
                    )}
                  >
                    {cat}
                  </motion.span>
                ))
              ) : (
                // Show skeleton pills while waiting, or generic if empty
                !data ? (
                  [0, 1, 2].map((i) => (
                    <div key={i} className="h-6 w-20 bg-surface-300 rounded-full animate-pulse" />
                  ))
                ) : (
                  <span className="text-xs text-surface-600 font-mono">All topics</span>
                )
              )}
            </div>
          </motion.div>
        )}

        {/* ── Matched topics ── */}
        {authChecked && (
          <motion.div {...up(2.35)} className="mb-10">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3 text-center">
              Your first debates
            </p>

            {data?.topics && data.topics.length > 0 ? (
              <div className="space-y-2">
                {data.topics.map((topic, i) => (
                  <motion.div
                    key={topic.id}
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 2.45 + i * 0.1, duration: 0.4, ease: 'easeOut' }}
                  >
                    <Link
                      href={`/topic/${topic.id}`}
                      className="block rounded-xl border border-surface-300 bg-surface-200 hover:border-surface-400 hover:bg-surface-300 transition-all duration-200 p-3 group"
                    >
                      <p className="text-sm font-mono text-white leading-snug line-clamp-2 mb-2">
                        {topic.statement}
                      </p>
                      <div className="flex items-center justify-between mb-2">
                        {topic.category ? (
                          <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
                        ) : (
                          <span />
                        )}
                        <span className="text-[10px] font-mono text-surface-600">
                          {topic.total_votes.toLocaleString()} votes
                        </span>
                      </div>
                      <VoteBar bluePct={topic.blue_pct} />
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : !data ? (
              <div className="space-y-2">
                {[0, 1, 2, 4].map((i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-surface-300 bg-surface-200 p-3 animate-pulse space-y-2"
                  >
                    <div className="h-4 bg-surface-300 rounded w-full" />
                    <div className="h-4 bg-surface-300 rounded w-4/5" />
                    <div className="h-1.5 bg-surface-300 rounded-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-surface-300 bg-surface-200 p-6 text-center">
                <p className="text-sm text-surface-500">No active debates yet — check back soon.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── CTA ── */}
        <motion.div {...up(3.1)} className="text-center">
          <button
            onClick={() => router.replace('/')}
            className={cn(
              'inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-semibold text-sm',
              'bg-for-600 hover:bg-for-500 text-white transition-all duration-300',
              'shadow-lg shadow-for-600/30 hover:shadow-for-500/40',
            )}
          >
            Enter the platform
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-[11px] text-surface-600 mt-3 font-mono">
            Change your interests anytime in settings
          </p>
        </motion.div>
      </div>
    </div>
  )
}
