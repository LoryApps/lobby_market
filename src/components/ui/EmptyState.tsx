'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary'
  icon?: React.ComponentType<{ className?: string }>
}

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  iconColor?: string
  iconBg?: string
  iconBorder?: string
  title: string
  description?: string
  actions?: EmptyStateAction[]
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
  className?: string
}

const SIZE_MAP = {
  sm: {
    padding: 'py-12',
    iconBox: 'h-12 w-12 rounded-xl',
    iconSize: 'h-5 w-5',
    title: 'text-base',
    desc: 'text-xs',
    gap: 'gap-3',
  },
  md: {
    padding: 'py-20',
    iconBox: 'h-14 w-14 rounded-2xl',
    iconSize: 'h-6 w-6',
    title: 'text-lg',
    desc: 'text-sm',
    gap: 'gap-4',
  },
  lg: {
    padding: 'py-28',
    iconBox: 'h-16 w-16 rounded-2xl',
    iconSize: 'h-7 w-7',
    title: 'text-xl',
    desc: 'text-sm',
    gap: 'gap-5',
  },
}

export function EmptyState({
  icon: Icon,
  iconColor = 'text-surface-500',
  iconBg = 'bg-surface-200',
  iconBorder = 'border-surface-300',
  title,
  description,
  actions,
  size = 'md',
  animate = true,
  className,
}: EmptyStateProps) {
  const s = SIZE_MAP[size]

  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-4',
        s.padding,
        s.gap,
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex items-center justify-center border flex-shrink-0',
          s.iconBox,
          iconBg,
          iconBorder
        )}
      >
        <Icon className={cn(s.iconSize, iconColor)} />
      </div>

      {/* Text */}
      <div className="space-y-1.5 max-w-xs">
        <p className={cn('font-mono font-bold text-white', s.title)}>{title}</p>
        {description && (
          <p className={cn('font-mono leading-relaxed text-surface-500', s.desc)}>
            {description}
          </p>
        )}
      </div>

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-1">
          {actions.map((action, i) => {
            const isPrimary = (action.variant ?? (i === 0 ? 'primary' : 'secondary')) === 'primary'
            const baseClass = cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono font-medium transition-colors',
              isPrimary
                ? 'bg-for-600 hover:bg-for-500 text-white'
                : 'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
            )

            if (action.href) {
              return (
                <Link key={i} href={action.href} className={baseClass}>
                  {action.icon && <action.icon className="h-3.5 w-3.5" />}
                  {action.label}
                </Link>
              )
            }
            return (
              <button key={i} onClick={action.onClick} className={baseClass}>
                {action.icon && <action.icon className="h-3.5 w-3.5" />}
                {action.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  if (!animate) return content

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {content}
    </motion.div>
  )
}
