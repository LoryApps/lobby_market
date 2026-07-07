'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  Loader2,
  Mail,
  Newspaper,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { DigestData } from '@/app/api/digest/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isLoggedIn: boolean
  alreadySubscribed: boolean
  subscriberCount: number
}

// ─── Issue Preview ─────────────────────────────────────────────────────────────

const ISSUE_PERKS = [
  { icon: Gavel, label: 'Laws passed this week', color: 'text-gold' },
  { icon: Flame, label: 'Most viral debate', color: 'text-against-400' },
  { icon: Scale, label: 'Most contested vote', color: 'text-purple' },
  { icon: TrendingUp, label: 'Top voices rising', color: 'text-for-400' },
  { icon: Sparkles, label: 'AI-graded arguments', color: 'text-emerald' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function VoteBar({ bluePct, size = 'sm' }: { bluePct: number; size?: 'sm' | 'xs' }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  const h = size === 'xs' ? 'h-1' : 'h-1.5'
  return (
    <div className="flex items-center gap-2">
      <span className={cn('font-mono text-for-400 shrink-0', size === 'xs' ? 'text-[10px] w-6' : 'text-[11px] w-7')}>
        {forPct}%
      </span>
      <div className={cn('flex-1 rounded-full bg-surface-300 overflow-hidden', h)}>
        <div
          className="h-full bg-for-500 rounded-full"
          style={{ width: `${forPct}%` }}
        />
      </div>
      <span className={cn('font-mono text-against-400 shrink-0', size === 'xs' ? 'text-[10px] w-6' : 'text-[11px] w-7')}>
        {againstPct}%
      </span>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    law: { label: 'LAW', cls: 'bg-gold/20 text-gold border-gold/30' },
    active: { label: 'LIVE', cls: 'bg-for-500/20 text-for-400 border-for-500/30' },
    voting: { label: 'VOTE', cls: 'bg-purple/20 text-purple border-purple/30' },
    failed: { label: 'FAILED', cls: 'bg-surface-400/20 text-surface-400 border-surface-400/30' },
    proposed: { label: 'PROPOSED', cls: 'bg-surface-500/20 text-surface-500 border-surface-500/30' },
  }
  const { label, cls } = cfg[status] ?? cfg['active']
  return (
    <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider border', cls)}>
      {label}
    </span>
  )
}

// ─── Email Form ────────────────────────────────────────────────────────────────

type FormState = 'idle' | 'loading' | 'success' | 'error'

function SubscribeForm({ isLoggedIn: _isLoggedIn }: { isLoggedIn: boolean }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'loading') return
    setState('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Something went wrong.')
        setState('error')
      } else {
        setState('success')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-3 py-4"
      >
        <div className="w-12 h-12 rounded-full bg-emerald/20 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-emerald" />
        </div>
        <p className="text-white font-semibold text-lg">You&apos;re on the list!</p>
        <p className="text-surface-400 text-sm text-center max-w-xs">
          The Civic Brief lands in your inbox every Monday morning. Check spam if you don&apos;t see it.
        </p>
        <Link
          href="/digest"
          className="flex items-center gap-1.5 text-for-400 hover:text-for-300 text-sm transition-colors mt-1"
        >
          Read this week&apos;s digest <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </motion.div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full max-w-sm mx-auto">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={state === 'loading'}
            className={cn(
              'w-full pl-9 pr-3 py-2.5 rounded-lg border bg-surface-800 text-white placeholder:text-surface-500',
              'text-sm focus:outline-none focus:ring-2 focus:ring-for-500/50 transition-all',
              state === 'error'
                ? 'border-against-500/60'
                : 'border-surface-600 hover:border-surface-500'
            )}
          />
        </div>
        <button
          type="submit"
          disabled={state === 'loading' || !email.trim()}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shrink-0',
            'bg-for-500 hover:bg-for-400 text-white disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {state === 'loading' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>Subscribe <ArrowRight className="w-3.5 h-3.5" /></>
          )}
        </button>
      </div>
      <AnimatePresence>
        {state === 'error' && errorMsg && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-against-400 text-xs text-center"
          >
            {errorMsg}
          </motion.p>
        )}
      </AnimatePresence>
      <p className="text-surface-500 text-xs text-center">
        Weekly · No spam · Unsubscribe anytime
      </p>
    </form>
  )
}

// ─── Digest Preview ─────────────────────────────────────────────────────────────

function DigestPreview({ digest }: { digest: DigestData }) {
  return (
    <div className="rounded-xl border border-surface-700 bg-surface-900 overflow-hidden">
      {/* Newsletter header */}
      <div className="bg-gradient-to-r from-for-600/30 via-surface-800 to-purple/20 px-5 py-4 border-b border-surface-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Newspaper className="w-4 h-4 text-for-400" />
              <span className="text-for-400 text-xs font-bold tracking-wider uppercase">The Civic Brief</span>
            </div>
            <p className="text-surface-400 text-xs">Week of {digest.week.label}</p>
          </div>
          <span className="text-[10px] text-surface-500 border border-surface-600 rounded px-2 py-0.5">PREVIEW</span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Platform stats strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'New debates', val: digest.platformCounts.newTopics, icon: Zap, color: 'text-for-400' },
            { label: 'Votes cast', val: digest.platformCounts.newVotes, icon: TrendingUp, color: 'text-emerald' },
            { label: 'New voices', val: digest.platformCounts.newUsers, icon: Users, color: 'text-purple' },
            { label: 'Laws passed', val: digest.newLaws.length, icon: Gavel, color: 'text-gold' },
          ].map(({ label, val, icon: Icon, color }) => (
            <div key={label} className="bg-surface-800 rounded-lg px-3 py-2.5">
              <div className={cn('flex items-center gap-1.5 mb-1', color)}>
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-white text-lg font-bold tabular-nums">
                {val > 999 ? `${(val / 1000).toFixed(1)}k` : val}
              </p>
            </div>
          ))}
        </div>

        {/* Most viral */}
        {digest.mostViral && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Flame className="w-3.5 h-3.5 text-against-400" />
              <span className="text-[11px] font-bold text-surface-300 uppercase tracking-wider">Most Viral</span>
            </div>
            <Link href={`/topic/${digest.mostViral.id}`} className="block group">
              <div className="bg-surface-800 hover:bg-surface-750 rounded-lg p-3 transition-colors border border-surface-700 hover:border-surface-600">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-white text-sm leading-snug font-medium group-hover:text-for-300 transition-colors line-clamp-2">
                    {digest.mostViral.statement}
                  </p>
                  <StatusPill status={digest.mostViral.status} />
                </div>
                <VoteBar bluePct={digest.mostViral.blue_pct} />
                <p className="text-surface-500 text-xs mt-1.5">
                  {digest.mostViral.total_votes.toLocaleString()} votes · {digest.mostViral.category ?? 'General'}
                </p>
              </div>
            </Link>
          </div>
        )}

        {/* Most contested */}
        {digest.mostContested && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Scale className="w-3.5 h-3.5 text-purple" />
              <span className="text-[11px] font-bold text-surface-300 uppercase tracking-wider">Most Contested</span>
            </div>
            <Link href={`/topic/${digest.mostContested.id}`} className="block group">
              <div className="bg-surface-800 hover:bg-surface-750 rounded-lg p-3 transition-colors border border-surface-700 hover:border-surface-600">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-white text-sm leading-snug font-medium group-hover:text-purple transition-colors line-clamp-2">
                    {digest.mostContested.statement}
                  </p>
                  <StatusPill status={digest.mostContested.status} />
                </div>
                <VoteBar bluePct={digest.mostContested.blue_pct} />
                <p className="text-surface-500 text-xs mt-1.5">
                  {Math.round(Math.abs((digest.mostContested.blue_pct ?? 50) - 50))}% from 50/50 split · {digest.mostContested.category ?? 'General'}
                </p>
              </div>
            </Link>
          </div>
        )}

        {/* New laws */}
        {digest.newLaws.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Gavel className="w-3.5 h-3.5 text-gold" />
              <span className="text-[11px] font-bold text-surface-300 uppercase tracking-wider">
                Laws Established ({digest.newLaws.length})
              </span>
            </div>
            <div className="space-y-2">
              {digest.newLaws.slice(0, 3).map(law => (
                <Link key={law.id} href={`/topic/${law.id}`} className="block group">
                  <div className="flex items-center gap-3 bg-surface-800 hover:bg-surface-750 rounded-lg px-3 py-2 transition-colors border border-gold/10 hover:border-gold/20">
                    <Gavel className="w-3 h-3 text-gold shrink-0" />
                    <p className="text-surface-200 text-xs leading-snug flex-1 line-clamp-1 group-hover:text-white transition-colors">
                      {law.statement}
                    </p>
                    <span className="text-gold text-[10px] font-mono shrink-0">
                      {Math.round(law.blue_pct)}% FOR
                    </span>
                  </div>
                </Link>
              ))}
              {digest.newLaws.length > 3 && (
                <p className="text-surface-500 text-xs text-center pt-0.5">
                  +{digest.newLaws.length - 3} more in the full issue
                </p>
              )}
            </div>
          </div>
        )}

        {/* Footer teaser */}
        <div className="border-t border-surface-700 pt-4 flex items-center justify-between">
          <p className="text-surface-500 text-xs italic">
            Full issue includes top arguments, AI grades, coalition moves & more.
          </p>
          <Link
            href="/digest"
            className="flex items-center gap-1 text-for-400 hover:text-for-300 text-xs font-medium transition-colors shrink-0 ml-3"
          >
            View live digest <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function NewsletterClient({ isLoggedIn, alreadySubscribed, subscriberCount }: Props) {
  const [digest, setDigest] = useState<DigestData | null>(null)
  const [digestLoading, setDigestLoading] = useState(true)

  useEffect(() => {
    fetch('/api/digest')
      .then(r => r.json())
      .then((d: DigestData) => setDigest(d))
      .catch(() => {})
      .finally(() => setDigestLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-4"
      >
        <div className="inline-flex items-center gap-2 bg-surface-800 border border-surface-700 rounded-full px-4 py-1.5 mb-2">
          <Newspaper className="w-3.5 h-3.5 text-for-400" />
          <span className="text-for-300 text-xs font-semibold tracking-wide uppercase">Weekly newsletter</span>
        </div>

        <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
          The Civic Brief
        </h1>
        <p className="text-surface-300 text-lg leading-relaxed max-w-md mx-auto">
          Laws passed. Debates settled. Ideas that shaped the week in democracy —
          curated and delivered every <span className="text-white font-semibold">Monday morning</span>.
        </p>

        {/* Subscriber social proof */}
        <div className="flex items-center justify-center gap-2 text-surface-400 text-sm">
          <Users className="w-4 h-4" />
          <span>
            Join <span className="text-white font-semibold">{subscriberCount.toLocaleString()}</span> civic-minded readers
          </span>
        </div>
      </motion.div>

      {/* Subscribe form / already subscribed state */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-surface-900 border border-surface-700 rounded-2xl p-6 text-center space-y-4"
      >
        {alreadySubscribed ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald" />
            </div>
            <p className="text-white font-semibold">You&apos;re already subscribed</p>
            <p className="text-surface-400 text-sm">The Civic Brief lands in your inbox every Monday.</p>
            <Link
              href="/settings"
              className="text-for-400 hover:text-for-300 text-sm transition-colors"
            >
              Manage preferences in Settings →
            </Link>
          </div>
        ) : (
          <>
            <p className="text-surface-300 text-sm">
              Get the full digest — laws, debates, top voices, and AI-graded arguments — sent to your inbox.
            </p>
            <SubscribeForm isLoggedIn={isLoggedIn} />
          </>
        )}
      </motion.div>

      {/* What's inside */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          What&apos;s inside every issue
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ISSUE_PERKS.map(({ icon: Icon, label, color }) => (
            <div
              key={label}
              className="flex items-center gap-3 bg-surface-900 border border-surface-800 rounded-xl px-4 py-3"
            >
              <div className={cn('shrink-0', color)}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-surface-300 text-sm">{label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Live digest preview */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4 text-for-400" />
          Preview this week&apos;s issue
        </h2>

        {digestLoading ? (
          <div className="rounded-xl border border-surface-700 bg-surface-900 p-8 flex justify-center">
            <Loader2 className="w-5 h-5 text-surface-500 animate-spin" />
          </div>
        ) : digest ? (
          <DigestPreview digest={digest} />
        ) : (
          <div className="rounded-xl border border-surface-700 bg-surface-900 p-8 text-center">
            <p className="text-surface-500 text-sm">Preview unavailable — check back soon.</p>
          </div>
        )}
      </motion.div>

      {/* Bottom CTA */}
      {!alreadySubscribed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="text-center space-y-3"
        >
          <p className="text-surface-400 text-sm">Ready to stay informed?</p>
          <Link
            href="#"
            onClick={e => {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="inline-flex items-center gap-2 bg-for-500 hover:bg-for-400 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            Subscribe to The Civic Brief <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="flex items-center justify-center gap-4 text-surface-500 text-xs pt-1">
            <span>Weekly · Monday mornings</span>
            <span>·</span>
            <span>No spam</span>
            <span>·</span>
            <span>Unsubscribe anytime</span>
          </div>
        </motion.div>
      )}
    </div>
  )
}
