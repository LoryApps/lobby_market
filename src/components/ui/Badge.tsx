import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

const badgeVariants = {
  // Role badges
  person: 'bg-surface-400/20 text-surface-400',
  debator: 'bg-for-500/20 text-for-500',
  troll_catcher: 'bg-emerald/20 text-emerald',
  elder: 'bg-gold/20 text-gold',
  // Status badges
  proposed: 'bg-surface-400/20 text-surface-400',
  active: 'bg-for-500/20 text-for-500',
  law: 'bg-emerald/20 text-emerald',
  failed: 'bg-against-500/20 text-against-500',
  // Utility variants
  gold: 'bg-gold/20 text-gold',
  outline: '',
  // Extended variants — rely on className for custom styling
  default: 'bg-surface-300/40 text-surface-400 border border-surface-400/30',
  secondary: 'bg-surface-200/60 text-surface-500',
  ghost: 'bg-transparent text-surface-500',
  subtle: 'bg-surface-300/30 text-surface-600',
  neutral: 'bg-surface-300/40 text-surface-500',
  surface: 'bg-surface-200 text-surface-400',
  category: 'bg-surface-300/40 text-surface-400',
  status: 'bg-surface-300/40 text-surface-500 border border-surface-400/30',
  against: 'bg-against-500/20 text-against-400',
  success: 'bg-emerald/20 text-emerald',
} as const

type BadgeVariant = keyof typeof badgeVariants

const sizePaddingClasses = {
  xs: 'text-[10px] px-1.5 py-0',
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
} as const

type BadgeSize = keyof typeof sizePaddingClasses

interface BadgeProps {
  variant: BadgeVariant
  children: ReactNode
  size?: BadgeSize
  className?: string
}

export function Badge({ variant, children, size = 'md', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        sizePaddingClasses[size],
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
