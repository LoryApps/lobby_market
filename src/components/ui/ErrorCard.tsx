'use client'

import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

interface ErrorCardProps {
  title?: string
  message?: string
  digest?: string
  onReset?: () => void
  className?: string
  compact?: boolean
}

/**
 * Reusable error card used inside route error.tsx boundaries.
 */
export function ErrorCard({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  digest,
  onReset,
  className,
  compact = false,
}: ErrorCardProps) {
  const router = useRouter()

  return (
    <div
      className={cn(
        'flex flex-col items-center text-center gap-5',
        compact ? 'py-12 px-4' : 'py-20 px-4',
        className
      )}
    >
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-against-500/10 border border-against-500/30">
        <AlertTriangle className="h-7 w-7 text-against-400" />
      </div>

      <div className="space-y-1.5">
        <p className="font-mono font-semibold text-white text-lg">{title}</p>
        <p className="text-sm text-surface-500 font-mono max-w-sm leading-relaxed">{message}</p>
        {digest && (
          <p className="text-[11px] text-surface-600 font-mono">Error ID: {digest}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5">
        {onReset && (
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </button>
        )}
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-white text-sm font-mono font-medium hover:bg-surface-300 transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          Go Home
        </button>
      </div>
    </div>
  )
}
