'use client'

/**
 * LawVictoryBanner
 *
 * Shown once per law to users who voted FOR the topic that became this law.
 * Appears as an animated gold banner at the top of the Law page with a
 * confetti burst, personalised copy, and a share CTA.
 *
 * State is persisted in localStorage so it only fires once per law/user.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Share2, Trophy, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ConfettiBurst } from '@/components/simulation/ConfettiBurst'
import { cn } from '@/lib/utils/cn'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LawVictoryBannerProps {
  lawId: string
  topicId: string
  lawStatement: string
  totalVoters: number
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SEEN_KEY_PREFIX = 'lm_victory_seen_'

function seenKey(lawId: string) {
  return `${SEEN_KEY_PREFIX}${lawId}`
}

function hasSeenVictory(lawId: string): boolean {
  try {
    return localStorage.getItem(seenKey(lawId)) === '1'
  } catch {
    return true
  }
}

function markVictorySeen(lawId: string) {
  try {
    localStorage.setItem(seenKey(lawId), '1')
  } catch {
    // best-effort
  }
}

// ─── Share helper ──────────────────────────────────────────────────────────────

function shareVictory(lawStatement: string, lawId: string) {
  const text = `I helped establish this consensus law on Lobby Market: "${lawStatement}"`
  const url = `${window.location.origin}/law/${lawId}`
  if (navigator.share) {
    navigator.share({ title: lawStatement, text, url }).catch(() => null)
  } else {
    navigator.clipboard.writeText(`${text}\n${url}`).catch(() => null)
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function LawVictoryBanner({
  lawId,
  topicId,
  lawStatement,
  totalVoters,
}: LawVictoryBannerProps) {
  const [visible, setVisible] = useState(false)
  const [confettiTrigger, setConfettiTrigger] = useState(0)
  const bannerRef = useRef<HTMLDivElement>(null)
  const [bannerOrigin, setBannerOrigin] = useState({ x: 0.5, y: 0 })

  useEffect(() => {
    if (hasSeenVictory(lawId)) return

    let cancelled = false

    async function check() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || cancelled) return

      const { data: vote } = await supabase
        .from('votes')
        .select('side')
        .eq('topic_id', topicId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (vote?.side === 'blue') {
        setVisible(true)
        setConfettiTrigger((t) => t + 1)
        if (bannerRef.current) {
          const rect = bannerRef.current.getBoundingClientRect()
          setBannerOrigin({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          })
        }
      } else {
        // Not a FOR voter — mark seen so we don't check again
        markVictorySeen(lawId)
      }
    }

    check()
    return () => {
      cancelled = true
    }
  }, [lawId, topicId])

  function dismiss() {
    setVisible(false)
    markVictorySeen(lawId)
  }

  return (
    <>
      {/* Confetti burst fires when banner appears */}
      {confettiTrigger > 0 && (
        <ConfettiBurst
          trigger={confettiTrigger}
          side="blue"
          originX={bannerOrigin.x}
          originY={bannerOrigin.y}
        />
      )}

      <AnimatePresence>
        {visible && (
          <motion.div
            ref={bannerRef}
            initial={{ opacity: 0, y: -24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative overflow-hidden',
              'bg-gradient-to-r from-gold/20 via-emerald/15 to-gold/10',
              'border-b border-gold/30',
            )}
          >
            {/* Subtle shimmer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.3 }}
              className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none"
            />

            <div className="max-w-[1400px] mx-auto px-4 py-4 flex items-center gap-4 flex-wrap">
              {/* Trophy icon */}
              <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-gold/20 border border-gold/40">
                <Trophy className="h-5 w-5 text-gold" />
              </div>

              {/* Message */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-semibold text-gold leading-tight">
                  You helped establish this law
                </p>
                <p className="text-xs font-mono text-surface-400 mt-0.5">
                  Your FOR vote was among the{' '}
                  <span className="text-emerald font-semibold">
                    {totalVoters.toLocaleString()} votes
                  </span>{' '}
                  that turned consensus into law.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => shareVictory(lawStatement, lawId)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                    'bg-gold/20 text-gold border border-gold/40',
                    'hover:bg-gold/30 transition-colors'
                  )}
                  aria-label="Share your contribution to this law"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </button>
                <button
                  onClick={dismiss}
                  className="flex items-center justify-center h-7 w-7 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-300/30 transition-colors"
                  aria-label="Dismiss victory banner"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
