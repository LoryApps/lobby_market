'use client'

/**
 * TopicAIBrief
 *
 * Shows a Claude-generated neutral debate summary for a topic.
 * Lets any authenticated user trigger or refresh the summary.
 *
 * States:
 *   loading   – fetching cached brief from server
 *   empty     – no brief exists yet, show "Generate" CTA
 *   generated – display the brief with "Regenerate" option
 *   unavailable – ANTHROPIC_API_KEY not configured on this deployment
 *   insufficient_data – too few arguments to summarize
 */

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { AIBriefResponse } from '@/app/api/topics/[id]/ai-brief/route'

interface TopicAIBriefProps {
  topicId: string
  className?: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TopicAIBrief({ topicId, className }: TopicAIBriefProps) {
  const [brief, setBrief] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [insufficientData, setInsufficientData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Check auth state
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
    })
  }, [])

  // Fetch cached brief on mount
  useEffect(() => {
    setLoading(true)
    fetch(`/api/topics/${topicId}/ai-brief`)
      .then((r) => r.json())
      .then((data: AIBriefResponse) => {
        if (data.unavailable) {
          setUnavailable(true)
        } else {
          setBrief(data.brief)
          setGeneratedAt(data.generated_at)
        }
      })
      .catch(() => {
        // Silent — best-effort
      })
      .finally(() => setLoading(false))
  }, [topicId])

  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch(`/api/topics/${topicId}/ai-brief`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.error === 'insufficient_data') {
          setInsufficientData(true)
        } else {
          setError(data.error ?? 'Generation failed')
        }
        return
      }

      setBrief(data.brief)
      setGeneratedAt(data.generated_at)
      setExpanded(true)
    } catch {
      setError('Failed to connect to AI service')
    } finally {
      setGenerating(false)
    }
  }, [topicId])

  // Don't render if AI is not configured
  if (unavailable) return null

  // Don't render during initial load if there's nothing to show
  if (loading) return null

  return (
    <div
      className={cn(
        'rounded-xl border border-purple/20 bg-purple/5 overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => brief && setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2.5 px-4 py-3 text-left',
          brief && 'hover:bg-purple/5 transition-colors',
          !brief && 'cursor-default'
        )}
      >
        <div className="flex-shrink-0 h-5 w-5 rounded flex items-center justify-center bg-purple/15">
          <Bot className="h-3 w-3 text-purple" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-purple uppercase tracking-widest">
            AI Debate Brief
          </p>
          {generatedAt && (
            <p className="text-[10px] font-mono text-surface-500 mt-0.5">
              Generated {relativeTime(generatedAt)} · Claude
            </p>
          )}
        </div>
        {brief && (
          expanded
            ? <ChevronUp className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden />
            : <ChevronDown className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden />
        )}
      </button>

      <AnimatePresence initial={false}>
        {/* No brief yet — CTA */}
        {!brief && !generating && !insufficientData && (
          <motion.div
            key="cta"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4">
              <p className="text-xs text-surface-400 mb-3 leading-relaxed">
                Get a neutral, AI-generated summary of the strongest FOR and AGAINST
                arguments — great for making an informed vote.
              </p>

              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={generate}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple/15 hover:bg-purple/25 text-purple text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <WandSparkles className="h-3.5 w-3.5" aria-hidden />
                  Generate Brief
                </button>
              ) : (
                <p className="text-xs text-surface-500">
                  Sign in to generate an AI brief for this topic.
                </p>
              )}

              {error && (
                <p className="text-xs text-against-400 mt-2">{error}</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Generating spinner */}
        {generating && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-4 flex items-center gap-2"
          >
            <Loader2 className="h-3.5 w-3.5 text-purple animate-spin" aria-hidden />
            <span className="text-xs text-purple">Analyzing arguments with Claude…</span>
          </motion.div>
        )}

        {/* Insufficient data */}
        {insufficientData && !generating && (
          <motion.div
            key="insufficient"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="px-4 pb-4">
              <p className="text-xs text-surface-500">
                Not enough arguments yet. Come back after more voices have joined the debate.
              </p>
            </div>
          </motion.div>
        )}

        {/* Generated brief */}
        {brief && expanded && (
          <motion.div
            key="brief"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <div className="px-4 pb-4 border-t border-purple/10">
              <div className="pt-3 space-y-2.5">
                {brief
                  .split('\n')
                  .map((para) => para.trim())
                  .filter(Boolean)
                  .map((para, i) => (
                    <p
                      key={i}
                      className="text-sm text-surface-300 leading-relaxed"
                    >
                      {para}
                    </p>
                  ))}
              </div>

              {/* Footer actions */}
              <div className="flex items-center gap-3 mt-3 pt-2 border-t border-purple/10">
                <div className="flex items-center gap-1 text-[10px] text-surface-600 font-mono">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  Neutral summary · Not a vote recommendation
                </div>

                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={generate}
                    disabled={generating}
                    className="ml-auto flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-purple transition-colors disabled:opacity-50"
                    title="Regenerate brief"
                  >
                    <RefreshCw className="h-2.5 w-2.5" aria-hidden />
                    Refresh
                  </button>
                )}
              </div>

              {error && (
                <p className="text-xs text-against-400 mt-1">{error}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
