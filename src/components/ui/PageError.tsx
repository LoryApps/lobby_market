'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

interface PageErrorProps {
  // Standard Next.js error boundary props
  error?: Error & { digest?: string }
  reset?: () => void
  // Alias props used across legacy error.tsx files
  onReset?: () => void
  onRetry?: () => void
  /** Human-readable page title / heading */
  page?: string
  title?: string
  /** Subtitle / detail message */
  message?: string
  description?: string
  /** Where to navigate on "Back" — defaults to "/" */
  backHref?: string
  backLabel?: string
}

export function PageError({
  error,
  reset,
  onReset,
  onRetry,
  page,
  title,
  message,
  description,
  backHref = '/',
  backLabel = 'Back to feed',
}: PageErrorProps) {
  useEffect(() => {
    if (error) console.error(`[${page ?? title ?? 'page'}]`, error)
  }, [error, page, title])

  const resetFn = reset ?? onReset ?? onRetry ?? (() => window.location.reload())

  const derivedTitle = title ?? (page ? `${page} couldn't load` : 'Something went wrong')
  const derivedSubtitle =
    description ??
    message ??
    (page
      ? `The ${page} page ran into a problem. Your data is safe — try again or return to the feed.`
      : 'This page ran into a problem. Your data is safe.')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 py-24 text-center">
        <div
          className={cn(
            'flex items-center justify-center h-12 w-12 rounded-2xl mx-auto mb-5',
            'bg-against-500/10 border border-against-500/20',
          )}
        >
          <AlertTriangle className="h-5 w-5 text-against-400" aria-hidden="true" />
        </div>

        <h1 className="font-mono text-xl font-bold text-white mb-2">
          {derivedTitle}
        </h1>
        <p className="text-sm text-surface-500 font-mono mb-6 max-w-sm mx-auto leading-relaxed">
          {derivedSubtitle}
        </p>

        {error?.digest && (
          <p className="text-[11px] text-surface-600 font-mono mb-6">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={resetFn}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold',
              'bg-for-600/20 border border-for-600/30 text-for-400',
              'hover:bg-for-600/40 transition-colors',
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Try again
          </button>
          <Link
            href={backHref}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold',
              'bg-surface-200 border border-surface-300 text-surface-400',
              'hover:bg-surface-300 hover:text-white transition-colors',
            )}
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            {backLabel}
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
