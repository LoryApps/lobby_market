import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface ShimmerProps {
  className?: string
  children?: ReactNode
}

export function Shimmer({ className, children }: ShimmerProps) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      {children}
      <div
        className="pointer-events-none absolute inset-0 animate-shimmer"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
        }}
        aria-hidden="true"
      />
    </div>
  )
}
