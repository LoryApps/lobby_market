'use client'

import { Button } from '@/components/ui/Button'

export default function ChangemakersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
      <p className="text-2xl">⚠️</p>
      <h2 className="text-lg font-semibold text-surface-50">Something went wrong</h2>
      <p className="text-sm text-surface-400 max-w-xs">
        {error.message || 'Failed to load the Persuasion Hub. Please try again.'}
      </p>
      <Button onClick={reset} variant="secondary" size="sm">
        Try again
      </Button>
    </div>
  )
}
