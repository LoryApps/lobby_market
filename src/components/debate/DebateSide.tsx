'use client'

import { Hand, Mic } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type {
  DebateParticipantWithProfile,
  VoteSide,
} from '@/lib/supabase/types'

interface DebateSideProps {
  side: VoteSide
  speaker: DebateParticipantWithProfile | null
  isActive: boolean
  argument?: string | null
  onApplause: () => void
}

const LABELS: Record<VoteSide, { label: string; role: string }> = {
  blue: { label: 'FOR', role: 'Affirmative' },
  red: { label: 'AGAINST', role: 'Negative' },
}

export function DebateSide({
  side,
  speaker,
  isActive,
  argument,
  onApplause,
}: DebateSideProps) {
  const isBlue = side === 'blue'
  const tint = isBlue ? 'for' : 'against'
  const label = LABELS[side]

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-start h-full pt-10 px-4 pb-16 z-10',
        isBlue ? 'text-for-100' : 'text-against-100'
      )}
    >
      {/* Side label */}
      <div
        className={cn(
          'mb-3 px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest',
          `bg-${tint}-500/20 border border-${tint}-500/40 text-${tint}-300`
        )}
      >
        {label.label}
      </div>

      {/* Speaker video placeholder */}
      <div
        className={cn(
          'relative w-44 h-44 sm:w-56 sm:h-56 rounded-2xl overflow-hidden flex items-center justify-center',
          'bg-gradient-to-br backdrop-blur-sm border',
          isBlue
            ? 'from-for-900/80 to-for-950/90 border-for-500/30'
            : 'from-against-900/80 to-against-950/90 border-against-500/30',
          isActive && (isBlue ? 'glow-blue ring-4 ring-gold/50' : 'glow-red ring-4 ring-gold/50')
        )}
      >
        {speaker?.profile ? (
          <div className="flex flex-col items-center">
            <Avatar
              src={speaker.profile.avatar_url}
              fallback={
                speaker.profile.display_name ?? speaker.profile.username
              }
              size="lg"
              className={cn(
                'h-24 w-24 text-2xl ring-2',
                isBlue ? 'ring-for-400' : 'ring-against-400'
              )}
            />
            <div className="mt-3 text-white font-semibold text-base">
              @{speaker.profile.username}
            </div>
            <div
              className={cn(
                'text-[10px] font-mono uppercase tracking-wider mt-0.5',
                isBlue ? 'text-for-300' : 'text-against-300'
              )}
            >
              {label.role}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-surface-500">
            <div
              className={cn(
                'h-20 w-20 rounded-full border-2 border-dashed flex items-center justify-center mb-2',
                isBlue ? 'border-for-500/40' : 'border-against-500/40'
              )}
            >
              <Mic className="h-8 w-8" />
            </div>
            <div className="text-xs font-mono">Seat Open</div>
          </div>
        )}

        {/* Active speaker gold ring pulse */}
        {isActive && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 rounded-2xl border-2 border-gold/60 animate-pulse-urgent" />
          </div>
        )}
      </div>

      {/* Argument card */}
      {argument && (
        <div
          className={cn(
            'mt-6 w-full max-w-sm rounded-xl p-4 backdrop-blur-md',
            'border bg-black/40',
            isBlue ? 'border-for-500/30' : 'border-against-500/30'
          )}
        >
          <p className="text-sm leading-relaxed text-white/90">{argument}</p>
        </div>
      )}

      {/* Applause button */}
      <button
        type="button"
        onClick={onApplause}
        className={cn(
          'mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-mono font-semibold',
          'backdrop-blur-md border transition-colors',
          isBlue
            ? 'bg-for-500/20 border-for-500/40 text-for-300 hover:bg-for-500/30'
            : 'bg-against-500/20 border-against-500/40 text-against-300 hover:bg-against-500/30'
        )}
      >
        <Hand className="h-4 w-4" />
        Applause
      </button>
    </div>
  )
}
