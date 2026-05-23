'use client'

import { ErrorCard } from '@/components/ui/ErrorCard'

export default function ResonanceError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <ErrorCard message={error.message} onRetry={reset} />
    </div>
  )
}
