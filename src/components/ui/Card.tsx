import { type ReactNode, type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils/cn'

type GlowColor = 'blue' | 'red' | 'gold'

const glowMap: Record<GlowColor, string> = {
  blue: 'glow-blue',
  red: 'glow-red',
  gold: 'glow-gold',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: GlowColor
  shimmer?: boolean
  children: ReactNode
}

export function Card({
  className,
  glow,
  shimmer = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface-100 border border-surface-300 rounded-2xl p-6',
        glow && glowMap[glow],
        shimmer && 'relative overflow-hidden',
        className
      )}
      {...props}
    >
      {children}
      {shimmer && (
        <div
          className="pointer-events-none absolute inset-0 animate-shimmer"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
          }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}
