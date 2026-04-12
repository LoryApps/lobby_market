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
  children: ReactNode
}

export function Card({ className, glow, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface-100 border border-surface-300 rounded-2xl p-6',
        glow && glowMap[glow],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
