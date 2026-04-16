'use client'

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import type { AchievementTier } from '@/lib/supabase/types'

interface AchievementShareButtonProps {
  url: string
  text: string
  achievementName: string
  tier: AchievementTier
  className?: string
}

const TIER_BTN: Record<AchievementTier, string> = {
  legendary: 'bg-gold/90 hover:bg-gold border-gold/50 text-black',
  epic: 'bg-purple/90 hover:bg-purple border-purple/50 text-white',
  rare: 'bg-for-600 hover:bg-for-500 border-for-500/50 text-white',
  common: 'bg-surface-300 hover:bg-surface-400 border-surface-400 text-white',
}

export function AchievementShareButton({
  url,
  text,
  achievementName,
  tier,
  className,
}: AchievementShareButtonProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handlePrimaryShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: achievementName, text, url })
        return
      } catch {
        // fall through
      }
    }
    setOpen((v) => !v)
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
    setOpen(false)
  }

  function handleTweet() {
    const tweetText = encodeURIComponent(`${text}\n\n${url}`)
    window.open(
      `https://twitter.com/intent/tweet?text=${tweetText}`,
      '_blank',
      'noopener,noreferrer',
    )
    setOpen(false)
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={handlePrimaryShare}
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-semibold border transition-all',
          TIER_BTN[tier] ?? TIER_BTN.common,
        )}
        aria-label={`Share achievement: ${achievementName}`}
        aria-expanded={open}
      >
        <Share2 className="h-4 w-4" aria-hidden />
        Share Achievement
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-52 rounded-2xl border border-surface-300 bg-surface-100 shadow-2xl overflow-hidden"
          >
            <button
              type="button"
              onClick={handleTweet}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-mono text-surface-400 hover:bg-surface-200 hover:text-white transition-colors"
            >
              {/* X (formerly Twitter) logo */}
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-[#1d9bf0] flex-shrink-0"
                aria-hidden="true"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117Z" />
              </svg>
              Share on X / Twitter
            </button>
            <div className="h-px bg-surface-300" />
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm font-mono text-surface-400 hover:bg-surface-200 hover:text-white transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
    </div>
  )
}
