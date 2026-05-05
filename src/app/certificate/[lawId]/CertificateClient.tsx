'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Gavel,
  Share2,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CertificateData {
  law: {
    id: string
    topicId: string
    statement: string
    category: string | null
    establishedAt: string
    bluePct: number
    totalVotes: number
  }
  voter: {
    username: string
    displayName: string | null
    avatarUrl: string | null
    role: string
    votedSide: 'blue' | 'red' | null
    votedAt: string | null
    reason: string | null
    voteRank: number | null
    totalVoters: number
  } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

const CATEGORY_COLORS: Record<string, { text: string; border: string; bg: string }> = {
  Politics:    { text: 'text-for-400',     border: 'border-for-500/50',     bg: 'bg-for-500/5' },
  Economics:   { text: 'text-gold',        border: 'border-gold/50',        bg: 'bg-gold/5' },
  Technology:  { text: 'text-purple',      border: 'border-purple/50',      bg: 'bg-purple/5' },
  Science:     { text: 'text-emerald',     border: 'border-emerald/50',     bg: 'bg-emerald/5' },
  Ethics:      { text: 'text-against-300', border: 'border-against-400/50', bg: 'bg-against-400/5' },
  Philosophy:  { text: 'text-for-300',     border: 'border-for-400/40',     bg: 'bg-for-400/5' },
  Culture:     { text: 'text-gold',        border: 'border-gold/40',        bg: 'bg-gold/5' },
  Health:      { text: 'text-against-300', border: 'border-against-400/50', bg: 'bg-against-400/5' },
  Environment: { text: 'text-emerald',     border: 'border-emerald/50',     bg: 'bg-emerald/5' },
  Education:   { text: 'text-purple',      border: 'border-purple/50',      bg: 'bg-purple/5' },
}

function getCategoryStyle(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? {
    text: 'text-surface-400',
    border: 'border-surface-400/40',
    bg: 'bg-surface-300/5',
  }
}

// ─── Certificate seal ─────────────────────────────────────────────────────────

function GoldSeal({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 80"
      className={cn('text-gold', className)}
      aria-hidden="true"
    >
      {/* Outer ring */}
      <circle cx="40" cy="40" r="38" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
      {/* Decorative dots */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i / 16) * 2 * Math.PI - Math.PI / 2
        const x = 40 + 34 * Math.cos(angle)
        const y = 40 + 34 * Math.sin(angle)
        return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="1.5" fill="currentColor" opacity="0.5" />
      })}
      {/* Inner ring */}
      <circle cx="40" cy="40" r="28" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      {/* Gavel icon */}
      <g transform="translate(24, 24)" opacity="0.9">
        <path
          d="M28 5L23 10L14 1L9 6L18 15L13 20L15 22L20 17L29 26L34 21L25 12L30 7L28 5Z"
          fill="currentColor"
          transform="scale(0.6)"
        />
      </g>
      {/* Center circle */}
      <circle cx="40" cy="40" r="14" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CertificateClient({ data }: { data: CertificateData }) {
  const { law, voter } = data
  const [copied, setCopied] = useState(false)
  const certRef = useRef<HTMLDivElement>(null)

  const catStyle = getCategoryStyle(law.category)
  const forPct = Math.round(law.bluePct)
  const againstPct = 100 - forPct
  const isContributor = voter?.votedSide === 'blue'
  const isOpponent = voter?.votedSide === 'red'

  const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://lobby.market/certificate/${law.id}`

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  function nativeShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `Civic Certificate: ${law.statement.slice(0, 60)}`,
        text: voter?.votedSide === 'blue'
          ? `I voted to pass this civic law on Lobby Market.`
          : `This civic law was established by community consensus on Lobby Market.`,
        url: shareUrl,
      }).catch(() => {})
    } else {
      copyLink()
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header nav */}
      <div className="sticky top-0 z-10 bg-surface-100/80 backdrop-blur border-b border-surface-300 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <Link
            href={`/law/${law.id}`}
            className="flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to law
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                copied
                  ? 'bg-emerald/20 border-emerald/40 text-emerald'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <button
              type="button"
              onClick={nativeShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border bg-for-600 border-for-500/40 text-white hover:bg-for-500 transition-colors"
            >
              <Share2 className="h-3 w-3" />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Certificate */}
      <main className="max-w-2xl mx-auto px-4 py-10 pb-24 md:pb-14">
        <motion.div
          ref={certRef}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn(
            'relative rounded-2xl border overflow-hidden',
            'bg-gradient-to-b from-surface-100 to-surface-50',
            isContributor ? 'border-for-500/40' : isOpponent ? 'border-against-500/40' : 'border-gold/40'
          )}
        >
          {/* Top ambient glow */}
          <div
            className={cn(
              'absolute top-0 left-0 right-0 h-48 opacity-10 pointer-events-none',
              isContributor
                ? 'bg-gradient-to-b from-for-500'
                : isOpponent
                ? 'bg-gradient-to-b from-against-500'
                : 'bg-gradient-to-b from-gold'
            )}
          />

          {/* Header strip */}
          <div className="relative px-8 pt-8 pb-4 text-center border-b border-surface-300">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Gavel className="h-4 w-4 text-gold" aria-hidden />
              <span className="text-xs font-mono text-gold uppercase tracking-[0.2em]">
                Lobby Market
              </span>
              <Gavel className="h-4 w-4 text-gold" aria-hidden />
            </div>
            <h1 className="text-sm font-mono font-bold text-surface-400 uppercase tracking-[0.15em]">
              Certificate of Civic Participation
            </h1>
          </div>

          {/* Seal + contributor line */}
          <div className="relative px-8 py-6 flex flex-col items-center gap-4">
            {/* Seal */}
            <motion.div
              initial={{ rotate: -10, scale: 0.8, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            >
              <GoldSeal className="h-20 w-20" />
            </motion.div>

            {/* Who this is for */}
            {voter && voter.votedSide ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-center"
              >
                <p className="text-xs font-mono text-surface-500 mb-1">
                  This certifies that
                </p>
                <p className="text-2xl font-mono font-bold text-white">
                  {voter.displayName ?? voter.username}
                </p>
                {voter.displayName && (
                  <p className="text-sm font-mono text-surface-500 mt-0.5">@{voter.username}</p>
                )}
                <div className="mt-3 flex items-center justify-center gap-2">
                  {isContributor ? (
                    <>
                      <ThumbsUp className="h-4 w-4 text-for-400" />
                      <span className="text-sm font-mono text-for-300 font-semibold">
                        voted FOR this measure
                      </span>
                    </>
                  ) : (
                    <>
                      <ThumbsDown className="h-4 w-4 text-against-400" />
                      <span className="text-sm font-mono text-against-300 font-semibold">
                        voted AGAINST this measure
                      </span>
                    </>
                  )}
                </div>
                {voter.reason && (
                  <p className="mt-2 text-sm font-mono text-surface-400 italic max-w-sm mx-auto">
                    &ldquo;{voter.reason}&rdquo;
                  </p>
                )}
                {voter.votedAt && (
                  <p className="text-xs font-mono text-surface-600 mt-2">
                    Cast on {formatDate(voter.votedAt)}
                    {voter.voteRank && voter.totalVoters > 10 && (
                      <span className="ml-2 text-surface-500">
                        · {ordinal(voter.voteRank)} of {voter.totalVoters.toLocaleString()} voters
                      </span>
                    )}
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="text-center"
              >
                <p className="text-xs font-mono text-surface-500 mb-1">
                  This certifies that the community
                </p>
                <p className="text-2xl font-mono font-bold text-white">
                  {law.totalVotes.toLocaleString()} citizens
                </p>
                <p className="text-sm font-mono text-surface-400 mt-1">
                  reached civic consensus
                </p>
              </motion.div>
            )}
          </div>

          {/* Divider rule */}
          <div className="mx-8 flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
            <Gavel className="h-3 w-3 text-gold/50" aria-hidden />
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
          </div>

          {/* Law statement */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="px-8 py-6 text-center"
          >
            <p className="text-xs font-mono text-surface-500 mb-3 uppercase tracking-widest">
              Established Law
            </p>
            {law.category && (
              <span className={cn(
                'inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border mb-3',
                catStyle.text, catStyle.border, catStyle.bg
              )}>
                {law.category}
              </span>
            )}
            <blockquote className="text-lg font-mono font-semibold text-white leading-relaxed">
              &ldquo;{law.statement}&rdquo;
            </blockquote>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="mx-8 mb-6 rounded-xl border border-surface-300 bg-surface-200/40 overflow-hidden"
          >
            {/* Vote bar */}
            <div className="h-2 flex">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${forPct}%` }}
                transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
                className="h-full bg-for-500"
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${againstPct}%` }}
                transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
                className="h-full bg-against-600"
              />
            </div>
            <div className="px-5 py-3 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs font-mono text-for-400 font-bold">{forPct}%</p>
                <p className="text-[10px] font-mono text-surface-500">FOR</p>
              </div>
              <div>
                <p className="text-xs font-mono text-white font-bold">
                  {law.totalVotes.toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-surface-500">VOTES</p>
              </div>
              <div>
                <p className="text-xs font-mono text-against-400 font-bold">{againstPct}%</p>
                <p className="text-[10px] font-mono text-surface-500">AGAINST</p>
              </div>
            </div>
          </motion.div>

          {/* Established date */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65 }}
            className="px-8 pb-6 text-center"
          >
            <p className="text-xs font-mono text-surface-500">
              Established by community consensus on
            </p>
            <p className="text-sm font-mono font-semibold text-surface-300 mt-0.5">
              {formatDate(law.establishedAt)}
            </p>
          </motion.div>

          {/* Footer */}
          <div className="px-8 py-4 border-t border-surface-300 bg-surface-200/30 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald animate-pulse" />
              <span className="text-[10px] font-mono text-surface-500">
                Verified by Lobby Market Consensus
              </span>
            </div>
            <Link
              href={`/law/${law.id}`}
              className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              View law
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </motion.div>

        {/* CTA section */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="mt-6 text-center"
        >
          {voter?.votedSide === 'blue' ? (
            <>
              <p className="text-sm font-mono text-surface-400 mb-4">
                You helped shape this law. Share your contribution.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={copyLink}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold border transition-all',
                    copied
                      ? 'bg-emerald/20 border-emerald/40 text-emerald'
                      : 'bg-surface-200 border-surface-300 text-white hover:bg-surface-300'
                  )}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy certificate link'}
                </button>
                <button
                  type="button"
                  onClick={nativeShare}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold bg-for-600 hover:bg-for-500 text-white border border-for-500/40 transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>
            </>
          ) : !voter ? (
            <>
              <p className="text-sm font-mono text-surface-400 mb-4">
                Cast your vote on future topics to earn your own certificates.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold bg-for-600 hover:bg-for-500 text-white border border-for-500/40 transition-colors"
              >
                Browse debates
              </Link>
            </>
          ) : voter.votedSide === null ? (
            <>
              <p className="text-sm font-mono text-surface-400 mb-4">
                You didn&apos;t vote on this topic. Start voting to earn your certificates.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold bg-for-600 hover:bg-for-500 text-white border border-for-500/40 transition-colors"
              >
                Go to feed
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm font-mono text-surface-400 mb-4">
                You voted AGAINST this measure. The community overruled — but your voice was heard.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold bg-surface-200 border border-surface-300 text-white hover:bg-surface-300 transition-colors"
                >
                  <Copy className="h-4 w-4" />
                  Copy link
                </button>
                <Link
                  href={`/law/${law.id}`}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold bg-against-700/40 border border-against-500/40 text-against-300 hover:bg-against-700/60 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  View the law
                </Link>
              </div>
            </>
          )}
        </motion.div>

        {/* Browse more laws */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="mt-8 text-center"
        >
          <p className="text-xs font-mono text-surface-600 mb-3">
            Explore the full Law Codex
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/law"
              className="text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              Law Codex
            </Link>
            <Link
              href="/topic/create"
              className="text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              Propose a topic
            </Link>
            <Link
              href="/achievements"
              className="text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              My achievements
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
