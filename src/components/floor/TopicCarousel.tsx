'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Topic } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface TopicCarouselProps {
  topics: Topic[]
  selectedId: string
  onSelect: (id: string) => void
  className?: string
}

export function TopicCarousel({
  topics,
  selectedId,
  onSelect,
  className,
}: TopicCarouselProps) {
  const selectedIndex = Math.max(
    0,
    topics.findIndex((t) => t.id === selectedId)
  )

  const goPrev = () => {
    const next = (selectedIndex - 1 + topics.length) % topics.length
    onSelect(topics[next].id)
  }
  const goNext = () => {
    const next = (selectedIndex + 1) % topics.length
    onSelect(topics[next].id)
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <button
        onClick={goPrev}
        className="flex items-center justify-center h-9 w-9 rounded-full bg-surface-200/50 backdrop-blur border border-surface-300/60 text-surface-500 hover:text-white hover:bg-surface-300/70 transition-colors"
        aria-label="Previous topic"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2 overflow-hidden">
        {topics.map((topic, i) => {
          const offset = i - selectedIndex
          if (Math.abs(offset) > 2) return null
          const isFocused = offset === 0
          return (
            <button
              key={topic.id}
              onClick={() => onSelect(topic.id)}
              className={cn(
                'group relative flex-shrink-0 rounded-xl border transition-all duration-300',
                'backdrop-blur-md px-4 py-2 text-left max-w-[280px]',
                isFocused
                  ? 'bg-surface-100/80 border-for-500/40 scale-100 opacity-100 shadow-[0_0_24px_-6px_rgba(59,130,246,0.3)]'
                  : 'bg-surface-100/30 border-surface-300/40 scale-90 opacity-40 hover:opacity-70'
              )}
            >
              <div className="flex items-center gap-2">
                {/* Live dot */}
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span
                    className={cn(
                      'absolute inline-flex h-full w-full rounded-full opacity-75',
                      isFocused && 'animate-ping bg-for-500'
                    )}
                  />
                  <span
                    className={cn(
                      'relative inline-flex rounded-full h-2 w-2',
                      isFocused ? 'bg-for-500' : 'bg-surface-400'
                    )}
                  />
                </span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-surface-500">
                  {topic.category ?? 'topic'}
                </span>
              </div>
              <div className="mt-1 text-xs text-white font-medium line-clamp-2 leading-snug">
                {topic.statement}
              </div>
              {/* Mini vote bar */}
              <div className="mt-2 h-1 w-full rounded-full overflow-hidden bg-surface-300/60 flex">
                <div
                  className="h-full bg-for-500"
                  style={{ width: `${topic.blue_pct}%` }}
                />
                <div
                  className="h-full bg-against-500"
                  style={{ width: `${100 - topic.blue_pct}%` }}
                />
              </div>
            </button>
          )
        })}
      </div>

      <button
        onClick={goNext}
        className="flex items-center justify-center h-9 w-9 rounded-full bg-surface-200/50 backdrop-blur border border-surface-300/60 text-surface-500 hover:text-white hover:bg-surface-300/70 transition-colors"
        aria-label="Next topic"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}
