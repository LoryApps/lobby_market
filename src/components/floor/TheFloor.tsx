'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { Topic } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { Chamber, type SeatCluster } from '@/components/floor/Chamber'
import { Rostrum } from '@/components/floor/Rostrum'
import { TopicCarousel } from '@/components/floor/TopicCarousel'
import { SpectatorCount } from '@/components/floor/SpectatorCount'
import { FloorControls } from '@/components/floor/FloorControls'
import { FloorGraph } from '@/components/floor/FloorGraph'
import { cn } from '@/lib/utils/cn'

interface TheFloorProps {
  topics: Topic[]
}

export function TheFloor({ topics: initialTopics }: TheFloorProps) {
  const [topics, setTopics] = useState<Topic[]>(initialTopics)
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    initialTopics[0]?.id ?? ''
  )
  const [viewMode, setViewMode] = useState<'chamber' | 'graph'>('chamber')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [hoveredCluster, setHoveredCluster] = useState<SeatCluster | null>(null)
  const [pulseTicket, setPulseTicket] = useState(0)
  const pulseRef = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) ?? topics[0],
    [topics, selectedTopicId]
  )

  // Realtime subscription to the selected topic — trigger a pulse
  // whenever its vote counts change.
  useEffect(() => {
    if (!selectedTopic) return
    const supabase = createClient()
    const channel = supabase
      .channel(`floor-topic:${selectedTopic.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'topics',
          filter: `id=eq.${selectedTopic.id}`,
        },
        (payload) => {
          const next = payload.new as Topic
          setTopics((prev) =>
            prev.map((t) =>
              t.id === next.id
                ? {
                    ...t,
                    total_votes: next.total_votes,
                    blue_votes: next.blue_votes,
                    red_votes: next.red_votes,
                    blue_pct: next.blue_pct,
                  }
                : t
            )
          )
          pulseRef.current += 1
          setPulseTicket(pulseRef.current)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [selectedTopic?.id])

  // Fullscreen handling
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        /* user cancelled */
      })
    } else {
      document.exitFullscreen().catch(() => {
        /* ignore */
      })
    }
  }, [])

  useEffect(() => {
    const handle = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handle)
    return () => document.removeEventListener('fullscreenchange', handle)
  }, [])

  // Keyboard nav — arrow keys cycle topics, Esc returns home
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (topics.length === 0) return
      const idx = topics.findIndex((t) => t.id === selectedTopicId)
      if (e.key === 'ArrowLeft') {
        setSelectedTopicId(topics[(idx - 1 + topics.length) % topics.length].id)
      } else if (e.key === 'ArrowRight') {
        setSelectedTopicId(topics[(idx + 1) % topics.length].id)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [topics, selectedTopicId])

  if (!selectedTopic) {
    return (
      <div className="h-screen w-screen bg-surface-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-bold text-white mb-2">
            The Floor is empty.
          </p>
          <p className="text-surface-500 text-sm">
            No topics are currently on the floor. Check back shortly.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 px-5 py-2 rounded-lg bg-surface-200 text-white hover:bg-surface-300 transition-colors"
          >
            Return to feed
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className="relative h-screen w-screen overflow-hidden bg-surface-0 text-white"
    >
      {/* Chamber canvas (fills the viewport) */}
      <div className="absolute inset-0">
        {viewMode === 'chamber' ? (
          <Chamber
            topic={selectedTopic}
            onSeatHover={setHoveredCluster}
            onVotePulse={pulseTicket}
          />
        ) : (
          <FloorGraph
            topics={topics}
            selectedId={selectedTopicId}
            onSelect={setSelectedTopicId}
          />
        )}
      </div>

      {/* Rostrum overlay — the floating topic statement */}
      {viewMode === 'chamber' && <Rostrum topic={selectedTopic} />}

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex items-start justify-between gap-4 pointer-events-none">
        {/* Logo */}
        <Link
          href="/"
          className="pointer-events-auto flex flex-col items-start"
        >
          <span className="text-white font-bold text-lg tracking-[0.2em]">
            LOBBY
          </span>
          <div className="flex h-0.5 w-10 mt-1">
            <div className="flex-1 bg-for-500 rounded-l-full" />
            <div className="flex-1 bg-against-500 rounded-r-full" />
          </div>
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.3em] text-surface-500">
            The Floor
          </span>
        </Link>

        {/* Topic carousel center */}
        <div className="pointer-events-auto hidden md:flex flex-1 justify-center">
          <TopicCarousel
            topics={topics}
            selectedId={selectedTopicId}
            onSelect={setSelectedTopicId}
          />
        </div>

        {/* Controls */}
        <div className="pointer-events-auto">
          <FloorControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 flex items-end justify-between gap-4 pointer-events-none">
        <SpectatorCount className="pointer-events-auto" />

        {/* Hovered cluster tooltip */}
        {hoveredCluster && (
          <div
            className={cn(
              'pointer-events-none px-3 py-2 rounded-lg',
              'bg-surface-100/80 backdrop-blur border border-surface-300/60',
              'text-xs font-mono text-white'
            )}
          >
            <div className="text-surface-500 uppercase tracking-wider text-[9px] mb-0.5">
              Cluster · Row {hoveredCluster.row + 1}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  hoveredCluster.affinity >= 0.5
                    ? 'text-for-400'
                    : 'text-against-400'
                )}
              >
                {hoveredCluster.affinity >= 0.5 ? 'Blue' : 'Red'}-leaning
              </span>
              <span className="text-surface-400">
                · ~{hoveredCluster.clusterSize.toLocaleString()} users
              </span>
            </div>
          </div>
        )}

        {/* Topic metadata strip */}
        <div
          className={cn(
            'pointer-events-auto hidden md:flex items-center gap-3 px-4 py-2 rounded-full',
            'bg-surface-100/60 backdrop-blur border border-surface-300/50',
            'text-xs font-mono text-surface-500'
          )}
        >
          {selectedTopic.category && (
            <>
              <span>{selectedTopic.category}</span>
              <span className="h-3 w-px bg-surface-400/50" />
            </>
          )}
          <span className="text-white">
            {selectedTopic.total_votes.toLocaleString()} votes
          </span>
          <span className="h-3 w-px bg-surface-400/50" />
          <span className={cn('text-for-400')}>
            {Math.round(selectedTopic.blue_pct)}% blue
          </span>
        </div>
      </div>

      {/* Mobile topic strip (bottom-sticky above the spectator count) */}
      <div className="md:hidden absolute bottom-16 left-0 right-0 px-4 pointer-events-auto">
        <TopicCarousel
          topics={topics}
          selectedId={selectedTopicId}
          onSelect={setSelectedTopicId}
        />
      </div>
    </div>
  )
}
