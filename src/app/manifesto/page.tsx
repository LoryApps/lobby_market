'use client'

/**
 * /manifesto — Civic Manifesto Generator
 *
 * Analyses the current user's full voting history and generates a
 * personalised political declaration using Claude. The manifesto
 * surfaces the user's civic archetype, core principles, and stances
 * across every category they've engaged with.
 *
 * Built as a shareable "identity card" — users can copy a link or
 * share the manifesto as a screenshot.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  RefreshCw,
  Scroll,
  Share2,
  Sparkles,
  ThumbsUp,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { ManifestoResult } from '@/app/api/manifesto/route'

// ─── Archetype badge color map ─────────────────────────────────────────────

const ARCHETYPE_PALETTE = [
  { match: /progressive|reform|change|forward/i, color: 'text-for-300 border-for-500/40 bg-for-500/10' },
  { match: /conserv|tradition|liberty|hawk/i, color: 'text-against-300 border-against-500/40 bg-against-500/10' },
  { match: /pragmat|centrist|balance|moderate/i, color: 'text-gold border-gold/40 bg-gold/10' },
  { match: /democrat|social|community|people/i, color: 'text-emerald border-emerald/40 bg-emerald/10' },
  { match: /tech|innov|digital|future/i, color: 'text-purple border-purple/40 bg-purple/10' },
]

function archetypeColor(archetype: string): string {
  for (const { match, color } of ARCHETYPE_PALETTE) {
    if (match.test(archetype)) return color
  }
  return 'text-for-300 border-for-500/40 bg-for-500/10'
}

// ─── Stat pill ─────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  value,
  label,
  color = 'text-surface-500',
}: {
  icon: React.ComponentType<{ className?: string }>
  value: string | number
  label: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-200/60 border border-surface-300/60">
      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} aria-hidden="true" />
      <span className="text-xs font-mono font-semibold text-white">{value}</span>
      <span className="text-xs font-mono text-surface-500">{label}</span>
    </div>
  )
}

// ─── Manifesto document ────────────────────────────────────────────────────

function ManifestoDocument({
  manifesto,
  username,
}: {
  manifesto: ManifestoResult
  username: string
}) {
  const badgeClass = archetypeColor(manifesto.archetype)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
    >
      {/* Header band */}
      <div className="bg-gradient-to-r from-for-900/60 via-surface-100 to-against-900/60 border-b border-surface-300 px-6 pt-6 pb-5">
        {/* Archetype badge */}
        <div className="mb-4">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono font-bold uppercase tracking-widest',
              badgeClass
            )}
          >
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {manifesto.archetype}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-white font-mono tracking-tight leading-tight mb-2">
          {manifesto.title}
        </h1>

        {/* Archetype description */}
        <p className="text-sm text-surface-500 font-mono italic">
          {manifesto.archetype_description}
        </p>

        {/* Stats row */}
        <div className="flex flex-wrap gap-2 mt-4">
          <StatPill
            icon={Vote}
            value={manifesto.stats.total_votes.toLocaleString()}
            label="votes cast"
            color="text-for-400"
          />
          <StatPill
            icon={BarChart2}
            value={`${manifesto.stats.categories_covered}`}
            label="categories"
            color="text-purple"
          />
          <StatPill
            icon={ThumbsUp}
            value={`${manifesto.stats.for_pct}%`}
            label="pro-reform"
            color="text-emerald"
          />
          {manifesto.stats.laws_supported > 0 && (
            <StatPill
              icon={Gavel}
              value={manifesto.stats.laws_supported}
              label="laws backed"
              color="text-gold"
            />
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5 space-y-6">
        {/* Opening declaration */}
        <div className="border-l-2 border-for-500/60 pl-4">
          <p className="text-base font-mono text-white/90 italic leading-relaxed">
            &ldquo;{manifesto.declaration}&rdquo;
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-5">
          {manifesto.sections.map((section, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
            >
              <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-surface-500 mb-1.5 flex items-center gap-2">
                <span className="inline-block h-px w-4 bg-surface-500" aria-hidden="true" />
                {section.title}
              </h2>
              <p className="text-sm font-mono text-surface-700 leading-relaxed">
                {section.body}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Sign-off */}
        <div className="pt-2 border-t border-surface-300/60">
          <p className="text-sm font-mono text-surface-500 italic">{manifesto.signoff}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-surface-300/40" aria-hidden="true" />
            <span className="text-xs font-mono text-surface-600 font-semibold">
              @{username} · Lobby Market
            </span>
            <div className="h-px flex-1 bg-surface-300/40" aria-hidden="true" />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────

function ManifestoSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden animate-pulse">
      <div className="bg-surface-200/40 border-b border-surface-300 px-6 pt-6 pb-5 space-y-3">
        <div className="h-5 w-36 rounded-full bg-surface-300/60" />
        <div className="h-6 w-2/3 rounded-lg bg-surface-300/50" />
        <div className="h-4 w-1/2 rounded-lg bg-surface-300/40" />
        <div className="flex gap-2 mt-4">
          {[80, 100, 72, 96].map((w, i) => (
            <div key={i} className="h-7 rounded-full bg-surface-300/50" style={{ width: w }} />
          ))}
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="space-y-2 pl-4 border-l-2 border-surface-300/40">
          <div className="h-4 bg-surface-300/40 rounded-lg w-full" />
          <div className="h-4 bg-surface-300/40 rounded-lg w-5/6" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 bg-surface-300/30 rounded w-1/4" />
            <div className="h-4 bg-surface-300/30 rounded w-full" />
            <div className="h-4 bg-surface-300/30 rounded w-4/5" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'generating' | 'done' | 'error' | 'insufficient' | 'unavailable'

export default function ManifestoPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [manifesto, setManifesto] = useState<ManifestoResult | null>(null)
  const [username, setUsername] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load username for attribution
  useEffect(() => {
    async function loadUser() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()
      if (data?.username) setUsername(data.username)
    }
    loadUser()
  }, [])

  const generate = useCallback(async () => {
    setPhase('generating')
    setManifesto(null)

    try {
      const res = await fetch('/api/manifesto', { method: 'POST', cache: 'no-store' })
      const json = await res.json()

      if (json.unavailable) {
        setPhase('unavailable')
        return
      }
      if (json.insufficient_data) {
        setPhase('insufficient')
        return
      }
      if (!res.ok) {
        setPhase('error')
        return
      }

      setManifesto(json as ManifestoResult)
      setPhase('done')
    } catch {
      setPhase('error')
    }
  }, [])

  async function handleCopy() {
    const url = `${window.location.origin}/manifesto`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      /* best-effort */
    }
  }

  function handleTweet() {
    if (!manifesto) return
    const text = encodeURIComponent(
      `My civic archetype: "${manifesto.archetype}" — ${manifesto.archetype_description}\n\nGenerate yours on Lobby Market: ${window.location.origin}/manifesto`
    )
    window.open(
      `https://twitter.com/intent/tweet?text=${text}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <div className="min-h-screen bg-surface-50 pb-20">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6">
        {/* Back + heading */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to feed"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-bold font-mono text-white flex items-center gap-2">
              <Scroll className="h-5 w-5 text-for-400 flex-shrink-0" aria-hidden="true" />
              Civic Manifesto
            </h1>
            <p className="text-xs font-mono text-surface-500">
              AI-generated declaration based on your voting history
            </p>
          </div>
        </div>

        {/* Explainer card (only before first generation) */}
        <AnimatePresence>
          {phase === 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/20">
                  <FileText className="h-5 w-5 text-for-400" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white font-mono">
                    What is a Civic Manifesto?
                  </h2>
                  <p className="text-xs text-surface-500 font-mono mt-0.5">
                    A formal declaration of your political principles, derived from how you&rsquo;ve voted.
                  </p>
                </div>
              </div>
              <ul className="space-y-2 mb-5">
                {[
                  { icon: Vote, text: 'Analyses every topic you\'ve voted on' },
                  { icon: Sparkles, text: 'Identifies your civic archetype and core principles' },
                  { icon: BookOpen, text: 'Generates a formal political declaration' },
                  { icon: Share2, text: 'Shareable on Twitter/X or as a link' },
                ].map(({ icon: Icon, text }, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-xs font-mono text-surface-600">
                    <Icon className="h-3.5 w-3.5 text-for-400 flex-shrink-0" aria-hidden="true" />
                    {text}
                  </li>
                ))}
              </ul>
              <button
                onClick={generate}
                className={cn(
                  'w-full flex items-center justify-center gap-2',
                  'h-11 rounded-xl font-mono font-bold text-sm',
                  'bg-for-600 hover:bg-for-500 text-white',
                  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
                )}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Generate My Manifesto
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generating state */}
        <AnimatePresence>
          {phase === 'generating' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="relative">
                  <Loader2 className="h-10 w-10 text-for-400 animate-spin" aria-hidden="true" />
                  <div className="absolute inset-0 rounded-full blur-lg bg-for-500/20 animate-pulse" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-mono font-semibold text-white">
                    Analysing your civic record…
                  </p>
                  <p className="text-xs font-mono text-surface-500 mt-1">
                    Claude is studying your votes, positions, and patterns
                  </p>
                </div>
              </div>
              <ManifestoSkeleton />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error states */}
        <AnimatePresence>
          {(phase === 'error' || phase === 'unavailable' || phase === 'insufficient') && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-6 text-center space-y-3"
            >
              {phase === 'insufficient' ? (
                <>
                  <p className="text-sm font-mono font-semibold text-white">
                    Not enough voting history yet
                  </p>
                  <p className="text-xs font-mono text-surface-500">
                    Cast at least 5 votes to generate your manifesto.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-mono font-semibold text-for-400 hover:text-for-300 transition-colors"
                  >
                    <Vote className="h-3.5 w-3.5" aria-hidden="true" />
                    Go vote on some topics
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm font-mono font-semibold text-white">
                    {phase === 'unavailable'
                      ? 'AI generation unavailable'
                      : 'Something went wrong'}
                  </p>
                  <p className="text-xs font-mono text-surface-500">
                    {phase === 'unavailable'
                      ? 'The AI service is not configured in this environment.'
                      : 'Could not generate your manifesto. Please try again.'}
                  </p>
                  {phase !== 'unavailable' && (
                    <button
                      onClick={generate}
                      className="inline-flex items-center gap-1.5 mt-1 text-xs font-mono font-semibold text-for-400 hover:text-for-300 transition-colors focus:outline-none"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Try again
                    </button>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Done — show manifesto */}
        <AnimatePresence>
          {phase === 'done' && manifesto && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Action bar */}
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={handleTweet}
                  aria-label="Share manifesto on X / Twitter"
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                    'bg-surface-200 border border-surface-300 text-surface-600',
                    'hover:bg-surface-300 hover:text-white transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-500/40'
                  )}
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Share
                </button>
                <button
                  onClick={handleCopy}
                  aria-label="Copy link to manifesto"
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                    'border transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40',
                    copied
                      ? 'bg-emerald/10 border-emerald/40 text-emerald'
                      : 'bg-surface-200 border-surface-300 text-surface-600 hover:bg-surface-300 hover:text-white'
                  )}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                <button
                  onClick={generate}
                  title="Regenerate"
                  aria-label="Regenerate manifesto"
                  className={cn(
                    'flex items-center justify-center h-8 w-8 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-surface-500',
                    'hover:bg-surface-300 hover:text-white transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-500/40'
                  )}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              {/* Manifesto document */}
              <ManifestoDocument manifesto={manifesto} username={username} />

              {/* Footer note */}
              <p className="text-center text-[11px] font-mono text-surface-600">
                Generated by Claude based on your {manifesto.stats.total_votes} votes across{' '}
                {manifesto.stats.categories_covered} categories.{' '}
                <button
                  onClick={generate}
                  className="text-for-400 hover:text-for-300 underline underline-offset-2 transition-colors"
                >
                  Regenerate
                </button>{' '}
                for a fresh perspective.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Login nudge for unauthenticated users */}
        {phase === 'idle' && !username && (
          <p className="text-center text-xs font-mono text-surface-600 mt-4">
            <Link href="/login" className="text-for-400 hover:text-for-300 underline underline-offset-2">
              Sign in
            </Link>{' '}
            to generate your personal manifesto.
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
