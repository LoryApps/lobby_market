import { User, Mic, Shield, Crown } from 'lucide-react'
import type { UserRole } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface RoleBadgeProps {
  role: UserRole
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const roleConfig: Record<
  UserRole,
  {
    label: string
    icon: typeof User
    classes: string
    ringClass: string
  }
> = {
  person: {
    label: 'Person',
    icon: User,
    classes: 'bg-surface-300/50 text-surface-600 border-surface-400/30',
    ringClass: 'ring-surface-500/50',
  },
  debator: {
    label: 'Debator',
    icon: Mic,
    classes: 'bg-for-500/15 text-for-400 border-for-500/30',
    ringClass: 'ring-for-500',
  },
  troll_catcher: {
    label: 'Troll Catcher',
    icon: Shield,
    classes: 'bg-emerald/15 text-emerald border-emerald/30',
    ringClass: 'ring-emerald',
  },
  elder: {
    label: 'Elder',
    icon: Crown,
    classes: 'bg-gold/15 text-gold border-gold/30',
    ringClass: 'ring-gold',
  },
}

const sizeClasses = {
  sm: 'h-5 px-1.5 text-[10px] gap-1',
  md: 'h-6 px-2 text-xs gap-1.5',
  lg: 'h-8 px-3 text-sm gap-2',
} as const

const iconSize = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
} as const

export function RoleBadge({ role, size = 'md', className }: RoleBadgeProps) {
  const config = roleConfig[role]
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium uppercase tracking-wider',
        config.classes,
        sizeClasses[size],
        className
      )}
    >
      <Icon className={iconSize[size]} />
      {config.label}
    </span>
  )
}

export function getRoleRingClass(role: UserRole) {
  return roleConfig[role].ringClass
}
