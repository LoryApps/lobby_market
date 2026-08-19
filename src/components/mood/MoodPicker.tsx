'use client'

/**
 * MoodPicker — Inline widget to submit/update a user's mood reaction for a topic.
 * Displayed on topic pages as a compact horizontal picker.
 */

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import type { MoodKind, TopicMoodData } from '@/app/api/topics/[id]/mood/route'

const MOODS: { kind: MoodKind; emoji: string; label: string }[] = [
  { kind: 'hopeful',     emoji: '🌱', label: 'Hopeful'     },
  { kind: 'inspired',    emoji: '✨', label: 'Inspired'    },
  { kind: 'proud',       emoji: '🏆', label: 'Proud'       },
  { kind: 'determined',  emoji: '💪', label: 'Determined'  },
  { kind: 'frustrated',  emoji: '😤', label: 'Frustrated'  },
  { kind: 'worried',     emoji: '😟', label: 'Worried'     },
  { kind: 'angry',       emoji: '😡', label: 'Angry'       },
  { kind: 'relieved',    emoji: '😌', label: 'Relieved'    },
]

interface MoodPickerProps {
  topicId: string
  className?: string
}

export function MoodPicker({ topicId, className }: MoodPickerProps) {
  const [data, setData] = useState<TopicMoodData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<MoodKind | null>(null)

  const fetchMood = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics/${topicId}/mood`, { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    fetchMood()
  }, [fetchMood])

  const handleSelect = useCallback(
    async (mood: MoodKind) => {
      if (submitting) return
      const isSame = data?.user_mood === mood

      setSubmitting(mood)
      try {
        if (isSame) {
          await fetch(`/api/topics/${topicId}/mood`, { method: 'DELETE' })
        } else {
          await fetch(`/api/topics/${topicId}/mood`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mood }),
          })
        }
        await fetchMood()
      } finally {
        setSubmitting(null)
      }
    },
    [topicId, data?.user_mood, submitting, fetchMood]
  )

  if (loading) {
    return (
      <div className={cn('flex items-center gap-1.5', className)}>
        {MOODS.map((m) => (
          <div key={m.kind} className="h-7 w-8 rounded-lg bg-surface-200 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-[11px] text-surface-500 font-mono">
        How does this topic make you feel?
        {data && data.total > 0 && (
          <span className="ml-1.5 text-surface-600">
            ({data.total} response{data.total !== 1 ? 's' : ''})
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {MOODS.map((m) => {
          const isSelected = data?.user_mood === m.kind
          const count = data?.moods.find((x) => x.mood === m.kind)?.count ?? 0
          return (
            <motion.button
              key={m.kind}
              onClick={() => handleSelect(m.kind)}
              disabled={!!submitting}
              whileTap={{ scale: 0.92 }}
              title={m.label}
              aria-label={`${m.label}${isSelected ? ' (selected)' : ''}`}
              className={cn(
                'relative flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-mono transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40',
                isSelected
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white',
                submitting === m.kind && 'opacity-60',
              )}
            >
              <span className="text-base leading-none">{m.emoji}</span>
              {count > 0 && (
                <AnimatePresence>
                  <motion.span
                    key={count}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-[10px] tabular-nums"
                  >
                    {count}
                  </motion.span>
                </AnimatePresence>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
