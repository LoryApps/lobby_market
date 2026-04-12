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
} as const

type BadgeVariant = keyof typeof badgeVariants

interface BadgeProps {
  variant: BadgeVariant
  children: ReactNode
  className?: string
}

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full text-xs font-medium px-2 py-0.5',
        badgeVariants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
