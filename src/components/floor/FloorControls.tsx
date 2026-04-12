'use client'

import Link from 'next/link'
import { X, Maximize2, Minimize2, Landmark, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface FloorControlsProps {
  viewMode: 'chamber' | 'graph'
  onViewModeChange: (mode: 'chamber' | 'graph') => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  className?: string
}

export function FloorControls({
  viewMode,
  onViewModeChange,
  isFullscreen,
  onToggleFullscreen,
  className,
}: FloorControlsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-1 rounded-xl',
        'bg-surface-100/60 backdrop-blur-md border border-surface-300/50',
        className
      )}
    >
      {/* View toggle */}
      <div className="flex rounded-lg bg-surface-200/60 p-0.5">
        <button
          onClick={() => onViewModeChange('chamber')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            viewMode === 'chamber'
              ? 'bg-for-500/20 text-white shadow-[0_0_12px_-3px_rgba(59,130,246,0.4)]'
              : 'text-surface-500 hover:text-white'
          )}
        >
          <Landmark className="h-3.5 w-3.5" />
          Chamber
        </button>
        <button
          onClick={() => onViewModeChange('graph')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            viewMode === 'graph'
              ? 'bg-for-500/20 text-white shadow-[0_0_12px_-3px_rgba(59,130,246,0.4)]'
              : 'text-surface-500 hover:text-white'
          )}
        >
          <Share2 className="h-3.5 w-3.5" />
          Graph
        </button>
      </div>

      {/* Fullscreen */}
      <button
        onClick={onToggleFullscreen}
        className="flex items-center justify-center h-8 w-8 rounded-md text-surface-500 hover:text-white hover:bg-surface-200/60 transition-colors"
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </button>

      {/* Exit */}
      <Link
        href="/"
        className="flex items-center justify-center h-8 w-8 rounded-md text-surface-500 hover:text-white hover:bg-against-500/20 transition-colors"
        aria-label="Exit chamber"
      >
        <X className="h-4 w-4" />
      </Link>
    </div>
  )
}
