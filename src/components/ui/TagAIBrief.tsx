'use client'

/**
 * TagAIBrief
 *
 * Shows a Claude-generated civic brief for a topic tag — synthesising the
 * overall consensus lean, core tension, and a meta-insight across all debates
 * carrying that tag.
 *
 * States:
 *   loading          – fetching cached brief
 *   empty            – no brief yet; show "Generate" CTA
 *   generated        – display 4-section brief with "Regenerate" option
 *   unavailable      – ANTHROPIC_API_KEY not configured
 *   insufficient_data– fewer than 2 topics with this tag
 */

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Lightbulb,
  Loader2,
  RefreshCw,
  Scale,
  Swords,
  WandSparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TagBriefResponse } from '@/app/api/tags/[tag]/brief/route'

interface TagAIBriefProps {
  tag: string
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

// ─── Section row ──────────────────────────────────────────────────────────────

function BriefSection({
  icon: Icon,
  label,
  text,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  text: string
  accent: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', accent)} />
        <span className={cn('text-[10px] font-mono font-bold uppercase tracking-widest', accent)}>
          {label}
        </span>
      </div>
      <p className="text-sm text-surface-600 leading-relaxed pl-5">{text}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TagAIBrief({ tag, className }: TagAIBriefProps) {
  const [data, setData] = useState<TagBriefResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBrief = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tags/${encodeURIComponent(tag)}/brief`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load brief')
      const json = (await res.json()) as TagBriefResponse
      setData(json)
      if (json.overview) setExpanded(true)
    } catch {
      setError('Failed to load civic brief.')
    } finally {
      setLoading(false)
    }
  }, [tag])

  useEffect(() => {
    fetchBrief()
  }, [fetchBrief])

  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/tags/${encodeURIComponent(tag)}/brief`, {
        method: 'POST',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Generation failed')
      const json = (await res.json()) as TagBriefResponse
      setData(json)
      setExpanded(true)
    } catch {
      setError('AI generation failed. Try again later.')
    } finally {
      setGenerating(false)
    }
  }, [tag])

  if (loading) {
    return (
      <div className={cn('rounded-2xl bg-surface-100 border border-surface-300 p-4', className)}>
        <div className="flex items-center gap-2 animate-pulse">
          <div className="h-4 w-4 rounded bg-surface-300" />
          <div className="h-3 w-40 rounded bg-surface-300" />
        </div>
      </div>
    )
  }

  if (data?.unavailable) {
    return null
  }

  const hasContent = !!(data?.overview)

  return (
    <div
      className={cn(
        'rounded-2xl bg-surface-100 border border-purple/30 overflow-hidden',
        className
      )}
    >
      {/* Header — two variants to avoid nested interactive elements */}
      {hasContent ? (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-200/60"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse Civic Brief' : 'Expand Civic Brief'}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-purple/15 flex-shrink-0">
              <WandSparkles className="h-3.5 w-3.5 text-purple" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-mono font-bold text-purple tracking-wide">Civic Brief</span>
              {data?.generated_at && (
                <span className="ml-2 text-[10px] text-surface-500 font-mono">
                  · {relativeTime(data.generated_at)}
                </span>
              )}
            </div>
          </div>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-surface-500 flex-shrink-0" aria-hidden="true" />
            : <ChevronDown className="h-4 w-4 text-surface-500 flex-shrink-0" aria-hidden="true" />}
        </button>
      ) : (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-purple/15 flex-shrink-0">
              <WandSparkles className="h-3.5 w-3.5 text-purple" aria-hidden="true" />
            </div>
            <span className="text-xs font-mono font-bold text-purple tracking-wide">Civic Brief</span>
          </div>
          {!data?.insufficient_data && (
            <button
              onClick={generate}
              disabled={generating}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                'bg-purple/20 text-purple border border-purple/30',
                'hover:bg-purple/30 transition-colors disabled:opacity-60'
              )}
            >
              {generating
                ? <><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />Generating…</>
                : <><WandSparkles className="h-3 w-3" aria-hidden="true" />Generate</>}
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <AnimatePresence initial={false}>
        {expanded && hasContent && (
          <motion.div
            key="brief-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-surface-300">
              <div className="pt-3 space-y-4">
                <BriefSection
                  icon={Compass}
                  label="Overview"
                  text={data!.overview!}
                  accent="text-purple"
                />
                <BriefSection
                  icon={Scale}
                  label="Consensus Lean"
                  text={data!.lean!}
                  accent="text-for-400"
                />
                <BriefSection
                  icon={Swords}
                  label="Core Tension"
                  text={data!.tension!}
                  accent="text-against-400"
                />
                <BriefSection
                  icon={Lightbulb}
                  label="Key Insight"
                  text={data!.insight!}
                  accent="text-gold"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-surface-500 font-mono">
                  Analysis across {data!.topic_count} debate{data!.topic_count !== 1 ? 's' : ''}
                  {data!.avg_for_pct != null ? ` · avg ${data!.avg_for_pct}% FOR` : ''}
                </p>
                <button
                  onClick={generate}
                  disabled={generating}
                  title="Regenerate brief"
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono',
                    'text-surface-500 hover:text-surface-600 hover:bg-surface-200',
                    'transition-colors disabled:opacity-50'
                  )}
                >
                  {generating
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <RefreshCw className="h-3 w-3" />}
                  {generating ? 'Regenerating…' : 'Regenerate'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Insufficient data state */}
      {data?.insufficient_data && (
        <div className="px-4 pb-4 border-t border-surface-300">
          <p className="pt-3 text-xs text-surface-500 font-mono italic">
            Not enough debates tagged #{tag} yet to generate a brief. Add more topics with this tag to unlock civic analysis.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 pb-4 border-t border-surface-300">
          <p className="pt-3 text-xs text-against-400 font-mono">{error}</p>
        </div>
      )}
    </div>
  )
}
